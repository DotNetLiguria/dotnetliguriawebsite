using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services.Photos;

public sealed class PhotoStorage(IOptions<PhotoOptions> options, IHostEnvironment environment)
{
    private readonly PhotoOptions _options = options.Value;
    private readonly string _contentRoot = environment.ContentRootPath;

    public string Root
    {
        get
        {
            if (!_options.Enabled || !Path.IsPathFullyQualified(_options.Root))
                throw new PrivacyBlockedException("photo_storage_not_configured", 503);
            var root = Path.GetFullPath(_options.Root);
            if (PrivacyStoragePaths.IsWithin(root, _contentRoot) || PrivacyStoragePaths.IsWithin(_contentRoot, root) ||
                root == Path.GetPathRoot(root))
                throw new PrivacyBlockedException("unsafe_photo_storage", 503);
            PrivacyStoragePaths.RejectLinks(root);
            return root;
        }
    }

    public static string FileName(Guid id, int size)
    {
        if (id == Guid.Empty || size is not (128 or 512)) throw new InvalidDataException("Invalid photo identifier.");
        return $"{id:N}-{size}.webp";
    }
    public string PathFor(Guid id, int size)
    {
        var path = Path.Combine(Root, FileName(id, size));
        if (File.Exists(path) && (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
            throw new PrivacyBlockedException("linked_storage_not_supported");
        return path;
    }
    public async Task SaveAsync(Guid id, IReadOnlyDictionary<int, byte[]> variants, CancellationToken token, bool allowExisting = false)
    {
        Directory.CreateDirectory(Root);
        foreach (var size in new[] { 128, 512 })
        {
            var path = PathFor(id, size);
            if (allowExisting && File.Exists(path))
            {
                if (new FileInfo(path).Length > PhotoImageProcessor.MaximumBytes ||
                    Hash(await File.ReadAllBytesAsync(path, token)) != Hash(variants[size]))
                    throw new InvalidDataException("Conflicting existing photo media.");
                continue;
            }
            var pending = path + "." + Guid.NewGuid().ToString("N") + ".pending";
            try
            {
                await using (var output = new FileStream(pending, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                    4096, FileOptions.Asynchronous | FileOptions.WriteThrough))
                {
                    await output.WriteAsync(variants[size], token);
                    await output.FlushAsync(token);
                    output.Flush(true);
                }
                File.Move(pending, path);
            }
            finally { if (File.Exists(pending)) File.Delete(pending); }
        }
    }
    public async Task<byte[]> ReadAsync(PhotoAsset asset, int size, CancellationToken token)
    {
        var path = PathFor(asset.Id, size);
        if (new FileInfo(path).Length > PhotoImageProcessor.MaximumBytes)
            throw new InvalidDataException("Photo exceeds the permitted size.");
        var data = await File.ReadAllBytesAsync(path, token);
        var expected = size == 128 ? asset.SmallHash : asset.LargeHash;
        if (data.Length > PhotoImageProcessor.MaximumBytes || Hash(data) != expected)
            throw new InvalidDataException("Photo integrity verification failed.");
        return data;
    }
    public void Delete(Guid id)
    {
        if (!Directory.Exists(Root)) return;
        foreach (var size in new[] { 128, 512 })
        {
            var path = PathFor(id, size);
            File.Delete(path);
            var prefix = Path.GetFileName(path) + ".";
            foreach (var pending in Directory.EnumerateFiles(Root, prefix + "*.pending", SearchOption.TopDirectoryOnly))
            {
                var name = Path.GetFileName(pending);
                var token = name[prefix.Length..^8];
                if (Guid.TryParseExact(token, "N", out _))
                {
                    if ((File.GetAttributes(pending) & FileAttributes.ReparsePoint) != 0)
                        throw new PrivacyBlockedException("linked_storage_not_supported");
                    File.Delete(pending);
                }
            }
        }
    }
    public static string Hash(byte[] data) => Convert.ToHexStringLower(SHA256.HashData(data));

    public string? ShippedSpeakerUrl(string name)
    {
        var slug = Regex.Replace(name.ToLowerInvariant().Normalize(NormalizationForm.FormD), "[\u0300-\u036f]", "");
        slug = Regex.Replace(slug, "[^a-z0-9]+", "_").Trim('_');
        if (slug.Length == 0) return null;
        foreach (var folder in new[] { "speakers", "profile" })
            foreach (var extension in new[] { "jpg", "png" })
            {
                var url = $"/Contents/{folder}/{slug}.{extension}";
                if (IsUsableLegacyUrl(url)) return url;
            }
        return null;
    }

    public bool IsUsableLegacyUrl(string value)
    {
        if (Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
            uri.Scheme is "https" or "http")
            return string.IsNullOrEmpty(uri.UserInfo) && !string.IsNullOrWhiteSpace(uri.Host);
        if (value.Contains('\\') || value.Contains('?') || value.Contains('#') || value.Contains(':') ||
            value.IndexOfAny(Path.GetInvalidPathChars()) >= 0) return false;
        var relative = value.StartsWith("/Contents/", StringComparison.Ordinal) ? value[10..] : value.TrimStart('/');
        var contents = Path.Combine(_contentRoot, "Contents");
        var path = Path.GetFullPath(Path.Combine(contents, relative.Replace('/', Path.DirectorySeparatorChar)));
        return PrivacyStoragePaths.IsWithin(path, contents) && File.Exists(path) &&
            Path.GetExtension(path).ToLowerInvariant() is ".jpg" or ".jpeg" or ".png" or ".webp" or ".gif";
    }
}
