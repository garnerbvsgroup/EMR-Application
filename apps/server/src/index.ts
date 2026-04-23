import cors from "cors";
import express from "express";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { nanoid } from "nanoid";
import {
  type ActiveVehicleState,
  DEFAULT_PLAYER_STATE,
  GAME_CONFIG,
  type ActiveCall,
  type ClientAction,
  type CrimeId,
  type PersistedPlayerProfile,
  type PlayerPublicState,
  type ServerSnapshot,
  type TeamId,
  type VehicleId,
  type WorldPosition,
} from "@redwood/shared";

type ConnectedPlayer = PlayerPublicState & {
  socketId: string;
  lastKnownPosition?: { x: number; y: number };
};

type WorldState = {
  players: Map<string, ConnectedPlayer>;
  calls: ActiveCall[];
  vehicles: Map<string, ActiveVehicleState>;
};

type RankedTeamId = keyof typeof GAME_CONFIG.ranks;

const currentFilePath = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);
const clientDistPath = process.env.REDWOOD_CLIENT_DIST || join(currentDirPath, "..", "..", "client", "dist");
const dataDirectoryPath = process.env.REDWOOD_DATA_DIR || join(currentDirPath, "..", "..", ".redwood-data");
const profilesFilePath = join(dataDirectoryPath, "profiles.json");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

const world: WorldState = {
  players: new Map(),
  calls: [],
  vehicles: new Map(),
};

const bySocket = new Map<string, string>();
const profileStore = loadProfiles();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function ensureDataDirectory() {
  mkdirSync(dataDirectoryPath, { recursive: true });
}

function normalizeProfileKey(name: string) {
  return name.trim().toLowerCase();
}

function loadProfiles() {
  ensureDataDirectory();
  if (!existsSync(profilesFilePath)) {
    return new Map<string, PersistedPlayerProfile>();
  }

  try {
    const fileContents = readFileSync(profilesFilePath, "utf8");
    const parsed = JSON.parse(fileContents) as Record<string, PersistedPlayerProfile>;
    return new Map(Object.entries(parsed));
  } catch (error) {
    console.warn("Failed to load player profiles.", error);
    return new Map<string, PersistedPlayerProfile>();
  }
}

function flushProfiles() {
  ensureDataDirectory();
  const serialized = Object.fromEntries(Array.from(profileStore.entries()).sort(([left], [right]) => left.localeCompare(right)));
  writeFileSync(profilesFilePath, JSON.stringify(serialized, null, 2));
}

function schedulePersist() {
  if (persistTimer) {
    return;
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushProfiles();
  }, 250);
}

function savePlayerProfile(player: ConnectedPlayer) {
  profileStore.set(normalizeProfileKey(player.name), {
    name: player.name,
    team: player.team,
    position: player.lastKnownPosition ?? player.position,
    cash: player.cash,
    bank: player.bank,
    wanted: player.wanted,
    criminalStatus: player.criminalStatus,
    criminalHeat: player.criminalHeat,
    wantedExpiresAt: player.wantedExpiresAt,
    lastCrimeAt: player.lastCrimeAt,
    jailedUntil: player.jailedUntil,
    jailedBy: player.jailedBy,
    jailReason: player.jailReason,
    claimedCallId: undefined,
    activeCrime: undefined,
    pendingPayout: undefined,
    citations: player.citations,
    warnings: player.warnings,
    cameraOffenses: player.cameraOffenses,
    rankByTeam: player.rankByTeam,
    serviceXpByTeam: player.serviceXpByTeam,
    housing: player.housing,
    activeHouseId: player.activeHouseId,
    vehicles: player.vehicles,
    selectedVehicleId: player.selectedVehicleId,
    activeVehicleEntityId: undefined,
    activeJobId: player.activeJobId,
    activeJobStep: player.activeJobStep,
    civilianJobReputation: player.civilianJobReputation,
    inventory: player.inventory,
    offenses: player.offenses,
    bolo: player.bolo,
    lastSeenAt: Date.now(),
  });
  schedulePersist();
}

function getCrimeLocation(crimeId: CrimeId) {
  switch (crimeId) {
    case "atm_breach":
      return "River City ATM Network";
    case "house_burglary":
      return "Springfield Vacant Homes";
    case "retail_burglary":
    case "office_safe":
    case "vehicle_theft":
      return "East County Retail Strip";
  }
}

