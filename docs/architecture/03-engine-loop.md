# Kinetic Engine Loop

## Simulation Constraints & Web Worker Orchestration

Holdfast segregates UI responsiveness from mechanical resolution. The mathematical simulation occurs within a Web Worker, guaranteeing smooth interaction regardless of simulation complexity.

### 1. Web Worker Instantiation

The simulation locus rests within `engine/simulation.worker.ts`. The primary App bootstrap initialises this background processor on load. Communication traverses the boundary via structured `postMessage` payloads.

### 2. Deterministic Tick Pipeline

The core progression executes every 2000 milliseconds (base tick). A speed multiplier (1x-100x) adjusts the interval, and pause/resume halts or restarts the loop without resetting speed.

During each tick iteration, the Worker asserts the following sequence:

1. **Action Queue Drain (Step 1)**: Player-submitted actions (`PLACE_BUILDING`, `DEMOLISH_BUILDING`, `ASSIGN_WORKER`, `UNASSIGN_WORKER`, `RESEARCH_ERA`, `SPAWN_WORKER`) are drained FIFO and validated. Building placement triggers `expandTerritory()` to claim adjacent tiles (3-tile ownership, 5-tile vision radius).
2. **Construction Assignment (Step 2)**: Idle workers are deterministically assigned to buildings under construction.
3. **Worker State Machine Evaluation (Step 3)**: Each `WorkerState` transitions through its task loop:
   - `IDLE -> MOVING_TO_CONSTRUCT -> CONSTRUCTING`
   - `IDLE -> MOVING_TO_HARVEST -> HARVESTING`
   - `HARVESTING -> MOVING_TO_DEPOSIT` (when harvest complete and storage has capacity)
   - `HARVESTING -> WAITING` (when harvest complete but no storage capacity)
   - `MOVING_TO_DEPOSIT -> DEPOSITING -> MOVING_TO_HARVEST`
   - `WAITING -> MOVING_TO_DEPOSIT` (when capacity frees up)
4. **Production Evaluation (Step 4)**: Calculates staffing and operational state. Staffed buildings with resource configurations generate production deltas.
5. **Consumption (Step 5)**: Worker food upkeep (1 food per worker per tick) is deducted only once an operational food producer exists. Otherwise upkeep is 0 and STARVING is cleared (grace period).
6. **Delta Commit (Step 6)**: Combined production, deposit deltas, and consumption are committed to the resource pool, clamped to storage capacity (base 200 + 200 per Storehouse).
7. **Era Progression (Step 7)**: Currently player-initiated via `RESEARCH_ERA` in Step 1.
8. **TickResult Emission (Step 8)**: Bundles the computed delta - including full `workers`, `buildings`, and `tiles` arrays - into the `TickResult` payload.

### 3. Zustand Rehydration

The main thread receives `TickResult` and applies full state sync: resource totals, deltas, workers, buildings, tiles, and era state. This drives the Canvas renderer and React HUD components.

### 4. Thread Safety & Temporal Predictability

Operations are sequentially batched via explicit messaging routines, avoiding race conditions. All player actions are queued and applied on the next tick cycle.

### 5. Pathfinding

The A* pathfinder (`engine/pathfinder.ts`) uses binary insertion to maintain a sorted open list (O(log n) per insert) with deterministic tile-ID tie-breaking. Paths are computed once per destination change and consumed one step per tick (1 tile/tick velocity cap). Path invalidation occurs automatically when buildings are placed or demolished on tiles that intersect existing worker paths.
