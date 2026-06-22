import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  GearPart,
  MotorPart,
  PistonPart,
  ConnectingRodPart,
  ConveyorBeltPart,
  BearingPart,
  FlywheelPart,
  FactoryPart,
} from "@/types/factory";
import { useFactoryStore } from "@/store/factoryStore";

interface PartProps {
  part: FactoryPart;
  selected: boolean;
  onSelect: (id: string) => void;
  onPortClick?: (partId: string, portId: string) => void;
  connectingMode: boolean;
}

const SELECTED_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xffaa00,
  emissive: 0x331100,
  metalness: 0.8,
  roughness: 0.2,
});

function createGearGeometry(radius: number, teeth: number, thickness: number) {
  const toothHeight = radius * 0.12;
  const shape = new THREE.Shape();
  const innerRadius = radius - toothHeight;
  const toothTip = radius + toothHeight * 0.5;

  for (let i = 0; i < teeth; i++) {
    const frac = i / teeth;
    const widthFrac = 0.4 / teeth;
    const angle1 = frac * Math.PI * 2;
    const angle2 = (frac + widthFrac * 0.5) * Math.PI * 2;
    const angle3 = (frac + widthFrac * 1.5) * Math.PI * 2;
    const angle4 = (frac + widthFrac * 2.5) * Math.PI * 2;

    const x1 = Math.cos(angle1) * innerRadius;
    const y1 = Math.sin(angle1) * innerRadius;
    const x2 = Math.cos(angle2) * toothTip;
    const y2 = Math.sin(angle2) * toothTip;
    const x3 = Math.cos(angle3) * toothTip;
    const y3 = Math.sin(angle3) * toothTip;
    const x4 = Math.cos(angle4) * innerRadius;
    const y4 = Math.sin(angle4) * innerRadius;

    if (i === 0) shape.moveTo(x1, y1);
    shape.lineTo(x2, y2);
    shape.lineTo(x3, y3);
    shape.lineTo(x4, y4);
  }
  shape.closePath();

  const holePath = new THREE.Path();
  holePath.absarc(0, 0, radius * 0.2, 0, Math.PI * 2, true);
  shape.holes.push(holePath);

  return new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.1,
    bevelSize: thickness * 0.05,
    bevelSegments: 2,
  });
}