function getTeamSpawnPosition(team: TeamId, spawnIndex: number) {
  const stationByTeam: Partial<Record<TeamId, string>> = {
    CityPolice: "city_police_hq",
    StatePatrol: "state_patrol_post",
    FireRescue: "fire_rescue_station",
    PublicWorks: "public_works_yard",
  };

  const locationId = stationByTeam[team];
  if (locationId) {
    const station = GAME_CONFIG.worldLocations.find((location) => location.id === locationId);
    if (station) {
      return {
        x: station.position.x + (spawnIndex % 2) * 2 - 1,
        y: station.position.y + Math.floor(spawnIndex / 2) * 2,
      };
    }
  }

  const civilianBase = GAME_CONFIG.worldLocations.find((location) => location.id === "bramble_ridge");
  if (civilianBase) {
    return {
      x: civilianBase.position.x + (spawnIndex % 3) * 3 - 2,
      y: civilianBase.position.y + Math.floor(spawnIndex / 3) * 3 - 2,
    };
  }

  return {
    x: ((spawnIndex % 4) - 1.5) * 12,
    y: (Math.floor(spawnIndex / 4) - 1.5) * 12,
  };
}

function createPlayerState(name: string): ConnectedPlayer {
  const spawnIndex = world.players.size;
  const spawnPosition = getTeamSpawnPosition("Civilian", spawnIndex);

  const persistedProfile = profileStore.get(normalizeProfileKey(name));
  const restoredProfile = persistedProfile ? structuredClone(persistedProfile) : null;

  if (restoredProfile) {
    return {
      ...DEFAULT_PLAYER_STATE,
      ...restoredProfile,
      id: nanoid(10),
      name,
      position: restoredProfile.position,
      lastKnownPosition: restoredProfile.position,
      socketId: "",
    };
  }

  return {
    ...DEFAULT_PLAYER_STATE,
    id: nanoid(10),
    name,
    position: spawnPosition,
    lastKnownPosition: spawnPosition,
    bank: 1000,
    cash: 3000,
    housing: [],
    vehicles: [],
    citations: [],
    warnings: [],
    cameraOffenses: [],
    socketId: "",
  };
}

function buildSnapshot(): ServerSnapshot {
  return {
    serverName: GAME_CONFIG.serverName,
    motd: GAME_CONFIG.motd,
    players: Array.from(world.players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      position: player.lastKnownPosition ?? player.position,
      cash: player.cash,
      bank: player.bank,
      wanted: player.wanted,
      criminalStatus: player.criminalStatus,
      criminalHeat: player.criminalHeat,
      wantedExpiresAt: player.wantedExpiresAt,
      lastCrimeAt: player.lastCrimeAt,
      jailedUntil: player.jailedUntil,
      jailedBy: player.jailedBy,
      jailReason: player.jailReason,
      claimedCallId: player.claimedCallId,
      activeCrime: player.activeCrime,
      pendingPayout: player.pendingPayout,
      citations: player.citations,
      warnings: player.warnings,
      cameraOffenses: player.cameraOffenses,
      rankByTeam: player.rankByTeam,
      serviceXpByTeam: player.serviceXpByTeam,
      housing: player.housing,
      activeHouseId: player.activeHouseId,
      vehicles: player.vehicles,
      selectedVehicleId: player.selectedVehicleId,
      activeVehicleEntityId: player.activeVehicleEntityId,
      activeJobId: player.activeJobId,
      activeJobStep: player.activeJobStep,
      civilianJobReputation: player.civilianJobReputation,
      inventory: player.inventory,
      offenses: player.offenses,
      bolo: player.bolo,
    })),
    calls: world.calls,
    vehicles: Array.from(world.vehicles.values()),
    generatedAt: Date.now(),
  };
}

function getPlayerPosition(player: ConnectedPlayer) {
  return player.lastKnownPosition ?? player.position;
}

function getOwnedVehicle(playerId: string) {
  return Array.from(world.vehicles.values()).find((vehicle) => vehicle.ownerPlayerId === playerId);
}

function clearVehicleOccupancy(player: ConnectedPlayer) {
  if (!player.activeVehicleEntityId) {
    return;
  }

  const vehicle = world.vehicles.get(player.activeVehicleEntityId);
  if (vehicle && vehicle.occupantPlayerId === player.id) {
    vehicle.occupantPlayerId = undefined;
  }

  player.activeVehicleEntityId = undefined;
}

