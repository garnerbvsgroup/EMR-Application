local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Calls = require(ReplicatedStorage.Shared.Config.Calls)

local IncidentService = {}

function IncidentService:Init(registry)
	self.registry = registry
end

function IncidentService:Start()
	for teamName, definitions in pairs(Calls) do
		task.spawn(function()
			while true do
				task.wait(40)
				self:GenerateCall(teamName, definitions)
			end
		end)
	end
end

function IncidentService:GenerateCall(teamName, definitions)
	local dispatchService = self.registry:GetService("DispatchService")
	local existingCalls = dispatchService:GetCallsForTeam(teamName)
	if #existingCalls >= 3 then
		return
	end

	local definition = definitions[math.random(1, #definitions)]
	dispatchService:CreateCall({
		title = definition.Title,
		description = definition.Description,
		location = definition.Location,
		reward = definition.Reward,
		allowedTeams = { teamName },
		duration = 300,
	})
end

return IncidentService