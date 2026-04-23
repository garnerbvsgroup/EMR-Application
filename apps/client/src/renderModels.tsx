import { Suspense, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Cloud, useGLTF } from "@react-three/drei";
import { MathUtils, type Group, type Object3D } from "three";

export type PlayerMotionState = {
  locomotion: "idle" | "walk" | "run" | "crouch";
  pace: number;
  strafe: number;
  crouching: boolean;
  acting: boolean;
};

const IDLE_MOTION: PlayerMotionState = {
  locomotion: "idle",
  pace: 0,
  strafe: 0,
  crouching: false,
  acting: false,
};

function useModelAvailability(path: string) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;

    fetch(path, { method: "HEAD" })
      .then((response) => {
        if (active) {
          const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
          setAvailable(response.ok && !contentType.includes("text/html"));
        }
      })
      .catch(() => {
        if (active) {
          setAvailable(false);
        }
      });

    return () => {
      active = false;
    };
  }, [path]);

  return available;
}

function ImportedSceneModel({
  path,
  scale,
  rotation,
  position,
}: {
  path: string;
  scale: number;
  rotation?: [number, number, number];
  position?: [number, number, number];
}) {
  const { scene } = useGLTF(path);
  const clonedScene = useRef<Object3D | null>(null);

  if (!clonedScene.current) {
    clonedScene.current = scene.clone(true);
    clonedScene.current.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }

  return <primitive object={clonedScene.current} scale={scale} rotation={rotation} position={position} />;
}

export function VehicleModel({ color, accent }: { color: string; accent: string }) {
  const importedVehicleAvailable = useModelAvailability("/models/vehicle.glb");

  if (importedVehicleAvailable) {
    return (
      <Suspense fallback={null}>
        <ImportedSceneModel path="/models/vehicle.glb" scale={1.15} rotation={[0, Math.PI, 0]} position={[0, 0, 0]} />
      </Suspense>
    );
  }

  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.95, 0.32, 1.54]} />
        <meshStandardMaterial color="#1f2329" metalness={0.58} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.58, 1.46]} />
        <meshStandardMaterial color={color} metalness={0.34} roughness={0.42} />
      </mesh>
      <mesh position={[0.12, 1.16, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.72, 0.42, 1.24]} />
        <meshStandardMaterial color="#d7e3f3" metalness={0.18} roughness={0.14} transparent opacity={0.92} />
      </mesh>
      <mesh position={[1.18, 0.78, 0]} castShadow>
        <boxGeometry args={[0.48, 0.34, 1.28]} />
        <meshStandardMaterial color={color} metalness={0.28} roughness={0.38} />
      </mesh>
      <mesh position={[-1.24, 0.75, 0]} castShadow>
        <boxGeometry args={[0.34, 0.24, 1.16]} />
        <meshStandardMaterial color="#cfd5dc" metalness={0.32} roughness={0.36} />
      </mesh>
      <mesh position={[1.46, 0.68, 0.45]}>
        <boxGeometry args={[0.12, 0.12, 0.34]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.65} />
      </mesh>
      <mesh position={[1.46, 0.68, -0.45]}>
        <boxGeometry args={[0.12, 0.12, 0.34]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.65} />
      </mesh>
      <mesh position={[-1.48, 0.64, 0.46]}>
        <boxGeometry args={[0.1, 0.1, 0.28]} />
        <meshStandardMaterial color="#ff6961" emissive="#d43f2a" emissiveIntensity={0.82} />
      </mesh>
      <mesh position={[-1.48, 0.64, -0.46]}>
        <boxGeometry args={[0.1, 0.1, 0.28]} />
        <meshStandardMaterial color="#ff6961" emissive="#d43f2a" emissiveIntensity={0.82} />
      </mesh>
      {[
        [-0.95, 0.22, 0.72],
        [0.95, 0.22, 0.72],
        [-0.95, 0.22, -0.72],
        [0.95, 0.22, -0.72],
      ].map((position, index) => (
        <group key={`wheel-${index}`} position={position as [number, number, number]} castShadow>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.26, 20]} />
            <meshStandardMaterial color="#181a1d" roughness={0.95} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.17, 0.17, 0.28, 16]} />
            <meshStandardMaterial color="#9aa5af" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.2, 1.48, 0]}>
        <boxGeometry args={[0.82, 0.08, 1.16]} />
        <meshStandardMaterial color="#111820" metalness={0.48} roughness={0.18} />
      </mesh>
    </group>
  );
}

