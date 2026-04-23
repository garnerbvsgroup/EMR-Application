local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Jobs = require(ReplicatedStorage.Shared.Config.Jobs)
local Housing = require(ReplicatedStorage.Shared.Config.Housing)

local CivilianLifeService = {}

function CivilianLifeService:Init(registry)
	self.registry = registry
end

function CivilianLifeService:Start()
	Players.PlayerRemoving:Connect(function(player)
		local playerData = self.registry:GetService("PlayerDataService")
		local profile = playerData:GetProfile(player)
		if profile then
			profile.activeJob = nil
		end
	end)
end

function CivilianLifeService:DepositCash(player, amount)
	amount = math.max(0, math.floor(tonumber(amount) or 0))
	if amount <= 0 then
		return false, "Invalid deposit amount."
	end

	local economy = self.registry:GetService("EconomyService")
	if not economy:SpendCash(player, amount) then
		return false, "Not enough cash to deposit."
	end

	economy:AdjustBank(player, amount)
	return true, string.format("Deposited $%d.", amount)
end

function CivilianLifeService:WithdrawCash(player, amount)
	amount = math.max(0, math.floor(tonumber(amount) or 0))
	if amount <= 0 then
		return false, "Invalid withdrawal amount."
	end

	local economy = self.registry:GetService("EconomyService")
	local profile = self.registry:GetService("PlayerDataService"):GetProfile(player)
	if not profile or profile.bank < amount then
		return false, "Not enough bank balance."
	end

	economy:AdjustBank(player, -amount)
		economy:AddCash(player, amount)
	return true, string.format("Withdrew $%d.", amount)
end

function CivilianLifeService:TransferFunds(sender, targetName, amount)
	amount = math.max(0, math.floor(tonumber(amount) or 0))
	if amount <= 0 then
		return false, "Invalid transfer amount."
	end

	local target
	for _, player in ipairs(Players:GetPlayers()) do
		if string.lower(player.Name) == string.lower(targetName) then
			target = player
			break
		end
	end

	if not target then
		return false, "Target player not found."
	end

	if target == sender then
		return false, "Cannot transfer to yourself."
	end

	local economy = self.registry:GetService("EconomyService")
	local senderProfile = self.registry:GetService("PlayerDataService"):GetProfile(sender)
	if not senderProfile or senderProfile.bank < amount then
		return false, "Not enough bank balance."
	end

	economy:AdjustBank(sender, -amount)
	economy:AdjustBank(target, amount)
	self.registry:GetService("DispatchService"):Notify(target, string.format("Received bank transfer of $%d from %s.", amount, sender.Name))
	return true, string.format("Transferred $%d to %s.", amount, target.Name)
end

function CivilianLifeService:StartJob(player, jobId)
	local job = Jobs[jobId]
	if not job then
		return false, "Unknown job."
	end

	local profile = self.registry:GetService("PlayerDataService"):GetProfile(player)
	if not profile then
		return false, "Missing profile."
	end

	if player:GetAttribute("TeamRole") ~= "Civilian" then
		return false, "Jobs are only available to civilians."
	end

	profile.activeJob = {
		id = jobId,
		step = 1,
	}

	self.registry:GetService("PlayerDataService"):SyncProfileAttributes(player)
	self.registry:GetService("DispatchService"):Notify(player, string.format("Started %s.", job.DisplayName))
	self.registry:GetService("DispatchService"):PushState(player)
	return true, string.format("Active step: %s", job.Steps[1])
end

function CivilianLifeService:AdvanceJob(player)
	local profile = self.registry:GetService("PlayerDataService"):GetProfile(player)
	if not profile or not profile.activeJob then
		return false, "No active job."
	end

	local job = Jobs[profile.activeJob.id]
	profile.activeJob.step += 1

	if profile.activeJob.step > #job.Steps then
		profile.activeJob = nil
		self.registry:GetService("PlayerDataService"):SyncProfileAttributes(player)
		self.registry:GetService("EconomyService"):AddCash(player, job.Reward)
		self.registry:GetService("DispatchService"):Notify(player, string.format("Completed %s for $%d.", job.DisplayName, job.Reward))
		self.registry:GetService("DispatchService"):PushState(player)
		return true, "Job complete."
	end

	self.registry:GetService("PlayerDataService"):SyncProfileAttributes(player)
	self.registry:GetService("DispatchService"):PushState(player)
	return true, string.format("Next step: %s", job.Steps[profile.activeJob.step])
end

function CivilianLifeService:PurchaseHouse(player, plotId)
	local house = Housing[plotId]
	if not house then
		return false, "Unknown property."
	end

	local profile = self.registry:GetService("PlayerDataService"):GetProfile(player)
	if not profile then
		return false, "Missing profile."
	end

	if profile.ownedHouses[plotId] then
		profile.activeHouseId = plotId
		self.registry:GetService("PlayerDataService"):SyncProfileAttributes(player)
		self.registry:GetService("DispatchService"):PushState(player)
		return true, string.format("Set %s as active home.", house.DisplayName)
	end

	if not self.registry:GetService("EconomyService"):SpendCash(player, house.Price) then
		return false, string.format("Need $%d to purchase %s.", house.Price, house.DisplayName)
	end

	profile.ownedHouses[plotId] = true
	profile.activeHouseId = plotId
	self.registry:GetService("PlayerDataService"):SyncProfileAttributes(player)
	self.registry:GetService("DispatchService"):PushState(player)
	return true, string.format("Purchased %s.", house.DisplayName)
end

function CivilianLifeService:GoHome(player)
	local profile = self.registry:GetService("PlayerDataService"):GetProfile(player)
	if not profile or not profile.activeHouseId then
		return false, "No active home selected."
	end

	local house = Housing[profile.activeHouseId]
	if not house or not player.Character then
		return false, "Home is unavailable."
	end

	player.Character:PivotTo(CFrame.new(house.SpawnPosition))
	return true, string.format("Teleported to %s.", house.DisplayName)
end

return CivilianLifeService