using System.Security.Cryptography;
using System.Text.RegularExpressions;
using DotNetLiguria.Models;

namespace DataMigration;

public static class SpeakerAssetMapping
{
    public static IReadOnlyDictionary<Guid, string?> ValidateAndMap(IReadOnlyList<WorkshopSpeaker> speakers,
        SpeakerAssetManifest manifest, string contentRoot)
    {
        if (speakers.Any(s => s is null || s.WorkshopSpeakerId == Guid.Empty) ||
            speakers.Select(s => s.WorkshopSpeakerId).Distinct().Count() != speakers.Count)
            throw new InvalidOperationException("Speaker export IDs must be nonempty and unique.");
        if (!Directory.Exists(contentRoot))
            throw new InvalidOperationException("The website Contents directory is required; specify --content-root.");
        var root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(contentRoot)) + Path.DirectorySeparatorChar;
        var source = speakers.ToDictionary(s => s.WorkshopSpeakerId);
        var mapped = new Dictionary<Guid, string?>();
        var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var asset in manifest.VerifiedAssets)
        {
            ValidateIdentity(source, mapped, asset.SpeakerId, asset.Name, asset.SourcePath, asset.SourceUrl);
            if (!Regex.IsMatch(asset.Path, @"\Aspeakers/[a-z0-9_-]+\.(jpg|jpeg|png|webp)\z") || !paths.Add(asset.Path) ||
                !Regex.IsMatch(asset.Sha256, @"\A[0-9a-fA-F]{64}\z") || asset.Bytes <= 0)
                throw new InvalidOperationException($"Invalid or duplicate speaker asset path/hash: {asset.SpeakerId}");
            var path = Path.GetFullPath(Path.Combine(root, asset.Path.Replace('/', Path.DirectorySeparatorChar)));
            if (!path.StartsWith(root, OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal) ||
                !File.Exists(path) || new FileInfo(path).Length != asset.Bytes)
                throw new InvalidOperationException($"Missing or incomplete speaker photo: {asset.Path}");
            using var input = File.OpenRead(path);
            if (!string.Equals(Convert.ToHexStringLower(SHA256.HashData(input)), asset.Sha256, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException($"Speaker original-source hash mismatch: {asset.Path}");
            mapped.Add(asset.SpeakerId, "/Contents/" + asset.Path);
        }
        foreach (var asset in manifest.UnavailableMedia)
        {
            ValidateIdentity(source, mapped, asset.SpeakerId, asset.Name, asset.SourcePath, asset.SourceUrl);
            if (asset.HttpStatus is not (404 or 410))
                throw new InvalidOperationException("Unavailable speaker photos require a reviewed 404/410 source result.");
            mapped.Add(asset.SpeakerId, null);
        }
        foreach (var speaker in speakers)
        {
            if (mapped.ContainsKey(speaker.WorkshopSpeakerId)) continue;
            if (!string.IsNullOrWhiteSpace(speaker.ProfileImage))
                throw new InvalidOperationException($"Missing speaker photo provenance: {speaker.WorkshopSpeakerId}");
            mapped.Add(speaker.WorkshopSpeakerId, null);
        }
        return mapped;
    }

    private static void ValidateIdentity(IReadOnlyDictionary<Guid, WorkshopSpeaker> source,
        IReadOnlyDictionary<Guid, string?> mapped, Guid id, string name, string originalPath, string sourceUrl)
    {
        if (mapped.ContainsKey(id) || !source.TryGetValue(id, out var speaker) ||
            speaker.Name != name || string.IsNullOrWhiteSpace(originalPath) || speaker.ProfileImage != originalPath)
            throw new InvalidOperationException($"Speaker photo identity/source mismatch: {id}");
        if (!Uri.TryCreate(sourceUrl, UriKind.Absolute, out var uri) || uri.Scheme != "https" ||
            uri.Host != "www.dotnetliguria.net" || uri.UserInfo.Length != 0 ||
            Uri.UnescapeDataString(uri.AbsolutePath) != originalPath)
            throw new InvalidOperationException($"Speaker photo provenance URL mismatch: {id}");
    }
}
