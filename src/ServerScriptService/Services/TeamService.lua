local TeamsConfig = require(game:GetService("ReplicatedStorage").Shared.Config.Teams)

local TeamService = {}

function TeamService:Init(registry)
	self.registry = registry
end

function TeamService:Start()
	return
end

function TeamService:IsLawEnforcement(teamName)
	return teamName == "CityPolice" or teamName == "StatePatrol"
end

function TeamService:SetTeam(player, teamName)
	if not TeamsConfig[teamName] then
		return false, "Unknown team."
	end

	if TeamsConfig[teamName].ServiceTeam and (player:GetAttribute("Wanted") or 0) > 0 then
		return false, "Clear your wanted status before joining a service team."
	end

	self.registry:GetService("PlayerDataService"):SetTeam(player, teamName)
	self.registry:GetService("DispatchService"):PushState(player)
	return true, string.format("Switched to %s.", TeamsConfig[teamName].DisplayName)
end

return TeamService