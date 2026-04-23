local Players = game:GetService("Players")

local PlayerDataService = {
	profiles = {},
}

local DEFAULT_PROFILE = {
	cash = 3000,
	bank = 1000,
	wanted = 0,
	team = "Civilian",
	inventory = {},
	ownedVehicles = {},
	selectedVehicleId = nil,
	ownedHouses = {},
	activeHouseId = nil,
	serviceXp = {
		CityPolice = 0,
		StatePatrol = 0,
		FireRescue = 0,
		PublicWorks = 0,
	},
	serviceRanks = {
		CityPolice = "Cadet",
		StatePatrol = "Trainee",
		FireRescue = "Probationary",
		PublicWorks = "Trainee",
	},
	activeJob = nil,
	citations = {},
	warnings = {},
	cameraOffenses = {},
	isBolo = false,
	cooldowns = {},
	offenses = {},
	claimedCallId = nil,
	pendingReward = nil,
	spawnedVehicle = nil,
}

local function deepCopy(value)
	if type(value) ~= "table" then
		return value
	end

	local clone = {}
	for key, innerValue in pairs(value) do
		clone[key] = deepCopy(innerValue)
	end

	return clone
end

function PlayerDataService:Init(registry)
	self.registry = registry
end

function PlayerDataService:Start()
	Players.PlayerAdded:Connect(function(player)
		self:CreateProfile(player)
	end)

	Players.PlayerRemoving:Connect(function(player)
		self:SaveProfile(player)
		self.profiles[player] = nil
	end)

	for _, player in ipairs(Players:GetPlayers()) do
		self:CreateProfile(player)
	end
end

function PlayerDataService:CreateProfile(player)
	local profile = deepCopy(DEFAULT_PROFILE)
	local persisted = self.registry:GetService("PersistenceService"):LoadProfile(player.UserId)
	if persisted then
		for key, value in pairs(persisted) do
			profile[key] = value
		end
	end

	self.profiles[player] = profile

	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	leaderstats.Parent = player

	local cashValue = Instance.new("IntValue")
	cashValue.Name = "Cash"
	cashValue.Value = profile.cash
	cashValue.Parent = leaderstats

	local wantedValue = Instance.new("IntValue")
	wantedValue.Name = "Wanted"
	wantedValue.Value = profile.wanted
	wantedValue.Parent = leaderstats

	self:SyncProfileAttributes(player)
end

function PlayerDataService:GetProfile(player)
	return self.profiles[player]
end

function PlayerDataService:UpdateCash(player, amount)
	local profile = self:GetProfile(player)
	if not profile then
		return
	end

	profile.cash = amount
	self:SyncProfileAttributes(player)

	local leaderstats = player:FindFirstChild("leaderstats")
	if leaderstats and leaderstats:FindFirstChild("Cash") then
		leaderstats.Cash.Value = amount
	end
end

function PlayerDataService:UpdateWanted(player, amount)
	local profile = self:GetProfile(player)
	if not profile then
		return
	end

	profile.wanted = math.max(0, amount)
	self:SyncProfileAttributes(player)

	local leaderstats = player:FindFirstChild("leaderstats")
	if leaderstats and leaderstats:FindFirstChild("Wanted") then
		leaderstats.Wanted.Value = profile.wanted
	end
end

function PlayerDataService:AddWanted(player, amount)
	local profile = self:GetProfile(player)
	if not profile then
		return
	end

	self:UpdateWanted(player, profile.wanted + amount)
end

function PlayerDataService:SetTeam(player, teamName)
	local profile = self:GetProfile(player)
	if not profile then
		return
	end

	profile.team = teamName
	self:SyncProfileAttributes(player)
end

function PlayerDataService:SetClaimedCall(player, callId)
	local profile = self:GetProfile(player)
	if not profile then
		return
	end

	profile.claimedCallId = callId
	self:SyncProfileAttributes(player)
end

function PlayerDataService:SetPendingReward(player, rewardInfo)
	local profile = self:GetProfile(player)
	if not profile then
		return
	end

	profile.pendingReward = rewardInfo
	self:SyncProfileAttributes(player)
end

function PlayerDataService:AddOffense(player, label)
	local profile = self:GetProfile(player)
	if not profile then
		return
	end

	table.insert(profile.offenses, 1, {
		label = label,
		timestamp = os.time(),
	})

	while #profile.offenses > 10 do
		table.remove(profile.offenses)
	end
end

function PlayerDataService:SyncProfileAttributes(player)
	local profile = self:GetProfile(player)
	if not profile then
		return
	end

	player:SetAttribute("Cash", profile.cash)
	player:SetAttribute("Bank", profile.bank or 0)
	player:SetAttribute("Wanted", profile.wanted)
	player:SetAttribute("TeamRole", profile.team)
	player:SetAttribute("ClaimedCall", profile.claimedCallId and tostring(profile.claimedCallId) or "")
	player:SetAttribute("PendingPayout", profile.pendingReward and profile.pendingReward.amount or 0)
	player:SetAttribute("PendingCrime", profile.pendingReward and profile.pendingReward.label or "")
	player:SetAttribute("ActiveJob", profile.activeJob and profile.activeJob.id or "")
	player:SetAttribute("Bolo", profile.isBolo and true or false)

	local leaderstats = player:FindFirstChild("leaderstats")
	if leaderstats and leaderstats:FindFirstChild("Cash") then
		leaderstats.Cash.Value = profile.cash
	end
	if leaderstats and leaderstats:FindFirstChild("Wanted") then
		leaderstats.Wanted.Value = profile.wanted
	end
end

function PlayerDataService:GetPersistencePayload(player)
	local profile = self:GetProfile(player)
	if not profile then
		return nil
	end

	local payload = deepCopy(profile)
	payload.spawnedVehicle = nil
	payload.claimedCallId = nil
	payload.pendingReward = nil
	return payload
end

function PlayerDataService:SaveProfile(player)
	local payload = self:GetPersistencePayload(player)
	if not payload then
		return false
	end

	return self.registry:GetService("PersistenceService"):SaveProfile(player.UserId, payload)
end

return PlayerDataService