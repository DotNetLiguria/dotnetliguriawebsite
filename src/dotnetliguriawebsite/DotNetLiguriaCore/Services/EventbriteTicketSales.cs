using System.Globalization;
using System.Text.Json;

namespace DotNetLiguriaCore.Services;

public sealed record EventbriteTicketSales(
    int TotalCapacity,
    int Sold,
    int Pending,
    int Remaining,
    DateTimeOffset RefreshedAt)
{
    public static EventbriteTicketSales FromApiResponse(JsonElement response, DateTimeOffset refreshedAt)
    {
        var totalCapacity = ReadCount(response, "capacity") ?? ReadCount(response, "quantity_total")
            ?? throw new EventbriteApiException(null, "Eventbrite ticket data did not include its total capacity.");
        var sold = ReadCount(response, "quantity_sold")
            ?? throw new EventbriteApiException(null, "Eventbrite ticket data did not include its sold quantity.");
        var pending = ReadCount(response, "quantity_pending") ?? 0;
        var remaining = ReadCount(response, "quantity_available") ?? Math.Max(0, totalCapacity - sold - pending);
        if (totalCapacity < 0 || sold < 0 || pending < 0 || remaining < 0)
        {
            throw new EventbriteApiException(null, "Eventbrite ticket data contained a negative inventory quantity.");
        }

        return new EventbriteTicketSales(totalCapacity, sold, pending, remaining, refreshedAt);
    }

    private static int? ReadCount(JsonElement response, string propertyName)
    {
        if (!response.TryGetProperty(propertyName, out var property) || property.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Number && property.TryGetInt32(out var number))
        {
            return number;
        }
        if (property.ValueKind == JsonValueKind.String &&
            int.TryParse(property.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out number))
        {
            return number;
        }

        throw new EventbriteApiException(null, $"Eventbrite ticket data contained an invalid '{propertyName}' quantity.");
    }
}
