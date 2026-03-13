namespace Holdfast.Domain.Validation;

using Holdfast.Domain.Snapshots;

public static class BuildingCatalog
{
    public const string TownHall = "TOWN_HALL";
    public const string ForagerHut = "FORAGER_HUT";
    public const string LumberMill = "LUMBER_MILL";
    public const string Quarry = "QUARRY";
    public const string Storehouse = "STOREHOUSE";
    public const string Farm = "FARM";
    public const string Library = "LIBRARY";
    public const string Barracks = "BARRACKS";

    private static readonly IReadOnlyDictionary<string, BuildingDefinition> Definitions =
        new Dictionary<string, BuildingDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            [TownHall] = new(
                TownHall,
                null,
                0,
                0,
                1,
                3),
            [ForagerHut] = new(
                ForagerHut,
                ResourceType.Food,
                1,
                3,
                1,
                0),
            [LumberMill] = new(
                LumberMill,
                ResourceType.Wood,
                1,
                3,
                1,
                0),
            [Quarry] = new(
                Quarry,
                ResourceType.Stone,
                1,
                4,
                1,
                0),
            [Storehouse] = new(
                Storehouse,
                null,
                0,
                0,
                1,
                2),
            [Farm] = new(
                Farm,
                ResourceType.Food,
                2,
                2,
                2,
                0),
            [Library] = new(
                Library,
                ResourceType.Knowledge,
                1,
                5,
                2,
                0),
            [Barracks] = new(
                Barracks,
                null,
                0,
                0,
                3,
                4),
        };

    public static bool TryGetDefinition(string? type, out BuildingDefinition definition)
    {
        if (string.IsNullOrWhiteSpace(type))
        {
            definition = default!;
            return false;
        }

        return Definitions.TryGetValue(type, out definition!);
    }

    public static int GetHousingCapacity(string? type)
    {
        return TryGetDefinition(type, out var definition) ? definition.HousingCapacity : 0;
    }
}
