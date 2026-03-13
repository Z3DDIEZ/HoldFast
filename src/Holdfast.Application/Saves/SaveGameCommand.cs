namespace Holdfast.Application.Saves;

using Holdfast.Domain.Snapshots;
using MediatR;

public sealed record SaveGameCommand(string UserId, GameState Snapshot) : IRequest<SaveGameResult>;
