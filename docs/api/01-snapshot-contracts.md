# Snapshot Contracts & API Vectors

## The Persistence Paradigm

Holdfast mandates a strictly deterministic state serialisation protocol bridging the untrusted simulation context (the Web Worker execution) and the absolute persistent authority (the PostgreSQL relational structure via Entity Framework Core). The mechanism relies entirely upon defined, stateless, asynchronous HTTP requests representing structured data schemas.

### The Immutable Boundary

Interaction relies upon precise JSON evaluation schemas mapping implicitly defined models. Null values are strictly checked, and dynamic properties are algorithmically barred.

## Endpoints

### 1. `POST /api/saves`

Initialises the validation sequence processing the serialised differential topology.

**Request Topology (GameState DTO)**

```json
{
  "mapSeed": "deterministic-seed-123",
  "tickCount": 1403,
  "era": 1,
  "resources": {
    "food": 850,
    "wood": 320,
    "stone": 105,
    "knowledge": 0
  },
  "tiles": [
    {
      "id": 3281,
      "type": "GRASSLAND",
      "owned": true,
      "walkable": true,
      "visible": true,
      "buildingId": null
    }
  ],
  "workers": [
    {
      "id": "w-0-0",
      "state": "HARVESTING",
      "assignedBuildingId": "b-1-3280",
      "position": { "x": 40, "y": 41 },
      "path": [],
      "harvestTicks": 2,
      "carrying": null
    }
  ],
  "buildings": [
    {
      "id": "b-1-3280",
      "type": "FORAGER_HUT",
      "tileId": 3280,
      "tier": 1,
      "staffed": true,
      "operational": true,
      "assignedWorkerIds": ["w-0-0"]
    }
  ],
  "savedAt": "2026-03-12T21:20:00Z"
}
```

**Synchronous Response Models**:

- `201 Created`: The mathematical assertions passed validation logic. The database transaction committed the geometry completely.
- `422 Unprocessable Entity`: The invariant constraints mathematically failed logic boundaries. The server rejects the structural payload completely without database pollution.

```json
{
  "valid": false,
  "violations": [
    {
      "rule": "ResourceCap",
      "detail": "Wood 320 exceeds computed quantitative maximum 280 bounds determined at chronometric tick 1403."
    }
  ]
}
```

### 2. `GET /api/saves/{userId}/latest`

Retrieves the most recent, mathematically evaluated `GameState` snapshot attributed unequivocally to the designated primary authentication mapping token (`userId`).

**Operational Expectation**: The React front-end parses this payload and immediately hydrates the Zustand memory mapping. Furthermore, it explicitly transmits the persistent `tickCount` and the corresponding generative noise `mapSeed` directly to the Web Worker for an uninhibited, fluid re-initialisation of consecutive gameplay.

## TickResult Contract (Worker → Main Thread)

The Web Worker emits the following payload every 2-second tick:

```typescript
interface TickResult {
  type: "TICK_RESULT";
  tickCount: number;
  resourceTotals: ResourcePool; // Absolute values post-commit
  resourceDelta: ResourcePool; // Per-tick change (+/-)
  workerPositions: { id; tileId; state }[];
  buildingUpdates: { id; staffed; operational }[];
  eraChanged: boolean;
  newEra?: 1 | 2 | 3;
  actionRejections: { action; reason }[];
  workers: WorkerState[]; // Full state for UI sync
  buildings: BuildingState[]; // Full state for UI sync
  tiles: TileState[]; // Full state (ownership/visibility changes)
}
```
