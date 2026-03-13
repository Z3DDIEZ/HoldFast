# Architecture Documentation

## 1. Trust Model and Boundary Definitions

The fundamental premise of Holdfast's architecture is that the web client is categorically untrusted.

To ensure optimal performance, the entire game state matrix is computed client-side. Upon a save trigger, the ASP.NET Core backend ingests the complete serialised `GameState` snapshot and subjects it to authoritative invariant checks within a validation pipeline. Examples include resource scaling viability against elapsed ticks, demographic consistency within housing logic, and structural prerequisites against era logic. Validation failures reject the payload with explicit violations.

| Concern                     | Principal Owner          | Trust Posture |
| --------------------------- | ------------------------ | ------------- |
| Game tick macro-execution   | Web Worker (client)      | Untrusted     |
| Render pipeline             | React + Canvas (client)  | Untrusted     |
| Snapshot parsing/validation | ASP.NET Core API         | Authoritative |
| Persistence & Data schema   | In-memory repository     | Authoritative |
| Generative Map Seed         | GameState (dual-tracked) | Server-Echoed |

## 2. Infrastructure Tiers

### Client Frontend

- **Implementation Engine**: TypeScript integrated with React, compiled and hot-module replaced via Vite, serving an SPA layout.
- **Renderer**: Direct Canvas 2D rendering surfaces pixel-perfect assets to screen.
- **State Management**: Zustand mirrors the last server-acknowledged snapshot and applies optimistic deltas from the Web Worker.
- **Asynchronous Offloading**: The game tick runs inside a Web Worker and communicates via `postMessage` (`TickResult`, `WorkerCommand`).

### Server Backend

- **Runtime Ecosystem**: ASP.NET Core on .NET 9.
- **Topological Layout**: Clean Architecture segmentation: `Domain -> Application -> Infrastructure -> Presentation`.
- **State Orchestration**: CQRS via MediatR (`SaveGameCommand`, `LoadGameQuery`).
- **Storage Mechanisms**: In-memory repository today; EF Core + PostgreSQL are deferred.

## 3. Data Ontology

### Client Serialised Schema

```typescript
{
  mapSeed: string;            // Deterministic topological key to recreate map upon rendering.
  tickCount: number;          // Total absolute temporal cycles elapsed.
  era: 1 | 2 | 3;
  resources: ResourcePool;    // { food, wood, stone, knowledge }.
  tiles: TileState[];         // Coordinates and occupancy identifiers.
  workers: WorkerState[];     // Agent positions, assignments, and task states.
  buildings: BuildingState[]; // Building metadata + construction state.
  savedAt: string | null;     // ISO 8601 UTC timestamp (server-stamped on save).
}
```

## 4. Sub-Module Encapsulations

### Client Scaffolding

- `engine/`: Web Worker tick loop, A* pathfinder, procedural noise.
- `state/`: Zustand definitions mapping deltas aligned to server assertions.
- `renderer/`: Canvas sprites, fog-of-war, minimap.
- `ui/`: Tailwind HUD components.

### Backend Contexts

- **Domain Layer**: Snapshot models and `SnapshotValidator` invariants.
- **Application Layer**: CQRS orchestration and repository interfaces.
- **Infrastructure Layer**: In-memory repository with per-user locking.
- **API Layer**: Controller endpoints `POST /api/saves` and `GET /api/saves/{userId}/latest`.
