using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Services.Photos;

public sealed class PhotoService(IPhotoStore store, PhotoStorage storage)
{
    private readonly IPhotoStore _store = store;
    private readonly PhotoStorage _storage = storage;

    public async Task<ResolvedPhoto> ResolveAsync(PhotoTarget target, CancellationToken token)
    {
        var selection = await _store.SelectionAsync(target.Key, token);
        if (selection is null) return new(null, LegacyUrl(target), false);
        if (selection.Source == "account")
        {
            if (target.Account is null || target.Key.StartsWith("account:", StringComparison.Ordinal))
                throw new PrivacyBlockedException("invalid_photo_reference", 503);
            return (await ResolveAsync(MongoPhotoStore.AccountTarget(target.Account), token)) with { Managed = true };
        }
        if (selection.Source == "asset" && selection.AssetId is Guid id)
        {
            if (await _store.AssetAsync(id, token) is null)
                throw new PrivacyBlockedException("photo_missing", 503);
            return new(id, $"/api/media/photos/{id:D}/512", true);
        }
        if (selection.Source == "asset" && !string.IsNullOrWhiteSpace(selection.LegacyUrl))
            return new(null, selection.LegacyUrl, true);
        if (selection.Source == "none" && selection.AssetId is null && selection.LegacyUrl is null)
            return new(null, null, true);
        throw new PrivacyBlockedException("invalid_photo_reference", 503);
    }

    public async Task<PhotoStatus> StatusAsync(PhotoTarget target, IReadOnlySet<string> permissions, CancellationToken token)
    {
        var selection = await _store.SelectionAsync(target.Key, token);
        var resolved = await ResolveAsync(target, token);
        var candidates = new List<PhotoCandidate>();
        foreach (var source in await CandidatesAsync(target, permissions, token))
        {
            var photo = await ResolveAsync(source, token);
            if (photo.Url is not null)
                candidates.Add(new(source.Key, Label(source), photo.Url,
                    photo.AssetId is null ? null : $"{BasePath(target)}/image/128?existingKey={Uri.EscapeDataString(source.Key)}&v={photo.AssetId:N}",
                    await EffectiveVersionAsync(source, token)));
        }
        return new(selection?.Version ?? "legacy", selection?.Source ?? "legacy", resolved.Url,
            resolved.AssetId is null ? null : $"{BasePath(target)}/image/512?v={resolved.AssetId:N}",
            target.Account is not null, candidates, (await AffectedBoardsAsync(target, token)).Select(x => x.Name).ToArray());
    }

    public async Task ChangeAsync(PhotoTarget target, PhotoChangeRequest request, IReadOnlySet<string> permissions, CancellationToken token)
    {
        await CheckVersionAsync(target.Key, request.Version, token);
        var selection = new PhotoSelection { Key = target.Key, Source = request.Source };
        if (request.Source == "existing")
        {
            var candidate = (await CandidatesAsync(target, permissions, token))
                .SingleOrDefault(x => x.Key == request.ExistingKey)
                ?? throw new PrivacyBlockedException("photo_source_unavailable", 409);
            if (request.ExistingVersion is not null)
                if (await EffectiveVersionAsync(candidate, token) != request.ExistingVersion)
                    throw new PrivacyBlockedException("photo_changed_reload", 409);
            var resolved = await ResolveAsync(candidate, token);
            if (resolved.Url is null) throw new PrivacyBlockedException("photo_source_empty", 409);
            selection = selection with { Source = "asset", AssetId = resolved.AssetId, LegacyUrl = resolved.AssetId is null ? resolved.Url : null };
        }
        else if (request.Source == "account")
        {
            if (target.Account is null || target.Key.StartsWith("account:", StringComparison.Ordinal) ||
                (await ResolveAsync(MongoPhotoStore.AccountTarget(target.Account), token)).Url is null)
                throw new PrivacyBlockedException("account_photo_required", 409);
        }
        else if (request.Source == "none")
        {
            var boards = await AffectedBoardsAsync(target, token);
            if (boards.Count != 0 && !request.ConfirmUnpublish)
                throw new PrivacyBlockedException("confirm_board_unpublication", 409);
            foreach (var board in boards) await _store.UnpublishAsync(board.Key, token);
        }
        else throw new PrivacyBlockedException("invalid_photo_source", 400);
        await _store.SaveAsync(selection, request.Version, token);
    }

    public async Task UploadAsync(PhotoTarget target, string version, byte[] input, PhotoCrop crop, CancellationToken token)
    {
        await CheckVersionAsync(target.Key, version, token);
        if ((await _store.AssetsAsync(token)).Count >= 1000)
            throw new PrivacyBlockedException("photo_storage_limit", 413);
        var variants = PhotoImageProcessor.Process(input, crop);
        var asset = new PhotoAsset
        {
            OwnerKey = target.Key, AccountIssuer = target.Account?.Issuer, AccountSubject = target.Account?.Subject,
            SmallHash = PhotoStorage.Hash(variants[128]), LargeHash = PhotoStorage.Hash(variants[512])
        };
        // Persist ownership before files so interrupted writes remain attributable and recoverable.
        await _store.AddAssetAsync(asset, token);
        await _storage.SaveAsync(asset.Id, variants, token);
        await _store.SaveAsync(new PhotoSelection { Key = target.Key, Source = "asset", AssetId = asset.Id }, version, token);
    }

