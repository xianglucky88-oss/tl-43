import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Connection, FactoryPart } from "@/types/factory";

interface ConnectionLineProps {
  connection: Connection;
  parts: FactoryPart[];
  selected: boolean;
  onClick: (id: string) => void;
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  connection,
  parts,
  selected,
  onClick,
}) => {
  const fromPart = parts.find((p) => p.id === connection.fromPartId);
  const toPart = parts.find((p) => p.id === connection.toPartId);

  if (!fromPart || !toPart) return null;

  const fromPort = fromPart.ports.find((p) => p.id === connection.fromPortId);
  const toPort = toPart.ports.find((p) => p.id === connection.toPortId);
  if (!fromPort || !toPort) return null;

  const start: [number, number, number] = [
    fromPart.position.x + fromPort.localPosition.x,
    fromPart.position.y + fromPort.localPosition.y,
    fromPart.position.z + fromPort.localPosition.z,
  ];
  const end: [number, number, number] = [
    toPart.position.x + toPort.localPosition.x,
    toPart.position.y + toPort.localPosition.y,
    toPart.position.z + toPort.localPosition.z,
  ];

  const color =
    connection.type === "mesh"
      ? selected
        ? "#ffaa00"
        : "#44aaff"
      : connection.type === "belt"
        ? selected
          ? "#ffaa00"
          : "#88ff88"
        : selected
          ? "#ffaa00"
          : "#ff8844";

  return (
    <group
      onClick={(e) => {
        (e as unknown as { stopPropagation: () => void }).stopPropagation();
        onClick(connection.id);
      }}
    >
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([...start, ...end])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.9}
        />
      </line>

      <mesh position={start}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>

      <mesh position={end}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
};

interface GhostPreviewProps {
  position: [number, number, number];
  type: string;
  valid: boolean;
}

export const GhostPreview: React.FC<GhostPreviewProps> = ({
  position,
  type,
  valid,
}) => {
  const ghostRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ghostRef.current) {
      ghostRef.current.rotation.y += 0.01;
    }
  });

  const color = valid ? 0x00ff88 : 0xff4444;

  return (
    <group ref={ghostRef} position={position}>
      {type === "gear" && (
        <mesh>
          <torusGeometry args={[0.4, 0.06, 12, 32]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.6}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      )}
      {type === "motor" && (
        <mesh>
          <boxGeometry args={[0.5, 0.5, 0.8]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.6}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      )}
      {type === "connectingRod" && (
        <mesh>
          <boxGeometry args={[1.2, 0.08, 0.08]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.6}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      )}
      {type === "piston" && (
        <mesh>
          <cylinderGeometry args={[0.2, 0.2, 0.8, 24]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.6}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      )}
      {type === "conveyorBelt" && (
        <mesh>
          <boxGeometry args={[3, 0.15, 0.6]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.6}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      )}
      {type === "bearing" && (
        <mesh>
          <torusGeometry args={[0.14, 0.05, 12, 32]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.6}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      )}
      {type === "flywheel" && (
        <mesh>
          <cylinderGeometry args={[0.6, 0.6, 0.2, 48]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.6}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      )}
    </group>
  );
};

interface AxisGizmoProps {
  size?: number;
}

export const AxisGizmo: React.FC<AxisGizmoProps> = ({ size = 1 }) => {
  return (
    <group position={[-4.5, 0.1, -4.5]}>
      <mesh position={[size / 2, 0, 0]}>
        <boxGeometry args={[size, 0.02, 0.02]} />
        <meshBasicMaterial color={0xff0000} />
      </mesh>
      <mesh position={[size / 2 + 0.1, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.08, 0.15, 8]} />
        <meshBasicMaterial color={0xff0000} />
      </mesh>

      <mesh position={[0, size / 2, 0]}>
        <boxGeometry args={[0.02, size, 0.02]} />
        <meshBasicMaterial color={0x00ff00} />
      </mesh>
      <mesh position={[0, size / 2 + 0.1, 0]}>
        <coneGeometry args={[0.08, 0.15, 8]} />
        <meshBasicMaterial color={0x00ff00} />
      </mesh>

      <mesh position={[0, 0, size / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.02, size, 0.02]} />
        <meshBasicMaterial color={0x0088ff} />
      </mesh>
      <mesh position={[0, 0, size / 2 + 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.08, 0.15, 8]} />
        <meshBasicMaterial color={0x0088ff} />
      </mesh>
    </group>
  );
};
