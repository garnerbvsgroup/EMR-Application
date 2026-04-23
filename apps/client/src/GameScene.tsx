import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, ContactShadows, Sky } from "@react-three/drei";
import { ACESFilmicToneMapping, Color, MathUtils, PCFShadowMap, Vector3, type Group } from "three";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, SSAO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { KernelSize, ToneMappingMode } from "postprocessing";
import {
  type ActiveVehicleState,
  GAME_CONFIG,
  type CallRecord,
  type PlayerPublicState,
  type WorldPosition,
} from "@redwood/shared";
import { PlayerModel, VehicleModel, WeatherCloudLayer, type PlayerMotionState } from "./renderModels";
import { type CameraRigState, type SceneProfile } from "./sceneTypes";

const TEAM_COLORS = {
  Civilian: "#f0d6b2",
  CityPolice: "#4d7cff",
  StatePatrol: "#79a7ff",
  FireRescue: "#d86152",
  PublicWorks: "#d29c3b",
} as const;

function getLocationPoint(call: CallRecord, index: number) {
  const matchedLocation = GAME_CONFIG.worldLocations.find((location) => location.name === call.location);
  if (matchedLocation) {
    return matchedLocation.position;
  }

  const angle = (index / 8) * Math.PI * 2;
  return {
    x: Math.cos(angle) * 18,
    y: Math.sin(angle) * 18,
  };
}

function ScenePostProcessing({ wetness }: { wetness: number }) {
  return (
    <EffectComposer multisampling={0} enableNormalPass>
      <SSAO samples={11} radius={0.16} intensity={14 + wetness * 8} luminanceInfluence={0.52} color={new Color("#0e1013")} />
      <Bloom intensity={0.2 + wetness * 0.14} luminanceThreshold={0.72} luminanceSmoothing={0.18} mipmapBlur kernelSize={KernelSize.SMALL} />
      <BrightnessContrast brightness={0.01} contrast={0.08 + wetness * 0.04} />
      <HueSaturation saturation={0.06 - wetness * 0.02} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.14} darkness={0.6} />
    </EffectComposer>
  );
}

function ScenePostProcessingBalanced({ wetness }: { wetness: number }) {
  return (
    <EffectComposer multisampling={0} enableNormalPass>
      <SSAO samples={7} radius={0.12} intensity={9 + wetness * 5} luminanceInfluence={0.45} color={new Color("#111316")} />
      <Bloom intensity={0.14 + wetness * 0.08} luminanceThreshold={0.78} luminanceSmoothing={0.22} mipmapBlur kernelSize={KernelSize.VERY_SMALL} />
      <BrightnessContrast brightness={0.01} contrast={0.05 + wetness * 0.02} />
      <HueSaturation saturation={0.03 - wetness * 0.015} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.12} darkness={0.46} />
    </EffectComposer>
  );
}

type GraphicsPreset = "full" | "balanced" | "stable";

function ActiveVehicles({ vehicles }: { vehicles: ActiveVehicleState[] }) {
  return (
    <>
      {vehicles.map((vehicle) => {
        const color = vehicle.occupantPlayerId ? "#e4a85a" : "#bec8d3";
        const accent = vehicle.occupantPlayerId ? "#ffe9b8" : "#7ac1ff";
        return (
          <group key={vehicle.id} position={[vehicle.position.x, 0, vehicle.position.y]} rotation={[0, -vehicle.heading, 0]}>
            <VehicleModel color={color} accent={accent} />
          </group>
        );
      })}
    </>
  );
}

