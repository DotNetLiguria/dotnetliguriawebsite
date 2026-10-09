namespace DataMigration.Questionnaires;

/// <summary>Command line for <c>DataMigration questionnaires [--apply] [--no-feedback] [--sqlserver &lt;cs&gt;] [--sqlite &lt;cs&gt;]</c>.</summary>
public class QuestionnaireMigrationOptions
{
    public const string Command = "questionnaires";

    public bool Apply { get; init; }
    public bool IncludeFeedback { get; init; } = true;
    public string? SqlServerConnectionString { get; init; }
    public string? SqliteConnectionString { get; init; }

    public static bool IsQuestionnaireCommand(string[] args) =>
        args.Length > 0 && string.Equals(args[0], Command, StringComparison.OrdinalIgnoreCase);

    /// <summary>Command-line values win over configuration (user secrets/environment are preferred for secrets).</summary>
    public static QuestionnaireMigrationOptions Parse(string[] args, string? configuredSqlServer = null, string? configuredSqlite = null)
    {
        ArgumentNullException.ThrowIfNull(args);
        var apply = false;
        var includeFeedback = true;
        var sqlServer = configuredSqlServer;
        var sqlite = configuredSqlite;

        for (var i = IsQuestionnaireCommand(args) ? 1 : 0; i < args.Length; i++)
        {
            switch (args[i].ToLowerInvariant())
            {
                case "--apply":
                    apply = true;
                    break;
                case "--no-feedback":
                    includeFeedback = false;
                    break;
                case "--sqlserver":
                    sqlServer = NextValue(args, ref i);
                    break;
                case "--sqlite":
                    sqlite = NextValue(args, ref i);
                    break;
                default:
                    throw new ArgumentException($"Opzione non riconosciuta: {args[i]}");
            }
        }

        return new QuestionnaireMigrationOptions
        {
            Apply = apply,
            IncludeFeedback = includeFeedback,
            SqlServerConnectionString = string.IsNullOrWhiteSpace(sqlServer) ? null : sqlServer,
            SqliteConnectionString = string.IsNullOrWhiteSpace(sqlite) ? null : sqlite,
        };
    }

    private static string NextValue(string[] args, ref int index)
    {
        if (index + 1 >= args.Length)
        {
            throw new ArgumentException($"Valore mancante per {args[index]}");
        }

        return args[++index];
    }
}
