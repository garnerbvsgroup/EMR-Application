local ReplicatedStorage = game:GetService("ReplicatedStorage")

local TeamsConfig = require(ReplicatedStorage.Shared.Config.Teams)
local ToolsConfig = require(ReplicatedStorage.Shared.Config.Tools)
local JobsConfig = require(ReplicatedStorage.Shared.Config.Jobs)
local HousingConfig = require(ReplicatedStorage.Shared.Config.Housing)
local VehiclesConfig = require(ReplicatedStorage.Shared.Config.Vehicles)

local WorldBuilder = {}

local function makeBasePart(name, size, cframe, color, parent)
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.CFrame = cframe
	part.Anchored = true
	part.Color = color
	part.Parent = parent
	return part
end

local function addLabel(part, text)
	local billboard = Instance.new("BillboardGui")
	billboard.Name = "Label"
	billboard.Size = UDim2.fromOffset(200, 50)
	billboard.StudsOffset = Vector3.new(0, 4, 0)
	billboard.AlwaysOnTop = true
	billboard.Parent = part

	local textLabel = Instance.new("TextLabel")
	textLabel.Size = UDim2.fromScale(1, 1)
	textLabel.BackgroundTransparency = 1
	textLabel.TextScaled = true
	textLabel.TextColor3 = Color3.new(1, 1, 1)
	textLabel.TextStrokeTransparency = 0.4
	textLabel.Font = Enum.Font.GothamBold
	textLabel.Text = text
	textLabel.Parent = billboard
end

local function addPrompt(part, promptText, callback)
	local prompt = Instance.new("ProximityPrompt")
	prompt.ObjectText = part.Name
	prompt.ActionText = promptText
	prompt.HoldDuration = 0.35
	prompt.RequiresLineOfSight = false
	prompt.MaxActivationDistance = 12
	prompt.Parent = part

	prompt.Triggered:Connect(callback)
end

