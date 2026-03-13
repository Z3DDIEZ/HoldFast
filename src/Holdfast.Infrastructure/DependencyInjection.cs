namespace Holdfast.Infrastructure;

using Holdfast.Application.Saves;
using Holdfast.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddSingleton<IGameSaveRepository, InMemoryGameSaveRepository>();
        return services;
    }
}
