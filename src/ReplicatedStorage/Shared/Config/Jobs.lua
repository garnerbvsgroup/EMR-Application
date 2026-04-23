return {
	Courier = {
		DisplayName = "Courier Route",
		Description = "Move parcels across Ashford and Bramble Ridge.",
		Reward = 320,
		Steps = {
			"Pick up parcels at the depot.",
			"Deliver to downtown Ashford.",
			"Return the route manifest.",
		},
	},
	Taxi = {
		DisplayName = "Taxi Shift",
		Description = "Move civilians between the station, hospital, and downtown.",
		Reward = 280,
		Steps = {
			"Accept passenger request.",
			"Reach the pickup marker.",
			"Drop passenger at destination.",
		},
	},
	Transit = {
		DisplayName = "Transit Shuttle",
		Description = "Run a short fixed-route public transit loop.",
		Reward = 260,
		Steps = {
			"Start the route at the depot.",
			"Stop at Bramble Ridge.",
			"Finish downtown and log the run.",
		},
	},
}