function despawnOwnedVehicle(player: ConnectedPlayer) {
  const ownedVehicle = getOwnedVehicle(player.id);
  if (!ownedVehicle) {
    return;
  }

  if (ownedVehicle.occupantPlayerId) {
    const occupant = world.players.get(ownedVehicle.occupantPlayerId);
    if (occupant) {
      occupant.activeVehicleEntityId = undefined;
      occupant.position = { x: ownedVehicle.position.x + 2, y: ownedVehicle.position.y + 2 };
      occupant.lastKnownPosition = occupant.position;
    }
  }

  world.vehicles.delete(ownedVehicle.id);
  if (player.activeVehicleEntityId === ownedVehicle.id) {
    player.activeVehicleEntityId = undefined;
  }
}

function clampWorldPosition(position: WorldPosition) {
  return {
    x: Math.max(-58, Math.min(58, position.x)),
    y: Math.max(-58, Math.min(58, position.y)),
  };
}

function createVehicleState(owner: ConnectedPlayer, vehicleId: VehicleId): ActiveVehicleState {
  const spec = GAME_CONFIG.vehicles[vehicleId];
  const ownerPosition = getPlayerPosition(owner);
  return {
    id: nanoid(8),
    vehicleId,
    ownerPlayerId: owner.id,
    position: { x: ownerPosition.x + 2.5, y: ownerPosition.y + 1.5 },
    heading: 0,
    speed: 0,
    fuel: spec.fuelCapacity,
    health: spec.durability,
    occupantPlayerId: undefined,
    spawnedAt: Date.now(),
  };
}

function getJailSpawnPosition() {
  const jail = GAME_CONFIG.worldLocations.find((location) => location.id === "county_jail");
  if (jail) {
    return { x: jail.position.x, y: jail.position.y };
  }

  return { x: 22, y: 10 };
}

function broadcastSnapshot() {
  io.emit("snapshot", buildSnapshot());
}

function notify(playerId: string, message: string) {
  const player = world.players.get(playerId);
  if (!player) {
    return;
  }

  io.to(player.socketId).emit("notification", message);
}

function addOffense(player: ConnectedPlayer, label: string) {
  player.offenses.unshift({
    label,
    timestamp: Date.now(),
  });

  player.offenses = player.offenses.slice(0, 20);
}

function getCriminalStatus(player: ConnectedPlayer) {
  if (player.wanted >= 4) {
    return "most-wanted" as const;
  }

  if (player.activeCrime || player.pendingPayout) {
    return "active" as const;
  }

  if (player.wanted > 0 && player.criminalHeat > 0) {
    return "fleeing" as const;
  }

  if (player.criminalHeat > 0) {
    return "cooldown" as const;
  }

  return "clear" as const;
}

function refreshCriminalState(player: ConnectedPlayer) {
  if (player.wanted >= 4) {
    player.bolo = true;
  }

  if (player.wanted === 0 && !player.activeCrime && !player.pendingPayout && player.criminalHeat === 0) {
    player.bolo = false;
  }

  player.criminalStatus = getCriminalStatus(player);
}

function isPlayerJailed(player: ConnectedPlayer) {
  return Boolean(player.jailedUntil && player.jailedUntil > Date.now());
}

function addCall(title: string, description: string, location: string, reward: number, allowedTeams: TeamId[], suspectId?: string) {
  world.calls.push({
    id: nanoid(8),
    title,
    description,
    location,
    reward,
    allowedTeams,
    suspectId,
    claimedByPlayerId: undefined,
    expiresAt: Date.now() + 5 * 60_000,
  });
}

function startCrime(player: ConnectedPlayer, crimeId: CrimeId) {
  const crime = GAME_CONFIG.crimes[crimeId];
  if (!crime) {
    notify(player.id, "Unknown crime.");
    return;
  }

  if (player.team !== "Civilian") {
    notify(player.id, "Only civilians can start crimes.");
    return;
  }

  if (player.activeCrime || player.pendingPayout) {
    notify(player.id, "Finish your current robbery chain first.");
    return;
  }

  const quantity = player.inventory[crime.requiredTool] ?? 0;
  if (quantity <= 0) {
    notify(player.id, `You need ${crime.requiredTool}.`);
    return;
  }

  if (crime.consumesTool) {
    player.inventory[crime.requiredTool] = Math.max(0, quantity - 1);
  }

  player.activeCrime = {
    crimeId,
    stageIndex: 0,
    startedAt: Date.now(),
  };
  player.wanted = Math.min(5, player.wanted + crime.wanted);
  player.criminalHeat = Math.min(100, player.criminalHeat + 18 + crime.wanted * 10);
  player.lastCrimeAt = Date.now();
  player.wantedExpiresAt = Date.now() + (75 + crime.wanted * 20) * 1000;
  addOffense(player, crime.displayName);
  addCall(crime.dispatchTitle, crime.dispatchDescription, getCrimeLocation(crimeId), crime.dispatchReward, ["CityPolice", "StatePatrol"], player.id);
  refreshCriminalState(player);
  notify(player.id, `${crime.displayName} started. ${crime.stages[0]}`);
  broadcastSnapshot();
}

