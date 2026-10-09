using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace DotNetLiguria.ServiceDefaults;

public static class LocalDevelopment
{
    public static bool ShouldInitialize(IConfiguration configuration, IHostEnvironment environment)
    {
        if (!configuration.GetValue<bool>("LocalDevelopment:Initialize"))
            return false;

        if (!environment.IsDevelopment() || configuration["DOTNET_LIGURIA_ASPIRE"] != "true")
            throw new InvalidOperationException("Local database initialization requires Aspire and Development.");

        return true;
    }
}
