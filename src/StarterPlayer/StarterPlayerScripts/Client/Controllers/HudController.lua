local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = require(ReplicatedStorage.Shared.Remotes)

local HudController = {}

local function createTextLabel(parent, size, position, text, textSize, alignment)
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = size
	label.Position = position
	label.Font = Enum.Font.GothamSemibold
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextXAlignment = alignment or Enum.TextXAlignment.Left
	label.TextYAlignment = Enum.TextYAlignment.Top
	label.TextWrapped = true
	label.TextSize = textSize
	label.Text = text
	label.Parent = parent
	return label
end

function HudController:Start()
	local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")
	local remoteFolder = ReplicatedStorage:WaitForChild(Remotes.FolderName)

	self.actionEvent = remoteFolder:WaitForChild(Remotes.ActionEvent)
	self.stateEvent = remoteFolder:WaitForChild(Remotes.StateEvent)
	self.notificationEvent = remoteFolder:WaitForChild(Remotes.NotificationEvent)

	self:BuildGui(playerGui)
	self:Connect()
end

function HudController:BuildGui(playerGui)
	local screenGui = Instance.new("ScreenGui")
	screenGui.Name = "RedwoodHUD"
	screenGui.ResetOnSpawn = false
	screenGui.Parent = playerGui
	self.screenGui = screenGui

	local panel = Instance.new("Frame")
	panel.Name = "StatusPanel"
	panel.Size = UDim2.fromOffset(460, 560)
	panel.Position = UDim2.new(0, 16, 0, 16)
	panel.BackgroundColor3 = Color3.fromRGB(19, 26, 34)
	panel.BackgroundTransparency = 0.08
	panel.Parent = screenGui
	self.panel = panel

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 12)
	corner.Parent = panel

	self.title = createTextLabel(panel, UDim2.fromOffset(420, 28), UDim2.fromOffset(18, 14), "Redwood Plains Response", 24)
	self.subtitle = createTextLabel(panel, UDim2.fromOffset(420, 22), UDim2.fromOffset(18, 42), "Operations Dashboard", 14)
	self.status = createTextLabel(panel, UDim2.fromOffset(420, 86), UDim2.fromOffset(18, 72), "Loading state...", 16)
	self.pending = createTextLabel(panel, UDim2.fromOffset(420, 42), UDim2.fromOffset(18, 150), "", 15)
	self.progression = createTextLabel(panel, UDim2.fromOffset(420, 56), UDim2.fromOffset(18, 194), "", 15)

	local scroller = Instance.new("ScrollingFrame")
	scroller.Name = "Content"
	scroller.Size = UDim2.fromOffset(424, 238)
	scroller.Position = UDim2.fromOffset(18, 254)
	scroller.BackgroundTransparency = 1
	scroller.BorderSizePixel = 0
	scroller.ScrollBarThickness = 6
	scroller.CanvasSize = UDim2.fromOffset(0, 500)
	scroller.Parent = panel
	self.scroller = scroller

	self.finance = createTextLabel(scroller, UDim2.fromOffset(400, 74), UDim2.fromOffset(0, 0), "", 15)
	self.inventory = createTextLabel(scroller, UDim2.fromOffset(400, 92), UDim2.fromOffset(0, 80), "Inventory: none", 15)
	self.properties = createTextLabel(scroller, UDim2.fromOffset(400, 86), UDim2.fromOffset(0, 176), "", 15)
	self.records = createTextLabel(scroller, UDim2.fromOffset(400, 98), UDim2.fromOffset(0, 266), "", 15)
	self.calls = createTextLabel(scroller, UDim2.fromOffset(400, 120), UDim2.fromOffset(0, 370), "Calls: none", 15)

	local buttonRow = Instance.new("Frame")
	buttonRow.BackgroundTransparency = 1
	buttonRow.Size = UDim2.fromOffset(428, 72)
	buttonRow.Position = UDim2.fromOffset(16, 500)
	buttonRow.Parent = panel

	local layout = Instance.new("UIGridLayout")
	layout.CellSize = UDim2.fromOffset(100, 30)
	layout.CellPadding = UDim2.fromOffset(8, 8)
	layout.Parent = buttonRow

	self:MakeButton(buttonRow, "Claim Call", function()
		self.actionEvent:FireServer("ClaimNextCall")
	end)
	self:MakeButton(buttonRow, "Complete Call", function()
		self.actionEvent:FireServer("CompleteClaimedCall")
	end)
	self:MakeButton(buttonRow, "Pay Fines", function()
		self.actionEvent:FireServer("PayFines")
	end)
	self:MakeButton(buttonRow, "Spawn Unit", function()
		self.actionEvent:FireServer("SpawnVehicle")
	end)
	self:MakeButton(buttonRow, "Deposit", function()
		self.actionEvent:FireServer("DepositCash", { amount = 250 })
	end)
	self:MakeButton(buttonRow, "Withdraw", function()
		self.actionEvent:FireServer("WithdrawCash", { amount = 250 })
	end)
	self:MakeButton(buttonRow, "Advance Job", function()
		self.actionEvent:FireServer("AdvanceJob")
	end)
	self:MakeButton(buttonRow, "Go Home", function()
		self.actionEvent:FireServer("GoHome")
	end)

	local toast = Instance.new("TextLabel")
	toast.Name = "Toast"
	toast.AnchorPoint = Vector2.new(0.5, 0)
	toast.Position = UDim2.new(0.5, 0, 0, 18)
	toast.Size = UDim2.fromOffset(480, 42)
	toast.BackgroundColor3 = Color3.fromRGB(22, 22, 22)
	toast.BackgroundTransparency = 0.2
	toast.TextColor3 = Color3.new(1, 1, 1)
	toast.Font = Enum.Font.GothamBold
	toast.TextScaled = true
	toast.Visible = false
	toast.Parent = screenGui
	self.toast = toast

	local toastCorner = Instance.new("UICorner")
	toastCorner.CornerRadius = UDim.new(0, 10)
	toastCorner.Parent = toast
