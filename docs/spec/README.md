# Product Specifications

## 1. Game Concept

Holdfast is a browser-playable, 8-bit idle settlement builder. The player claims tiles on a procedurally generated map, places structures, assigns workers, and watches an autonomous simulation tick the settlement forward. Strategic decisions happen at the macro level - determining which tiles to develop, prioritising specific buildings, and initiating era research.

The primary design principle is enabling an autonomous simulation that handles resource flow, entity movement, and production synchronously, reducing the need for constant micromanagement.

## 2. Core Simulation Loop

The game tick evaluates every 2 seconds within an isolated Web Worker. A speed multiplier (1x-100x) and pause/resume allow pacing control. Each execution:

1. Iterates over active worker agents' task queues.
2. Applies scheduled production to operational buildings.
3. Updates aggregated resource pools.
4. Emits a discrete state delta to the main rendering thread.

Player interactions - such as structural designation, spatial reassignments, or technological research - are enacted between ticks and applied on the subsequent cycle.

## 3. Topographical Map Constraints

- **Dimensions**: Fixed 80x80 tile configuration.
- **Generation Engine**: Procedurally instantiated via 2D Simplex Noise.
- **Biomes & Tile Typologies**: Grassland, Forest, Stone Deposit, Water, Barren.
- **Resource Placements**: Nodes are permanently distributed at generation time.
- **Fog of War**: Visibility radius expands as the settlement footprint grows.

## 4. Resource Economy

| Resource  | Procurement Node         | Primary Sink                          |
| --------- | ------------------------ | ------------------------------------- |
| Food      | Farm, Forager Hut        | Worker upkeep per tick                |
| Wood      | Lumber Mill, Forest tile | Construction and upgrades             |
| Stone     | Quarry, Stone Deposit    | Advanced buildings and fortifications |
| Knowledge | Library                  | Era research gating                   |

## 5. Autonomous Worker Agents

Workers traverse the grid at 1 tile per tick, following a deterministic task loop:

- `Harvest(tileId)`
- `Deposit(storageId)`
- `Construct(buildingId)`
- `Idle`

## 6. Structural Entities

| Nomenclature | Tier | Yield              | Pre-requisite Constraint |
| ------------ | ---- | ------------------ | ------------------------ |
| Town Hall    | 1    | N/A                | Root starting entity     |
| Forager Hut  | 1    | Food               | Grassland adjacency      |
| Lumber Mill  | 1    | Wood               | Forest adjacency         |
| Quarry       | 1    | Stone              | Stone Deposit adjacency  |
| Storehouse   | 1    | Storage Limit +200 | Absolute spatial freedom |
| Farm         | 2    | Food x2            | Era 2                    |
| Library      | 2    | Knowledge          | Era 2                    |
| Barracks     | 3    | Defence            | Era 3                    |

## 7. Era Progression Flow

1. **Era 1 - Founding**: Emphasises initial resource saturation; structures include Forager Hut, Lumber Mill, and Quarry.
2. **Era 2 - Settlement**: Unlocks Farms and Libraries; Knowledge becomes a gating resource.
3. **Era 3 - Fortification**: Mandates militarisation (Barracks) alongside advanced multipliers.

Progression transitions mandate cumulative Knowledge acquisition and explicit demographic thresholds without time-gating constraints.

## 8. Starvation Guard

Food upkeep and starvation only activate once an operational food producer exists. This grace period prevents immediate starvation in early ticks.
