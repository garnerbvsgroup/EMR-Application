import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Component, lazy, Suspense, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { GAME_CONFIG, } from "@redwood/shared";
const GameScene = lazy(() => import("./GameScene"));
class SceneBoundary extends Component {
    state = { hasError: false };
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, _errorInfo) {
        this.props.onError(error.message || "The city scene failed to start.");
    }
    render() {
        if (this.state.hasError) {
            return null;
        }
        return this.props.children;
    }
}
function resolveServerUrl() {
    if (import.meta.env.VITE_SERVER_URL) {
        return import.meta.env.VITE_SERVER_URL;
    }
    if (typeof window === "undefined") {
        return "http://localhost:3001";
    }
    if (window.location.port === "5173") {
        return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
    return window.location.origin;
}
const SERVER_URL = resolveServerUrl();
const TEAM_COLORS = {
    Civilian: "#f0d6b2",
    CityPolice: "#4d7cff",
    StatePatrol: "#79a7ff",
    FireRescue: "#d86152",
    PublicWorks: "#d29c3b",
};
const TEAM_SUMMARY = {
    Civilian: "Build money through jobs, buy assets, and navigate the city economy.",
    CityPolice: "Handle local enforcement, active calls, and suspect management across downtown districts.",
    StatePatrol: "Run traffic enforcement, roadway visibility, and wider-map patrol coverage.",
    FireRescue: "Respond to rescue scenes and support emergency stabilization loops.",
    PublicWorks: "Maintain roadway coverage and support service logistics across the city.",
};
const GRAPHICS_STORAGE_KEY = "garner.graphicsPreset";
const SCENE_PROFILES = [
    {
        label: "Golden Hour",
        background: "#c9b089",
        fog: "#d0b190",
        fogNear: 30,
        fogFar: 170,
        sunPosition: [20, 13, -8],
        sunIntensity: 2.15,
        sunColor: "#ffd4a2",
        fillColor: "#95b9ff",
        fillIntensity: 0.28,
        ambientIntensity: 0.75,
        hemisphereSky: "#ffe3c0",
        hemisphereGround: "#665545",
        hemisphereIntensity: 0.72,
        skyTurbidity: 8.4,
        skyRayleigh: 1.5,
        skyMieCoefficient: 0.028,
        skyMieDirectionalG: 0.82,
        wetness: 0.42,
        cloudDensity: 0.46,
        waterColor: "#699dbd",
        waterHighlight: "#c8e2ef",
        grassColor: "#789c66",
    },
    {
        label: "Clear Noon",
        background: "#89adcb",
        fog: "#94afc3",
        fogNear: 28,
        fogFar: 182,
        sunPosition: [30, 22, -12],
        sunIntensity: 2.55,
        sunColor: "#fff1d8",
        fillColor: "#9dc4ff",
        fillIntensity: 0.38,
        ambientIntensity: 0.88,
        hemisphereSky: "#d5e8ff",
        hemisphereGround: "#56614c",
        hemisphereIntensity: 0.84,
        skyTurbidity: 7.1,
        skyRayleigh: 1.7,
        skyMieCoefficient: 0.022,
        skyMieDirectionalG: 0.84,
        wetness: 0.2,
        cloudDensity: 0.22,
        waterColor: "#6aa6c6",
        waterHighlight: "#bfe0ee",
        grassColor: "#739e66",
    },
    {
        label: "Storm Front",
        background: "#5b6771",
        fog: "#707a84",
        fogNear: 22,
        fogFar: 148,
        sunPosition: [10, 10, -4],
        sunIntensity: 1.2,
        sunColor: "#dfe7f2",
        fillColor: "#84a5c8",
        fillIntensity: 0.26,
        ambientIntensity: 0.62,
        hemisphereSky: "#a9b8c6",
        hemisphereGround: "#4e564a",
        hemisphereIntensity: 0.68,
        skyTurbidity: 12,
        skyRayleigh: 0.9,
        skyMieCoefficient: 0.05,
        skyMieDirectionalG: 0.9,
        wetness: 0.92,
        cloudDensity: 0.95,
        waterColor: "#567f98",
        waterHighlight: "#d7e6ef",
        grassColor: "#647c5e",
    },
    {
        label: "Blue Hour",
        background: "#51637a",
        fog: "#62778f",
        fogNear: 24,
        fogFar: 156,
        sunPosition: [-18, 9, 24],
        sunIntensity: 1.32,
        sunColor: "#ffd2b5",
        fillColor: "#86adff",
        fillIntensity: 0.52,
        ambientIntensity: 0.64,
        hemisphereSky: "#b9d1ff",
        hemisphereGround: "#434f45",
        hemisphereIntensity: 0.8,
        skyTurbidity: 9.8,
        skyRayleigh: 1.15,
        skyMieCoefficient: 0.035,
        skyMieDirectionalG: 0.86,
        wetness: 0.55,
        cloudDensity: 0.58,
        waterColor: "#6288a7",
        waterHighlight: "#c5d9e7",
        grassColor: "#6b8a60",
    },
];
const SCENE_CYCLE = [
    { profileIndex: 0, durationMs: 120000, period: "day" },
    { profileIndex: 1, durationMs: 240000, period: "day" },
    { profileIndex: 3, durationMs: 90000, period: "night" },
    { profileIndex: 2, durationMs: 150000, period: "night" },
];
const DAY_LENGTH_MS = SCENE_CYCLE.filter((step) => step.period === "day").reduce((total, step) => total + step.durationMs, 0);
const NIGHT_LENGTH_MS = SCENE_CYCLE.filter((step) => step.period === "night").reduce((total, step) => total + step.durationMs, 0);
const SCENE_CYCLE_TOTAL_MS = SCENE_CYCLE.reduce((total, step) => total + step.durationMs, 0);
function formatMinutes(ms) {
    return `${Math.round(ms / 60000)} min`;
}
function getSceneCycleState(timestamp) {
    const offset = ((timestamp % SCENE_CYCLE_TOTAL_MS) + SCENE_CYCLE_TOTAL_MS) % SCENE_CYCLE_TOTAL_MS;
    let elapsed = 0;
    for (const step of SCENE_CYCLE) {
        elapsed += step.durationMs;
        if (offset < elapsed) {
            return step;
        }
    }
    return SCENE_CYCLE[0];
}
function send(session, action) {
    session?.socket.emit("action", action);
}
function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
function formatCountdown(target) {
    if (!target) {
        return "Ready";
    }
    const timestamp = typeof target === "number" ? target : Date.parse(target);
    if (!Number.isFinite(timestamp)) {
        return "Pending";
    }
    const diffSeconds = Math.max(0, Math.round((timestamp - Date.now()) / 1000));
    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
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
function getGuideSteps(me, connected) {
    return [
        {
            label: "Connect to city services",
            detail: "Join the local runtime and load your profile.",
            done: connected,
        },
        {
            label: "Choose a role",
            detail: "Switch into a team or stay civilian and start earning.",
            done: Boolean(me),
        },
        {
            label: "Build your loadout",
            detail: "Buy tools, vehicles, or housing from the marketplace overlay.",
            done: Boolean(me && (Object.keys(me.inventory).length > 0 || me.vehicles.length > 0 || me.housing.length > 0)),
        },
        {
            label: "Take an assignment",
            detail: "Claim a call or start a job route to generate progress.",
            done: Boolean(me?.claimedCallId || me?.activeJobId),
        },
    ];
}
function getCurrentObjective(me, visibleCalls) {
    if (!me) {
        return "Connect and create a local profile to enter your dispatch grid.";
    }
    if (me.jailedUntil && me.jailedUntil > Date.now()) {
        return `Jailed until release in ${formatCountdown(me.jailedUntil)}. Hold position inside Liberty County Jail.`;
    }
    if (me.activeCrime) {
        const crime = GAME_CONFIG.crimes[me.activeCrime.crimeId];
        return `Work ${crime.displayName}: ${crime.stages[me.activeCrime.stageIndex] ?? "finish the robbery chain"}.`;
    }
    if (me.pendingPayout) {
        return `Stay mobile until ${me.pendingPayout.label} secures.`;
    }
    if (me.criminalStatus !== "clear") {
        return `Criminal status ${me.criminalStatus.replace("-", " ")}. Keep moving until your heat drops.`;
    }
    if (me.claimedCallId) {
        const activeCall = visibleCalls.find((call) => call.id === me.claimedCallId);
        return activeCall ? `Respond to ${activeCall.title} at ${activeCall.location}.` : "Finish your assigned call.";
    }
    if (me.activeJobId) {
        const job = GAME_CONFIG.jobs[me.activeJobId];
        return `Continue ${job.displayName}: ${job.steps[me.activeJobStep] ?? "finish the final route step"}.`;
    }
    if (visibleCalls.length > 0 && me.team !== "Civilian") {
        return `Dispatch has ${visibleCalls.length} open incident${visibleCalls.length === 1 ? "" : "s"}. Claim one from the MDT.`;
    }
    return "Use the phone or marketplace overlays to grow your profile and prepare for the next loop.";
}
function getDistrictActivity(calls, districtName) {
    const count = calls.filter((call) => call.location.includes(districtName)).length;
    if (count === 0) {
        return "Quiet";
    }
    if (count === 1) {
        return "1 active incident";
    }
    return `${count} active incidents`;
}
function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}
function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    const tagName = target.tagName;
    return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target.isContentEditable;
}
export function App() {
    const [session, setSession] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [messages, setMessages] = useState([]);
    const [name, setName] = useState(window.desktopRuntime?.isDesktop ? "Resident" : "Dispatcher");
    const [transferTarget, setTransferTarget] = useState("");
    const [transferAmount, setTransferAmount] = useState("250");
    const [overlayMode, setOverlayMode] = useState("phone");
    const [mdtTab, setMdtTab] = useState("dispatch");
    const [mdtSearchQuery, setMdtSearchQuery] = useState("");
    const [selectedDispatchCallId, setSelectedDispatchCallId] = useState("");
    const [selectedRecordPlayerId, setSelectedRecordPlayerId] = useState("");
    const [hudVisible, setHudVisible] = useState(true);
    const [leftRailOpen, setLeftRailOpen] = useState(true);
    const [rightRailOpen, setRightRailOpen] = useState(true);
    const [bottomDockOpen, setBottomDockOpen] = useState(true);
    const [pointerLocked, setPointerLocked] = useState(false);
    const [sceneClock, setSceneClock] = useState(() => Date.now());
    const [sceneReady, setSceneReady] = useState(false);
    const [sceneLoadSlow, setSceneLoadSlow] = useState(false);
    const [sceneError, setSceneError] = useState(null);
    const [safeGraphicsMode, setSafeGraphicsMode] = useState(false);
    const [graphicsPreset, setGraphicsPreset] = useState(() => {
        const savedPreset = window.localStorage.getItem(GRAPHICS_STORAGE_KEY);
        if (savedPreset === "stable" || savedPreset === "balanced" || savedPreset === "full") {
            return savedPreset;
        }
        return window.desktopRuntime?.isDesktop ? "balanced" : "full";
    });
    const [sceneRetryToken, setSceneRetryToken] = useState(0);
    const autoConnectedRef = useRef(false);
    const playLayoutInitializedRef = useRef(false);
    const worldFrameRef = useRef(null);
    const cameraRigRef = useRef({
        yaw: Math.PI * 0.32,
        pitch: 0.62,
        locked: false,
    });
    const isDesktop = Boolean(window.desktopRuntime?.isDesktop);
    const graphicsPresetLabel = graphicsPreset === "stable" ? "Stable" : graphicsPreset === "balanced" ? "Balanced" : "Cinematic";
    const graphicsStatus = safeGraphicsMode ? "Safe" : graphicsPresetLabel;
    useEffect(() => {
        window.localStorage.setItem(GRAPHICS_STORAGE_KEY, graphicsPreset);
    }, [graphicsPreset]);
    useEffect(() => {
        return () => {
            session?.socket.disconnect();
        };
    }, [session]);
    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setSceneClock(Date.now());
        }, 1000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, []);
    useEffect(() => {
        if (safeGraphicsMode || sceneReady) {
            setSceneLoadSlow(false);
            return;
        }
        const timeoutId = window.setTimeout(() => {
            setSceneLoadSlow(true);
        }, 8000);
        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [safeGraphicsMode, sceneReady, sceneRetryToken]);
    useEffect(() => {
        const handlePointerLockChange = () => {
            const locked = document.pointerLockElement === worldFrameRef.current;
            cameraRigRef.current.locked = locked;
            setPointerLocked(locked);
        };
        const handleMouseMove = (event) => {
            if (document.pointerLockElement !== worldFrameRef.current) {
                return;
            }
            cameraRigRef.current.yaw -= event.movementX * 0.0026;
            cameraRigRef.current.pitch = Math.min(1.05, Math.max(0.18, cameraRigRef.current.pitch - event.movementY * 0.0018));
        };
        document.addEventListener("pointerlockchange", handlePointerLockChange);
        document.addEventListener("mousemove", handleMouseMove);
        return () => {
            document.removeEventListener("pointerlockchange", handlePointerLockChange);
            document.removeEventListener("mousemove", handleMouseMove);
        };
    }, []);
    function requestPointerLock() {
        if (!session || document.pointerLockElement === worldFrameRef.current) {
            return;
        }
        worldFrameRef.current?.requestPointerLock();
    }
    function releasePointerLock() {
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }
    function enableSafeGraphics(message) {
        releasePointerLock();
        setSceneError(message);
        setSceneLoadSlow(false);
        setSceneReady(false);
        setSafeGraphicsMode(true);
    }
    function retryScene() {
        setSceneError(null);
        setSceneLoadSlow(false);
        setSceneReady(false);
        setSafeGraphicsMode(false);
        setSceneRetryToken((current) => current + 1);
    }
    function changeGraphicsPreset(nextPreset) {
        setGraphicsPreset(nextPreset);
        setSceneError(null);
        setSceneLoadSlow(false);
        setSceneReady(false);
        setSafeGraphicsMode(false);
        setSceneRetryToken((current) => current + 1);
    }
    function showOverlay(mode) {
        setOverlayMode(mode);
        setHudVisible(true);
        setLeftRailOpen(true);
        setRightRailOpen(mode === "mdt");
        setBottomDockOpen(true);
    }
    useEffect(() => {
        if (!session || playLayoutInitializedRef.current) {
            return;
        }
        playLayoutInitializedRef.current = true;
        setHudVisible(true);
        setLeftRailOpen(false);
        setRightRailOpen(false);
        setBottomDockOpen(true);
    }, [session]);
    useEffect(() => {
        if (session) {
            return;
        }
        releasePointerLock();
        playLayoutInitializedRef.current = false;
        setHudVisible(true);
        setLeftRailOpen(true);
        setRightRailOpen(true);
        setBottomDockOpen(true);
    }, [session]);
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.code === "Escape" && document.pointerLockElement === worldFrameRef.current) {
                event.preventDefault();
                releasePointerLock();
                setHudVisible(true);
                return;
            }
            if (isEditableTarget(event.target)) {
                return;
            }
            switch (event.code) {
                case "Digit1":
                    event.preventDefault();
                    showOverlay("phone");
                    break;
                case "Digit2":
                    event.preventDefault();
                    showOverlay("mdt");
                    break;
                case "Digit3":
                    event.preventDefault();
                    showOverlay("market");
                    break;
                case "KeyH":
                    event.preventDefault();
                    setHudVisible((current) => !current);
                    break;
                case "BracketLeft":
                    event.preventDefault();
                    setHudVisible(true);
                    setLeftRailOpen((current) => !current);
                    break;
                case "BracketRight":
                    event.preventDefault();
                    setHudVisible(true);
                    setRightRailOpen((current) => !current);
                    break;
                case "KeyB":
                    event.preventDefault();
                    setHudVisible(true);
                    setBottomDockOpen((current) => !current);
                    break;
                case "KeyL":
                    event.preventDefault();
                    if (document.pointerLockElement === worldFrameRef.current) {
                        releasePointerLock();
                    }
                    else {
                        requestPointerLock();
                    }
                    break;
                case "Tab":
                    event.preventDefault();
                    setHudVisible((current) => {
                        const next = !current;
                        if (next) {
                            setLeftRailOpen(true);
                            setRightRailOpen(true);
                        }
                        return next;
                    });
                    break;
                default:
                    break;
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [session]);
    function connect() {
        session?.socket.disconnect();
        const socket = io(SERVER_URL, {
            transports: ["websocket"],
        });
        socket.on("joined", ({ playerId }) => {
            setSession({ socket, playerId });
        });
        socket.on("snapshot", (nextSnapshot) => {
            setSnapshot(nextSnapshot);
        });
        socket.on("notification", (message) => {
            setMessages((current) => [message, ...current].slice(0, 8));
        });
        socket.emit("join", name);
    }
    useEffect(() => {
        if (!isDesktop || autoConnectedRef.current || session) {
            return;
        }
        autoConnectedRef.current = true;
        connect();
    }, [isDesktop, session, name]);
    function disconnect() {
        session?.socket.disconnect();
        setSession(null);
        setSnapshot(null);
        setMessages([]);
    }
    const players = snapshot?.players ?? [];
    const me = players.find((player) => player.id === session?.playerId) ?? null;
    const visibleCalls = snapshot?.calls.filter((call) => (me ? call.allowedTeams.includes(me.team) : true)) ?? [];
    const activeVehicles = snapshot?.vehicles ?? [];
    const ownedTools = me
        ? Object.keys(me.inventory).filter((toolId) => (me.inventory[toolId] ?? 0) > 0)
        : [];
    const worldLocations = GAME_CONFIG.worldLocations;
    const teamConfigs = GAME_CONFIG.teams;
    const jobConfigs = GAME_CONFIG.jobs;
    const crimeConfigs = GAME_CONFIG.crimes;
    const districtLocations = worldLocations.filter((location) => location.category === "district");
    const stationLocations = worldLocations.filter((location) => location.category === "station");
    const crimeLocations = worldLocations.filter((location) => location.category === "crime");
    const civicHubLocations = worldLocations.filter((location) => location.category === "job" || location.category === "utility" || location.category === "special");
    const guideSteps = getGuideSteps(me, Boolean(session));
    const currentObjective = getCurrentObjective(me, visibleCalls);
    const activeCall = me?.claimedCallId ? visibleCalls.find((call) => call.id === me.claimedCallId) : undefined;
    const savedProfileSummary = me ? `${formatCurrency(me.cash + me.bank)} total holdings` : "Local profile not loaded";
    const lawEnforcementMode = me ? ["CityPolice", "StatePatrol"].includes(me.team) : false;
    const selectedVehicle = me?.selectedVehicleId ? GAME_CONFIG.vehicles[me.selectedVehicleId] : undefined;
    const deployedOwnedVehicle = me ? activeVehicles.find((vehicle) => vehicle.ownerPlayerId === me.id) : undefined;
    const controlledVehicle = me?.activeVehicleEntityId ? activeVehicles.find((vehicle) => vehicle.id === me.activeVehicleEntityId) : undefined;
    const crimeEntries = Object.keys(GAME_CONFIG.crimes).map((crimeId) => ({
        crimeId,
        crime: crimeConfigs[crimeId],
    }));
    const jobEntries = GAME_CONFIG.jobsOrder.map((jobId) => ({
        jobId,
        job: jobConfigs[jobId],
        hubLocation: worldLocations.find((location) => location.id === jobConfigs[jobId].hubLocationId),
    }));
    const teamCards = Object.keys(GAME_CONFIG.teams).map((teamId) => ({
        teamId,
        team: teamConfigs[teamId],
        homeLocation: teamConfigs[teamId].homeLocationId
            ? worldLocations.find((location) => location.id === teamConfigs[teamId].homeLocationId)
            : undefined,
    }));
    const overlayLabel = overlayMode === "phone" ? "Phone" : overlayMode === "mdt" ? "MDT" : "Marketplace";
    const sceneCycleState = getSceneCycleState(sceneClock);
    const sceneProfile = SCENE_PROFILES[sceneCycleState.profileIndex];
    const dayNightLabel = sceneCycleState.period === "day" ? "Day" : "Night";
    const selectedDispatchCall = visibleCalls.find((call) => call.id === selectedDispatchCallId) ?? visibleCalls[0] ?? null;
    const filteredRecordPlayers = players.filter((player) => {
        const query = mdtSearchQuery.trim().toLowerCase();
        if (!query) {
            return true;
        }
        return player.name.toLowerCase().includes(query) || GAME_CONFIG.teams[player.team].displayName.toLowerCase().includes(query);
    });
    const selectedRecordPlayer = filteredRecordPlayers.find((player) => player.id === selectedRecordPlayerId) ?? filteredRecordPlayers[0] ?? null;
    useEffect(() => {
        if (selectedDispatchCall && selectedDispatchCall.id !== selectedDispatchCallId) {
            setSelectedDispatchCallId(selectedDispatchCall.id);
        }
        if (!selectedDispatchCall && selectedDispatchCallId) {
            setSelectedDispatchCallId("");
        }
    }, [selectedDispatchCall, selectedDispatchCallId]);
    useEffect(() => {
        if (selectedRecordPlayer && selectedRecordPlayer.id !== selectedRecordPlayerId) {
            setSelectedRecordPlayerId(selectedRecordPlayer.id);
        }
        if (!selectedRecordPlayer && selectedRecordPlayerId) {
            setSelectedRecordPlayerId("");
        }
    }, [selectedRecordPlayer, selectedRecordPlayerId]);
    return (_jsx("div", { className: "game-shell", children: _jsxs("div", { className: `world-frame ${pointerLocked ? "is-pointer-locked" : ""}`, ref: worldFrameRef, children: [!safeGraphicsMode ? (_jsx(SceneBoundary, { onError: (message) => enableSafeGraphics(message), children: _jsx(Suspense, { fallback: _jsxs("div", { className: "world-loading glass-panel", children: [_jsx("strong", { children: sceneLoadSlow ? "Graphics are taking too long to start." : "Loading city scene..." }), _jsx("span", { children: sceneLoadSlow ? "Switching to safe graphics keeps the program usable while you retry full visuals." : "Preparing the high-detail world and lighting stack." }), sceneLoadSlow ? (_jsxs("div", { className: "world-status__actions", children: [_jsx("button", { onClick: () => enableSafeGraphics("The city scene took too long to initialize."), children: "Use Safe Graphics" }), _jsx("button", { onClick: retryScene, children: "Retry Scene" })] })) : null] }), children: _jsx(GameScene, { me: me, players: players, calls: visibleCalls, vehicles: activeVehicles, onMove: (position) => send(session, { type: "updatePosition", position }), onDriveVehicle: (vehicleEntityId, nextState) => send(session, { type: "updateVehicleState", vehicleEntityId, ...nextState }), cameraRigRef: cameraRigRef, onEngageCamera: requestPointerLock, sceneProfile: sceneProfile, graphicsPreset: graphicsPreset, onContextLoss: () => enableSafeGraphics("The graphics driver reset while rendering the city scene."), onReady: () => {
                                setSceneReady(true);
                                setSceneLoadSlow(false);
                                setSceneError(null);
                            } }, sceneRetryToken) }) }, sceneRetryToken)) : (_jsxs("div", { className: "world-status glass-panel", children: [_jsx("p", { className: "eyebrow", children: "Safe graphics mode" }), _jsx("h2", { children: "City scene paused" }), _jsx("p", { children: sceneError ?? "The high-detail scene could not be started on this run." }), _jsx("p", { className: "micro-copy", children: "The app is still running. You can keep using menus and session controls, then retry full graphics once the renderer is stable." }), _jsx("div", { className: "world-status__actions", children: _jsx("button", { onClick: retryScene, children: "Retry Full Graphics" }) })] })), pointerLocked ? _jsx("div", { className: "screen-reticle" }) : null, _jsxs("div", { className: "control-cluster glass-panel", children: [_jsxs("div", { className: "control-group control-group--primary", children: [_jsx("button", { className: overlayMode === "phone" ? "is-selected" : "", onClick: () => showOverlay("phone"), children: "Phone 1" }), _jsx("button", { className: overlayMode === "mdt" ? "is-selected" : "", onClick: () => showOverlay("mdt"), children: "MDT 2" }), _jsx("button", { className: overlayMode === "market" ? "is-selected" : "", onClick: () => showOverlay("market"), children: "Market 3" })] }), _jsxs("div", { className: "control-group control-group--secondary", children: [_jsx("button", { onClick: () => (pointerLocked ? releasePointerLock() : requestPointerLock()), children: pointerLocked ? "Unlock Esc" : "Lock View L" }), _jsx("button", { onClick: () => setBottomDockOpen((current) => !current), children: bottomDockOpen && hudVisible ? "Hide Actions B" : "Actions B" }), _jsx("button", { onClick: () => setHudVisible((current) => !current), children: hudVisible ? "Focus H" : "HUD H" })] }), _jsxs("div", { className: "control-group control-group--graphics", children: [_jsx("button", { className: graphicsPreset === "stable" && !safeGraphicsMode ? "is-selected" : "", onClick: () => changeGraphicsPreset("stable"), children: "Stable" }), _jsx("button", { className: graphicsPreset === "balanced" && !safeGraphicsMode ? "is-selected" : "", onClick: () => changeGraphicsPreset("balanced"), children: "Balanced" }), _jsx("button", { className: graphicsPreset === "full" && !safeGraphicsMode ? "is-selected" : "", onClick: () => changeGraphicsPreset("full"), children: "Cinematic" })] })] }), _jsxs("div", { className: "field-hint glass-panel", children: [_jsx("p", { className: "eyebrow", children: "Controls" }), _jsx("p", { className: "micro-copy", children: "Click the world to lock the mouse and look around. Use WASD to move, Shift to sprint, C to crouch, E or Space to raise into an action stance, and L or H to clear the screen." }), _jsx("p", { className: "micro-copy", children: "Graphics: Stable for the smoothest play, Balanced for the best everyday desktop mix, and Cinematic for the heaviest visuals." })] }), !session ? _jsxs("div", { className: "top-banner glass-panel", children: [_jsxs("div", { className: "banner-intro", children: [_jsx("p", { className: "eyebrow", children: isDesktop ? "Desktop operations build" : "Local operations build" }), _jsx("h1", { children: "Garner Emergency Response" }), _jsx("p", { className: "lead", children: "Aidan Garner's desktop emergency-response sandbox with a stronger city layout, clearer mission flow, and sharper role identity." }), _jsxs("div", { className: "banner-metrics", children: [_jsxs("article", { className: "metric-card", children: [_jsx("span", { children: "Population" }), _jsx("strong", { children: players.length })] }), _jsxs("article", { className: "metric-card", children: [_jsx("span", { children: "Incidents" }), _jsx("strong", { children: visibleCalls.length })] }), _jsxs("article", { className: "metric-card", children: [_jsx("span", { children: "Cycle" }), _jsx("strong", { children: sceneProfile.label })] }), _jsxs("article", { className: "metric-card", children: [_jsx("span", { children: "Day / Night" }), _jsx("strong", { children: `${formatMinutes(DAY_LENGTH_MS)} / ${formatMinutes(NIGHT_LENGTH_MS)}` })] })] })] }), _jsxs("div", { className: "connect-card connect-card--launch", children: [_jsx("div", { className: "status-pill", children: "Ready for dispatch" }), _jsxs("label", { children: ["Call sign", _jsx("input", { value: name, onChange: (event) => setName(event.target.value) })] }), _jsx("button", { onClick: connect, children: isDesktop ? "Launch Session" : "Join Server" }), _jsx("p", { className: "micro-copy", children: "Begin as a civilian, then rotate into police, fire, patrol, or public works once the city is live." })] })] }) : null, session && hudVisible ? _jsxs("div", { className: `player-hud glass-panel ${pointerLocked ? "player-hud--locked" : ""}`, children: [_jsxs("div", { className: "player-hud__row", children: [_jsxs("div", { children: [_jsxs("p", { className: "eyebrow", children: [overlayLabel, " live"] }), _jsx("p", { className: "status-name", children: me?.name ?? name }), _jsx("p", { className: "micro-copy", children: me ? GAME_CONFIG.teams[me.team].displayName : "Offline" })] }), _jsxs("div", { className: "player-hud__chips", children: [_jsx("span", { className: "hud-chip", children: `${dayNightLabel} | ${sceneProfile.label}` }), _jsx("span", { className: "hud-chip", children: `Day ${formatMinutes(DAY_LENGTH_MS)} | Night ${formatMinutes(NIGHT_LENGTH_MS)}` }), _jsx("span", { className: "hud-chip", children: `Graphics ${graphicsStatus}` }), me ? _jsx("span", { className: "hud-chip", children: `Crime ${me.criminalStatus} | Heat ${me.criminalHeat}` }) : null, _jsx("span", { className: "hud-chip", children: controlledVehicle ? GAME_CONFIG.vehicles[controlledVehicle.vehicleId].displayName : "On foot" })] })] }), _jsx("p", { className: "player-hud__objective", children: currentObjective })] }) : null, hudVisible && leftRailOpen ? _jsxs("aside", { className: "left-rail glass-panel", children: [overlayMode === "phone" ? (_jsxs(_Fragment, { children: [_jsxs("section", { className: "rail-section rail-section--accent", children: [_jsx("p", { className: "eyebrow", children: "Phone" }), _jsx("h2", { children: me ? `${me.name} profile` : "Session profile" }), _jsx("p", { className: "lead compact", children: savedProfileSummary }), _jsx("p", { className: "micro-copy", children: "Profile state now persists locally between desktop sessions." })] }), _jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Wallet" }), me ? (_jsxs("div", { className: "stat-list", children: [_jsxs("p", { children: [_jsx("span", { children: "Cash" }), _jsx("strong", { children: formatCurrency(me.cash) })] }), _jsxs("p", { children: [_jsx("span", { children: "Bank" }), _jsx("strong", { children: formatCurrency(me.bank) })] }), _jsxs("p", { children: [_jsx("span", { children: "Wanted" }), _jsx("strong", { children: me.wanted })] }), _jsxs("p", { children: [_jsx("span", { children: "Criminal" }), _jsx("strong", { children: me.criminalStatus })] }), _jsxs("p", { children: [_jsx("span", { children: "Jail" }), _jsx("strong", { children: me.jailedUntil ? formatCountdown(me.jailedUntil) : "Clear" })] }), _jsxs("p", { children: [_jsx("span", { children: "Job Rep" }), _jsx("strong", { children: me.civilianJobReputation })] }), _jsxs("p", { children: [_jsx("span", { children: "Rank" }), _jsx("strong", { children: me.rankByTeam[me.team] ?? "N/A" })] })] })) : (_jsx("p", { children: "Connect to load a local profile." }))] }), me?.activeJobId ? (_jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Active Route" }), _jsxs("div", { className: "brief-card", children: [_jsx("strong", { children: GAME_CONFIG.jobs[me.activeJobId].displayName }), _jsx("span", { children: GAME_CONFIG.jobs[me.activeJobId].steps[me.activeJobStep] ?? "Finish the route" }), _jsx("span", { children: `Reputation ${me.civilianJobReputation}` })] })] })) : null, _jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Start Here" }), _jsx("ul", { className: "stack-list compact-list guide-list", children: guideSteps.map((step) => (_jsx("li", { className: step.done ? "is-complete" : "", children: _jsxs("div", { children: [_jsx("strong", { children: step.label }), _jsx("span", { children: step.detail })] }) }, step.label))) })] }), me ? (_jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Owned Gear" }), _jsx("ul", { className: "stack-list compact-list", children: ownedTools.length > 0 ? ownedTools.map((toolId) => (_jsxs("li", { children: [_jsx("strong", { children: GAME_CONFIG.tools[toolId].displayName }), _jsxs("span", { children: ["x", me.inventory[toolId]] })] }, toolId))) : _jsx("li", { children: _jsx("span", { children: "No owned tools yet." }) }) })] })) : null] })) : null, overlayMode === "mdt" ? (_jsxs(_Fragment, { children: [_jsxs("section", { className: "rail-section rail-section--accent", children: [_jsx("p", { className: "eyebrow", children: "Current objective" }), _jsx("h2", { children: me ? `${GAME_CONFIG.teams[me.team].displayName} briefing` : "Mission briefing" }), _jsx("p", { className: "lead compact", children: currentObjective }), activeCall ? (_jsxs("div", { className: "brief-card", children: [_jsx("strong", { children: activeCall.title }), _jsx("span", { children: activeCall.location }), _jsxs("span", { children: [formatCurrency(activeCall.reward), " payout"] })] })) : null, _jsxs("div", { className: "subtab-row", children: [_jsx("button", { className: mdtTab === "dispatch" ? "is-active" : "", onClick: () => setMdtTab("dispatch"), children: "Dispatch" }), _jsx("button", { className: mdtTab === "records" ? "is-active" : "", onClick: () => setMdtTab("records"), children: "Records" }), _jsx("button", { className: mdtTab === "units" ? "is-active" : "", onClick: () => setMdtTab("units"), children: "Units" }), _jsx("button", { className: mdtTab === "service" ? "is-active" : "", onClick: () => setMdtTab("service"), children: "Service" })] })] }), mdtTab === "dispatch" ? (_jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Dispatch Feed" }), selectedDispatchCall ? (_jsxs("div", { className: "brief-card", children: [_jsx("strong", { children: selectedDispatchCall.title }), _jsx("span", { children: selectedDispatchCall.description }), _jsx("span", { children: `${selectedDispatchCall.location} | ${formatCurrency(selectedDispatchCall.reward)}` })] })) : null, _jsx("ul", { className: "stack-list compact-list alert-list", children: visibleCalls.length > 0 ? visibleCalls.map((call) => (_jsxs("li", { children: [_jsxs("div", { children: [_jsx("strong", { children: call.title }), _jsx("span", { children: call.description })] }), _jsx("button", { type: "button", onClick: () => setSelectedDispatchCallId(call.id), children: call.location })] }, call.id))) : _jsx("li", { children: _jsx("span", { children: "No visible incidents right now." }) }) })] })) : null, mdtTab === "records" ? (_jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Lookup" }), _jsx("input", { className: "search-input", placeholder: "Search name or team", value: mdtSearchQuery, onChange: (event) => setMdtSearchQuery(event.target.value) }), _jsx("div", { className: "record-list", children: filteredRecordPlayers.length > 0 ? filteredRecordPlayers.map((player) => (_jsxs("button", { className: `catalog-card ${selectedRecordPlayer?.id === player.id ? "is-selected-card" : ""}`, onClick: () => setSelectedRecordPlayerId(player.id), children: [_jsxs("div", { children: [_jsx("strong", { children: player.name }), _jsx("span", { children: GAME_CONFIG.teams[player.team].displayName })] }), _jsxs("span", { children: ["Wanted ", player.wanted] })] }, player.id))) : _jsx("p", { className: "micro-copy", children: "No matching records." }) })] })) : null, mdtTab === "units" && me ? (_jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Unit State" }), _jsxs("div", { className: "stat-list", children: [_jsxs("p", { children: [_jsx("span", { children: "Team" }), _jsx("strong", { children: GAME_CONFIG.teams[me.team].displayName })] }), _jsxs("p", { children: [_jsx("span", { children: "Call" }), _jsx("strong", { children: me.claimedCallId ?? "None" })] }), _jsxs("p", { children: [_jsx("span", { children: "Open Calls" }), _jsx("strong", { children: visibleCalls.length })] }), _jsxs("p", { children: [_jsx("span", { children: "Vehicle" }), _jsx("strong", { children: controlledVehicle ? GAME_CONFIG.vehicles[controlledVehicle.vehicleId].displayName : "On Foot" })] }), _jsxs("p", { children: [_jsx("span", { children: "Position" }), _jsxs("strong", { children: [me.position.x.toFixed(1), ", ", me.position.y.toFixed(1)] })] })] })] })) : null, mdtTab === "service" ? (_jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Service Queue" }), _jsx("ul", { className: "stack-list compact-list", children: visibleCalls.length > 0 ? visibleCalls.map((call) => (_jsxs("li", { children: [_jsxs("div", { children: [_jsx("strong", { children: call.title }), _jsx("span", { children: call.location })] }), _jsx("span", { children: formatCurrency(call.reward) })] }, call.id))) : _jsx("li", { children: _jsx("span", { children: "No current service queue." }) }) })] })) : null] })) : null, overlayMode === "market" ? (_jsxs(_Fragment, { children: [_jsxs("section", { className: "rail-section rail-section--accent", children: [_jsx("p", { className: "eyebrow", children: "Marketplace" }), _jsx("h2", { children: "Assets and routes" }), _jsx("p", { className: "lead compact", children: "Buy the tools, vehicles, property, and jobs that drive the civilian and service loops." })] }), me ? (_jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Owned Assets" }), _jsxs("ul", { className: "stack-list compact-list", children: [_jsxs("li", { children: [_jsx("strong", { children: "Owned Houses" }), _jsx("span", { children: me.housing.length })] }), _jsxs("li", { children: [_jsx("strong", { children: "Owned Vehicles" }), _jsx("span", { children: me.vehicles.length })] }), _jsxs("li", { children: [_jsx("strong", { children: "Selected Vehicle" }), _jsx("span", { children: me.selectedVehicleId ?? "None" })] }), _jsxs("li", { children: [_jsx("strong", { children: "Deployed" }), _jsx("span", { children: deployedOwnedVehicle ? GAME_CONFIG.vehicles[deployedOwnedVehicle.vehicleId].displayName : "Stored" })] }), _jsxs("li", { children: [_jsx("strong", { children: "Occupancy" }), _jsx("span", { children: controlledVehicle ? "Driving" : deployedOwnedVehicle ? "Deployed" : "None" })] }), _jsxs("li", { children: [_jsx("strong", { children: "Fuel / Health" }), _jsx("span", { children: deployedOwnedVehicle ? `${Math.round(deployedOwnedVehicle.fuel)} / ${Math.round(deployedOwnedVehicle.health)}` : "-" })] })] }), _jsxs("div", { className: "section-split", children: [_jsx("button", { onClick: () => send(session, { type: "spawnVehicle" }), disabled: !me.selectedVehicleId, children: "Deploy" }), _jsx("button", { onClick: () => send(session, { type: "despawnVehicle" }), disabled: !deployedOwnedVehicle, children: "Store" }), _jsx("button", { onClick: () => deployedOwnedVehicle ? send(session, { type: "enterVehicle", vehicleEntityId: deployedOwnedVehicle.id }) : null, disabled: !deployedOwnedVehicle || Boolean(controlledVehicle), children: "Enter" }), _jsx("button", { onClick: () => send(session, { type: "exitVehicle" }), disabled: !controlledVehicle, children: "Exit" })] })] })) : null, _jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Stations" }), _jsx("ul", { className: "stack-list compact-list", children: stationLocations.map((location) => (_jsx("li", { children: _jsxs("div", { children: [_jsx("strong", { children: location.name }), _jsx("span", { children: location.summary })] }) }, location.id))) })] }), _jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "County Hubs" }), _jsx("ul", { className: "stack-list compact-list", children: civicHubLocations.map((location) => (_jsx("li", { children: _jsxs("div", { children: [_jsx("strong", { children: location.name }), _jsx("span", { children: location.summary })] }) }, location.id))) })] })] })) : null] }) : null, hudVisible && rightRailOpen ? _jsxs("aside", { className: "right-rail glass-panel", children: [overlayMode === "phone" ? (_jsxs(_Fragment, { children: [_jsxs("section", { className: "rail-section rail-section--accent", children: [_jsx("p", { className: "eyebrow", children: "Messages" }), _jsx("h2", { children: "Notifications" }), _jsx("ul", { className: "stack-list compact-list", children: messages.length > 0 ? messages.map((message, index) => (_jsx("li", { children: message }, `${message}-${index}`))) : _jsx("li", { children: _jsx("span", { children: "No notifications yet." }) }) })] }), me ? (_jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Bank Transfer" }), _jsxs("div", { className: "form-grid", children: [_jsx("input", { placeholder: "Target player name", value: transferTarget, onChange: (event) => setTransferTarget(event.target.value) }), _jsx("input", { placeholder: "Amount", inputMode: "numeric", value: transferAmount, onChange: (event) => setTransferAmount(event.target.value) }), _jsx("button", { className: "span-two", onClick: () => send(session, {
                                                        type: "transferFunds",
                                                        targetName: transferTarget,
                                                        amount: Number(transferAmount) || 0,
                                                    }), children: "Send Transfer" })] }), _jsxs("div", { className: "section-split", children: [_jsx("button", { onClick: () => send(session, { type: "depositCash", amount: 250 }), children: "Deposit 250" }), _jsx("button", { onClick: () => send(session, { type: "withdrawCash", amount: 250 }), children: "Withdraw 250" })] })] })) : null, _jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "District Watch" }), _jsx("div", { className: "district-grid", children: districtLocations.map((district) => (_jsxs("article", { className: "district-card", children: [_jsx("div", { className: "district-swatch", style: { background: district.accent } }), _jsxs("div", { children: [_jsx("strong", { children: district.name }), _jsx("span", { children: district.summary })] }), _jsx("em", { children: getDistrictActivity(snapshot?.calls ?? [], district.name) })] }, district.id))) })] })] })) : null, overlayMode === "mdt" ? (_jsxs(_Fragment, { children: [mdtTab === "dispatch" ? (_jsxs(_Fragment, { children: [_jsxs("section", { className: "rail-section rail-section--accent", children: [_jsx("p", { className: "eyebrow", children: "World overview" }), _jsx("h2", { children: "Stations and sites" }), _jsx("ul", { className: "stack-list compact-list", children: stationLocations.map((location) => (_jsx("li", { children: _jsxs("div", { children: [_jsx("strong", { children: location.name }), _jsx("span", { children: location.summary })] }) }, location.id))) })] }), _jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Crime Sites" }), _jsx("ul", { className: "stack-list compact-list", children: crimeLocations.map((location) => (_jsx("li", { children: _jsxs("div", { children: [_jsx("strong", { children: location.name }), _jsx("span", { children: location.summary })] }) }, location.id))) })] }), _jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Civilian and Service Hubs" }), _jsx("ul", { className: "stack-list compact-list", children: civicHubLocations.map((location) => (_jsx("li", { children: _jsxs("div", { children: [_jsx("strong", { children: location.name }), _jsx("span", { children: location.summary })] }) }, location.id))) })] })] })) : null, mdtTab === "records" && selectedRecordPlayer ? (_jsxs(_Fragment, { children: [_jsxs("section", { className: "rail-section rail-section--accent", children: [_jsx("p", { className: "eyebrow", children: "Selected record" }), _jsx("h2", { children: selectedRecordPlayer.name }), _jsxs("div", { className: "stat-list", children: [_jsxs("p", { children: [_jsx("span", { children: "Team" }), _jsx("strong", { children: GAME_CONFIG.teams[selectedRecordPlayer.team].displayName })] }), _jsxs("p", { children: [_jsx("span", { children: "Wanted" }), _jsx("strong", { children: selectedRecordPlayer.wanted })] }), _jsxs("p", { children: [_jsx("span", { children: "Criminal" }), _jsx("strong", { children: selectedRecordPlayer.criminalStatus })] }), _jsxs("p", { children: [_jsx("span", { children: "Jail" }), _jsx("strong", { children: selectedRecordPlayer.jailedUntil ? formatCountdown(selectedRecordPlayer.jailedUntil) : "Clear" })] }), _jsxs("p", { children: [_jsx("span", { children: "BOLO" }), _jsx("strong", { children: selectedRecordPlayer.bolo ? "Active" : "Clear" })] }), _jsxs("p", { children: [_jsx("span", { children: "Vehicle" }), _jsx("strong", { children: selectedRecordPlayer.selectedVehicleId ? GAME_CONFIG.vehicles[selectedRecordPlayer.selectedVehicleId].displayName : "None" })] })] }), _jsxs("div", { className: "section-split", children: [_jsx("button", { onClick: () => send(session, { type: "toggleBolo", targetPlayerId: selectedRecordPlayer.id }), disabled: !lawEnforcementMode || selectedRecordPlayer.id === me?.id, children: selectedRecordPlayer.bolo ? "Clear BOLO" : "Issue BOLO" }), _jsx("button", { onClick: () => send(session, { type: "issueWarning", targetPlayerId: selectedRecordPlayer.id, reason: "Field contact logged" }), disabled: !lawEnforcementMode || selectedRecordPlayer.id === me?.id, children: "Field Warning" })] })] }), _jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "History" }), _jsxs("ul", { className: "stack-list compact-list history-list", children: [selectedRecordPlayer.citations.slice(0, 4).map((citation, index) => (_jsxs("li", { children: [_jsxs("div", { children: [_jsx("strong", { children: citation.reason }), _jsxs("span", { children: [citation.issuedBy, " | ", formatTimestamp(citation.timestamp)] })] }), _jsx("span", { children: formatCurrency(citation.fine) })] }, `citation-${index}`))), selectedRecordPlayer.warnings.slice(0, 4).map((warning, index) => (_jsxs("li", { children: [_jsxs("div", { children: [_jsx("strong", { children: warning.reason }), _jsxs("span", { children: [warning.issuedBy, " | ", formatTimestamp(warning.timestamp)] })] }), _jsx("span", { children: "Warning" })] }, `warning-${index}`))), selectedRecordPlayer.citations.length === 0 && selectedRecordPlayer.warnings.length === 0 ? _jsx("li", { children: _jsx("span", { children: "No record history yet." }) }) : null] })] })] })) : null, mdtTab === "units" ? (_jsxs(_Fragment, { children: [_jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Unit Board" }), _jsx("ul", { className: "stack-list compact-list", children: players.filter((player) => player.team !== "Civilian").map((player) => (_jsxs("li", { children: [_jsxs("div", { children: [_jsx("strong", { children: player.name }), _jsxs("span", { children: [GAME_CONFIG.teams[player.team].shortLabel, " | ", player.claimedCallId ? "Committed" : "Available"] })] }), _jsx("span", { children: player.activeVehicleEntityId ? "Vehicle" : "On Foot" })] }, player.id))) })] }), _jsxs("section", { className: "rail-section rail-section--accent", children: [_jsx("p", { className: "eyebrow", children: "Vehicle board" }), _jsx("h2", { children: "Active vehicles" }), _jsx("ul", { className: "stack-list compact-list", children: activeVehicles.length > 0 ? activeVehicles.map((vehicle) => (_jsxs("li", { children: [_jsxs("div", { children: [_jsx("strong", { children: GAME_CONFIG.vehicles[vehicle.vehicleId].displayName }), _jsx("span", { children: vehicle.occupantPlayerId ? "Occupied" : "Unoccupied" })] }), _jsxs("span", { children: [Math.round(vehicle.fuel), " fuel"] })] }, vehicle.id))) : _jsx("li", { children: _jsx("span", { children: "No active vehicles." }) }) })] }), _jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Stations" }), _jsx("ul", { className: "stack-list compact-list", children: stationLocations.map((location) => (_jsx("li", { children: _jsxs("div", { children: [_jsx("strong", { children: location.name }), _jsx("span", { children: location.summary })] }) }, location.id))) })] })] })) : null, mdtTab === "service" ? (_jsxs("section", { className: "rail-section rail-section--accent", children: [_jsx("p", { className: "eyebrow", children: "District watch" }), _jsx("h2", { children: "Service pressure" }), _jsx("div", { className: "district-grid", children: districtLocations.map((district) => (_jsxs("article", { className: "district-card", children: [_jsx("div", { className: "district-swatch", style: { background: district.accent } }), _jsxs("div", { children: [_jsx("strong", { children: district.name }), _jsx("span", { children: district.summary })] }), _jsx("em", { children: getDistrictActivity(snapshot?.calls ?? [], district.name) })] }, district.id))) })] })) : null] })) : null, overlayMode === "market" ? (_jsxs(_Fragment, { children: [_jsxs("section", { className: "rail-section rail-section--accent", children: [_jsx("p", { className: "eyebrow", children: "Role actions" }), _jsx("h2", { children: "Choose assignment" }), _jsx("p", { className: "micro-copy", children: "Service roles require a clean record. Clear wanted status before joining police, rescue, or DOT." }), _jsx("div", { className: "role-card-list", children: teamCards.map(({ teamId, team, homeLocation }) => {
                                                const selected = me?.team === teamId;
                                                const blocked = Boolean(me?.wanted && teamId !== "Civilian");
                                                return (_jsxs("button", { type: "button", className: `role-card ${selected ? "is-selected-card" : ""}`, onClick: () => send(session, { type: "switchTeam", team: teamId }), disabled: blocked && !selected, children: [_jsxs("div", { className: "role-card__header", children: [_jsx("span", { className: "status-pill", style: { background: `${team.accent}22`, color: team.accent }, children: team.shortLabel }), _jsx("strong", { children: team.displayName })] }), _jsx("p", { children: team.summary }), _jsx("ul", { className: "role-card__duties", children: team.duties.map((duty) => (_jsx("li", { children: duty }, duty))) }), _jsxs("div", { className: "role-card__footer", children: [_jsx("span", { children: homeLocation?.name ?? "County access point" }), _jsx("span", { children: selected ? "Active" : blocked ? "Clear wanted first" : "Switch role" })] })] }, teamId));
                                            }) })] }), me ? (_jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Field Tools" }), _jsxs("div", { className: "section-split", children: [_jsx("button", { onClick: () => send(session, { type: "logCameraOffense", offenseType: "Speeding", fine: 75 }), children: "Log Speeding" }), _jsx("button", { onClick: () => send(session, { type: "logCameraOffense", offenseType: "Red Light", fine: 110 }), children: "Log Red Light" })] })] })) : null, me?.team === "Civilian" ? (_jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Criminal Activity" }), _jsx("p", { className: "micro-copy", children: "Low-tier crimes now create visible heat, wanted pressure, and stronger police response if you keep escalating." }), me.activeCrime ? (_jsxs("div", { className: "brief-card", children: [_jsx("strong", { children: crimeConfigs[me.activeCrime.crimeId].displayName }), _jsx("span", { children: crimeConfigs[me.activeCrime.crimeId].stages[me.activeCrime.stageIndex] ?? "Finish the chain" }), _jsx("span", { children: `Stage ${me.activeCrime.stageIndex + 1}/${crimeConfigs[me.activeCrime.crimeId].stages.length}` })] })) : null, _jsx("div", { className: "crime-action-list", children: crimeEntries.map(({ crimeId, crime }) => (_jsxs("button", { type: "button", className: "crime-action-card", onClick: () => send(session, { type: "startCrime", crimeId }), disabled: Boolean(me.activeCrime || me.pendingPayout), children: [_jsxs("div", { children: [_jsx("strong", { children: crime.displayName }), _jsx("span", { children: `${formatCurrency(crime.payoutMin)}-${formatCurrency(crime.payoutMax)} | +${crime.wanted} wanted | ${crime.stages.length} stages` })] }), _jsx("span", { children: GAME_CONFIG.tools[crime.requiredTool].displayName })] }, crimeId))) }), _jsxs("div", { className: "stat-list", children: [_jsxs("p", { children: [_jsx("span", { children: "Heat" }), _jsx("strong", { children: me.criminalHeat })] }), _jsxs("p", { children: [_jsx("span", { children: "Chain" }), _jsx("strong", { children: me.activeCrime ? `${me.activeCrime.stageIndex + 1}/${crimeConfigs[me.activeCrime.crimeId].stages.length}` : "Idle" })] }), _jsxs("p", { children: [_jsx("span", { children: "Payout" }), _jsx("strong", { children: me.pendingPayout ? formatCountdown(me.pendingPayout.secureAt) : "None" })] })] })] })) : null, selectedVehicle ? (_jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Vehicle Spec" }), _jsxs("div", { className: "stat-list", children: [_jsxs("p", { children: [_jsx("span", { children: "Model" }), _jsx("strong", { children: selectedVehicle.displayName })] }), _jsxs("p", { children: [_jsx("span", { children: "Top Speed" }), _jsx("strong", { children: selectedVehicle.topSpeed })] }), _jsxs("p", { children: [_jsx("span", { children: "Fuel" }), _jsx("strong", { children: selectedVehicle.fuelCapacity })] }), _jsxs("p", { children: [_jsx("span", { children: "Durability" }), _jsx("strong", { children: selectedVehicle.durability })] })] })] })) : null, me?.team === "Civilian" ? (_jsxs("section", { className: "rail-section", children: [_jsx("h2", { children: "Civilian Jobs" }), _jsx("div", { className: "role-card-list", children: jobEntries.map(({ jobId, job, hubLocation }) => {
                                                const unlocked = me.civilianJobReputation >= job.unlockReputation;
                                                const active = me.activeJobId === jobId;
                                                return (_jsxs("button", { type: "button", className: `role-card ${active ? "is-selected-card" : ""}`, onClick: () => send(session, { type: "startJob", jobId }), disabled: !unlocked, children: [_jsx("div", { className: "role-card__header", children: _jsx("strong", { children: job.displayName }) }), _jsx("p", { children: job.summary }), _jsxs("div", { className: "role-card__footer", children: [_jsx("span", { children: hubLocation?.name ?? "County route hub" }), _jsx("span", { children: unlocked ? (active ? "Active" : `${formatCurrency(job.reward)} payout`) : `Unlock at rep ${job.unlockReputation}` })] })] }, jobId));
                                            }) })] })) : null] })) : null] }) : null, session && hudVisible && bottomDockOpen ? _jsxs("div", { className: "bottom-dock bottom-dock--quick glass-panel", children: [_jsxs("section", { className: "dock-section dock-section--quick-actions", children: [_jsx("p", { className: "eyebrow", children: "Quick actions" }), _jsxs("div", { className: "quick-action-grid", children: [overlayMode === "phone" ? (_jsxs(_Fragment, { children: [jobEntries.filter(({ job }) => (me?.civilianJobReputation ?? 0) >= job.unlockReputation).map(({ jobId, job }) => (_jsx("button", { onClick: () => send(session, { type: "startJob", jobId }), children: job.displayName }, jobId))), _jsx("button", { onClick: () => send(session, { type: "advanceJob" }), children: "Advance Job" }), me?.team === "Civilian" ? _jsx("button", { onClick: () => send(session, { type: "advanceCrime" }), disabled: !me?.activeCrime, children: "Advance Crime" }) : null] })) : null, overlayMode === "mdt" ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => send(session, { type: "claimCall", callId: selectedDispatchCall?.id }), disabled: !selectedDispatchCall, children: "Claim Call" }), _jsx("button", { onClick: () => send(session, { type: "completeCall" }), disabled: !me?.claimedCallId, children: "Complete Call" }), _jsx("button", { onClick: () => selectedRecordPlayer ? send(session, { type: "toggleBolo", targetPlayerId: selectedRecordPlayer.id }) : null, disabled: !selectedRecordPlayer || !lawEnforcementMode || selectedRecordPlayer.id === me?.id, children: selectedRecordPlayer?.bolo ? "Clear BOLO" : "Issue BOLO" }), _jsx("button", { onClick: () => selectedRecordPlayer ? send(session, { type: "issueWarning", targetPlayerId: selectedRecordPlayer.id, reason: "Field warning" }) : null, disabled: !selectedRecordPlayer || !lawEnforcementMode || selectedRecordPlayer.id === me?.id, children: "Warn" }), _jsx("button", { onClick: () => selectedRecordPlayer ? send(session, { type: "issueCitation", targetPlayerId: selectedRecordPlayer.id }) : null, disabled: !selectedRecordPlayer || !lawEnforcementMode || selectedRecordPlayer.id === me?.id, children: "Cite" }), _jsx("button", { onClick: () => selectedRecordPlayer ? send(session, { type: "arrestPlayer", targetPlayerId: selectedRecordPlayer.id }) : null, disabled: !selectedRecordPlayer || !lawEnforcementMode || selectedRecordPlayer.id === me?.id || selectedRecordPlayer.wanted <= 0, children: "Arrest" })] })) : null, overlayMode === "market" ? (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => send(session, { type: "spawnVehicle" }), disabled: !me?.selectedVehicleId, children: "Deploy" }), _jsx("button", { onClick: () => send(session, { type: "despawnVehicle" }), disabled: !deployedOwnedVehicle, children: "Store" }), _jsx("button", { onClick: () => deployedOwnedVehicle ? send(session, { type: "enterVehicle", vehicleEntityId: deployedOwnedVehicle.id }) : null, disabled: !deployedOwnedVehicle || Boolean(controlledVehicle), children: "Enter" }), _jsx("button", { onClick: () => send(session, { type: "exitVehicle" }), disabled: !controlledVehicle, children: "Exit" }), me?.team === "Civilian" ? _jsx("button", { onClick: () => send(session, { type: "startCrime", crimeId: "atm_breach" }), disabled: Boolean(me.activeCrime || me.pendingPayout), children: "ATM Breach" }) : null, me?.team === "Civilian" ? _jsx("button", { onClick: () => send(session, { type: "startCrime", crimeId: "vehicle_theft" }), disabled: Boolean(me.activeCrime || me.pendingPayout), children: "Vehicle Theft" }) : null, me?.team === "Civilian" ? _jsx("button", { onClick: () => send(session, { type: "advanceCrime" }), disabled: !me?.activeCrime, children: "Advance Crime" }) : null] })) : null] })] }), _jsx("section", { className: "dock-section dock-section--status", children: _jsxs("div", { className: "stat-list", children: [_jsxs("p", { children: [_jsx("span", { children: "Cash" }), _jsx("strong", { children: me ? formatCurrency(me.cash) : "-" })] }), _jsxs("p", { children: [_jsx("span", { children: "Bank" }), _jsx("strong", { children: me ? formatCurrency(me.bank) : "-" })] }), _jsxs("p", { children: [_jsx("span", { children: "Status" }), _jsx("strong", { children: controlledVehicle ? "Driving" : "On Foot" })] }), _jsxs("p", { children: [_jsx("span", { children: "Cycle" }), _jsx("strong", { children: `${dayNightLabel} | ${sceneProfile.label}` })] }), _jsxs("p", { children: [_jsx("span", { children: "Graphics" }), _jsx("strong", { children: graphicsStatus })] }), _jsxs("p", { children: [_jsx("span", { children: "Criminal" }), _jsx("strong", { children: me ? `${me.criminalStatus} | ${me.criminalHeat}` : "-" })] }), _jsxs("p", { children: [_jsx("span", { children: "Robbery" }), _jsx("strong", { children: me?.activeCrime ? `${crimeConfigs[me.activeCrime.crimeId].displayName} ${me.activeCrime.stageIndex + 1}/${crimeConfigs[me.activeCrime.crimeId].stages.length}` : me?.pendingPayout ? "Getaway" : "Idle" })] }), _jsxs("p", { children: [_jsx("span", { children: "Jail" }), _jsx("strong", { children: me?.jailedUntil ? formatCountdown(me.jailedUntil) : "Clear" })] }), _jsxs("p", { children: [_jsx("span", { children: "Job Rep" }), _jsx("strong", { children: me?.civilianJobReputation ?? 0 })] })] }) })] }) : null] }) }));
}
