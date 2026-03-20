namespace Holdfast.Domain.Validation;

using Holdfast.Domain.Snapshots;

public static class SnapshotRules
{
    public const int BaseStorageCapacity = 200;
    public const int StorehouseCapacityBonus = 200;
    public const int MapWidth = 80;
    public const int MapHeight = 80;
    public const int ExpectedTileCount = MapWidth * MapHeight;

    public static readonly ResourcePool StarterResources = new(
        food: 30,
        wood: 35,
        stone: 5,
        knowledge: 0);
}