function LocalAvatar({
  player,
  onMove,
  cameraRigRef,
}: {
  player: PlayerPublicState;
  onMove: (position: WorldPosition) => void;
  cameraRigRef: { current: CameraRigState };
}) {
  const avatarRef = useRef<Group>(null);
  const { camera } = useThree();
  const pressedKeys = useRef(new Set<string>());
  const nextSyncAt = useRef(0);
  const target = useRef(new Vector3(player.position.x, 0, player.position.y));
  const velocity = useRef(new Vector3());
  const heading = useRef(0);
  const motionRef = useRef<PlayerMotionState>({
    locomotion: "idle",
    pace: 0,
    strafe: 0,
    crouching: false,
    acting: false,
  });

  useEffect(() => {
    target.current.set(player.position.x, 0, player.position.y);
  }, [player.position.x, player.position.y]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      pressedKeys.current.add(event.key.toLowerCase());
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeys.current.delete(event.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    const rig = cameraRigRef.current;
    let inputForward = 0;
    let inputStrafe = 0;

    if (pressedKeys.current.has("w") || pressedKeys.current.has("arrowup")) inputForward += 1;
    if (pressedKeys.current.has("s") || pressedKeys.current.has("arrowdown")) inputForward -= 1;
    if (pressedKeys.current.has("a") || pressedKeys.current.has("arrowleft")) inputStrafe -= 1;
    if (pressedKeys.current.has("d") || pressedKeys.current.has("arrowright")) inputStrafe += 1;

    const sprinting = pressedKeys.current.has("shift") || pressedKeys.current.has("shiftleft") || pressedKeys.current.has("shiftright");
    const crouching = pressedKeys.current.has("c") || pressedKeys.current.has("control") || pressedKeys.current.has("controlleft") || pressedKeys.current.has("controlright");
    const acting = pressedKeys.current.has(" ") || pressedKeys.current.has("spacebar") || pressedKeys.current.has("e");
    const topSpeed = crouching ? 4.6 : sprinting ? 16 : rig.locked ? 12.5 : 10.2;

    const forwardX = Math.sin(rig.yaw);
    const forwardZ = Math.cos(rig.yaw);
    const rightX = Math.cos(rig.yaw);
    const rightZ = -Math.sin(rig.yaw);
    const moveX = rightX * inputStrafe + forwardX * inputForward;
    const moveZ = rightZ * inputStrafe + forwardZ * inputForward;
    const desiredVelocity = new Vector3();

    if (moveX !== 0 || moveZ !== 0) {
      const length = Math.hypot(moveX, moveZ) || 1;
      desiredVelocity.set((moveX / length) * topSpeed, 0, (moveZ / length) * topSpeed);
      heading.current = MathUtils.lerp(heading.current, Math.atan2(moveX / length, moveZ / length), 0.18);
    }

    velocity.current.lerp(desiredVelocity, moveX !== 0 || moveZ !== 0 ? 0.18 : 0.12);
    target.current.x = MathUtils.clamp(target.current.x + velocity.current.x * delta, -58, 58);
    target.current.z = MathUtils.clamp(target.current.z + velocity.current.z * delta, -58, 58);

    const movementSpeed = Math.hypot(velocity.current.x, velocity.current.z);
    motionRef.current = {
      locomotion: crouching ? "crouch" : movementSpeed > 12 ? "run" : movementSpeed > 1.25 ? "walk" : "idle",
      pace: MathUtils.clamp(movementSpeed / 16, 0, 1),
      strafe: inputStrafe,
      crouching,
      acting,
    };

    if (avatarRef.current) {
      avatarRef.current.position.lerp(target.current, 0.16);
      avatarRef.current.rotation.y = heading.current;

      const cameraDistance = rig.locked ? 5.8 : 11;
      const cameraHeight = rig.locked ? 1.9 + rig.pitch * 1.8 - (crouching ? 0.45 : 0) : 10;
      const lookAhead = rig.locked ? 5.5 : 0;
      const cameraX = target.current.x - Math.sin(rig.yaw) * cameraDistance;
      const cameraZ = target.current.z - Math.cos(rig.yaw) * cameraDistance;
      const lookX = target.current.x + Math.sin(rig.yaw) * lookAhead;
      const lookZ = target.current.z + Math.cos(rig.yaw) * lookAhead;
      const lookY = rig.locked ? 1.4 + Math.sin(rig.pitch) * 1.4 - (crouching ? 0.32 : 0) : 0.8;

      camera.position.lerp(new Vector3(cameraX, cameraHeight, cameraZ), 0.1);
      camera.lookAt(lookX, lookY, lookZ);
    }

    if (Date.now() >= nextSyncAt.current) {
      nextSyncAt.current = Date.now() + 120;
      onMove({ x: target.current.x, y: target.current.z });
    }
  });

  return (
    <group ref={avatarRef} position={[player.position.x, 0, player.position.y]}>
      <PlayerModel uniformColor={TEAM_COLORS[player.team]} wanted={player.wanted} motionRef={motionRef} />
    </group>
  );
}

