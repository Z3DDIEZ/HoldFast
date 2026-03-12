# Entity Manifest & Economy Progression

## The Operational Cohort

Entities exist as the singular kinetic agents traversing the grid structure.

### 1. Worker Agent Parametrics

`WorkerState` objects encapsulate the primary mobile labour force. Each agent interprets a linear task state machine, modifying grid layouts by executing algorithmic instructions defined by the global planner.

- `IDLE`: The agent loops a local heuristic waiting for global queue assignment.
- `MOVING_TO_HARVEST`: Traversing the pathfinding graph towards the assigned building's resource node (1 tile per tick).
- `HARVESTING`: Extracting quantitative resource volumes from the assigned building's resource type over `ticksToHarvest` ticks.
- `MOVING_TO_DEPOSIT`: Carrying harvested resources towards the nearest Storehouse or Town Hall.
- `DEPOSITING`: Transferring carried resources into the global resource pool (clamped to storage capacity).
- `WAITING`: Blocked because storage capacity is full. Re-evaluates capacity each tick and transitions to `MOVING_TO_DEPOSIT` when space frees up.
- `STARVING`: Emergency state triggered when food resources reach zero. All workers enter this state simultaneously and recover when food becomes available.

Agents explicitly possess a velocity cap equating strictly to a `1-tile-per-tick` vector, compelling rigorous macro-level geographical considerations regarding resource proximities and storage logistics.

### 2. Worker Assignment Rules

Workers are assigned to buildings via the `ASSIGN_WORKER` action. Assignment is rejected if:

- The worker is already assigned to another building.
- The building has reached its `requiredWorkers` capacity (returned as `BUILDING_FULLY_STAFFED`).

Workers can be unassigned via `UNASSIGN_WORKER`, returning them to `IDLE` state.

## The Structural Hierarchy

The topological footprint scales definitively through a progressive era gating system representing macro-societal evolution.

### Era 1: The Founding Vector

Fundamental survival and explicit extraction capabilities establish baseline indices.

| Building        | Resource | Yield                      | Harvest Ticks | Workers | Cost             |
| --------------- | -------- | -------------------------- | ------------- | ------- | ---------------- |
| **Town Hall**   | —        | Spawns 3 workers, +20 food | —             | 0       | Free             |
| **Forager Hut** | Food     | 1/tick                     | 3             | 1       | 10 Wood          |
| **Lumber Mill** | Wood     | 1/tick                     | 3             | 1       | 5 Wood, 5 Stone  |
| **Quarry**      | Stone    | 1/tick                     | 4             | 1       | 8 Wood           |
| **Storehouse**  | —        | +200 capacity              | —             | 0       | 15 Wood, 5 Stone |

### Era 2: The Settlement Threshold

Requires: **50 Knowledge** + **3 Workers** (player-initiated via `RESEARCH_ERA` action).

| Building    | Resource  | Yield  | Harvest Ticks | Workers | Cost              |
| ----------- | --------- | ------ | ------------- | ------- | ----------------- |
| **Farm**    | Food      | 2/tick | 2             | 2       | 20 Wood, 10 Stone |
| **Library** | Knowledge | 1/tick | 5             | 1       | 25 Wood, 20 Stone |

### Era 3: Fortified Sovereign

Requires: **200 Knowledge** + **8 Workers**.

| Building     | Resource | Yield             | Harvest Ticks | Workers | Cost              |
| ------------ | -------- | ----------------- | ------------- | ------- | ----------------- |
| **Barracks** | —        | Defence (passive) | —             | 0       | 30 Wood, 30 Stone |

## The Resource Ontology

1. **Food**: Vitality source. Continuously drained by the `WorkerState` upkeep constraint (1 food per worker per tick). Starvation triggers `STARVING` state on all workers.
2. **Wood**: The explicit structural fabrication metric consumed strictly upon structural initialisation requests.
3. **Stone**: Hardened fortification metric vital for Era 2+ scalability logics.
4. **Knowledge**: Intangible heuristic pool accrued via Era 2 Libraries. Consumed when advancing eras through the `RESEARCH_ERA` player action.

## Territory & Visibility

When a building is placed, `expandTerritory()` marks tiles within a 3-tile Manhattan radius as **owned** and tiles within a 5-tile radius as **visible**. The initial map generation provides a 6-tile vision radius around the center tile.

- **Owned tiles** can have buildings placed on them.
- **Visible tiles** are rendered normally; non-visible tiles render as fog-of-war.
- Storage capacity: Base 200 + 200 per Storehouse.
