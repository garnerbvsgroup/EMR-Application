local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Crimes = require(ReplicatedStorage.Shared.Config.Crimes)

local CrimeService = {
	prompts = {},
}

function CrimeService:Init(registry)
	self.registry = registry
end

function CrimeService:Start()
	Players.PlayerAdded:Connect(function(player)
		player.CharacterAdded:Connect(function(character)
			self:AttachArrestPrompt(player, character)
		end)

		player:GetAttributeChangedSignal("Wanted"):Connect(function()
			self:RefreshPrompt(player)
		end)
	end)

	for _, player in ipairs(Players:GetPlayers()) do
		if player.Character then
			self:AttachArrestPrompt(player, player.Character)
		end

		player.CharacterAdded:Connect(function(character)
			self:AttachArrestPrompt(player, character)
		end)

		player:GetAttributeChangedSignal("Wanted"):Connect(function()
			self:RefreshPrompt(player)
		end)
	end
end

function CrimeService:AttachArrestPrompt(player, character)
	local root = character:WaitForChild("HumanoidRootPart", 5)
	if not root then
		return
	end

	if self.prompts[player] then
		self.prompts[player]:Destroy()
	end

	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "ArrestPrompt"
	prompt.ActionText = "Arrest Suspect"
	prompt.ObjectText = player.Name
	prompt.RequiresLineOfSight = false
	prompt.MaxActivationDistance = 10
	prompt.HoldDuration = 1.1
	prompt.Enabled = (player:GetAttribute("Wanted") or 0) > 0
	prompt.Parent = root

	prompt.Triggered:Connect(function(officer)
		self:ArrestPlayer(officer, player)
	end)

	self.prompts[player] = prompt
end

function CrimeService:RefreshPrompt(player)
	local prompt = self.prompts[player]
	if prompt then
		prompt.Enabled = (player:GetAttribute("Wanted") or 0) > 0
	end
end

function CrimeService:StartCrime(player, crimeId)
	local crime = Crimes[crimeId]
	if not crime then
		return false, "Unknown crime."
	end

	if player:GetAttribute("TeamRole") ~= "Civilian" then
		return false, "Only civilians can start this crime."
	end

	local playerData = self.registry:GetService("PlayerDataService")
	local profile = playerData:GetProfile(player)
	if not profile then
		return false, "Player profile missing."
	end

	local cooldownEnd = profile.cooldowns[crimeId]
	if cooldownEnd and cooldownEnd > os.clock() then
		return false, string.format("%s cooling down for %d more seconds.", crime.DisplayName, math.ceil(cooldownEnd - os.clock()))
	end

	local inventoryService = self.registry:GetService("InventoryService")
	if crime.RequiredTool and not inventoryService:HasItem(player, crime.RequiredTool) then
		return false, string.format("You need %s.", crime.RequiredTool)
	end

	if crime.ConsumesTool then
		inventoryService:RemoveItem(player, crime.RequiredTool, 1)
	end

	profile.cooldowns[crimeId] = os.clock() + crime.Cooldown

	local payout = math.random(crime.PayoutMin, crime.PayoutMax)
	playerData:AddWanted(player, crime.Wanted)
	playerData:AddOffense(player, crime.DisplayName)
	playerData:SetPendingReward(player, {
		amount = payout,
		label = crime.DisplayName,
		crimeId = crimeId,
	})

	self.registry:GetService("DispatchService"):CreateCall({
		title = crime.DispatchTitle,
		description = crime.DispatchDescription,
		location = "Live incident",
		reward = crime.DispatchReward,
		allowedTeams = { "CityPolice", "StatePatrol" },
		duration = 300,
		suspectUserId = player.UserId,
	})

	self.registry:GetService("DispatchService"):Notify(player, string.format("%s underway. Survive %d seconds to secure $%d.", crime.DisplayName, crime.SecureSeconds, payout))
	self.registry:GetService("DispatchService"):BroadcastState()

	task.delay(crime.SecureSeconds, function()
		if not player.Parent then
			return
		end

		local currentProfile = playerData:GetProfile(player)
		if not currentProfile or not currentProfile.pendingReward or currentProfile.pendingReward.crimeId ~= crimeId then
			return
		end

		self.registry:GetService("EconomyService"):AddCash(player, payout)
		playerData:SetPendingReward(player, nil)
		self.registry:GetService("DispatchService"):Notify(player, string.format("Secured payout: $%d from %s.", payout, crime.DisplayName))
		self.registry:GetService("DispatchService"):BroadcastState()
	end)

	return true, string.format("Started %s.", crime.DisplayName)
end

function CrimeService:ClearPendingReward(player, reason)
	local playerData = self.registry:GetService("PlayerDataService")
	local profile = playerData:GetProfile(player)
	if not profile or not profile.pendingReward then
		return
	end

	playerData:SetPendingReward(player, nil)
	self.registry:GetService("DispatchService"):Notify(player, string.format("Pending payout lost: %s.", reason))
	self.registry:GetService("DispatchService"):BroadcastState()
end

function CrimeService:ArrestPlayer(officer, suspect)
	if officer == suspect then
		return
	end

	local teamService = self.registry:GetService("TeamService")
	if not teamService:IsLawEnforcement(officer:GetAttribute("TeamRole")) then
		return
	end

	local wanted = suspect:GetAttribute("Wanted") or 0
	if wanted <= 0 then
		self.registry:GetService("DispatchService"):Notify(officer, "That player is not wanted.")
		return
	end

	self:ClearPendingReward(suspect, "Arrested")
	self.registry:GetService("PlayerDataService"):UpdateWanted(suspect, 0)
	self.registry:GetService("PlayerDataService"):AddOffense(suspect, "Arrested")
	self.registry:GetService("DispatchService"):ResolveCallsForSuspect(officer, suspect)
	self.registry:GetService("DispatchService"):Notify(suspect, "You were arrested and sent back to civilian status.")
	self.registry:GetService("ProgressionService"):AddServiceXp(officer, officer:GetAttribute("TeamRole"), 90)

	local jailSpawn = workspace:FindFirstChild("GeneratedWorld")
		and workspace.GeneratedWorld:FindFirstChild("JailSpawn")
	if jailSpawn and suspect.Character and suspect.Character:FindFirstChild("HumanoidRootPart") then
		suspect.Character:PivotTo(jailSpawn.CFrame + Vector3.new(0, 3, 0))
	end

	if suspect:GetAttribute("TeamRole") ~= "Civilian" then
		self.registry:GetService("TeamService"):SetTeam(suspect, "Civilian")
	end

	self.registry:GetService("DispatchService"):BroadcastState()
end

return CrimeService