end

function HudController:MakeButton(parent, text, callback)
	local button = Instance.new("TextButton")
	button.BackgroundColor3 = Color3.fromRGB(40, 73, 122)
	button.TextColor3 = Color3.new(1, 1, 1)
	button.Font = Enum.Font.GothamBold
	button.TextSize = 14
	button.Text = text
	button.Parent = parent

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = button

	button.MouseButton1Click:Connect(callback)
	return button
end

function HudController:Connect()
	self.stateEvent.OnClientEvent:Connect(function(state)
		self:Render(state)
	end)

	self.notificationEvent.OnClientEvent:Connect(function(message)
		self:ShowToast(message)
	end)
end

function HudController:Render(state)
	local rankLabel = state.serviceRanks and state.serviceRanks[state.team] or ""
	self.status.Text = string.format("Team: %s%s\nCash On Hand: $%d\nWanted: %d\nClaimed Call: %s", state.team, rankLabel ~= "" and string.format(" (%s)", rankLabel) or "", state.cash, state.wanted, state.claimedCall ~= "" and state.claimedCall or "None")

	if state.pendingPayout > 0 then
		self.pending.Text = string.format("Pending Payout: $%d from %s", state.pendingPayout, state.pendingCrime)
	else
		self.pending.Text = "Pending Payout: None"
	end

	local serviceXp = state.serviceXp and state.serviceXp[state.team] or 0
	self.progression.Text = string.format("Bank: $%d | Active Job: %s | BOLO: %s | Service XP: %d", state.bank or 0, state.activeJob ~= "" and state.activeJob or "None", state.bolo and "Yes" or "No", serviceXp)
	self.finance.Text = string.format("Finance:\n- Cash: $%d\n- Bank: $%d\n- Pending Camera Tickets: %d\n- Latest Citation Count: %d", state.cash or 0, state.bank or 0, #(state.cameraOffenses or {}), #(state.citations or {}))

	if #state.inventory == 0 then
		self.inventory.Text = "Inventory:\n- None"
	else
		local inventoryLines = { "Inventory:" }
		for _, item in ipairs(state.inventory) do
			table.insert(inventoryLines, string.format("- %s x%d", item.displayName, item.count))
		end
		self.inventory.Text = table.concat(inventoryLines, "\n")
	end

	local ownedHomes = {}
	for plotId, owned in pairs(state.ownedHouses or {}) do
		if owned then
			table.insert(ownedHomes, plotId)
		end
	end
	table.sort(ownedHomes)

	local ownedVehicles = {}
	for vehicleId, owned in pairs(state.ownedVehicles or {}) do
		if owned then
			table.insert(ownedVehicles, vehicleId)
		end
	end
	table.sort(ownedVehicles)

	self.properties.Text = string.format("Assets:\n- Active Home: %s\n- Owned Homes: %s\n- Selected Vehicle: %s\n- Owned Vehicles: %s", state.activeHouseId or "None", #ownedHomes > 0 and table.concat(ownedHomes, ", ") or "None", state.selectedVehicleId or "None", #ownedVehicles > 0 and table.concat(ownedVehicles, ", ") or "None")

	local latestCitation = state.citations and state.citations[1]
	local latestWarning = state.warnings and state.warnings[1]
	self.records.Text = string.format("Records:\n- Latest Citation: %s\n- Latest Warning: %s\n- Camera Queue: %d\n- BOLO Flag: %s", latestCitation and string.format("%s ($%d)", latestCitation.reason, latestCitation.fine) or "None", latestWarning and latestWarning.reason or "None", #(state.cameraOffenses or {}), state.bolo and "Active" or "Clear")

	if #state.calls == 0 then
		self.calls.Text = "Active Calls:\n- None for your team"
	else
		local callLines = { "Active Calls:" }
		for _, call in ipairs(state.calls) do
			local claimStatus = call.claimedByUserId and "CLAIMED" or "OPEN"
			table.insert(callLines, string.format("- [%s] %s @ %s ($%d)", claimStatus, call.title, call.location, call.reward))
		end
		self.calls.Text = table.concat(callLines, "\n")
	end
end

function HudController:ShowToast(message)
	self.toast.Text = message
	self.toast.Visible = true

	local generation = tick()
	self.toast:SetAttribute("Generation", generation)

	task.delay(3, function()
		if self.toast and self.toast:GetAttribute("Generation") == generation then
			self.toast.Visible = false
		end
	end)
end

return HudController