function LocalVehicle({
  vehicle,
  onDrive,
  cameraRigRef,
}: {
  vehicle: ActiveVehicleState;
  onDrive: (nextState: { position: WorldPosition; heading: number; speed: number; fuel: number; health: number }) => void;
  cameraRigRef: { current: CameraRigState };
}) {
  const vehicleRef = useRef<Group>(null);
  const { camera } = useThree();
  const pressedKeys = useRef(new Set<string>());
  const syncAt = useRef(0);
  const runtime = useRef({
    x: vehicle.position.x,
    y: vehicle.position.y,
    heading: vehicle.heading,
    speed: vehicle.speed,
    fuel: vehicle.fuel,
    health: vehicle.health,
  });

  useEffect(() => {
    const current = runtime.current;
    if (Math.hypot(current.x - vehicle.position.x, current.y - vehicle.position.y) > 4 || Math.abs(current.speed - vehicle.speed) > 6) {
      runtime.current = {
        x: vehicle.position.x,
        y: vehicle.position.y,
        heading: vehicle.heading,
        speed: vehicle.speed,
        fuel: vehicle.fuel,
        health: vehicle.health,
      };
    }
  }, [vehicle.fuel, vehicle.health, vehicle.heading, vehicle.position.x, vehicle.position.y, vehicle.speed, vehicle.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      pressedKeys.current.add(event.key.toLowerCase());
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeys.current.delete(event.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    const spec = GAME_CONFIG.vehicles[vehicle.vehicleId];
    const current = runtime.current;
    const rig = cameraRigRef.current;
    const throttle = pressedKeys.current.has("w") || pressedKeys.current.has("arrowup") ? 1 : 0;
    const reverse = pressedKeys.current.has("s") || pressedKeys.current.has("arrowdown") ? 1 : 0;
    const steerLeft = pressedKeys.current.has("a") || pressedKeys.current.has("arrowleft") ? 1 : 0;
    const steerRight = pressedKeys.current.has("d") || pressedKeys.current.has("arrowright") ? 1 : 0;

    if (current.fuel > 0 && current.health > 0) {
      if (throttle) {
        current.speed = Math.min(spec.topSpeed, current.speed + spec.acceleration * delta);
      } else if (reverse) {
        current.speed = Math.max(-spec.topSpeed * 0.35, current.speed - spec.acceleration * 0.8 * delta);
      } else {
        current.speed *= Math.pow(0.9, delta * 60);
      }

      const steer = steerRight - steerLeft;
      if (steer !== 0) {
        const steerScale = Math.min(1.2, Math.max(0.18, Math.abs(current.speed) / 14));
        current.heading += steer * steerScale * delta * (current.speed >= 0 ? -1 : 1);
      }
    } else {
      current.speed = 0;
    }

    current.x = MathUtils.clamp(current.x + Math.cos(current.heading) * current.speed * delta, -58, 58);
    current.y = MathUtils.clamp(current.y + Math.sin(current.heading) * current.speed * delta, -58, 58);
    current.fuel = Math.max(0, current.fuel - Math.abs(current.speed) * 0.022 * delta);

    if (vehicleRef.current) {
      vehicleRef.current.position.set(current.x, 0, current.y);
      vehicleRef.current.rotation.set(0, -current.heading, 0);
      const viewYaw = rig.locked ? rig.yaw : current.heading + Math.PI;
      const followDistance = rig.locked ? 7.8 : 9;
      const followHeight = rig.locked ? 2.9 + rig.pitch * 1.6 : 6.5;
      const followX = current.x - Math.sin(viewYaw) * followDistance;
      const followY = current.y - Math.cos(viewYaw) * followDistance;
      const lookX = current.x + Math.sin(viewYaw) * (rig.locked ? 7 : 0);
      const lookY = current.y + Math.cos(viewYaw) * (rig.locked ? 7 : 0);

      camera.position.lerp(new Vector3(followX, followHeight, followY), 0.08);
      camera.lookAt(lookX, 1.3 + Math.sin(rig.pitch) * 1.1, lookY);
    }

    if (Date.now() >= syncAt.current) {
      syncAt.current = Date.now() + 120;
      onDrive({
        position: { x: current.x, y: current.y },
        heading: current.heading,
        speed: current.speed,
        fuel: current.fuel,
        health: current.health,
      });
    }
  });

  return (
    <group ref={vehicleRef} position={[vehicle.position.x, 0, vehicle.position.y]} rotation={[0, -vehicle.heading, 0]}>
      <VehicleModel color="#eaab59" accent="#fff0c4" />
    </group>
  );
}

function RemoteAvatars({ players }: { players: PlayerPublicState[] }) {
  return (
    <>
      {players.map((player) => (
        <group key={player.id} position={[player.position.x, 0, player.position.y]}>
          <PlayerModel uniformColor={TEAM_COLORS[player.team]} wanted={player.wanted} />
        </group>
      ))}
    </>
  );
}

function CallMarkers({ calls }: { calls: CallRecord[] }) {
  return (
    <>
      {calls.map((call, index) => {
        const point = getLocationPoint(call, index);
        return (
          <group key={call.id} position={[point.x, 0, point.y]}>
            <mesh position={[0, 0.6, 0]} castShadow>
              <cylinderGeometry args={[0.28, 0.28, 1, 16]} />
              <meshStandardMaterial color="#ffdf75" emissive="#9e6600" emissiveIntensity={0.45} />
            </mesh>
            <mesh position={[0, 1.34, 0]}>
              <sphereGeometry args={[0.22, 16, 16]} />
              <meshStandardMaterial color="#fff5d3" emissive="#f2be32" emissiveIntensity={0.8} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function WorldLandmarks() {
  const landmarks = GAME_CONFIG.worldLocations.filter((location) => location.category !== "district");

  return (
    <>
      {landmarks.map((location) => (
        <group key={location.id} position={[location.position.x, 0, location.position.y]}>
          <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <ringGeometry args={[0.7, 1.06, 32]} />
            <meshStandardMaterial color={location.accent} transparent opacity={0.75} />
          </mesh>
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.35, 0.45, 1.4, 18]} />
            <meshStandardMaterial color={location.accent} emissive={location.accent} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, 1.58, 0]}>
            <boxGeometry args={[0.75, 0.36, 0.75]} />
            <meshStandardMaterial color="#f5f0de" />
          </mesh>
          <pointLight position={[0, 2.1, 0]} color={location.accent} intensity={0.5} distance={8} />
        </group>
      ))}
    </>
  );
}

function TrafficSignal({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 5.2, 10]} />
        <meshStandardMaterial color="#4e555d" metalness={0.52} roughness={0.42} />
      </mesh>
      <mesh position={[0.62, 4.85, 0]} castShadow>
        <boxGeometry args={[1.24, 0.12, 0.12]} />
        <meshStandardMaterial color="#4e555d" metalness={0.52} roughness={0.42} />
      </mesh>
      <mesh position={[1.12, 4.5, 0]} castShadow>
        <boxGeometry args={[0.38, 0.92, 0.34]} />
        <meshStandardMaterial color="#20262c" roughness={0.82} />
      </mesh>
      <mesh position={[1.12, 4.72, 0]}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshStandardMaterial color="#d54e44" emissive="#c93e34" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[1.12, 4.5, 0]}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshStandardMaterial color="#f4cf6d" emissive="#c39829" emissiveIntensity={0.78} />
      </mesh>
      <mesh position={[1.12, 4.28, 0]}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshStandardMaterial color="#73d27c" emissive="#43aa53" emissiveIntensity={0.92} />
      </mesh>
    </group>
  );
}

