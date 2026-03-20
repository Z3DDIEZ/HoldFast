# Validation Invariants & Domain Assertions

## The Rigorous Validation Schema

The Holdfast state logic depends entirely upon preventing client-side computational drift or manipulation from corrupting the authoritative store.

`Holdfast.Domain` invokes `SnapshotValidator` - a discrete, standalone processing mechanism that tests mathematical invariants. If any constraint evaluates false, the `SaveGameCommandHandler` rejects the payload outright.

### Absolute Invariant Assertions

#### 1. The Resource Accumulation Cap (`ResourceCap`)

**Objective**: Prevent mathematical hallucination injecting disproportionate resource indices.

**Algorithmic Assert**: Per civ, `resources[poolType] <= maximum_algorithmic_possibility(tickCount, buildings, workers)`

**Failure Logic**: The submitted cumulative resource exceeds theoretical maxima dictated by elapsed ticks, constructed buildings, and storage capacity.

#### 2. The Era Dependency Gate (`EraGate`)

**Objective**: Ensure higher-tier buildings do not appear before the required era.

**Algorithmic Assert**: Per civ, building `requiredEra` must be `<= civStates[civ].era`.

**Failure Logic**: Tier 2 or Tier 3 structures (Farm, Library, Barracks) appear before the target era is reached.

#### 3. Logistical Worker Capacity (`WorkerCap`)

**Objective**: Bound population strictly against available housing capacity.

**Algorithmic Assert**: Per civ, `workers.length <= sum(housing_capacity(buildings))`

**Failure Logic**: Worker count exceeds housing capacity derived from constructed buildings (Town Hall, Storehouse, Barracks).

#### 4. Absolute Chronological Sanity (`TickSanity`)

**Objective**: Mitigate chronologic regression and temporal rewind exploits.

**Algorithmic Assert**: `tickCount > lastSave.tickCount` (if a prior save exists).

**Failure Logic**: A submitted payload regresses or equals the last validated tick count.

#### 5. Deterministic Generation Synchronisation (`MapSeedConsistency`)

**Objective**: Enforce consistent deterministic map generation.

**Algorithmic Assert**: `mapSeed == lastSave.mapSeed` (if a prior save exists).

**Failure Logic**: The map seed changes mid-session.

#### 6. Civilization Roster Integrity (`CivRoster`)

**Objective**: Enforce a stable multi-civ roster and prevent civ drift.

**Algorithmic Assert**: `playerCivId` ∈ `activeCivs`, `civStates` contains exactly `activeCivs`, and roster matches the previous save.

**Failure Logic**: Civ lists mismatch, entries are missing, or ids change between saves.

#### 7. Tile Grid Integrity (`TileGrid`)

**Objective**: Maintain the deterministic 80x80 topology.

**Algorithmic Assert**: `tiles.length == 6400`, ids are unique, and ids ∈ `[0..6399]`.

**Failure Logic**: Malformed or inconsistent tile grids.

#### 8. Assignment Consistency (`AssignmentConsistency`)

**Objective**: Keep worker/building assignments bidirectionally consistent.

**Algorithmic Assert**: If `worker.assignedBuildingId == b.id`, then `b.assignedWorkerIds` contains that worker (and vice versa).

**Failure Logic**: Assignments are missing, duplicated, or cross-civilisation.

#### 9. Town Hall Integrity (`TownHall`)

**Objective**: Guarantee a single Town Hall per civ.

**Algorithmic Assert**: Exactly one `TOWN_HALL` exists for each civ and matches `townHallTileId`.

**Failure Logic**: Missing or duplicate Town Halls.
