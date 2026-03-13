namespace Holdfast.Application.Saves;

using Holdfast.Domain.Snapshots;
using MediatR;

public sealed record LoadGameQuery(string UserId) : IRequest<GameState?>;
