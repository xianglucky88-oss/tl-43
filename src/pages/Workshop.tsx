import React, { useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import {
  GearMesh,
  MotorMesh,
  ConnectingRodMesh,
  PistonMesh,
  ConveyorBeltMesh,
  BearingMesh,
  FlywheelMesh,
} from "@/components/parts/FactoryParts";
import {
  ConnectionLine,
  GhostPreview,
  AxisGizmo,
} from "@/components/scene/Connections";
import {
  Toolbar,
  PropertyPanel,
  StatusMonitor,
  HelpPanel,
} from "@/components/ui/Panels";
import { useFactoryStore } from "@/store/factoryStore";
import { physicsEngine } from "@/physics/physicsEngine";
import { FactoryPart, Connection, Vec3 } from "@/types/factory";

function renderPart(
  part: FactoryPart,
  selected: boolean,
  onSelect: (id: string) => void,
  onPortClick: (partId: string, portId: string) => void,
  connectingMode: boolean
) {
  const commonProps = {
    part,
    selected,
    onSelect,
    onPortClick,
    connectingMode,
  };

  switch (part.type) {
    case "gear":
      return <GearMesh key={part.id} {...commonProps} />;
    case "motor":
      return <MotorMesh key={part.id} {...commonProps} />;
    case "connectingRod":
      return <ConnectingRodMesh key={part.id} {...commonProps} />;
    case "piston":
      return <PistonMesh key={part.id} {...commonProps} />;
    case "conveyorBelt":
      return <ConveyorBeltMesh key={part.id} {...commonProps} />;
    case "bearing":
      return <BearingMesh key={part.id} {...commonProps} />;
    case "flywheel":
      return <FlywheelMesh key={part.id} {...commonProps} />;
    default:
      return null;
  }
}

function PhysicsSimulator() {
  const lastTickRef = useRef(0);

  useFrame((_, delta) => {
    const state = useFactoryStore.getState();
    const { simulation, parts, connections, applySimulationStep } = state;
    if (!simulation.running) {
      lastTickRef.current = 0;
      return;
    }

    lastTickRef.current += delta;
    const stepSize = 1 / 60;
    const maxStepsPerFrame = 10;
    let steps = 0;

    while (lastTickRef.current >= stepSize && steps < maxStepsPerFrame) {
      lastTickRef.current -= stepSize;
      steps++;
      const result = physicsEngine.step(
        parts,
        connections,
        simulation.timeScale
      );
      applySimulationStep(result.partUpdates, {
        totalEnergy: result.totalEnergy,
        systemEfficiency: result.systemEfficiency,
        warnings: result.warnings,
      });
    }
  });

  return null;
}

function PlacementHandler() {
  const { placingPartType, addPart, connectionMode, startConnection, completeConnection, parts, connections, setPlacingPartType } =
    useFactoryStore();
  const [raycastPos, setRaycastPos] = useState<Vec3 | null>(null);
  const [hoverValid, setHoverValid] = useState(true);
  const planeRef = useRef<THREE.Mesh>(null);
  const { camera, raycaster, pointer } = useThree();

  useFrame(() => {
    if (!placingPartType && !connectionMode.active) {
      setRaycastPos(null);
      return;
    }

    if (planeRef.current) {
      const mouseVec = new THREE.Vector2(pointer.x, pointer.y);
      raycaster.setFromCamera(mouseVec, camera);
      const intersects = raycaster.intersectObject(planeRef.current);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        setRaycastPos({ x: point.x, y: 0.1, z: point.z });
        setHoverValid(true);
      }
    }
  });

  const handlePlaneClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (placingPartType && raycastPos) {
      addPart(placingPartType, raycastPos);
    }
  };

  const handlePortClick = (partId: string, portId: string) => {
    if (!connectionMode.active) {
      startConnection(partId, portId);
    } else {
      completeConnection(partId, portId);
    }
  };

  const handlePartSelect = (partId: string) => {
    if (placingPartType) {
      setPlacingPartType(null);
      return;
    }
    useFactoryStore.getState().selectPart(partId);
  };

  const selectedPartId = useFactoryStore.getState().selectedPartId;
  const selectedConnectionId = useFactoryStore.getState().selectedConnectionId;

  return (
    <>
      <mesh
        ref={planeRef}
        position={[0, 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={() => {}}
        onClick={handlePlaneClick}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {parts.map((part) =>
        renderPart(
          part,
          part.id === selectedPartId,
          handlePartSelect,
          handlePortClick,
          connectionMode.active
        )
      )}

      {connections.map((conn) => (
        <ConnectionLine
          key={conn.id}
          connection={conn}
          parts={parts}
          selected={conn.id === selectedConnectionId}
          onClick={(id) => useFactoryStore.getState().selectPart(null)}
        />
      ))}

      {placingPartType && raycastPos && (
        <GhostPreview
          position={[raycastPos.x, raycastPos.y, raycastPos.z]}
          type={placingPartType}
          valid={hoverValid}
        />
      )}
    </>
  );
}

function SceneEnvironment() {
  return (
    <>
      <color attach="background" args={["#0a0f1a"]} />
      <fog attach="fog" args={["#0a0f1a", 15, 40]} />

      <ambientLight intensity={0.35} color="#8899bb" />

      <directionalLight
        position={[8, 15, 6]}
        intensity={1.2}
        color="#fff5e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-bias={-0.0005}
      />

      <directionalLight
        position={[-6, 8, -8]}
        intensity={0.4}
        color="#6688ff"
      />

      <pointLight position={[0, 5, 0]} intensity={0.6} color="#ffaa44" distance={15} />
      <pointLight position={[-6, 3, 6]} intensity={0.4} color="#44aaff" distance={12} />
      <pointLight position={[6, 3, -6]} intensity={0.4} color="#ff8844" distance={12} />

      <Grid
        position={[0, 0, 0]}
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#1e2a3a"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#3d5a80"
        fadeDistance={35}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />

      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.6}
        scale={30}
        blur={2.5}
        far={10}
        resolution={1024}
      />

      <AxisGizmo size={0.8} />

      <mesh position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial
          color="#0d1520"
          metalness={0.3}
          roughness={0.8}
        />
      </mesh>
    </>
  );
}

