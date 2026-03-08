# State Management & The Trust Boundary

## The Axiom of the Untrusted Client

In distributed strategic simulations, attempting to execute granular, discrete validations for every micro-action across high-latency networks fundamentally compromises the kinetic feel of the application. Conversely, trusting the client implicitly leaves the platform exposed to deterministic drift, arbitrary memory manipulation, and logic nullification.

Holdfast resolves this tension through an optimistic computation model paired with authoritative post-hoc systemic validation. The fundamental axiom dictates **the client is utterly untrusted**.

### 1. Optimistic Local Compute

The frontend maintains total sovereignty over the real-time topological matrix. State mutates optimistically across the Web Worker and immediately reflects within UI paradigms. The end-user perceives instant reactivity, completely masking network latencies.

### 2. Snapshot Serialisation

To commit progress, the client serialises the transient state into a comprehensive structural snapshot (`GameState`). This mathematical representation is a frozen vector capturing the full settlement footprint, resource accumulations, entity positions, and chronological tick parameters.

### 3. Server-Side Invariant Resolution

Upon receipt by the API endpoint, the raw snapshot halts. It is immediately subjected to the `SnapshotValidator` pipeline within the core Domain stratum.
This pipeline does not blindly overwrite existing database structures. It executes a rigorous algorithm evaluating mathematical invariants:

- **Chronological Verification**: The submitted time vector (`tickCount`) must eclipse the previously validated temporal snapshot. Arbitrary regression evaluates as deliberate tampering.
- **Production Capacities**: Total quantitative resource volumes must fit mathematically within the absolute maximum generative capacity algorithmically derived from the elapsed `tickCount` and the historical building topology.
- **Demographic Constraints**: Synthetised vectors representing `WorkerState` enumerations must be safely supported by corresponding structural housing entities currently registered on the tile map grid.

### 4. Violation Resolution Pathway

Should the snapshot pass the rigorous Domain assertions, it is committed to the Postgres relational database as the authoritative anchor.
If validation metrics fail, the API forces a full transaction rollback and terminates the request with a structured `HTTP 422 Unprocessable Entity` response. Crucially, the system isolates the specific violations mathematically identified and projects these back to the UI. The client frontend must gracefully surface these errors, refusing local snapshot overwriting, leaving the player acutely aware that local temporal drift diverged unacceptably from validated reality.
