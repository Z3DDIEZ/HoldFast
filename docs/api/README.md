# API Documentation & Snapshot Validation Contract

## 1. Interaction Paradigm

The Holdfast API relies on asynchronous snapshot evaluation. There is no sustained real-time duplex socket connection (e.g., WebSockets or SignalR). The interaction is encapsulated within RESTful boundaries, accepting deterministic state vectors parsed as comprehensive snapshots.

## 2. API Contract

### System Save Initiation

`POST /api/saves`

**Header:** `X-User-Id` (string, optional; defaults to `local` if omitted)

**Payload Boundary Request:** Serialised `GameState` JSON mapped directly to the local memory parameters, including multi-civilisation state (`playerCivId`, `activeCivs`, `civStates`).

**Evaluation Mechanism:** The backend routes the payload across an isolated, synchronous `SnapshotValidator` pipeline testing strict business logic invariants.

**Acknowledges:**

- `HTTP 201 Created` returning the successful transaction GUID and save timestamp.
- `HTTP 422 Unprocessable Entity` returning a structured violation object.

```json
// Example 201 Created response
{
  "saveId": "b8c4f0a6-8f48-4a57-9f5d-1f7e2f01a2dd",
  "savedAt": "2026-03-13T09:20:00Z"
}
```

```json
// Example 422 Unprocessable Entity Response Formatter
{
  "valid": false,
  "violations": [
    {
      "rule": "ResourceCap",
      "detail": "food 4200 exceeds computed max 1800 for tick 900"
    },
    {
      "rule": "EraGate",
      "detail": "3 Farms present but Era 2 not reached at tick 900"
    }
  ]
}
```

### State Restoration Sequence

`GET /api/saves/{userId}/latest`

**Function:** Returns the most recent valid `GameState` snapshot for the requested user identifier.

**Client Action:** Triggers a pipeline re-seeding the Web Worker from the exact persisted `tickCount` and the correlated determinable `mapSeed`, restoring all civ state.

## 3. The Validation Invariant Matrix

The `SnapshotValidator` class maps discrete, mathematically structured rules enforcing systemic sanctity. Invariants now apply per-civilisation where applicable.

| Invocation Context | Analytical Pipeline Check                                               | Rejection Typology                                                    |
| ------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `CivRoster`        | `playerCivId`, `activeCivs`, `civStates` must align and be stable        | Civ roster drift or malformed civ state.                              |
| `ResourceCap`      | Per civ: `resources[x] <= max_possible(tickCount, buildings, workers)`   | Absolute totals eclipse projected maximal bounds.                     |
| `EraGate`          | Per civ: `building.requiredEra <= civStates[civ].era`                    | Higher-tier topology submitted before required era thresholds.        |
| `WorkerCap`        | Per civ: `workers.length <= housing_capacity(buildings)`                 | Worker demographic index unsupported by local housing capacity.       |
| `TownHall`         | Exactly one Town Hall per civ + townHallTileId alignment                 | Missing or duplicated Town Hall entries.                              |
| `TileGrid`         | Tile ids/count must match the deterministic 80x80 grid                   | Malformed or inconsistent tile topology.                              |
| `AssignmentConsistency` | Worker/building assignments must be bidirectionally consistent      | Assigned workers/buildings do not line up.                            |
| `TickSanity`       | `tickCount > lastSave.tickCount`                                         | Chronological manipulation detected; absolute vector regressed.       |
| `MapSeedConsistency` | `mapSeed == previous.mapSeed`                                         | Seed string injected mid-session causing deterministic topology drift.|

## 4. Persistence Status

Persistence currently uses an in-memory repository to enforce validation and chronological ordering. EF Core + PostgreSQL remain deferred for a later milestone.

## 5. Testing Contract Requirements

**Backend Protocol**: Explicit xUnit test suites target `SnapshotValidator` and the CQRS handlers (`SaveGameCommandHandler`, `LoadGameQueryHandler`).