function advanceCrime(player: ConnectedPlayer) {
  if (!player.activeCrime) {
    notify(player.id, "No active robbery chain.");
    return;
  }

  const crime = GAME_CONFIG.crimes[player.activeCrime.crimeId];
  if (!crime) {
    player.activeCrime = undefined;
    return;
  }

  const nextStageIndex = player.activeCrime.stageIndex + 1;
  if (nextStageIndex >= crime.stages.length) {
    player.pendingPayout = {
      crimeId: player.activeCrime.crimeId,
      label: crime.displayName,
      amount: Math.round((crime.payoutMin + crime.payoutMax) / 2),
      secureAt: Date.now() + crime.secureSeconds * 1000,
    };
    player.activeCrime = undefined;
    player.criminalHeat = Math.min(100, player.criminalHeat + 18 + crime.wanted * 8);
    player.wantedExpiresAt = Date.now() + (90 + crime.wanted * 20) * 1000;
    refreshCriminalState(player);
    notify(player.id, `${crime.displayName} is live. Stay mobile until the payout secures.`);
    broadcastSnapshot();
    return;
  }

  player.activeCrime = {
    ...player.activeCrime,
    stageIndex: nextStageIndex,
  };
  player.criminalHeat = Math.min(100, player.criminalHeat + 8 + crime.wanted * 4);
  player.wantedExpiresAt = Date.now() + (90 + crime.wanted * 20) * 1000;
  refreshCriminalState(player);
  notify(player.id, `Robbery stage ${nextStageIndex + 1}/${crime.stages.length}: ${crime.stages[nextStageIndex]}`);
  broadcastSnapshot();
}

function securePayouts() {
  const now = Date.now();
  let changed = false;
  for (const player of world.players.values()) {
    if (player.pendingPayout && player.pendingPayout.secureAt <= now) {
      player.cash += player.pendingPayout.amount;
      notify(player.id, `Secured $${player.pendingPayout.amount} from ${player.pendingPayout.label}.`);
      player.pendingPayout = undefined;
      player.criminalHeat = Math.min(100, player.criminalHeat + 14);
      player.wantedExpiresAt = Math.max(player.wantedExpiresAt ?? 0, Date.now() + 60_000);
      refreshCriminalState(player);
      savePlayerProfile(player);
      changed = true;
    }
  }

  if (changed) {
    broadcastSnapshot();
  }
}

function expireCalls() {
  const now = Date.now();
  world.calls = world.calls.filter((call) => call.expiresAt > now);
}

function updateCriminalStatuses() {
  const now = Date.now();
  let changed = false;

  for (const player of world.players.values()) {
    const previousStatus = player.criminalStatus;
    const previousWanted = player.wanted;
    const previousHeat = player.criminalHeat;
    const previousBolo = player.bolo;

    if (player.criminalHeat > 0 && !player.activeCrime && !player.pendingPayout) {
      player.criminalHeat = Math.max(0, player.criminalHeat - 4);
    }

    if (player.wanted > 0 && player.wantedExpiresAt && player.wantedExpiresAt <= now && !player.activeCrime && !player.pendingPayout) {
      player.wanted = Math.max(0, player.wanted - 1);
      player.wantedExpiresAt = player.wanted > 0 ? now + 45_000 : undefined;
    }

    if (player.wanted === 0 && !player.activeCrime && !player.pendingPayout && player.criminalHeat === 0) {
      player.lastCrimeAt = undefined;
    }

    refreshCriminalState(player);

    if (
      previousStatus !== player.criminalStatus ||
      previousWanted !== player.wanted ||
      previousHeat !== player.criminalHeat ||
      previousBolo !== player.bolo
    ) {
      savePlayerProfile(player);
      changed = true;
    }
  }

  return changed;
}

function releaseJailedPlayers() {
  const now = Date.now();
  let changed = false;

  for (const player of world.players.values()) {
    if (!player.jailedUntil || player.jailedUntil > now) {
      continue;
    }

    player.jailedUntil = undefined;
    player.jailedBy = undefined;
    player.jailReason = undefined;
    player.position = getTeamSpawnPosition("Civilian", world.players.size);
    player.lastKnownPosition = player.position;
    notify(player.id, "You were released from Liberty County Jail.");
    savePlayerProfile(player);
    changed = true;
  }

  return changed;
}