    public async Task<PhotoTarget> PreviewTargetAsync(PhotoTarget target, string? existingKey,
        IReadOnlySet<string> permissions, CancellationToken token) =>
        existingKey is null ? target : (await CandidatesAsync(target, permissions, token))
            .SingleOrDefault(x => x.Key == existingKey) ?? throw new PrivacyBlockedException("photo_source_unavailable", 404);

    public async Task<byte[]?> ReadAsync(PhotoTarget target, int size, CancellationToken token)
    {
        var photo = await ResolveAsync(target, token);
        if (photo.AssetId is not Guid id) return null;
        var asset = await _store.AssetAsync(id, token) ?? throw new PrivacyBlockedException("photo_missing", 503);
        return await _storage.ReadAsync(asset, size, token);
    }

    public async Task<byte[]?> ReadPublicAsync(Guid id, int size, CancellationToken token)
    {
        foreach (var target in await _store.PublicTargetsAsync(token))
            if ((await ResolveAsync(target, token)).AssetId == id)
                return await _storage.ReadAsync(await _store.AssetAsync(id, token)
                    ?? throw new PrivacyBlockedException("photo_missing", 503), size, token);
        return null;
    }

    public async Task ApplyAsync(Board board, CancellationToken token)
    {
        var target = new PhotoTarget(PhotoTarget.BoardKey(board.BoardId), board.Name ?? "", board.ProfileImageUrl, board.IsActive,
            Account(board.AccountIssuer, board.AccountSubject));
        var photo = await ResolveAsync(target, token);
        board.ProfileImageUrl = photo.Url;
        board.PhotoFallbackDisabled = photo.Managed;
        board.PhotoVersion = (await _store.SelectionAsync(target.Key, token))?.Version ?? "legacy";
    }
    public async Task ApplyAsync(WorkshopSpeaker speaker, CancellationToken token)
    {
        var target = new PhotoTarget(PhotoTarget.SpeakerKey(speaker.WorkshopSpeakerId), speaker.Name ?? "", speaker.ProfileImageUrl, speaker.IsActive,
            Account(speaker.AccountIssuer, speaker.AccountSubject));
        var photo = await ResolveAsync(target, token);
        speaker.ProfileImageUrl = photo.Url;
        speaker.PhotoFallbackDisabled = photo.Managed;
        speaker.PhotoVersion = (await _store.SelectionAsync(target.Key, token))?.Version ?? "legacy";
    }

    public async Task ValidateBoardPublicationAsync(Board next, Board? previous, CancellationToken token)
    {
        if (!next.IsActive || previous is { IsActive: true }) return;
        var selection = await _store.SelectionAsync(PhotoTarget.BoardKey(next.BoardId), token);
        if (selection is not null && next.PhotoVersion != selection.Version)
            throw new PrivacyBlockedException("photo_changed_reload", 409);
        var target = previous is null
            ? new PhotoTarget(PhotoTarget.BoardKey(next.BoardId), next.Name ?? "", next.ProfileImageUrl, false, null)
            : (await _store.TargetAsync(PhotoTarget.BoardKey(next.BoardId), token))!
                with { LegacyUrl = next.ProfileImageUrl };
        var photo = await ResolveAsync(target, token);
        if (string.IsNullOrWhiteSpace(photo.Url) ||
            photo.AssetId is Guid id && await _store.AssetAsync(id, token) is null)
            throw new PrivacyBlockedException("board_photo_required_to_publish", 409);
        if (photo.AssetId is not null) _ = await ReadAsync(target, 512, token);
        else if (!_storage.IsUsableLegacyUrl(photo.Url!))
            throw new PrivacyBlockedException("board_photo_required_to_publish", 409);
    }

    public async Task<bool> HasSelectionAsync(string key, CancellationToken token) =>
        await _store.SelectionAsync(key, token) is not null;

    public async Task RemoveProfileAsync(string key, CancellationToken token)
    {
        var target = await _store.TargetAsync(key, token);
        if (target?.Account is not null) await _store.AttributeAsync(key, target.Account, token);
        var selection = await _store.SelectionAsync(key, token);
        if (selection is not null)
            await _store.SaveAsync(new PhotoSelection { Key = key, Source = "none" }, selection.Version, token);
    }

    public async Task ApplySnapshotAsync(WorkshopTalkSpeaker snapshot, CancellationToken token)
    {
        if (snapshot.WorkshopSpeakerId is not Guid id) return;
        var key = PhotoTarget.SpeakerKey(id);
        var target = await _store.TargetAsync(key, token)
            ?? new PhotoTarget(key, snapshot.Name ?? "", snapshot.ImageUrl, false, null);
        var photo = await ResolveAsync(target, token);
        if (photo.Managed)
        {
            snapshot.ImageUrl = photo.Url;
            snapshot.PhotoFallbackDisabled = true;
        }
    }

