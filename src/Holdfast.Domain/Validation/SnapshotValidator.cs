namespace Holdfast.Domain.Validation;

using Holdfast.Domain.Snapshots;

public sealed class SnapshotValidator
{
    public SnapshotValidationResult Validate(GameState snapshot, GameState? lastSnapshot)
    {
        if (snapshot is null)
        {
            throw new ArgumentNullException(nameof(snapshot));
        }

        var violations = new List<SnapshotViolation>();

        ValidateTickSanity(snapshot, lastSnapshot, violations);
        ValidateMapSeedConsistency(snapshot, lastSnapshot, violations);
        ValidateEraGate(snapshot, violations);
        ValidateWorkerCap(snapshot, violations);
        ValidateResourceCap(snapshot, violations);

        return new SnapshotValidationResult(violations);
    }

    private static void ValidateTickSanity(
        GameState snapshot,
        GameState? lastSnapshot,
        List<SnapshotViolation> violations)
    {
        if (snapshot.TickCount < 0)
        {
            violations.Add(new SnapshotViolation(
                "TickSanity",
                $"tickCount {snapshot.TickCount} cannot be negative."));
        }

        if (lastSnapshot is null)
        {
            return;
        }

        if (snapshot.TickCount <= lastSnapshot.TickCount)
        {
            violations.Add(new SnapshotViolation(
                "TickSanity",
                $"tickCount {snapshot.TickCount} must exceed last save {lastSnapshot.TickCount}."));
        }
    }

    private static void ValidateMapSeedConsistency(
        GameState snapshot,
        GameState? lastSnapshot,
        List<SnapshotViolation> violations)
    {
        if (lastSnapshot is null)
        {
            return;
        }

        if (!string.Equals(snapshot.MapSeed, lastSnapshot.MapSeed, StringComparison.Ordinal))
        {
            violations.Add(new SnapshotViolation(
                "MapSeedConsistency",
                $"mapSeed '{snapshot.MapSeed}' does not match previous seed '{lastSnapshot.MapSeed}'."));
        }
    }

    private static void ValidateEraGate(GameState snapshot, List<SnapshotViolation> violations)
    {
        var invalid = new List<(string Type, int RequiredEra)>();

        foreach (var building in snapshot.Buildings)
        {
            if (!BuildingCatalog.TryGetDefinition(building.Type, out var definition))
            {
                continue;
            }

            if (definition.RequiredEra > snapshot.Era)
            {
                invalid.Add((building.Type, definition.RequiredEra));
            }
        }

        if (invalid.Count == 0)
        {
            return;
        }

        var examples = string.Join(
            ", ",
            invalid
                .Select(entry => $"{entry.Type} (requires era {entry.RequiredEra})")
                .Distinct()
                .Take(3));

        violations.Add(new SnapshotViolation(
            "EraGate",
            $"{invalid.Count} building(s) exceed era {snapshot.Era}. Examples: {examples}."));
    }

    private static void ValidateWorkerCap(GameState snapshot, List<SnapshotViolation> violations)
    {
        var capacity = snapshot.Buildings
            .Where(building => building.ConstructionTicksRemaining <= 0)
            .Sum(building => BuildingCatalog.GetHousingCapacity(building.Type));

        if (snapshot.Workers.Count > capacity)
        {
            violations.Add(new SnapshotViolation(
                "WorkerCap",
                $"{snapshot.Workers.Count} workers exceed housing capacity {capacity}."));
        }
    }

    private static void ValidateResourceCap(GameState snapshot, List<SnapshotViolation> violations)
    {
        var maxTotals = ComputeMaxResources(snapshot);

        ValidateResource("food", snapshot.Resources.Food, maxTotals.Food, snapshot.TickCount, violations);
        ValidateResource("wood", snapshot.Resources.Wood, maxTotals.Wood, snapshot.TickCount, violations);
        ValidateResource("stone", snapshot.Resources.Stone, maxTotals.Stone, snapshot.TickCount, violations);
        ValidateResource("knowledge", snapshot.Resources.Knowledge, maxTotals.Knowledge, snapshot.TickCount, violations);
    }

    private static void ValidateResource(
        string resourceName,
        int current,
        long max,
        long tickCount,
        List<SnapshotViolation> violations)
    {
        if (current < 0)
        {
            violations.Add(new SnapshotViolation(
                "ResourceCap",
                $"{resourceName} {current} cannot be negative."));
            return;
        }

        if (current > max)
        {
            violations.Add(new SnapshotViolation(
                "ResourceCap",
                $"{resourceName} {current} exceeds computed max {max} for tick {tickCount}."));
        }
    }

