namespace Holdfast.Domain.Validation;

using Holdfast.Domain.Snapshots;

public static class CivilizationCatalog
{
    public const string Franks = "franks";
    public const string Malians = "malians";
    public const string Byzantines = "byzantines";
    public const string Normans = "normans";

    private static readonly IReadOnlyDictionary<string, CivilizationDefinition> Definitions =
        new Dictionary<string, CivilizationDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            [Franks] = new CivilizationDefinition(
                Franks,
                startingResources: new ResourcePool(food: 0, wood: 50, stone: 0, knowledge: 0)),
            [Malians] = new CivilizationDefinition(
                Malians,
                startingResources: new ResourcePool(food: 0, wood: 0, stone: 100, knowledge: 0),
                yieldMultipliers: new Dictionary<ResourceType, decimal>
                {
                    [ResourceType.Stone] = 1.15m,
                    [ResourceType.Knowledge] = 1.15m,
                }),
            [Byzantines] = new CivilizationDefinition(
                Byzantines,
                startingResources: new ResourcePool(food: 0, wood: 0, stone: 0, knowledge: 20),
                yieldMultipliers: new Dictionary<ResourceType, decimal>
                {
                    [ResourceType.Knowledge] = 1.2m,
                }),
            [Normans] = new CivilizationDefinition(
                Normans,
                startingResources: new ResourcePool(food: 50, wood: 0, stone: 0, knowledge: 0)),
        };

    public static bool TryGetDefinition(string? id, out CivilizationDefinition definition)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            definition = default!;
            return false;
        }

        return Definitions.TryGetValue(id, out definition!);
    }

    public static CivilizationDefinition GetDefinitionOrDefault(string? id)
    {
        return TryGetDefinition(id, out var definition) ? definition : new CivilizationDefinition(id ?? string.Empty);
    }
}
