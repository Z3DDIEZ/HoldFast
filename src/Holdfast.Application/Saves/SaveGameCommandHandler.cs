namespace Holdfast.Application.Saves;

using Holdfast.Domain.Saves;
using Holdfast.Domain.Snapshots;
using Holdfast.Domain.Validation;
using MediatR;

public sealed class SaveGameCommandHandler : IRequestHandler<SaveGameCommand, SaveGameResult>
{
    private readonly IGameSaveRepository _repository;
    private readonly SnapshotValidator _validator;

    public SaveGameCommandHandler(IGameSaveRepository repository, SnapshotValidator validator)
    {
        _repository = repository;
        _validator = validator;
    }

    public async Task<SaveGameResult> Handle(SaveGameCommand request, CancellationToken cancellationToken)
    {
        await using var userLock = await _repository.AcquireUserLockAsync(request.UserId, cancellationToken);
        var latestSave = await _repository.GetLatestAsync(request.UserId, cancellationToken);

        var validation = _validator.Validate(request.Snapshot, latestSave?.Snapshot);
        if (!validation.IsValid)
        {
            return SaveGameResult.Invalid(validation.Violations);
        }

        var savedAt = DateTimeOffset.UtcNow;
        var stampedSnapshot = StampSavedAt(request.Snapshot, savedAt);

        var save = new GameSave(
            Guid.NewGuid(),
            request.UserId,
            stampedSnapshot.MapSeed,
            stampedSnapshot.TickCount,
            stampedSnapshot,
            savedAt);

        var stored = await _repository.SaveAsync(save, cancellationToken);
        return SaveGameResult.Success(stored.Id, stored.SavedAt);
    }

    private static GameState StampSavedAt(GameState snapshot, DateTimeOffset savedAt)
    {
        return snapshot with { SavedAt = savedAt };
    }
}
