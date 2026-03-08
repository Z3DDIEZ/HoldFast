# Architecture Documentation

## 1. Trust Model and Boundary Definitions

The fundamental premise of Holdfast's architecture is that the web client is categorically **untrusted**.

To ensure optimal performance and latency-free interactive heuristics, the entire game state matrix is computed client-side. However, this state is fundamentally treated as an optimistic projection.
Upon invoking a persistence operation (a Save trigger), the ASP.NET Core backend ingests the complete serialised `GameState` snapshot and subjects it to authoritative invariant checks within a rigorous validation pipeline. Examples of invariants include resource scaling viability against cumulative tick boundaries, demographic consistency within housing logic, and structural prerequisites against era logic. Rejection on validation mandates systemic refusal of the payload; corrupted states are isolated and logged.

| Concern                     | Principal Owner          | Trust Posture |
| --------------------------- | ------------------------ | ------------- |
| Game tick macro-execution   | Web Worker (client)      | Untrusted     |
| Render pipeline             | React + Canvas (client)  | Untrusted     |
| Snapshot parsing/validation | ASP.NET Core API         | Authoritative |
| Persistence & Data schema   | PostgreSQL via EF Core   | Authoritative |
| Generative Map Seed         | GameState (dual-tracked) | Server-Echoed |

## 2. Infrastructure Tiers

### Client Frontend

- **Implementation Engine**: TypeScript integrated with React, compiled and hot-module replaced via Vite, serving an SPA layout.
- **Renderer**: Eschewing redundant engine dependencies, direct lightweight **Canvas 2D** rendering surfaces pixel-perfect assets to screen.
- **State Management**: Zustand operates as the omnipotent internal bus, bridging active deltas pending resolution against the last server-acknowledged snapshot.
- **Asynchronous Offloading**: The entire logic of the simulated game tick is quarantined in a dedicated Web Worker structure communicating discretely back to identical payload geometries on the main thread via standard `postMessage` (`TickResult`, `StateSnapshot`, `WorkerCommand`).

### Server Backend

- **Runtime Ecosystem**: ASP.NET Core strictly operating on .NET 9.
- **Topological Layout**: Built utilizing enterprise **Clean Architecture** patterns segmenting into isolated spheres: `Domain → Application → Infrastructure → Presentation`.
- **State Orchestration**: The Application tier employs **CQRS via MediatR**, segregating `SaveGameCommand`, `LoadGameQuery`, and generic pipeline behaviours distinctively.
- **Storage Mechanisms**: Entity Framework Core 9 maps heavily-relational Postgres parameters bridging serialised snapshot schemas safely inside highly-performant structural constraints within Azure structural setups.

## 3. Data Ontology

### Client Serialised Schema

```typescript
{
  mapSeed: string;            // Deterministic topological key to recreate map upon rendering.
  tickCount: number;          // Total absolute temporal cycles elapsed.
  era: 1 | 2 | 3;
  resources: ResourcePool;    // Mapped entity interface of { food, wood, stone, knowledge }.
  tiles: TileState[];         // Array containing explicit coordinates and occupancy identifiers.
  workers: WorkerState[];     // Geometric and vector instructions denoting assignment properties.
  buildings: BuildingState[]; // Array mapping identifiers to corresponding output throughput matrices.
  savedAt: string;            // ISO 8601 UTC encoding identifier.
}
```

### Relational Contexts

```sql
Table: game_saves
Primary Key Constraints: id (UUID), user_id (UUID), tick_count (INT), era (INT), saved_at (TIMESTAMPTZ)
Serialisation payload stored securely as a structured JSONB representation matching the snapshot layout.

Table: users
Core mapping of identity keys tracking JWT mappings ensuring secure transactional multi-level continuity.
```

## 4. Sub-Module Encapsulations

### Client Scaffolding

- `engine/`: Handles the complex temporal components — Web Worker instantiation, A\* Pathfinder traversing, procedural noise instantiation.
- `state/`: Zustand definitions mapping local delta representations aligned structurally to server assertions.
- `renderer/`: The abstract framework manipulating Canvas 2D sprites, overlay grids, fog elements, and the responsive auxiliary minimap UI.
- `ui/`: Form controls constructed via Tailwind CSS manipulating standard React interaction paradigms encapsulating the user interface dashboard.

### Backend Contexts

- **Domain Layer**: The purest logic. Defines rules evaluating maximum scalar possibilities, logic ensuring chronological progression mapping against `SettlementSnapshot` definitions devoid of external references outside standard C# fundamentals.
- **Application Layer**: Contains deterministic CQRS implementations orchestrating the verification mechanisms alongside interface references.
- **Infrastructure Layer**: Resolves specific dependencies including standard EF implementations mapping relational instances to physical disk/cloud indices.
- **API Layer**: Exposes precise routing contexts allowing robust, RESTful controller-driven JSON interactions spanning endpoints processing structural payloads with appropriate contextual auth headers handling token decoding.
