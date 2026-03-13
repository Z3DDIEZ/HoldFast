# State Management & The Trust Boundary

## The Axiom of the Untrusted Client

Holdfast resolves the tension between responsiveness and trust through an optimistic compute model paired with authoritative post-hoc validation. The client is untrusted.

### 1. Optimistic Local Compute

The frontend maintains sovereignty over the real-time topological matrix. State mutates optimistically in the Web Worker and immediately reflects within UI paradigms.

### 2. Snapshot Serialisation

To commit progress, the client serialises the transient state into a comprehensive `GameState` snapshot.

### 3. Server-Side Invariant Resolution

Upon receipt, the API routes the snapshot through `SnapshotValidator` in the Domain layer. The validator enforces mathematical invariants:

- **Chronological Verification**: Submitted `tickCount` must exceed the previous save.
- **Production Capacities**: Resource totals must fit within maximums derived from elapsed `tickCount`, constructed buildings, and storage capacity.
- **Demographic Constraints**: Worker count must be supported by housing capacity.
- **Map Seed Consistency**: `mapSeed` must match the previous save.

### 4. Violation Resolution Pathway

If validation passes, the snapshot is accepted and a `201 Created` response returns the save identifier and server-stamped `savedAt`. If validation fails, the API responds with `HTTP 422 Unprocessable Entity` and an explicit list of violations.

### 5. Persistence Status

Persistence currently uses an in-memory repository to ensure deterministic validation. EF Core + PostgreSQL remain deferred.
