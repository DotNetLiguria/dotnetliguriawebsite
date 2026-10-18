using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

namespace DotNetLiguriaCore.Security;

public static class ProxyConfiguration
{
    public static void Configure(ForwardedHeadersOptions options, IConfiguration configuration)
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.ForwardLimit = 1;
        options.RequireHeaderSymmetry = true;
        var proxies = configuration.GetSection("Security:KnownProxies").Get<string[]>() ?? [];
        foreach (var address in proxies)
        {
            if (!IPAddress.TryParse(address, out var parsed))
                throw new InvalidOperationException("Security:KnownProxies contains an invalid IP address.");
            options.KnownProxies.Add(parsed);
        }
    }
}
