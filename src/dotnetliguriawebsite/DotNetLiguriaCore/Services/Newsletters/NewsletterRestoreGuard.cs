using System.Text.Json;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using System.Text;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterRestoreGuard : INewsletterRestoreGuard
{
    private readonly INewsletterStore _store;
    private readonly IOptionsMonitor<NewsletterOptions> _options;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<NewsletterRestoreGuard> _logger;
    private readonly SemaphoreSlim _markerLock = new(1, 1);

    public NewsletterRestoreGuard(INewsletterStore store, IOptionsMonitor<NewsletterOptions> options,
        IHostEnvironment environment, ILogger<NewsletterRestoreGuard> logger)
    {
        _store = store;
        _options = options;
        _environment = environment;
        _logger = logger;
    }

    public async Task SuspendForRestoreAsync(CancellationToken cancellationToken = default)
    {
        var current = _options.CurrentValue;
        if (current.ProductionEnabled && string.IsNullOrWhiteSpace(current.ActivationGeneration))
            throw new NewsletterServiceException("newsletter_activation_generation_required", 409);
        if (await _store.HasPendingProductionAsync(cancellationToken))
            throw new NewsletterServiceException("newsletter_pending_reconciliation", 409);
        await _markerLock.WaitAsync(cancellationToken);
        try
        {
            var path = GetMarkerPath();
            var generations = await ReadGenerationsAsync(path, cancellationToken);
            var generation = string.IsNullOrWhiteSpace(current.ActivationGeneration)
                ? "__missing_activation_generation__" : current.ActivationGeneration;
            if (!generations.Contains(generation, StringComparer.Ordinal))
                generations.Add(generation);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            var tempPath = path + "." + Guid.NewGuid().ToString("N") + ".pending";
            try
            {
                await using (var stream = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write,
                    FileShare.None, 4096, FileOptions.Asynchronous | FileOptions.WriteThrough))
                {
                    await stream.WriteAsync(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(generations)), cancellationToken);
                    await stream.FlushAsync(cancellationToken);
                    stream.Flush(true);
                }
                File.Move(tempPath, path, true);
            }
            finally
            {
                if (File.Exists(tempPath)) File.Delete(tempPath);
            }
        }
        finally
        {
            _markerLock.Release();
        }
    }

    public bool IsGenerationActive(string generation)
    {
        if (string.IsNullOrWhiteSpace(generation) ||
            !string.Equals(_options.CurrentValue.ActivationGeneration, generation, StringComparison.Ordinal))
            return false;
        try
        {
            var generations = ReadGenerationsAsync(GetMarkerPath(), CancellationToken.None).GetAwaiter().GetResult();
            return !generations.Contains(generation, StringComparer.Ordinal);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or
            JsonException or NewsletterServiceException or PrivacyBlockedException)
        {
            _logger.LogWarning("Newsletter production suspended: operational generation could not be verified.");
            return false;
        }
    }

    private string GetMarkerPath()
    {
        var folder = _options.CurrentValue.OperationalFolder;
        if (string.IsNullOrWhiteSpace(folder))
        {
            var localData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (string.IsNullOrWhiteSpace(localData))
                throw new NewsletterServiceException("newsletter_operational_folder_not_configured", 503);
            folder = Path.Combine(localData, "DotNetLiguria", "NewsletterOperations");
        }
        if (!Path.IsPathFullyQualified(folder))
            throw new NewsletterServiceException("newsletter_operational_folder_must_be_private", 503);
        var fullPath = Path.GetFullPath(folder);
        var contentRoot = Path.GetFullPath(_environment.ContentRootPath);
        if (fullPath == Path.GetPathRoot(fullPath) ||
            PrivacyStoragePaths.IsWithin(fullPath, contentRoot) ||
            PrivacyStoragePaths.IsWithin(contentRoot, fullPath))
            throw new NewsletterServiceException("newsletter_operational_folder_must_be_private", 503);
        PrivacyStoragePaths.RejectLinks(fullPath);
        var marker = Path.Combine(fullPath, "newsletter-suspended-generations.json");
        if (File.Exists(marker) && (File.GetAttributes(marker) & FileAttributes.ReparsePoint) != 0)
            throw new NewsletterServiceException("newsletter_operational_marker_invalid", 503);
        return marker;
    }

    private static async Task<List<string>> ReadGenerationsAsync(string path, CancellationToken cancellationToken)
    {
        if (!File.Exists(path)) return [];
        if (new FileInfo(path).Length > 1024 * 1024)
            throw new InvalidDataException("Newsletter restore marker exceeds its size limit.");
        var content = await File.ReadAllTextAsync(path, cancellationToken);
        var values = JsonSerializer.Deserialize<List<string>>(content);
        if (values is null || values.Any(value => string.IsNullOrWhiteSpace(value) || value.Length > 200))
            throw new InvalidDataException("Newsletter restore marker is invalid.");
        return values;
    }
}
