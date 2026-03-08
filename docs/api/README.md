# API Documentation & Snapshot Validation Contract

## 1. Interaction Paradigm

The Holdfast API strictly relies on an asynchronous snapshot evaluation mechanism. There is no sustained real-time duplex socket connection (e.g., WebSockets or SignalR). The interaction is encapsulated structurally within definitive RESTful boundaries, accepting deterministic state vectors parsed as comprehensive snapshots.

## 2. API Contract

### System Save Initiation

`POST /api/saves`
**Payload Boundary Request:** Serialised `GameState` JSON mapped directly to the local memory parameters.
**Evaluation Mechanism:** The backend routes the payload across an isolated, synchronous `SnapshotValidator` pipeline testing strict business logic invariants.
**Acknowledges:**

- `HTTP 201 Created` returning the successful transaction GUID referencing the snapshot record.
- `HTTP 422 Unprocessable Entity` returning an explicitly structured violation object.

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
      "rule": "BuildingCount",
      "detail": "3 Farms present but Era 2 not reached at tick 900"
    }
  ]
}
```

### State Restoration Sequence

`GET /api/saves/{userId}/latest`
**Function:** Queries the indexing mechanism across the relational EF context returning the chronologically supreme valid `GameState` snapshot attributed to the requested authorization identifier.
**Client Action:** Triggers a pipeline re-seeding the Web Worker from the exact persisted `tickCount` and the correlated determinable `mapSeed`.

## 3. The Validation Invariant Matrix

The `SnapshotValidator` class maps discrete, mathematically structured rules enforcing systemic sanctity. Each invariant must evaluate structurally isolated contexts.

| Invocation Context | Analytical Pipeline Check                                           | Rejection Typology                                                        |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `ResourceCap`      | `resources[x] ≤ max_possible(tickCount, buildings)`                 | Absolute totals mathematically eclipse projected maximal bounds.          |
| `EraGate`          | Structural hierarchy evaluation matching current global parameters. | Higher-tiered topology submitted prior to completing mandated thresholds. |
| `WorkerCap`        | `workers.length ≤ housing_capacity(buildings)`                      | Worker demographic index unsupported by local logistical scaffolding.     |
| `TickSanity`       | `tickCount > lastSave.tickCount`                                    | Chronological manipulation detected; absolute vector regressed.           |
| `MapSeedSync`      | `mapSeed` maps identical string evaluation to prior baseline.       | Seed string injected mid-session causing deterministic topology drift.    |

## 4. Testing Contract Requirements

**Backend Protocol**: Explicit xUnit test suites targeting `SnapshotValidator` instances mapping one unit context per validation failure structure, ensuring comprehensive code coverage traversing logical rejection pathways.
**Integration Protocol**: Contexts executing the total `SaveGameCommandHandler` testing systemic EF Core mapping pipelines persisting structural snapshots successfully, or rejecting deterministically alongside the correct structured list configuration.
