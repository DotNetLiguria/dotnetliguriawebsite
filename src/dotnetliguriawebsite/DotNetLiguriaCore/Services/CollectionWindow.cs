using System.Globalization;

namespace DotNetLiguriaCore.Services;

public sealed class CollectionWindow
{
    public int Offset { get; }
    public int Limit { get; }
    public bool HasMore { get; set; }

    public CollectionWindow(int offset, int limit)
    {
        if (offset is < 0 or > 100000 || limit is < 1 or > 200)
            throw new BadHttpRequestException("Invalid collection window.", StatusCodes.Status400BadRequest);
        Offset = offset;
        Limit = limit;
    }

    public static CollectionWindow? From(HttpContext context)
    {
        var query = context.Request.Query;
        if (!query.ContainsKey("offset") && !query.ContainsKey("limit")) return null;
        var offset = 0;
        var limit = 100;
        if ((query.ContainsKey("offset") && !int.TryParse(query["offset"],
                NumberStyles.None, CultureInfo.InvariantCulture, out offset)) ||
            (query.ContainsKey("limit") && !int.TryParse(query["limit"],
                NumberStyles.None, CultureInfo.InvariantCulture, out limit)))
            throw new BadHttpRequestException("Invalid collection window.", StatusCodes.Status400BadRequest);
        return new CollectionWindow(offset, limit);
    }

    public void WriteHeaders(HttpContext context)
    {
        context.Response.Headers["X-Page-Offset"] = Offset.ToString(CultureInfo.InvariantCulture);
        context.Response.Headers["X-Page-Limit"] = Limit.ToString(CultureInfo.InvariantCulture);
        if (HasMore)
            context.Response.Headers["X-Next-Offset"] = (Offset + Limit).ToString(CultureInfo.InvariantCulture);
    }
}
