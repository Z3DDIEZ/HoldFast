namespace Holdfast.Domain.Validation;

using Holdfast.Domain.Snapshots;

public sealed record CivilizationDefinition
{
    public CivilizationDefinition()
    {
    }

    public CivilizationDefinition(
        string id,
        ResourcePool? startingResources = null,
        IReadOnlyDictionary<ResourceType, decimal>? yieldMultipliers = null)
    {
        Id = id;
        StartingResources = startingResources ?? new ResourcePool();
        YieldMultipliers = yieldMultipliers ?? new Dictionary<ResourceType, decimal>();
    }

    public string Id { get; init; } = string.Empty;

    public ResourcePool StartingResources { get; init; } = new();

    public IReadOnlyDictionary<ResourceType, decimal> YieldMultipliers { get; init; } =
        new Dictionary<ResourceType, decimal>();
}
