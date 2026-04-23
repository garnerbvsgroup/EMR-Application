import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Cloud, useGLTF } from "@react-three/drei";
import { MathUtils } from "three";
const IDLE_MOTION = {
    locomotion: "idle",
    pace: 0,
    strafe: 0,
    crouching: false,
    acting: false,
};
function useModelAvailability(path) {
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
function ImportedSceneModel({ path, scale, rotation, position, }) {
    const { scene } = useGLTF(path);
    const clonedScene = useRef(null);
    if (!clonedScene.current) {
        clonedScene.current = scene.clone(true);
        clonedScene.current.traverse((child) => {
            child.castShadow = true;
            child.receiveShadow = true;
        });
    }
    return _jsx("primitive", { object: clonedScene.current, scale: scale, rotation: rotation, position: position });
}
export function VehicleModel({ color, accent }) {
    const importedVehicleAvailable = useModelAvailability("/models/vehicle.glb");
    if (importedVehicleAvailable) {
        return (_jsx(Suspense, { fallback: null, children: _jsx(ImportedSceneModel, { path: "/models/vehicle.glb", scale: 1.15, rotation: [0, Math.PI, 0], position: [0, 0, 0] }) }));
    }
    return (_jsxs("group", { children: [_jsxs("mesh", { position: [0, 0.42, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [2.95, 0.32, 1.54] }), _jsx("meshStandardMaterial", { color: "#1f2329", metalness: 0.58, roughness: 0.5 })] }), _jsxs("mesh", { position: [0, 0.78, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [2.7, 0.58, 1.46] }), _jsx("meshStandardMaterial", { color: color, metalness: 0.34, roughness: 0.42 })] }), _jsxs("mesh", { position: [0.12, 1.16, 0], castShadow: true, receiveShadow: true, children: [_jsx("boxGeometry", { args: [1.72, 0.42, 1.24] }), _jsx("meshStandardMaterial", { color: "#d7e3f3", metalness: 0.18, roughness: 0.14, transparent: true, opacity: 0.92 })] }), _jsxs("mesh", { position: [1.18, 0.78, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [0.48, 0.34, 1.28] }), _jsx("meshStandardMaterial", { color: color, metalness: 0.28, roughness: 0.38 })] }), _jsxs("mesh", { position: [-1.24, 0.75, 0], castShadow: true, children: [_jsx("boxGeometry", { args: [0.34, 0.24, 1.16] }), _jsx("meshStandardMaterial", { color: "#cfd5dc", metalness: 0.32, roughness: 0.36 })] }), _jsxs("mesh", { position: [1.46, 0.68, 0.45], children: [_jsx("boxGeometry", { args: [0.12, 0.12, 0.34] }), _jsx("meshStandardMaterial", { color: accent, emissive: accent, emissiveIntensity: 0.65 })] }), _jsxs("mesh", { position: [1.46, 0.68, -0.45], children: [_jsx("boxGeometry", { args: [0.12, 0.12, 0.34] }), _jsx("meshStandardMaterial", { color: accent, emissive: accent, emissiveIntensity: 0.65 })] }), _jsxs("mesh", { position: [-1.48, 0.64, 0.46], children: [_jsx("boxGeometry", { args: [0.1, 0.1, 0.28] }), _jsx("meshStandardMaterial", { color: "#ff6961", emissive: "#d43f2a", emissiveIntensity: 0.82 })] }), _jsxs("mesh", { position: [-1.48, 0.64, -0.46], children: [_jsx("boxGeometry", { args: [0.1, 0.1, 0.28] }), _jsx("meshStandardMaterial", { color: "#ff6961", emissive: "#d43f2a", emissiveIntensity: 0.82 })] }), [
                [-0.95, 0.22, 0.72],
                [0.95, 0.22, 0.72],
                [-0.95, 0.22, -0.72],
                [0.95, 0.22, -0.72],
            ].map((position, index) => (_jsxs("group", { position: position, castShadow: true, children: [_jsxs("mesh", { rotation: [Math.PI / 2, 0, 0], castShadow: true, children: [_jsx("cylinderGeometry", { args: [0.3, 0.3, 0.26, 20] }), _jsx("meshStandardMaterial", { color: "#181a1d", roughness: 0.95 })] }), _jsxs("mesh", { rotation: [Math.PI / 2, 0, 0], children: [_jsx("cylinderGeometry", { args: [0.17, 0.17, 0.28, 16] }), _jsx("meshStandardMaterial", { color: "#9aa5af", metalness: 0.85, roughness: 0.2 })] })] }, `wheel-${index}`))), _jsxs("mesh", { position: [0.2, 1.48, 0], children: [_jsx("boxGeometry", { args: [0.82, 0.08, 1.16] }), _jsx("meshStandardMaterial", { color: "#111820", metalness: 0.48, roughness: 0.18 })] })] }));
}
export function PlayerModel({ uniformColor, wanted = 0, motionRef, }) {
    const importedPlayerAvailable = useModelAvailability("/models/player.glb");
    const rootRef = useRef(null);
    const chestRef = useRef(null);
    const leftArmRef = useRef(null);
    const rightArmRef = useRef(null);
    const leftLegRef = useRef(null);
    const rightLegRef = useRef(null);
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
        return (_jsxs("group", { ref: rootRef, children: [_jsx(Suspense, { fallback: null, children: _jsx(ImportedSceneModel, { path: "/models/player.glb", scale: 1.7, position: [0, 0, 0] }) }), wanted > 0 ? (_jsxs("mesh", { position: [0, 2.45, 0], children: [_jsx("sphereGeometry", { args: [0.14, 14, 14] }), _jsx("meshStandardMaterial", { color: "#ff8d66", emissive: "#c1421f", emissiveIntensity: 0.9 })] })) : null] }));
    }
    return (_jsxs("group", { ref: rootRef, children: [_jsxs("mesh", { position: [0, 1.74, 0], castShadow: true, children: [_jsx("sphereGeometry", { args: [0.24, 20, 20] }), _jsx("meshStandardMaterial", { color: "#efcfb0", roughness: 0.92 })] }), _jsxs("mesh", { position: [0, 2.02, 0], castShadow: true, children: [_jsx("capsuleGeometry", { args: [0.14, 0.16, 8, 12] }), _jsx("meshStandardMaterial", { color: "#3e2f28", roughness: 0.88 })] }), _jsxs("group", { ref: chestRef, position: [0, 1.1, 0], children: [_jsxs("mesh", { castShadow: true, children: [_jsx("capsuleGeometry", { args: [0.3, 0.92, 8, 14] }), _jsx("meshStandardMaterial", { color: uniformColor, metalness: 0.06, roughness: 0.62 })] }), _jsxs("mesh", { position: [0, 0.02, 0.19], castShadow: true, children: [_jsx("boxGeometry", { args: [0.46, 0.46, 0.14] }), _jsx("meshStandardMaterial", { color: "#efe3c9", roughness: 0.58 })] }), _jsxs("mesh", { position: [0, 0.1, -0.16], castShadow: true, children: [_jsx("boxGeometry", { args: [0.34, 0.36, 0.12] }), _jsx("meshStandardMaterial", { color: "#1e2328", metalness: 0.24, roughness: 0.46 })] })] }), _jsxs("group", { ref: leftArmRef, position: [-0.38, 1.36, 0], children: [_jsxs("mesh", { position: [0, -0.34, 0], castShadow: true, children: [_jsx("capsuleGeometry", { args: [0.095, 0.72, 6, 10] }), _jsx("meshStandardMaterial", { color: uniformColor, roughness: 0.66 })] }), _jsxs("mesh", { position: [0, -0.74, 0.02], castShadow: true, children: [_jsx("sphereGeometry", { args: [0.09, 12, 12] }), _jsx("meshStandardMaterial", { color: "#efcfb0", roughness: 0.9 })] })] }), _jsxs("group", { ref: rightArmRef, position: [0.38, 1.36, 0], children: [_jsxs("mesh", { position: [0, -0.34, 0], castShadow: true, children: [_jsx("capsuleGeometry", { args: [0.095, 0.72, 6, 10] }), _jsx("meshStandardMaterial", { color: uniformColor, roughness: 0.66 })] }), _jsxs("mesh", { position: [0, -0.74, 0.02], castShadow: true, children: [_jsx("sphereGeometry", { args: [0.09, 12, 12] }), _jsx("meshStandardMaterial", { color: "#efcfb0", roughness: 0.9 })] })] }), _jsxs("group", { ref: leftLegRef, position: [-0.16, 0.82, 0], children: [_jsxs("mesh", { position: [0, -0.46, 0], castShadow: true, children: [_jsx("capsuleGeometry", { args: [0.11, 0.84, 6, 10] }), _jsx("meshStandardMaterial", { color: "#22262c", roughness: 0.82 })] }), _jsxs("mesh", { position: [0, -0.96, 0.09], castShadow: true, children: [_jsx("boxGeometry", { args: [0.18, 0.1, 0.34] }), _jsx("meshStandardMaterial", { color: "#11161c", roughness: 0.88 })] })] }), _jsxs("group", { ref: rightLegRef, position: [0.16, 0.82, 0], children: [_jsxs("mesh", { position: [0, -0.46, 0], castShadow: true, children: [_jsx("capsuleGeometry", { args: [0.11, 0.84, 6, 10] }), _jsx("meshStandardMaterial", { color: "#22262c", roughness: 0.82 })] }), _jsxs("mesh", { position: [0, -0.96, 0.09], castShadow: true, children: [_jsx("boxGeometry", { args: [0.18, 0.1, 0.34] }), _jsx("meshStandardMaterial", { color: "#11161c", roughness: 0.88 })] })] }), _jsxs("mesh", { position: [0, 2.2, 0], children: [_jsx("boxGeometry", { args: [0.78, 0.08, 0.78] }), _jsx("meshStandardMaterial", { color: "#f3eee2", emissive: uniformColor, emissiveIntensity: 0.12, roughness: 0.34 })] }), wanted > 0 ? (_jsxs("mesh", { position: [0, 2.45, 0], children: [_jsx("sphereGeometry", { args: [0.14, 14, 14] }), _jsx("meshStandardMaterial", { color: "#ff8d66", emissive: "#c1421f", emissiveIntensity: 0.9 })] })) : null] }));
}
export function WeatherCloudLayer({ density = 0.3 }) {
    return (_jsxs(_Fragment, { children: [_jsx(Cloud, { position: [-42, 24, -56], opacity: 0.1 + density * 0.14, speed: 0.08, bounds: [28, 10, 10], segments: 20, color: "#f9fbff" }), _jsx(Cloud, { position: [8, 22, -42], opacity: 0.08 + density * 0.14, speed: 0.06, bounds: [24, 10, 10], segments: 18, color: "#ffffff" }), _jsx(Cloud, { position: [44, 18, -20], opacity: 0.06 + density * 0.12, speed: 0.05, bounds: [20, 8, 8], segments: 16, color: "#f4f8ff" })] }));
}
export function WetSurfaceOverlay({ children }) {
    return _jsx(_Fragment, { children: children });
}
