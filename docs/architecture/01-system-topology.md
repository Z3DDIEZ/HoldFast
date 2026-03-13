# System Topology

## Architectural Blueprint

Holdfast enforces a rigid separation between client-side simulation physics and authoritative server-side validation.

### 1. Presentation and Simulation Stratum (Client)

The frontend operates as a thick client leveraging local compute resources.

- **Foundation**: React + TypeScript SPA built with Vite.
- **Render Pipeline**: Custom Canvas 2D renderer for lightweight pixel-art output.
- **Logical Concurrency**: Deterministic simulation executes in a Web Worker to keep the UI thread responsive.
- **State Aggregation**: Zustand mirrors the last server-acknowledged snapshot while applying optimistic deltas.

### 2. Authoritative Persistence Stratum (Server)

The backend functions as a validation gateway and persistence terminus.

- **Foundation**: ASP.NET Core (.NET 9) with controller endpoints.
- **Clean Architecture**:
  - **Domain**: Snapshot models and `SnapshotValidator` rules.
  - **Application**: CQRS handlers (`SaveGameCommandHandler`, `LoadGameQueryHandler`).
  - **Infrastructure**: In-memory repository with per-user locking (EF Core + PostgreSQL deferred).
  - **Presentation**: `POST /api/saves` and `GET /api/saves/{userId}/latest`.

### 3. Systematic Interaction Dynamics

The Web Worker runs the simulation loop and periodically serialises `GameState`. The API validates the snapshot before accepting it; invalid states are rejected with explicit violations (`HTTP 422`).
