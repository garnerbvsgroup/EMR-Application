local TeamsConfig = require(game:GetService("ReplicatedStorage").Shared.Config.Teams)

local ProgressionService = {}

local RANKS = {
	CityPolice = {
		{ minXp = 0, name = "Cadet" },
		{ minXp = 300, name = "Officer" },
		{ minXp = 900, name = "Senior Officer" },
	},
	StatePatrol = {
		{ minXp = 0, name = "Trainee" },
		{ minXp = 300, name = "Trooper" },
		{ minXp = 900, name = "Senior Trooper" },
	},
	FireRescue = {
		{ minXp = 0, name = "Probationary" },
		{ minXp = 300, name = "Responder" },
		{ minXp = 900, name = "Specialist" },
	},
	PublicWorks = {
		{ minXp = 0, name = "Trainee" },
		{ minXp = 300, name = "Operator" },
		{ minXp = 900, name = "Field Lead" },
	},
}

function ProgressionService:Init(registry)
	self.registry = registry
end

function ProgressionService:Start()
	return
end

function ProgressionService:GetRankForXp(teamName, xp)
	local teamRanks = RANKS[teamName]
	if not teamRanks then
		return TeamsConfig[teamName] and TeamsConfig[teamName].DisplayName or teamName
	end

	local rankName = teamRanks[1].name
	for _, rank in ipairs(teamRanks) do
		if xp >= rank.minXp then
			rankName = rank.name
		end
	end

	return rankName
end

function ProgressionService:AddServiceXp(player, teamName, amount)
	local playerData = self.registry:GetService("PlayerDataService")
	local profile = playerData:GetProfile(player)
	if not profile or not profile.serviceXp[teamName] then
		return
	end

	profile.serviceXp[teamName] += amount
	profile.serviceRanks[teamName] = self:GetRankForXp(teamName, profile.serviceXp[teamName])
	playerData:SyncProfileAttributes(player)
	self.registry:GetService("DispatchService"):PushState(player)
	return profile.serviceRanks[teamName], profile.serviceXp[teamName]
end

return ProgressionService