# Holdfast

**An 8-Bit Browser-Based Idle Settlement Builder**

Holdfast is a deterministic, web-native idle strategy game where players manage an autonomous 8-bit settlement. Players oversee macro-level strategic decisions - surveying procedurally generated terrain, establishing resource extraction nodes, constructing facilities, and orchestrating worker logistics. Crucially, the real-time execution of these operations is delegated to an autonomous simulation loop running within an isolated Web Worker.

This project is pursued as a technical portfolio artefact, purposefully engineered to explore intricate game loop state validation, procedural terrain generation, and robust CQRS-driven backend architectures.

## Technical Architecture

The architecture of Holdfast rigorously enforces a clear boundary of trust. The client interface is entirely untrusted; its primary responsibilities are rendering and optimistic local state calculation. Authoritative state validation resides strictly on the server.

- **Client Presentation & Simulation Layer**: Constructed using React, TypeScript, and Vite, the client employs a custom Canvas 2D renderer for lightweight, performant asset streaming. The core simulation ticking loop operates asynchronously in a dedicated Web Worker, preventing main-thread blockage and ensuring UI fluidity. Local state is managed via Zustand.
- **Persistence & Validation Layer**: The authoritative backend is engineered in an ASP.NET Core (.NET 9) ecosystem using Clean Architecture and CQRS via MediatR. Snapshot validation is implemented today, while persistence currently uses an in-memory repository; EF Core + PostgreSQL remain deferred.
- **State Flow**: The client propagates a structured snapshot of the serialised state upon a save trigger. The backend's validation pipeline intercepts this payload and validates strict business invariants (e.g., resource accumulation against elapsed tick intervals, era gates). Invalid state is rejected with delineated violations.

## Core Mechanics

- **Procedural Generation**: 80x80 tile grids generated deterministically via 2D Simplex Noise, populating dynamic biomes and resource distributions that respond organically to settlement expansion.
- **Worker Agent Queues**: Autonomous worker entities execute defined tasks (Harvest, Deposit, Construct) while pathfinding across the mutable tile graph at one tile per tick.
- **Auto-Play Mode**: A macro-level automation toggle that handles worker assignment and population growth (spawning), allowing the player to focus on high-level expansion and building placement.
- **Construction & Timing**: Buildings complete over construction ticks via a construct worker loop. Simulation speed supports 1x-100x plus pause/resume.
- **Era Progression**: Multi-tiered developmental stages unlocking progressive structures and multipliers, gated strictly by knowledge accretion and demographic milestones.
- **Starvation Guard**: Food upkeep and starvation only activate after an operational food producer exists.

## Local Development

To initialise and run the simulation locally:

### 1. Frontend (React + Vite)
```bash
# Navigate to client if necessary
npm install
npm run dev
```
The UI will be accessible at `http://localhost:5173`.

### 2. Backend (.NET 9)
```bash
# Navigate to HoldFast.Api
dotnet restore
dotnet run
```
The API will be accessible at `http://localhost:5000` (or as configured).

## Documentation Navigation

Detailed documentation has been stratified into the following directories:

- **[`docs/architecture`](docs/architecture/README.md)**: Elaborations on state boundaries, persistence boundaries, CQRS handlers, and technical stack decisions.
- **[`docs/api`](docs/api/README.md)**: Specifications for backend APIs, serialisation schemas, and snapshot validation rules.
- **[`docs/spec`](docs/spec/README.md)**: Comprehensive game logic, unit thresholds, mechanical progression, and tier charts.

---

_Zawadi MC Nyachiya - 2026_
