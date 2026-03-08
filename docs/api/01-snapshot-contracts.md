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
  "mapSeed": "df8A7x11L",
  "tickCount": 1403,
  "era": 1,
  "resources": {
    "food": 850,
    "wood": 320,
    "stone": 105,
    "knowledge": 0
  },
  "tiles": [
    { "x": 14, "y": 21, "type": "grassland", "ownerId": "uuid-string" }
  ],
  "workers": [
    { "id": "uuid-string", "x": 14, "y": 22, "currentTask": "harvest" }
  ],
  "buildings": [
    { "id": "uuid-string", "type": "lumber_mill", "x": 15, "y": 21 }
  ],
  "savedAt": "2026-03-08T15:20:00Z"
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