export function PlayerModel({
  uniformColor,
  wanted = 0,
  motionRef,
}: {
  uniformColor: string;
  wanted?: number;
  motionRef?: MutableRefObject<PlayerMotionState>;
}) {
  const importedPlayerAvailable = useModelAvailability("/models/player.glb");
  const rootRef = useRef<Group>(null);
  const chestRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const animationClock = useRef(0);

  useFrame((_, delta) => {
    const motion = motionRef?.current ?? IDLE_MOTION;
    const cadence = motion.locomotion === "run" ? 9 : motion.locomotion === "walk" ? 6 : motion.locomotion === "crouch" ? 4.5 : 1.8;
    animationClock.current += delta * cadence;

    const swing = Math.sin(animationClock.current) * motion.pace;
    const counterSwing = Math.cos(animationClock.current) * motion.pace;
    const crouchAmount = motion.crouching ? 0.34 : 0;
    const armSwing = motion.locomotion === "idle" ? 0.04 : motion.locomotion === "run" ? 0.92 : motion.locomotion === "crouch" ? 0.34 : 0.58;
    const legSwing = motion.locomotion === "idle" ? 0.02 : motion.locomotion === "run" ? 0.88 : motion.locomotion === "crouch" ? 0.24 : 0.48;

    if (rootRef.current) {
      rootRef.current.position.y = MathUtils.lerp(rootRef.current.position.y, crouchAmount, 0.12);
    }

    if (chestRef.current) {
      chestRef.current.rotation.z = MathUtils.lerp(chestRef.current.rotation.z, -motion.strafe * 0.08, 0.12);
      chestRef.current.rotation.x = MathUtils.lerp(chestRef.current.rotation.x, motion.acting ? -0.18 : swing * 0.03, 0.12);
      chestRef.current.position.y = MathUtils.lerp(chestRef.current.position.y, 1.1 - crouchAmount * 0.24 + Math.abs(counterSwing) * 0.04, 0.12);
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = MathUtils.lerp(leftArmRef.current.rotation.x, swing * armSwing + (motion.acting ? -0.68 : 0.08), 0.18);
      leftArmRef.current.rotation.z = MathUtils.lerp(leftArmRef.current.rotation.z, motion.acting ? 0.18 : 0.12, 0.16);
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = MathUtils.lerp(rightArmRef.current.rotation.x, -swing * armSwing + (motion.acting ? -0.82 : 0.02), 0.18);
      rightArmRef.current.rotation.z = MathUtils.lerp(rightArmRef.current.rotation.z, motion.acting ? -0.2 : -0.12, 0.16);
    }

    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = MathUtils.lerp(leftLegRef.current.rotation.x, -swing * legSwing, 0.18);
    }

    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = MathUtils.lerp(rightLegRef.current.rotation.x, swing * legSwing, 0.18);
    }
  });

  if (importedPlayerAvailable) {
    return (
      <group ref={rootRef}>
        <Suspense fallback={null}>
          <ImportedSceneModel path="/models/player.glb" scale={1.7} position={[0, 0, 0]} />
        </Suspense>
        {wanted > 0 ? (
          <mesh position={[0, 2.45, 0]}>
            <sphereGeometry args={[0.14, 14, 14]} />
            <meshStandardMaterial color="#ff8d66" emissive="#c1421f" emissiveIntensity={0.9} />
          </mesh>
        ) : null}
      </group>
    );
  }

  return (
    <group ref={rootRef}>
      <mesh position={[0, 1.74, 0]} castShadow>
        <sphereGeometry args={[0.24, 20, 20]} />
        <meshStandardMaterial color="#efcfb0" roughness={0.92} />
      </mesh>
      <mesh position={[0, 2.02, 0]} castShadow>
        <capsuleGeometry args={[0.14, 0.16, 8, 12]} />
        <meshStandardMaterial color="#3e2f28" roughness={0.88} />
      </mesh>
      <group ref={chestRef} position={[0, 1.1, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.3, 0.92, 8, 14]} />
          <meshStandardMaterial color={uniformColor} metalness={0.06} roughness={0.62} />
        </mesh>
        <mesh position={[0, 0.02, 0.19]} castShadow>
          <boxGeometry args={[0.46, 0.46, 0.14]} />
          <meshStandardMaterial color="#efe3c9" roughness={0.58} />
        </mesh>
        <mesh position={[0, 0.1, -0.16]} castShadow>
          <boxGeometry args={[0.34, 0.36, 0.12]} />
          <meshStandardMaterial color="#1e2328" metalness={0.24} roughness={0.46} />
        </mesh>
      </group>
      <group ref={leftArmRef} position={[-0.38, 1.36, 0]}>
        <mesh position={[0, -0.34, 0]} castShadow>
          <capsuleGeometry args={[0.095, 0.72, 6, 10]} />
          <meshStandardMaterial color={uniformColor} roughness={0.66} />
        </mesh>
        <mesh position={[0, -0.74, 0.02]} castShadow>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#efcfb0" roughness={0.9} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.38, 1.36, 0]}>
        <mesh position={[0, -0.34, 0]} castShadow>
          <capsuleGeometry args={[0.095, 0.72, 6, 10]} />
          <meshStandardMaterial color={uniformColor} roughness={0.66} />
        </mesh>
        <mesh position={[0, -0.74, 0.02]} castShadow>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#efcfb0" roughness={0.9} />
        </mesh>
      </group>
      <group ref={leftLegRef} position={[-0.16, 0.82, 0]}>
        <mesh position={[0, -0.46, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.84, 6, 10]} />
          <meshStandardMaterial color="#22262c" roughness={0.82} />
        </mesh>
        <mesh position={[0, -0.96, 0.09]} castShadow>
          <boxGeometry args={[0.18, 0.1, 0.34]} />
          <meshStandardMaterial color="#11161c" roughness={0.88} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.16, 0.82, 0]}>
        <mesh position={[0, -0.46, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.84, 6, 10]} />
          <meshStandardMaterial color="#22262c" roughness={0.82} />
        </mesh>
        <mesh position={[0, -0.96, 0.09]} castShadow>
          <boxGeometry args={[0.18, 0.1, 0.34]} />
          <meshStandardMaterial color="#11161c" roughness={0.88} />
        </mesh>
      </group>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[0.78, 0.08, 0.78]} />
        <meshStandardMaterial color="#f3eee2" emissive={uniformColor} emissiveIntensity={0.12} roughness={0.34} />
      </mesh>
      {wanted > 0 ? (
        <mesh position={[0, 2.45, 0]}>
          <sphereGeometry args={[0.14, 14, 14]} />
          <meshStandardMaterial color="#ff8d66" emissive="#c1421f" emissiveIntensity={0.9} />
        </mesh>
      ) : null}
    </group>
  );
}

export function WeatherCloudLayer({ density = 0.3 }: { density?: number }) {
  return (
    <>
      <Cloud position={[-42, 24, -56]} opacity={0.1 + density * 0.14} speed={0.08} bounds={[28, 10, 10]} segments={20} color="#f9fbff" />
      <Cloud position={[8, 22, -42]} opacity={0.08 + density * 0.14} speed={0.06} bounds={[24, 10, 10]} segments={18} color="#ffffff" />
      <Cloud position={[44, 18, -20]} opacity={0.06 + density * 0.12} speed={0.05} bounds={[20, 8, 8]} segments={16} color="#f4f8ff" />
    </>
  );
}

export function WetSurfaceOverlay({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}