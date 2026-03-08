# Product Specifications

## 1. Game Concept

Holdfast is a browser-playable, 8-bit idle settlement builder. The player claims tiles on a procedurally generated map, places structures, assigns workers, and watches an autonomous simulation tick the settlement forward. Strategic decisions happen at the macro level — determining which tiles to develop, prioritising specific buildings, and initiating era research.

The primary design principle is enabling an autonomous simulation that handles resource flow, entity movement, and production synchronously, negating the requirement for micromanagement or constant interaction.

## 2. Core Simulation Loop

The game tick is configured to evaluate every 2 seconds autonomously within an isolated Web Worker.
Each execution:

1. Iterates over active worker agents' task queues.
2. Applies scheduled production to corresponding operational buildings.
3. Updates aggregated resource pools.
4. Emits a discrete state delta to the main rendering thread.

Player interactions — such as structural designation, spatial reassignments, or technological research — are enacted between these ticks and queued to be synchronised during the subsequent cycle.

## 3. Topographical Map Constraints

- **Dimensions**: Fixed 80×80 tile configuration.
- **Generation Engine**: Procedurally instantiated utilizing 2D Simplex Noise.
- **Biomes & Tile Typologies**: Grassland, Forest, Stone Deposit, Water, Barren.
- **Resource Placements**: Nodes are permanently distributed according to initial generative biometric rules. Operations cannot organically inject new nodes mid-session.
- **Fog of War**: Visibility radius expands parametrically as the settlement's architectural and demographic footprint scales.

## 4. Resource Economy

| Resource  | Procurement Node         | Primary Sink                                                  |
| --------- | ------------------------ | ------------------------------------------------------------- |
| Food      | Farm, Forager Hut        | Worker vitality / upkeep per tick                             |
| Wood      | Lumber Mill, Forest tile | Structural scaffolding, upgrades                              |
| Stone     | Quarry, Stone Deposit    | Fortification elements, advanced zoning                       |
| Knowledge | Library                  | Era research gating, auxiliary technological unlock pipelines |

## 5. Autonomous Worker Agents

Workers construct the primary kinetic infrastructure of the simulation. A worker possesses a distinct state machine encapsulating a task queue executed linearly per tick. Formalisations:

- `Harvest(tileId)`: Extrapolating resources from defined biometric zones.
- `Deposit(storageId)`: Consolidating gathered materials into global capacity indices.
- `Construct(buildingId)`: Fabricating structures designated by the architect.
- `Idle`: Null state requiring manual or heuristic reassignment.

Workers traverse the Cartesian grid at a fixed displacement vector of **1 tile/tick**, utilizing advanced pathfinding algorithms spanning the contiguous collision-free nodes.

## 6. Structural Entities

| Nomenclature | Tier | Yield              | Pre-requisite Constraint |
| ------------ | ---- | ------------------ | ------------------------ |
| Town Hall    | 1    | N/A                | Root starting entity     |
| Forager Hut  | 1    | Food               | Grassland adjacency      |
| Lumber Mill  | 1    | Wood               | Forest adjacency         |
| Quarry       | 1    | Stone              | Stone Deposit adjacency  |
| Storehouse   | 1    | Storage Limit +200 | Absolute spatial freedom |
| Farm         | 2    | Food ×2            | Era 2                    |
| Library      | 2    | Knowledge          | Era 2                    |
| Barracks     | 3    | Defence            | Era 3                    |

## 7. Era Progression Flow

1. **Era 1 — Founding**: Emphasises initial resource saturation; structures include Forager Hut, Lumber Mill, and Quarry.
2. **Era 2 — Settlement**: Unlocks agricultural density (Farms) and scholarly infrastructure (Libraries), introducing Knowledge as a gating resource. Upgrading Storehouse capacities.
3. **Era 3 — Fortification**: Mandates militarisation (Barracks, Walls) alongside advanced scalar multipliers for fundamental resource nodes.

Progression transitions operate strictly on structural logic; they mandate cumulative Knowledge acquisition and explicit demographic thresholds without synthetic time-gating constraints.
