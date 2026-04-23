# Garner Emergency Response Master Plan

This is the single planning document for the current desktop game. It replaces the older Roblox-era idea docs and scattered backlog notes.

## Product Direction

- Target platform: Windows desktop game built in Unreal Engine, with optional external desktop tooling only where it adds operational value.
- Target experience: county-scale emergency-response sandbox with the feel, pacing, and role depth players expect from ER:LC-style play.
- Immediate priorities: prevent lag, improve realism, keep the screen clear during play, and keep shipping toward a fuller county simulation.
- Reference model: ER:LC succeeds through believable county role loops, dispatch structure, department identity, and player-driven situations more than through raw feature count alone.
- Scope rule: build toward ER:LC feel through strong vertical slices first instead of chasing full feature parity all at once.
- Engine decision: Unreal Engine is the target gameplay runtime for long-term physics, replication, vehicle handling, tooling, and presentation quality.

## Build Pillars

### 1. Performance First

- Keep the Unreal runtime stable under normal play.
- Provide graphics tiers that let players trade fidelity for responsiveness without leaving the game.
- Remove or replace effects that rely on remote assets or unstable GPU-heavy paths.
- Use engine-native profiling, scalability tiers, and streaming discipline as the world expands.

### 2. Graphics And Realism

- Replace placeholder shells with imported character and vehicle models.
- Push world realism through lighting, material response, wet-surface reflections, signage, road markings, and denser landmarking.
- Expand the county into recognizable districts with department facilities, civilian hubs, robbery targets, and rural edges.
- Add more authentic emergency-scene dressing: hydrants, cones, service yards, staging lots, and response-specific landmarks.

### 3. Usability

- Keep core play readable while the mouse is locked.
- Default to a gameplay-first HUD with overlays opened only when needed.
- Expose quick graphics controls, fast role actions, and compact status chips without obscuring the world.
- Keep desktop controls obvious: lock view, hide HUD, quick overlay switching, and action dock toggles.

### 4. ER:LC-Style Gameplay Parity

- Team flow: civilian, police, sheriff/patrol, fire/EMS, DOT/public works.
- Civilian systems: jobs, vehicles, banking, housing, transit, local businesses.
- Crime systems: wanted escalation, robbery routing, tool-gated crimes, vehicle theft, fencing, organized heists.
- Enforcement systems: citations, warnings, BOLOs, records, arrests, jail, vehicle enforcement, unit boards.
- Service systems: dispatch queues, fire/EMS calls, DOT roadside support, scene cleanup, major incidents.

### 5. Simulation Architecture

- Keep the server as the only source of truth for money, crimes, jobs, records, vehicles, and dispatch state.
- Clients send inputs and UI intent, never authoritative outcomes.
- Prefer simulation-friendly extensions that deepen existing loops over isolated one-off systems.
- Preserve a predictable update model so overlapping roles do not desync as police, civilian, service, and crime features expand.
- Prioritize small vertical slices that connect map, UI, dispatch, and progression before widening countywide scope.
- Use Unreal networking, actor ownership, and movement replication as the baseline instead of continuing to grow a custom engine stack for long-term multiplayer simulation.

## Current State

- The current workspace is still a desktop prototype built with an Electron shell, local server, and 3D client.
- The scene now has a denser county layout with districts, stations, crime sites, civic hubs, and special locations derived from the latest ER:LC reference pass.
- Safe-graphics fallback exists and prevents hard lockups when the renderer stalls or loses context.
- HUD clutter is reduced compared to earlier builds, with overlays and quick actions split into clearer panels.
- The current stack is useful as a design and systems prototype, but it is no longer the intended long-term gameplay runtime.
- The next major transition is moving the simulation backbone into Unreal instead of adding more engine-grade complexity to the custom desktop runtime.

## Active Execution Plan

### Phase 0. Unreal Migration Backbone

- Create the Unreal project and establish the baseline module structure.
- Define authoritative game state ownership, replication boundaries, and actor categories.
- Prove stable LAN play with player movement, one replicated vehicle, and one replicated interaction loop.
- Keep the current desktop prototype available only as a reference and systems sandbox during migration.

### Phase 1. Stability And Visual Control

- Maintain stable, balanced, and cinematic graphics presets.
- Keep desktop default on the highest preset that remains reliable during normal play.
- Continue removing hidden instability sources before layering more effects.
- Add a lightweight performance readout and scene-health hints where useful.

### Phase 2. County Expansion

- Continue authoring the map toward a larger county instead of a single compact scene.
- Improve road hierarchy, service access, parking, business clusters, and district identity.
- Align gameplay spawn and hotspot logic with the expanded county map.

### Phase 3. Department And Crime Loops

- Rebuild team selection flow around county roles.
- Add criminal status systems, wanted progression, arrest handling, and jail flow.
- Expand robbery interaction chains and organized crime endpoints.
- Deepen MDT workflows for dispatch, records, service, and unit management.
- Add call targeting, clearer unit state, and better records triage before widening into larger department feature sets.
- Keep MDT depth downstream of replication-stable police, vehicle, arrest, and dispatch flows inside Unreal.

### Phase 4. Civilian And Service Depth

- Expand civilian jobs into multi-step routes and business-specific work.
- Add Fire/EMS treatment and transport loops.
- Add DOT roadside, traffic control, and cleanup mechanics.
- Build ranked unlock progression that rewards long-term play.
- Ship one service vertical slice at a time so Fire/EMS and DOT loops can be finished cleanly instead of partially exposed.

### Phase 5. Asset And Presentation Upgrade

- Replace placeholder models.
- Add higher-quality materials, decals, and environment set dressing.
- Continue refining movement feel, action animations, and vehicle handling.
- Add sound design and scene feedback once the core loops are stable.

## Unreal Migration Rules

- Do not keep expanding the current custom runtime in ways that increase engine-grade maintenance burden.
- Build the first Unreal vertical slice around one small county area, one police unit, one civilian vehicle, one robbery chain, and one dispatch response loop.
- Treat Electron as optional future tooling only, such as launcher, admin console, or dispatch panel, not as the gameplay runtime.
- Move systems in migration order: simulation backbone, movement and vehicles, core dispatch and crime loop, service-role expansion, then presentation polish.

## Canonical Docs

- Keep this file as the only master backlog and design direction doc.
- Keep `docs/self-hosted-architecture.md` for runtime structure.
- Keep `docs/lan-runbook.md` for local operating instructions.
- Remove outdated idea docs once their useful content has been merged here.

## Definition Of Progress

The game is moving in the right direction when each build does all of the following:

- launches cleanly,
- keeps the player in control without HUD obstruction,
- looks more believable than the prior build,
- adds at least one deeper roleplay loop,
- and stays responsive on desktop hardware.