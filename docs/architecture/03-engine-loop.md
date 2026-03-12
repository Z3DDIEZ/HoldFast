# Kinetic Engine Loop

## Simulation Constraints & Web Worker Orchestration

To establish an autonomous, persistent idle strategic paradigm, Holdfast segregates UI responsiveness from mechanical resolution. The mathematical simulation occurs strictly upon the client device but within a partitioned thread heuristic, guaranteeing 60FPS interaction paradigms regardless of simulation complexity or procedural evaluation scaling.

### 1. Web Worker Instantiation

The simulation locus rests unilaterally within `engine/simulation.worker.ts`. The primary `App` bootstrap initialises this background processor upon DOM readiness. Communication traverses the boundary solely via high-throughput, structured `postMessage` implementations.

### 2. The Deterministic Tick Pipeline

The core kinetic progression is dictated by a deterministic interval processing cycle, executing exactly every 2000 milliseconds (the 'Game Tick').

During each tick iteration, the Worker algorithmically asserts the following sequential block:

1. **Action Queue Drain (Step 1)**: All player-submitted actions (`PLACE_BUILDING`, `DEMOLISH_BUILDING`, `ASSIGN_WORKER`, `UNASSIGN_WORKER`, `RESEARCH_ERA`) are drained from the FIFO queue and validated. Invalid actions are rejected with specific reason codes. Building placement triggers `expandTerritory()` to claim adjacent tiles (3-tile ownership, 5-tile vision radius).
2. **Worker State Machine Evaluation (Step 2)**: Iterates over every allocated `WorkerState` object (deterministically sorted by ID). Each agent interprets the immediate internal state machine transition:
   - `IDLE → MOVING_TO_HARVEST` (when assigned to a building)
   - `MOVING_TO_HARVEST → HARVESTING` (on arrival at assigned building)
   - `HARVESTING → MOVING_TO_DEPOSIT` (when harvest ticks complete and storage capacity available)
   - `HARVESTING → WAITING` (when harvest complete but no storage capacity)
   - `MOVING_TO_DEPOSIT → DEPOSITING` (on arrival at deposit point)
   - `DEPOSITING → MOVING_TO_HARVEST` (cycle repeats)
   - `WAITING → MOVING_TO_DEPOSIT` (when capacity frees up)
   - Any state → `STARVING` (when food reaches zero)
3. **Production Evaluation (Step 3)**: Calculates building staffing status and operational state. Staffed buildings with resource configurations generate production deltas.
4. **Consumption (Step 4)**: Worker food upkeep (1 food per worker per tick) is deducted. If net food would go negative, all workers enter `STARVING` state.
5. **Delta Commit (Step 5)**: Combined production deltas, deposit deltas, and consumption are committed to the resource pool, clamped to storage capacity (base 200 + 200 per Storehouse).
6. **Era Progression (Step 6)**: Reserved for future passive triggers. Currently, era advancement is player-initiated through the `RESEARCH_ERA` action processed in Step 1.
7. **TickResult Emission (Step 7)**: Bundles the complete computed delta — including full `workers`, `buildings`, and `tiles` arrays — into the `TickResult` payload and signals the primary thread.

### 3. Zustand Rehydration

The main thread receives the `TickResult` data block. The Zustand `game-store` applies full state sync: resource totals, resource deltas, workers (with positions, states, carrying status), buildings (with staffing, operational), tiles (with ownership, visibility), and era state. This drives both the Canvas renderer and the React HUD components.

### 4. Thread Safety & Temporal Predictability

Because operations are sequentially batched via specific messaging routines, race conditions inherent typically to mutable shared state paradigms are eradicated. If a user defines an operational command (e.g., executing structural placement), a `PLAYER_ACTION` message propagates from the main thread into the simulation worker. This manipulation is explicitly queued and systematically instantiated definitively on the _next sequential tick cycle_, ensuring all topological equations evaluate precisely within a controlled chronological frame.

### 5. Pathfinding

The A\* pathfinder (`engine/pathfinder.ts`) uses binary insertion to maintain a sorted open list (O(log n) per insert) with deterministic tile-ID tie-breaking. Paths are computed once per destination change and consumed one step per tick (1 tile/tick velocity cap). Path invalidation occurs automatically when buildings are placed or demolished on tiles that intersect existing worker paths.
