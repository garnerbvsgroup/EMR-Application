local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")

local PersistenceService = {
	storeName = "RedwoodPlainsResponse_PlayerData_v1",
	sessionCache = {},
}

function PersistenceService:Init(registry)
	self.registry = registry
	self.store = DataStoreService:GetDataStore(self.storeName)
end

function PersistenceService:Start()
	return
end

function PersistenceService:LoadProfile(userId)
	if self.sessionCache[userId] then
		return self.sessionCache[userId]
	end

	if RunService:IsStudio() then
		return nil
	end

	local ok, data = pcall(function()
		return self.store:GetAsync(tostring(userId))
	end)

	if ok and type(data) == "table" then
		self.sessionCache[userId] = data
		return data
	end

	return nil
end

function PersistenceService:SaveProfile(userId, data)
	self.sessionCache[userId] = data

	if RunService:IsStudio() then
		return true
	end

	local ok = pcall(function()
		self.store:SetAsync(tostring(userId), data)
	end)

	return ok
end

return PersistenceService