function hasRankTrack(team: TeamId): team is RankedTeamId {
  return team in GAME_CONFIG.ranks;
}

function addServiceXp(player: ConnectedPlayer, team: TeamId, amount: number) {
  const current = player.serviceXpByTeam[team] ?? 0;
  const next = current + amount;
  player.serviceXpByTeam[team] = next;
  if (!hasRankTrack(team)) {
    return;
  }

  const rankTrack = GAME_CONFIG.ranks[team];
  let rank: string = rankTrack[0].name;
  for (const step of rankTrack) {
    if (next >= step.minXp) {
      rank = step.name;
    }
  }

  player.rankByTeam[team] = rank;
}

function handleAction(player: ConnectedPlayer, action: ClientAction) {
  const restrictedWhileJailed = new Set<ClientAction["type"]>([
    "switchTeam",
    "buyTool",
    "startCrime",
    "advanceCrime",
    "startJob",
    "advanceJob",
    "buyHouse",
    "buyVehicle",
    "spawnVehicle",
    "enterVehicle",
  ]);

  if (isPlayerJailed(player) && restrictedWhileJailed.has(action.type)) {
    notify(player.id, "You are jailed and cannot do that yet.");
    return;
  }

  switch (action.type) {
    case "switchTeam": {
      despawnOwnedVehicle(player);
      if (action.team !== "Civilian" && player.wanted > 0) {
        notify(player.id, "Clear wanted status before joining a service team.");
        return;
      }
      player.team = action.team;
      const teamSpawn = getTeamSpawnPosition(action.team, world.players.size);
      player.position = teamSpawn;
      player.lastKnownPosition = teamSpawn;
      notify(player.id, `Switched to ${action.team}.`);
      break;
    }
    case "buyTool": {
      const tool = GAME_CONFIG.tools[action.toolId];
      if (!tool) {
        return;
      }
      if (player.cash < tool.price) {
        notify(player.id, "Not enough cash.");
        return;
      }
      player.cash -= tool.price;
      player.inventory[action.toolId] = (player.inventory[action.toolId] ?? 0) + 1;
      notify(player.id, `Purchased ${tool.displayName}.`);
      break;
    }
    case "startCrime": {
      startCrime(player, action.crimeId);
      break;
    }
    case "advanceCrime": {
      advanceCrime(player);
      break;
    }
    case "claimCall": {
      const nextCall = action.callId
        ? world.calls.find((call) => call.id === action.callId && call.allowedTeams.includes(player.team) && !call.claimedByPlayerId)
        : world.calls.find((call) => call.allowedTeams.includes(player.team) && !call.claimedByPlayerId);
      if (!nextCall) {
        notify(player.id, "No call available.");
        return;
      }
      nextCall.claimedByPlayerId = player.id;
      player.claimedCallId = nextCall.id;
      notify(player.id, `Claimed ${nextCall.title}.`);
      break;
    }
    case "completeCall": {
      if (!player.claimedCallId) {
        notify(player.id, "No claimed call.");
        return;
      }
      const call = world.calls.find((entry) => entry.id === player.claimedCallId);
      if (!call) {
        player.claimedCallId = undefined;
        return;
      }
      player.cash += call.reward;
      addServiceXp(player, player.team, 60);
      notify(player.id, `Completed ${call.title} for $${call.reward}.`);
      world.calls = world.calls.filter((entry) => entry.id !== call.id);
      player.claimedCallId = undefined;
      break;
    }
    case "depositCash": {
      const amount = Math.max(0, Math.floor(action.amount));
      if (player.cash < amount) {
        notify(player.id, "Not enough cash to deposit.");
        return;
      }
      player.cash -= amount;
      player.bank += amount;
      break;
    }
    case "withdrawCash": {
      const amount = Math.max(0, Math.floor(action.amount));
      if (player.bank < amount) {
        notify(player.id, "Not enough bank funds.");
        return;
      }
      player.bank -= amount;
      player.cash += amount;
      break;
    }
    case "transferFunds": {
      const target = Array.from(world.players.values()).find((entry) => entry.name.toLowerCase() === action.targetName.toLowerCase());
      if (!target) {
        notify(player.id, "Target not found.");
        return;
      }
      const amount = Math.max(0, Math.floor(action.amount));
      if (player.bank < amount) {
        notify(player.id, "Not enough bank funds.");
        return;
      }
      player.bank -= amount;
      target.bank += amount;
      notify(target.id, `Received $${amount} from ${player.name}.`);
      break;
    }
    case "startJob": {
      const job = GAME_CONFIG.jobs[action.jobId];
      if (!job) {
        return;
      }
      if (player.team !== "Civilian") {
        notify(player.id, "Only civilians can start civilian jobs.");
        return;
      }
      if (player.civilianJobReputation < job.unlockReputation) {
        notify(player.id, `Need job reputation ${job.unlockReputation} to unlock ${job.displayName}.`);
        return;
      }
      player.activeJobId = action.jobId;
      player.activeJobStep = 0;
      notify(player.id, `Started ${job.displayName}. ${job.steps[0]}`);
      break;
    }
    case "advanceJob": {
      if (!player.activeJobId) {
        notify(player.id, "No active job.");
        return;
      }
      const job = GAME_CONFIG.jobs[player.activeJobId];
      if (!job) {
        return;
      }
      player.activeJobStep += 1;
      if (player.activeJobStep >= job.steps.length) {
        player.cash += job.reward;
        player.civilianJobReputation += 1;
        notify(player.id, `Completed ${job.displayName} for $${job.reward}.`);
        player.activeJobId = undefined;
        player.activeJobStep = 0;
      } else {
        notify(player.id, `Next step: ${job.steps[player.activeJobStep]}`);
      }
      break;
    }
    case "buyHouse": {
      const house = GAME_CONFIG.housing[action.houseId];
      if (!house) {
        return;
      }
      if (!player.housing.includes(action.houseId)) {
        if (player.cash < house.price) {
          notify(player.id, "Not enough cash for that house.");
          return;
        }
        player.cash -= house.price;
        player.housing.push(action.houseId);
      }
      player.activeHouseId = action.houseId;
      break;
    }
    case "buyVehicle": {
      const vehicle = GAME_CONFIG.vehicles[action.vehicleId];
      if (!vehicle) {
        return;
      }
      if (!player.vehicles.includes(action.vehicleId)) {
        if (player.cash < vehicle.price) {
          notify(player.id, "Not enough cash for that vehicle.");
          return;
        }
        player.cash -= vehicle.price;
        player.vehicles.push(action.vehicleId);
      }
      player.selectedVehicleId = action.vehicleId;
      break;
    }
    case "spawnVehicle": {
      const selectedVehicleId = player.selectedVehicleId;
      if (!selectedVehicleId || !player.vehicles.includes(selectedVehicleId)) {
        notify(player.id, "Select an owned vehicle first.");
        return;
      }

      let vehicle = getOwnedVehicle(player.id);
      if (!vehicle) {
        vehicle = createVehicleState(player, selectedVehicleId);
        world.vehicles.set(vehicle.id, vehicle);
      } else if (vehicle.occupantPlayerId && vehicle.occupantPlayerId !== player.id) {
        notify(player.id, "Your vehicle is already occupied.");
        return;
      } else {
        vehicle.vehicleId = selectedVehicleId;
        const spec = GAME_CONFIG.vehicles[selectedVehicleId];
        const nextPosition = clampWorldPosition({ x: getPlayerPosition(player).x + 2.5, y: getPlayerPosition(player).y + 1.5 });
        vehicle.position = nextPosition;
        vehicle.heading = 0;
        vehicle.speed = 0;
        vehicle.fuel = Math.min(vehicle.fuel || spec.fuelCapacity, spec.fuelCapacity);
        vehicle.health = Math.min(vehicle.health || spec.durability, spec.durability);
      }

      vehicle.occupantPlayerId = player.id;
      player.activeVehicleEntityId = vehicle.id;
      player.position = vehicle.position;
      player.lastKnownPosition = vehicle.position;
      notify(player.id, `Deployed ${GAME_CONFIG.vehicles[selectedVehicleId].displayName}.`);
      break;
    }
    case "despawnVehicle": {
      const vehicle = getOwnedVehicle(player.id);
      if (!vehicle) {
        notify(player.id, "No deployed vehicle.");
        return;
      }

      if (vehicle.occupantPlayerId && vehicle.occupantPlayerId !== player.id) {
        notify(player.id, "Cannot despawn an occupied vehicle.");
        return;
      }

      despawnOwnedVehicle(player);
      notify(player.id, "Vehicle stored.");
      break;
    }
    case "enterVehicle": {
      const vehicle = world.vehicles.get(action.vehicleEntityId);
      if (!vehicle) {
        notify(player.id, "Vehicle unavailable.");
        return;
      }

      const position = getPlayerPosition(player);
      const distance = Math.hypot(vehicle.position.x - position.x, vehicle.position.y - position.y);
      if (distance > 8) {
        notify(player.id, "Move closer to enter that vehicle.");
        return;
      }

      if (vehicle.occupantPlayerId && vehicle.occupantPlayerId !== player.id) {
        notify(player.id, "Vehicle already occupied.");
        return;
      }

      clearVehicleOccupancy(player);
      vehicle.occupantPlayerId = player.id;
      player.activeVehicleEntityId = vehicle.id;
      player.position = vehicle.position;
      player.lastKnownPosition = vehicle.position;
      break;
    }
    case "exitVehicle": {
      if (!player.activeVehicleEntityId) {
        notify(player.id, "You are not in a vehicle.");
        return;
      }

      const vehicle = world.vehicles.get(player.activeVehicleEntityId);
      if (!vehicle) {
        player.activeVehicleEntityId = undefined;
        return;
      }

      vehicle.occupantPlayerId = undefined;
      player.activeVehicleEntityId = undefined;
      player.position = { x: vehicle.position.x + 2, y: vehicle.position.y + 2 };
      player.lastKnownPosition = player.position;
      break;
    }
    case "updateVehicleState": {
      const vehicle = world.vehicles.get(action.vehicleEntityId);
      if (!vehicle || vehicle.occupantPlayerId !== player.id || player.activeVehicleEntityId !== vehicle.id) {
        return;
      }

      const spec = GAME_CONFIG.vehicles[vehicle.vehicleId];
      vehicle.position = clampWorldPosition(action.position);
      vehicle.heading = action.heading;
      vehicle.speed = Math.max(-spec.topSpeed * 0.35, Math.min(spec.topSpeed, action.speed));
      vehicle.fuel = Math.max(0, Math.min(spec.fuelCapacity, action.fuel));
      vehicle.health = Math.max(0, Math.min(spec.durability, action.health));
      if (vehicle.fuel <= 0 || vehicle.health <= 0) {
        vehicle.speed = 0;
      }
      player.position = vehicle.position;
      player.lastKnownPosition = vehicle.position;
      break;
    }
    case "logCameraOffense": {
      player.cameraOffenses.unshift({
        type: action.offenseType,
        fine: action.fine,
        timestamp: Date.now(),
      });
      player.cameraOffenses = player.cameraOffenses.slice(0, 10);
      break;
    }
    case "issueCitation": {
      const officerTeams: TeamId[] = ["CityPolice", "StatePatrol"];
      if (!officerTeams.includes(player.team)) {
        return;
      }
      const target = world.players.get(action.targetPlayerId);
      if (!target || target.cameraOffenses.length === 0) {
        notify(player.id, "No camera offense available for citation.");
        return;
      }
      const offense = target.cameraOffenses.shift();
      if (!offense) {
        return;
      }
      target.citations.unshift({
        reason: offense.type,
        fine: offense.fine,
        issuedBy: player.name,
        timestamp: Date.now(),
      });
      target.bank = Math.max(0, target.bank - offense.fine);
      addServiceXp(player, player.team, 40);
      notify(target.id, `Received citation for ${offense.type}.`);
      break;
    }
    case "issueWarning": {
      const officerTeams: TeamId[] = ["CityPolice", "StatePatrol"];
      if (!officerTeams.includes(player.team)) {
        return;
      }
      const target = world.players.get(action.targetPlayerId);
      if (!target) {
        return;
      }
      target.warnings.unshift({
        reason: action.reason,
        issuedBy: player.name,
        timestamp: Date.now(),
      });
      addServiceXp(player, player.team, 15);
      notify(target.id, `Received warning: ${action.reason}`);
      break;
    }
    case "toggleBolo": {
      const target = world.players.get(action.targetPlayerId);
      if (!target) {
        return;
      }
      target.bolo = !target.bolo;
      refreshCriminalState(target);
      break;
    }
    case "arrestPlayer": {
      const officerTeams: TeamId[] = ["CityPolice", "StatePatrol"];
      if (!officerTeams.includes(player.team)) {
        return;
      }
      const target = world.players.get(action.targetPlayerId);
      if (!target || target.wanted <= 0) {
        return;
      }
      const wantedAtArrest = target.wanted;
      const jailReason = target.offenses[0]?.label ?? "Active warrant";
      const jailSeconds = Math.min(180, 30 + wantedAtArrest * 25 + Math.round(target.criminalHeat / 2));
      despawnOwnedVehicle(target);
      target.activeCrime = undefined;
      target.pendingPayout = undefined;
      target.wanted = 0;
      target.criminalHeat = 0;
      target.criminalStatus = "clear";
      target.wantedExpiresAt = undefined;
      target.lastCrimeAt = undefined;
      target.bolo = false;
      target.team = "Civilian";
      target.jailedUntil = Date.now() + jailSeconds * 1000;
      target.jailedBy = player.name;
      target.jailReason = jailReason;
      target.position = getJailSpawnPosition();
      target.lastKnownPosition = target.position;
      addServiceXp(player, player.team, 90);
      notify(target.id, `You were arrested and jailed for ${jailSeconds} seconds.`);
      world.calls = world.calls.filter((call) => call.suspectId !== target.id);
      break;
    }
    case "updatePosition": {
      if (player.activeVehicleEntityId) {
        return;
      }
      if (isPlayerJailed(player)) {
        const jailPosition = getJailSpawnPosition();
        const dx = action.position.x - jailPosition.x;
        const dy = action.position.y - jailPosition.y;
        const distance = Math.hypot(dx, dy);
        const maxRadius = 4;
        const confinedPosition = distance > maxRadius
          ? {
              x: jailPosition.x + (dx / distance) * maxRadius,
              y: jailPosition.y + (dy / distance) * maxRadius,
            }
          : action.position;
        player.lastKnownPosition = confinedPosition;
        player.position = confinedPosition;
        break;
      }
      player.lastKnownPosition = action.position;
      player.position = action.position;
      break;
    }
  }
  savePlayerProfile(player);
  broadcastSnapshot();
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    serverName: GAME_CONFIG.serverName,
    players: world.players.size,
    savedProfiles: profileStore.size,
  });
});

