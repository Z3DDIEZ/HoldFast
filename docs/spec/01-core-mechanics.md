# Core Mechanics

## 1. Simulation Tempo

The deterministic game tick runs every 2 seconds by default. Players can change the speed (1x-100x) and pause/resume the loop without resetting the simulation.

## 2. Construction

Building placement initiates a construction phase. A worker is assigned to construct the building, and `constructionTicksRemaining` counts down to 0 before the building becomes operational.

## 3. Worker Tasks

Workers execute a linear state machine:

- **IDLE**: Waiting for assignment.
- **MOVING_TO_CONSTRUCT / CONSTRUCTING**: Building new structures.
- **MOVING_TO_HARVEST / HARVESTING**: Gathering resources from assigned buildings.
- **MOVING_TO_DEPOSIT / DEPOSITING**: Delivering resources to Town Hall or Storehouse.
- **WAITING**: Paused due to full storage.
- **STARVING**: Entered when food upkeep cannot be met (after the grace period ends).

## 4. Starvation Guard

Food upkeep and starvation only activate after an operational food producer exists. Before that point, upkeep is 0 and STARVING is cleared.

## 5. Storage Capacity

Base capacity is 200 units per resource type. Each Storehouse adds +200.
