namespace Holdfast.Application.Saves;

using Holdfast.Domain.Validation;

public sealed record SaveGameResult
{
    public bool IsValid { get; init; }

    public Guid? SaveId { get; init; }

    public DateTimeOffset? SavedAt { get; init; }

    public IReadOnlyList<SnapshotViolation> Violations { get; init; } = Array.Empty<SnapshotViolation>();

    public static SaveGameResult Invalid(IReadOnlyList<SnapshotViolation> violations) =>
        new()
        {
            IsValid = false,
            Violations = violations,
        };

    public static SaveGameResult Success(Guid saveId, DateTimeOffset savedAt) =>
        new()
        {
            IsValid = true,
            SaveId = saveId,
            SavedAt = savedAt,
        };
}
