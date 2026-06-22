import {
  FactoryPart,
  Connection,
  SimulationWarning,
  MotorPart,
  GearPart,
  PistonPart,
  ConnectingRodPart,
  ConveyorBeltPart,
  FlywheelPart,
  BearingPart,
} from "@/types/factory";

export interface PhysicsStepResult {
  partUpdates: {
    partId: string;
    physicsUpdates: Partial<FactoryPart["physics"]>;
    stateUpdates?: Record<string, unknown>;
  }[];
  totalEnergy: number;
  systemEfficiency: number;
  warnings: SimulationWarning[];
}

interface GraphNode {
  partId: string;
  angularVelocity: number;
  torque: number;
  visited: boolean;
  depth: number;
  driveSource: string | null;
  linearVelocity: { x: number; y: number; z: number };
}

let warningCounter = 0;
function createWarning(
  partId: string,
  type: SimulationWarning["type"],
  severity: SimulationWarning["severity"],
  message: string
): SimulationWarning {
  warningCounter++;
  return {
    id: `warn-${Date.now()}-${warningCounter}`,
    partId,
    type,
    severity,
    message,
    timestamp: Date.now(),
  };
}

function rpmToRadPerSec(rpm: number): number {
  return (rpm * Math.PI * 2) / 60;
}

function radPerSecToRPM(rad: number): number {
  return (rad * 60) / (Math.PI * 2);
}

export class PhysicsEngine {
  private dt: number = 1 / 60;
  private ambientTemperature: number = 25;

  constructor(fixedDt: number = 1 / 60) {
    this.dt = fixedDt;
  }

  step(
    parts: FactoryPart[],
    connections: Connection[],
    timeScale: number
  ): PhysicsStepResult {
    const dt = this.dt * timeScale;
    const warnings: SimulationWarning[] = [];
    const nodes = this.buildGraph(parts);
    const adjacency = this.buildAdjacency(parts, connections);

    this.propagateDrive(parts, connections, nodes, adjacency);
    this.solveTorqueBalance(parts, connections, nodes, adjacency, warnings);
    this.applyFrictionAndDamping(parts, nodes, warnings);
    this.updateKinematics(parts, connections, nodes, dt);
    this.updateThermal(parts, nodes, dt, warnings);
    this.detectStallAndOverload(parts, nodes, warnings);

    const partUpdates = this.buildUpdates(parts, nodes);
    const { totalEnergy, systemEfficiency } = this.calculateEnergyMetrics(
      parts,
      nodes
    );

    return {
      partUpdates,
      totalEnergy,
      systemEfficiency,
      warnings,
    };
  }

  private buildGraph(parts: FactoryPart[]): Map<string, GraphNode> {
    const nodes = new Map<string, GraphNode>();
    for (const part of parts) {
      nodes.set(part.id, {
        partId: part.id,
        angularVelocity: part.physics.angularVelocity,
        torque: part.physics.torque,
        visited: false,
        depth: 0,
        driveSource: null,
        linearVelocity: { ...part.physics.linearVelocity },
      });
    }
    return nodes;
  }

  private buildAdjacency(
    parts: FactoryPart[],
    connections: Connection[]
  ): Map<string, { conn: Connection; otherId: string; isFrom: boolean }[]> {
    const adj = new Map<
      string,
      { conn: Connection; otherId: string; isFrom: boolean }[]
    >();
    for (const p of parts) adj.set(p.id, []);
    for (const c of connections) {
      const fromList = adj.get(c.fromPartId);
      const toList = adj.get(c.toPartId);
      if (fromList) fromList.push({ conn: c, otherId: c.toPartId, isFrom: true });
      if (toList) toList.push({ conn: c, otherId: c.fromPartId, isFrom: false });
    }
    return adj;
  }

