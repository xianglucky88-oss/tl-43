import { PartTemplate, PartPhysics } from "@/types/factory";

const basePhysics: Partial<PartPhysics> = {
  angularVelocity: 0,
  linearVelocity: { x: 0, y: 0, z: 0 },
  torque: 0,
  load: 0,
  temperature: 25,
  efficiency: 0.95,
  stalled: false,
};

export const PART_TEMPLATES: PartTemplate[] = [
  {
    type: "motor",
    name: "电动机",
    description: "动力源，驱动整个机械系统运转",
    defaultConfig: {
      maxTorque: 50,
      maxRPM: 3000,
      power: 1500,
      running: true,
    },
    defaultPhysics: {
      ...basePhysics,
      friction: 0.05,
      mass: 15,
      inertia: 0.8,
    },
  },
  {
    type: "gear",
    name: "直齿轮",
    description: "通过齿牙啮合传递旋转运动和扭矩",
    defaultConfig: {
      teeth: 20,
      radius: 0.4,
      thickness: 0.08,
    },
    defaultPhysics: {
      ...basePhysics,
      friction: 0.02,
      mass: 2,
      inertia: 0.15,
    },
  },
  {
    type: "connectingRod",
    name: "连杆",
    description: "将旋转运动转换为往复直线运动",
    defaultConfig: {
      length: 1.2,
    },
    defaultPhysics: {
      ...basePhysics,
      friction: 0.015,
      mass: 3,
      inertia: 0.25,
    },
  },
  {
    type: "piston",
    name: "活塞",
    description: "在气缸内做往复运动，驱动或被驱动",
    defaultConfig: {
      stroke: 0.6,
      cylinderRadius: 0.15,
    },
    defaultPhysics: {
      ...basePhysics,
      friction: 0.03,
      mass: 4,
      inertia: 0.1,
    },
  },
  {
    type: "conveyorBelt",
    name: "传送带",
    description: "通过摩擦传递连续运动",
    defaultConfig: {
      length: 3,
      width: 0.6,
    },
    defaultPhysics: {
      ...basePhysics,
      friction: 0.04,
      mass: 10,
      inertia: 1.5,
    },
  },
  {
    type: "bearing",
    name: "轴承",
    description: "支撑旋转轴，减少摩擦",
    defaultConfig: {
      radius: 0.08,
    },
    defaultPhysics: {
      ...basePhysics,
      friction: 0.005,
      mass: 0.8,
      inertia: 0.02,
    },
  },
  {
    type: "flywheel",
    name: "飞轮",
    description: "储存转动惯量，平滑转速波动",
    defaultConfig: {
      radius: 0.6,
      mass: 20,
    },
    defaultPhysics: {
      ...basePhysics,
      friction: 0.01,
      mass: 20,
      inertia: 3.6,
    },
  },
];

export function getPartTemplate(type: string): PartTemplate | undefined {
  return PART_TEMPLATES.find((t) => t.type === type);
}

export function createDefaultPhysics(
  template: PartTemplate,
  overrides: Partial<PartPhysics> = {}
): PartPhysics {
  return {
    angularVelocity: 0,
    linearVelocity: { x: 0, y: 0, z: 0 },
    torque: 0,
    load: 0,
    friction: 0.02,
    mass: 1,
    inertia: 0.1,
    stalled: false,
    temperature: 25,
    efficiency: 0.95,
    ...template.defaultPhysics,
    ...overrides,
  } as PartPhysics;
}