app.get("/api/config", (_req, res) => {
  res.json(GAME_CONFIG);
});

if (existsSync(clientDistPath)) {
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
    res.sendFile(join(clientDistPath, "index.html"));
  });
}

io.on("connection", (socket) => {
  socket.on("join", (requestedName: string) => {
    const safeName = requestedName?.trim() || `Player-${Math.floor(Math.random() * 1000)}`;
    const player = createPlayerState(safeName);
    player.socketId = socket.id;
    world.players.set(player.id, player);
    bySocket.set(socket.id, player.id);
    socket.emit("joined", { playerId: player.id });
    notify(player.id, `Connected to ${GAME_CONFIG.serverName}.`);
    broadcastSnapshot();
  });

  socket.on("action", (action: ClientAction) => {
    const playerId = bySocket.get(socket.id);
    if (!playerId) {
      return;
    }
    const player = world.players.get(playerId);
    if (!player) {
      return;
    }
    handleAction(player, action);
  });

  socket.on("disconnect", () => {
    const playerId = bySocket.get(socket.id);
    if (!playerId) {
      return;
    }
    const player = world.players.get(playerId);
    bySocket.delete(socket.id);
    if (player) {
      despawnOwnedVehicle(player);
      savePlayerProfile(player);
    }
    world.players.delete(playerId);
    broadcastSnapshot();
  });
});

