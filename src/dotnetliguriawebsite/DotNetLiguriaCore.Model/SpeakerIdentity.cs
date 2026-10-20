using System.Globalization;
using System.Text;

namespace DotNetLiguriaCore.Model;

public static class SpeakerIdentity
{
    public static string NormalizeName(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return string.Empty;
        }

        var collapsedWhitespace = string.Join(' ', fullName.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        var decomposed = collapsedWhitespace.Normalize(NormalizationForm.FormD);
        var normalized = new StringBuilder(decomposed.Length);
        foreach (var character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) is not UnicodeCategory.NonSpacingMark
                and not UnicodeCategory.SpacingCombiningMark
                and not UnicodeCategory.EnclosingMark)
            {
                normalized.Append(character);
            }
        }

        return normalized.ToString().Normalize(NormalizationForm.FormC).ToUpperInvariant();
    }

    public static WorkshopSpeaker Merge(IEnumerable<WorkshopSpeaker> speakers)
    {
        var ordered = speakers
            .OrderByDescending(speaker => !string.IsNullOrWhiteSpace(speaker.SessionizeId))
            .ThenByDescending(Completeness)
            .ThenBy(speaker => speaker.WorkshopSpeakerId)
            .ToList();
        if (ordered.Count == 0)
        {
            throw new ArgumentException("At least one speaker is required.", nameof(speakers));
        }

        var canonical = ordered[0];
        var accounts = ordered.Where(speaker => speaker.AccountSubject is not null)
            .Select(speaker => (speaker.AccountIssuer, speaker.AccountSubject)).Distinct().ToArray();
        if (accounts.Length > 1)
            throw new InvalidOperationException("Cannot merge speakers linked to different accounts.");
        // A linked canonical ID also owns any independently selected profile photo.
        canonical = ordered.FirstOrDefault(speaker => speaker.AccountSubject is not null) ?? canonical;
        return new WorkshopSpeaker
        {
            WorkshopSpeakerId = canonical.WorkshopSpeakerId,
            Name = FirstValue(ordered, speaker => speaker.Name),
            NormalizedName = NormalizeName(canonical.Name),
            SessionizeId = FirstValue(ordered, speaker => speaker.SessionizeId),
            ProfileImageUrl = FirstValue(ordered, speaker => speaker.ProfileImageUrl),
            Description = FirstValue(ordered, speaker => speaker.Description),
            Email = FirstValue(ordered, speaker => speaker.Email),
            AccountIssuer = canonical.AccountIssuer,
            AccountSubject = canonical.AccountSubject,
            IsActive = ordered.Any(speaker => speaker.IsActive)
        };
    }

    public static WorkshopSpeaker ApplySessionize(
        WorkshopSpeaker existing,
        WorkshopSpeaker imported,
        bool overwrite)
    {
        var name = overwrite ? imported.Name : existing.Name;
        return new WorkshopSpeaker
        {
            WorkshopSpeakerId = existing.WorkshopSpeakerId,
            SessionizeId = imported.SessionizeId,
            Name = name,
            NormalizedName = NormalizeName(name),
            ProfileImageUrl = overwrite ? imported.ProfileImageUrl : existing.ProfileImageUrl,
            Description = overwrite ? imported.Description : existing.Description,
            Email = existing.Email,
            AccountIssuer = existing.AccountIssuer,
            AccountSubject = existing.AccountSubject,
            IsActive = overwrite ? imported.IsActive : existing.IsActive
        };
    }

    private static int Completeness(WorkshopSpeaker speaker) =>
        Count(speaker.Name) +
        Count(speaker.ProfileImageUrl) +
        Count(speaker.Description) +
        Count(speaker.Email) +
        Count(speaker.SessionizeId);

    private static int Count(string? value) => string.IsNullOrWhiteSpace(value) ? 0 : 1;

    private static string? FirstValue(IEnumerable<WorkshopSpeaker> speakers, Func<WorkshopSpeaker, string?> select) =>
        speakers.Select(select).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
}
