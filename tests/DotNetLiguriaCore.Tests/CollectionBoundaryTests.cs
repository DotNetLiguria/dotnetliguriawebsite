using DotNetLiguriaCore.Services;
using Microsoft.AspNetCore.Http;
using MongoDB.Bson;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class CollectionBoundaryTests
{
    [Theory]
    [InlineData(-1, 100)]
    [InlineData(100001, 100)]
    [InlineData(0, 0)]
    [InlineData(0, 201)]
    public void InvalidWindowsFail(int offset, int limit) =>
        Assert.Equal(400, Assert.Throws<BadHttpRequestException>(() => new CollectionWindow(offset, limit)).StatusCode);

    [Fact]
    public async Task UnpagedOverflowFailsWithoutReturningTruncatedData()
    {
        using var cursor = new BufferedTestCursor<BsonDocument>(
            Enumerable.Range(0, 1001).Select(index => new BsonDocument("index", index)));
        var exception = await Assert.ThrowsAsync<BadHttpRequestException>(() =>
            BoundedMongoReads.ReadCursorAsync(cursor, 1000, null, TestContext.Current.CancellationToken));
        Assert.Equal(413, exception.StatusCode);
    }

    [Fact]
    public async Task ExactLimitSucceedsAndContinuationIsExplicit()
    {
        using var exact = new BufferedTestCursor<BsonDocument>(
            Enumerable.Range(0, 1000).Select(index => new BsonDocument("index", index)));
        Assert.Equal(1000, (await BoundedMongoReads.ReadCursorAsync(exact, 1000, null,
            TestContext.Current.CancellationToken)).Count);
        var page = new CollectionWindow(200, 200);
        using var extra = new BufferedTestCursor<BsonDocument>(
            Enumerable.Range(200, 201).Select(index => new BsonDocument("index", index)));
        var records = await BoundedMongoReads.ReadCursorAsync(extra, page.Limit, page,
            TestContext.Current.CancellationToken);
        Assert.Equal(200, records.Count);
        Assert.True(page.HasMore);
        var context = new DefaultHttpContext();
        page.WriteHeaders(context);
        Assert.Equal("400", context.Response.Headers["X-Next-Offset"]);
    }

    [Fact]
    public async Task ByteLimitRejectsLargeCollectionsEvenWithinRecordCount()
    {
        using var cursor = new BufferedTestCursor<BsonDocument>(
            Enumerable.Range(0, 17).Select(_ => new BsonDocument("text", new string('a', 1024 * 1024))));
        Assert.Equal(413, (await Assert.ThrowsAsync<BadHttpRequestException>(() =>
            BoundedMongoReads.ReadCursorAsync(cursor, 1000, null, TestContext.Current.CancellationToken))).StatusCode);
    }

    [Theory]
    [InlineData("?limit=abc")]
    [InlineData("?offset=-1")]
    [InlineData("?limit=1&limit=2")]
    public void MalformedQueryFailsRatherThanUsingDefault(string query)
    {
        var context = new DefaultHttpContext();
        context.Request.QueryString = new QueryString(query);
        Assert.Throws<BadHttpRequestException>(() => CollectionWindow.From(context));
    }
}
