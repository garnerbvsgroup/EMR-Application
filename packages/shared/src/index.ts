export type TeamId = "Civilian" | "CityPolice" | "StatePatrol" | "FireRescue" | "PublicWorks";
export type ToolId = "SignalDisruptor" | "LockpickKit" | "PryBar" | "Flashlight";
export type CrimeId = "atm_breach" | "house_burglary" | "retail_burglary" | "office_safe" | "vehicle_theft";
export type JobId = "Courier" | "Taxi" | "Transit" | "Postal" | "GasService" | "Construction";
export type HouseId = "PlotA" | "PlotB" | "PlotC";
export type VehicleId = "CivilianCompact" | "CivilianSUV";

export type WorldPosition = {
  x: number;
  y: number;
};

export type WorldLocationCategory = "district" | "station" | "crime" | "housing" | "utility" | "job" | "special";

export type WorldLocation = {
  id: string;
  name: string;
  summary: string;
  position: WorldPosition;
  category: WorldLocationCategory;
  accent: string;
  team?: TeamId;
};

export type TeamConfig = {
  displayName: string;
  shortLabel: string;
  summary: string;
  duties: string[];
  homeLocationId?: string;
  accent: string;
  lawEnforcement?: boolean;
};

export type JobConfig = {
  displayName: string;
  summary: string;
  reward: number;
  unlockReputation: number;
  hubLocationId: string;
  steps: string[];
};

export type CrimeConfig = {
  displayName: string;
  requiredTool: ToolId;
  consumesTool: boolean;
  payoutMin: number;
  payoutMax: number;
  wanted: number;
  secureSeconds: number;
  dispatchTitle: string;
  dispatchDescription: string;
  dispatchReward: number;
  stages: string[];
};

export type CallRecord = {
  id: string;
  title: string;
  description: string;
  location: string;
  reward: number;
  allowedTeams: TeamId[];
  suspectId?: string;
  claimedByPlayerId?: string;
  expiresAt: number;
};

export type CitationRecord = {
  reason: string;
  fine: number;
  issuedBy: string;
  timestamp: number;
};

export type WarningRecord = {
  reason: string;
  issuedBy: string;
  timestamp: number;
};

export type CameraOffense = {
  type: string;
  fine: number;
  timestamp: number;
};

export type OffenseLog = {
  label: string;
  timestamp: number;
};

export type CriminalStatus = "clear" | "active" | "fleeing" | "cooldown" | "most-wanted";

export type PendingPayout = {
  crimeId: CrimeId;
  label: string;
  amount: number;
  secureAt: number;
};

export type ActiveCrimeState = {
  crimeId: CrimeId;
  stageIndex: number;
  startedAt: number;
};

export type ActiveVehicleState = {
  id: string;
  vehicleId: VehicleId;
  ownerPlayerId: string;
  position: WorldPosition;
  heading: number;
  speed: number;
  fuel: number;
  health: number;
  occupantPlayerId?: string;
  spawnedAt: number;
};

export type PlayerPublicState = {
  id: string;
  name: string;
  team: TeamId;
  position: WorldPosition;
  cash: number;
  bank: number;
  wanted: number;
  criminalStatus: CriminalStatus;
  criminalHeat: number;
  wantedExpiresAt?: number;
  lastCrimeAt?: number;
  jailedUntil?: number;
  jailedBy?: string;
  jailReason?: string;
  claimedCallId?: string;
  activeCrime?: ActiveCrimeState;
  pendingPayout?: PendingPayout;
  citations: CitationRecord[];
  warnings: WarningRecord[];
  cameraOffenses: CameraOffense[];
  rankByTeam: Record<TeamId, string>;
  serviceXpByTeam: Record<TeamId, number>;
  housing: HouseId[];
  activeHouseId?: HouseId;
  vehicles: VehicleId[];
  selectedVehicleId?: VehicleId;
  activeVehicleEntityId?: string;
  activeJobId?: JobId;
  activeJobStep: number;
  civilianJobReputation: number;
  inventory: Record<ToolId, number>;
  offenses: OffenseLog[];
  bolo: boolean;
};

export type PersistedPlayerProfile = Omit<PlayerPublicState, "id"> & {
  lastSeenAt: number;
};

export type ActiveCall = CallRecord;

