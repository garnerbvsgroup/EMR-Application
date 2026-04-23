local ServiceRegistry = {
	services = {},
	startOrder = {
		"PersistenceService",
		"PlayerDataService",
		"EconomyService",
		"InventoryService",
		"ProgressionService",
		"RecordsService",
		"CivilianLifeService",
		"DispatchService",
		"TeamService",
		"CrimeService",
		"VehicleService",
		"IncidentService",
	},
}

function ServiceRegistry:Init()
	local modules = {
		PersistenceService = require(script.Parent.PersistenceService),
		PlayerDataService = require(script.Parent.PlayerDataService),
		EconomyService = require(script.Parent.EconomyService),
		InventoryService = require(script.Parent.InventoryService),
		ProgressionService = require(script.Parent.ProgressionService),
		RecordsService = require(script.Parent.RecordsService),
		CivilianLifeService = require(script.Parent.CivilianLifeService),
		DispatchService = require(script.Parent.DispatchService),
		TeamService = require(script.Parent.TeamService),
		CrimeService = require(script.Parent.CrimeService),
		VehicleService = require(script.Parent.VehicleService),
		IncidentService = require(script.Parent.IncidentService),
	}

	self.services = modules

	for _, service in pairs(modules) do
		if service.Init then
			service:Init(self)
		end
	end

	for _, serviceName in ipairs(self.startOrder) do
		local service = modules[serviceName]
		if service and service.Start then
			service:Start()
		end
	end
end

function ServiceRegistry:GetService(serviceName)
	local service = self.services[serviceName]
	assert(service, string.format("Unknown service requested: %s", serviceName))
	return service
end

return ServiceRegistry