    private static ResourceTotals ComputeMaxResources(GameState snapshot)
    {
        var tickCount = Math.Max(0, snapshot.TickCount);
        var storageCapacity = SnapshotRules.BaseStorageCapacity +
            snapshot.Buildings.Count(
                building => building.ConstructionTicksRemaining <= 0 &&
                    string.Equals(building.Type, BuildingCatalog.Storehouse, StringComparison.OrdinalIgnoreCase)) *
            SnapshotRules.StorehouseCapacityBonus;

        var perTickProduction = new ResourceTotals();
        foreach (var building in snapshot.Buildings)
        {
            if (building.ConstructionTicksRemaining > 0)
            {
                continue;
            }

            if (!BuildingCatalog.TryGetDefinition(building.Type, out var definition))
            {
                continue;
            }

            if (definition.Resource is null)
            {
                continue;
            }

            perTickProduction = perTickProduction.Add(definition.Resource.Value, definition.YieldAmount);
        }

        var workerHarvest = ComputeWorkerHarvest(snapshot, tickCount);
        var baseTotals = perTickProduction.Multiply(tickCount) + workerHarvest + ResourceTotals.FromPool(SnapshotRules.StarterResources);
        var storageTotals = new ResourceTotals(storageCapacity, storageCapacity, storageCapacity, storageCapacity);

        return ResourceTotals.Min(baseTotals, storageTotals);
    }

    private static ResourceTotals ComputeWorkerHarvest(GameState snapshot, long tickCount)
    {
        if (tickCount <= 0)
        {
            return new ResourceTotals();
        }

        var assignments = snapshot.Workers
            .Where(worker => !string.IsNullOrWhiteSpace(worker.AssignedBuildingId))
            .GroupBy(worker => worker.AssignedBuildingId!, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.Count(), StringComparer.Ordinal);

        var totals = new ResourceTotals();

        foreach (var building in snapshot.Buildings)
        {
            if (building.ConstructionTicksRemaining > 0)
            {
                continue;
            }

            if (!assignments.TryGetValue(building.Id, out var workerCount) || workerCount <= 0)
            {
                continue;
            }

            if (!BuildingCatalog.TryGetDefinition(building.Type, out var definition))
            {
                continue;
            }

            if (definition.Resource is null || definition.TicksToHarvest <= 0)
            {
                continue;
            }

            var cycles = tickCount / definition.TicksToHarvest;
            if (cycles <= 0)
            {
                continue;
            }

            var totalYield = cycles * definition.YieldAmount * workerCount;
            totals = totals.Add(definition.Resource.Value, totalYield);
        }

        return totals;
    }

    private readonly record struct ResourceTotals(long Food, long Wood, long Stone, long Knowledge)
    {
        public ResourceTotals() : this(0, 0, 0, 0)
        {
        }

        public ResourceTotals Add(ResourceType type, long amount)
        {
            return type switch
            {
                ResourceType.Food => this with { Food = Food + amount },
                ResourceType.Wood => this with { Wood = Wood + amount },
                ResourceType.Stone => this with { Stone = Stone + amount },
                ResourceType.Knowledge => this with { Knowledge = Knowledge + amount },
                _ => this,
            };
        }

        public ResourceTotals Multiply(long factor)
        {
            return new ResourceTotals(
                Food * factor,
                Wood * factor,
                Stone * factor,
                Knowledge * factor);
        }

        public static ResourceTotals FromPool(ResourcePool pool)
        {
            return new ResourceTotals(pool.Food, pool.Wood, pool.Stone, pool.Knowledge);
        }

        public static ResourceTotals Min(ResourceTotals left, ResourceTotals right)
        {
            return new ResourceTotals(
                Math.Min(left.Food, right.Food),
                Math.Min(left.Wood, right.Wood),
                Math.Min(left.Stone, right.Stone),
                Math.Min(left.Knowledge, right.Knowledge));
        }

        public static ResourceTotals operator +(ResourceTotals left, ResourceTotals right)
        {
            return new ResourceTotals(
                left.Food + right.Food,
                left.Wood + right.Wood,
                left.Stone + right.Stone,
                left.Knowledge + right.Knowledge);
        }
    }
}
