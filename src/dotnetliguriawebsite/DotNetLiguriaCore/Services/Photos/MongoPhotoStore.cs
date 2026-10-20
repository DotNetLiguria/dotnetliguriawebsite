using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services.Photos;

public sealed class MongoPhotoStore(IOptions<DotNetLiguriaDatabaseSettings> options) : IPhotoStore
{
    public const string SelectionCollection = "ProfilePhotoSelections";
    public const string AssetCollection = "ProfilePhotoAssets";
    private readonly DotNetLiguriaDatabaseSettings _settings = options.Value;
    private readonly IMongoDatabase _database = new MongoClient(options.Value.ConnectionString)
        .GetDatabase(options.Value.DatabaseName);
    private IMongoCollection<PhotoSelection> Selections => _database.GetCollection<PhotoSelection>(SelectionCollection);
    private IMongoCollection<PhotoAsset> Assets => _database.GetCollection<PhotoAsset>(AssetCollection);
    private IMongoCollection<Board> Boards => _database.GetCollection<Board>(_settings.BoardCollectionName);
    private IMongoCollection<WorkshopSpeaker> Speakers => _database.GetCollection<WorkshopSpeaker>(_settings.SpeakerCollectionName);

    public async Task<PhotoTarget?> TargetAsync(string key, CancellationToken token)
    {
        var parts = key.Split(':');
        if (parts.Length != 2 || !Guid.TryParseExact(parts[1], "D", out var id))
            return null;
        if (parts[0] == "board")
        {
            var item = await Boards.Find(x => x.BoardId == id).FirstOrDefaultAsync(token);
            return item is null ? null : Target(item);
        }
        if (parts[0] == "speaker")
        {
            var item = await Speakers.Find(x => x.WorkshopSpeakerId == id).FirstOrDefaultAsync(token);
            return item is null ? null : Target(item);
        }
        return null;
    }

    public async Task<IReadOnlyList<PhotoTarget>> RelatedAsync(AccountReference account, CancellationToken token)
    {
        var boards = await Boards.Find(x => x.AccountIssuer == account.Issuer && x.AccountSubject == account.Subject)
            .Limit(101).ToListAsync(token);
        var speakers = await Speakers.Find(x => x.AccountIssuer == account.Issuer && x.AccountSubject == account.Subject)
            .Limit(101).ToListAsync(token);
        if (boards.Count > 100 || speakers.Count > 100)
            throw new PrivacyBlockedException("photo_profile_limit", 409);
        return new[] { AccountTarget(account) }.Concat(boards.Select(Target)).Concat(speakers.Select(Target)).ToArray();
    }

    public async Task<IReadOnlyList<PhotoTarget>> PublicTargetsAsync(CancellationToken token)
    {
        var boards = await Boards.Find(x => x.IsActive).Limit(1001).ToListAsync(token);
        var workshops = await _database.GetCollection<Workshop>(_settings.WorkshopCollectionName)
            .Find(x => x.Published == true).ReadBoundedAsync(token);
        var referenced = workshops.SelectMany(x => x.Talks ?? []).SelectMany(x => x.Speakers ?? [])
            .Where(x => x.WorkshopSpeakerId.HasValue).Select(x => x.WorkshopSpeakerId!.Value)
            .Concat(workshops.SelectMany(x => x.Tracks ?? []).SelectMany(x => x.Speakers ?? [])).Distinct().ToArray();
        var speakers = await Speakers.Find(x => x.IsActive || referenced.Contains(x.WorkshopSpeakerId)).Limit(1001).ToListAsync(token);
        if (boards.Count > 1000 || speakers.Count > 1000)
            throw new PrivacyBlockedException("photo_profile_limit", 503);
        return boards.Select(Target).Concat(speakers.Select(x => Target(x) with { IsPublic = true })).ToArray();
    }

