# Entity Manifest & Economy Progression

## The Operational Cohort

Entities exist as the singular kinetic agents traversing the grid structure.

### 1. Worker Agent Parametrics

`WorkerState` objects encapsulate the primary mobile labour force. Each agent interprets a linear task state machine:

- `IDLE`: Waiting for assignment.
- `MOVING_TO_CONSTRUCT`: Traversing to a building under construction.
- `CONSTRUCTING`: Reducing `constructionTicksRemaining` on the target building.
- `MOVING_TO_HARVEST`: Traversing to the assigned building.
- `HARVESTING`: Extracting resources over `ticksToHarvest`.
- `MOVING_TO_DEPOSIT`: Carrying harvested resources towards Town Hall or Storehouse.
- `DEPOSITING`: Transferring carried resources into the global pool.
- `WAITING`: Blocked because storage is full.
- `STARVING`: Emergency state triggered when food upkeep cannot be met (after the grace period ends).

Agents traverse at a fixed velocity of 1 tile per tick.

### 2. Worker Assignment Rules

Workers are assigned to buildings via the `ASSIGN_WORKER` action. Assignment is rejected if:

- The worker is already assigned to another building.
- The building is under construction.
- The building has reached its `requiredWorkers` capacity.

Workers can be unassigned via `UNASSIGN_WORKER`, returning them to `IDLE` state.

## The Structural Hierarchy

### Era 1: The Founding Vector

| Building        | Resource  | Yield | Harvest Ticks | Workers | Cost             | Construction Ticks |
| --------------- | --------- | ----- | ------------- | ------- | ---------------- | ------------------ |
| **Town Hall**   | -         | Spawns 3 workers | -             | 0       | Free             | 0                  |
| **Forager Hut** | Food      | 3     | 3             | 1       | 10 Wood          | 3                  |
| **Lumber Mill** | Wood      | 2     | 3             | 1       | 5 Wood, 5 Stone  | 3                  |
| **Quarry**      | Stone     | 2     | 4             | 1       | 8 Wood           | 3                  |
| **Storehouse**  | -         | +200 capacity | -             | 0       | 15 Wood, 5 Stone | 4                  |
| **Library**     | Knowledge | 2     | 4             | 1       | 25 Wood, 20 Stone | 5                  |

### Era 2: The Settlement Threshold

Requires: **50 Knowledge** + **3 Workers** (player-initiated via `RESEARCH_ERA`).

| Building | Resource | Yield | Harvest Ticks | Workers | Cost              | Construction Ticks |
| -------- | -------- | ----- | ------------- | ------- | ----------------- | ------------------ |
| **Farm** | Food     | 2     | 2             | 2       | 20 Wood, 10 Stone | 4                  |

### Era 3: Fortified Sovereign

Requires: **200 Knowledge** + **8 Workers**.

| Building     | Resource | Yield             | Harvest Ticks | Workers | Cost              | Construction Ticks |
| ------------ | -------- | ----------------- | ------------- | ------- | ----------------- | ------------------ |
| **Barracks** | -        | Defence (passive) | -             | 0       | 30 Wood, 30 Stone | 6                  |

## The Resource Ontology

1. **Food**: Vitality source. Upkeep is 1 food per worker per tick once an operational food producer exists.
2. **Wood**: Construction material consumed upon placement.
3. **Stone**: Fortification material consumed upon placement.
4. **Knowledge**: Accrued via Libraries and consumed when advancing eras.

## Territory & Visibility

When a building is placed, `expandTerritory()` marks tiles within a 3-tile Manhattan radius as owned and tiles within a 5-tile radius as visible. The initial map generation provides a 6-tile vision radius around the center tile.

- **Owned tiles** can have buildings placed on them.
- **Visible tiles** are rendered normally; non-visible tiles render as fog-of-war.
- **Storage capacity**: Base 200 + 200 per Storehouse.
