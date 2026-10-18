using MongoDB.Bson;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services;

public static class BoundedMongoReads
{
    private const int _maxUnpagedRecords = 1000;
    private const int _maxBytes = 16 * 1024 * 1024;

    public static async Task<List<T>> ReadBoundedAsync<T>(this IFindFluent<T, T> query,
        CancellationToken cancellationToken = default, CollectionWindow? page = null)
    {
        var limit = page?.Limit ?? _maxUnpagedRecords;
        query.Options.BatchSize = 16;
        query.Options.MaxTime = TimeSpan.FromSeconds(10);
        using var cursor = await query.Skip(page?.Offset ?? 0).Limit(limit + 1).ToCursorAsync(cancellationToken);
        return await ReadCursorAsync(cursor, limit, page, cancellationToken);
    }

    public static async Task<List<T>> ReadCursorAsync<T>(IAsyncCursor<T> cursor, int limit,
        CollectionWindow? page, CancellationToken cancellationToken = default)
    {
        var result = new List<T>();
        var bytes = 0L;
        while (await cursor.MoveNextAsync(cancellationToken))
        {
            foreach (var document in cursor.Current)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (result.Count == limit)
                {
                    if (page is null)
                        throw new BadHttpRequestException("Collection limit exceeded; request a smaller page.",
                            StatusCodes.Status413PayloadTooLarge);
                    page.HasMore = true;
                    return result;
                }
                bytes += document.ToBson().Length;
                if (bytes > _maxBytes)
                    throw new BadHttpRequestException("Collection byte limit exceeded; request a smaller page.",
                        StatusCodes.Status413PayloadTooLarge);
                result.Add(document);
            }
        }
        return result;
    }
}
