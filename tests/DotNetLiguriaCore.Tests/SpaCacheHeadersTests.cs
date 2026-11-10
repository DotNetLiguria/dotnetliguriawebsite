using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class SpaCacheHeadersTests
{
    [Theory]
    [InlineData("index.html", "no-cache")]
    [InlineData("INDEX.HTML", "no-cache")]
    [InlineData("index-DOzneMHe.js", "")]
    [InlineData("favicon.svg", "")]
    public void OnlyHtmlEntryPointsMustBeRevalidated(string fileName, string expected)
    {
        var httpContext = new DefaultHttpContext();

        SpaCacheHeaders.Apply(new StaticFileResponseContext(httpContext, new NotFoundFileInfo(fileName)));

        Assert.Equal(expected, httpContext.Response.Headers.CacheControl.ToString());
    }
}