function ParkingLot({ position, size, wetness }: { position: [number, number, number]; size: [number, number]; wetness: number }) {
  const [width, depth] = size;
  const bayOffsets = Array.from({ length: Math.max(3, Math.floor(width / 3.8)) }, (_, index) => -width / 2 + 2 + index * 3.8);

  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#363c41" roughness={0.9 - wetness * 0.34} metalness={0.12 + wetness * 0.24} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width * 0.96, depth * 0.96]} />
        <meshStandardMaterial color="#d7e3ea" transparent opacity={wetness * 0.12} roughness={0.08} metalness={0.56} />
      </mesh>
      {bayOffsets.map((offset) => (
        <mesh key={offset} position={[offset, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.12, depth * 0.82]} />
          <meshStandardMaterial color="#d5d7d8" roughness={0.52} />
        </mesh>
      ))}
    </group>
  );
}

type BuildingLot = {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  bodyColor: string;
  windowColor: string;
  roofColor: string;
  entranceColor: string;
};

type HouseLot = {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  bodyColor: string;
  roofColor: string;
  trimColor: string;
};

type WarehouseLot = {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  bodyColor: string;
  roofColor: string;
  accentColor: string;
};

type RoadSegment = {
  key: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  orientation: "horizontal" | "vertical";
};

type SidewalkStrip = {
  key: string;
  x: number;
  z: number;
  width: number;
  depth: number;
};

type StreetLightPoint = {
  x: number;
  z: number;
  rotation?: number;
};

type TreeLot = {
  x: number;
  z: number;
  scale: number;
};

function CorporateTower({ lot }: { lot: BuildingLot }) {
  const windowRows = Math.max(4, Math.floor((lot.height - 4) / 2.8));
  const windowColumns = Math.max(2, Math.floor((lot.width - 2) / 2.2));
  const windowWidth = Math.max(0.7, Math.min(1.2, lot.width / (windowColumns + 1.8)));
  const windowHeight = 1.25;
  const horizontalSpacing = lot.width / (windowColumns + 1);
  const verticalSpacing = (lot.height - 4) / Math.max(1, windowRows);

  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, lot.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[lot.width, lot.height, lot.depth]} />
        <meshStandardMaterial color={lot.bodyColor} roughness={0.7} metalness={0.18} />
      </mesh>
      <mesh position={[0, lot.height + 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[lot.width * 0.96, 0.5, lot.depth * 0.96]} />
        <meshStandardMaterial color={lot.roofColor} roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.14, lot.depth / 2 + 0.02]} receiveShadow>
        <boxGeometry args={[lot.width * 0.86, 0.28, 1.2]} />
        <meshStandardMaterial color="#c7cdd2" roughness={0.82} />
      </mesh>
      <mesh position={[0, 1.8, lot.depth / 2 + 0.06]} castShadow>
        <boxGeometry args={[1.9, 2.4, 0.18]} />
        <meshStandardMaterial color={lot.entranceColor} metalness={0.42} roughness={0.2} />
      </mesh>
      {Array.from({ length: windowRows }, (_, rowIndex) => {
        const y = 3 + rowIndex * verticalSpacing;
        return Array.from({ length: windowColumns }, (_, columnIndex) => {
          const x = -lot.width / 2 + horizontalSpacing * (columnIndex + 1);
          return (
            <group key={`${lot.x}-${lot.z}-${rowIndex}-${columnIndex}`}>
              <mesh position={[x, y, lot.depth / 2 + 0.08]}>
                <boxGeometry args={[windowWidth, windowHeight, 0.14]} />
                <meshStandardMaterial color={lot.windowColor} emissive={lot.windowColor} emissiveIntensity={0.16} metalness={0.35} roughness={0.18} />
              </mesh>
              <mesh position={[x, y, -lot.depth / 2 - 0.08]}>
                <boxGeometry args={[windowWidth, windowHeight, 0.14]} />
                <meshStandardMaterial color={lot.windowColor} emissive={lot.windowColor} emissiveIntensity={0.08} metalness={0.3} roughness={0.2} />
              </mesh>
            </group>
          );
        });
      })}
    </group>
  );
}

function SuburbanHouse({ lot }: { lot: HouseLot }) {
  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, lot.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[lot.width, lot.height, lot.depth]} />
        <meshStandardMaterial color={lot.bodyColor} roughness={0.9} />
      </mesh>
      <mesh position={[0, lot.height + 1.4, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[lot.width * 0.84, 3.3, 4]} />
        <meshStandardMaterial color={lot.roofColor} roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.45, lot.depth / 2 + 0.03]}>
        <boxGeometry args={[1.3, 2.1, 0.15]} />
        <meshStandardMaterial color={lot.trimColor} roughness={0.55} />
      </mesh>
      <mesh position={[-lot.width * 0.22, lot.height * 0.65, lot.depth / 2 + 0.05]}>
        <boxGeometry args={[1.2, 1, 0.12]} />
        <meshStandardMaterial color="#dfe7ef" emissive="#bdd8ff" emissiveIntensity={0.12} metalness={0.2} roughness={0.22} />
      </mesh>
      <mesh position={[lot.width * 0.22, lot.height * 0.65, lot.depth / 2 + 0.05]}>
        <boxGeometry args={[1.2, 1, 0.12]} />
        <meshStandardMaterial color="#dfe7ef" emissive="#bdd8ff" emissiveIntensity={0.12} metalness={0.2} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.06, lot.depth / 2 + 2.1]} receiveShadow>
        <boxGeometry args={[lot.width * 0.7, 0.12, 3.2]} />
        <meshStandardMaterial color="#b8b0a4" roughness={0.92} />
      </mesh>
    </group>
  );
}