  private propagateDrive(
    parts: FactoryPart[],
    connections: Connection[],
    nodes: Map<string, GraphNode>,
    adjacency: Map<
      string,
      { conn: Connection; otherId: string; isFrom: boolean }[]
    >
  ) {
    const queue: string[] = [];

    for (const part of parts) {
      if (part.type === "motor") {
        const motor = part as MotorPart;
        const node = nodes.get(part.id);
        if (!node) continue;

        if (motor.config.running) {
          const targetOmega = rpmToRadPerSec(motor.config.maxRPM);
          node.angularVelocity = this.approachVelocity(
            node.angularVelocity,
            targetOmega,
            motor.physics.inertia,
            motor.config.maxTorque,
            this.dt
          );
          node.driveSource = part.id;
          node.visited = true;
          queue.push(part.id);
        }
      }
      if (part.type === "flywheel") {
        const node = nodes.get(part.id);
        if (node && node.angularVelocity !== 0) {
          node.driveSource = part.id;
          queue.push(part.id);
        }
      }
    }

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentNode = nodes.get(currentId)!;
      const edges = adjacency.get(currentId) || [];

      for (const edge of edges) {
        const neighborNode = nodes.get(edge.otherId);
        if (!neighborNode) continue;

        const transmission = this.calculateTransmission(
          currentId,
          edge.otherId,
          edge.conn,
          currentNode.angularVelocity,
          edge.isFrom
        );

        const expectedOmega = transmission.omega;
        const efficiencyFactor = edge.conn.type === "belt" ? 0.92 : 0.97;
        const wearPenalty = 1 - edge.conn.wear * 0.5;
        const finalExpected =
          expectedOmega * efficiencyFactor * wearPenalty;

        if (
          !neighborNode.visited ||
          this.isStrongerDrive(currentNode, neighborNode, edge.conn)
        ) {
          neighborNode.angularVelocity = finalExpected;
          neighborNode.visited = true;
          neighborNode.depth = currentNode.depth + 1;
          neighborNode.driveSource = currentNode.driveSource || currentId;
          queue.push(edge.otherId);
        }
      }
    }
  }

  private calculateTransmission(
    fromId: string,
    toId: string,
    conn: Connection,
    inputOmega: number,
    isFrom: boolean
  ): { omega: number; torque: number; ratio: number } {
    let ratio = conn.ratio;
    if (!isFrom) ratio = 1 / ratio;

    if (conn.type === "mesh") {
      ratio = isFrom ? conn.ratio : 1 / conn.ratio;
    }

    const safeRatio = Math.max(Math.min(ratio, 100), -100);
    const outputOmega = inputOmega * safeRatio;
    const clampedOmega = Math.max(Math.min(outputOmega, 3000), -3000);
    const outputTorque = 0;

    return { omega: clampedOmega, torque: outputTorque, ratio: safeRatio };
  }

  private isStrongerDrive(
    current: GraphNode,
    neighbor: GraphNode,
    conn: Connection
  ): boolean {
    if (!neighbor.visited) return true;
    if (!neighbor.driveSource) return true;
    if (current.depth + 1 < neighbor.depth) return true;
    return (
      conn.type === "mesh" &&
      Math.abs(current.angularVelocity) > Math.abs(neighbor.angularVelocity)
    );
  }

  private approachVelocity(
    current: number,
    target: number,
    inertia: number,
    maxTorque: number,
    dt: number
  ): number {
    const maxDelta = (maxTorque / Math.max(inertia, 0.001)) * dt;
    const delta = target - current;
    if (Math.abs(delta) <= maxDelta) return target;
    return current + Math.sign(delta) * maxDelta;
  }

  private solveTorqueBalance(
    parts: FactoryPart[],
    connections: Connection[],
    nodes: Map<string, GraphNode>,
    adjacency: Map<
      string,
      { conn: Connection; otherId: string; isFrom: boolean }[]
    >,
    warnings: SimulationWarning[]
  ) {
    for (const part of parts) {
      const node = nodes.get(part.id);
      if (!node) continue;

      const edges = adjacency.get(part.id) || [];
      let totalLoadTorque = 0;
      let inputTorque = 0;

      for (const edge of edges) {
        const otherNode = nodes.get(edge.otherId);
        if (!otherNode) continue;

        if (edge.isFrom) {
          const ratio = Math.abs(edge.conn.ratio);
          const loadFromOther = otherNode.torque / Math.max(ratio, 0.001);
          totalLoadTorque += loadFromOther * 1.05;
        } else {
          const ratio = Math.abs(1 / edge.conn.ratio);
          const drivenTorque = node.torque * ratio * 0.98;
          inputTorque += drivenTorque;
        }
      }

      if (part.type === "motor") {
        const motor = part as MotorPart;
        if (motor.config.running) {
          const omega = Math.abs(node.angularVelocity);
          const maxOmega = rpmToRadPerSec(motor.config.maxRPM);
          const loadFactor = 1 - omega / Math.max(maxOmega, 0.001);
          const availableTorque =
            motor.config.maxTorque * Math.max(0.1, loadFactor);
          node.torque = Math.min(
            availableTorque,
            totalLoadTorque + motor.physics.load
          );

          if (totalLoadTorque > motor.config.maxTorque * 1.2) {
            warnings.push(
              createWarning(
                part.id,
                "overload",
                totalLoadTorque > motor.config.maxTorque * 2
                  ? "critical"
                  : "high",
                `电机过载: ${(totalLoadTorque / motor.config.maxTorque * 100).toFixed(0)}%`
              )
            );
          }
        } else {
          node.torque = 0;
        }
      } else {
        node.torque = inputTorque - totalLoadTorque;
      }

      const inertia = part.physics.inertia;
      const loadResistance = totalLoadTorque / Math.max(inertia, 0.001);
      node.angularVelocity *= 1 - Math.min(loadResistance * this.dt * 0.1, 0.5);

      if (part.type === "gear") {
        const omega = Math.abs(node.angularVelocity);
        const gear = part as GearPart;
        const toothSpeed = omega * gear.config.radius;
        if (toothSpeed > 80) {
          warnings.push(
            createWarning(
              part.id,
              "slippage",
              toothSpeed > 150 ? "high" : "medium",
              `齿轮线速度过高: ${toothSpeed.toFixed(1)}m/s`
            )
          );
        }
      }
    }
  }

  private applyFrictionAndDamping(
    parts: FactoryPart[],
    nodes: Map<string, GraphNode>,
    warnings: SimulationWarning[]
  ) {
    for (const part of parts) {
      const node = nodes.get(part.id);
      if (!node) continue;

      const friction = part.physics.friction;
      const inertia = Math.max(part.physics.inertia, 0.001);
      const frictionTorque = friction * 9.8 * part.physics.mass;

      const frictionDecay =
        1 - Math.min((frictionTorque / inertia) * this.dt, 0.99);
      node.angularVelocity *= frictionDecay;

      const viscousDamping = 0.002;
      node.angularVelocity *= 1 - viscousDamping;

      if (Math.abs(node.angularVelocity) < 0.005) {
        node.angularVelocity = 0;
      }
    }
  }

  private updateKinematics(
    parts: FactoryPart[],
    connections: Connection[],
    nodes: Map<string, GraphNode>,
    dt: number
  ) {
    const omegaMap = new Map<string, number>();
    for (const [id, node] of nodes) {
      omegaMap.set(id, node.angularVelocity);
    }

    for (const part of parts) {
      const node = nodes.get(part.id);
      if (!node) continue;

      if (part.type === "connectingRod") {
        const rod = part as ConnectingRodPart;
        const rodConns = connections.filter(
          (c) => c.fromPartId === part.id || c.toPartId === part.id
        );

        for (const conn of rodConns) {
          const otherId =
            conn.fromPartId === part.id ? conn.toPartId : conn.fromPartId;
          const otherPart = parts.find((p) => p.id === otherId);
          const otherOmega = omegaMap.get(otherId) || 0;

          if (otherPart && otherPart.type === "gear") {
            node.angularVelocity = otherOmega * 0.5;
          }
        }
      }

      if (part.type === "piston") {
        const piston = part as PistonPart;
        const pistonConn = connections.find(
          (c) => c.fromPartId === part.id || c.toPartId === part.id
        );

        if (pistonConn) {
          const otherId =
            pistonConn.fromPartId === part.id
              ? pistonConn.toPartId
              : pistonConn.fromPartId;
          const otherPart = parts.find((p) => p.id === otherId);
          const otherOmega = omegaMap.get(otherId) || 0;

          if (otherPart) {
            let crankAngle = 0;
            const existingState = (piston as { state?: { position: number; crankAngle?: number } }).state || { position: 0 };
            if (existingState && (existingState as { crankAngle?: number }).crankAngle !== undefined) {
              crankAngle = (existingState as { crankAngle: number }).crankAngle;
            }

            crankAngle += otherOmega * dt;
            const stroke = piston.config.stroke;
            const rodLength = (part as { config?: { length?: number } }).config?.length || stroke * 2;
            const pos =
              (stroke / 2) *
              (1 -
                Math.cos(crankAngle) +
                (stroke / (4 * rodLength)) * Math.sin(crankAngle) ** 2);

            node.linearVelocity = {
              x: 0,
              y: 0,
              z: pos - ((existingState as { position?: number }).position || 0),
            };

            const pistonState = (part as unknown as { state?: Record<string, unknown> }).state || {};
            Object.assign(pistonState, {
              position: pos,
              crankAngle,
            });
          }
        }
      }

      if (part.type === "conveyorBelt") {
        const belt = part as ConveyorBeltPart;
        const beltConns = connections.filter(
          (c) => c.fromPartId === part.id || c.toPartId === part.id
        );

        for (const conn of beltConns) {
          const otherId =
            conn.fromPartId === part.id ? conn.toPartId : conn.fromPartId;
          const otherOmega = omegaMap.get(otherId) || 0;

          const pulleyRadius = 0.1;
          const beltSpeed = otherOmega * pulleyRadius;
          node.linearVelocity = {
            x: beltSpeed,
            y: 0,
            z: 0,
          };

          if (conn.type === "belt" && Math.abs(otherOmega) > 0) {
            const tensionLoss = Math.abs(beltSpeed) * 0.001;
            node.angularVelocity = otherOmega * (1 - Math.min(tensionLoss, 0.1));
          }
        }
      }

      if (part.type === "flywheel") {
        const flywheel = part as FlywheelPart;
        const storedEnergy =
          0.5 *
          flywheel.config.mass *
          flywheel.config.radius *
          flywheel.config.radius *
          node.angularVelocity *
          node.angularVelocity;
        node.torque += storedEnergy * 0.001;
      }

      if (part.type === "bearing") {
        const bearing = part as BearingPart;
        const bearingConns = connections.filter(
          (c) => c.fromPartId === part.id || c.toPartId === part.id
        );

        for (const conn of bearingConns) {
          const otherId =
            conn.fromPartId === part.id ? conn.toPartId : conn.fromPartId;
          const otherOmega = omegaMap.get(otherId);
          if (otherOmega !== undefined) {
            node.angularVelocity = otherOmega * (1 - bearing.physics.friction);
          }
        }
      }
    }
  }

  private updateThermal(
    parts: FactoryPart[],
    nodes: Map<string, GraphNode>,
    dt: number,
    warnings: SimulationWarning[]
  ) {
    for (const part of parts) {
      const node = nodes.get(part.id);
      if (!node) continue;

      let currentTemp = part.physics.temperature;
      const omega = Math.abs(node.angularVelocity);
      const load = part.physics.load;

      const heatGeneration =
        (omega * part.physics.friction * part.physics.mass +
          load * load * part.physics.mass * 0.001) *
        dt;
      const coolingRate = 0.02;
      const cooling =
        (currentTemp - this.ambientTemperature) * coolingRate * dt;

      currentTemp += heatGeneration - cooling;
      currentTemp = Math.max(this.ambientTemperature, currentTemp);

      part.physics.temperature = currentTemp;

      if (currentTemp > 120) {
        warnings.push(
          createWarning(
            part.id,
            "overheat",
            currentTemp > 200 ? "critical" : "high",
            `过热: ${currentTemp.toFixed(0)}°C`
          )
        );
        node.angularVelocity *= 0.98;
      }

      if (currentTemp > 80) {
        part.physics.efficiency = Math.max(
          0.5,
          0.95 - (currentTemp - 80) * 0.003
        );
      }
    }
  }

  private detectStallAndOverload(
    parts: FactoryPart[],
    nodes: Map<string, GraphNode>,
    warnings: SimulationWarning[]
  ) {
    for (const part of parts) {
      const node = nodes.get(part.id);
      if (!node) continue;

      if (part.type === "motor") {
        const motor = part as MotorPart;
        if (
          motor.config.running &&
          Math.abs(node.angularVelocity) < 0.01 &&
          node.torque > motor.config.maxTorque * 0.5
        ) {
          warnings.push(
            createWarning(
              part.id,
              "stall",
              "critical",
              "电机堵转! 请检查负载或齿轮比"
            )
          );
          part.physics.stalled = true;
          node.angularVelocity = 0;
        } else {
          part.physics.stalled = false;
        }
      }

      if (part.type === "gear" && part.physics.stalled) {
        part.physics.stalled =
          Math.abs(node.angularVelocity) < 0.01 &&
          Math.abs(node.torque) > 5;
      }
    }
  }

  private clampValue(v: number, min: number, max: number): number {
    if (!isFinite(v) || isNaN(v)) return (min + max) / 2;
    return Math.max(min, Math.min(max, v));
  }

  private buildUpdates(
    parts: FactoryPart[],
    nodes: Map<string, GraphNode>
  ): PhysicsStepResult["partUpdates"] {
    const updates: PhysicsStepResult["partUpdates"] = [];

    for (const part of parts) {
      const node = nodes.get(part.id);
      if (!node) continue;

      const omega = this.clampValue(node.angularVelocity, -3000, 3000);
      const torque = this.clampValue(node.torque, -10000, 10000);
      const temperature = this.clampValue(part.physics.temperature, 20, 500);
      const efficiency = this.clampValue(part.physics.efficiency, 0, 1);
      const linVel = node.linearVelocity
        ? {
            x: this.clampValue(node.linearVelocity.x, -100, 100),
            y: this.clampValue(node.linearVelocity.y, -100, 100),
            z: this.clampValue(node.linearVelocity.z, -100, 100),
          }
        : { x: 0, y: 0, z: 0 };

      const update: PhysicsStepResult["partUpdates"][number] = {
        partId: part.id,
        physicsUpdates: {
          angularVelocity: omega,
          torque,
          linearVelocity: linVel,
          temperature,
          efficiency,
          stalled: part.physics.stalled,
        },
      };

      if (part.type === "piston") {
        const pistonState = (part as unknown as { state?: Record<string, unknown> }).state;
        if (pistonState) {
          update.stateUpdates = { ...pistonState };
        }
      }

      updates.push(update);
    }

    return updates;
  }

  private calculateEnergyMetrics(
    parts: FactoryPart[],
    nodes: Map<string, GraphNode>
  ): { totalEnergy: number; systemEfficiency: number } {
    let kineticEnergy = 0;
    let inputPower = 0;
    let outputPower = 0;

    for (const part of parts) {
      const node = nodes.get(part.id);
      if (!node) continue;

      const inertia = Math.max(part.physics.inertia, 0.001);
      const omega = this.clampValue(node.angularVelocity, -3000, 3000);
      kineticEnergy += 0.5 * inertia * omega * omega;

      if (part.type === "motor") {
        const motor = part as MotorPart;
        if (motor.config.running) {
          inputPower += motor.config.power * part.physics.efficiency;
          outputPower += Math.abs(
            this.clampValue(node.torque, -10000, 10000) * omega
          );
        }
      }
    }

    const safeKinetic = this.clampValue(kineticEnergy, 0, 10000000);
    const systemEfficiency =
      inputPower > 0 ? this.clampValue(outputPower / inputPower, 0, 1) : 1.0;
    return {
      totalEnergy: safeKinetic,
      systemEfficiency: Math.min(1, Math.max(0, systemEfficiency)),
    };
  }
}

export const physicsEngine = new PhysicsEngine(1 / 60);
