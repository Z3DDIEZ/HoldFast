namespace Holdfast.Application.Saves;

using Holdfast.Domain.Saves;

public interface IGameSaveRepository
{
    Task<IAsyncDisposable> AcquireUserLockAsync(string userId, CancellationToken cancellationToken);

    Task<GameSave?> GetLatestAsync(string userId, CancellationToken cancellationToken);

    Task<GameSave> SaveAsync(GameSave save, CancellationToken cancellationToken);
}
