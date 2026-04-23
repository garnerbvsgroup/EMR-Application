# Desktop Runbook

This runbook explains how to run Garner Emergency Response as a desktop application.

## Local Machine

Requirements:

- Node.js 20 or newer
- Windows desktop environment for Electron runtime

Steps:

1. Open the project root.
2. Run `npm install`.
3. Run `npm run desktop:start`.
4. Wait for the native window to open.

Internal ports:

- Embedded server default: `3210`
- Browser development mode still uses `3001` and `5173` when needed

## Build A Windows Package

To build an installable package:

1. Run `npm install`.
2. Run `npm run desktop:dist`.
3. Check [apps/desktop/dist](../apps/desktop/dist).

## Browser Mode

If you still need the browser-based local-network version for testing:

1. Run `npm run dev`.
2. Open `http://<host-ip>:5173` from another local computer.

The desktop runtime does not require a separate browser URL.

## Current Limitations

- The client is now a 3D prototype scene, not yet a full authored open-world map.
- Persistence now stores player profiles locally on disk, but broader world persistence and multi-profile management are still incomplete.
- Authentication and account management are not implemented yet.