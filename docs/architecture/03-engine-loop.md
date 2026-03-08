# Kinetic Engine Loop

## Simulation Constraints & Web Worker Orchestration

To establish an autonomous, persistent idle strategic paradigm, Holdfast segregates UI responsiveness from mechanical resolution. The mathematical simulation occurs strictly upon the client device but within a partitioned thread heuristic, guaranteeing 60FPS interaction paradigms regardless of simulation complexity or procedural evaluation scaling.

### 1. Web Worker Instantiation

The simulation locus rests unilaterally within `engine/simulation.worker.ts`. The primary `App` bootstrap initialises this background processor upon DOM readiness. Communication traverses the boundary solely via high-throughput, structured `postMessage` implementations.

### 2. The Deterministic Tick

The core kinetic progression is dictated by a deterministic interval processing cycle, executing exactly every 2000 milliseconds (the 'Game Tick').

During each tick iteration, the Worker algorithmically asserts the following sequential block:

1.  **Entity Task Evaluation**: Iterates over every allocated `WorkerState` object. It interprets the immediate internal state machine queue (`Harvest`, `Deposit`, `Construct`, `Idle`).
2.  **Topological Permutation**: Translates worker location parameters via an internal A\* pathfinding algorithm along the valid contiguous map node matrix towards assignment objectives. Speed is strictly capped at a 1 tile-per-tick displacement vector.
3.  **Resource Ingestion**: Calculates discrete multiplicative outputs of structures assigned active working parameters, modifying current global indices whilst evaluating capacity bounds against the `Storehouse` limit matrix.
4.  **Delta Compilation**: Bundles only mutated spatial coordinates and updated scalar indices into a lightweight modification payload (`TickResult`).
5.  **Thread Synchronisation**: Signals the primary thread with the compiled delta context.

### 3. Zustand Rehydration

The main thread receives the differential data block. The Zustand `game-store` immediately applies granular merging routines seamlessly transitioning the Canvas UI states and updating macro-level HUD tracking elements without generating excessive React garbage collection cycles.

### 4. Thread Safety & Temporal Predictability

Because operations are sequentially batched via specific messaging routines, race conditions inherent typically to mutable shared state paradigms are eradicated. If a user defines an operational command (e.g., executing structural placement), a `WorkerCommand` message propagates from the main thread into the simulation worker. This manipulation is explicitly queued and systematically instantiated definitively on the _next sequential tick cycle_, ensuring all topological equations evaluate precisely within a controlled chronological frame.
