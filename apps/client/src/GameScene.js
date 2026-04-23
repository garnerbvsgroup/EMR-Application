import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, ContactShadows, Sky } from "@react-three/drei";
import { ACESFilmicToneMapping, Color, MathUtils, PCFShadowMap, Vector3 } from "three";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, SSAO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { KernelSize, ToneMappingMode } from "postprocessing";
import { GAME_CONFIG, } from "@redwood/shared";
import { PlayerModel, VehicleModel, WeatherCloudLayer } from "./renderModels";
const TEAM_COLORS = {
    Civilian: "#f0d6b2",
    CityPolice: "#4d7cff",
    StatePatrol: "#79a7ff",
    FireRescue: "#d86152",
    PublicWorks: "#d29c3b",
};
function getLocationPoint(call, index) {
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
function ScenePostProcessing({ wetness }) {
    return (_jsxs(EffectComposer, { multisampling: 0, enableNormalPass: true, children: [_jsx(SSAO, { samples: 11, radius: 0.16, intensity: 14 + wetness * 8, luminanceInfluence: 0.52, color: new Color("#0e1013") }), _jsx(Bloom, { intensity: 0.2 + wetness * 0.14, luminanceThreshold: 0.72, luminanceSmoothing: 0.18, mipmapBlur: true, kernelSize: KernelSize.SMALL }), _jsx(BrightnessContrast, { brightness: 0.01, contrast: 0.08 + wetness * 0.04 }), _jsx(HueSaturation, { saturation: 0.06 - wetness * 0.02 }), _jsx(ToneMapping, { mode: ToneMappingMode.ACES_FILMIC }), _jsx(Vignette, { eskil: false, offset: 0.14, darkness: 0.6 })] }));
}
function ScenePostProcessingBalanced({ wetness }) {
    return (_jsxs(EffectComposer, { multisampling: 0, enableNormalPass: true, children: [_jsx(SSAO, { samples: 7, radius: 0.12, intensity: 9 + wetness * 5, luminanceInfluence: 0.45, color: new Color("#111316") }), _jsx(Bloom, { intensity: 0.14 + wetness * 0.08, luminanceThreshold: 0.78, luminanceSmoothing: 0.22, mipmapBlur: true, kernelSize: KernelSize.VERY_SMALL }), _jsx(BrightnessContrast, { brightness: 0.01, contrast: 0.05 + wetness * 0.02 }), _jsx(HueSaturation, { saturation: 0.03 - wetness * 0.015 }), _jsx(ToneMapping, { mode: ToneMappingMode.ACES_FILMIC }), _jsx(Vignette, { eskil: false, offset: 0.12, darkness: 0.46 })] }));
}
function ActiveVehicles({ vehicles }) {
    return (_jsx(_Fragment, { children: vehicles.map((vehicle) => {
            const color = vehicle.occupantPlayerId ? "#e4a85a" : "#bec8d3";
            const accent = vehicle.occupantPlayerId ? "#ffe9b8" : "#7ac1ff";
            return (_jsx("group", { position: [vehicle.position.x, 0, vehicle.position.y], rotation: [0, -vehicle.heading, 0], children: _jsx(VehicleModel, { color: color, accent: accent }) }, vehicle.id));
        }) }));
}
function LocalAvatar({ player, onMove, cameraRigRef, }) {
    const avatarRef = useRef(null);
    const { camera } = useThree();
    const pressedKeys = useRef(new Set());
    const nextSyncAt = useRef(0);
    const target = useRef(new Vector3(player.position.x, 0, player.position.y));
    const velocity = useRef(new Vector3());
    const heading = useRef(0);
    const motionRef = useRef({
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
        const handleKeyDown = (event) => {
            pressedKeys.current.add(event.key.toLowerCase());
        };
        const handleKeyUp = (event) => {
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
        if (pressedKeys.current.has("w") || pressedKeys.current.has("arrowup"))
            inputForward += 1;
        if (pressedKeys.current.has("s") || pressedKeys.current.has("arrowdown"))
            inputForward -= 1;
        if (pressedKeys.current.has("a") || pressedKeys.current.has("arrowleft"))
            inputStrafe -= 1;
        if (pressedKeys.current.has("d") || pressedKeys.current.has("arrowright"))
            inputStrafe += 1;
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
    return (_jsx("group", { ref: avatarRef, position: [player.position.x, 0, player.position.y], children: _jsx(PlayerModel, { uniformColor: TEAM_COLORS[player.team], wanted: player.wanted, motionRef: motionRef }) }));
}
function LocalVehicle({ vehicle, onDrive, cameraRigRef, }) {
    const vehicleRef = useRef(null);
    const { camera } = useThree();
    const pressedKeys = useRef(new Set());
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
        const handleKeyDown = (event) => {
            pressedKeys.current.add(event.key.toLowerCase());
        };
        const handleKeyUp = (event) => {
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
            }
            else if (reverse) {
                current.speed = Math.max(-spec.topSpeed * 0.35, current.speed - spec.acceleration * 0.8 * delta);
            }
            else {
                current.speed *= Math.pow(0.9, delta * 60);
            }
            const steer = steerRight - steerLeft;
            if (steer !== 0) {
                const steerScale = Math.min(1.2, Math.max(0.18, Math.abs(current.speed) / 14));
                current.heading += steer * steerScale * delta * (current.speed >= 0 ? -1 : 1);
            }
        }
        else {
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
    return (_jsx("group", { ref: vehicleRef, position: [vehicle.position.x, 0, vehicle.position.y], rotation: [0, -vehicle.heading, 0], children: _jsx(VehicleModel, { color: "#eaab59", accent: "#fff0c4" }) }));
}
function RemoteAvatars({ players }) {
    return (_jsx(_Fragment, { children: players.map((player) => (_jsx("group", { position: [player.position.x, 0, player.position.y], children: _jsx(PlayerModel, { uniformColor: TEAM_COLORS[player.team], wanted: player.wanted }) }, player.id))) }));
}
function CallMarkers({ calls }) {
    return (_jsx(_Fragment, { children: calls.map((call, index) => {
            const point = getLocationPoint(call, index);
            return (_jsxs("group", { position: [point.x, 0, point.y], children: [_jsxs("mesh", { position: [0, 0.6, 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.28, 0.28, 1, 16] }), _jsx("meshStandardMaterial", { color: "#ffdf75", emissive: "#9e6600", emissiveIntensity: 0.45 })] }), _jsxs("mesh", { position: [0, 1.34, 0], children: [_jsx("sphereGeometry", { args: [0.22, 16, 16] }), _jsx("meshStandardMaterial", { color: "#fff5d3", emissive: "#f2be32", emissiveIntensity: 0.8 })] })] }, call.id));
        }) }));
}
function WorldLandmarks() {
    const landmarks = GAME_CONFIG.worldLocations.filter((location) => location.category !== "district");
    return (_jsx(_Fragment, { children: landmarks.map((location) => (_jsxs("group", { position: [location.position.x, 0, location.position.y], children: [_jsxs("mesh", { position: [0, 0.08, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("ringGeometry", { args: [0.7, 1.06, 32] }), _jsx("meshStandardMaterial", { color: location.accent, transparent: true, opacity: 0.75 })] }), _jsxs("mesh", { position: [0, 0.7, 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.35, 0.45, 1.4, 18] }), _jsx("meshStandardMaterial", { color: location.accent, emissive: location.accent, emissiveIntensity: 0.2 })] }), _jsxs("mesh", { position: [0, 1.58, 0], children: [_jsx("boxGeometry", { args: [0.75, 0.36, 0.75] }), _jsx("meshStandardMaterial", { color: "#f5f0de" })] }), _jsx("pointLight", { position: [0, 2.1, 0], color: location.accent, intensity: 0.5, distance: 8 })] }, location.id))) }));
}
function TrafficSignal({ position, rotation = 0 }) {
    return (_jsxs("group", { position: position, rotation: [0, rotation, 0], children: [_jsxs("mesh", { position: [0, 2.6, 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.08, 0.1, 5.2, 10] }), _jsx("meshStandardMaterial", { color: "#4e555d", metalness: 0.52, roughness: 0.42 })] }), _jsxs("mesh", { position: [0.62, 4.85, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [1.24, 0.12, 0.12] }), _jsx("meshStandardMaterial", { color: "#4e555d", metalness: 0.52, roughness: 0.42 })] }), _jsxs("mesh", { position: [1.12, 4.5, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [0.38, 0.92, 0.34] }), _jsx("meshStandardMaterial", { color: "#20262c", roughness: 0.82 })] }), _jsxs("mesh", { position: [1.12, 4.72, 0], children: [_jsx("sphereGeometry", { args: [0.08, 10, 10] }), _jsx("meshStandardMaterial", { color: "#d54e44", emissive: "#c93e34", emissiveIntensity: 1.2 })] }), _jsxs("mesh", { position: [1.12, 4.5, 0], children: [_jsx("sphereGeometry", { args: [0.08, 10, 10] }), _jsx("meshStandardMaterial", { color: "#f4cf6d", emissive: "#c39829", emissiveIntensity: 0.78 })] }), _jsxs("mesh", { position: [1.12, 4.28, 0], children: [_jsx("sphereGeometry", { args: [0.08, 10, 10] }), _jsx("meshStandardMaterial", { color: "#73d27c", emissive: "#43aa53", emissiveIntensity: 0.92 })] })] }));
}
function ParkingLot({ position, size, wetness }) {
    const [width, depth] = size;
    const bayOffsets = Array.from({ length: Math.max(3, Math.floor(width / 3.8)) }, (_, index) => -width / 2 + 2 + index * 3.8);
    return (_jsxs("group", { position: position, children: [_jsxs("mesh", { rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [width, depth] }), _jsx("meshStandardMaterial", { color: "#363c41", roughness: 0.9 - wetness * 0.34, metalness: 0.12 + wetness * 0.24 })] }), _jsxs("mesh", { position: [0, 0.02, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [width * 0.96, depth * 0.96] }), _jsx("meshStandardMaterial", { color: "#d7e3ea", transparent: true, opacity: wetness * 0.12, roughness: 0.08, metalness: 0.56 })] }), bayOffsets.map((offset) => (_jsxs("mesh", { position: [offset, 0.03, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [0.12, depth * 0.82] }), _jsx("meshStandardMaterial", { color: "#d5d7d8", roughness: 0.52 })] }, offset)))] }));
}
function CorporateTower({ lot }) {
    const windowRows = Math.max(4, Math.floor((lot.height - 4) / 2.8));
    const windowColumns = Math.max(2, Math.floor((lot.width - 2) / 2.2));
    const windowWidth = Math.max(0.7, Math.min(1.2, lot.width / (windowColumns + 1.8)));
    const windowHeight = 1.25;
    const horizontalSpacing = lot.width / (windowColumns + 1);
    const verticalSpacing = (lot.height - 4) / Math.max(1, windowRows);
    return (_jsxs("group", { position: [lot.x, 0, lot.z], children: [_jsxs("mesh", { position: [0, lot.height / 2, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [lot.width, lot.height, lot.depth] }), _jsx("meshStandardMaterial", { color: lot.bodyColor, roughness: 0.7, metalness: 0.18 })] }), _jsxs("mesh", { position: [0, lot.height + 0.3, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [lot.width * 0.96, 0.5, lot.depth * 0.96] }), _jsx("meshStandardMaterial", { color: lot.roofColor, roughness: 0.88 })] }), _jsxs("mesh", { position: [0, 0.14, lot.depth / 2 + 0.02], receiveShadow: true, children: [_jsx("boxGeometry", { args: [lot.width * 0.86, 0.28, 1.2] }), _jsx("meshStandardMaterial", { color: "#c7cdd2", roughness: 0.82 })] }), _jsxs("mesh", { position: [0, 1.8, lot.depth / 2 + 0.06], castShadow: true, children: [_jsx("boxGeometry", { args: [1.9, 2.4, 0.18] }), _jsx("meshStandardMaterial", { color: lot.entranceColor, metalness: 0.42, roughness: 0.2 })] }), Array.from({ length: windowRows }, (_, rowIndex) => {
                const y = 3 + rowIndex * verticalSpacing;
                return Array.from({ length: windowColumns }, (_, columnIndex) => {
                    const x = -lot.width / 2 + horizontalSpacing * (columnIndex + 1);
                    return (_jsxs("group", { children: [_jsxs("mesh", { position: [x, y, lot.depth / 2 + 0.08], children: [_jsx("boxGeometry", { args: [windowWidth, windowHeight, 0.14] }), _jsx("meshStandardMaterial", { color: lot.windowColor, emissive: lot.windowColor, emissiveIntensity: 0.16, metalness: 0.35, roughness: 0.18 })] }), _jsxs("mesh", { position: [x, y, -lot.depth / 2 - 0.08], children: [_jsx("boxGeometry", { args: [windowWidth, windowHeight, 0.14] }), _jsx("meshStandardMaterial", { color: lot.windowColor, emissive: lot.windowColor, emissiveIntensity: 0.08, metalness: 0.3, roughness: 0.2 })] })] }, `${lot.x}-${lot.z}-${rowIndex}-${columnIndex}`));
                });
            })] }));
}
function SuburbanHouse({ lot }) {
    return (_jsxs("group", { position: [lot.x, 0, lot.z], children: [_jsxs("mesh", { position: [0, lot.height / 2, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [lot.width, lot.height, lot.depth] }), _jsx("meshStandardMaterial", { color: lot.bodyColor, roughness: 0.9 })] }), _jsxs("mesh", { position: [0, lot.height + 1.4, 0], rotation: [0, Math.PI / 4, 0], castShadow: true, children: [_jsx("coneGeometry", { args: [lot.width * 0.84, 3.3, 4] }), _jsx("meshStandardMaterial", { color: lot.roofColor, roughness: 0.95 })] }), _jsxs("mesh", { position: [0, 1.45, lot.depth / 2 + 0.03], children: [_jsx("boxGeometry", { args: [1.3, 2.1, 0.15] }), _jsx("meshStandardMaterial", { color: lot.trimColor, roughness: 0.55 })] }), _jsxs("mesh", { position: [-lot.width * 0.22, lot.height * 0.65, lot.depth / 2 + 0.05], children: [_jsx("boxGeometry", { args: [1.2, 1, 0.12] }), _jsx("meshStandardMaterial", { color: "#dfe7ef", emissive: "#bdd8ff", emissiveIntensity: 0.12, metalness: 0.2, roughness: 0.22 })] }), _jsxs("mesh", { position: [lot.width * 0.22, lot.height * 0.65, lot.depth / 2 + 0.05], children: [_jsx("boxGeometry", { args: [1.2, 1, 0.12] }), _jsx("meshStandardMaterial", { color: "#dfe7ef", emissive: "#bdd8ff", emissiveIntensity: 0.12, metalness: 0.2, roughness: 0.22 })] }), _jsxs("mesh", { position: [0, 0.06, lot.depth / 2 + 2.1], receiveShadow: true, children: [_jsx("boxGeometry", { args: [lot.width * 0.7, 0.12, 3.2] }), _jsx("meshStandardMaterial", { color: "#b8b0a4", roughness: 0.92 })] })] }));
}
function IndustrialWarehouse({ lot }) {
    return (_jsxs("group", { position: [lot.x, 0, lot.z], children: [_jsxs("mesh", { position: [0, lot.height / 2, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [lot.width, lot.height, lot.depth] }), _jsx("meshStandardMaterial", { color: lot.bodyColor, roughness: 0.82, metalness: 0.08 })] }), _jsxs("mesh", { position: [0, lot.height + 0.45, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [lot.width * 1.02, 0.5, lot.depth * 1.02] }), _jsx("meshStandardMaterial", { color: lot.roofColor, roughness: 0.8 })] }), _jsxs("mesh", { position: [0, 2.2, lot.depth / 2 + 0.05], children: [_jsx("boxGeometry", { args: [lot.width * 0.46, 3.4, 0.14] }), _jsx("meshStandardMaterial", { color: lot.accentColor, metalness: 0.18, roughness: 0.4 })] }), _jsxs("mesh", { position: [-lot.width * 0.3, 3.8, lot.depth / 2 + 0.06], children: [_jsx("boxGeometry", { args: [2.2, 1.4, 0.12] }), _jsx("meshStandardMaterial", { color: "#d7e6ee", emissive: "#9cc7db", emissiveIntensity: 0.1, roughness: 0.22, metalness: 0.24 })] }), _jsxs("mesh", { position: [lot.width * 0.3, 3.8, lot.depth / 2 + 0.06], children: [_jsx("boxGeometry", { args: [2.2, 1.4, 0.12] }), _jsx("meshStandardMaterial", { color: "#d7e6ee", emissive: "#9cc7db", emissiveIntensity: 0.1, roughness: 0.22, metalness: 0.24 })] })] }));
}
function RoadMesh({ segment, wetness }) {
    const laneMarks = segment.orientation === "horizontal"
        ? Array.from({ length: Math.max(3, Math.floor(segment.width / 12)) }, (_, index) => -segment.width / 2 + 6 + index * 12)
        : Array.from({ length: Math.max(3, Math.floor(segment.depth / 12)) }, (_, index) => -segment.depth / 2 + 6 + index * 12);
    return (_jsxs("group", { position: [segment.x, 0, segment.z], children: [_jsxs("mesh", { position: [0, 0.02, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [segment.width, segment.depth] }), _jsx("meshStandardMaterial", { color: "#2d3237", roughness: 0.92 - wetness * 0.42, metalness: 0.08 + wetness * 0.3 })] }), _jsxs("mesh", { position: [0, 0.021, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [segment.width * 0.98, segment.depth * 0.98] }), _jsx("meshStandardMaterial", { color: "#cad5dc", transparent: true, opacity: wetness * 0.14, roughness: 0.06, metalness: 0.62 })] }), laneMarks.map((offset) => (_jsxs("mesh", { position: segment.orientation === "horizontal" ? [offset, 0.03, 0] : [0, 0.03, offset], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: segment.orientation === "horizontal" ? [4.5, 0.36] : [0.36, 4.5] }), _jsx("meshStandardMaterial", { color: "#f3df9d", roughness: 0.7 })] }, `${segment.key}-${offset}`))), segment.orientation === "horizontal" ? (_jsxs(_Fragment, { children: [_jsxs("mesh", { position: [0, 0.031, -segment.depth / 2 + 0.6], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [segment.width, 0.22] }), _jsx("meshStandardMaterial", { color: "#d8dbde", roughness: 0.55 })] }), _jsxs("mesh", { position: [0, 0.031, segment.depth / 2 - 0.6], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [segment.width, 0.22] }), _jsx("meshStandardMaterial", { color: "#d8dbde", roughness: 0.55 })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("mesh", { position: [-segment.width / 2 + 0.6, 0.031, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [0.22, segment.depth] }), _jsx("meshStandardMaterial", { color: "#d8dbde", roughness: 0.55 })] }), _jsxs("mesh", { position: [segment.width / 2 - 0.6, 0.031, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [0.22, segment.depth] }), _jsx("meshStandardMaterial", { color: "#d8dbde", roughness: 0.55 })] })] }))] }));
}
function Sidewalk({ strip, wetness }) {
    return (_jsxs("group", { position: [strip.x, 0.05, strip.z], children: [_jsxs("mesh", { rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [strip.width, strip.depth] }), _jsx("meshStandardMaterial", { color: "#b7b4ac", roughness: 0.9 - wetness * 0.24, metalness: 0.04 + wetness * 0.18 })] }), _jsxs("mesh", { position: [0, 0.015, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [strip.width * 0.96, strip.depth * 0.96] }), _jsx("meshStandardMaterial", { color: "#eef3f7", transparent: true, opacity: wetness * 0.07, roughness: 0.14, metalness: 0.36 })] })] }));
}
function StreetLight({ point }) {
    return (_jsxs("group", { position: [point.x, 0, point.z], rotation: [0, point.rotation ?? 0, 0], children: [_jsxs("mesh", { position: [0, 2.9, 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.08, 0.11, 5.8, 10] }), _jsx("meshStandardMaterial", { color: "#545a60", metalness: 0.48, roughness: 0.48 })] }), _jsxs("mesh", { position: [0.55, 5.6, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [1.1, 0.12, 0.12] }), _jsx("meshStandardMaterial", { color: "#545a60", metalness: 0.48, roughness: 0.48 })] }), _jsxs("mesh", { position: [1.05, 5.3, 0], children: [_jsx("boxGeometry", { args: [0.34, 0.24, 0.28] }), _jsx("meshStandardMaterial", { color: "#f3dfb2", emissive: "#ffd37c", emissiveIntensity: 0.9, roughness: 0.28 })] }), _jsx("pointLight", { position: [1.05, 5.1, 0], intensity: 0.5, distance: 18, color: "#ffd89a" })] }));
}
function FirTree({ lot }) {
    return (_jsxs("group", { position: [lot.x, 0, lot.z], scale: lot.scale, children: [_jsxs("mesh", { position: [0, 1.5, 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.24, 0.34, 3, 10] }), _jsx("meshStandardMaterial", { color: "#6b4a35", roughness: 0.94 })] }), _jsxs("mesh", { position: [0, 3.1, 0], castShadow: true, children: [_jsx("coneGeometry", { args: [1.5, 3.2, 8] }), _jsx("meshStandardMaterial", { color: "#4b7a49", roughness: 0.96 })] }), _jsxs("mesh", { position: [0, 4.3, 0], castShadow: true, children: [_jsx("coneGeometry", { args: [1.1, 2.5, 8] }), _jsx("meshStandardMaterial", { color: "#3f6a3f", roughness: 0.96 })] })] }));
}
function WorldStage({ profile, suppressClouds = false }) {
    const downtownBuildings = useMemo(() => [
        { x: -20, z: -23, width: 11, depth: 10, height: 24, bodyColor: "#5d6d7d", windowColor: "#d8eef9", roofColor: "#414e5a", entranceColor: "#9cbbc8" },
        { x: -6, z: -24, width: 9, depth: 9, height: 18, bodyColor: "#7d6b60", windowColor: "#f2e5c6", roofColor: "#594b42", entranceColor: "#b7917b" },
        { x: 10, z: -20, width: 12, depth: 10, height: 28, bodyColor: "#50697b", windowColor: "#cae6f6", roofColor: "#425565", entranceColor: "#8db0c0" },
        { x: 25, z: -19, width: 11, depth: 9, height: 22, bodyColor: "#76665b", windowColor: "#f0dec3", roofColor: "#5b5049", entranceColor: "#b38872" },
        { x: -16, z: -5, width: 10, depth: 10, height: 19, bodyColor: "#566a79", windowColor: "#d9eef8", roofColor: "#46525b", entranceColor: "#9eb7c5" },
        { x: 2, z: -2, width: 14, depth: 14, height: 25, bodyColor: "#708595", windowColor: "#d7eef9", roofColor: "#576673", entranceColor: "#9cb6c4" },
        { x: 21, z: 3, width: 12, depth: 10, height: 18, bodyColor: "#7a6958", windowColor: "#f1e3cd", roofColor: "#5d5146", entranceColor: "#ba977d" },
    ], []);
    const residentialBlocks = useMemo(() => [
        { x: -44, z: 24, width: 9, depth: 7, height: 5, bodyColor: "#d1b38f", roofColor: "#7d5647", trimColor: "#7c4f3c" },
        { x: -32, z: 30, width: 8, depth: 7, height: 5, bodyColor: "#b99872", roofColor: "#69463d", trimColor: "#7b5947" },
        { x: -20, z: 23, width: 9, depth: 7, height: 5, bodyColor: "#c3a17d", roofColor: "#744c43", trimColor: "#76503d" },
        { x: -36, z: 14, width: 8, depth: 7, height: 5, bodyColor: "#b88d6e", roofColor: "#6d433a", trimColor: "#744d3f" },
        { x: -24, z: 12, width: 9, depth: 8, height: 5, bodyColor: "#d0ae89", roofColor: "#7a5144", trimColor: "#815b49" },
    ], []);
    const industrialBlocks = useMemo(() => [
        { x: 30, z: 30, width: 15, depth: 12, height: 8, bodyColor: "#6c665f", roofColor: "#50565b", accentColor: "#a98d5b" },
        { x: 46, z: 28, width: 12, depth: 12, height: 9, bodyColor: "#5b666d", roofColor: "#4d555a", accentColor: "#8da3af" },
        { x: 34, z: 16, width: 16, depth: 10, height: 7, bodyColor: "#766c61", roofColor: "#5f5850", accentColor: "#bf8c52" },
        { x: 48, z: 12, width: 10, depth: 10, height: 11, bodyColor: "#6b7079", roofColor: "#4d545d", accentColor: "#8aa0b5" },
    ], []);
    const treePositions = useMemo(() => [
        { x: -52, z: 38, scale: 1.05 }, { x: -46, z: 34, scale: 0.95 }, { x: -40, z: 8, scale: 0.88 }, { x: -34, z: 4, scale: 0.84 }, { x: -30, z: 36, scale: 1.1 },
        { x: -24, z: 34, scale: 1 }, { x: -18, z: 10, scale: 0.85 }, { x: 38, z: -34, scale: 1 }, { x: 44, z: -28, scale: 0.93 }, { x: 48, z: -18, scale: 1.08 },
        { x: 52, z: -10, scale: 1.16 }, { x: 52, z: 2, scale: 1 }, { x: 54, z: 16, scale: 0.9 }, { x: 18, z: 38, scale: 0.88 }, { x: 8, z: 42, scale: 0.95 },
        { x: -4, z: 40, scale: 0.86 }, { x: -16, z: 40, scale: 0.98 }, { x: 30, z: 40, scale: 0.92 }, { x: 42, z: 38, scale: 1.04 }, { x: -50, z: -22, scale: 1.1 },
    ], []);
    const roads = useMemo(() => [
        { key: "main-north-south", x: 0, z: 0, width: 18, depth: 150, orientation: "vertical" },
        { key: "main-east-west", x: 0, z: 0, width: 150, depth: 18, orientation: "horizontal" },
        { key: "west-residential", x: -33, z: 22, width: 44, depth: 12, orientation: "horizontal" },
        { key: "east-industrial", x: 40, z: 24, width: 38, depth: 12, orientation: "horizontal" },
        { key: "south-frontage", x: 12, z: -26, width: 74, depth: 12, orientation: "horizontal" },
    ], []);
    const sidewalks = useMemo(() => [
        { key: "core-west", x: -11.3, z: 0, width: 3.2, depth: 150 },
        { key: "core-east", x: 11.3, z: 0, width: 3.2, depth: 150 },
        { key: "cross-north", x: 0, z: -11.3, width: 150, depth: 3.2 },
        { key: "cross-south", x: 0, z: 11.3, width: 150, depth: 3.2 },
        { key: "west-top", x: -33, z: 28.5, width: 44, depth: 2.8 },
        { key: "west-bottom", x: -33, z: 15.5, width: 44, depth: 2.8 },
        { key: "east-top", x: 40, z: 30.5, width: 38, depth: 2.8 },
        { key: "east-bottom", x: 40, z: 17.5, width: 38, depth: 2.8 },
    ], []);
    const streetLights = useMemo(() => [
        { x: -12.8, z: -48 }, { x: 12.8, z: -48, rotation: Math.PI },
        { x: -12.8, z: -20 }, { x: 12.8, z: -20, rotation: Math.PI },
        { x: -12.8, z: 8 }, { x: 12.8, z: 8, rotation: Math.PI },
        { x: -12.8, z: 36 }, { x: 12.8, z: 36, rotation: Math.PI },
        { x: -44, z: 18, rotation: Math.PI / 2 }, { x: -22, z: 18, rotation: -Math.PI / 2 },
        { x: 26, z: 20, rotation: Math.PI / 2 }, { x: 52, z: 20, rotation: -Math.PI / 2 },
    ], []);
    const trafficSignals = useMemo(() => [
        { position: [-9.5, 0, -9.5], rotation: 0 },
        { position: [9.5, 0, -9.5], rotation: Math.PI / 2 },
        { position: [-9.5, 0, 9.5], rotation: -Math.PI / 2 },
        { position: [9.5, 0, 9.5], rotation: Math.PI },
    ], []);
    const verticalMarkers = useMemo(() => Array.from({ length: 14 }, (_, index) => -52 + index * 8), []);
    const horizontalMarkers = useMemo(() => Array.from({ length: 14 }, (_, index) => -52 + index * 8), []);
    return (_jsxs(_Fragment, { children: [_jsx("color", { attach: "background", args: [new Color(profile.background)] }), _jsx("fog", { attach: "fog", args: [profile.fog, profile.fogNear, profile.fogFar] }), _jsx(Sky, { distance: 450000, turbidity: profile.skyTurbidity, rayleigh: profile.skyRayleigh, mieCoefficient: profile.skyMieCoefficient, mieDirectionalG: profile.skyMieDirectionalG, sunPosition: profile.sunPosition, inclination: 0.47, azimuth: 0.18 }), _jsx("ambientLight", { intensity: profile.ambientIntensity }), _jsx("hemisphereLight", { args: [profile.hemisphereSky, profile.hemisphereGround, profile.hemisphereIntensity] }), _jsx("directionalLight", { position: profile.sunPosition, intensity: profile.sunIntensity, color: profile.sunColor, castShadow: true, "shadow-mapSize-width": 2048, "shadow-mapSize-height": 2048, "shadow-bias": -0.00012 }), _jsx("directionalLight", { position: [-18, 12, 28], intensity: profile.fillIntensity, color: profile.fillColor }), suppressClouds ? null : _jsx(WeatherCloudLayer, { density: profile.cloudDensity }), _jsxs("mesh", { position: [54, -0.08, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [36, 180] }), _jsx("meshStandardMaterial", { color: profile.waterColor, metalness: 0.36, roughness: 0.12 })] }), _jsxs("mesh", { position: [54, 0.03, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [34, 178] }), _jsx("meshStandardMaterial", { color: profile.waterHighlight, transparent: true, opacity: 0.16 + profile.wetness * 0.08, metalness: 0.48, roughness: 0.06 })] }), _jsxs("mesh", { position: [45, -0.03, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [12, 180] }), _jsx("meshStandardMaterial", { color: "#d8c6a2", roughness: 0.98 })] }), _jsxs("mesh", { rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [180, 180] }), _jsx("meshStandardMaterial", { color: profile.grassColor, roughness: 0.95 })] }), _jsxs("mesh", { position: [0, 0.01, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [180, 180] }), _jsx("meshStandardMaterial", { color: "#8caf72", transparent: true, opacity: 0.08 })] }), _jsxs("mesh", { position: [-35, 0.01, 24], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [28, 18] }), _jsx("meshStandardMaterial", { color: "#7ba06e", roughness: 0.98 })] }), _jsxs("mesh", { position: [38, 0.01, 23], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [36, 24] }), _jsx("meshStandardMaterial", { color: "#857560", roughness: 0.98 })] }), _jsx(ParkingLot, { position: [-34, 0.05, 22], size: [22, 18], wetness: profile.wetness }), _jsx(ParkingLot, { position: [37.5, 0.05, 24], size: [24, 18], wetness: profile.wetness }), roads.map((segment) => (_jsx(RoadMesh, { segment: segment, wetness: profile.wetness }, segment.key))), sidewalks.map((strip) => (_jsx(Sidewalk, { strip: strip, wetness: profile.wetness }, strip.key))), verticalMarkers.map((z) => (_jsxs("mesh", { position: [0, 0.03, z], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [0.45, 4.2] }), _jsx("meshStandardMaterial", { color: "#f3e3a8" })] }, `v-${z}`))), horizontalMarkers.map((x) => (_jsxs("mesh", { position: [x, 0.03, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [4.2, 0.45] }), _jsx("meshStandardMaterial", { color: "#f3e3a8" })] }, `h-${x}`))), _jsxs("mesh", { position: [0, 0.03, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("ringGeometry", { args: [6.5, 8.5, 48] }), _jsx("meshStandardMaterial", { color: "#d9dee3", roughness: 0.48 })] }), _jsxs("mesh", { position: [0, 0.031, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("ringGeometry", { args: [5.4, 5.9, 40] }), _jsx("meshStandardMaterial", { color: "#f0f1ef", roughness: 0.42 })] }), _jsxs("mesh", { position: [-16, 0.05, -12], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("circleGeometry", { args: [5.2, 32] }), _jsx("meshStandardMaterial", { color: "#2758b9", transparent: true, opacity: 0.82 })] }), _jsxs("mesh", { position: [14, 0.05, -12], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("circleGeometry", { args: [5.2, 32] }), _jsx("meshStandardMaterial", { color: "#b94439", transparent: true, opacity: 0.84 })] }), _jsxs("mesh", { position: [30, 0.05, 16], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("circleGeometry", { args: [5.2, 32] }), _jsx("meshStandardMaterial", { color: "#c89424", transparent: true, opacity: 0.84 })] }), _jsxs("mesh", { position: [-34, 0.04, 22], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [24, 22] }), _jsx("meshStandardMaterial", { color: "#7ca36f", transparent: true, opacity: 0.48 })] }), _jsxs("mesh", { position: [38, 0.04, 24], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [28, 22] }), _jsx("meshStandardMaterial", { color: "#8a7866", transparent: true, opacity: 0.36 })] }), _jsxs("mesh", { position: [0, 0.04, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [36, 36] }), _jsx("meshStandardMaterial", { color: "#b5b0a8", transparent: true, opacity: 0.55, roughness: 0.9 })] }), _jsxs("mesh", { position: [46.5, 0.06, 6], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("planeGeometry", { args: [4.5, 26] }), _jsx("meshStandardMaterial", { color: "#d4d8db", roughness: 0.58 })] }), trafficSignals.map((signal, index) => (_jsx(TrafficSignal, { position: signal.position, rotation: signal.rotation }, `signal-${index}`))), downtownBuildings.map((lot, index) => (_jsx(CorporateTower, { lot: lot }, `downtown-${index}`))), residentialBlocks.map((lot, index) => (_jsx(SuburbanHouse, { lot: lot }, `residential-${index}`))), industrialBlocks.map((lot, index) => (_jsx(IndustrialWarehouse, { lot: lot }, `industrial-${index}`))), treePositions.map((lot, index) => (_jsx(FirTree, { lot: lot }, `tree-${index}`))), streetLights.map((point, index) => (_jsx(StreetLight, { point: point }, `light-${index}`)))] }));
}
function SceneReadyBeacon({ onReady }) {
    useEffect(() => {
        onReady?.();
    }, [onReady]);
    return null;
}
export default function GameScene({ me, players, calls, vehicles, onMove, onDriveVehicle, cameraRigRef, onEngageCamera, sceneProfile, onReady, graphicsPreset = "full", onContextLoss, }) {
    const remotePlayers = me ? players.filter((player) => player.id !== me.id) : players;
    const localVehicle = me?.activeVehicleEntityId ? vehicles.find((vehicle) => vehicle.id === me.activeVehicleEntityId && vehicle.occupantPlayerId === me.id) : undefined;
    const remoteVehicles = localVehicle ? vehicles.filter((vehicle) => vehicle.id !== localVehicle.id) : vehicles;
    const stableGraphics = graphicsPreset === "stable";
    const balancedGraphics = graphicsPreset === "balanced";
    const dpr = stableGraphics ? [0.7, 1] : balancedGraphics ? [0.8, 1.08] : [0.9, 1.35];
    const contactShadowResolution = balancedGraphics ? 256 : 512;
    return (_jsxs(Canvas, { className: "world-canvas", dpr: dpr, shadows: { type: PCFShadowMap }, gl: { antialias: !stableGraphics, toneMapping: ACESFilmicToneMapping, powerPreference: stableGraphics ? "default" : "high-performance" }, camera: { position: [10, 10, 10], fov: 48 }, onPointerDown: onEngageCamera, onCreated: ({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", (event) => {
                event.preventDefault();
                onContextLoss?.();
            }, { once: true });
        }, children: [_jsx(SceneReadyBeacon, { onReady: onReady }), _jsx(AdaptiveEvents, {}), _jsx(AdaptiveDpr, { pixelated: true }), _jsx(WorldStage, { profile: sceneProfile, suppressClouds: true }), stableGraphics ? null : _jsx(ContactShadows, { position: [0, 0.01, 0], opacity: 0.2 + sceneProfile.wetness * 0.1, scale: 156, blur: balancedGraphics ? 1.6 : 2.1, far: 46, resolution: contactShadowResolution, color: "#000000" }), _jsx(WorldLandmarks, {}), _jsx(CallMarkers, { calls: calls }), _jsx(ActiveVehicles, { vehicles: remoteVehicles }), _jsx(RemoteAvatars, { players: remotePlayers }), localVehicle ? _jsx(LocalVehicle, { vehicle: localVehicle, onDrive: (nextState) => onDriveVehicle(localVehicle.id, nextState), cameraRigRef: cameraRigRef }) : me ? _jsx(LocalAvatar, { player: me, onMove: onMove, cameraRigRef: cameraRigRef }) : null, stableGraphics ? null : balancedGraphics ? _jsx(ScenePostProcessingBalanced, { wetness: sceneProfile.wetness }) : _jsx(ScenePostProcessing, { wetness: sceneProfile.wetness })] }));
}
