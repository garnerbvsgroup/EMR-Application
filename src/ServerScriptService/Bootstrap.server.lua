local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local ServiceRegistry = require(script.Parent.Services.ServiceRegistry)
local WorldBuilder = require(script.Parent.Systems.WorldBuilder)
local ToolsConfig = require(ReplicatedStorage.Shared.Config.Tools)
local JobsConfig = require(ReplicatedStorage.Shared.Config.Jobs)
local HousingConfig = require(ReplicatedStorage.Shared.Config.Housing)
local VehiclesConfig = require(ReplicatedStorage.Shared.Config.Vehicles)

ServiceRegistry:Init()
WorldBuilder:Build(ServiceRegistry)

local dispatchService = ServiceRegistry:GetService("DispatchService")

dispatchService:GetActionEvent().OnServerEvent:Connect(function(player, actionName, payload)
	if actionName == "ClaimNextCall" then
		dispatchService:ClaimNextCall(player)
	elseif actionName == "CompleteClaimedCall" then
		dispatchService:CompleteClaimedCall(player)
	elseif actionName == "PayFines" then
		ServiceRegistry:GetService("EconomyService"):PayOutstandingFines(player)
	elseif actionName == "SpawnVehicle" then
		ServiceRegistry:GetService("VehicleService"):SpawnVehicle(player)
	elseif actionName == "PurchaseItem" and payload and ToolsConfig[payload.itemId] then
		local ok, message = ServiceRegistry:GetService("InventoryService"):PurchaseItem(player, payload.itemId)
		dispatchService:Notify(player, message)
		if ok then
			dispatchService:PushState(player)
		end
	elseif actionName == "SwitchTeam" and payload and payload.teamName then
		local ok, message = ServiceRegistry:GetService("TeamService"):SetTeam(player, payload.teamName)
		dispatchService:Notify(player, message)
		if ok then
			dispatchService:PushState(player)
		end
	elseif actionName == "DepositCash" and payload then
		local ok, message = ServiceRegistry:GetService("CivilianLifeService"):DepositCash(player, payload.amount)
		dispatchService:Notify(player, message)
	elseif actionName == "WithdrawCash" and payload then
		local ok, message = ServiceRegistry:GetService("CivilianLifeService"):WithdrawCash(player, payload.amount)
		dispatchService:Notify(player, message)
	elseif actionName == "TransferFunds" and payload then
		local ok, message = ServiceRegistry:GetService("CivilianLifeService"):TransferFunds(player, payload.targetName, payload.amount)
		dispatchService:Notify(player, message)
	elseif actionName == "StartJob" and payload and JobsConfig[payload.jobId] then
		local ok, message = ServiceRegistry:GetService("CivilianLifeService"):StartJob(player, payload.jobId)
		dispatchService:Notify(player, message)
	elseif actionName == "AdvanceJob" then
		local ok, message = ServiceRegistry:GetService("CivilianLifeService"):AdvanceJob(player)
		dispatchService:Notify(player, message)
	elseif actionName == "PurchaseHouse" and payload and HousingConfig[payload.plotId] then
		local ok, message = ServiceRegistry:GetService("CivilianLifeService"):PurchaseHouse(player, payload.plotId)
		dispatchService:Notify(player, message)
	elseif actionName == "GoHome" then
		local ok, message = ServiceRegistry:GetService("CivilianLifeService"):GoHome(player)
		dispatchService:Notify(player, message)
	elseif actionName == "PurchaseVehicle" and payload and VehiclesConfig[payload.vehicleId] then
		local ok, message = ServiceRegistry:GetService("VehicleService"):PurchaseVehicle(player, payload.vehicleId)
		dispatchService:Notify(player, message)
	elseif actionName == "CameraTicket" and payload and payload.offenseType then
		ServiceRegistry:GetService("RecordsService"):AddCameraOffense(player, payload.offenseType, payload.fine or 75)
	elseif actionName == "ToggleBolo" and payload and payload.playerName then
		local ok, message = ServiceRegistry:GetService("RecordsService"):ToggleBolo(payload.playerName, player)
		dispatchService:Notify(player, message)
	end
end)

Players.PlayerAdded:Connect(function(player)
	task.defer(function()
		dispatchService:PushState(player)
	end)
end)

game:BindToClose(function()
	for _, player in ipairs(Players:GetPlayers()) do
		ServiceRegistry:GetService("PlayerDataService"):SaveProfile(player)
	end
end)