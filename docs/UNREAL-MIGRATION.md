# Unreal Migration Blueprint

This document defines how Garner Emergency Response moves from the current desktop prototype to an Unreal Engine gameplay runtime.

## Purpose

The existing Electron + Node + 3D client stack remains useful as a reference implementation for gameplay ideas, UI flow, and county design direction. It is not the intended final gameplay runtime.

Unreal Engine becomes the long-term foundation for:

- replicated player movement
- replicated vehicles
- authoritative interaction handling
- higher-end rendering and asset workflows
- more maintainable multiplayer simulation scaling

## System Split

### Unreal Owns

- world simulation
- player controllers and pawns
- vehicles and movement
- collisions and physics
- interaction traces
- replicated team state
- crimes, arrests, jail, and dispatch gameplay state
- in-world UI and gameplay HUD

### External Tools May Own Later

- launcher workflows
- admin controls
- optional dispatch dashboard
- dedicated server management utilities

External tools must never become the authoritative gameplay runtime.

## First Unreal Vertical Slice

Build the smallest complete playable loop first.

Required slice:

- one small county district
- one civilian spawn
- one police spawn
- one drivable police vehicle
- one drivable civilian vehicle
- one robbery interaction
- one dispatch event
- one arrest to jail outcome

The slice is complete only when the same flow works reliably across LAN clients.

## Required Unreal Architecture

### Authority

- server authoritative state only
- clients send input and interaction requests
- server validates movement-sensitive or gameplay-sensitive actions

### Entity Categories

- player characters
- drivable vehicles
- dispatch incidents
- interactive crime targets
- jail and spawn points
- inventory or equipment actors only if needed for the slice

### Replication Priorities

- player movement and state
- active vehicles
- current call or dispatch incident
- arrest and jail state
- robbery state machine

### Movement Rules

- no frame-rate dependent gameplay logic
- use Unreal movement and replication systems before custom overrides
- vehicle authority must be explicit and testable under LAN conditions

## Migration Order

### Step 1

Create the Unreal project and baseline modules.

### Step 2

Implement player spawning, team assignment, and LAN session join flow.

### Step 3

Implement one replicated civilian vehicle and one replicated police vehicle.

### Step 4

Implement one dispatch-backed robbery call.

### Step 5

Implement police response, arrest, and jail resolution.

### Step 6

Only after the above is stable, add MDT-style UI depth, records, and BOLO support.

## What Not To Do

- do not port every existing feature before proving replication stability
- do not rebuild full county content before the first gameplay slice works
- do not front-load high-end graphics before multiplayer correctness is proven
- do not move MDT or admin tools ahead of movement, vehicles, and arrest correctness

## Immediate Next Deliverable

The next deliverable is not a full county port.

It is:

A replication-stable Unreal prototype with:

- LAN join flow
- two team roles
- two replicated vehicles
- one robbery-triggered dispatch event
- one arrest and jail loop

If that slice feels correct, the rest of the plan can scale on top of it.