export default function Workshop() {
  useEffect(() => {
    const { loadPreset } = useFactoryStore.getState();
    setTimeout(() => {
      loadPreset(getDefaultPreset().parts, getDefaultPreset().connections);
    }, 300);
  }, []);

  return (
    <div className="w-full h-screen bg-slate-950 overflow-hidden relative select-none">
      <Canvas
        shadows
        camera={{ position: [7, 6, 9], fov: 50, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        onPointerMissed={() => {
          useFactoryStore.getState().selectPart(null);
        }}
      >
        <SceneEnvironment />
        <PlacementHandler />
        <PhysicsSimulator />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2 - 0.05}
          target={[0, 1, 0]}
          makeDefault
        />
      </Canvas>

      <Toolbar />
      <PropertyPanel />
      <HelpPanel />
      <StatusMonitor />
    </div>
  );
}

function getDefaultPreset(): { parts: FactoryPart[]; connections: Connection[] } {
  let idCounter = 1000;
  const nextId = () => `preset-${idCounter++}`;

  const motorId = nextId();
  const gear1Id = nextId();
  const gear2Id = nextId();
  const gear3Id = nextId();
  const rodId = nextId();
  const pistonId = nextId();
  const flywheelId = nextId();
  const bearingId = nextId();

  const parts: FactoryPart[] = [
    {
      id: motorId,
      type: "motor",
      position: { x: -3, y: 0.5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      config: { maxTorque: 80, maxRPM: 1500, power: 1500, running: true },
      physics: {
        angularVelocity: 0,
        linearVelocity: { x: 0, y: 0, z: 0 },
        torque: 0,
        load: 0,
        friction: 0.05,
        mass: 15,
        inertia: 0.8,
        stalled: false,
        temperature: 25,
        efficiency: 0.95,
      },
      ports: [
        {
          id: `${motorId}-out`,
          partId: motorId,
          localPosition: { x: 0.4, y: 0, z: 0 },
          type: "output",
          connectedTo: gear1Id,
        },
      ],
    },
    {
      id: gear1Id,
      type: "gear",
      position: { x: -1.5, y: 0.5, z: 0 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      config: { teeth: 16, radius: 0.32, thickness: 0.08 },
      physics: {
        angularVelocity: 0,
        linearVelocity: { x: 0, y: 0, z: 0 },
        torque: 0,
        load: 0,
        friction: 0.02,
        mass: 1.5,
        inertia: 0.1,
        stalled: false,
        temperature: 25,
        efficiency: 0.97,
      },
      ports: [
        {
          id: `${gear1Id}-center`,
          partId: gear1Id,
          localPosition: { x: 0, y: 0, z: 0 },
          type: "passive",
          connectedTo: motorId,
        },
        {
          id: `${gear1Id}-mesh`,
          partId: gear1Id,
          localPosition: { x: 0.32, y: 0, z: 0 },
          type: "passive",
          connectedTo: gear2Id,
        },
      ],
    },
    {
      id: gear2Id,
      type: "gear",
      position: { x: -1.5, y: 0.5, z: 0.75 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      config: { teeth: 40, radius: 0.8, thickness: 0.1 },
      physics: {
        angularVelocity: 0,
        linearVelocity: { x: 0, y: 0, z: 0 },
        torque: 0,
        load: 0,
        friction: 0.02,
        mass: 5,
        inertia: 0.8,
        stalled: false,
        temperature: 25,
        efficiency: 0.96,
      },
      ports: [
        {
          id: `${gear2Id}-center`,
          partId: gear2Id,
          localPosition: { x: 0, y: 0, z: 0 },
          type: "passive",
          connectedTo: flywheelId,
        },
        {
          id: `${gear2Id}-mesh`,
          partId: gear2Id,
          localPosition: { x: -0.8, y: 0, z: 0 },
          type: "passive",
          connectedTo: gear1Id,
        },
      ],
    },
    {
      id: flywheelId,
      type: "flywheel",
      position: { x: -1.5, y: 0.5, z: 1.4 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      config: { radius: 0.5, mass: 25 },
      physics: {
        angularVelocity: 0,
        linearVelocity: { x: 0, y: 0, z: 0 },
        torque: 0,
        load: 0,
        friction: 0.01,
        mass: 25,
        inertia: 3.125,
        stalled: false,
        temperature: 25,
        efficiency: 0.99,
      },
      ports: [
        {
          id: `${flywheelId}-center`,
          partId: flywheelId,
          localPosition: { x: 0, y: 0, z: 0 },
          type: "passive",
          connectedTo: gear2Id,
        },
      ],
    },
    {
      id: gear3Id,
      type: "gear",
      position: { x: 0.8, y: 0.5, z: 0.75 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      config: { teeth: 24, radius: 0.48, thickness: 0.08 },
      physics: {
        angularVelocity: 0,
        linearVelocity: { x: 0, y: 0, z: 0 },
        torque: 0,
        load: 0,
        friction: 0.02,
        mass: 2.5,
        inertia: 0.3,
        stalled: false,
        temperature: 25,
        efficiency: 0.97,
      },
      ports: [
        {
          id: `${gear3Id}-center`,
          partId: gear3Id,
          localPosition: { x: 0, y: 0, z: 0 },
          type: "passive",
          connectedTo: bearingId,
        },
        {
          id: `${gear3Id}-mesh`,
          partId: gear3Id,
          localPosition: { x: -0.48, y: 0, z: -0.48 },
          type: "passive",
          connectedTo: gear2Id,
        },
      ],
    },
    {
      id: bearingId,
      type: "bearing",
      position: { x: 0.8, y: 0.5, z: 0.75 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      config: { radius: 0.08 },
      physics: {
        angularVelocity: 0,
        linearVelocity: { x: 0, y: 0, z: 0 },
        torque: 0,
        load: 0,
        friction: 0.005,
        mass: 0.8,
        inertia: 0.02,
        stalled: false,
        temperature: 25,
        efficiency: 0.995,
      },
      ports: [
        {
          id: `${bearingId}-shaft`,
          partId: bearingId,
          localPosition: { x: 0, y: 0, z: 0 },
          type: "passive",
          connectedTo: gear3Id,
        },
      ],
    },
    {
      id: rodId,
      type: "connectingRod",
      position: { x: 1.4, y: 0.5, z: 0.75 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      config: { length: 1.2 },
      physics: {
        angularVelocity: 0,
        linearVelocity: { x: 0, y: 0, z: 0 },
        torque: 0,
        load: 0,
        friction: 0.015,
        mass: 3,
        inertia: 0.36,
        stalled: false,
        temperature: 25,
        efficiency: 0.98,
      },
      ports: [
        {
          id: `${rodId}-crank`,
          partId: rodId,
          localPosition: { x: -0.6, y: 0, z: 0 },
          type: "passive",
          connectedTo: gear3Id,
        },
        {
          id: `${rodId}-piston`,
          partId: rodId,
          localPosition: { x: 0.6, y: 0, z: 0 },
          type: "passive",
          connectedTo: pistonId,
        },
      ],
    },
    {
      id: pistonId,
      type: "piston",
      position: { x: 2.5, y: 0.8, z: 0.75 },
      rotation: { x: 0, y: 0, z: -Math.PI / 2 },
      scale: { x: 1, y: 1, z: 1 },
      config: { stroke: 0.6, cylinderRadius: 0.18 },
      physics: {
        angularVelocity: 0,
        linearVelocity: { x: 0, y: 0, z: 0 },
        torque: 0,
        load: 3,
        friction: 0.03,
        mass: 4,
        inertia: 0.1,
        stalled: false,
        temperature: 25,
        efficiency: 0.94,
      },
      ports: [
        {
          id: `${pistonId}-rod`,
          partId: pistonId,
          localPosition: { x: 0, y: 0, z: 0 },
          type: "input",
          connectedTo: rodId,
        },
      ],
      state: { position: 0 },
    } as FactoryPart & { state: { position: number } },
  ];

  const connections: Connection[] = [
    {
      id: `conn-${nextId()}`,
      type: "hinge",
      fromPartId: motorId,
      fromPortId: `${motorId}-out`,
      toPartId: gear1Id,
      toPortId: `${gear1Id}-center`,
      ratio: 1,
      backlash: 0.01,
      wear: 0,
    },
    {
      id: `conn-${nextId()}`,
      type: "mesh",
      fromPartId: gear1Id,
      fromPortId: `${gear1Id}-mesh`,
      toPartId: gear2Id,
      toPortId: `${gear2Id}-mesh`,
      ratio: -16 / 40,
      backlash: 0.02,
      wear: 0,
    },
    {
      id: `conn-${nextId()}`,
      type: "hinge",
      fromPartId: gear2Id,
      fromPortId: `${gear2Id}-center`,
      toPartId: flywheelId,
      toPortId: `${flywheelId}-center`,
      ratio: 1,
      backlash: 0.005,
      wear: 0,
    },
    {
      id: `conn-${nextId()}`,
      type: "mesh",
      fromPartId: gear2Id,
      fromPortId: `${gear2Id}-mesh`,
      toPartId: gear3Id,
      toPortId: `${gear3Id}-mesh`,
      ratio: -40 / 24,
      backlash: 0.02,
      wear: 0,
    },
    {
      id: `conn-${nextId()}`,
      type: "hinge",
      fromPartId: gear3Id,
      fromPortId: `${gear3Id}-center`,
      toPartId: bearingId,
      toPortId: `${bearingId}-shaft`,
      ratio: 1,
      backlash: 0.005,
      wear: 0,
    },
    {
      id: `conn-${nextId()}`,
      type: "rod",
      fromPartId: gear3Id,
      fromPortId: `${gear3Id}-center`,
      toPartId: rodId,
      toPortId: `${rodId}-crank`,
      ratio: 1,
      backlash: 0.03,
      wear: 0,
    },
    {
      id: `conn-${nextId()}`,
      type: "rod",
      fromPartId: rodId,
      fromPortId: `${rodId}-piston`,
      toPartId: pistonId,
      toPortId: `${pistonId}-rod`,
      ratio: 1,
      backlash: 0.02,
      wear: 0,
    },
  ];

  return { parts, connections };
}
