local Tools = require(game:GetService("ReplicatedStorage").Shared.Config.Tools)

local InventoryService = {}

function InventoryService:Init(registry)
	self.registry = registry
end

function InventoryService:Start()
	return
end

function InventoryService:GetInventory(player)
	local profile = self.registry:GetService("PlayerDataService"):GetProfile(player)
	return profile and profile.inventory or {}
end

function InventoryService:GetInventoryList(player)
	local inventory = self:GetInventory(player)
	local result = {}

	for itemId, count in pairs(inventory) do
		table.insert(result, {
			id = itemId,
			count = count,
			displayName = Tools[itemId] and Tools[itemId].DisplayName or itemId,
		})
	end

	table.sort(result, function(left, right)
		return left.displayName < right.displayName
	end)

	return result
end

function InventoryService:HasItem(player, itemId)
	local inventory = self:GetInventory(player)
	return (inventory[itemId] or 0) > 0
end

function InventoryService:AddItem(player, itemId, amount)
	local profile = self.registry:GetService("PlayerDataService"):GetProfile(player)
	if not profile then
		return false
	end

	profile.inventory[itemId] = (profile.inventory[itemId] or 0) + (amount or 1)
	self.registry:GetService("DispatchService"):PushState(player)
	return true
end

function InventoryService:RemoveItem(player, itemId, amount)
	local profile = self.registry:GetService("PlayerDataService"):GetProfile(player)
	if not profile then
		return false
	end

	local currentAmount = profile.inventory[itemId] or 0
	if currentAmount < (amount or 1) then
		return false
	end

	local nextAmount = currentAmount - (amount or 1)
	if nextAmount <= 0 then
		profile.inventory[itemId] = nil
	else
		profile.inventory[itemId] = nextAmount
	end

	self.registry:GetService("DispatchService"):PushState(player)
	return true
end

function InventoryService:PurchaseItem(player, itemId)
	local tool = Tools[itemId]
	if not tool then
		return false, "Unknown item."
	end

	local economyService = self.registry:GetService("EconomyService")
	if not economyService:SpendCash(player, tool.Price) then
		return false, string.format("Not enough cash for %s.", tool.DisplayName)
	end

	self:AddItem(player, itemId, 1)
	return true, string.format("Purchased %s.", tool.DisplayName)
end

return InventoryService