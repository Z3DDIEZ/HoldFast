# Snapshot Contracts & API Vectors

## The Persistence Paradigm

Holdfast mandates a deterministic state serialisation protocol bridging the untrusted simulation context (the Web Worker execution) and the absolute persistent authority. The mechanism relies on defined, stateless, asynchronous HTTP requests representing structured data schemas.

### The Immutable Boundary

Interaction relies upon precise JSON evaluation schemas mapping implicitly defined models. Null values are strictly checked, and dynamic properties are algorithmically barred.

## Endpoints

### 1. `POST /api/saves`

Initialises the validation sequence processing the serialised differential topology.

**Request Topology (GameState DTO)**

```json
{
  "mapSeed": "deterministic-seed-123",
  "playerCivId": "franks",
  "activeCivs": ["franks", "malians", "byzantines", "normans"],
  "civStates": {
    "franks": {
      "civilizationId": "franks",
      "resources": { "food": 850, "wood": 320, "stone": 105, "knowledge": 0 },
      "era": 1,
      "autoPlay": false,
      "townHallTileId": 3280
    }
  },
  "tickCount": 1403,
  "tiles": [
    {
      "id": 3281,
      "type": "GRASSLAND",
      "owned": true,
      "ownerId": "franks",
      "walkable": true,
      "visible": true,
      "buildingId": null
    }
  ],
  "workers": [
    {
      "id": "w-0-0",
      "ownerId": "franks",
      "unitType": "WORKER",
      "state": "HARVESTING",
      "assignedBuildingId": "b-1-3280",
      "position": { "x": 40, "y": 41 },
      "path": [],
      "harvestTicks": 2,
      "carrying": null,
      "visionRadius": 2
    }
  ],
  "buildings": [
    {
      "id": "b-1-3280",
      "ownerId": "franks",
      "type": "FORAGER_HUT",
      "tileId": 3280,
      "tier": 1,
      "constructionTicksRemaining": 0,
      "constructionWorkerId": null,
      "staffed": true,
      "operational": true,
      "assignedWorkerIds": ["w-0-0"]
    }
  ],
  "savedAt": null
}
```

**Synchronous Response Models**:

- `201 Created`: The mathematical assertions passed validation logic. The snapshot is accepted and stamped with `savedAt` on the server.
- `422 Unprocessable Entity`: The invariant constraints failed. The server rejects the payload completely without persistence pollution.

```json
{
  "valid": false,
  "violations": [
    {
      "rule": "ResourceCap",
      "detail": "Wood 320 exceeds computed quantitative maximum 280 bounds determined at tick 1403."
    }
  ]
}
```

### 2. `GET /api/saves/{userId}/latest`

Retrieves the most recent, validated `GameState` snapshot attributed to the designated `userId`.

**Operational Expectation**: The React front-end hydrates Zustand and re-seeds the Web Worker with the restored `tickCount` and `mapSeed`.

## TickResult Contract (Worker -> Main Thread)

The Web Worker emits the following payload every tick:

```typescript
interface TickResult {
  type: "TICK_RESULT";
  tickCount: number;
  civStates: Record<string, CivRuntimeState>; // Per-civ state snapshots
  playerCivId: CivilizationId;
  resourceDelta: ResourcePool; // Per-tick change (+/-) for player civ
  workerPositions: { id; tileId; state }[];
  buildingUpdates: { id; staffed; operational }[];
  eraChanged: boolean;
  newEra?: 1 | 2 | 3 | 4;
  actionRejections: { action; reason }[];
  workers: WorkerState[]; // Full state for UI sync
  buildings: BuildingState[]; // Full state for UI sync
  tiles: TileState[]; // Full state (ownership/visibility changes)
}
```