export const GearMesh: React.FC<PartProps> = ({
  part,
  selected,
  onSelect,
  onPortClick,
  connectingMode,
}) => {
  const gear = part as GearPart;
  const groupRef = useRef<THREE.Group>(null);
  const rotationRef = useRef(0);
  const { radius, teeth, thickness } = gear.config;
  const geometry = useMemo(
    () => createGearGeometry(radius, teeth, thickness),
    [radius, teeth, thickness]
  );

  useFrame((_, delta) => {
    const simRunning = useFactoryStore.getState().simulation.running;
    if (groupRef.current && simRunning) {
      rotationRef.current += gear.physics.angularVelocity * delta;
      groupRef.current.rotation.x = rotationRef.current;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[part.position.x, part.position.y, part.position.z]}
      rotation={[part.rotation.x, part.rotation.y, part.rotation.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(part.id);
      }}
    >
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={selected ? 0xffaa00 : 0x8888aa}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      <mesh position={[0, 0, thickness / 2 + 0.01]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.22, radius * 0.22, 0.02, 16]} />
        <meshStandardMaterial
          color={selected ? 0xffaa00 : 0x555555}
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      {connectingMode &&
        gear.ports.map((port) => (
          <mesh
            key={port.id}
            position={[port.localPosition.x, port.localPosition.y, port.localPosition.z]}
            onClick={(e) => {
              e.stopPropagation();
              onPortClick?.(part.id, port.id);
            }}
          >
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial
              color={port.connectedTo ? 0x00ff88 : 0x00aaff}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
    </group>
  );
};

export const MotorMesh: React.FC<PartProps> = ({
  part,
  selected,
  onSelect,
  onPortClick,
  connectingMode,
}) => {
  const motor = part as MotorPart;
  const groupRef = useRef<THREE.Group>(null);
  const shaftRef = useRef<THREE.Group>(null);
  const shaftRotation = useRef(0);

  useFrame((_, delta) => {
    const simRunning = useFactoryStore.getState().simulation.running;
    if (shaftRef.current && simRunning) {
      shaftRotation.current += motor.physics.angularVelocity * delta;
      shaftRef.current.rotation.z = shaftRotation.current;
    }
  });

  const bodyColor = motor.config.running
    ? selected
      ? 0xffaa00
      : 0x3388cc
    : 0x555566;

  return (
    <group
      ref={groupRef}
      position={[part.position.x, part.position.y, part.position.z]}
      rotation={[part.rotation.x, part.rotation.y, part.rotation.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(part.id);
      }}
    >
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.4, 0.8, 24]} />
        <meshStandardMaterial
          color={bodyColor}
          metalness={0.7}
          roughness={0.3}
          emissive={motor.config.running ? 0x112233 : 0x000000}
        />
      </mesh>

      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * 0.3,
              Math.sin(angle) * 0.3,
              0,
            ]}
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[0.04, 0.04, 0.82]} />
            <meshStandardMaterial
              color={0x222222}
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
        );
      })}

      <mesh position={[0, 0, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
        <meshStandardMaterial color={0x222222} metalness={0.8} roughness={0.3} />
      </mesh>

      <group ref={shaftRef} position={[0.4, 0, 0]}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.3, 16]} />
          <meshStandardMaterial color={0xdddddd} metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0.15, 0, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.18]} />
          <meshStandardMaterial color={0xaaaaaa} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {motor.physics.stalled && (
        <mesh position={[0.5, 0.5, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color={0xff0000} />
        </mesh>
      )}

      {connectingMode &&
        motor.ports.map((port) => (
          <mesh
            key={port.id}
            position={[
              port.localPosition.x,
              port.localPosition.y,
              port.localPosition.z,
            ]}
            onClick={(e) => {
              e.stopPropagation();
              onPortClick?.(part.id, port.id);
            }}
          >
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshBasicMaterial
              color={port.connectedTo ? 0x00ff88 : 0x00aaff}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
    </group>
  );
};

export const ConnectingRodMesh: React.FC<PartProps> = ({
  part,
  selected,
  onSelect,
  onPortClick,
  connectingMode,
}) => {
  const rod = part as ConnectingRodPart;
  const groupRef = useRef<THREE.Group>(null);
  const { length } = rod.config;

  return (
    <group
      ref={groupRef}
      position={[part.position.x, part.position.y, part.position.z]}
      rotation={[part.rotation.x, part.rotation.y, part.rotation.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(part.id);
      }}
    >
      <mesh>
        <boxGeometry args={[length, 0.08, 0.08]} />
        <meshStandardMaterial
          color={selected ? 0xffaa00 : 0xaaaaaa}
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>

      <mesh position={[-length / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.08, 0.03, 16, 24]} />
        <meshStandardMaterial
          color={selected ? 0xffcc44 : 0x888888}
          metalness={0.9}
          roughness={0.15}
        />
      </mesh>

      <mesh position={[length / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.06, 0.025, 16, 24]} />
        <meshStandardMaterial
          color={selected ? 0xffcc44 : 0x888888}
          metalness={0.9}
          roughness={0.15}
        />
      </mesh>

      {connectingMode &&
        rod.ports.map((port) => (
          <mesh
            key={port.id}
            position={[
              port.localPosition.x,
              port.localPosition.y,
              port.localPosition.z,
            ]}
            onClick={(e) => {
              e.stopPropagation();
              onPortClick?.(part.id, port.id);
            }}
          >
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshBasicMaterial
              color={port.connectedTo ? 0x00ff88 : 0x00aaff}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
    </group>
  );
};

export const PistonMesh: React.FC<PartProps> = ({
  part,
  selected,
  onSelect,
  onPortClick,
  connectingMode,
}) => {
  const piston = part as PistonPart;
  const groupRef = useRef<THREE.Group>(null);
  const pistonHeadRef = useRef<THREE.Group>(null);
  const { stroke, cylinderRadius } = piston.config;
  const pistonState = (piston as unknown as { state?: { position?: number } }).state || {
    position: 0,
  };
  const currentPos = pistonState.position || 0;

  useFrame(() => {
    if (pistonHeadRef.current) {
      pistonHeadRef.current.position.y = currentPos - stroke / 2;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[part.position.x, part.position.y, part.position.z]}
      rotation={[part.rotation.x, part.rotation.y, part.rotation.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(part.id);
      }}
    >
      <mesh rotation={[0, 0, 0]}>
        <cylinderGeometry
          args={[cylinderRadius + 0.05, cylinderRadius + 0.05, stroke + 0.1, 24, 1, true]}
        />
        <meshStandardMaterial
          color={selected ? 0xffaa00 : 0x666666}
          metalness={0.7}
          roughness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, -stroke / 2 - 0.05, 0]}>
        <cylinderGeometry
          args={[cylinderRadius + 0.05, cylinderRadius + 0.05, 0.08, 24]}
        />
        <meshStandardMaterial
          color={selected ? 0xffaa00 : 0x444444}
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      <group ref={pistonHeadRef}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry
            args={[cylinderRadius - 0.01, cylinderRadius - 0.01, 0.2, 24]}
          />
          <meshStandardMaterial
            color={selected ? 0xffcc44 : 0xcc8844}
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, -0.08, 0]}>
          <torusGeometry args={[cylinderRadius - 0.02, 0.015, 8, 24]} />
          <meshStandardMaterial color={0x333333} />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <torusGeometry args={[cylinderRadius - 0.02, 0.015, 8, 24]} />
          <meshStandardMaterial color={0x333333} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.15, 16]} />
          <meshStandardMaterial
            color={selected ? 0xffcc44 : 0xaaaaaa}
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>
      </group>

      {connectingMode &&
        piston.ports.map((port) => (
          <mesh
            key={port.id}
            position={[
              port.localPosition.x,
              port.localPosition.y + 0.2,
              port.localPosition.z,
            ]}
            onClick={(e) => {
              e.stopPropagation();
              onPortClick?.(part.id, port.id);
            }}
          >
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshBasicMaterial
              color={port.connectedTo ? 0x00ff88 : 0x00aaff}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
    </group>
  );
};

export const ConveyorBeltMesh: React.FC<PartProps> = ({
  part,
  selected,
  onSelect,
  onPortClick,
  connectingMode,
}) => {
  const belt = part as ConveyorBeltPart;
  const groupRef = useRef<THREE.Group>(null);
  const beltOffsetRef = useRef(0);
  const { length, width } = belt.config;

  useFrame((_, delta) => {
    const simRunning = useFactoryStore.getState().simulation.running;
    if (simRunning) {
      beltOffsetRef.current += (belt.physics.linearVelocity?.x || 0) * delta * 2;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[part.position.x, part.position.y, part.position.z]}
      rotation={[part.rotation.x, part.rotation.y, part.rotation.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(part.id);
      }}
    >
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[length + 0.2, 0.15, width + 0.1]} />
        <meshStandardMaterial
          color={selected ? 0xffaa00 : 0x445566}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      <mesh position={[-length / 2, 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, width, 24]} />
        <meshStandardMaterial color={0x888888} metalness={0.8} roughness={0.3} />
      </mesh>

      <mesh position={[length / 2, 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, width, 24]} />
        <meshStandardMaterial color={0x888888} metalness={0.8} roughness={0.3} />
      </mesh>

      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[length, 0.02, width]} />
        <meshStandardMaterial color={0x222222} metalness={0.1} roughness={0.95} />
      </mesh>

      {Array.from({ length: 10 }).map((_, i) => {
        const offset = ((i / 10 + beltOffsetRef.current) % 1 + 1) % 1;
        const xPos = offset * length - length / 2;
        return (
          <mesh key={i} position={[xPos, 0.135, 0]}>
            <boxGeometry args={[0.02, 0.02, width - 0.05]} />
            <meshStandardMaterial color={0xffff88} />
          </mesh>
        );
      })}

      {connectingMode &&
        belt.ports.map((port) => (
          <mesh
            key={port.id}
            position={[
              port.localPosition.x,
              port.localPosition.y + 0.12,
              port.localPosition.z,
            ]}
            onClick={(e) => {
              e.stopPropagation();
              onPortClick?.(part.id, port.id);
            }}
          >
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshBasicMaterial
              color={port.connectedTo ? 0x00ff88 : 0x00aaff}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
    </group>
  );
};

export const BearingMesh: React.FC<PartProps> = ({
  part,
  selected,
  onSelect,
  onPortClick,
  connectingMode,
}) => {
  const bearing = part as BearingPart;
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const rotationRef = useRef(0);
  const { radius } = bearing.config;

  useFrame((_, delta) => {
    const simRunning = useFactoryStore.getState().simulation.running;
    if (innerRef.current && simRunning) {
      rotationRef.current += bearing.physics.angularVelocity * delta;
      innerRef.current.rotation.z = rotationRef.current;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[part.position.x, part.position.y, part.position.z]}
      rotation={[part.rotation.x, part.rotation.y, part.rotation.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(part.id);
      }}
    >
      <mesh>
        <torusGeometry args={[radius + 0.06, 0.04, 12, 32]} />
        <meshStandardMaterial
          color={selected ? 0xffaa00 : 0x555566}
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>

      <group ref={innerRef}>
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(angle) * (radius + 0.02),
                Math.sin(angle) * (radius + 0.02),
                0,
              ]}
            >
              <sphereGeometry args={[0.025, 16, 16]} />
              <meshStandardMaterial
                color={0xdddddd}
                metalness={0.95}
                roughness={0.1}
              />
            </mesh>
          );
        })}
        <mesh>
          <torusGeometry args={[radius - 0.02, 0.03, 12, 32]} />
          <meshStandardMaterial
            color={selected ? 0xffcc44 : 0x888888}
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
      </group>

      {connectingMode &&
        bearing.ports.map((port) => (
          <mesh
            key={port.id}
            position={[
              port.localPosition.x,
              port.localPosition.y,
              port.localPosition.z,
            ]}
            onClick={(e) => {
              e.stopPropagation();
              onPortClick?.(part.id, port.id);
            }}
          >
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial
              color={port.connectedTo ? 0x00ff88 : 0x00aaff}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
    </group>
  );
};

export const FlywheelMesh: React.FC<PartProps> = ({
  part,
  selected,
  onSelect,
  onPortClick,
  connectingMode,
}) => {
  const flywheel = part as FlywheelPart;
  const groupRef = useRef<THREE.Group>(null);
  const rotationRef = useRef(0);
  const { radius, mass } = flywheel.config;
  const thickness = Math.max(0.05 + mass / 200, 0.08);

  useFrame((_, delta) => {
    const simRunning = useFactoryStore.getState().simulation.running;
    if (groupRef.current && simRunning) {
      rotationRef.current += flywheel.physics.angularVelocity * delta;
      groupRef.current.rotation.z = rotationRef.current;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[part.position.x, part.position.y, part.position.z]}
      rotation={[part.rotation.x, part.rotation.y, part.rotation.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(part.id);
      }}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, thickness, 48]} />
        <meshStandardMaterial
          color={selected ? 0xffaa00 : 0x444444}
          metalness={0.85}
          roughness={0.3}
        />
      </mesh>

      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const innerR = radius * 0.3;
        const outerR = radius * 0.8;
        const midR = (innerR + outerR) / 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * midR, Math.sin(angle) * midR, 0]}
            rotation={[0, 0, angle + Math.PI / 2]}
          >
            <boxGeometry args={[outerR - innerR, 0.05, thickness * 0.8]} />
            <meshStandardMaterial
              color={selected ? 0xffcc44 : 0x666666}
              metalness={0.8}
              roughness={0.35}
            />
          </mesh>
        );
      })}

      <mesh position={[0, 0, thickness / 2 + 0.01]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.15, radius * 0.15, 0.02, 24]} />
        <meshStandardMaterial color={0xaaaaaa} metalness={0.9} roughness={0.2} />
      </mesh>

      {connectingMode &&
        flywheel.ports.map((port) => (
          <mesh
            key={port.id}
            position={[
              port.localPosition.x,
              port.localPosition.y,
              port.localPosition.z,
            ]}
            onClick={(e) => {
              e.stopPropagation();
              onPortClick?.(part.id, port.id);
            }}
          >
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial
              color={port.connectedTo ? 0x00ff88 : 0x00aaff}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
    </group>
  );
};
