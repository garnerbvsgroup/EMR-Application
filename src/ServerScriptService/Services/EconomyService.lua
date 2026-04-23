local EconomyService = {}

function EconomyService:Init(registry)
	self.registry = registry
end

function EconomyService:Start()
	return
end

function EconomyService:AdjustBank(player, amount)
	local playerData = self.registry:GetService("PlayerDataService")
	local profile = playerData:GetProfile(player)
	if not profile then
		return false
	end

	profile.bank = math.max(0, (profile.bank or 0) + amount)
	playerData:SyncProfileAttributes(player)
	self.registry:GetService("DispatchService"):PushState(player)
	return true
end

function EconomyService:AddCash(player, amount)
	local playerData = self.registry:GetService("PlayerDataService")
	local profile = playerData:GetProfile(player)
	if not profile then
		return false
	end

	playerData:UpdateCash(player, profile.cash + amount)
	self.registry:GetService("DispatchService"):PushState(player)
	return true
end

function EconomyService:SpendCash(player, amount)
	local playerData = self.registry:GetService("PlayerDataService")
	local profile = playerData:GetProfile(player)
	if not profile or profile.cash < amount then
		return false
	end

	playerData:UpdateCash(player, profile.cash - amount)
	self.registry:GetService("DispatchService"):PushState(player)
	return true
end

function EconomyService:PayOutstandingFines(player)
	local playerData = self.registry:GetService("PlayerDataService")
	local dispatchService = self.registry:GetService("DispatchService")
	local profile = playerData:GetProfile(player)
	if not profile then
		return
	end

	if profile.wanted <= 0 then
		dispatchService:Notify(player, "No outstanding fines.")
		return
	end

	local fine = profile.wanted * 125
	if not self:SpendCash(player, fine) then
		dispatchService:Notify(player, string.format("You need $%d to clear your fines.", fine))
		return
	end

	playerData:UpdateWanted(player, 0)
	playerData:AddOffense(player, string.format("Paid fines for $%d", fine))
	self.registry:GetService("CrimeService"):ClearPendingReward(player, "Fines paid")
	self.registry:GetService("DispatchService"):Notify(player, string.format("Paid $%d in fines and cleared wanted status.", fine))
	self.registry:GetService("DispatchService"):BroadcastState()
end

return EconomyService