    private async Task<IReadOnlyList<PhotoTarget>> CandidatesAsync(PhotoTarget target, IReadOnlySet<string> permissions, CancellationToken token)
    {
        var related = target.Account is null ? [] : await _store.RelatedAsync(target.Account, token);
        var canEnterAdmin = PermissionCatalog.CanEnterAdmin(permissions);
        var candidates = related.Where(x => x.Key.StartsWith("account:", StringComparison.Ordinal) ||
            canEnterAdmin && permissions.Contains(x.Key.StartsWith("board:", StringComparison.Ordinal) ? "board.read" : "speakers.read"));
        if (canEnterAdmin && (target.Key.StartsWith("account:", StringComparison.Ordinal) ||
            permissions.Contains(target.Key.StartsWith("board:", StringComparison.Ordinal) ? "board.manage" : "speakers.manage")))
        {
            if (permissions.Contains("speakers.read"))
                candidates = candidates.Concat((await _store.SpeakerTargetsAsync(token)).Where(x => MatchesPerson(target, x)));
            if (permissions.Contains("board.read"))
                candidates = candidates.Concat((await _store.BoardTargetsAsync(token)).Where(x => MatchesPerson(target, x)));
        }
        if (target.Key.StartsWith("board:", StringComparison.Ordinal))
            candidates = candidates.Where(x => !x.Key.StartsWith("speaker:", StringComparison.Ordinal) || MatchesPerson(target, x));
        return candidates.Where(x => x.Key != target.Key).DistinctBy(x => x.Key).ToArray();
    }
    private static bool MatchesPerson(PhotoTarget board, PhotoTarget speaker)
    {
        if (!string.IsNullOrWhiteSpace(board.Email) && !string.IsNullOrWhiteSpace(speaker.Email) &&
            string.Equals(board.Email.Trim(), speaker.Email.Trim(), StringComparison.OrdinalIgnoreCase))
            return true;
        var name = SpeakerIdentity.NormalizeName(board.Name);
        var speakerName = SpeakerIdentity.NormalizeName(speaker.Name);
        var surnameStart = name.LastIndexOf(' ');
        var speakerSurnameStart = speakerName.LastIndexOf(' ');
        return surnameStart >= 0 && speakerSurnameStart >= 0 &&
            name[(surnameStart + 1)..] == speakerName[(speakerSurnameStart + 1)..];
    }

    private string? LegacyUrl(PhotoTarget target)
    {
        if (!target.Key.StartsWith("speaker:", StringComparison.Ordinal)) return target.LegacyUrl;
        if (!string.IsNullOrWhiteSpace(target.LegacyUrl) && _storage.IsUsableLegacyUrl(target.LegacyUrl))
            return target.LegacyUrl;
        return _storage.ShippedSpeakerUrl(target.Name);
    }
    private async Task<IReadOnlyList<PhotoTarget>> AffectedBoardsAsync(PhotoTarget target, CancellationToken token)
    {
        if (target.Key.StartsWith("board:", StringComparison.Ordinal)) return target.IsPublic ? [target] : [];
        if (!target.Key.StartsWith("account:", StringComparison.Ordinal) || target.Account is null) return [];
        var result = new List<PhotoTarget>();
        foreach (var related in await _store.RelatedAsync(target.Account, token))
            if (related.IsPublic && related.Key.StartsWith("board:", StringComparison.Ordinal) &&
                (await _store.SelectionAsync(related.Key, token))?.Source == "account")
                result.Add(related);
        return result;
    }
    private async Task CheckVersionAsync(string key, string version, CancellationToken token)
    {
        if ((await _store.SelectionAsync(key, token))?.Version is { } actual ? actual != version : version != "legacy")
            throw new PrivacyBlockedException("photo_changed_reload", 409);
    }
    private async Task<string> EffectiveVersionAsync(PhotoTarget target, CancellationToken token)
    {
        var selection = await _store.SelectionAsync(target.Key, token);
        var version = selection?.Version ?? "legacy";
        if (selection?.Source == "account" && target.Account is not null)
            version += ":" + ((await _store.SelectionAsync(PhotoTarget.AccountKey(target.Account), token))?.Version ?? "legacy");
        return version;
    }
    private static string Label(PhotoTarget target) => target.Key.StartsWith("account:", StringComparison.Ordinal)
        ? "Foto dell'account" : (target.Key.StartsWith("board:", StringComparison.Ordinal) ? "Board: " : "Relatore: ") + target.Name;
    private static string BasePath(PhotoTarget target) => target.Key.StartsWith("account:", StringComparison.Ordinal)
        ? "/photos/account" : "/photos/" + target.Key.Replace(':', '/');
    private static AccountReference? Account(string? issuer, string? subject) =>
        issuer is not null && subject is not null ? new(issuer, subject) : null;
}
