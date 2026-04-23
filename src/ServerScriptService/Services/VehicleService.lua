local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Vehicles = require(ReplicatedStorage.Shared.Config.Vehicles)

local VehicleService = {}

function VehicleService:Init(registry)
	self.registry = registry
end

function VehicleService:Start()
	return
end

function VehicleService:PurchaseVehicle(player, vehicleId)
	local definition = Vehicles[vehicleId]
	if not definition then
		return false, "Unknown vehicle."
	end

	if definition.Type ~= "Civilian" then
		return false, "Service vehicles are not purchased."
	end

	local profile = self.registry:GetService("PlayerDataService"):GetProfile(player)
	if not profile then
		return false, "Missing profile."
	end

	if profile.ownedVehicles[vehicleId] then
		profile.selectedVehicleId = vehicleId
		self.registry:GetService("DispatchService"):PushState(player)
		return true, string.format("Selected %s.", definition.DisplayName)
	end

	if not self.registry:GetService("EconomyService"):SpendCash(player, definition.Price) then
		return false, string.format("Need $%d for %s.", definition.Price, definition.DisplayName)
	end

	profile.ownedVehicles[vehicleId] = true
	profile.selectedVehicleId = vehicleId
	self.registry:GetService("DispatchService"):PushState(player)
	return true, string.format("Purchased %s.", definition.DisplayName)
end

function VehicleService:SpawnVehicle(player)
	local playerData = self.registry:GetService("PlayerDataService")
	local profile = playerData:GetProfile(player)
	if not profile then
		return
	end

	if profile.spawnedVehicle and profile.spawnedVehicle.Parent then
		profile.spawnedVehicle:Destroy()
	end

	local spawnPad = workspace:FindFirstChild("GeneratedWorld")
		and workspace.GeneratedWorld:FindFirstChild("VehicleSpawn")
	if not spawnPad then
		self.registry:GetService("DispatchService"):Notify(player, "Vehicle spawn is unavailable.")
		return
	end

	local vehicleId = profile.selectedVehicleId
	local teamRole = player:GetAttribute("TeamRole")

	if not vehicleId then
		if teamRole == "CityPolice" or teamRole == "StatePatrol" then
			vehicleId = "PoliceInterceptor"
		elseif teamRole == "FireRescue" then
			vehicleId = "Ambulance"
		elseif teamRole == "PublicWorks" then
			vehicleId = "WorksTruck"
		else
			vehicleId = next(profile.ownedVehicles)
		end
	end

	local definition = vehicleId and Vehicles[vehicleId]
	if not definition then
		self.registry:GetService("DispatchService"):Notify(player, "No owned or assigned vehicle is available.")
		return
	end

	if definition.Type == "Service" then
		local allowed = false
		for _, teamName in ipairs(definition.AllowedTeams or {}) do
			if teamName == teamRole then
				allowed = true
				break
			end
		end
		if not allowed then
			self.registry:GetService("DispatchService"):Notify(player, "That service vehicle is not assigned to your team.")
			return
		end
	end

	local model = Instance.new("Model")
	model.Name = string.format("%s_Unit", player.Name)

	local body = Instance.new("Part")
	body.Name = "Body"
	body.Size = Vector3.new(8, 1.5, 12)
	body.Position = spawnPad.Position + Vector3.new(0, 2, 0)
	body.Anchored = true
	body.Color = definition.Color
	body.Parent = model

	local seat = Instance.new("Seat")
	seat.Name = "Seat"
	seat.Size = Vector3.new(2, 1, 2)
	seat.CFrame = body.CFrame + Vector3.new(0, 1.5, 0)
	seat.Anchored = true
	seat.Parent = model

	local lightbar = Instance.new("Part")
	lightbar.Name = "Lightbar"
	lightbar.Size = Vector3.new(4, 0.4, 1)
	lightbar.CFrame = body.CFrame + Vector3.new(0, 1.6, -2)
	lightbar.Anchored = true
	lightbar.Material = Enum.Material.Neon
	lightbar.Color = definition.HasLightbar and Color3.fromRGB(60, 130, 255) or Color3.fromRGB(70, 70, 70)
	lightbar.Transparency = definition.HasLightbar and 0 or 0.5
	lightbar.Parent = model

	local nameTag = Instance.new("BillboardGui")
	nameTag.Size = UDim2.fromOffset(180, 40)
	nameTag.StudsOffset = Vector3.new(0, 3, 0)
	nameTag.AlwaysOnTop = true
	nameTag.Parent = body

	local tagLabel = Instance.new("TextLabel")
	tagLabel.Size = UDim2.fromScale(1, 1)
	tagLabel.BackgroundTransparency = 1
	tagLabel.TextScaled = true
	tagLabel.Font = Enum.Font.GothamBold
	tagLabel.TextColor3 = Color3.new(1, 1, 1)
	tagLabel.Text = definition.DisplayName
	tagLabel.Parent = nameTag

	model.Parent = workspace.GeneratedWorld
	profile.spawnedVehicle = model
	profile.selectedVehicleId = vehicleId

	self.registry:GetService("DispatchService"):Notify(player, string.format("Spawned %s.", definition.DisplayName))
end

return VehicleService