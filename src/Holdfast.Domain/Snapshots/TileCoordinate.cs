namespace Holdfast.Domain.Snapshots;

public sealed record TileCoordinate
{
    public TileCoordinate()
    {
    }

    public TileCoordinate(int x, int y)
    {
        X = x;
        Y = y;
    }

    public int X { get; init; }

    public int Y { get; init; }
}