    public async Task<IReadOnlyList<PhotoTarget>> SpeakerTargetsAsync(CancellationToken token) =>
        (await Speakers.Find(_ => true).ReadBoundedAsync(token)).Select(Target).ToArray();

    public async Task<IReadOnlyList<PhotoTarget>> BoardTargetsAsync(CancellationToken token) =>
        (await Boards.Find(_ => true).ReadBoundedAsync(token)).Select(Target).ToArray();

    public Task<PhotoSelection?> SelectionAsync(string key, CancellationToken token) =>
        Selections.Find(x => x.Key == key).FirstOrDefaultAsync(token)!;
    public async Task<IReadOnlyList<PhotoSelection>> SelectionsAsync(CancellationToken token) =>
        await Selections.Find(_ => true).ReadBoundedAsync(token);
    public async Task SaveAsync(PhotoSelection selection, string expectedVersion, CancellationToken token)
    {
        if (expectedVersion == "legacy")
        {
            try { await Selections.InsertOneAsync(selection, cancellationToken: token); }
            catch (MongoWriteException exception) when (exception.WriteError.Category == ServerErrorCategory.DuplicateKey)
            { throw new PrivacyBlockedException("photo_changed_reload", 409); }
        }
        else if ((await Selections.ReplaceOneAsync(x => x.Key == selection.Key && x.Version == expectedVersion,
            selection, cancellationToken: token)).MatchedCount != 1)
            throw new PrivacyBlockedException("photo_changed_reload", 409);
    }
    public Task AddAssetAsync(PhotoAsset asset, CancellationToken token) => Assets.InsertOneAsync(asset, cancellationToken: token);
    public Task<PhotoAsset?> AssetAsync(Guid id, CancellationToken token) => Assets.Find(x => x.Id == id).FirstOrDefaultAsync(token)!;
    public async Task<IReadOnlyList<PhotoAsset>> AssetsAsync(CancellationToken token) => await Assets.Find(_ => true).ReadBoundedAsync(token);
    public Task DeleteAssetAsync(Guid id, CancellationToken token) => Assets.DeleteOneAsync(x => x.Id == id, token);
    public Task AttributeAsync(string key, AccountReference account, CancellationToken token) =>
        Assets.UpdateManyAsync(x => x.OwnerKey == key && x.AccountIssuer == null && x.AccountSubject == null,
            Builders<PhotoAsset>.Update.Set(x => x.AccountIssuer, account.Issuer).Set(x => x.AccountSubject, account.Subject),
            cancellationToken: token);
    public Task DeleteSelectionAsync(string key, CancellationToken token) => Selections.DeleteOneAsync(x => x.Key == key, token);
    public Task UnpublishAsync(string key, CancellationToken token)
    {
        if (!key.StartsWith("board:", StringComparison.Ordinal) || !Guid.TryParse(key[6..], out var id))
            throw new PrivacyBlockedException("invalid_board_photo_target", 400);
        return Boards.UpdateOneAsync(x => x.BoardId == id, Builders<Board>.Update.Set(x => x.IsActive, false),
            cancellationToken: token);
    }
    public static PhotoTarget AccountTarget(AccountReference account) => new(PhotoTarget.AccountKey(account), "Account", null, false, account);
    private static AccountReference? Account(string? issuer, string? subject) =>
        !string.IsNullOrEmpty(issuer) && !string.IsNullOrEmpty(subject) ? new(issuer, subject) : null;
    private static PhotoTarget Target(Board item) => new(PhotoTarget.BoardKey(item.BoardId), item.Name ?? "",
        item.ProfileImageUrl, item.IsActive, Account(item.AccountIssuer, item.AccountSubject)) { Email = item.Email };
    private static PhotoTarget Target(WorkshopSpeaker item) => new(PhotoTarget.SpeakerKey(item.WorkshopSpeakerId), item.Name ?? "",
        item.ProfileImageUrl, item.IsActive, Account(item.AccountIssuer, item.AccountSubject)) { Email = item.Email };
}