function IndustrialWarehouse({ lot }: { lot: WarehouseLot }) {
  return (
    <group position={[lot.x, 0, lot.z]}>
      <mesh position={[0, lot.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[lot.width, lot.height, lot.depth]} />
        <meshStandardMaterial color={lot.bodyColor} roughness={0.82} metalness={0.08} />
      </mesh>
      <mesh position={[0, lot.height + 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[lot.width * 1.02, 0.5, lot.depth * 1.02]} />
        <meshStandardMaterial color={lot.roofColor} roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.2, lot.depth / 2 + 0.05]}>
        <boxGeometry args={[lot.width * 0.46, 3.4, 0.14]} />
        <meshStandardMaterial color={lot.accentColor} metalness={0.18} roughness={0.4} />
      </mesh>
      <mesh position={[-lot.width * 0.3, 3.8, lot.depth / 2 + 0.06]}>
        <boxGeometry args={[2.2, 1.4, 0.12]} />
        <meshStandardMaterial color="#d7e6ee" emissive="#9cc7db" emissiveIntensity={0.1} roughness={0.22} metalness={0.24} />
      </mesh>
      <mesh position={[lot.width * 0.3, 3.8, lot.depth / 2 + 0.06]}>
        <boxGeometry args={[2.2, 1.4, 0.12]} />
        <meshStandardMaterial color="#d7e6ee" emissive="#9cc7db" emissiveIntensity={0.1} roughness={0.22} metalness={0.24} />
      </mesh>
    </group>
  );
}

