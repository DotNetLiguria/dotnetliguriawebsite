namespace DotNetLiguriaCore.Services.Photos;

public sealed record PhotoStatus(string Version, string Source, string? Url, string? PreviewPath,
    bool HasAccount, IReadOnlyList<PhotoCandidate> Candidates, IReadOnlyList<string> AffectedBoards);
