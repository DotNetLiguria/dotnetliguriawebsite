using Microsoft.AspNetCore.StaticFiles;

namespace DotNetLiguriaCore;

/// <summary>
/// The SPA's HTML entry points name the hashed bundles of the current release, so browsers must revalidate them
/// on every request; otherwise a cached index.html keeps loading the previous release after a deployment.
/// </summary>
public static class SpaCacheHeaders
{
    public static void Apply(StaticFileResponseContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (context.File.Name.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
        {
            context.Context.Response.Headers.CacheControl = "no-cache";
        }
    }
}
