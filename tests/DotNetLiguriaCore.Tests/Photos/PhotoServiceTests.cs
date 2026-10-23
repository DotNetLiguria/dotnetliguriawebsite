using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Photos;
using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Tests.Privacy;
using DotNetLiguriaCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using SkiaSharp;
using Xunit;

namespace DotNetLiguriaCore.Tests.Photos;

public sealed class PhotoServiceTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "dnl-photo-test-" + Guid.NewGuid().ToString("N"));
    private readonly string _contentsRoot;
    private readonly FakePhotoStore _store = new();
    private readonly PhotoStorage _storage;
    private readonly PhotoService _service;
    private readonly PhotoLifecycle _lifecycle;
    private readonly AccountReference _account = new("https://identity.example/realms/community", "test-subject");
    private readonly HashSet<string> _permissions = ["board.read", "speakers.read"];
    private readonly CancellationToken _token = TestContext.Current.CancellationToken;

    public PhotoServiceTests()
    {
        BsonCompatibility.Configure();
        var environment = new PrivacyTestEnvironment(Path.Combine(_root, "website"));
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Storage:ContentsRoot"] = Path.Combine(_root, "website", ".persisted", "contents"),
            ["Storage:DataRoot"] = Path.Combine(_root, "website", ".persisted", "data"),
        }).Build();
        var storagePaths = new WebsiteStoragePaths(configuration, environment);
        _contentsRoot = storagePaths.ContentsRoot;
        _storage = new(Options.Create(new PhotoOptions { Enabled = true, Root = Path.Combine(_root, "media") }),
            environment, storagePaths);
        _service = new(_store, _storage);
        _lifecycle = new(_store, _storage, _service);
    }
    private PhotoTarget Account => MongoPhotoStore.AccountTarget(_account);
    private PhotoTarget Add(string scope, bool published = true, AccountReference? account = null)
    {
        var target = new PhotoTarget($"{scope}:{Guid.NewGuid():D}", scope, null, published, account ?? _account);
        _store.Targets.Add(target.Key, target);
        return target;
    }
    private async Task Upload(PhotoTarget target, string version = "legacy") =>
        await _service.UploadAsync(target, version, Image(SKEncodedImageFormat.Png), PhotoCrop.Center, _token);

    [Fact]
    public async Task Account_follow_changes_but_fixed_copy_remains_independent()
    {
        var board = Add("board");
        var speaker = Add("speaker");
        await Upload(Account);
        await _service.ChangeAsync(board, new("legacy", "account"), _permissions, _token);
        await _service.ChangeAsync(speaker, new("legacy", "existing", Account.Key), _permissions, _token);
        var original = (await _service.ResolveAsync(speaker, _token)).AssetId;
        await Upload(Account, _store.Selections[Account.Key].Version);
        Assert.NotEqual(original, (await _service.ResolveAsync(board, _token)).AssetId);
        Assert.Equal(original, (await _service.ResolveAsync(speaker, _token)).AssetId);
        Assert.Equal(2, _store.Assets.Count);
    }

    [Theory]
    [InlineData("account", "board")]
    [InlineData("account", "speaker")]
    [InlineData("speaker", "board")]
    [InlineData("speaker", "speaker")]
    [InlineData("board", "board")]
    public async Task Every_photo_editor_can_reuse_matching_unlinked_editorial_photos(string scope, string sourceScope)
    {
        var target = (scope == "account" ? Account : Add(scope) with { Account = null })
            with { Name = "Ada Lovelace", Email = "ada@example.test" };
        var source = Add(sourceScope, published: false) with { Name = "Grace Lovelace", Account = null };
        _store.Targets[source.Key] = source;
        await Upload(source);
        HashSet<string> permissions = ["board.read", "speakers.read", "board.manage", "speakers.manage"];
        var candidate = Assert.Single((await _service.StatusAsync(target, permissions, _token)).Candidates);
        Assert.Equal(source.Key, candidate.Key);
        Assert.Equal(source, await _service.PreviewTargetAsync(target, source.Key, permissions, _token));
        await _service.ChangeAsync(target, new("legacy", "existing", source.Key, ExistingVersion: candidate.Version), permissions, _token);
        var copy = await _service.ResolveAsync(target, _token);
        Assert.Equal((await _service.ResolveAsync(source, _token)).AssetId, copy.AssetId);
        await Upload(source, _store.Selections[source.Key].Version);
        Assert.Equal(copy, await _service.ResolveAsync(target, _token));
    }

    [Theory]
    [InlineData("board", "")]
    [InlineData("speaker", "")]
    [InlineData("board", "events.past.manage")]
    [InlineData("speaker", "events.past.manage")]
    [InlineData("board", "events.read")]
    [InlineData("speaker", "events.read")]
    [InlineData("board", "speakers.read")]
    [InlineData("speaker", "board.read")]
    public async Task Personal_editor_requires_dashboard_and_source_read_for_linked_public_photos(string sourceScope, string permission)
    {
        var target = Account with { Name = "Ada Lovelace" };
        var source = Add(sourceScope) with { Name = "Ada Lovelace" };
        _store.Targets[source.Key] = source;
        await Upload(source);
        HashSet<string> permissions = string.IsNullOrEmpty(permission) ? [] : [permission];
        Assert.Empty((await _service.StatusAsync(target, permissions, _token)).Candidates);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.PreviewTargetAsync(target, source.Key, permissions, _token));
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.ChangeAsync(target, new("legacy", "existing", source.Key), permissions, _token));
        Assert.False(_store.Selections.ContainsKey(target.Key));
    }

    [Theory]
    [InlineData("board")]
    [InlineData("speaker")]
    public async Task Personal_editor_read_permission_suffices_without_editorial_manage(string sourceScope)
    {
        var target = Account with { Name = "Ada Lovelace" };
        var source = Add(sourceScope) with { Name = "Ada Lovelace", Account = null };
        _store.Targets[source.Key] = source;
        await Upload(source);
        HashSet<string> permissions = [sourceScope == "board" ? "board.read" : "speakers.read"];
        var candidate = Assert.Single((await _service.StatusAsync(target, permissions, _token)).Candidates);
        await _service.ChangeAsync(target, new("legacy", "existing", source.Key, ExistingVersion: candidate.Version), permissions, _token);
        Assert.Equal((await _service.ResolveAsync(source, _token)).AssetId, (await _service.ResolveAsync(target, _token)).AssetId);
    }

    [Theory]
    [InlineData("board")]
    [InlineData("speaker")]
    public async Task Personal_editor_does_not_suggest_unlinked_first_name_only_matches(string sourceScope)
    {
        var target = Account with { Name = "Ada Lovelace", Email = "ada@example.test" };
        var source = Add(sourceScope) with { Name = "Ada Byron", Email = "other@example.test", Account = null };
        _store.Targets[source.Key] = source;
        await Upload(source);
        Assert.Empty((await _service.StatusAsync(target, _permissions, _token)).Candidates);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.ChangeAsync(target, new("legacy", "existing", source.Key), _permissions, _token));
    }

    [Fact]
    public async Task Role_upload_changes_neither_other_role_nor_account()
    {
        var board = Add("board");
        var speaker = Add("speaker");
        await Upload(Account);
        await Upload(board);
        await Upload(speaker);
        Assert.Equal(3, _store.Selections.Values.Select(x => x.AssetId).Distinct().Count());
    }

    [Fact]
    public async Task Account_removal_requires_confirmation_and_only_unpublishes_followers()
    {
        var board = Add("board");
        var independentBoard = Add("board");
        await Upload(Account);
        await _service.ChangeAsync(board, new("legacy", "account"), _permissions, _token);
        await _service.ChangeAsync(independentBoard, new("legacy", "existing", Account.Key), _permissions, _token);
        var version = _store.Selections[Account.Key].Version;
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.ChangeAsync(Account, new(version, "none"), _permissions, _token));
        Assert.Equal("confirm_board_unpublication", error.Code);
        Assert.True(_store.Targets[board.Key].IsPublic);
        await _service.ChangeAsync(Account, new(version, "none", ConfirmUnpublish: true), _permissions, _token);
        Assert.False(_store.Targets[board.Key].IsPublic);
        Assert.True(_store.Targets[independentBoard.Key].IsPublic);
        Assert.NotNull((await _service.ResolveAsync(independentBoard, _token)).Url);
    }

    [Fact]
    public async Task Removal_suppresses_legacy_image_without_resurrection()
    {
        var speaker = Add("speaker") with { LegacyUrl = "speakers/legacy.jpg" };
        await _service.ChangeAsync(speaker, new("legacy", "none"), _permissions, _token);
        var result = await _service.ResolveAsync(speaker, _token);
        Assert.True(result.Managed);
        Assert.Null(result.Url);
    }

    [Fact]
    public async Task Unlinked_speaker_can_upload_without_email_or_account()
    {
        var target = Add("speaker") with { Account = null };
        await Upload(target);
        Assert.NotNull((await _service.ResolveAsync(target, _token)).Url);
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.ChangeAsync(target, new(_store.Selections[target.Key].Version, "account"), _permissions, _token));
        Assert.Equal("account_photo_required", error.Code);
    }

    [Fact]
    public async Task Stale_version_cannot_replace_or_remove_new_image()
    {
        var target = Add("speaker");
        await Upload(target);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => Upload(target));
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.ChangeAsync(target, new("legacy", "none"), _permissions, _token));
        Assert.Single(_store.Assets);
    }

    [Fact]
    public async Task Cannot_reuse_another_accounts_private_or_public_photo()
    {
        var own = Add("speaker");
        var other = Add("board", account: new(_account.Issuer, "other"));
        await Upload(other);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.ChangeAsync(own, new("legacy", "existing", other.Key), _permissions, _token));
    }

    [Fact]
    public async Task Board_editor_can_preview_and_copy_unlinked_speaker_photo_without_changing_source()
    {
        var board = Add("board") with { Name = "Ada Lovelace", Account = null };
        var speaker = Add("speaker", published: false) with { Name = "Ada Lovelace", Account = null };
        _store.Targets[speaker.Key] = speaker;
        await Upload(speaker);
        HashSet<string> permissions = ["board.manage", "speakers.read"];
        var candidate = Assert.Single((await _service.StatusAsync(board, permissions, _token)).Candidates);
        Assert.Equal(speaker.Key, candidate.Key);
        Assert.Equal(speaker, await _service.PreviewTargetAsync(board, candidate.Key, permissions, _token));
        Assert.NotEmpty((await _service.ReadAsync(speaker, 128, _token))!);
        await _service.ChangeAsync(board, new("legacy", "existing", candidate.Key, ExistingVersion: candidate.Version), permissions, _token);
        var original = await _service.ResolveAsync(board, _token);
        Assert.Equal((await _service.ResolveAsync(speaker, _token)).AssetId, original.AssetId);
        await Upload(speaker, _store.Selections[speaker.Key].Version);
        Assert.Equal(original, await _service.ResolveAsync(board, _token));
        Assert.Null(_store.Targets[speaker.Key].Account);
    }

    [Theory]
    [InlineData("board.manage")]
    [InlineData("speakers.read")]
    public async Task Unlinked_matching_speaker_photos_require_both_board_management_and_speaker_read(string permission)
    {
        var board = Add("board") with { Name = "Ada Lovelace", Account = null };
        var speaker = Add("speaker", published: false, account: new(_account.Issuer, "other")) with { Name = "Ada Lovelace" };
        _store.Targets[speaker.Key] = speaker;
        await Upload(speaker);
        HashSet<string> permissions = [permission];
        Assert.Empty((await _service.StatusAsync(board, permissions, _token)).Candidates);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.PreviewTargetAsync(board, speaker.Key, permissions, _token));
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.ChangeAsync(board, new("legacy", "existing", speaker.Key), permissions, _token));
    }

    [Fact]
    public async Task Speaker_candidates_include_shipped_fallback_but_never_restore_removed_photos()
    {
        var board = Add("board") with { Name = "Ada Lovelace", Account = null };
        var speaker = Add("speaker") with { Name = "Adà Lovelace", LegacyUrl = "/Uploads/old.jpg", Account = null };
        _store.Targets[speaker.Key] = speaker;
        var folder = Path.Combine(_contentsRoot, "speakers");
        Directory.CreateDirectory(folder);
        await File.WriteAllBytesAsync(Path.Combine(folder, "ada_lovelace.jpg"), Image(SKEncodedImageFormat.Jpeg), _token);
        HashSet<string> permissions = ["board.manage", "speakers.read"];
        var candidate = Assert.Single((await _service.StatusAsync(board, permissions, _token)).Candidates);
        Assert.StartsWith("/Contents/speakers/ada_lovelace.jpg?v=", candidate.Url);
        await _service.ChangeAsync(board, new("legacy", "existing", candidate.Key, ExistingVersion: candidate.Version), permissions, _token);
        Assert.Equal("/Contents/speakers/ada_lovelace.jpg", (await _service.ResolveAsync(board, _token)).Url);
        await _service.ChangeAsync(speaker, new("legacy", "none"), permissions, _token);
        Assert.Empty((await _service.StatusAsync(board, permissions, _token)).Candidates);
    }

    [Theory]
    [InlineData("ada-lovelace.png")]
    [InlineData("ada_lovelace.jpg")]
    public async Task Missing_legacy_speaker_url_prefers_existing_profile_portrait_over_older_speaker_fallback(string profileFile)
    {
        var board = Add("board") with { Name = "Ada Lovelace", Account = null };
        var speaker = Add("speaker") with { Name = "Adà Lovelace", LegacyUrl = "/Uploads/missing.jpg", Account = null };
        _store.Targets[speaker.Key] = speaker;
        var contents = _contentsRoot;
        Directory.CreateDirectory(Path.Combine(contents, "profile"));
        Directory.CreateDirectory(Path.Combine(contents, "speakers"));
        await File.WriteAllBytesAsync(Path.Combine(contents, "profile", profileFile), Image(SKEncodedImageFormat.Png), _token);
        await File.WriteAllBytesAsync(Path.Combine(contents, "speakers", "ada_lovelace.jpg"), Image(SKEncodedImageFormat.Jpeg), _token);
        HashSet<string> permissions = ["board.manage", "speakers.read"];
        var expected = $"/Contents/profile/{profileFile}";
        Assert.Equal(expected, (await _service.ResolveAsync(speaker, _token)).Url);
        var candidate = Assert.Single((await _service.StatusAsync(board, permissions, _token)).Candidates);
        Assert.StartsWith(expected + "?v=", candidate.Url);
        await _service.ChangeAsync(board, new("legacy", "existing", candidate.Key, ExistingVersion: candidate.Version), permissions, _token);
        Assert.Equal(expected, (await _service.ResolveAsync(board, _token)).Url);
        // Explicitly stored, usable images keep their original meaning.
        Assert.Equal("/Contents/speakers/ada_lovelace.jpg",
            (await _service.ResolveAsync(speaker with { LegacyUrl = "/Contents/speakers/ada_lovelace.jpg" }, _token)).Url);
        await _service.ChangeAsync(speaker, new("legacy", "none"), permissions, _token);
        Assert.Null((await _service.ResolveAsync(speaker, _token)).Url);
        Assert.Empty((await _service.StatusAsync(board, permissions, _token)).Candidates);
    }

    [Fact]
    public async Task Correcting_local_portrait_bytes_invalidates_proposed_preview_and_source_version()
    {
        const string url = "/Contents/speakers/fixture_person.jpg";
        var board = Add("board") with { Name = "Fixture Person", LegacyUrl = url, Account = null };
        var speaker = Add("speaker") with { Name = "Fixture Person", LegacyUrl = url, Account = null };
        _store.Targets[speaker.Key] = speaker;
        var folder = Path.Combine(_contentsRoot, "speakers");
        Directory.CreateDirectory(folder);
        var path = Path.Combine(folder, "fixture_person.jpg");
        var original = Image(SKEncodedImageFormat.Jpeg);
        await File.WriteAllBytesAsync(path, original, _token);
        HashSet<string> permissions = ["board.manage", "speakers.read"];
        var first = await _service.StatusAsync(board, permissions, _token);
        var firstCandidate = Assert.Single(first.Candidates);
        Assert.Equal(url + "?v=" + PhotoStorage.Hash(original), firstCandidate.Url);
        Assert.Equal(firstCandidate.Url, first.Url);

        var replacement = Image(SKEncodedImageFormat.Png);
        await File.WriteAllBytesAsync(path, replacement, _token);
        var second = await _service.StatusAsync(board, permissions, _token);
        var secondCandidate = Assert.Single(second.Candidates);
        Assert.Equal(url + "?v=" + PhotoStorage.Hash(replacement), secondCandidate.Url);
        Assert.NotEqual(firstCandidate.Url, secondCandidate.Url);
        Assert.NotEqual(firstCandidate.Version, secondCandidate.Version);
        var conflict = await Assert.ThrowsAsync<PrivacyBlockedException>(() => _service.ChangeAsync(board,
            new("legacy", "existing", speaker.Key, ExistingVersion: firstCandidate.Version), permissions, _token));
        Assert.Equal("photo_changed_reload", conflict.Code);
        await _service.ChangeAsync(board, new("legacy", "existing", speaker.Key, ExistingVersion: secondCandidate.Version), permissions, _token);
        Assert.Equal(url, _store.Selections[board.Key].LegacyUrl);
        Assert.Equal(url, (await _service.ResolveAsync(board, _token)).Url);
    }

    [Fact]
    public void Local_preview_versioning_leaves_external_missing_and_managed_urls_unchanged()
    {
        Assert.Null(_storage.VersionedLegacyUrl(null));
        Assert.Equal("https://images.example/portrait.jpg", _storage.VersionedLegacyUrl("https://images.example/portrait.jpg"));
        Assert.Equal("/api/media/photos/photo/512", _storage.VersionedLegacyUrl("/api/media/photos/photo/512"));
        Assert.Equal("profile/missing.jpg", _storage.VersionedLegacyUrl("profile/missing.jpg"));
    }

    [Fact]
    public async Task Related_speaker_appears_only_once_in_board_candidates()
    {
        var board = Add("board") with { Name = "Ada Lovelace" };
        var speaker = Add("speaker") with { Name = "Ada Lovelace" };
        _store.Targets[speaker.Key] = speaker;
        await Upload(speaker);
        HashSet<string> permissions = ["board.manage", "speakers.read"];
        Assert.Single((await _service.StatusAsync(board, permissions, _token)).Candidates, x => x.Key == speaker.Key);
    }

    [Theory]
    [InlineData("Ada Lovelace", "ada@example.test", "Different Person", " ADA@EXAMPLE.TEST ", true)]
    [InlineData(" Ada  Lovelace ", null, "ADÀ LOVELACE", null, true)]
    [InlineData("Ada Lovelace", "old@example.test", "Ada Lovelace", "new@example.test", true)]
    [InlineData("Ada Lovelace", "ada@example.test", "Ada Byron", "other@example.test", false)]
    [InlineData("Ada Lovelace", null, "Grace Lovelace", null, true)]
    [InlineData("Ada  Lovelace ", null, " Grace LOVELÀCE ", null, true)]
    [InlineData("Ada Mary Lovelace", null, "Grace Lovelace", null, true)]
    [InlineData("Ada Lovelace", "", "Grace Hopper", "", false)]
    [InlineData("", " ", "", " ", false)]
    [InlineData("Ada", null, "Ada", null, false)]
    [InlineData("Ada", null, "Ada Lovelace", null, false)]
    [InlineData("Ada Lovelace", null, "Ada", null, false)]
    public async Task Board_speaker_candidates_require_same_email_or_surname(
        string boardName, string? boardEmail, string speakerName, string? speakerEmail, bool expected)
    {
        var board = Add("board") with { Name = boardName, Email = boardEmail, Account = null };
        var speaker = Add("speaker") with
        {
            Name = speakerName, Email = speakerEmail, LegacyUrl = "https://images.example/speaker.jpg", Account = null
        };
        _store.Targets[speaker.Key] = speaker;
        HashSet<string> permissions = ["board.manage", "speakers.read"];
        var status = await _service.StatusAsync(board, permissions, _token);
        Assert.Equal(expected, status.Candidates.Any(x => x.Key == speaker.Key));
        if (expected)
        {
            var candidate = Assert.Single(status.Candidates);
            Assert.Equal(speaker, await _service.PreviewTargetAsync(board, candidate.Key, permissions, _token));
            await _service.ChangeAsync(board, new("legacy", "existing", candidate.Key, ExistingVersion: candidate.Version), permissions, _token);
            Assert.Equal(speaker.LegacyUrl, (await _service.ResolveAsync(board, _token)).Url);
        }
        else
        {
            await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
                _service.PreviewTargetAsync(board, speaker.Key, permissions, _token));
            var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
                _service.ChangeAsync(board, new("legacy", "existing", speaker.Key), permissions, _token));
            Assert.Equal("photo_source_unavailable", error.Code);
            Assert.False(_store.Selections.ContainsKey(board.Key));
        }
    }

    [Fact]
    public async Task Shared_account_does_not_offer_a_speaker_with_nonmatching_name_and_email()
    {
        var board = Add("board") with { Name = "Ada Lovelace", Email = "ada@example.test" };
        var speaker = Add("speaker") with { Name = "Grace Hopper", Email = "grace@example.test" };
        _store.Targets[speaker.Key] = speaker;
        await Upload(speaker);
        HashSet<string> permissions = ["board.manage", "speakers.read"];
        Assert.Empty((await _service.StatusAsync(board, permissions, _token)).Candidates);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.ChangeAsync(board, new("legacy", "existing", speaker.Key), permissions, _token));
    }

    [Theory]
    [InlineData("board", "board")]
    [InlineData("board", "speaker")]
    [InlineData("speaker", "board")]
    [InlineData("speaker", "speaker")]
    [InlineData("account", "board")]
    [InlineData("account", "speaker")]
    public async Task Shared_account_never_bypasses_email_or_surname_matching(string scope, string sourceScope)
    {
        var target = (scope == "account" ? Account : Add(scope)) with
        {
            Name = "Ada Lovelace", Email = "ada@example.test"
        };
        var source = Add(sourceScope) with { Name = "Grace Hopper", Email = "grace@example.test" };
        _store.Targets[source.Key] = source;
        await Upload(source);
        HashSet<string> permissions = ["board.read", "speakers.read", "board.manage", "speakers.manage"];
        Assert.Empty((await _service.StatusAsync(target, permissions, _token)).Candidates);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.PreviewTargetAsync(target, source.Key, permissions, _token));
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.ChangeAsync(target, new("legacy", "existing", source.Key), permissions, _token));
        Assert.Equal("photo_source_unavailable", error.Code);
        Assert.False(_store.Selections.ContainsKey(target.Key));
    }

    [Theory]
    [InlineData("Grace Lovelace", "other@example.test")]
    [InlineData("Grace Hopper", " ADA@EXAMPLE.TEST ")]
    public async Task Shared_account_board_candidates_still_allow_matching_surname_or_email(string sourceName, string sourceEmail)
    {
        var target = Add("board") with { Name = "Ada Lovelace", Email = "ada@example.test" };
        var source = Add("board") with { Name = sourceName, Email = sourceEmail };
        _store.Targets[source.Key] = source;
        await Upload(source);
        HashSet<string> permissions = ["board.read", "board.manage"];
        var candidate = Assert.Single((await _service.StatusAsync(target, permissions, _token)).Candidates);
        Assert.Equal(source.Key, candidate.Key);
        Assert.Equal(source, await _service.PreviewTargetAsync(target, source.Key, permissions, _token));
        await _service.ChangeAsync(target, new("legacy", "existing", source.Key, ExistingVersion: candidate.Version), permissions, _token);
        Assert.Equal((await _service.ResolveAsync(source, _token)).AssetId, (await _service.ResolveAsync(target, _token)).AssetId);
    }

    [Fact]
    public async Task Candidate_matching_is_rechecked_for_preview_and_copy_after_speaker_identity_changes()
    {
        var board = Add("board") with { Name = "Ada Lovelace", Account = null };
        var speaker = Add("speaker") with { Name = "Ada Lovelace", Account = null };
        _store.Targets[speaker.Key] = speaker;
        await Upload(speaker);
        HashSet<string> permissions = ["board.manage", "speakers.read"];
        var candidate = Assert.Single((await _service.StatusAsync(board, permissions, _token)).Candidates);
        _store.Targets[speaker.Key] = speaker with { Name = "Grace Hopper" };
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.PreviewTargetAsync(board, speaker.Key, permissions, _token));
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            _service.ChangeAsync(board, new("legacy", "existing", speaker.Key, ExistingVersion: candidate.Version), permissions, _token));
        Assert.False(_store.Selections.ContainsKey(board.Key));
    }

    [Fact]
    public async Task Attendee_only_photo_is_private_until_public_role_selects_it()
    {
        await Upload(Account);
        var id = _store.Selections[Account.Key].AssetId!.Value;
        Assert.Null(await _service.ReadPublicAsync(id, 128, _token));
        var speaker = Add("speaker");
        await _service.ChangeAsync(speaker, new("legacy", "account"), _permissions, _token);
        Assert.NotEmpty((await _service.ReadPublicAsync(id, 128, _token))!);
        await _service.ChangeAsync(speaker, new(_store.Selections[speaker.Key].Version, "none"), _permissions, _token);
        Assert.Null(await _service.ReadPublicAsync(id, 128, _token));
    }

    [Fact]
    public async Task Publication_requires_photo_but_legacy_published_profile_is_grandfathered()
    {
        var board = new Board { BoardId = Guid.NewGuid(), IsActive = true };
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => _service.ValidateBoardPublicationAsync(board, null, _token));
        await _service.ValidateBoardPublicationAsync(board, new Board { IsActive = true }, _token);
        board.IsActive = false;
        await _service.ValidateBoardPublicationAsync(board, null, _token);
    }

    [Fact]
    public async Task Erasure_removes_shared_copies_files_and_account_identifiers()
    {
        var speaker = Add("speaker");
        var board = Add("board");
        await Upload(Account);
        await _service.ChangeAsync(board, new("legacy", "account"), _permissions, _token);
        await _service.ChangeAsync(speaker, new("legacy", "existing", Account.Key), _permissions, _token);
        var id = _store.Assets.Keys.Single();
        var interrupted = _storage.PathFor(id, 128) + "." + Guid.NewGuid().ToString("N") + ".pending";
        await File.WriteAllBytesAsync(interrupted, [1, 2, 3], _token);
        await _lifecycle.EraseAsync(_account, _token);
        Assert.Empty(_store.Assets);
        Assert.False(File.Exists(_storage.PathFor(id, 128)));
        Assert.False(File.Exists(interrupted));
        Assert.False(_store.Selections.ContainsKey(Account.Key));
        Assert.False(_store.Targets[board.Key].IsPublic);
        Assert.Null((await _service.ResolveAsync(speaker, _token)).Url);
        await _lifecycle.EraseAsync(_account, _token);
    }

    [Fact]
    public async Task Cleanup_preserves_fixed_copies_after_account_replacement()
    {
        var speaker = Add("speaker");
        await Upload(Account);
        var original = _store.Assets.Keys.Single();
        await _service.ChangeAsync(speaker, new("legacy", "existing", Account.Key), _permissions, _token);
        await Upload(Account, _store.Selections[Account.Key].Version);
        await _lifecycle.CleanupUnreferencedAsync(_token);
        Assert.Contains(original, _store.Assets.Keys);
    }

    [Fact]
    public async Task Export_contains_normalized_owned_bytes_and_selection()
    {
        await Upload(Account);
        var export = await _lifecycle.ExportAsync(_account, _token);
        Assert.Contains(export, x => x["kind"] == "photo-selection");
        var image = Assert.Single(export, x => x["kind"] == "profile-photo")["document"].AsBsonDocument;
        using var bitmap = SKBitmap.Decode(Convert.FromBase64String(image["512"].AsString));
        Assert.Equal(512, bitmap.Width);
    }

    [Theory]
    [InlineData(SKEncodedImageFormat.Png)]
    [InlineData(SKEncodedImageFormat.Jpeg)]
    [InlineData(SKEncodedImageFormat.Webp)]
    public void Accepted_formats_are_decoded_cropped_and_reencoded(SKEncodedImageFormat format)
    {
        var output = PhotoImageProcessor.Process(Image(format), new(.1f, .9f, .5f));
        Assert.Equal(new[] { 128, 512 }, output.Keys);
        foreach (var size in output.Keys)
        {
            using var codec = SKCodec.Create(new SKMemoryStream(output[size]));
            Assert.Equal(SKEncodedImageFormat.Webp, codec.EncodedFormat);
            Assert.Equal(size, codec.Info.Width);
            Assert.Equal(size, codec.Info.Height);
        }
    }

    [Fact]
    public void Invalid_uploads_and_crop_are_rejected_before_storage()
    {
        foreach (var bytes in new[] { Array.Empty<byte>(), new byte[PhotoImageProcessor.MaximumBytes + 1], "<svg/>"u8.ToArray(), Image(SKEncodedImageFormat.Png)[..30] })
            Assert.Throws<PrivacyBlockedException>(() => PhotoImageProcessor.Process(bytes, PhotoCrop.Center));
        Assert.Throws<PrivacyBlockedException>(() => PhotoImageProcessor.Process(Image(SKEncodedImageFormat.Png), new(float.NaN, .5f, 1)));
        Assert.Throws<PrivacyBlockedException>(() => PhotoImageProcessor.Process(Image(SKEncodedImageFormat.Png), new(.5f, .5f, 0)));
    }

    [Fact]
    public async Task Corrupt_media_never_serves_as_successful_image()
    {
        await Upload(Account);
        var asset = _store.Assets.Values.Single();
        await File.WriteAllBytesAsync(_storage.PathFor(asset.Id, 128), [1, 2, 3], _token);
        await Assert.ThrowsAsync<InvalidDataException>(() => _service.ReadAsync(Account, 128, _token));
    }

    [Fact]
    public async Task Snapshots_validate_photo_hashes_and_require_referenced_files()
    {
        BsonCompatibility.Configure();
        await Upload(Account);
        var snapshot = Path.Combine(_root, "snapshot");
        Directory.CreateDirectory(snapshot);
        var photos = new PhotoSnapshotService(_store, _storage, _lifecycle);
        var manifest = new BsonDocument
        {
            { "photos", await photos.CaptureAsync(snapshot, _token) },
            { "collections", new BsonArray
                {
                    new BsonDocument { { "name", MongoPhotoStore.AssetCollection }, { "file", "assets.jsonl" } },
                    new BsonDocument { { "name", MongoPhotoStore.SelectionCollection }, { "file", "selections.jsonl" } }
                }
            }
        };
        await File.WriteAllLinesAsync(Path.Combine(snapshot, "assets.jsonl"), _store.Assets.Values.Select(x => x.ToJson()), _token);
        await File.WriteAllLinesAsync(Path.Combine(snapshot, "selections.jsonl"), _store.Selections.Values.Select(x => x.ToJson()), _token);
        await PhotoSnapshotService.ValidateAsync(snapshot, manifest, _token);
        var filename = manifest["photos"].AsBsonArray[0]["file"].AsString;
        await File.WriteAllBytesAsync(Path.Combine(snapshot, filename), [0], _token);
        await Assert.ThrowsAsync<InvalidDataException>(() => PhotoSnapshotService.ValidateAsync(snapshot, manifest, _token));
        manifest.Remove("photos");
        await Assert.ThrowsAsync<InvalidDataException>(() => PhotoSnapshotService.ValidateAsync(snapshot, manifest, _token));
    }

    [Fact]
    public async Task Malformed_or_missing_media_references_are_explicit_failures_not_empty_success()
    {
        _store.Selections[Account.Key] = new PhotoSelection { Key = Account.Key, Source = "account" };
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => _service.ResolveAsync(Account, _token));
        _store.Selections[Account.Key] = new PhotoSelection { Key = Account.Key, Source = "asset", AssetId = Guid.NewGuid() };
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() => _service.ResolveAsync(Account, _token));
        Assert.Equal("photo_missing", error.Code);
    }

    [Fact]
    public async Task Deleted_managed_speaker_does_not_restore_snapshot_legacy_image()
    {
        var speaker = Add("speaker");
        await Upload(speaker);
        await _service.RemoveProfileAsync(speaker.Key, _token);
        _store.Targets.Remove(speaker.Key);
        var snapshot = new WorkshopTalkSpeaker
        {
            WorkshopSpeakerId = Guid.Parse(speaker.Key[8..]),
            ImageUrl = "speakers/historical.jpg", Name = "Historical name", Biography = "Historical biography"
        };
        await _service.ApplySnapshotAsync(snapshot, _token);
        Assert.Null(snapshot.ImageUrl);
        Assert.True(snapshot.PhotoFallbackDisabled);
        Assert.Equal("Historical name", snapshot.Name);
        Assert.Equal("Historical biography", snapshot.Biography);
    }

    [Fact]
    public async Task Changed_candidate_version_rejects_copy_of_an_unseen_replacement()
    {
        var speaker = Add("speaker");
        await Upload(Account);
        var version = _store.Selections[Account.Key].Version;
        await Upload(Account, version);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => _service.ChangeAsync(speaker,
            new("legacy", "existing", Account.Key, ExistingVersion: version), _permissions, _token));
        Assert.False(_store.Selections.ContainsKey(speaker.Key));
    }

    [Fact]
    public async Task Candidate_version_includes_the_followed_account_photo_version()
    {
        var speaker = Add("speaker") with { Name = "Ada Lovelace" };
        var board = Add("board") with { Name = "Ada Lovelace" };
        _store.Targets[board.Key] = board;
        await Upload(Account);
        await _service.ChangeAsync(board, new("legacy", "account"), _permissions, _token);
        var candidate = Assert.Single((await _service.StatusAsync(speaker, _permissions, _token)).Candidates, x => x.Key == board.Key);
        await Upload(Account, _store.Selections[Account.Key].Version);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => _service.ChangeAsync(speaker,
            new("legacy", "existing", board.Key, ExistingVersion: candidate.Version), _permissions, _token));
    }

    [Fact]
    public async Task Audit_intent_failure_blocks_mutation_and_failed_mutations_remain_unverified()
    {
        var audit = new PhotoTestAuditStore { FailIntent = true };
        var service = new PhotoMutationAudit(audit, TimeProvider.System);
        var changes = 0;
        await Assert.ThrowsAsync<IOException>(() => service.RunAsync(_account, Account, "upload",
            () => { changes++; return Task.CompletedTask; }, _token));
        Assert.Equal(0, changes);
        audit.FailIntent = false;
        await Assert.ThrowsAsync<IOException>(() => service.RunAsync(_account, Account, "upload",
            () => throw new IOException("Synthetic media failure."), _token));
        Assert.Equal(new[] { "intent", "unverified" }, audit.Entries.Select(x => x.Outcome));
    }

    [Fact]
    public void Sessionize_preserves_private_account_link_and_different_linked_speakers_cannot_merge()
    {
        var original = new WorkshopSpeaker { WorkshopSpeakerId = Guid.NewGuid(), Name = "Test person", AccountIssuer = _account.Issuer, AccountSubject = _account.Subject };
        var imported = SpeakerIdentity.ApplySessionize(original, new WorkshopSpeaker { Name = "Imported name" }, true);
        Assert.Equal(original.AccountIssuer, imported.AccountIssuer);
        Assert.Equal(original.AccountSubject, imported.AccountSubject);
        Assert.Throws<InvalidOperationException>(() => SpeakerIdentity.Merge([original,
            new WorkshopSpeaker { WorkshopSpeakerId = Guid.NewGuid(), Name = "Test person", AccountIssuer = _account.Issuer, AccountSubject = "another-account" }]));
    }

    [Fact]
    public void Storage_rejects_content_root_and_invalid_identifiers()
    {
        var unsafeStorage = new PhotoStorage(Options.Create(new PhotoOptions { Enabled = true, Root = Path.Combine(_root, "site", "wwwroot", "photos") }),
            new PrivacyTestEnvironment(Path.Combine(_root, "site")));
        Assert.Throws<PrivacyBlockedException>(() => unsafeStorage.PathFor(Guid.NewGuid(), 512));
        Assert.Throws<InvalidDataException>(() => PhotoStorage.FileName(Guid.Empty, 512));
        Assert.Throws<InvalidDataException>(() => PhotoStorage.FileName(Guid.NewGuid(), 640));
    }

    public static byte[] Image(SKEncodedImageFormat format)
    {
        using var bitmap = new SKBitmap(32, 48);
        using (var canvas = new SKCanvas(bitmap)) canvas.Clear(SKColors.CornflowerBlue);
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(format, 90);
        return encoded.ToArray();
    }
    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, true);
    }
}
