local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = require(ReplicatedStorage.Shared.Remotes)

local DispatchService = {
	activeCalls = {},
	nextCallId = 0,
}

local function arrayContains(values, target)
	for _, value in ipairs(values) do
		if value == target then
			return true
		end
	end

	return false
end

function DispatchService:Init(registry)
	self.registry = registry

	local remoteFolder = ReplicatedStorage:FindFirstChild(Remotes.FolderName)
	if remoteFolder then
		remoteFolder:Destroy()
	end

	remoteFolder = Instance.new("Folder")
	remoteFolder.Name = Remotes.FolderName
	remoteFolder.Parent = ReplicatedStorage

	self.actionEvent = Instance.new("RemoteEvent")
	self.actionEvent.Name = Remotes.ActionEvent
	self.actionEvent.Parent = remoteFolder

	self.stateEvent = Instance.new("RemoteEvent")
	self.stateEvent.Name = Remotes.StateEvent
	self.stateEvent.Parent = remoteFolder

	self.notificationEvent = Instance.new("RemoteEvent")
	self.notificationEvent.Name = Remotes.NotificationEvent
	self.notificationEvent.Parent = remoteFolder
end

function DispatchService:Start()
	task.spawn(function()
		while true do
			task.wait(3)
			self:ExpireCalls()
		end
	end)
end

function DispatchService:GetActionEvent()
	return self.actionEvent
end

function DispatchService:CreateCall(callData)
	self.nextCallId += 1

	local call = {
		id = self.nextCallId,
		title = callData.title,
		description = callData.description,
		location = callData.location or "Unknown",
		reward = callData.reward or 0,
		allowedTeams = callData.allowedTeams or {},
		createdAt = os.clock(),
		expiresAt = os.clock() + (callData.duration or 300),
		claimedByUserId = nil,
		suspectUserId = callData.suspectUserId,
	}

	table.insert(self.activeCalls, call)
	self:BroadcastState()
	return call.id
end

function DispatchService:ExpireCalls()
	local didChange = false

	for index = #self.activeCalls, 1, -1 do
		local call = self.activeCalls[index]
		if os.clock() >= call.expiresAt then
			table.remove(self.activeCalls, index)
			didChange = true
		end
	end

	if didChange then
		self:BroadcastState()
	end
end

function DispatchService:GetCallsForTeam(teamName)
	local result = {}

	for _, call in ipairs(self.activeCalls) do
		if arrayContains(call.allowedTeams, teamName) then
			table.insert(result, call)
		end
	end

	return result
end

function DispatchService:GetCallById(callId)
	for _, call in ipairs(self.activeCalls) do
		if call.id == callId then
			return call
		end
	end

	return nil
end

function DispatchService:RemoveCall(callId)
	for index, call in ipairs(self.activeCalls) do
		if call.id == callId then
			table.remove(self.activeCalls, index)
			self:BroadcastState()
			return
		end
	end
end

function DispatchService:ClaimNextCall(player)
	local teamName = player:GetAttribute("TeamRole")
	local playerData = self.registry:GetService("PlayerDataService")
	local profile = playerData:GetProfile(player)
	if not profile then
		return
	end

	if profile.claimedCallId then
		self:Notify(player, "You already have a claimed call.")
		return
	end

	for _, call in ipairs(self.activeCalls) do
		if arrayContains(call.allowedTeams, teamName) and not call.claimedByUserId then
			call.claimedByUserId = player.UserId
			playerData:SetClaimedCall(player, call.id)
			self:Notify(player, string.format("Claimed call: %s", call.title))
			self:BroadcastState()
			return
		end
	end

	self:Notify(player, "No calls available for your team.")
end

function DispatchService:CompleteClaimedCall(player)
	local playerData = self.registry:GetService("PlayerDataService")
	local claimedCallId = player:GetAttribute("ClaimedCall")
	if claimedCallId == "" then
		self:Notify(player, "You have no claimed call.")
		return
	end

	local call = self:GetCallById(tonumber(claimedCallId))
	if not call then
		playerData:SetClaimedCall(player, nil)
		self:Notify(player, "That call no longer exists.")
		self:BroadcastState()
		return
	end

	if call.claimedByUserId ~= player.UserId then
		self:Notify(player, "That call belongs to another responder.")
		return
	end

	playerData:SetClaimedCall(player, nil)
	self.registry:GetService("EconomyService"):AddCash(player, call.reward)
	self:Notify(player, string.format("Completed %s for $%d.", call.title, call.reward))
	self:RemoveCall(call.id)
end

function DispatchService:ResolveCallsForSuspect(officer, suspect)
	local rewardTotal = 0
	local resolvedIds = {}

	for _, call in ipairs(self.activeCalls) do
		if call.suspectUserId == suspect.UserId then
			rewardTotal += call.reward
			table.insert(resolvedIds, call.id)
		end
	end

	for _, callId in ipairs(resolvedIds) do
		self:RemoveCall(callId)
	end

	if rewardTotal == 0 then
		rewardTotal = 150
	end

	self.registry:GetService("EconomyService"):AddCash(officer, rewardTotal)
	self:Notify(officer, string.format("Suspect booked. Awarded $%d.", rewardTotal))
end

function DispatchService:SerializeState(player)
	local inventoryService = self.registry:GetService("InventoryService")
	local profile = self.registry:GetService("PlayerDataService"):GetProfile(player)
	local teamName = player:GetAttribute("TeamRole")

	local calls = {}
	for _, call in ipairs(self:GetCallsForTeam(teamName)) do
		table.insert(calls, {
			id = call.id,
			title = call.title,
			description = call.description,
			location = call.location,
			reward = call.reward,
			claimedByUserId = call.claimedByUserId,
		})
	end

	return {
		cash = player:GetAttribute("Cash") or 0,
		bank = player:GetAttribute("Bank") or 0,
		wanted = player:GetAttribute("Wanted") or 0,
		team = teamName,
		bolo = player:GetAttribute("Bolo") or false,
		claimedCall = player:GetAttribute("ClaimedCall") or "",
		pendingPayout = player:GetAttribute("PendingPayout") or 0,
		pendingCrime = player:GetAttribute("PendingCrime") or "",
		activeJob = player:GetAttribute("ActiveJob") or "",
		inventory = inventoryService:GetInventoryList(player),
		offenses = profile and profile.offenses or {},
		citations = profile and profile.citations or {},
		warnings = profile and profile.warnings or {},
		cameraOffenses = profile and profile.cameraOffenses or {},
		ownedVehicles = profile and profile.ownedVehicles or {},
		selectedVehicleId = profile and profile.selectedVehicleId or nil,
		ownedHouses = profile and profile.ownedHouses or {},
		activeHouseId = profile and profile.activeHouseId or nil,
		serviceRanks = profile and profile.serviceRanks or {},
		serviceXp = profile and profile.serviceXp or {},
		activeJobStep = profile and profile.activeJob and profile.activeJob.step or 0,
		calls = calls,
	}
end

function DispatchService:PushState(player)
	if player and player.Parent then
		self.stateEvent:FireClient(player, self:SerializeState(player))
	end
end

function DispatchService:BroadcastState()
	for _, player in ipairs(Players:GetPlayers()) do
		self:PushState(player)
	end
end

function DispatchService:Notify(player, message)
	if player and player.Parent then
		self.notificationEvent:FireClient(player, message)
	end
end

return DispatchService