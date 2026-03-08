# Holdfast

**An 8-Bit Browser-Based Idle Settlement Builder**

Holdfast is a deterministic, web-native idle strategy game where players manage an autonomous 8-bit settlement. Players oversee macro-level strategic decisions — surveying procedurally generated terrain, establishing resource extraction nodes, constructing facilities, and orchestrating worker logistics. Crucially, the real-time execution of these operations is delegated to an autonomous simulation loop running within an isolated Web Worker.

This project is pursued as a technical portfolio artefact, purposefully engineered to explore intricate game loop state validation, procedural terrain generation, and robust CQRS-driven backend architectures.

## Technical Architecture

The architecture of Holdfast rigorously enforces a clear boundary of trust. The client interface is entirely untrusted; its primary responsibilities are rendering and optimistic local state calculation. Authoritative state validation resides strictly on the server.

- **Client Presentation & Simulation Layer**: Constructed using React, TypeScript, and Vite, the client employs a custom Canvas 2D renderer for lightweight, performant asset streaming. The core simulation ticking loop operates asynchronously in a dedicated Web Worker, preventing main-thread blockage and ensuring UI fluidity. Local state is managed via Zustand.
- **Persistence & Validation Layer**: The authoritative backend is engineered in an ASP.NET Core (.NET 9) ecosystem, utilising Entity Framework Core 9 and a PostgreSQL database. It operates on a Clean Architecture topology heavily featuring CQRS (Command Query Responsibility Segregation) via MediatR.
- **State Flow**: The client propagates a structured snapshot of the serialised state upon a save trigger. The backend's validation pipeline systematically intercepts this payload and validates strict business invariants (e.g., resource accumulation against elapsed tick intervals, era gates). Invalid state is rejected with delineated violations.

## Core Mechanics

- **Procedural Generation**: 80×80 tile grids generated deterministically via 2D Simplex Noise, populating dynamic biomes and resource distributions that respond organically to settlement expansion.
- **Worker Agent Queues**: Autonomous worker entities execute defined tasks (Harvest, Deposit, Construct) while pathfinding across the mutable tile graph at one tile per tick.
- **Era Progression**: Multi-tiered developmental stages unlocking progressive structures and multipliers, gated strictly by knowledge accretion and demographic milestones.

## Documentation Navigation

Detailed documentation has been stratified into the following directories:

- **[`docs/architecture`](docs/architecture/README.md)**: Elaborations on state boundaries, database schemas, CQRS handlers, and technical stack decisions.
- **[`docs/api`](docs/api/README.md)**: Specifications for backend APIs, serialisation schemas, and snapshot validation rules.
- **[`docs/spec`](docs/spec/README.md)**: Comprehensive game logic, unit thresholds, mechanical progression, and tier charts.

---

_Zawadi MC Nyachiya · 2026_
