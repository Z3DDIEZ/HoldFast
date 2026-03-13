namespace Holdfast.Infrastructure.Persistence;

using System.Collections.Concurrent;
using Holdfast.Application.Saves;
using Holdfast.Domain.Saves;

public sealed class InMemoryGameSaveRepository : IGameSaveRepository
{
    private readonly ConcurrentDictionary<string, List<GameSave>> _saves =
        new(StringComparer.Ordinal);

    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks =
        new(StringComparer.Ordinal);

    public async Task<IAsyncDisposable> AcquireUserLockAsync(string userId, CancellationToken cancellationToken)
    {
        var key = userId ?? string.Empty;
        var semaphore = _locks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await semaphore.WaitAsync(cancellationToken);
        return new Releaser(semaphore);
    }

    public Task<GameSave?> GetLatestAsync(string userId, CancellationToken cancellationToken)
    {
        if (!_saves.TryGetValue(userId, out var list) || list.Count == 0)
        {
            return Task.FromResult<GameSave?>(null);
        }

        lock (list)
        {
            var latest = list
                .OrderByDescending(save => save.TickCount)
                .ThenByDescending(save => save.SavedAt)
                .FirstOrDefault();
            return Task.FromResult<GameSave?>(latest);
        }
    }

    public Task<GameSave> SaveAsync(GameSave save, CancellationToken cancellationToken)
    {
        var list = _saves.GetOrAdd(save.UserId, _ => new List<GameSave>());
        lock (list)
        {
            list.Add(save);
        }

        return Task.FromResult(save);
    }

    private sealed class Releaser : IAsyncDisposable
    {
        private readonly SemaphoreSlim _semaphore;

        public Releaser(SemaphoreSlim semaphore)
        {
            _semaphore = semaphore;
        }

        public ValueTask DisposeAsync()
        {
            _semaphore.Release();
            return ValueTask.CompletedTask;
        }
    }
}