function RoadMesh({ segment, wetness }: { segment: RoadSegment; wetness: number }) {
  const laneMarks = segment.orientation === "horizontal"
    ? Array.from({ length: Math.max(3, Math.floor(segment.width / 12)) }, (_, index) => -segment.width / 2 + 6 + index * 12)
    : Array.from({ length: Math.max(3, Math.floor(segment.depth / 12)) }, (_, index) => -segment.depth / 2 + 6 + index * 12);

  return (
    <group position={[segment.x, 0, segment.z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[segment.width, segment.depth]} />
        <meshStandardMaterial color="#2d3237" roughness={0.92 - wetness * 0.42} metalness={0.08 + wetness * 0.3} />
      </mesh>
      <mesh position={[0, 0.021, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[segment.width * 0.98, segment.depth * 0.98]} />
        <meshStandardMaterial color="#cad5dc" transparent opacity={wetness * 0.14} roughness={0.06} metalness={0.62} />
      </mesh>
      {laneMarks.map((offset) => (
        <mesh
          key={`${segment.key}-${offset}`}
          position={segment.orientation === "horizontal" ? [offset, 0.03, 0] : [0, 0.03, offset]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={segment.orientation === "horizontal" ? [4.5, 0.36] : [0.36, 4.5]} />
          <meshStandardMaterial color="#f3df9d" roughness={0.7} />
        </mesh>
      ))}
      {segment.orientation === "horizontal" ? (
        <>
          <mesh position={[0, 0.031, -segment.depth / 2 + 0.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[segment.width, 0.22]} />
            <meshStandardMaterial color="#d8dbde" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.031, segment.depth / 2 - 0.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[segment.width, 0.22]} />
            <meshStandardMaterial color="#d8dbde" roughness={0.55} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[-segment.width / 2 + 0.6, 0.031, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[0.22, segment.depth]} />
            <meshStandardMaterial color="#d8dbde" roughness={0.55} />
          </mesh>
          <mesh position={[segment.width / 2 - 0.6, 0.031, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[0.22, segment.depth]} />
            <meshStandardMaterial color="#d8dbde" roughness={0.55} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Sidewalk({ strip, wetness }: { strip: SidewalkStrip; wetness: number }) {
  return (
    <group position={[strip.x, 0.05, strip.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[strip.width, strip.depth]} />
        <meshStandardMaterial color="#b7b4ac" roughness={0.9 - wetness * 0.24} metalness={0.04 + wetness * 0.18} />
      </mesh>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[strip.width * 0.96, strip.depth * 0.96]} />
        <meshStandardMaterial color="#eef3f7" transparent opacity={wetness * 0.07} roughness={0.14} metalness={0.36} />
      </mesh>
    </group>
  );
}

function StreetLight({ point }: { point: StreetLightPoint }) {
  return (
    <group position={[point.x, 0, point.z]} rotation={[0, point.rotation ?? 0, 0]}>
      <mesh position={[0, 2.9, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.11, 5.8, 10]} />
        <meshStandardMaterial color="#545a60" metalness={0.48} roughness={0.48} />
      </mesh>
      <mesh position={[0.55, 5.6, 0]} castShadow>
        <boxGeometry args={[1.1, 0.12, 0.12]} />
        <meshStandardMaterial color="#545a60" metalness={0.48} roughness={0.48} />
      </mesh>
      <mesh position={[1.05, 5.3, 0]}>
        <boxGeometry args={[0.34, 0.24, 0.28]} />
        <meshStandardMaterial color="#f3dfb2" emissive="#ffd37c" emissiveIntensity={0.9} roughness={0.28} />
      </mesh>
      <pointLight position={[1.05, 5.1, 0]} intensity={0.5} distance={18} color="#ffd89a" />
    </group>
  );
}

function FirTree({ lot }: { lot: TreeLot }) {
  return (
    <group position={[lot.x, 0, lot.z]} scale={lot.scale}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.34, 3, 10]} />
        <meshStandardMaterial color="#6b4a35" roughness={0.94} />
      </mesh>
      <mesh position={[0, 3.1, 0]} castShadow>
        <coneGeometry args={[1.5, 3.2, 8]} />
        <meshStandardMaterial color="#4b7a49" roughness={0.96} />
      </mesh>
      <mesh position={[0, 4.3, 0]} castShadow>
        <coneGeometry args={[1.1, 2.5, 8]} />
        <meshStandardMaterial color="#3f6a3f" roughness={0.96} />
      </mesh>
    </group>
  );
}

function WorldStage({ profile, suppressClouds = false }: { profile: SceneProfile; suppressClouds?: boolean }) {
  const downtownBuildings = useMemo(
    () => [
      { x: -20, z: -23, width: 11, depth: 10, height: 24, bodyColor: "#5d6d7d", windowColor: "#d8eef9", roofColor: "#414e5a", entranceColor: "#9cbbc8" },
      { x: -6, z: -24, width: 9, depth: 9, height: 18, bodyColor: "#7d6b60", windowColor: "#f2e5c6", roofColor: "#594b42", entranceColor: "#b7917b" },
      { x: 10, z: -20, width: 12, depth: 10, height: 28, bodyColor: "#50697b", windowColor: "#cae6f6", roofColor: "#425565", entranceColor: "#8db0c0" },
      { x: 25, z: -19, width: 11, depth: 9, height: 22, bodyColor: "#76665b", windowColor: "#f0dec3", roofColor: "#5b5049", entranceColor: "#b38872" },
      { x: -16, z: -5, width: 10, depth: 10, height: 19, bodyColor: "#566a79", windowColor: "#d9eef8", roofColor: "#46525b", entranceColor: "#9eb7c5" },
      { x: 2, z: -2, width: 14, depth: 14, height: 25, bodyColor: "#708595", windowColor: "#d7eef9", roofColor: "#576673", entranceColor: "#9cb6c4" },
      { x: 21, z: 3, width: 12, depth: 10, height: 18, bodyColor: "#7a6958", windowColor: "#f1e3cd", roofColor: "#5d5146", entranceColor: "#ba977d" },
    ] satisfies readonly BuildingLot[],
    [],
  );

  const residentialBlocks = useMemo(
    () => [
      { x: -44, z: 24, width: 9, depth: 7, height: 5, bodyColor: "#d1b38f", roofColor: "#7d5647", trimColor: "#7c4f3c" },
      { x: -32, z: 30, width: 8, depth: 7, height: 5, bodyColor: "#b99872", roofColor: "#69463d", trimColor: "#7b5947" },
      { x: -20, z: 23, width: 9, depth: 7, height: 5, bodyColor: "#c3a17d", roofColor: "#744c43", trimColor: "#76503d" },
      { x: -36, z: 14, width: 8, depth: 7, height: 5, bodyColor: "#b88d6e", roofColor: "#6d433a", trimColor: "#744d3f" },
      { x: -24, z: 12, width: 9, depth: 8, height: 5, bodyColor: "#d0ae89", roofColor: "#7a5144", trimColor: "#815b49" },
    ] satisfies readonly HouseLot[],
    [],
  );

  const industrialBlocks = useMemo(
    () => [
      { x: 30, z: 30, width: 15, depth: 12, height: 8, bodyColor: "#6c665f", roofColor: "#50565b", accentColor: "#a98d5b" },
      { x: 46, z: 28, width: 12, depth: 12, height: 9, bodyColor: "#5b666d", roofColor: "#4d555a", accentColor: "#8da3af" },
      { x: 34, z: 16, width: 16, depth: 10, height: 7, bodyColor: "#766c61", roofColor: "#5f5850", accentColor: "#bf8c52" },
      { x: 48, z: 12, width: 10, depth: 10, height: 11, bodyColor: "#6b7079", roofColor: "#4d545d", accentColor: "#8aa0b5" },
    ] satisfies readonly WarehouseLot[],
    [],
  );

  const treePositions = useMemo(
    () => [
      { x: -52, z: 38, scale: 1.05 }, { x: -46, z: 34, scale: 0.95 }, { x: -40, z: 8, scale: 0.88 }, { x: -34, z: 4, scale: 0.84 }, { x: -30, z: 36, scale: 1.1 },
      { x: -24, z: 34, scale: 1 }, { x: -18, z: 10, scale: 0.85 }, { x: 38, z: -34, scale: 1 }, { x: 44, z: -28, scale: 0.93 }, { x: 48, z: -18, scale: 1.08 },
      { x: 52, z: -10, scale: 1.16 }, { x: 52, z: 2, scale: 1 }, { x: 54, z: 16, scale: 0.9 }, { x: 18, z: 38, scale: 0.88 }, { x: 8, z: 42, scale: 0.95 },
      { x: -4, z: 40, scale: 0.86 }, { x: -16, z: 40, scale: 0.98 }, { x: 30, z: 40, scale: 0.92 }, { x: 42, z: 38, scale: 1.04 }, { x: -50, z: -22, scale: 1.1 },
    ] satisfies readonly TreeLot[],
    [],
  );

  const roads = useMemo(
    () => [
      { key: "main-north-south", x: 0, z: 0, width: 18, depth: 150, orientation: "vertical" },
      { key: "main-east-west", x: 0, z: 0, width: 150, depth: 18, orientation: "horizontal" },
      { key: "west-residential", x: -33, z: 22, width: 44, depth: 12, orientation: "horizontal" },
      { key: "east-industrial", x: 40, z: 24, width: 38, depth: 12, orientation: "horizontal" },
      { key: "south-frontage", x: 12, z: -26, width: 74, depth: 12, orientation: "horizontal" },
    ] satisfies readonly RoadSegment[],
    [],
  );

  const sidewalks = useMemo(
    () => [
      { key: "core-west", x: -11.3, z: 0, width: 3.2, depth: 150 },
      { key: "core-east", x: 11.3, z: 0, width: 3.2, depth: 150 },
      { key: "cross-north", x: 0, z: -11.3, width: 150, depth: 3.2 },
      { key: "cross-south", x: 0, z: 11.3, width: 150, depth: 3.2 },
      { key: "west-top", x: -33, z: 28.5, width: 44, depth: 2.8 },
      { key: "west-bottom", x: -33, z: 15.5, width: 44, depth: 2.8 },
      { key: "east-top", x: 40, z: 30.5, width: 38, depth: 2.8 },
      { key: "east-bottom", x: 40, z: 17.5, width: 38, depth: 2.8 },
    ] satisfies readonly SidewalkStrip[],
    [],
  );

  const streetLights = useMemo(
    () => [
      { x: -12.8, z: -48 }, { x: 12.8, z: -48, rotation: Math.PI },
      { x: -12.8, z: -20 }, { x: 12.8, z: -20, rotation: Math.PI },
      { x: -12.8, z: 8 }, { x: 12.8, z: 8, rotation: Math.PI },
      { x: -12.8, z: 36 }, { x: 12.8, z: 36, rotation: Math.PI },
      { x: -44, z: 18, rotation: Math.PI / 2 }, { x: -22, z: 18, rotation: -Math.PI / 2 },
      { x: 26, z: 20, rotation: Math.PI / 2 }, { x: 52, z: 20, rotation: -Math.PI / 2 },
    ] satisfies readonly StreetLightPoint[],
    [],
  );

  const trafficSignals = useMemo(
    () => [
      { position: [-9.5, 0, -9.5] as [number, number, number], rotation: 0 },
      { position: [9.5, 0, -9.5] as [number, number, number], rotation: Math.PI / 2 },
      { position: [-9.5, 0, 9.5] as [number, number, number], rotation: -Math.PI / 2 },
      { position: [9.5, 0, 9.5] as [number, number, number], rotation: Math.PI },
    ],
    [],
  );

  const verticalMarkers = useMemo(() => Array.from({ length: 14 }, (_, index) => -52 + index * 8), []);
  const horizontalMarkers = useMemo(() => Array.from({ length: 14 }, (_, index) => -52 + index * 8), []);

  return (
    <>
      <color attach="background" args={[new Color(profile.background)]} />
      <fog attach="fog" args={[profile.fog, profile.fogNear, profile.fogFar]} />
      <Sky
        distance={450000}
        turbidity={profile.skyTurbidity}
        rayleigh={profile.skyRayleigh}
        mieCoefficient={profile.skyMieCoefficient}
        mieDirectionalG={profile.skyMieDirectionalG}
        sunPosition={profile.sunPosition}
        inclination={0.47}
        azimuth={0.18}
      />
      <ambientLight intensity={profile.ambientIntensity} />
      <hemisphereLight args={[profile.hemisphereSky, profile.hemisphereGround, profile.hemisphereIntensity]} />
      <directionalLight
        position={profile.sunPosition}
        intensity={profile.sunIntensity}
        color={profile.sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00012}
      />
      <directionalLight position={[-18, 12, 28]} intensity={profile.fillIntensity} color={profile.fillColor} />

      {suppressClouds ? null : <WeatherCloudLayer density={profile.cloudDensity} />}

      <mesh position={[54, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[36, 180]} />
        <meshStandardMaterial color={profile.waterColor} metalness={0.36} roughness={0.12} />
      </mesh>

      <mesh position={[54, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[34, 178]} />
        <meshStandardMaterial color={profile.waterHighlight} transparent opacity={0.16 + profile.wetness * 0.08} metalness={0.48} roughness={0.06} />
      </mesh>

      <mesh position={[45, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 180]} />
        <meshStandardMaterial color="#d8c6a2" roughness={0.98} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial color={profile.grassColor} roughness={0.95} />
      </mesh>

      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial color="#8caf72" transparent opacity={0.08} />
      </mesh>

      <mesh position={[-35, 0.01, 24]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 18]} />
        <meshStandardMaterial color="#7ba06e" roughness={0.98} />
      </mesh>
      <mesh position={[38, 0.01, 23]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[36, 24]} />
        <meshStandardMaterial color="#857560" roughness={0.98} />
      </mesh>

      <ParkingLot position={[-34, 0.05, 22]} size={[22, 18]} wetness={profile.wetness} />
      <ParkingLot position={[37.5, 0.05, 24]} size={[24, 18]} wetness={profile.wetness} />

      {roads.map((segment) => (
        <RoadMesh key={segment.key} segment={segment} wetness={profile.wetness} />
      ))}

      {sidewalks.map((strip) => (
        <Sidewalk key={strip.key} strip={strip} wetness={profile.wetness} />
      ))}

      {verticalMarkers.map((z) => (
        <mesh key={`v-${z}`} position={[0, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.45, 4.2]} />
          <meshStandardMaterial color="#f3e3a8" />
        </mesh>
      ))}
      {horizontalMarkers.map((x) => (
        <mesh key={`h-${x}`} position={[x, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[4.2, 0.45]} />
          <meshStandardMaterial color="#f3e3a8" />
        </mesh>
      ))}

      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[6.5, 8.5, 48]} />
        <meshStandardMaterial color="#d9dee3" roughness={0.48} />
      </mesh>

      <mesh position={[0, 0.031, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[5.4, 5.9, 40]} />
        <meshStandardMaterial color="#f0f1ef" roughness={0.42} />
      </mesh>

      <mesh position={[-16, 0.05, -12]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.2, 32]} />
        <meshStandardMaterial color="#2758b9" transparent opacity={0.82} />
      </mesh>
      <mesh position={[14, 0.05, -12]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.2, 32]} />
        <meshStandardMaterial color="#b94439" transparent opacity={0.84} />
      </mesh>
      <mesh position={[30, 0.05, 16]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.2, 32]} />
        <meshStandardMaterial color="#c89424" transparent opacity={0.84} />
      </mesh>
      <mesh position={[-34, 0.04, 22]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 22]} />
        <meshStandardMaterial color="#7ca36f" transparent opacity={0.48} />
      </mesh>
      <mesh position={[38, 0.04, 24]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 22]} />
        <meshStandardMaterial color="#8a7866" transparent opacity={0.36} />
      </mesh>

      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[36, 36]} />
        <meshStandardMaterial color="#b5b0a8" transparent opacity={0.55} roughness={0.9} />
      </mesh>

      <mesh position={[46.5, 0.06, 6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.5, 26]} />
        <meshStandardMaterial color="#d4d8db" roughness={0.58} />
      </mesh>

      {trafficSignals.map((signal, index) => (
        <TrafficSignal key={`signal-${index}`} position={signal.position} rotation={signal.rotation} />
      ))}

      {downtownBuildings.map((lot, index) => (
        <CorporateTower key={`downtown-${index}`} lot={lot} />
      ))}

      {residentialBlocks.map((lot, index) => (
        <SuburbanHouse key={`residential-${index}`} lot={lot} />
      ))}

      {industrialBlocks.map((lot, index) => (
        <IndustrialWarehouse key={`industrial-${index}`} lot={lot} />
      ))}

      {treePositions.map((lot, index) => (
        <FirTree key={`tree-${index}`} lot={lot} />
      ))}

      {streetLights.map((point, index) => (
        <StreetLight key={`light-${index}`} point={point} />
      ))}
    </>
  );
}

type GameSceneProps = {
  me: PlayerPublicState | null;
  players: PlayerPublicState[];
  calls: CallRecord[];
  vehicles: ActiveVehicleState[];
  onMove: (position: WorldPosition) => void;
  onDriveVehicle: (vehicleEntityId: string, nextState: { position: WorldPosition; heading: number; speed: number; fuel: number; health: number }) => void;
  cameraRigRef: { current: CameraRigState };
  onEngageCamera: () => void;
  sceneProfile: SceneProfile;
  onReady?: () => void;
  graphicsPreset?: GraphicsPreset;
  onContextLoss?: () => void;
};

function SceneReadyBeacon({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return null;
}

export default function GameScene({
  me,
  players,
  calls,
  vehicles,
  onMove,
  onDriveVehicle,
  cameraRigRef,
  onEngageCamera,
  sceneProfile,
  onReady,
  graphicsPreset = "full",
  onContextLoss,
}: GameSceneProps) {
  const remotePlayers = me ? players.filter((player) => player.id !== me.id) : players;
  const localVehicle = me?.activeVehicleEntityId ? vehicles.find((vehicle) => vehicle.id === me.activeVehicleEntityId && vehicle.occupantPlayerId === me.id) : undefined;
  const remoteVehicles = localVehicle ? vehicles.filter((vehicle) => vehicle.id !== localVehicle.id) : vehicles;
  const stableGraphics = graphicsPreset === "stable";
  const balancedGraphics = graphicsPreset === "balanced";
  const dpr: [number, number] = stableGraphics ? [0.7, 1] : balancedGraphics ? [0.8, 1.08] : [0.9, 1.35];
  const contactShadowResolution = balancedGraphics ? 256 : 512;

  return (
    <Canvas
      className="world-canvas"
      dpr={dpr}
      shadows={{ type: PCFShadowMap }}
      gl={{ antialias: !stableGraphics, toneMapping: ACESFilmicToneMapping, powerPreference: stableGraphics ? "default" : "high-performance" }}
      camera={{ position: [10, 10, 10], fov: 48 }}
      onPointerDown={onEngageCamera}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
            onContextLoss?.();
          },
          { once: true },
        );
      }}
    >
      <SceneReadyBeacon onReady={onReady} />
      <AdaptiveEvents />
      <AdaptiveDpr pixelated />
      <WorldStage profile={sceneProfile} suppressClouds />
      {stableGraphics ? null : <ContactShadows position={[0, 0.01, 0]} opacity={0.2 + sceneProfile.wetness * 0.1} scale={156} blur={balancedGraphics ? 1.6 : 2.1} far={46} resolution={contactShadowResolution} color="#000000" />}
      <WorldLandmarks />
      <CallMarkers calls={calls} />
      <ActiveVehicles vehicles={remoteVehicles} />
      <RemoteAvatars players={remotePlayers} />
      {localVehicle ? <LocalVehicle vehicle={localVehicle} onDrive={(nextState) => onDriveVehicle(localVehicle.id, nextState)} cameraRigRef={cameraRigRef} /> : me ? <LocalAvatar player={me} onMove={onMove} cameraRigRef={cameraRigRef} /> : null}
      {stableGraphics ? null : balancedGraphics ? <ScenePostProcessingBalanced wetness={sceneProfile.wetness} /> : <ScenePostProcessing wetness={sceneProfile.wetness} />}
    </Canvas>
  );
}