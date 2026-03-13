# Validation Invariants & Domain Assertions

## The Rigorous Validation Schema

The Holdfast state logic depends entirely upon preventing client-side computational drift or manipulation from corrupting the authoritative store.

`Holdfast.Domain` invokes `SnapshotValidator` - a discrete, standalone processing mechanism that tests mathematical invariants. If any constraint evaluates false, the `SaveGameCommandHandler` rejects the payload outright.

### Absolute Invariant Assertions

#### 1. The Resource Accumulation Cap (`ResourceCap`)

**Objective**: Prevent mathematical hallucination injecting disproportionate resource indices.

**Algorithmic Assert**: `resources[poolType] <= maximum_algorithmic_possibility(tickCount, buildings)`

**Failure Logic**: The submitted cumulative resource exceeds theoretical maxima dictated by elapsed ticks, constructed buildings, and storage capacity.

#### 2. The Era Dependency Gate (`EraGate`)

**Objective**: Ensure higher-tier buildings do not appear before the required era.

**Algorithmic Assert**: Building `requiredEra` must be `<= snapshot.era`.

**Failure Logic**: Tier 2 or Tier 3 structures (Farm, Library, Barracks) appear before the target era is reached.

#### 3. Logistical Worker Capacity (`WorkerCap`)

**Objective**: Bound population strictly against available housing capacity.

**Algorithmic Assert**: `workers.length <= sum(housing_capacity(buildings))`

**Failure Logic**: Worker count exceeds housing capacity derived from constructed buildings (Town Hall, Storehouse, Barracks).

#### 4. Absolute Chronological Sanity (`TickSanity`)

**Objective**: Mitigate chronologic regression and temporal rewind exploits.

**Algorithmic Assert**: `tickCount > lastSave.tickCount` (if a prior save exists).

**Failure Logic**: A submitted payload regresses or equals the last validated tick count.

#### 5. Deterministic Generation Synchronisation (`MapSeedConsistency`)

**Objective**: Enforce consistent deterministic map generation.

**Algorithmic Assert**: `mapSeed == lastSave.mapSeed` (if a prior save exists).

**Failure Logic**: The map seed changes mid-session.