setInterval(() => {
  expireCalls();
  securePayouts();
  const criminalStateChanged = updateCriminalStatuses();
  const jailStateChanged = releaseJailedPlayers();
  if (world.calls.length < 6) {
    const cycle = GAME_CONFIG.calls[Math.floor(Math.random() * GAME_CONFIG.calls.length)];
    addCall(cycle.title, cycle.description, cycle.location, cycle.reward, cycle.allowedTeams);
  }
  if (criminalStateChanged || jailStateChanged || world.calls.length > 0) {
    broadcastSnapshot();
  }
}, 4_000);

let activePort: number | null = null;
let activeHost: string | null = null;

export async function startServer(options?: { port?: number; host?: string }) {
  const port = options?.port ?? Number(process.env.PORT ?? 3001);
  const host = options?.host ?? process.env.HOST ?? "0.0.0.0";

  if (activePort !== null && activeHost !== null) {
    return { port: activePort, host: activeHost };
  }

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      httpServer.off("error", onError);
      reject(error);
    };

    httpServer.once("error", onError);
    httpServer.listen(port, host, () => {
      httpServer.off("error", onError);
      activePort = port;
      activeHost = host;
      console.log(`Redwood server listening at http://${host}:${port}`);
      resolve();
    });
  });

  return { port, host };
}

export async function stopServer() {
  if (activePort === null || activeHost === null) {
    return;
  }

  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  flushProfiles();

  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  io.close();
  activePort = null;
  activeHost = null;
}

if (process.argv[1] && currentFilePath === process.argv[1]) {
  startServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}