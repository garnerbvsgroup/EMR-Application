# Garner Emergency Response

Garner Emergency Response is now targeted at desktop deployment, not Roblox publication. The active codebase is a desktop-oriented stack with an Electron shell, an embedded Node.js game server, a 3D client, and a shared TypeScript package for gameplay contracts and balance configuration.

## Primary Runtime

- Desktop shell: [apps/desktop/main.js](apps/desktop/main.js)
- Server: [apps/server/src/index.ts](apps/server/src/index.ts)
- Client: [apps/client/src/App.tsx](apps/client/src/App.tsx)
- Shared contracts: [packages/shared/src/index.ts](packages/shared/src/index.ts)

## Current Desktop Build

- Electron desktop shell that opens the game in a native window
- Embedded local Node server started by the desktop shell on loopback
- Browser client now renders a simple 3D city scene with live player movement synced over Socket.IO
- Shared state model for players, calls, crimes, jobs, housing, vehicles, records, and progression
- Team switching for Civilian, City Police, State Patrol, Fire & Rescue, and Public Works
- Banking, citations, warnings, BOLO flags, jobs, house buying, vehicle buying, and five crime loops
- Real-time snapshot broadcast with Socket.IO

## Run As Desktop App

1. Install Node.js 20+.
2. Run `npm install` in the workspace root.
3. Run `npm run desktop:start`.
4. The desktop window opens automatically.

To build a distributable Windows package:

1. Run `npm install`.
2. Run `npm run desktop:dist`.
3. Check the packaged output under [apps/desktop/dist](apps/desktop/dist).

## Important Docs

- [docs/MASTER-PLAN.md](docs/MASTER-PLAN.md): single source of truth for the build roadmap, priorities, and parity goals.
- [docs/self-hosted-architecture.md](docs/self-hosted-architecture.md): target deployment architecture.
- [docs/lan-runbook.md](docs/lan-runbook.md): local run and packaging workflow.

## Legacy Roblox Code

The Roblox-oriented code under [src](src) is no longer the deployment target. It remains in the workspace as reference material for gameplay system intent and migration context.

## Notes

- This is a desktop foundation, not yet a fully finished large-scale emergency-response game.
- The current client is a playable 3D prototype with overlay controls, not yet a full open-world production map.
- The remaining high-value work is tracked in [docs/MASTER-PLAN.md](docs/MASTER-PLAN.md).