function WorldBuilder:Build(registry)
	local existing = workspace:FindFirstChild("GeneratedWorld")
	if existing then
		existing:Destroy()
	end

	local world = Instance.new("Folder")
	world.Name = "GeneratedWorld"
	world.Parent = workspace

	local ground = makeBasePart("Ground", Vector3.new(260, 1, 260), CFrame.new(0, 0, 0), Color3.fromRGB(78, 116, 75), world)
	ground.Material = Enum.Material.Grass

	local teamHub = Instance.new("Folder")
	teamHub.Name = "TeamHub"
	teamHub.Parent = world

	local xOffset = -30
	for teamName, teamInfo in pairs(TeamsConfig) do
		local kiosk = makeBasePart(teamName, Vector3.new(12, 8, 12), CFrame.new(xOffset, 4, 0), teamInfo.Color, teamHub)
		addLabel(kiosk, teamInfo.DisplayName)
		addPrompt(kiosk, "Join Team", function(player)
			local ok, message = registry:GetService("TeamService"):SetTeam(player, teamName)
			registry:GetService("DispatchService"):Notify(player, message)
			if ok and player.Character then
				player.Character:PivotTo(kiosk.CFrame + Vector3.new(0, 5, 10))
			end
		end)
		xOffset += 18
	end

	local storeFolder = Instance.new("Folder")
	storeFolder.Name = "ToolStore"
	storeFolder.Parent = world

	local storeBase = makeBasePart("Tool Store", Vector3.new(18, 12, 18), CFrame.new(48, 6, -8), Color3.fromRGB(46, 46, 46), storeFolder)
	addLabel(storeBase, "Tool Store")

	local toolX = 38
	for toolId, toolInfo in pairs(ToolsConfig) do
		local stand = makeBasePart(toolInfo.DisplayName, Vector3.new(8, 6, 8), CFrame.new(toolX, 3, -28), Color3.fromRGB(89, 89, 89), storeFolder)
		addLabel(stand, string.format("%s\n$%d", toolInfo.DisplayName, toolInfo.Price))
		addPrompt(stand, "Purchase", function(player)
			local ok, message = registry:GetService("InventoryService"):PurchaseItem(player, toolId)
			registry:GetService("DispatchService"):Notify(player, message)
			if ok then
				registry:GetService("DispatchService"):PushState(player)
			end
		end)
		toolX += 12
	end

	local crimeFolder = Instance.new("Folder")
	crimeFolder.Name = "CrimeZone"
	crimeFolder.Parent = world

	local atm = makeBasePart("ATM", Vector3.new(6, 8, 4), CFrame.new(-44, 4, -18), Color3.fromRGB(29, 133, 155), crimeFolder)
	addLabel(atm, "ATM")
	addPrompt(atm, "Breach ATM", function(player)
		local ok, message = registry:GetService("CrimeService"):StartCrime(player, "atm_breach")
		registry:GetService("DispatchService"):Notify(player, message)
	end)

	local home = makeBasePart("Vacant Home", Vector3.new(20, 14, 20), CFrame.new(-20, 7, -34), Color3.fromRGB(164, 120, 93), crimeFolder)
	addLabel(home, "Vacant Home")
	addPrompt(home, "Burglary", function(player)
		local ok, message = registry:GetService("CrimeService"):StartCrime(player, "house_burglary")
		registry:GetService("DispatchService"):Notify(player, message)
	end)

	local retail = makeBasePart("Corner Store", Vector3.new(18, 12, 18), CFrame.new(-68, 6, -38), Color3.fromRGB(150, 73, 36), crimeFolder)
	addLabel(retail, "Corner Store")
	addPrompt(retail, "Burglarize", function(player)
		local ok, message = registry:GetService("CrimeService"):StartCrime(player, "retail_burglary")
		registry:GetService("DispatchService"):Notify(player, message)
	end)

	local office = makeBasePart("Office Block", Vector3.new(18, 14, 18), CFrame.new(-90, 7, -10), Color3.fromRGB(84, 84, 94), crimeFolder)
	addLabel(office, "Office Block")
	addPrompt(office, "Safe Robbery", function(player)
		local ok, message = registry:GetService("CrimeService"):StartCrime(player, "office_safe")
		registry:GetService("DispatchService"):Notify(player, message)
	end)

	local chopLot = makeBasePart("Chop Lot", Vector3.new(18, 8, 18), CFrame.new(-96, 4, -40), Color3.fromRGB(62, 62, 62), crimeFolder)
	addLabel(chopLot, "Vehicle Theft")
	addPrompt(chopLot, "Steal Vehicle", function(player)
		local ok, message = registry:GetService("CrimeService"):StartCrime(player, "vehicle_theft")
		registry:GetService("DispatchService"):Notify(player, message)
	end)

	local cameraLane = makeBasePart("Traffic Camera", Vector3.new(10, 10, 10), CFrame.new(-24, 5, 42), Color3.fromRGB(121, 64, 132), world)
	addLabel(cameraLane, "Traffic Camera")
	addPrompt(cameraLane, "Log Speeding", function(player)
		registry:GetService("RecordsService"):AddCameraOffense(player, "Speeding", 75)
	end)

	local redLightCam = makeBasePart("Red Light Camera", Vector3.new(10, 10, 10), CFrame.new(-6, 5, 42), Color3.fromRGB(163, 54, 54), world)
	addLabel(redLightCam, "Red Light Camera")
	addPrompt(redLightCam, "Log Red-Light", function(player)
		registry:GetService("RecordsService"):AddCameraOffense(player, "Red light violation", 110)
	end)

	local serviceHub = Instance.new("Folder")
	serviceHub.Name = "ServiceHub"
	serviceHub.Parent = world

	local policeBoard = makeBasePart("Police Call Board", Vector3.new(12, 8, 12), CFrame.new(0, 4, 48), Color3.fromRGB(48, 90, 168), serviceHub)
	addLabel(policeBoard, "Police Call Board")
	addPrompt(policeBoard, "Claim Next Call", function(player)
		registry:GetService("DispatchService"):ClaimNextCall(player)
	end)

	local fireBoard = makeBasePart("Fire Board", Vector3.new(12, 8, 12), CFrame.new(18, 4, 48), Color3.fromRGB(198, 56, 56), serviceHub)
	addLabel(fireBoard, "Fire Board")
	addPrompt(fireBoard, "Claim Next Call", function(player)
		registry:GetService("DispatchService"):ClaimNextCall(player)
	end)

	local worksBoard = makeBasePart("Public Works Board", Vector3.new(12, 8, 12), CFrame.new(36, 4, 48), Color3.fromRGB(217, 132, 35), serviceHub)
	addLabel(worksBoard, "Public Works Board")
	addPrompt(worksBoard, "Claim Next Call", function(player)
		registry:GetService("DispatchService"):ClaimNextCall(player)
	end)

	local completeBoard = makeBasePart("Complete Call", Vector3.new(14, 6, 14), CFrame.new(18, 3, 66), Color3.fromRGB(42, 124, 73), serviceHub)
	addLabel(completeBoard, "Complete Claimed Call")
	addPrompt(completeBoard, "Complete", function(player)
		registry:GetService("DispatchService"):CompleteClaimedCall(player)
	end)

	local boloBoard = makeBasePart("BOLO Board", Vector3.new(14, 8, 14), CFrame.new(-18, 4, 48), Color3.fromRGB(58, 71, 116), serviceHub)
	addLabel(boloBoard, "Toggle BOLO On Yourself")
	addPrompt(boloBoard, "Toggle BOLO", function(player)
		local ok, message = registry:GetService("RecordsService"):ToggleBolo(player.Name, player)
		registry:GetService("DispatchService"):Notify(player, message)
	end)

	local court = makeBasePart("Courthouse", Vector3.new(18, 12, 18), CFrame.new(66, 6, 20), Color3.fromRGB(90, 90, 98), world)
	addLabel(court, "Pay Fines")
	addPrompt(court, "Pay Fines", function(player)
		registry:GetService("EconomyService"):PayOutstandingFines(player)
	end)

	local bank = makeBasePart("Ashford Bank", Vector3.new(24, 14, 20), CFrame.new(96, 7, 26), Color3.fromRGB(58, 92, 78), world)
	addLabel(bank, "Ashford Bank")
	addPrompt(bank, "Deposit $250", function(player)
		local ok, message = registry:GetService("CivilianLifeService"):DepositCash(player, 250)
		registry:GetService("DispatchService"):Notify(player, message)
	end)

	local withdrawTerminal = makeBasePart("Withdrawal Terminal", Vector3.new(10, 8, 10), CFrame.new(118, 4, 26), Color3.fromRGB(74, 108, 86), world)
	addLabel(withdrawTerminal, "Withdraw $250")
	addPrompt(withdrawTerminal, "Withdraw", function(player)
		local ok, message = registry:GetService("CivilianLifeService"):WithdrawCash(player, 250)
		registry:GetService("DispatchService"):Notify(player, message)
	end)

	local homeHub = Instance.new("Folder")
	homeHub.Name = "HousingHub"
	homeHub.Parent = world

	local houseX = 104
	for plotId, houseInfo in pairs(HousingConfig) do
		local housePad = makeBasePart(houseInfo.DisplayName, Vector3.new(14, 8, 14), CFrame.new(houseX, 4, -30), Color3.fromRGB(129, 103, 79), homeHub)
		addLabel(housePad, string.format("%s\n$%d", houseInfo.DisplayName, houseInfo.Price))
		addPrompt(housePad, "Buy / Select", function(player)
			local ok, message = registry:GetService("CivilianLifeService"):PurchaseHouse(player, plotId)
			registry:GetService("DispatchService"):Notify(player, message)
		end)
		houseX += 20
	end

	local goHomePad = makeBasePart("Go Home", Vector3.new(14, 6, 14), CFrame.new(124, 3, -52), Color3.fromRGB(82, 124, 93), world)
	addLabel(goHomePad, "Teleport Home")
	addPrompt(goHomePad, "Go Home", function(player)
		local ok, message = registry:GetService("CivilianLifeService"):GoHome(player)
		registry:GetService("DispatchService"):Notify(player, message)
	end)

	local jobHub = Instance.new("Folder")
	jobHub.Name = "JobHub"
	jobHub.Parent = world

	local jobX = 40
	for jobId, jobInfo in pairs(JobsConfig) do
		local jobPad = makeBasePart(jobInfo.DisplayName, Vector3.new(12, 8, 12), CFrame.new(jobX, 4, 86), Color3.fromRGB(62, 100, 121), jobHub)
		addLabel(jobPad, jobInfo.DisplayName)
		addPrompt(jobPad, "Start Job", function(player)
			local ok, message = registry:GetService("CivilianLifeService"):StartJob(player, jobId)
			registry:GetService("DispatchService"):Notify(player, message)
		end)
		jobX += 16
	end

	local jobAdvance = makeBasePart("Advance Job", Vector3.new(14, 6, 14), CFrame.new(88, 3, 86), Color3.fromRGB(56, 130, 90), world)
	addLabel(jobAdvance, "Advance Active Job")
	addPrompt(jobAdvance, "Advance", function(player)
		local ok, message = registry:GetService("CivilianLifeService"):AdvanceJob(player)
		registry:GetService("DispatchService"):Notify(player, message)
	end)

	local dealerHub = Instance.new("Folder")
	dealerHub.Name = "DealerHub"
	dealerHub.Parent = world

	local dealerX = 76
	for vehicleId, definition in pairs(VehiclesConfig) do
		if definition.Type == "Civilian" then
			local pad = makeBasePart(definition.DisplayName, Vector3.new(12, 6, 12), CFrame.new(dealerX, 3, 62), definition.Color, dealerHub)
			addLabel(pad, string.format("%s\n$%d", definition.DisplayName, definition.Price))
			addPrompt(pad, "Buy / Select", function(player)
				local ok, message = registry:GetService("VehicleService"):PurchaseVehicle(player, vehicleId)
				registry:GetService("DispatchService"):Notify(player, message)
			end)
			dealerX += 16
		end
	end

	local vehiclePad = makeBasePart("Vehicle Spawn", Vector3.new(16, 1, 16), CFrame.new(66, 0.5, 46), Color3.fromRGB(38, 38, 38), world)
	vehiclePad.Name = "VehicleSpawn"
	addLabel(vehiclePad, "Spawn Response Unit")
	addPrompt(vehiclePad, "Spawn Unit", function(player)
		registry:GetService("VehicleService"):SpawnVehicle(player)
	end)

	local jailSpawn = makeBasePart("JailSpawn", Vector3.new(16, 1, 16), CFrame.new(-66, 0.5, 42), Color3.fromRGB(57, 57, 67), world)
	addLabel(jailSpawn, "Jail")

	local hospital = makeBasePart("Hospital", Vector3.new(18, 10, 18), CFrame.new(84, 5, -40), Color3.fromRGB(143, 183, 195), world)
	addLabel(hospital, "Hospital / Safe Respawn")

	local travelNorth = makeBasePart("Travel: Downtown", Vector3.new(12, 8, 12), CFrame.new(-86, 4, -6), Color3.fromRGB(68, 68, 120), world)
	addLabel(travelNorth, "Travel to Downtown")
	addPrompt(travelNorth, "Travel", function(player)
		if player.Character then
			player.Character:PivotTo(CFrame.new(0, 4, -72))
		end
	end)

	local travelSouth = makeBasePart("Travel: Industrial", Vector3.new(12, 8, 12), CFrame.new(-86, 4, 16), Color3.fromRGB(120, 86, 42), world)
	addLabel(travelSouth, "Travel to Industrial")
	addPrompt(travelSouth, "Travel", function(player)
		if player.Character then
			player.Character:PivotTo(CFrame.new(84, 4, 84))
		end
	end)
end

return WorldBuilder