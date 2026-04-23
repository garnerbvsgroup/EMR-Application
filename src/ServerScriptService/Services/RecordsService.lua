local Players = game:GetService("Players")

local RecordsService = {
	prompts = {},
}

function RecordsService:Init(registry)
	self.registry = registry
end

function RecordsService:Start()
	Players.PlayerAdded:Connect(function(player)
		player.CharacterAdded:Connect(function(character)
			self:AttachInteractionPrompts(player, character)
		end)
	end)

	for _, player in ipairs(Players:GetPlayers()) do
		if player.Character then
			self:AttachInteractionPrompts(player, player.Character)
		end

		player.CharacterAdded:Connect(function(character)
			self:AttachInteractionPrompts(player, character)
		end)
	end
end

function RecordsService:AttachInteractionPrompts(player, character)
	local root = character:WaitForChild("HumanoidRootPart", 5)
	if not root then
		return
	end

	if self.prompts[player] then
		for _, prompt in ipairs(self.prompts[player]) do
			prompt:Destroy()
		end
	end

	local prompts = {}

	local citationPrompt = Instance.new("ProximityPrompt")
	citationPrompt.Name = "CitationPrompt"
	citationPrompt.ActionText = "Issue Citation"
	citationPrompt.ObjectText = player.Name
	citationPrompt.RequiresLineOfSight = false
	citationPrompt.MaxActivationDistance = 10
	citationPrompt.HoldDuration = 0.8
	citationPrompt.Parent = root
	citationPrompt.Triggered:Connect(function(officer)
		self:IssueCitation(officer, player)
	end)
	table.insert(prompts, citationPrompt)

	local warningPrompt = Instance.new("ProximityPrompt")
	warningPrompt.Name = "WarningPrompt"
	warningPrompt.ActionText = "Issue Warning"
	warningPrompt.ObjectText = player.Name
	warningPrompt.RequiresLineOfSight = false
	warningPrompt.MaxActivationDistance = 10
	warningPrompt.HoldDuration = 0.5
	warningPrompt.Parent = root
	warningPrompt.Triggered:Connect(function(officer)
		self:IssueWarning(officer, player)
	end)
	table.insert(prompts, warningPrompt)

	self.prompts[player] = prompts
end

function RecordsService:AddCameraOffense(player, offenseType, fine)
	local playerData = self.registry:GetService("PlayerDataService")
	local profile = playerData:GetProfile(player)
	if not profile then
		return
	end

	table.insert(profile.cameraOffenses, 1, {
		type = offenseType,
		fine = fine,
		timestamp = os.time(),
	})

	while #profile.cameraOffenses > 10 do
		table.remove(profile.cameraOffenses)
	end

	self.registry:GetService("DispatchService"):Notify(player, string.format("Traffic camera logged %s ($%d).", offenseType, fine))
	self.registry:GetService("DispatchService"):PushState(player)
end

function RecordsService:IssueCitation(officer, target)
	local teamService = self.registry:GetService("TeamService")
	if not teamService:IsLawEnforcement(officer:GetAttribute("TeamRole")) then
		return
	end

	local profile = self.registry:GetService("PlayerDataService"):GetProfile(target)
	if not profile or #profile.cameraOffenses == 0 then
		self.registry:GetService("DispatchService"):Notify(officer, "No validated camera offense on that player.")
		return
	end

	local offense = table.remove(profile.cameraOffenses, 1)
		table.insert(profile.citations, 1, {
			issuedBy = officer.Name,
			reason = offense.type,
			fine = offense.fine,
			timestamp = os.time(),
		})

		self.registry:GetService("EconomyService"):AdjustBank(target, -offense.fine)
		self.registry:GetService("PlayerDataService"):AddOffense(target, string.format("Citation: %s", offense.type))
		self.registry:GetService("ProgressionService"):AddServiceXp(officer, officer:GetAttribute("TeamRole"), 40)
		self.registry:GetService("DispatchService"):Notify(officer, string.format("Issued %s citation for $%d.", offense.type, offense.fine))
		self.registry:GetService("DispatchService"):Notify(target, string.format("You received a citation for %s ($%d).", offense.type, offense.fine))
		self.registry:GetService("DispatchService"):BroadcastState()
end

function RecordsService:IssueWarning(officer, target)
	local teamService = self.registry:GetService("TeamService")
	if not teamService:IsLawEnforcement(officer:GetAttribute("TeamRole")) then
		return
	end

	local profile = self.registry:GetService("PlayerDataService"):GetProfile(target)
	if not profile then
		return
	end

	table.insert(profile.warnings, 1, {
		issuedBy = officer.Name,
		reason = "Officer warning",
		timestamp = os.time(),
	})

	while #profile.warnings > 10 do
		table.remove(profile.warnings)
	end

	self.registry:GetService("ProgressionService"):AddServiceXp(officer, officer:GetAttribute("TeamRole"), 15)
	self.registry:GetService("DispatchService"):Notify(officer, "Warning issued.")
	self.registry:GetService("DispatchService"):Notify(target, "You received an officer warning.")
	self.registry:GetService("DispatchService"):BroadcastState()
end

function RecordsService:ToggleBolo(playerName, officer)
	local teamService = self.registry:GetService("TeamService")
	if not teamService:IsLawEnforcement(officer:GetAttribute("TeamRole")) then
		return false, "Only law enforcement can change BOLO flags."
	end

	for _, target in ipairs(Players:GetPlayers()) do
		if string.lower(target.Name) == string.lower(playerName) then
			local profile = self.registry:GetService("PlayerDataService"):GetProfile(target)
			if not profile then
				break
			end

			profile.isBolo = not profile.isBolo
			self.registry:GetService("PlayerDataService"):SyncProfileAttributes(target)
			self.registry:GetService("DispatchService"):BroadcastState()
			return true, profile.isBolo and "BOLO enabled." or "BOLO cleared."
		end
	end

	return false, "Player not found."
end

return RecordsService