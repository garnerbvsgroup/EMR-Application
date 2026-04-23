import { Component, lazy, Suspense, type ErrorInfo, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  GAME_CONFIG,
  type CallRecord,
  type ClientAction,
  type CrimeId,
  type HouseId,
  type PlayerPublicState,
  type ServerSnapshot,
  type TeamId,
  type ToolId,
  type VehicleId,
  type WorldLocation,
} from "@redwood/shared";
import { type CameraRigState, type SceneProfile } from "./sceneTypes";

const GameScene = lazy(() => import("./GameScene"));

type SceneBoundaryProps = {
  onError: (message: string) => void;
  children: React.ReactNode;
};

type SceneBoundaryState = {
  hasError: boolean;
};

class SceneBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
  state: SceneBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    this.props.onError(error.message || "The city scene failed to start.");
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

type Session = {
  socket: Socket;
  playerId: string;
};

declare global {
  interface Window {
    desktopRuntime?: {
      isDesktop?: boolean;
      platform?: string;
      version?: string;
    };
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

const TEAM_COLORS: Record<TeamId, string> = {
  Civilian: "#f0d6b2",
  CityPolice: "#4d7cff",
  StatePatrol: "#79a7ff",
  FireRescue: "#d86152",
  PublicWorks: "#d29c3b",
};

const TEAM_SUMMARY: Record<TeamId, string> = {
  Civilian: "Build money through jobs, buy assets, and navigate the city economy.",
  CityPolice: "Handle local enforcement, active calls, and suspect management across downtown districts.",
  StatePatrol: "Run traffic enforcement, roadway visibility, and wider-map patrol coverage.",
  FireRescue: "Respond to rescue scenes and support emergency stabilization loops.",
  PublicWorks: "Maintain roadway coverage and support service logistics across the city.",
};

type GuideStep = {
  label: string;
  detail: string;
  done: boolean;
};

type OverlayMode = "phone" | "mdt" | "market";
type GraphicsPreset = "stable" | "balanced" | "full";
type ClientPlayerState = PlayerPublicState & {
  criminalStatus: "clear" | "active" | "fleeing" | "cooldown" | "most-wanted";
  criminalHeat: number;
  wantedExpiresAt?: number;
  lastCrimeAt?: number;
  jailedUntil?: number;
  jailedBy?: string;
  jailReason?: string;
  civilianJobReputation: number;
  activeCrime?: {
    crimeId: CrimeId;
    stageIndex: number;
    startedAt: number;
  };
};
type TeamCardConfig = {
  displayName: string;
  shortLabel: string;
  summary: string;
  duties: string[];
  homeLocationId?: string;
  accent: string;
};
type JobCardConfig = {
  displayName: string;
  summary: string;
  reward: number;
  unlockReputation: number;
  hubLocationId: string;
  steps: readonly string[];
};
type CrimeCardConfig = {
  displayName: string;
  requiredTool: ToolId;
  payoutMin: number;
  payoutMax: number;
  wanted: number;
  secureSeconds: number;
  stages: readonly string[];
};
type JobCardId = (typeof GAME_CONFIG.jobsOrder)[number];
type ClientCrimeAction = ClientAction | { type: "advanceCrime" } | { type: "claimCall"; callId?: string };

const GRAPHICS_STORAGE_KEY = "garner.graphicsPreset";

type SceneCycleStep = {
  profileIndex: number;
  durationMs: number;
  period: "day" | "night";
};

const SCENE_PROFILES: SceneProfile[] = [
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

const SCENE_CYCLE: SceneCycleStep[] = [
  { profileIndex: 0, durationMs: 120000, period: "day" },
  { profileIndex: 1, durationMs: 240000, period: "day" },
  { profileIndex: 3, durationMs: 90000, period: "night" },
  { profileIndex: 2, durationMs: 150000, period: "night" },
];

const DAY_LENGTH_MS = SCENE_CYCLE.filter((step) => step.period === "day").reduce((total, step) => total + step.durationMs, 0);
const NIGHT_LENGTH_MS = SCENE_CYCLE.filter((step) => step.period === "night").reduce((total, step) => total + step.durationMs, 0);
const SCENE_CYCLE_TOTAL_MS = SCENE_CYCLE.reduce((total, step) => total + step.durationMs, 0);

function formatMinutes(ms: number) {
  return `${Math.round(ms / 60000)} min`;
}

function getSceneCycleState(timestamp: number) {
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

function send(session: Session | null, action: ClientCrimeAction) {
  session?.socket.emit("action", action);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatCountdown(target?: string | number | null) {
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

function getGuideSteps(me: PlayerPublicState | null, connected: boolean): GuideStep[] {
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

function getCurrentObjective(me: ClientPlayerState | null, visibleCalls: CallRecord[]) {
  if (!me) {
    return "Connect and create a local profile to enter your dispatch grid.";
  }

  if (me.jailedUntil && me.jailedUntil > Date.now()) {
    return `Jailed until release in ${formatCountdown(me.jailedUntil)}. Hold position inside Liberty County Jail.`;
  }

  if (me.activeCrime) {
    const crime = GAME_CONFIG.crimes[me.activeCrime.crimeId] as unknown as CrimeCardConfig;
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
    const job = GAME_CONFIG.jobs[me.activeJobId] as JobCardConfig;
    return `Continue ${job.displayName}: ${job.steps[me.activeJobStep] ?? "finish the final route step"}.`;
  }

  if (visibleCalls.length > 0 && me.team !== "Civilian") {
    return `Dispatch has ${visibleCalls.length} open incident${visibleCalls.length === 1 ? "" : "s"}. Claim one from the MDT.`;
  }

  return "Use the phone or marketplace overlays to grow your profile and prepare for the next loop.";
}

function getDistrictActivity(calls: CallRecord[], districtName: string) {
  const count = calls.filter((call) => call.location.includes(districtName)).length;
  if (count === 0) {
    return "Quiet";
  }

  if (count === 1) {
    return "1 active incident";
  }

  return `${count} active incidents`;
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target.isContentEditable;
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [snapshot, setSnapshot] = useState<ServerSnapshot | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [name, setName] = useState(window.desktopRuntime?.isDesktop ? "Resident" : "Dispatcher");
  const [transferTarget, setTransferTarget] = useState("");
  const [transferAmount, setTransferAmount] = useState("250");
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("phone");
  const [mdtTab, setMdtTab] = useState<"dispatch" | "records" | "units" | "service">("dispatch");
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
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [safeGraphicsMode, setSafeGraphicsMode] = useState(false);
  const [graphicsPreset, setGraphicsPreset] = useState<GraphicsPreset>(() => {
    const savedPreset = window.localStorage.getItem(GRAPHICS_STORAGE_KEY);
    if (savedPreset === "stable" || savedPreset === "balanced" || savedPreset === "full") {
      return savedPreset;
    }

    return window.desktopRuntime?.isDesktop ? "balanced" : "full";
  });
  const [sceneRetryToken, setSceneRetryToken] = useState(0);
  const autoConnectedRef = useRef(false);
  const playLayoutInitializedRef = useRef(false);
  const worldFrameRef = useRef<HTMLDivElement>(null);
  const cameraRigRef = useRef<CameraRigState>({
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

    const handleMouseMove = (event: MouseEvent) => {
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

  function enableSafeGraphics(message: string) {
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

  function changeGraphicsPreset(nextPreset: GraphicsPreset) {
    setGraphicsPreset(nextPreset);
    setSceneError(null);
    setSceneLoadSlow(false);
    setSceneReady(false);
    setSafeGraphicsMode(false);
    setSceneRetryToken((current) => current + 1);
  }

  function showOverlay(mode: OverlayMode) {
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
    const handleKeyDown = (event: KeyboardEvent) => {
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
          } else {
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

    socket.on("joined", ({ playerId }: { playerId: string }) => {
      setSession({ socket, playerId });
    });

    socket.on("snapshot", (nextSnapshot: ServerSnapshot) => {
      setSnapshot(nextSnapshot);
    });

    socket.on("notification", (message: string) => {
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

  const players = (snapshot?.players as ClientPlayerState[] | undefined) ?? [];
  const me = players.find((player) => player.id === session?.playerId) ?? null;
  const visibleCalls = snapshot?.calls.filter((call) => (me ? call.allowedTeams.includes(me.team) : true)) ?? [];
  const activeVehicles = snapshot?.vehicles ?? [];
  const ownedTools = me
    ? (Object.keys(me.inventory) as ToolId[]).filter((toolId) => (me.inventory[toolId] ?? 0) > 0)
    : [];
  const worldLocations: readonly WorldLocation[] = GAME_CONFIG.worldLocations;
  const teamConfigs = GAME_CONFIG.teams as Record<TeamId, TeamCardConfig>;
  const jobConfigs = GAME_CONFIG.jobs as Record<JobCardId, JobCardConfig>;
  const crimeConfigs = GAME_CONFIG.crimes as unknown as Record<CrimeId, CrimeCardConfig>;
  const districtLocations = worldLocations.filter((location) => location.category === "district");
  const stationLocations = worldLocations.filter((location) => location.category === "station");
  const crimeLocations = worldLocations.filter((location) => location.category === "crime");
  const civicHubLocations = worldLocations.filter(
    (location) => location.category === "job" || location.category === "utility" || location.category === "special",
  );
  const guideSteps = getGuideSteps(me, Boolean(session));
  const currentObjective = getCurrentObjective(me, visibleCalls);
  const activeCall = me?.claimedCallId ? visibleCalls.find((call) => call.id === me.claimedCallId) : undefined;
  const savedProfileSummary = me ? `${formatCurrency(me.cash + me.bank)} total holdings` : "Local profile not loaded";
  const lawEnforcementMode = me ? ["CityPolice", "StatePatrol"].includes(me.team) : false;
  const selectedVehicle = me?.selectedVehicleId ? GAME_CONFIG.vehicles[me.selectedVehicleId] : undefined;
  const deployedOwnedVehicle = me ? activeVehicles.find((vehicle) => vehicle.ownerPlayerId === me.id) : undefined;
  const controlledVehicle = me?.activeVehicleEntityId ? activeVehicles.find((vehicle) => vehicle.id === me.activeVehicleEntityId) : undefined;
  const crimeEntries = (Object.keys(GAME_CONFIG.crimes) as CrimeId[]).map((crimeId) => ({
    crimeId,
    crime: crimeConfigs[crimeId],
  }));
  const jobEntries = GAME_CONFIG.jobsOrder.map((jobId) => ({
    jobId,
    job: jobConfigs[jobId],
    hubLocation: worldLocations.find((location) => location.id === jobConfigs[jobId].hubLocationId),
  }));
  const teamCards = (Object.keys(GAME_CONFIG.teams) as TeamId[]).map((teamId) => ({
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

  return (
    <div className="game-shell">
      <div className={`world-frame ${pointerLocked ? "is-pointer-locked" : ""}`} ref={worldFrameRef}>
        {!safeGraphicsMode ? (
          <SceneBoundary key={sceneRetryToken} onError={(message) => enableSafeGraphics(message)}>
            <Suspense
              fallback={
                <div className="world-loading glass-panel">
                  <strong>{sceneLoadSlow ? "Graphics are taking too long to start." : "Loading city scene..."}</strong>
                  <span>{sceneLoadSlow ? "Switching to safe graphics keeps the program usable while you retry full visuals." : "Preparing the high-detail world and lighting stack."}</span>
                  {sceneLoadSlow ? (
                    <div className="world-status__actions">
                      <button onClick={() => enableSafeGraphics("The city scene took too long to initialize.")}>Use Safe Graphics</button>
                      <button onClick={retryScene}>Retry Scene</button>
                    </div>
                  ) : null}
                </div>
              }
            >
              <GameScene
                key={sceneRetryToken}
                me={me}
                players={players}
                calls={visibleCalls}
                vehicles={activeVehicles}
                onMove={(position) => send(session, { type: "updatePosition", position })}
                onDriveVehicle={(vehicleEntityId, nextState) => send(session, { type: "updateVehicleState", vehicleEntityId, ...nextState })}
                cameraRigRef={cameraRigRef}
                onEngageCamera={requestPointerLock}
                sceneProfile={sceneProfile}
                graphicsPreset={graphicsPreset}
                onContextLoss={() => enableSafeGraphics("The graphics driver reset while rendering the city scene.")}
                onReady={() => {
                  setSceneReady(true);
                  setSceneLoadSlow(false);
                  setSceneError(null);
                }}
              />
            </Suspense>
          </SceneBoundary>
        ) : (
          <div className="world-status glass-panel">
            <p className="eyebrow">Safe graphics mode</p>
            <h2>City scene paused</h2>
            <p>{sceneError ?? "The high-detail scene could not be started on this run."}</p>
            <p className="micro-copy">The app is still running. You can keep using menus and session controls, then retry full graphics once the renderer is stable.</p>
            <div className="world-status__actions">
              <button onClick={retryScene}>Retry Full Graphics</button>
            </div>
          </div>
        )}

        {pointerLocked ? <div className="screen-reticle" /> : null}

        <div className="control-cluster glass-panel">
          <div className="control-group control-group--primary">
            <button className={overlayMode === "phone" ? "is-selected" : ""} onClick={() => showOverlay("phone")}>Phone 1</button>
            <button className={overlayMode === "mdt" ? "is-selected" : ""} onClick={() => showOverlay("mdt")}>MDT 2</button>
            <button className={overlayMode === "market" ? "is-selected" : ""} onClick={() => showOverlay("market")}>Market 3</button>
          </div>
          <div className="control-group control-group--secondary">
            <button onClick={() => (pointerLocked ? releasePointerLock() : requestPointerLock())}>{pointerLocked ? "Unlock Esc" : "Lock View L"}</button>
            <button onClick={() => setBottomDockOpen((current) => !current)}>{bottomDockOpen && hudVisible ? "Hide Actions B" : "Actions B"}</button>
            <button onClick={() => setHudVisible((current) => !current)}>{hudVisible ? "Focus H" : "HUD H"}</button>
          </div>
          <div className="control-group control-group--graphics">
            <button className={graphicsPreset === "stable" && !safeGraphicsMode ? "is-selected" : ""} onClick={() => changeGraphicsPreset("stable")}>Stable</button>
            <button className={graphicsPreset === "balanced" && !safeGraphicsMode ? "is-selected" : ""} onClick={() => changeGraphicsPreset("balanced")}>Balanced</button>
            <button className={graphicsPreset === "full" && !safeGraphicsMode ? "is-selected" : ""} onClick={() => changeGraphicsPreset("full")}>Cinematic</button>
          </div>
        </div>

        <div className="field-hint glass-panel">
          <p className="eyebrow">Controls</p>
          <p className="micro-copy">Click the world to lock the mouse and look around. Use WASD to move, Shift to sprint, C to crouch, E or Space to raise into an action stance, and L or H to clear the screen.</p>
          <p className="micro-copy">Graphics: Stable for the smoothest play, Balanced for the best everyday desktop mix, and Cinematic for the heaviest visuals.</p>
        </div>

        {!session ? <div className="top-banner glass-panel">
          <div className="banner-intro">
            <p className="eyebrow">{isDesktop ? "Desktop operations build" : "Local operations build"}</p>
            <h1>Garner Emergency Response</h1>
            <p className="lead">
              {"Aidan Garner's desktop emergency-response sandbox with a stronger city layout, clearer mission flow, and sharper role identity."}
            </p>
            <div className="banner-metrics">
              <article className="metric-card">
                <span>Population</span>
                <strong>{players.length}</strong>
              </article>
              <article className="metric-card">
                <span>Incidents</span>
                <strong>{visibleCalls.length}</strong>
              </article>
              <article className="metric-card">
                <span>Cycle</span>
                <strong>{sceneProfile.label}</strong>
              </article>
              <article className="metric-card">
                <span>Day / Night</span>
                <strong>{`${formatMinutes(DAY_LENGTH_MS)} / ${formatMinutes(NIGHT_LENGTH_MS)}`}</strong>
              </article>
            </div>
          </div>

          <div className="connect-card connect-card--launch">
            <div className="status-pill">Ready for dispatch</div>
            <label>
              Call sign
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <button onClick={connect}>{isDesktop ? "Launch Session" : "Join Server"}</button>
            <p className="micro-copy">Begin as a civilian, then rotate into police, fire, patrol, or public works once the city is live.</p>
          </div>
        </div> : null}

        {session && hudVisible ? <div className={`player-hud glass-panel ${pointerLocked ? "player-hud--locked" : ""}`}>
          <div className="player-hud__row">
            <div>
              <p className="eyebrow">{overlayLabel} live</p>
              <p className="status-name">{me?.name ?? name}</p>
              <p className="micro-copy">{me ? GAME_CONFIG.teams[me.team].displayName : "Offline"}</p>
            </div>
            <div className="player-hud__chips">
              <span className="hud-chip">{`${dayNightLabel} | ${sceneProfile.label}`}</span>
              <span className="hud-chip">{`Day ${formatMinutes(DAY_LENGTH_MS)} | Night ${formatMinutes(NIGHT_LENGTH_MS)}`}</span>
              <span className="hud-chip">{`Graphics ${graphicsStatus}`}</span>
              {me ? <span className="hud-chip">{`Crime ${me.criminalStatus} | Heat ${me.criminalHeat}`}</span> : null}
              <span className="hud-chip">{controlledVehicle ? GAME_CONFIG.vehicles[controlledVehicle.vehicleId].displayName : "On foot"}</span>
            </div>
          </div>
          <p className="player-hud__objective">{currentObjective}</p>
        </div> : null}

        {hudVisible && leftRailOpen ? <aside className="left-rail glass-panel">
          {overlayMode === "phone" ? (
            <>
              <section className="rail-section rail-section--accent">
                <p className="eyebrow">Phone</p>
                <h2>{me ? `${me.name} profile` : "Session profile"}</h2>
                <p className="lead compact">{savedProfileSummary}</p>
                <p className="micro-copy">Profile state now persists locally between desktop sessions.</p>
              </section>

              <section className="rail-section">
                <h2>Wallet</h2>
                {me ? (
                  <div className="stat-list">
                    <p><span>Cash</span><strong>{formatCurrency(me.cash)}</strong></p>
                    <p><span>Bank</span><strong>{formatCurrency(me.bank)}</strong></p>
                    <p><span>Wanted</span><strong>{me.wanted}</strong></p>
                    <p><span>Criminal</span><strong>{me.criminalStatus}</strong></p>
                    <p><span>Jail</span><strong>{me.jailedUntil ? formatCountdown(me.jailedUntil) : "Clear"}</strong></p>
                    <p><span>Job Rep</span><strong>{me.civilianJobReputation}</strong></p>
                    <p><span>Rank</span><strong>{me.rankByTeam[me.team] ?? "N/A"}</strong></p>
                  </div>
                ) : (
                  <p>Connect to load a local profile.</p>
                )}
              </section>

              {me?.activeJobId ? (
                <section className="rail-section">
                  <h2>Active Route</h2>
                  <div className="brief-card">
                    <strong>{GAME_CONFIG.jobs[me.activeJobId].displayName}</strong>
                    <span>{GAME_CONFIG.jobs[me.activeJobId].steps[me.activeJobStep] ?? "Finish the route"}</span>
                    <span>{`Reputation ${me.civilianJobReputation}`}</span>
                  </div>
                </section>
              ) : null}

              <section className="rail-section">
                <h2>Start Here</h2>
                <ul className="stack-list compact-list guide-list">
                  {guideSteps.map((step) => (
                    <li key={step.label} className={step.done ? "is-complete" : ""}>
                      <div>
                        <strong>{step.label}</strong>
                        <span>{step.detail}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {me ? (
                <section className="rail-section">
                  <h2>Owned Gear</h2>
                  <ul className="stack-list compact-list">
                    {ownedTools.length > 0 ? ownedTools.map((toolId) => (
                      <li key={toolId}>
                        <strong>{GAME_CONFIG.tools[toolId].displayName}</strong>
                        <span>x{me.inventory[toolId]}</span>
                      </li>
                    )) : <li><span>No owned tools yet.</span></li>}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}

          {overlayMode === "mdt" ? (
            <>
              <section className="rail-section rail-section--accent">
                <p className="eyebrow">Current objective</p>
                <h2>{me ? `${GAME_CONFIG.teams[me.team].displayName} briefing` : "Mission briefing"}</h2>
                <p className="lead compact">{currentObjective}</p>
                {activeCall ? (
                  <div className="brief-card">
                    <strong>{activeCall.title}</strong>
                    <span>{activeCall.location}</span>
                    <span>{formatCurrency(activeCall.reward)} payout</span>
                  </div>
                ) : null}
                <div className="subtab-row">
                  <button className={mdtTab === "dispatch" ? "is-active" : ""} onClick={() => setMdtTab("dispatch")}>Dispatch</button>
                  <button className={mdtTab === "records" ? "is-active" : ""} onClick={() => setMdtTab("records")}>Records</button>
                  <button className={mdtTab === "units" ? "is-active" : ""} onClick={() => setMdtTab("units")}>Units</button>
                  <button className={mdtTab === "service" ? "is-active" : ""} onClick={() => setMdtTab("service")}>Service</button>
                </div>
              </section>

              {mdtTab === "dispatch" ? (
                <section className="rail-section">
                  <h2>Dispatch Feed</h2>
                  {selectedDispatchCall ? (
                    <div className="brief-card">
                      <strong>{selectedDispatchCall.title}</strong>
                      <span>{selectedDispatchCall.description}</span>
                      <span>{`${selectedDispatchCall.location} | ${formatCurrency(selectedDispatchCall.reward)}`}</span>
                    </div>
                  ) : null}
                  <ul className="stack-list compact-list alert-list">
                    {visibleCalls.length > 0 ? visibleCalls.map((call) => (
                      <li key={call.id}>
                        <div>
                          <strong>{call.title}</strong>
                          <span>{call.description}</span>
                        </div>
                        <button type="button" onClick={() => setSelectedDispatchCallId(call.id)}>{call.location}</button>
                      </li>
                    )) : <li><span>No visible incidents right now.</span></li>}
                  </ul>
                </section>
              ) : null}

              {mdtTab === "records" ? (
                <section className="rail-section">
                  <h2>Lookup</h2>
                  <input className="search-input" placeholder="Search name or team" value={mdtSearchQuery} onChange={(event) => setMdtSearchQuery(event.target.value)} />
                  <div className="record-list">
                    {filteredRecordPlayers.length > 0 ? filteredRecordPlayers.map((player) => (
                      <button key={player.id} className={`catalog-card ${selectedRecordPlayer?.id === player.id ? "is-selected-card" : ""}`} onClick={() => setSelectedRecordPlayerId(player.id)}>
                        <div>
                          <strong>{player.name}</strong>
                          <span>{GAME_CONFIG.teams[player.team].displayName}</span>
                        </div>
                        <span>Wanted {player.wanted}</span>
                      </button>
                    )) : <p className="micro-copy">No matching records.</p>}
                  </div>
                </section>
              ) : null}

              {mdtTab === "units" && me ? (
                <section className="rail-section">
                  <h2>Unit State</h2>
                  <div className="stat-list">
                    <p><span>Team</span><strong>{GAME_CONFIG.teams[me.team].displayName}</strong></p>
                    <p><span>Call</span><strong>{me.claimedCallId ?? "None"}</strong></p>
                    <p><span>Open Calls</span><strong>{visibleCalls.length}</strong></p>
                    <p><span>Vehicle</span><strong>{controlledVehicle ? GAME_CONFIG.vehicles[controlledVehicle.vehicleId].displayName : "On Foot"}</strong></p>
                    <p><span>Position</span><strong>{me.position.x.toFixed(1)}, {me.position.y.toFixed(1)}</strong></p>
                  </div>
                </section>
              ) : null}

              {mdtTab === "service" ? (
                <section className="rail-section">
                  <h2>Service Queue</h2>
                  <ul className="stack-list compact-list">
                    {visibleCalls.length > 0 ? visibleCalls.map((call) => (
                      <li key={call.id}>
                        <div>
                          <strong>{call.title}</strong>
                          <span>{call.location}</span>
                        </div>
                        <span>{formatCurrency(call.reward)}</span>
                      </li>
                    )) : <li><span>No current service queue.</span></li>}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}

          {overlayMode === "market" ? (
            <>
              <section className="rail-section rail-section--accent">
                <p className="eyebrow">Marketplace</p>
                <h2>Assets and routes</h2>
                <p className="lead compact">Buy the tools, vehicles, property, and jobs that drive the civilian and service loops.</p>
              </section>

              {me ? (
                <section className="rail-section">
                  <h2>Owned Assets</h2>
                  <ul className="stack-list compact-list">
                    <li><strong>Owned Houses</strong><span>{me.housing.length}</span></li>
                    <li><strong>Owned Vehicles</strong><span>{me.vehicles.length}</span></li>
                    <li><strong>Selected Vehicle</strong><span>{me.selectedVehicleId ?? "None"}</span></li>
                    <li><strong>Deployed</strong><span>{deployedOwnedVehicle ? GAME_CONFIG.vehicles[deployedOwnedVehicle.vehicleId].displayName : "Stored"}</span></li>
                    <li><strong>Occupancy</strong><span>{controlledVehicle ? "Driving" : deployedOwnedVehicle ? "Deployed" : "None"}</span></li>
                    <li><strong>Fuel / Health</strong><span>{deployedOwnedVehicle ? `${Math.round(deployedOwnedVehicle.fuel)} / ${Math.round(deployedOwnedVehicle.health)}` : "-"}</span></li>
                  </ul>
                  <div className="section-split">
                    <button onClick={() => send(session, { type: "spawnVehicle" })} disabled={!me.selectedVehicleId}>Deploy</button>
                    <button onClick={() => send(session, { type: "despawnVehicle" })} disabled={!deployedOwnedVehicle}>Store</button>
                    <button onClick={() => deployedOwnedVehicle ? send(session, { type: "enterVehicle", vehicleEntityId: deployedOwnedVehicle.id }) : null} disabled={!deployedOwnedVehicle || Boolean(controlledVehicle)}>Enter</button>
                    <button onClick={() => send(session, { type: "exitVehicle" })} disabled={!controlledVehicle}>Exit</button>
                  </div>
                </section>
              ) : null}

              <section className="rail-section">
                <h2>Stations</h2>
                <ul className="stack-list compact-list">
                  {stationLocations.map((location) => (
                    <li key={location.id}>
                      <div>
                        <strong>{location.name}</strong>
                        <span>{location.summary}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rail-section">
                <h2>County Hubs</h2>
                <ul className="stack-list compact-list">
                  {civicHubLocations.map((location) => (
                    <li key={location.id}>
                      <div>
                        <strong>{location.name}</strong>
                        <span>{location.summary}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}
        </aside> : null}

        {hudVisible && rightRailOpen ? <aside className="right-rail glass-panel">
          {overlayMode === "phone" ? (
            <>
              <section className="rail-section rail-section--accent">
                <p className="eyebrow">Messages</p>
                <h2>Notifications</h2>
                <ul className="stack-list compact-list">
                  {messages.length > 0 ? messages.map((message, index) => (
                    <li key={`${message}-${index}`}>{message}</li>
                  )) : <li><span>No notifications yet.</span></li>}
                </ul>
              </section>

              {me ? (
                <section className="rail-section">
                  <h2>Bank Transfer</h2>
                  <div className="form-grid">
                    <input placeholder="Target player name" value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)} />
                    <input placeholder="Amount" inputMode="numeric" value={transferAmount} onChange={(event) => setTransferAmount(event.target.value)} />
                    <button
                      className="span-two"
                      onClick={() => send(session, {
                        type: "transferFunds",
                        targetName: transferTarget,
                        amount: Number(transferAmount) || 0,
                      })}
                    >
                      Send Transfer
                    </button>
                  </div>
                  <div className="section-split">
                    <button onClick={() => send(session, { type: "depositCash", amount: 250 })}>Deposit 250</button>
                    <button onClick={() => send(session, { type: "withdrawCash", amount: 250 })}>Withdraw 250</button>
                  </div>
                </section>
              ) : null}

              <section className="rail-section">
                <h2>District Watch</h2>
                <div className="district-grid">
                  {districtLocations.map((district) => (
                    <article key={district.id} className="district-card">
                      <div className="district-swatch" style={{ background: district.accent }} />
                      <div>
                        <strong>{district.name}</strong>
                        <span>{district.summary}</span>
                      </div>
                      <em>{getDistrictActivity(snapshot?.calls ?? [], district.name)}</em>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {overlayMode === "mdt" ? (
            <>
              {mdtTab === "dispatch" ? (
                <>
                  <section className="rail-section rail-section--accent">
                    <p className="eyebrow">World overview</p>
                    <h2>Stations and sites</h2>
                    <ul className="stack-list compact-list">
                      {stationLocations.map((location) => (
                        <li key={location.id}>
                          <div>
                            <strong>{location.name}</strong>
                            <span>{location.summary}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="rail-section">
                    <h2>Crime Sites</h2>
                    <ul className="stack-list compact-list">
                      {crimeLocations.map((location) => (
                        <li key={location.id}>
                          <div>
                            <strong>{location.name}</strong>
                            <span>{location.summary}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="rail-section">
                    <h2>Civilian and Service Hubs</h2>
                    <ul className="stack-list compact-list">
                      {civicHubLocations.map((location) => (
                        <li key={location.id}>
                          <div>
                            <strong>{location.name}</strong>
                            <span>{location.summary}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              ) : null}

              {mdtTab === "records" && selectedRecordPlayer ? (
                <>
                  <section className="rail-section rail-section--accent">
                    <p className="eyebrow">Selected record</p>
                    <h2>{selectedRecordPlayer.name}</h2>
                    <div className="stat-list">
                      <p><span>Team</span><strong>{GAME_CONFIG.teams[selectedRecordPlayer.team].displayName}</strong></p>
                      <p><span>Wanted</span><strong>{selectedRecordPlayer.wanted}</strong></p>
                      <p><span>Criminal</span><strong>{selectedRecordPlayer.criminalStatus}</strong></p>
                      <p><span>Jail</span><strong>{selectedRecordPlayer.jailedUntil ? formatCountdown(selectedRecordPlayer.jailedUntil) : "Clear"}</strong></p>
                      <p><span>BOLO</span><strong>{selectedRecordPlayer.bolo ? "Active" : "Clear"}</strong></p>
                      <p><span>Vehicle</span><strong>{selectedRecordPlayer.selectedVehicleId ? GAME_CONFIG.vehicles[selectedRecordPlayer.selectedVehicleId].displayName : "None"}</strong></p>
                    </div>
                    <div className="section-split">
                      <button onClick={() => send(session, { type: "toggleBolo", targetPlayerId: selectedRecordPlayer.id })} disabled={!lawEnforcementMode || selectedRecordPlayer.id === me?.id}>{selectedRecordPlayer.bolo ? "Clear BOLO" : "Issue BOLO"}</button>
                      <button onClick={() => send(session, { type: "issueWarning", targetPlayerId: selectedRecordPlayer.id, reason: "Field contact logged" })} disabled={!lawEnforcementMode || selectedRecordPlayer.id === me?.id}>Field Warning</button>
                    </div>
                  </section>

                  <section className="rail-section">
                    <h2>History</h2>
                    <ul className="stack-list compact-list history-list">
                      {selectedRecordPlayer.citations.slice(0, 4).map((citation, index) => (
                        <li key={`citation-${index}`}>
                          <div>
                            <strong>{citation.reason}</strong>
                            <span>{citation.issuedBy} | {formatTimestamp(citation.timestamp)}</span>
                          </div>
                          <span>{formatCurrency(citation.fine)}</span>
                        </li>
                      ))}
                      {selectedRecordPlayer.warnings.slice(0, 4).map((warning, index) => (
                        <li key={`warning-${index}`}>
                          <div>
                            <strong>{warning.reason}</strong>
                            <span>{warning.issuedBy} | {formatTimestamp(warning.timestamp)}</span>
                          </div>
                          <span>Warning</span>
                        </li>
                      ))}
                      {selectedRecordPlayer.citations.length === 0 && selectedRecordPlayer.warnings.length === 0 ? <li><span>No record history yet.</span></li> : null}
                    </ul>
                  </section>
                </>
              ) : null}

              {mdtTab === "units" ? (
                <>
                  <section className="rail-section">
                    <h2>Unit Board</h2>
                    <ul className="stack-list compact-list">
                      {players.filter((player) => player.team !== "Civilian").map((player) => (
                        <li key={player.id}>
                          <div>
                            <strong>{player.name}</strong>
                            <span>{GAME_CONFIG.teams[player.team].shortLabel} | {player.claimedCallId ? "Committed" : "Available"}</span>
                          </div>
                          <span>{player.activeVehicleEntityId ? "Vehicle" : "On Foot"}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="rail-section rail-section--accent">
                    <p className="eyebrow">Vehicle board</p>
                    <h2>Active vehicles</h2>
                    <ul className="stack-list compact-list">
                      {activeVehicles.length > 0 ? activeVehicles.map((vehicle) => (
                        <li key={vehicle.id}>
                          <div>
                            <strong>{GAME_CONFIG.vehicles[vehicle.vehicleId].displayName}</strong>
                            <span>{vehicle.occupantPlayerId ? "Occupied" : "Unoccupied"}</span>
                          </div>
                          <span>{Math.round(vehicle.fuel)} fuel</span>
                        </li>
                      )) : <li><span>No active vehicles.</span></li>}
                    </ul>
                  </section>

                  <section className="rail-section">
                    <h2>Stations</h2>
                    <ul className="stack-list compact-list">
                      {stationLocations.map((location) => (
                        <li key={location.id}>
                          <div>
                            <strong>{location.name}</strong>
                            <span>{location.summary}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              ) : null}

              {mdtTab === "service" ? (
                <section className="rail-section rail-section--accent">
                  <p className="eyebrow">District watch</p>
                  <h2>Service pressure</h2>
                  <div className="district-grid">
                    {districtLocations.map((district) => (
                      <article key={district.id} className="district-card">
                        <div className="district-swatch" style={{ background: district.accent }} />
                        <div>
                          <strong>{district.name}</strong>
                          <span>{district.summary}</span>
                        </div>
                        <em>{getDistrictActivity(snapshot?.calls ?? [], district.name)}</em>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {overlayMode === "market" ? (
            <>
              <section className="rail-section rail-section--accent">
                <p className="eyebrow">Role actions</p>
                <h2>Choose assignment</h2>
                <p className="micro-copy">Service roles require a clean record. Clear wanted status before joining police, rescue, or DOT.</p>
                <div className="role-card-list">
                  {teamCards.map(({ teamId, team, homeLocation }) => {
                    const selected = me?.team === teamId;
                    const blocked = Boolean(me?.wanted && teamId !== "Civilian");

                    return (
                      <button
                        key={teamId}
                        type="button"
                        className={`role-card ${selected ? "is-selected-card" : ""}`}
                        onClick={() => send(session, { type: "switchTeam", team: teamId })}
                        disabled={blocked && !selected}
                      >
                        <div className="role-card__header">
                          <span className="status-pill" style={{ background: `${team.accent}22`, color: team.accent }}>{team.shortLabel}</span>
                          <strong>{team.displayName}</strong>
                        </div>
                        <p>{team.summary}</p>
                        <ul className="role-card__duties">
                          {team.duties.map((duty) => (
                            <li key={duty}>{duty}</li>
                          ))}
                        </ul>
                        <div className="role-card__footer">
                          <span>{homeLocation?.name ?? "County access point"}</span>
                          <span>{selected ? "Active" : blocked ? "Clear wanted first" : "Switch role"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {me ? (
                <section className="rail-section">
                  <h2>Field Tools</h2>
                  <div className="section-split">
                    <button onClick={() => send(session, { type: "logCameraOffense", offenseType: "Speeding", fine: 75 })}>Log Speeding</button>
                    <button onClick={() => send(session, { type: "logCameraOffense", offenseType: "Red Light", fine: 110 })}>Log Red Light</button>
                  </div>
                </section>
              ) : null}

              {me?.team === "Civilian" ? (
                <section className="rail-section">
                  <h2>Criminal Activity</h2>
                  <p className="micro-copy">Low-tier crimes now create visible heat, wanted pressure, and stronger police response if you keep escalating.</p>
                  {me.activeCrime ? (
                    <div className="brief-card">
                      <strong>{crimeConfigs[me.activeCrime.crimeId].displayName}</strong>
                      <span>{crimeConfigs[me.activeCrime.crimeId].stages[me.activeCrime.stageIndex] ?? "Finish the chain"}</span>
                      <span>{`Stage ${me.activeCrime.stageIndex + 1}/${crimeConfigs[me.activeCrime.crimeId].stages.length}`}</span>
                    </div>
                  ) : null}
                  <div className="crime-action-list">
                    {crimeEntries.map(({ crimeId, crime }) => (
                      <button
                        key={crimeId}
                        type="button"
                        className="crime-action-card"
                        onClick={() => send(session, { type: "startCrime", crimeId })}
                        disabled={Boolean(me.activeCrime || me.pendingPayout)}
                      >
                        <div>
                          <strong>{crime.displayName}</strong>
                          <span>{`${formatCurrency(crime.payoutMin)}-${formatCurrency(crime.payoutMax)} | +${crime.wanted} wanted | ${crime.stages.length} stages`}</span>
                        </div>
                        <span>{GAME_CONFIG.tools[crime.requiredTool].displayName}</span>
                      </button>
                    ))}
                  </div>
                  <div className="stat-list">
                    <p><span>Heat</span><strong>{me.criminalHeat}</strong></p>
                    <p><span>Chain</span><strong>{me.activeCrime ? `${me.activeCrime.stageIndex + 1}/${crimeConfigs[me.activeCrime.crimeId].stages.length}` : "Idle"}</strong></p>
                    <p><span>Payout</span><strong>{me.pendingPayout ? formatCountdown(me.pendingPayout.secureAt) : "None"}</strong></p>
                  </div>
                </section>
              ) : null}

              {selectedVehicle ? (
                <section className="rail-section">
                  <h2>Vehicle Spec</h2>
                  <div className="stat-list">
                    <p><span>Model</span><strong>{selectedVehicle.displayName}</strong></p>
                    <p><span>Top Speed</span><strong>{selectedVehicle.topSpeed}</strong></p>
                    <p><span>Fuel</span><strong>{selectedVehicle.fuelCapacity}</strong></p>
                    <p><span>Durability</span><strong>{selectedVehicle.durability}</strong></p>
                  </div>
                </section>
              ) : null}

              {me?.team === "Civilian" ? (
                <section className="rail-section">
                  <h2>Civilian Jobs</h2>
                  <div className="role-card-list">
                    {jobEntries.map(({ jobId, job, hubLocation }) => {
                      const unlocked = me.civilianJobReputation >= job.unlockReputation;
                      const active = me.activeJobId === jobId;

                      return (
                        <button
                          key={jobId}
                          type="button"
                          className={`role-card ${active ? "is-selected-card" : ""}`}
                          onClick={() => send(session, { type: "startJob", jobId })}
                          disabled={!unlocked}
                        >
                          <div className="role-card__header">
                            <strong>{job.displayName}</strong>
                          </div>
                          <p>{job.summary}</p>
                          <div className="role-card__footer">
                            <span>{hubLocation?.name ?? "County route hub"}</span>
                            <span>{unlocked ? (active ? "Active" : `${formatCurrency(job.reward)} payout`) : `Unlock at rep ${job.unlockReputation}`}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </aside> : null}

        {session && hudVisible && bottomDockOpen ? <div className="bottom-dock bottom-dock--quick glass-panel">
          <section className="dock-section dock-section--quick-actions">
            <p className="eyebrow">Quick actions</p>
            <div className="quick-action-grid">
              {overlayMode === "phone" ? (
                <>
                  {jobEntries.filter(({ job }) => (me?.civilianJobReputation ?? 0) >= job.unlockReputation).map(({ jobId, job }) => (
                    <button key={jobId} onClick={() => send(session, { type: "startJob", jobId })}>{job.displayName}</button>
                  ))}
                  <button onClick={() => send(session, { type: "advanceJob" })}>Advance Job</button>
                  {me?.team === "Civilian" ? <button onClick={() => send(session, { type: "advanceCrime" } as ClientCrimeAction)} disabled={!me?.activeCrime}>Advance Crime</button> : null}
                </>
              ) : null}

              {overlayMode === "mdt" ? (
                <>
                  <button onClick={() => send(session, { type: "claimCall", callId: selectedDispatchCall?.id })} disabled={!selectedDispatchCall}>Claim Call</button>
                  <button onClick={() => send(session, { type: "completeCall" })} disabled={!me?.claimedCallId}>Complete Call</button>
                  <button onClick={() => selectedRecordPlayer ? send(session, { type: "toggleBolo", targetPlayerId: selectedRecordPlayer.id }) : null} disabled={!selectedRecordPlayer || !lawEnforcementMode || selectedRecordPlayer.id === me?.id}>{selectedRecordPlayer?.bolo ? "Clear BOLO" : "Issue BOLO"}</button>
                  <button onClick={() => selectedRecordPlayer ? send(session, { type: "issueWarning", targetPlayerId: selectedRecordPlayer.id, reason: "Field warning" }) : null} disabled={!selectedRecordPlayer || !lawEnforcementMode || selectedRecordPlayer.id === me?.id}>Warn</button>
                  <button onClick={() => selectedRecordPlayer ? send(session, { type: "issueCitation", targetPlayerId: selectedRecordPlayer.id }) : null} disabled={!selectedRecordPlayer || !lawEnforcementMode || selectedRecordPlayer.id === me?.id}>Cite</button>
                  <button onClick={() => selectedRecordPlayer ? send(session, { type: "arrestPlayer", targetPlayerId: selectedRecordPlayer.id }) : null} disabled={!selectedRecordPlayer || !lawEnforcementMode || selectedRecordPlayer.id === me?.id || selectedRecordPlayer.wanted <= 0}>Arrest</button>
                </>
              ) : null}

              {overlayMode === "market" ? (
                <>
                  <button onClick={() => send(session, { type: "spawnVehicle" })} disabled={!me?.selectedVehicleId}>Deploy</button>
                  <button onClick={() => send(session, { type: "despawnVehicle" })} disabled={!deployedOwnedVehicle}>Store</button>
                  <button onClick={() => deployedOwnedVehicle ? send(session, { type: "enterVehicle", vehicleEntityId: deployedOwnedVehicle.id }) : null} disabled={!deployedOwnedVehicle || Boolean(controlledVehicle)}>Enter</button>
                  <button onClick={() => send(session, { type: "exitVehicle" })} disabled={!controlledVehicle}>Exit</button>
                  {me?.team === "Civilian" ? <button onClick={() => send(session, { type: "startCrime", crimeId: "atm_breach" })} disabled={Boolean(me.activeCrime || me.pendingPayout)}>ATM Breach</button> : null}
                  {me?.team === "Civilian" ? <button onClick={() => send(session, { type: "startCrime", crimeId: "vehicle_theft" })} disabled={Boolean(me.activeCrime || me.pendingPayout)}>Vehicle Theft</button> : null}
                  {me?.team === "Civilian" ? <button onClick={() => send(session, { type: "advanceCrime" } as ClientCrimeAction)} disabled={!me?.activeCrime}>Advance Crime</button> : null}
                </>
              ) : null}
            </div>
          </section>

          <section className="dock-section dock-section--status">
            <div className="stat-list">
              <p><span>Cash</span><strong>{me ? formatCurrency(me.cash) : "-"}</strong></p>
              <p><span>Bank</span><strong>{me ? formatCurrency(me.bank) : "-"}</strong></p>
              <p><span>Status</span><strong>{controlledVehicle ? "Driving" : "On Foot"}</strong></p>
              <p><span>Cycle</span><strong>{`${dayNightLabel} | ${sceneProfile.label}`}</strong></p>
              <p><span>Graphics</span><strong>{graphicsStatus}</strong></p>
              <p><span>Criminal</span><strong>{me ? `${me.criminalStatus} | ${me.criminalHeat}` : "-"}</strong></p>
              <p><span>Robbery</span><strong>{me?.activeCrime ? `${crimeConfigs[me.activeCrime.crimeId].displayName} ${me.activeCrime.stageIndex + 1}/${crimeConfigs[me.activeCrime.crimeId].stages.length}` : me?.pendingPayout ? "Getaway" : "Idle"}</strong></p>
              <p><span>Jail</span><strong>{me?.jailedUntil ? formatCountdown(me.jailedUntil) : "Clear"}</strong></p>
              <p><span>Job Rep</span><strong>{me?.civilianJobReputation ?? 0}</strong></p>
            </div>
          </section>
        </div> : null}
      </div>
    </div>
  );
}
