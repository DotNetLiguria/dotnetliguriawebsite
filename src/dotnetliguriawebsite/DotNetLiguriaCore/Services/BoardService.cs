using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using MongoDB.Bson;
using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Services.Photos;

namespace DotNetLiguriaCore.Services
{
    public class BoardService : IBoardAccountStore
    {
        private readonly IMongoCollection<Board> _boardCollection;
        private readonly PhotoService? _photos;
        private readonly PrivacyOperationGate _gate;

        public BoardService(IOptions<DotNetLiguriaDatabaseSettings> mongoDBDatabaseSettings,
            PhotoService? photos = null, PrivacyOperationGate? gate = null)
        {
            _photos = photos;
            _gate = gate ?? PrivacyOperationGate.Shared;
            var mongoClient = new MongoClient(mongoDBDatabaseSettings.Value.ConnectionString);
            var mongoDatabase = mongoClient.GetDatabase(mongoDBDatabaseSettings.Value.DatabaseName);

            _boardCollection = mongoDatabase.GetCollection<Board>(mongoDBDatabaseSettings.Value.BoardCollectionName);
        }

        public async Task<List<Board>> GetAsync(bool onlyActive = false)
        {
            var visibleBoards = await _boardCollection
                .Find(x => x.IsActive == true)
                .SortBy(x => x.Order)
                .ReadBoundedAsync();

            if (onlyActive)
            {
                if (_photos is not null) foreach (var board in visibleBoards) await _photos.ApplyAsync(board, default);
                return visibleBoards;
            }

            var invisibleBoards = await _boardCollection
                .Find(x => x.IsActive == false)
                .ReadBoundedAsync();

            var result = visibleBoards.Concat(invisibleBoards).ToList();
            if (_photos is not null) foreach (var board in result) await _photos.ApplyAsync(board, default);
            return result;
        }

        public async Task<Board?> GetAsync(Guid id)
        {
            var board = await _boardCollection.Find(x => x.BoardId == id).FirstOrDefaultAsync();
            if (board is not null && _photos is not null) await _photos.ApplyAsync(board, default);
            return board;
        }

        public async Task CreateAsync(Board newWorkshop)
        {
            using var lease = await _gate.EnterAsync();
            newWorkshop.AccountIssuer = null;
            newWorkshop.AccountSubject = null;
            if (_photos is not null) await _photos.ValidateBoardPublicationAsync(newWorkshop, null, default);
            await _boardCollection.InsertOneAsync(newWorkshop);
        }

        public async Task UpdateAsync(Guid id, Board updatedWorkshop)
        {
            using var lease = await _gate.EnterAsync();
            var current = await _boardCollection.Find(x => x.BoardId == id).FirstOrDefaultAsync();
            if (current is null) throw new PrivacyBlockedException("board_not_found", 404);
            if (_photos is not null)
            {
                await _photos.ValidateBoardPublicationAsync(updatedWorkshop, current, default);
                if (await _photos.HasSelectionAsync(PhotoTarget.BoardKey(id), default))
                    updatedWorkshop.ProfileImageUrl = current.ProfileImageUrl;
            }
            // Profile edits, visibility and ordering cannot change an account link.
            var update = Builders<Board>.Update
                .Set(x => x.Name, updatedWorkshop.Name).Set(x => x.Description, updatedWorkshop.Description)
                .Set(x => x.ProfileImageUrl, updatedWorkshop.ProfileImageUrl).Set(x => x.BlogHtml, updatedWorkshop.BlogHtml)
                .Set(x => x.LInkedinUrl, updatedWorkshop.LInkedinUrl).Set(x => x.TwitterUrl, updatedWorkshop.TwitterUrl)
                .Set(x => x.GitHubUrl, updatedWorkshop.GitHubUrl).Set(x => x.FaceboookUrl, updatedWorkshop.FaceboookUrl)
                .Set(x => x.Email, updatedWorkshop.Email).Set(x => x.InstagramUrl, updatedWorkshop.InstagramUrl)
                .Set(x => x.ShortBio, updatedWorkshop.ShortBio).Set(x => x.FullBio, updatedWorkshop.FullBio)
                .Set(x => x.IsActive, updatedWorkshop.IsActive).Set(x => x.Order, updatedWorkshop.Order);
            await _boardCollection.UpdateOneAsync(x => x.BoardId == id, update);
        }

        public async Task LinkAsync(Guid id, AccountReference account, string? expectedEmail, CancellationToken cancellationToken)
        {
            using var indexes = await _boardCollection.Indexes.ListAsync(cancellationToken);
            if (!(await indexes.ToListAsync(cancellationToken)).Any(IsAccountLinkIndex))
                throw new PrivacyBlockedException("board_account_index_required", 503);
            if (await _boardCollection.Find(x => x.BoardId != id &&
                x.AccountIssuer == account.Issuer && x.AccountSubject == account.Subject).AnyAsync(cancellationToken))
                throw new PrivacyBlockedException("board_account_already_linked", 409);
            var filter = Builders<Board>.Filter.Where(x => x.BoardId == id &&
                x.AccountIssuer == null && x.AccountSubject == null && x.Email == expectedEmail);
            UpdateResult result;
            try
            {
                result = await _boardCollection.UpdateOneAsync(filter, Builders<Board>.Update
                    .Set(x => x.AccountIssuer, account.Issuer).Set(x => x.AccountSubject, account.Subject),
                    cancellationToken: cancellationToken);
            }
            catch (MongoWriteException exception) when (exception.WriteError.Category == ServerErrorCategory.DuplicateKey)
            {
                throw new PrivacyBlockedException("board_account_already_linked", 409);
            }
            if (result.MatchedCount != 1) throw new PrivacyBlockedException("board_profile_changed", 409);
        }

        public static bool IsAccountLinkIndex(BsonDocument index) =>
            index.GetValue("unique", false) == BsonBoolean.True &&
            index.GetValue("key", BsonNull.Value).Equals(new BsonDocument { { "AccountIssuer", 1 }, { "AccountSubject", 1 } }) &&
            index.GetValue("partialFilterExpression", BsonNull.Value).Equals(new BsonDocument
            {
                { "AccountIssuer", new BsonDocument("$type", "string") },
                { "AccountSubject", new BsonDocument("$type", "string") }
            }) &&
            (!index.TryGetValue("collation", out var collation) || collation.AsBsonDocument.GetValue("locale", "") == "simple");

        public async Task RemoveAsync(Guid id)
        {
            using var lease = await _gate.EnterAsync();
            if (_photos is not null) await _photos.RemoveProfileAsync(PhotoTarget.BoardKey(id), default);
            await _boardCollection.DeleteOneAsync(x => x.BoardId == id);
        }
    }
}