export type ServerSnapshot = {
  serverName: string;
  motd: string;
  players: PlayerPublicState[];
  calls: ActiveCall[];
  vehicles: ActiveVehicleState[];
  generatedAt: number;
};

export type ClientAction =
  | { type: "switchTeam"; team: TeamId }
  | { type: "buyTool"; toolId: ToolId }
  | { type: "startCrime"; crimeId: CrimeId }
  | { type: "advanceCrime" }
  | { type: "claimCall"; callId?: string }
  | { type: "completeCall" }
  | { type: "depositCash"; amount: number }
  | { type: "withdrawCash"; amount: number }
  | { type: "transferFunds"; targetName: string; amount: number }
  | { type: "startJob"; jobId: JobId }
  | { type: "advanceJob" }
  | { type: "buyHouse"; houseId: HouseId }
  | { type: "buyVehicle"; vehicleId: VehicleId }
  | { type: "spawnVehicle" }
  | { type: "despawnVehicle" }
  | { type: "enterVehicle"; vehicleEntityId: string }
  | { type: "exitVehicle" }
  | { type: "updateVehicleState"; vehicleEntityId: string; position: WorldPosition; heading: number; speed: number; fuel: number; health: number }
  | { type: "logCameraOffense"; offenseType: string; fine: number }
  | { type: "issueCitation"; targetPlayerId: string }
  | { type: "issueWarning"; targetPlayerId: string; reason: string }
  | { type: "toggleBolo"; targetPlayerId: string }
  | { type: "arrestPlayer"; targetPlayerId: string }
  | { type: "updatePosition"; position: WorldPosition };

