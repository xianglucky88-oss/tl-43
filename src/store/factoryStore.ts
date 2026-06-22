import { create } from "zustand";
import {
  FactoryPart,
  Connection,
  SimulationState,
  SimulationWarning,
  PartType,
  Vec3,
} from "@/types/factory";
import {
  PART_TEMPLATES,
  getPartTemplate,
  createDefaultPhysics,
} from "@/data/partTemplates";

let idCounter = 0;
function uuid4(): string {
  idCounter++;
  return `id-${Date.now().toString(36)}-${idCounter}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

interface FactoryState {
  parts: FactoryPart[];
  connections: Connection[];
  simulation: SimulationState;
  selectedPartId: string | null;
  selectedConnectionId: string | null;
  placingPartType: PartType | null;
  connectionMode: {
    active: boolean;
    fromPartId: string | null;
    fromPortId: string | null;
  };
  gridSnapping: boolean;
  gridSize: number;

  addPart: (type: PartType, position: Vec3, rotation?: Vec3) => void;
  removePart: (partId: string) => void;
  updatePartPosition: (partId: string, position: Vec3) => void;
  updatePartRotation: (partId: string, rotation: Vec3) => void;
  updatePartConfig: (partId: string, config: Record<string, unknown>) => void;
  selectPart: (partId: string | null) => void;
  setPlacingPartType: (type: PartType | null) => void;

  startConnection: (partId: string, portId: string) => void;
  completeConnection: (partId: string, portId: string) => void;
  cancelConnection: () => void;
  removeConnection: (connectionId: string) => void;

  startSimulation: () => void;
  stopSimulation: () => void;
  setTimeScale: (scale: number) => void;
  applySimulationStep: (
    updates: {
      partId: string;
      physicsUpdates: Partial<FactoryPart["physics"]>;
      stateUpdates?: Record<string, unknown>;
    }[],
    meta: {
      totalEnergy: number;
      systemEfficiency: number;
      warnings: SimulationWarning[];
    }
  ) => void;

  clearWarnings: () => void;
  clearAll: () => void;
  loadPreset: (parts: FactoryPart[], connections: Connection[]) => void;
  toggleMotor: (motorId: string) => void;
}

function createPorts(part: FactoryPart): FactoryPart["ports"] {
  const ports: FactoryPart["ports"] = [];
  const id = part.id;

  switch (part.type) {
    case "motor":
      ports.push({
        id: `${id}-out`,
        partId: id,
        localPosition: { x: 0, y: 0.3, z: 0 },
        type: "output",
        connectedTo: null,
      });
      break;
    case "gear":
      ports.push({
        id: `${id}-center`,
        partId: id,
        localPosition: { x: 0, y: 0, z: 0 },
        type: "passive",
        connectedTo: null,
      });
      ports.push({
        id: `${id}-mesh`,
        partId: id,
        localPosition: { x: (part as { config: { radius: number } }).config.radius, y: 0, z: 0 },
        type: "passive",
        connectedTo: null,
      });
      break;
    case "connectingRod":
      ports.push({
        id: `${id}-crank`,
        partId: id,
        localPosition: { x: -0.5, y: 0, z: 0 },
        type: "passive",
        connectedTo: null,
      });
      ports.push({
        id: `${id}-piston`,
        partId: id,
        localPosition: { x: 0.5, y: 0, z: 0 },
        type: "passive",
        connectedTo: null,
      });
      break;
    case "piston":
      ports.push({
        id: `${id}-rod`,
        partId: id,
        localPosition: { x: 0, y: 0, z: 0 },
        type: "input",
        connectedTo: null,
      });
      break;
    case "conveyorBelt":
      ports.push({
        id: `${id}-driveA`,
        partId: id,
        localPosition: { x: -1, y: 0, z: 0 },
        type: "input",
        connectedTo: null,
      });
      ports.push({
        id: `${id}-driveB`,
        partId: id,
        localPosition: { x: 1, y: 0, z: 0 },
        type: "output",
        connectedTo: null,
      });
      break;
    case "bearing":
      ports.push({
        id: `${id}-shaft`,
        partId: id,
        localPosition: { x: 0, y: 0, z: 0 },
        type: "passive",
        connectedTo: null,
      });
      break;
    case "flywheel":
      ports.push({
        id: `${id}-center`,
        partId: id,
        localPosition: { x: 0, y: 0, z: 0 },
        type: "passive",
        connectedTo: null,
      });
      break;
  }
  return ports;
}

function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

function worldPortPosition(
  part: FactoryPart,
  localPos: Vec3
): Vec3 {
  const rx = part.rotation.x || 0;
  const ry = part.rotation.y || 0;
  const rz = part.rotation.z || 0;

  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);

  let x = localPos.x;
  let y = localPos.y;
  let z = localPos.z;

  let y1 = y * cosX - z * sinX;
  let z1 = y * sinX + z * cosX;
  let x1 = x;

  let x2 = x1 * cosY + z1 * sinY;
  let z2 = -x1 * sinY + z1 * cosY;
  let y2 = y1;

  let x3 = x2 * cosZ - y2 * sinZ;
  let y3 = x2 * sinZ + y2 * cosZ;
  let z3 = z2;

  return {
    x: part.position.x + x3,
    y: part.position.y + y3,
    z: part.position.z + z3,
  };
}

function computeAlignment(
  targetPart: FactoryPart,
  targetPortLocal: Vec3,
  fromWorld: Vec3,
  existingOtherPortWorld?: Vec3
): { position: Vec3; rotation: Vec3 } {
  const isTwoEnded =
    targetPart.type === "connectingRod" || targetPart.type === "conveyorBelt";

  if (!isTwoEnded || !existingOtherPortWorld) {
    const dx = targetPortLocal.x;
    const dy = targetPortLocal.y;
    const dz = targetPortLocal.z;
    return {
      position: {
        x: fromWorld.x - dx,
        y: fromWorld.y - dy,
        z: fromWorld.z - dz,
      },
      rotation: targetPart.rotation,
    };
  }

  const dirX = existingOtherPortWorld.x - fromWorld.x;
  const dirY = existingOtherPortWorld.y - fromWorld.y;
  const dirZ = existingOtherPortWorld.z - fromWorld.z;
  const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);

  if (len < 0.001) {
    return { position: targetPart.position, rotation: targetPart.rotation };
  }

  const nx = dirX / len;
  const ny = dirY / len;
  const nz = dirZ / len;

  const ry = -Math.atan2(nz, nx);
  const horiz = Math.sqrt(nx * nx + nz * nz);
  const rx = Math.atan2(ny, horiz);
  const rz = 0;

  const midX = (fromWorld.x + existingOtherPortWorld.x) / 2;
  const midY = (fromWorld.y + existingOtherPortWorld.y) / 2;
  const midZ = (fromWorld.z + existingOtherPortWorld.z) / 2;

  const ports = targetPart.ports;
  const portPositions = ports.map((p) => p.localPosition);
  const centerX =
    portPositions.reduce((s, p) => s + p.x, 0) / portPositions.length;
  const centerY =
    portPositions.reduce((s, p) => s + p.y, 0) / portPositions.length;
  const centerZ =
    portPositions.reduce((s, p) => s + p.z, 0) / portPositions.length;

  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);

  let cy1 = centerY * cosX - centerZ * sinX;
  let cz1 = centerY * sinX + centerZ * cosX;
  let cx1 = centerX;

  let cx2 = cx1 * cosY + cz1 * sinY;
  let cz2 = -cx1 * sinY + cz1 * cosY;
  let cy2 = cy1;

  let cx3 = cx2 * cosZ - cy2 * sinZ;
  let cy3 = cx2 * sinZ + cy2 * cosZ;
  let cz3 = cz2;

  return {
    position: {
      x: midX - cx3,
      y: midY - cy3,
      z: midZ - cz3,
    },
    rotation: { x: rx, y: ry, z: rz },
  };
}

export const useFactoryStore = create<FactoryState>((set, get) => ({
  parts: [],
  connections: [],
  simulation: {
    running: false,
    timeScale: 1.0,
    totalEnergy: 0,
    systemEfficiency: 1.0,
    warnings: [],
    stepCount: 0,
  },
  selectedPartId: null,
  selectedConnectionId: null,
  placingPartType: null,
  connectionMode: {
    active: false,
    fromPartId: null,
    fromPortId: null,
  },
  gridSnapping: true,
  gridSize: 0.25,

  addPart: (type, position, rotation = { x: 0, y: 0, z: 0 }) => {
    const template = getPartTemplate(type);
    if (!template) return;

    const gridSize = get().gridSize;
    const snapping = get().gridSnapping;
    const finalPos: Vec3 = snapping
      ? {
          x: snapToGrid(position.x, gridSize),
          y: snapToGrid(position.y, gridSize),
          z: snapToGrid(position.z, gridSize),
        }
      : position;

    const newPart = {
      id: uuid4(),
      type,
      position: finalPos,
      rotation,
      scale: { x: 1, y: 1, z: 1 },
      config: { ...template.defaultConfig },
      physics: createDefaultPhysics(template),
      ports: [],
    } as FactoryPart;

    if (newPart.type === "piston") {
      (newPart as { state: { position: number } }).state = { position: 0 };
    }

    newPart.ports = createPorts(newPart);

    set((state) => ({
      parts: [...state.parts, newPart],
      placingPartType: null,
      selectedPartId: newPart.id,
    }));
  },

  removePart: (partId) => {
    set((state) => ({
      parts: state.parts.filter((p) => p.id !== partId),
      connections: state.connections.filter(
        (c) => c.fromPartId !== partId && c.toPartId !== partId
      ),
      selectedPartId: state.selectedPartId === partId ? null : state.selectedPartId,
    }));
  },

  updatePartPosition: (partId, position) => {
    const gridSize = get().gridSize;
    const snapping = get().gridSnapping;
    const finalPos = snapping
      ? {
          x: snapToGrid(position.x, gridSize),
          y: snapToGrid(position.y, gridSize),
          z: snapToGrid(position.z, gridSize),
        }
      : position;

    set((state) => ({
      parts: state.parts.map((p) =>
        p.id === partId ? { ...p, position: finalPos } : p
      ),
    }));
  },

  updatePartRotation: (partId, rotation) => {
    set((state) => ({
      parts: state.parts.map((p) =>
        p.id === partId ? { ...p, rotation } : p
      ),
    }));
  },

  updatePartConfig: (partId, config) => {
    set((state) => ({
      parts: state.parts.map((p) =>
        p.id === partId
          ? ({
              ...p,
              config: { ...(p.config as Record<string, unknown>), ...config },
            } as FactoryPart)
          : p
      ),
    }));
  },

  selectPart: (partId) => {
    set({ selectedPartId: partId, selectedConnectionId: null });
  },

  setPlacingPartType: (type) => {
    set({ placingPartType: type, selectedPartId: null });
  },

  startConnection: (partId, portId) => {
    set({
      connectionMode: {
        active: true,
        fromPartId: partId,
        fromPortId: portId,
      },
    });
  },

  completeConnection: (partId, portId) => {
    const mode = get().connectionMode;
    if (!mode.active || !mode.fromPartId || !mode.fromPortId) return;
    if (mode.fromPartId === partId) {
      set({
        connectionMode: { active: false, fromPartId: null, fromPortId: null },
      });
      return;
    }

    const allParts = get().parts;
    const allConns = get().connections;
    const fromPart = allParts.find((p) => p.id === mode.fromPartId);
    const toPart = allParts.find((p) => p.id === partId);
    if (!fromPart || !toPart) return;

    const fromPort = fromPart.ports.find((p) => p.id === mode.fromPortId);
    const toPort = toPart.ports.find((p) => p.id === portId);
    if (!fromPort || !toPort) return;

    let ratio = 1;
    let connType: Connection["type"] = "hinge";

    if (fromPart.type === "gear" && toPart.type === "gear") {
      const fromTeeth = (fromPart.config as { teeth: number }).teeth;
      const toTeeth = (toPart.config as { teeth: number }).teeth;
      ratio = -fromTeeth / toTeeth;
      connType = "mesh";
    } else if (
      fromPart.type === "connectingRod" ||
      toPart.type === "connectingRod"
    ) {
      connType = "rod";
      ratio = 1;
    } else if (
      fromPart.type === "conveyorBelt" ||
      toPart.type === "conveyorBelt"
    ) {
      connType = "belt";
      ratio = 1;
    } else {
      connType = "hinge";
      ratio = 1;
    }

    const newConnection: Connection = {
      id: uuid4(),
      type: connType,
      fromPartId: mode.fromPartId,
      fromPortId: mode.fromPortId,
      toPartId: partId,
      toPortId: portId,
      ratio,
      backlash: 0.02,
      wear: 0,
    };

    set((state) => {
      const snapping = get().gridSnapping;
      const gs = get().gridSize;
      const snap = (v: number) => (snapping ? snapToGrid(v, gs) : v);

      const fromWorld = worldPortPosition(fromPart, fromPort.localPosition);

      let alignedToPart = { ...toPart };
      let alignedFromPart = { ...fromPart };

      const twoEndedTypes: PartType[] = ["connectingRod", "conveyorBelt"];

      if (twoEndedTypes.includes(toPart.type)) {
        const otherConns = allConns.filter(
          (c) =>
            (c.fromPartId === toPart.id || c.toPartId === toPart.id) &&
            c.fromPortId !== portId &&
            c.toPortId !== portId
        );

        if (otherConns.length > 0) {
          const otherConn = otherConns[0];
          const otherPartId =
            otherConn.fromPartId === toPart.id
              ? otherConn.toPartId
              : otherConn.fromPartId;
          const otherPortId =
            otherConn.fromPartId === toPart.id
              ? otherConn.toPortId
              : otherConn.fromPortId;
          const otherPart = allParts.find((p) => p.id === otherPartId);
          if (otherPart) {
            const otherPort = otherPart.ports.find(
              (p) => p.id === otherPortId
            );
            if (otherPort) {
              const otherWorld = worldPortPosition(
                otherPart,
                otherPort.localPosition
              );
              const align = computeAlignment(
                toPart,
                toPort.localPosition,
                fromWorld,
                otherWorld
              );
              alignedToPart = {
                ...alignedToPart,
                position: {
                  x: snap(align.position.x),
                  y: snap(align.position.y),
                  z: snap(align.position.z),
                },
                rotation: align.rotation,
              };
            }
          }
        } else {
          const align = computeAlignment(
            toPart,
            toPort.localPosition,
            fromWorld
          );
          alignedToPart = {
            ...alignedToPart,
            position: {
              x: snap(align.position.x),
              y: snap(align.position.y),
              z: snap(align.position.z),
            },
          };
        }
      } else if (twoEndedTypes.includes(fromPart.type)) {
        const otherConns = allConns.filter(
          (c) =>
            (c.fromPartId === fromPart.id || c.toPartId === fromPart.id) &&
            c.fromPortId !== mode.fromPortId &&
            c.toPortId !== mode.fromPortId
        );

        if (otherConns.length > 0) {
          const otherConn = otherConns[0];
          const otherPartId =
            otherConn.fromPartId === fromPart.id
              ? otherConn.toPartId
              : otherConn.fromPartId;
          const otherPortId =
            otherConn.fromPartId === fromPart.id
              ? otherConn.toPortId
              : otherConn.fromPortId;
          const otherPart = allParts.find((p) => p.id === otherPartId);
          if (otherPart) {
            const otherPort = otherPart.ports.find(
              (p) => p.id === otherPortId
            );
            if (otherPort) {
              const toWorld = worldPortPosition(toPart, toPort.localPosition);
              const otherWorld = worldPortPosition(
                otherPart,
                otherPort.localPosition
              );
              const align = computeAlignment(
                fromPart,
                fromPort.localPosition,
                toWorld,
                otherWorld
              );
              alignedFromPart = {
                ...alignedFromPart,
                position: {
                  x: snap(align.position.x),
                  y: snap(align.position.y),
                  z: snap(align.position.z),
                },
                rotation: align.rotation,
              };
            }
          }
        } else {
          const toWorld = worldPortPosition(toPart, toPort.localPosition);
          const align = computeAlignment(
            fromPart,
            fromPort.localPosition,
            toWorld
          );
          alignedFromPart = {
            ...alignedFromPart,
            position: {
              x: snap(align.position.x),
              y: snap(align.position.y),
              z: snap(align.position.z),
            },
          };
        }
      } else {
        const align = computeAlignment(toPart, toPort.localPosition, fromWorld);
        alignedToPart = {
          ...alignedToPart,
          position: {
            x: snap(align.position.x),
            y: snap(align.position.y),
            z: snap(align.position.z),
          },
        };
      }

      const updatedParts = state.parts.map((p) => {
        if (p.id === mode.fromPartId) {
          return {
            ...alignedFromPart,
            ports: alignedFromPart.ports.map((pt) =>
              pt.id === mode.fromPortId ? { ...pt, connectedTo: partId } : pt
            ),
          };
        }
        if (p.id === partId) {
          return {
            ...alignedToPart,
            ports: alignedToPart.ports.map((pt) =>
              pt.id === portId ? { ...pt, connectedTo: mode.fromPartId! } : pt
            ),
          };
        }
        return p;
      });

      return {
        parts: updatedParts,
        connections: [...state.connections, newConnection],
        connectionMode: { active: false, fromPartId: null, fromPortId: null },
      };
    });
  },

  cancelConnection: () => {
    set({
      connectionMode: { active: false, fromPartId: null, fromPortId: null },
    });
  },

  removeConnection: (connectionId) => {
    set((state) => {
      const conn = state.connections.find((c) => c.id === connectionId);
      if (!conn) return state;

      const updatedParts = state.parts.map((p) => {
        if (p.id === conn.fromPartId) {
          return {
            ...p,
            ports: p.ports.map((pt) =>
              pt.id === conn.fromPortId ? { ...pt, connectedTo: null } : pt
            ),
          };
        }
        if (p.id === conn.toPartId) {
          return {
            ...p,
            ports: p.ports.map((pt) =>
              pt.id === conn.toPortId ? { ...pt, connectedTo: null } : pt
            ),
          };
        }
        return p;
      });

      return {
        parts: updatedParts,
        connections: state.connections.filter((c) => c.id !== connectionId),
        selectedConnectionId:
          state.selectedConnectionId === connectionId
            ? null
            : state.selectedConnectionId,
      };
    });
  },

  startSimulation: () => {
    set((state) => ({
      simulation: { ...state.simulation, running: true },
    }));
  },

  stopSimulation: () => {
    set((state) => {
      const resetParts = state.parts.map((p) => ({
        ...p,
        physics: {
          ...p.physics,
          angularVelocity: 0,
          linearVelocity: { x: 0, y: 0, z: 0 },
          torque: 0,
          load: 0,
          temperature: 25,
          efficiency: 1,
        },
      }));
      return {
        simulation: { ...state.simulation, running: false },
        parts: resetParts,
      };
    });
  },

  setTimeScale: (scale) => {
    set((state) => ({
      simulation: { ...state.simulation, timeScale: scale },
    }));
  },

  applySimulationStep: (updates, meta) => {
    set((state) => {
      const updatedParts = state.parts.map((p) => {
        const update = updates.find((u) => u.partId === p.id);
        if (!update) return p;

        let newPart: FactoryPart = {
          ...p,
          physics: { ...p.physics, ...update.physicsUpdates },
        };

        if (update.stateUpdates) {
          newPart = {
            ...newPart,
            state: {
              ...((newPart as { state?: Record<string, unknown> }).state || {}),
              ...update.stateUpdates,
            },
          } as FactoryPart;
        }

        return newPart;
      });

      return {
        parts: updatedParts,
        simulation: {
          ...state.simulation,
          totalEnergy: meta.totalEnergy,
          systemEfficiency: meta.systemEfficiency,
          warnings: [...state.simulation.warnings, ...meta.warnings].slice(-50),
          stepCount: state.simulation.stepCount + 1,
        },
      };
    });
  },

  clearWarnings: () => {
    set((state) => ({
      simulation: { ...state.simulation, warnings: [] },
    }));
  },

  clearAll: () => {
    set({
      parts: [],
      connections: [],
      selectedPartId: null,
      selectedConnectionId: null,
      simulation: {
        running: false,
        timeScale: 1.0,
        totalEnergy: 0,
        systemEfficiency: 1.0,
        warnings: [],
        stepCount: 0,
      },
    });
  },

  loadPreset: (parts, connections) => {
    const twoEndedTypes: PartType[] = ["connectingRod", "conveyorBelt"];
    const alignedParts = parts.map((p) => {
      if (!twoEndedTypes.includes(p.type)) return p;
      if (p.ports.length < 2) return p;

      const pConns = connections.filter(
        (c) => c.fromPartId === p.id || c.toPartId === p.id
      );
      if (pConns.length < 2) return p;

      const getEndpoint = (conn: Connection): Vec3 | null => {
        const otherId = conn.fromPartId === p.id ? conn.toPortId : conn.fromPortId;
        const otherPartId =
          conn.fromPartId === p.id ? conn.toPartId : conn.fromPartId;
        const otherPart = parts.find((pp) => pp.id === otherPartId);
        if (!otherPart) return null;
        const otherPort = otherPart.ports.find((pp) => pp.id === otherId);
        if (!otherPort) return null;
        return worldPortPosition(otherPart, otherPort.localPosition);
      };

      const ep0 = getEndpoint(pConns[0]);
      const ep1 = getEndpoint(pConns[1]);
      if (!ep0 || !ep1) return p;

      const targetPort = p.ports.find(
        (pt) => pt.id === (pConns[0].fromPartId === p.id ? pConns[0].fromPortId : pConns[0].toPortId)
      );
      if (!targetPort) return p;

      const align = computeAlignment(p, targetPort.localPosition, ep0, ep1);
      return {
        ...p,
        position: align.position,
        rotation: align.rotation,
      };
    });

    set({
      parts: alignedParts,
      connections,
      selectedPartId: null,
      selectedConnectionId: null,
      simulation: {
        running: false,
        timeScale: 1.0,
        totalEnergy: 0,
        systemEfficiency: 1.0,
        warnings: [],
        stepCount: 0,
      },
    });
  },

  toggleMotor: (motorId) => {
    set((state) => ({
      parts: state.parts.map((p) => {
        if (p.id === motorId && p.type === "motor") {
          return {
            ...p,
            config: {
              ...(p.config as Record<string, unknown>),
              running: !(p.config as { running: boolean }).running,
            },
          } as FactoryPart;
        }
        return p;
      }),
    }));
  },
}));

export { PART_TEMPLATES };
