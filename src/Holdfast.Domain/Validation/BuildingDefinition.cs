namespace Holdfast.Domain.Validation;

using Holdfast.Domain.Snapshots;

public sealed record BuildingDefinition(
    string Type,
    ResourceType? Resource,
    int YieldAmount,
    int TicksToHarvest,
    int RequiredEra,
    int HousingCapacity);
