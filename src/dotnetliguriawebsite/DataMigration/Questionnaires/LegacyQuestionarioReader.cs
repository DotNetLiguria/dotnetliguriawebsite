using System.Data.Common;
using System.Globalization;

using DotNetLiguriaCore.Model;

namespace DataMigration.Questionnaires;

/// <summary>Reads legacy QuestionarioTest rows from either Blazor schema (SQL Server Guid ids or SQLite text ids).</summary>
public static class LegacyQuestionarioReader
{
    public const string Query = "SELECT * FROM QuestionarioTest";
    public const int TrackSlots = 5;

    public static async Task<List<LegacyQuestionarioRow>> ReadAsync(DbConnection connection, ResponseSource source,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(connection);
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = Query;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return Read(reader, source);
    }

    public static List<LegacyQuestionarioRow> Read(DbDataReader reader, ResponseSource source)
    {
        ArgumentNullException.ThrowIfNull(reader);
        var columns = Enumerable.Range(0, reader.FieldCount)
            .ToDictionary(reader.GetName, i => i, StringComparer.OrdinalIgnoreCase);
        object? Value(string name) =>
            columns.TryGetValue(name, out var ordinal) && !reader.IsDBNull(ordinal) ? reader.GetValue(ordinal) : null;

        var rows = new List<LegacyQuestionarioRow>();
        while (reader.Read())
        {
            var row = new LegacyQuestionarioRow
            {
                Source = source,
                Id = AsString(Value("QuestionarioTestId")) ?? string.Empty,
                Date = AsDate(Value("Data")),
                Name = AsString(Value("Nome")),
                Surname = AsString(Value("Cognome")),
                Email = AsString(Value("EMail")),
                Topics = AsString(Value("ArgomentiProxEvento")),
                Suggestions = AsString(Value("ConsigliSuggerimenti")),
                OverallRating = AsInt(Value("ValutazioneQualitaGeneraleEvento")),
                UsefulnessRating = AsInt(Value("UtilitaInformazioniRicevute")),
                WorkshopId = AsString(Value("WorkshopId")),
            };

            for (var slot = 1; slot <= TrackSlots; slot++)
            {
                var prefix = $"Track{slot:00}";
                row.Tracks.Add(new LegacyTrackRating
                {
                    Slot = slot,
                    WorkshopTrackId = AsString(Value($"{prefix}WorkshopTrackId")),
                    Rating = AsInt(Value($"{prefix}Valutazione")),
                });
            }

            rows.Add(row);
        }

        return rows;
    }

    private static string? AsString(object? value) => value switch
    {
        null => null,
        byte[] { Length: 16 } bytes => new Guid(bytes).ToString(),
        IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString(),
    };

    private static int AsInt(object? value) => value switch
    {
        null => 0,
        string text => int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0,
        _ => Convert.ToInt32(value, CultureInfo.InvariantCulture),
    };

    private static DateTime AsDate(object? value) => value switch
    {
        DateTime date => date,
        DateTimeOffset offset => offset.LocalDateTime,
        string text => DateTime.Parse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal),
        _ => DateTime.MinValue,
    };
}
