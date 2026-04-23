# Desktop Architecture

This project is now targeted at desktop deployment, not Roblox. The recommended delivery model is:

- Electron desktop shell on each installed machine.
- Embedded Node.js game server running inside the desktop runtime.
- Socket.IO for real-time state sync over the local network.
- Shared TypeScript package for gameplay contracts and balance config.

## Workspace Layout

- [apps/desktop/main.js](../apps/desktop/main.js): native desktop entry point.
- [apps/server/src/index.ts](../apps/server/src/index.ts): dedicated multiplayer server.
- [apps/client/src/App.tsx](../apps/client/src/App.tsx): 3D gameplay client and overlay UI.
- [packages/shared/src/index.ts](../packages/shared/src/index.ts): shared state models, actions, crime config, jobs, housing, vehicles, and rank ladders.

## Runtime Model

- The server owns player state, calls, crime payouts, wanted status, records, and progression.
- Clients send intent actions only.
- The server broadcasts snapshots and notifications.
- Desktop launch works by starting the built local server on loopback and loading it inside the Electron window.
- Local desktop builds now persist player profiles to disk using a per-user runtime data directory.

## Why This Stack

- It removes Roblox platform lock-in.
- It runs as a native desktop app.
- It avoids requiring players to open a browser and manage URLs manually.
- It preserves the emergency-response systems already researched without depending on Studio or Roblox APIs.

## Next Engineering Steps

- Expand the current 3D renderer into a fuller authored world.
- Split the monolithic server into dedicated game services.
- Expand the current local profile persistence into a broader persistence layer for world state and multi-profile management.
- Add account, profile, or local user-save management.