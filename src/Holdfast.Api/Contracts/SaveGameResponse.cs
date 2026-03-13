namespace Holdfast.Api.Contracts;

public sealed record SaveGameResponse
{
    public SaveGameResponse()
    {
    }

    public SaveGameResponse(Guid saveId, DateTimeOffset savedAt)
    {
        SaveId = saveId;
        SavedAt = savedAt;
    }

    public Guid SaveId { get; init; }

    public DateTimeOffset SavedAt { get; init; }
}
