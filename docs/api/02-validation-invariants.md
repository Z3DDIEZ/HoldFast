# Validation Invariants & Domain Assertions

## The Rigorous Validation Schema

The Holdfast state logic depends entirely upon preventing client-side computational hallucination, mathematical drift, or active algorithmic manipulation from corrupting the authoritative Postgres tables.

To enforce this, `Holdfast.Domain` invokes `SnapshotValidator`—a discrete, standalone processing mechanism mathematically testing discrete vectors. If _any_ constraint evaluates false, the overarching `SaveGameCommandHandler` operation rolls back standard EF operations, halting the specific payload outright.

### Absolute Invariant Assertions

#### 1. The Resource Accumulation Cap (`ResourceCap`)

**Objective**: Prevent mathematical hallucination injecting disproportionate resource indices.
**Algorithmic Assert**: `resources[poolType] ≤ maximum_algorithmic_possibility(tickCount, buildings_instantiated)`
**Failure Logic**: If the submitted cumulative resource exceeds the theoretical maxima logically dictated by the precise temporal cycle evaluation combined with deployed structural production indices.

#### 2. The Era Dependency Gate (`EraGate`)

**Objective**: Ascertain hierarchical progression milestones correctly lock sophisticated geometries.
**Algorithmic Assert**: Evaluates explicit relationships linking active building topology with structural dependencies mapping the submitted `era` parameter.
**Failure Logic**: Tier 2 or Tier 3 structures (`Farm`, `Library`, `Barracks`, etc.) present physically upon the defined Cartesian grid when explicit threshold parameters denoting necessary previous criteria fail logic checks.

#### 3. Logistical Worker Capacity (`WorkerCap`)

**Objective**: Bound demographic populations strictly against the available structural housing geometries deployed on-grid.
**Algorithmic Assert**: `workers.length ≤ mathematical_sum(housing_capacity(buildings))`
**Failure Logic**: The specific demographic population metric vastly supersedes the specific physical array bounds offered by the local structural components array.

#### 4. Absolute Chronological Sanity (`TickSanity`)

**Objective**: Mitigate chronologic regression blocking malicious temporal rewind heuristics or arbitrary value inflation.
**Algorithmic Assert**: `tickCount > (Postgres.lastSave.tickCount)`
**Failure Logic**: A submitted payload's temporal indicator evaluates less than or equal to a previously validated temporal constraint, signifying explicit timeline manipulation or massive synchronous overlap states.

#### 5. Deterministic Generation Synchronisation (`MapSeedConsistency`)

**Objective**: Establish continuous, unvaried environmental substrates ensuring a coherent topology instance across progressive chronological boundaries.
**Algorithmic Assert**: `mapSeed == (Postgres.ActiveMappingSeed.UserId)`
**Failure Logic**: Asserts if the determinable noise generation string modifies mid-session, halting geographical asset scrambling exploits directly at the operational boundary.
