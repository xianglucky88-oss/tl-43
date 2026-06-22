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

    const fromPart = get().parts.find((p) => p.id === mode.fromPartId);
    const toPart = get().parts.find((p) => p.id === partId);
    if (!fromPart || !toPart) return;

    let ratio = 1;
    let connType: Connection["type"] = "hinge";

    if (fromPart.type === "gear" && toPart.type === "gear") {
      const fromTeeth = (fromPart.config as { teeth: number }).teeth;
      const toTeeth = (toPart.config as { teeth: number }).teeth;
      ratio = -fromTeeth / toTeeth;
      connType = "mesh";
    } else if (fromPart.type === "motor") {
      connType = "hinge";
    } else if (fromPart.type === "conveyorBelt" || toPart.type === "conveyorBelt") {
      connType = "belt";
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
      const updatedParts = state.parts.map((p) => {
        if (p.id === mode.fromPartId) {
          return {
            ...p,
            ports: p.ports.map((pt) =>
              pt.id === mode.fromPortId ? { ...pt, connectedTo: partId } : pt
            ),
          };
        }
        if (p.id === partId) {
          return {
            ...p,
            ports: p.ports.map((pt) =>
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
    set((state) => ({
      simulation: { ...state.simulation, running: false },
    }));
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
    set({
      parts,
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