export const GAME_CONFIG = {
  serverName: "Garner Emergency Response Local Server",
  motd: "Aidan Garner's desktop emergency-response sandbox.",
  teams: {
    Civilian: {
      displayName: "Civilian",
      shortLabel: "CIV",
      summary: "Free-roam role for jobs, vehicles, banking, property, and the choice to stay legal or drift into crime.",
      duties: ["Run civilian jobs", "Buy vehicles and property", "Access the open-world economy"],
      homeLocationId: "west_civilian_spawn",
      accent: "#d4b387",
    },
    CityPolice: {
      displayName: "River City Police",
      shortLabel: "RCPD",
      summary: "City response role for traffic stops, citations, call handling, and arrests in the busiest district.",
      duties: ["Claim city dispatch calls", "Issue citations and warnings", "Respond to active crime scenes"],
      homeLocationId: "city_police_hq",
      accent: "#4d7cff",
      lawEnforcement: true,
    },
    StatePatrol: {
      displayName: "County Patrol",
      shortLabel: "PATROL",
      summary: "Countywide patrol role for highway coverage, pursuits, and fast cross-district backup.",
      duties: ["Cover Liberty Parkway", "Back up major incidents", "Monitor fast-moving traffic"],
      homeLocationId: "state_patrol_post",
      accent: "#76a7ff",
      lawEnforcement: true,
    },
    FireRescue: {
      displayName: "Fire and Rescue",
      shortLabel: "FIRE",
      summary: "Emergency services role for fire suppression, medical response, rescue, and station-based deployment.",
      duties: ["Handle medical aid calls", "Respond to structure fires", "Stage from fire stations"],
      homeLocationId: "fire_rescue_station",
      accent: "#d86152",
    },
    PublicWorks: {
      displayName: "Department of Transportation",
      shortLabel: "DOT",
      summary: "Roadside and infrastructure role for debris, closures, traffic support, and service tasks.",
      duties: ["Clear roadway hazards", "Support closures and traffic flow", "Run maintenance tasks"],
      homeLocationId: "public_works_yard",
      accent: "#d29c3b",
    },
  } as const satisfies Record<TeamId, TeamConfig>,
  tools: {
    SignalDisruptor: { displayName: "Signal Disruptor", price: 450 },
    LockpickKit: { displayName: "Lockpick Kit", price: 650 },
    PryBar: { displayName: "Pry Bar", price: 325 },
    Flashlight: { displayName: "Flashlight", price: 80 },
  } as const,
  crimes: {
    atm_breach: {
      displayName: "ATM Breach",
      requiredTool: "SignalDisruptor",
      consumesTool: false,
      payoutMin: 350,
      payoutMax: 650,
      wanted: 1,
      secureSeconds: 30,
      dispatchTitle: "ATM Robbery",
      dispatchDescription: "Electronic interference detected at a cash machine.",
      dispatchReward: 200,
      stages: ["Case the ATM vestibule.", "Deploy the signal disruptor and drain the machine.", "Leave the block before patrol locks down the area."],
    },
    house_burglary: {
      displayName: "Vacant-Home Burglary",
      requiredTool: "LockpickKit",
      consumesTool: true,
      payoutMin: 1200,
      payoutMax: 2200,
      wanted: 2,
      secureSeconds: 45,
      dispatchTitle: "Residential Burglary",
      dispatchDescription: "Vacant-home alarm triggered in Pine Basin.",
      dispatchReward: 300,
      stages: ["Check the vacant property for a quiet entry.", "Bypass the lock and search the interior.", "Move the stolen goods before neighbors report movement."],
    },
    retail_burglary: {
      displayName: "Retail Burglary",
      requiredTool: "PryBar",
      consumesTool: false,
      payoutMin: 500,
      payoutMax: 900,
      wanted: 1,
      secureSeconds: 35,
      dispatchTitle: "Retail Break-In",
      dispatchDescription: "Storefront register breach reported.",
      dispatchReward: 225,
      stages: ["Scope the storefront entry and disable witnesses.", "Force the register and collect the till.", "Exit through the service lane before units arrive."],
    },
    office_safe: {
      displayName: "Office Safe Robbery",
      requiredTool: "PryBar",
      consumesTool: false,
      payoutMin: 800,
      payoutMax: 1400,
      wanted: 2,
      secureSeconds: 40,
      dispatchTitle: "Commercial Safe Breach",
      dispatchDescription: "Back-office safe forced open.",
      dispatchReward: 260,
      stages: ["Gain access to the office suite.", "Pry the safe and secure the cash case.", "Clear the business park before the BOLO spreads."],
    },
    vehicle_theft: {
      displayName: "Vehicle Theft",
      requiredTool: "PryBar",
      consumesTool: false,
      payoutMin: 700,
      payoutMax: 1200,
      wanted: 2,
      secureSeconds: 50,
      dispatchTitle: "Vehicle Theft",
      dispatchDescription: "Stolen vehicle pinged in the industrial district.",
      dispatchReward: 275,
      stages: ["Find the target vehicle and break in.", "Hotwire the ignition and leave the lot.", "Keep the vehicle moving until the tracker goes cold."],
    },
  } as const satisfies Record<CrimeId, CrimeConfig>,
  jobs: {
    Courier: {
      displayName: "Downtown Courier Route",
      summary: "Starter delivery route across River City storefronts and office blocks.",
      reward: 320,
      unlockReputation: 0,
      hubLocationId: "postal_depot",
      steps: ["Pick up parcels at the depot.", "Deliver to River City storefronts.", "Return the signed manifest."],
    },
    Taxi: {
      displayName: "Valley Transit Taxi Shift",
      summary: "On-demand civilian pickups that reward quick cross-county movement.",
      reward: 280,
      unlockReputation: 0,
      hubLocationId: "valley_transit_depot",
      steps: ["Accept a civilian pickup.", "Reach the rider's curbside marker.", "Complete the county dropoff."],
    },
    Transit: {
      displayName: "Valley Transit Bus Loop",
      summary: "Repeatable public transit loop with heavier county coverage and steadier pay.",
      reward: 260,
      unlockReputation: 1,
      hubLocationId: "valley_transit_depot",
      steps: ["Start the bus loop.", "Stop at Springfield and River City.", "Finish the county circuit."],
    },
    Postal: {
      displayName: "Postal Worker Route",
      summary: "Structured county mail delivery route with longer runs and higher completion value.",
      reward: 340,
      unlockReputation: 1,
      hubLocationId: "postal_depot",
      steps: ["Sort outbound mail.", "Deliver to neighborhood boxes.", "Return undelivered parcels to the depot."],
    },
    GasService: {
      displayName: "Gas-N-Go Service Run",
      summary: "Fuel, wash, and service deliveries from the county's busiest roadside hub.",
      reward: 300,
      unlockReputation: 2,
      hubLocationId: "gas_n_go_service",
      steps: ["Load the fuel order.", "Reach the requested station.", "Complete the service and restock."],
    },
    Construction: {
      displayName: "Construction Site Shift",
      summary: "Higher-tier route focused on work-zone deliveries and site progression.",
      reward: 360,
      unlockReputation: 3,
      hubLocationId: "eagle_construction",
      steps: ["Report to the work zone.", "Move materials to the active build.", "Clock out after the site check."],
    },
  } as const satisfies Record<JobId, JobConfig>,
  jobsOrder: ["Courier", "Taxi", "Transit", "Postal", "GasService", "Construction"] as const,
  housing: {
    PlotA: { displayName: "Pine View House", price: 6500 },
    PlotB: { displayName: "Bramble Cottage", price: 7200 },
    PlotC: { displayName: "Riverside Duplex", price: 8200 },
  } as const,
  housingOrder: ["PlotA", "PlotB", "PlotC"] as const,
  vehicles: {
    CivilianCompact: { displayName: "Cinder Compact", price: 4800, topSpeed: 36, acceleration: 22, fuelCapacity: 100, durability: 100 },
    CivilianSUV: { displayName: "Mesa Utility", price: 8600, topSpeed: 30, acceleration: 18, fuelCapacity: 130, durability: 140 },
  } as const,
  vehiclePurchaseOrder: ["CivilianCompact", "CivilianSUV"] as const,
  worldLocations: [
    {
      id: "ashford_core",
      name: "River City Core",
      summary: "Dense downtown blocks with the hospital, courthouse, department HQ, and the heaviest dispatch volume in the county.",
      position: { x: -2, y: -4 },
      category: "district",
      accent: "#7ab5ff",
    },
    {
      id: "bramble_ridge",
      name: "Springfield Heights",
      summary: "Residential and small-business side of the county with bus stops, service jobs, and quieter patrol flow.",
      position: { x: 28, y: 22 },
      category: "district",
      accent: "#87cb8f",
    },
    {
      id: "route_8",
      name: "Liberty Parkway",
      summary: "Fast county corridor linking River City to Springfield, ideal for patrol, transit, and DOT incidents.",
      position: { x: 14, y: 6 },
      category: "district",
      accent: "#f2c862",
    },
    {
      id: "mercer_yard",
      name: "East County Retail Belt",
      summary: "Retail strip, fire station access, gas stops, and clustered robbery opportunities near Springfield.",
      position: { x: 32, y: 12 },
      category: "district",
      accent: "#e88367",
    },
    {
      id: "cedar_farms",
      name: "Cedar Farms",
      summary: "Rural edge of the county with farm work, hidden routes, and long-range emergency response coverage.",
      position: { x: 6, y: 30 },
      category: "district",
      accent: "#9fcb73",
    },
    {
      id: "city_police_hq",
      name: "River City Police Department",
      summary: "Primary law-enforcement hub covering downtown traffic, arrests, and central dispatch response.",
      position: { x: 6, y: -2 },
      category: "station",
      accent: "#2758b9",
      team: "CityPolice",
    },
    {
      id: "fire_rescue_station",
      name: "Redwood Fire & Rescue Station 1",
      summary: "Downtown fire and EMS staging point covering River City, the hospital corridor, and central hydrants.",
      position: { x: -14, y: 2 },
      category: "station",
      accent: "#b94439",
      team: "FireRescue",
    },
    {
      id: "public_works_yard",
      name: "Department of Transportation Yard",
      summary: "DOT operations center for traffic control, cleanup trucks, and roadside support runs.",
      position: { x: 20, y: -8 },
      category: "station",
      accent: "#c89424",
      team: "PublicWorks",
    },
    {
      id: "state_patrol_post",
      name: "County Patrol Post",
      summary: "High-speed response substation covering Liberty Parkway, county pursuits, and rural backup.",
      position: { x: 18, y: 18 },
      category: "station",
      accent: "#62afff",
      team: "StatePatrol",
    },
    {
      id: "county_sheriff_complex",
      name: "Liberty County Sheriff's Office",
      summary: "County justice complex anchoring warrant service, custody transfers, and sheriff-side response coverage.",
      position: { x: 24, y: 20 },
      category: "station",
      accent: "#7a5a3a",
    },
    {
      id: "county_jail",
      name: "Liberty County Jail",
      summary: "Detention complex with booking, cells, and prisoner transfer staging.",
      position: { x: 22, y: 10 },
      category: "station",
      accent: "#7f8691",
    },
    {
      id: "fire_rescue_station_two",
      name: "Redwood Fire & Rescue Station 2",
      summary: "East county firehouse covering Springfield retail fires, highway crashes, and far-side EMS calls.",
      position: { x: 32, y: 18 },
      category: "station",
      accent: "#cf5b52",
    },
    {
      id: "bank_row_atm",
      name: "River City ATM Network",
      summary: "High-footfall downtown cash points vulnerable to disruptor-based robbery attempts.",
      position: { x: 8, y: 0 },
      category: "crime",
      accent: "#ffd06a",
    },
    {
      id: "pine_basin_homes",
      name: "Springfield Vacant Homes",
      summary: "Quiet residential burglary targets scattered along the Springfield side streets.",
      position: { x: 30, y: 26 },
      category: "crime",
      accent: "#cf9b6d",
    },
    {
      id: "quarry_showroom",
      name: "East County Retail Strip",
      summary: "Register, ATM, and office-safe targets clustered close together with higher witness exposure.",
      position: { x: 30, y: 14 },
      category: "crime",
      accent: "#f08b6e",
    },
    {
      id: "county_bank_heist",
      name: "Liberty Bank Heist Site",
      summary: "Flagship robbery target with the largest payout and the highest law-enforcement response pressure.",
      position: { x: -14, y: 10 },
      category: "crime",
      accent: "#ff9a55",
    },
    {
      id: "jewelry_row",
      name: "Jewelry Row",
      summary: "Specialty storefront with drill-based smash-and-grab potential in the downtown commerce corridor.",
      position: { x: -2, y: 10 },
      category: "crime",
      accent: "#f7cf71",
    },
    {
      id: "chop_shop",
      name: "County Chop Shop",
      summary: "Remote vehicle-fencing destination for higher-risk theft loops and suspect meetups.",
      position: { x: 26, y: 8 },
      category: "crime",
      accent: "#b58473",
    },
    {
      id: "valley_transit_depot",
      name: "Valley Transit Depot",
      summary: "Bus and taxi hub feeding nine county stops between River City and Springfield.",
      position: { x: -4, y: 6 },
      category: "job",
      accent: "#58b9d0",
    },
    {
      id: "postal_depot",
      name: "Postal Worker Depot",
      summary: "Mail sorting and dispatch node for route-based civilian progression.",
      position: { x: 4, y: 12 },
      category: "job",
      accent: "#56a1ff",
    },
    {
      id: "memorial_hospital",
      name: "Liberty Memorial Hospital",
      summary: "Medical jobs, EMS handoff point, and a reliable hotspot for aid calls.",
      position: { x: -6, y: 16 },
      category: "job",
      accent: "#76d4c6",
    },
    {
      id: "gas_n_go_service",
      name: "Gas-N-Go Service Hub",
      summary: "Fueling, wash, and delivery jobs tied to the county's busiest roadway service loop.",
      position: { x: 24, y: 14 },
      category: "job",
      accent: "#46c09b",
    },
    {
      id: "eagle_construction",
      name: "Eagle Construction Yard",
      summary: "Construction staging area for material hauling and long-form civilian work shifts.",
      position: { x: 2, y: 18 },
      category: "job",
      accent: "#d4aa45",
    },
    {
      id: "cedar_farmhouse",
      name: "Cedar Farm Service Lot",
      summary: "Rural work site anchoring farm duties and longer county-side travel routes.",
      position: { x: 12, y: 28 },
      category: "job",
      accent: "#79ba62",
    },
    {
      id: "west_civilian_spawn",
      name: "West Civilian Spawn",
      summary: "River City-side civilian spawn with garage access, ATM use, and quick entry into downtown play.",
      position: { x: -20, y: 8 },
      category: "utility",
      accent: "#a78dff",
    },
    {
      id: "east_civilian_spawn",
      name: "East Civilian Spawn",
      summary: "Springfield-side civilian spawn that feeds suburban driving, gas service, and transit play.",
      position: { x: 30, y: 18 },
      category: "utility",
      accent: "#bd8cff",
    },
    {
      id: "tool_and_mod_row",
      name: "Tool and Mod Row",
      summary: "Combined access point for tooling, vehicle customization, and prep before higher-risk runs.",
      position: { x: -8, y: 12 },
      category: "utility",
      accent: "#d890ff",
    },
    {
      id: "guns_and_ammo",
      name: "Liberty Guns and Ammo",
      summary: "Civilian equipment storefront on the River City side, distinct from law-enforcement supply.",
      position: { x: -18, y: 12 },
      category: "utility",
      accent: "#f25d6d",
    },
    {
      id: "criminal_hideout",
      name: "Criminal Hideout",
      summary: "Remote suspect staging area for robbery prep, drop-offs, and covert regrouping.",
      position: { x: 40, y: 8 },
      category: "special",
      accent: "#f05a80",
    },
    {
      id: "mineshaft",
      name: "Mineshaft",
      summary: "Rugged edge-of-county landmark suited for exploration beats, suspect escapes, and special events.",
      position: { x: 44, y: 14 },
      category: "special",
      accent: "#cb6fa5",
    },
    {
      id: "bunker",
      name: "Bunker",
      summary: "Hidden hillside room that works well as a discovery point, stash site, or event objective.",
      position: { x: -26, y: 28 },
      category: "special",
      accent: "#df6fa0",
    },
    {
      id: "hydrant_grid",
      name: "City Hydrant Grid",
      summary: "Hydrant-dense downtown block supporting more authentic fire engine water refill play.",
      position: { x: 0, y: 6 },
      category: "special",
      accent: "#ff6f6f",
    },
  ] as const satisfies readonly WorldLocation[],
  calls: [
    {
      title: "Medical Aid",
      description: "Respond to a patient requiring transport.",
      location: "Springfield Heights",
      reward: 250,
      allowedTeams: ["FireRescue"] as TeamId[],
    },
    {
      title: "Structure Fire",
      description: "Smoke reported from an apartment block.",
      location: "River City Core",
      reward: 375,
      allowedTeams: ["FireRescue"] as TeamId[],
    },
    {
      title: "Traffic Light Outage",
      description: "Repair a dead downtown signal.",
      location: "River City Core",
      reward: 260,
      allowedTeams: ["PublicWorks"] as TeamId[],
    },
    {
      title: "Road Debris",
      description: "Clear debris from Liberty Parkway.",
      location: "Liberty Parkway",
      reward: 180,
      allowedTeams: ["PublicWorks"] as TeamId[],
    },
  ],
  ranks: {
    CityPolice: [
      { minXp: 0, name: "Cadet" },
      { minXp: 300, name: "Officer" },
      { minXp: 900, name: "Senior Officer" },
    ],
    StatePatrol: [
      { minXp: 0, name: "Trainee" },
      { minXp: 300, name: "Trooper" },
      { minXp: 900, name: "Senior Trooper" },
    ],
    FireRescue: [
      { minXp: 0, name: "Probationary" },
      { minXp: 300, name: "Responder" },
      { minXp: 900, name: "Specialist" },
    ],
    PublicWorks: [
      { minXp: 0, name: "Trainee" },
      { minXp: 300, name: "Operator" },
      { minXp: 900, name: "Field Lead" },
    ],
  } as const,
};

