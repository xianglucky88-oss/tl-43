export type PartType =
  | "motor"
  | "gear"
  | "connectingRod"
  | "piston"
  | "conveyorBelt"
  | "bearing"
  | "flywheel";

export type ConnectionType = "mesh" | "hinge" | "belt" | "rod";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PartPort {
  id: string;
  partId: string;
  localPosition: Vec3;
  type: "input" | "output" | "passive";
  connectedTo: string | null;
}

export interface BasePart {
  id: string;
  type: PartType;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  ports: PartPort[];
  physics: PartPhysics;
}

export interface PartPhysics {
  angularVelocity: number;
  linearVelocity: Vec3;
  torque: number;
  load: number;
  friction: number;
  mass: number;
  inertia: number;
  stalled: boolean;
  temperature: number;
  efficiency: number;
}

export interface Connection {
  id: string;
  type: ConnectionType;
  fromPartId: string;
  fromPortId: string;
  toPartId: string;
  toPortId: string;
  ratio: number;
  backlash: number;
  wear: number;
}

export interface GearPart extends BasePart {
  type: "gear";
  config: {
    teeth: number;
    radius: number;
    thickness: number;
  };
}

export interface MotorPart extends BasePart {
  type: "motor";
  config: {
    maxTorque: number;
    maxRPM: number;
    power: number;
    running: boolean;
  };
}

export interface ConnectingRodPart extends BasePart {
  type: "connectingRod";
  config: {
    length: number;
  };
}

export interface PistonPart extends BasePart {
  type: "piston";
  config: {
    stroke: number;
    cylinderRadius: number;
  };
  state: {
    position: number;
  };
}

export interface ConveyorBeltPart extends BasePart {
  type: "conveyorBelt";
  config: {
    length: number;
    width: number;
  };
}

export interface BearingPart extends BasePart {
  type: "bearing";
  config: {
    radius: number;
  };
}

export interface FlywheelPart extends BasePart {
  type: "flywheel";
  config: {
    radius: number;
    mass: number;
  };
}

export type FactoryPart =
  | GearPart
  | MotorPart
  | ConnectingRodPart
  | PistonPart
  | ConveyorBeltPart
  | BearingPart
  | FlywheelPart;

export interface SimulationState {
  running: boolean;
  timeScale: number;
  totalEnergy: number;
  systemEfficiency: number;
  warnings: SimulationWarning[];
  stepCount: number;
}

export interface SimulationWarning {
  id: string;
  partId: string;
  type: "stall" | "overload" | "overheat" | "slippage" | "misalignment";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: number;
}

export interface PartTemplate {
  type: PartType;
  name: string;
  description: string;
  defaultConfig: Record<string, unknown>;
  defaultPhysics: Partial<PartPhysics>;
}
