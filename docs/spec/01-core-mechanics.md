# Core Mechanics & Heuristics

## The Settlement Builder Paradigm

Holdfast embodies a highly deliberate strategic framework designed to remove the burden of granular micromanagement whilst retaining maximum administrative autonomy. The system provides an 8-bit visual interpretation of a procedurally orchestrated environment, driven by deterministic rulesets.

### 1. The Procedural Matrix (The Map)

The foundational substrate of the simulation is a strict 80-by-80 Cartesian coordinate plane. This grid evaluates topographical variations through algorithmically instantiated noise sequences.

- **Generative Noise**: Topologies are sculpted via a 2D Simplex Noise algorithm. This yields clusters of distinctive biomes which inherently simulate natural landscape formations rather than purely randomised static.
- **Biome Typologies**: Valid nodes classify into fundamental typologies determining their traverse costs and resource capacities:
  - `Grassland`: The primary traversal and foundational biome for baseline agriculture.
  - `Forest`: An opaque structure blocking vision logic; provides arboreal resource nodes.
  - `Stone Deposit`: Rare outcroppings critical for later-tier structural fortification.
  - `Water`: Naturally impassable without specific technological unlock vectors.
  - `Barren`: Sub-optimal grids presenting spatial challenges for structural placement without yielding core resources.

### 2. The Visibility Heuristic (Fog of War)

Exploration is an active mechanical component tied inherently to population metrics and structural deployment.
The grid begins entirely obscured by an opaque shroud logic. As the primary settlement structure (`Town Hall`) establishes its baseline, a spherical revelation algorithm exposes proximal grids. Subsequent expansions, particularly defensive infrastructure or population saturation, deterministically push this visibility bound outward uncovering disparate resource deposit zones.

### 3. The Autonomous Tick Implementation

Mechanical progression unfolds arbitrarily without direct player interaction.
A chronometrically rigorous 'tick cycle' (executing definitively every 2000 milliseconds) forms the basis of chronological movement. During each cycle, the internal processor interpolates logistical routines, extrapolates production scaling multipliers, and executes predefined node traversals for all instantiated operational entities. Players exist fundamentally as architects: assigning zoning requests and declaring overarching strategic milestones enacted upon successive ticks by the autonomous entity cohort.