export const DEFAULT_PLAYER_STATE: Omit<PlayerPublicState, "id" | "name"> = {
  team: "Civilian",
  position: {
    x: 0,
    y: 0,
  },
  cash: 3000,
  bank: 1000,
  wanted: 0,
  criminalStatus: "clear",
  criminalHeat: 0,
  wantedExpiresAt: undefined,
  lastCrimeAt: undefined,
  jailedUntil: undefined,
  jailedBy: undefined,
  jailReason: undefined,
  claimedCallId: undefined,
  activeCrime: undefined,
  pendingPayout: undefined,
  citations: [],
  warnings: [],
  cameraOffenses: [],
  rankByTeam: {
    Civilian: "Resident",
    CityPolice: "Cadet",
    StatePatrol: "Trainee",
    FireRescue: "Probationary",
    PublicWorks: "Trainee",
  },
  serviceXpByTeam: {
    Civilian: 0,
    CityPolice: 0,
    StatePatrol: 0,
    FireRescue: 0,
    PublicWorks: 0,
  },
  housing: [],
  activeHouseId: undefined,
  vehicles: [],
  selectedVehicleId: undefined,
  activeVehicleEntityId: undefined,
  activeJobId: undefined,
  activeJobStep: 0,
  civilianJobReputation: 0,
  inventory: {
    SignalDisruptor: 0,
    LockpickKit: 0,
    PryBar: 0,
    Flashlight: 0,
  },
  offenses: [],
  bolo: false,
};