using DotNetLiguriaCore.Model;

using Microsoft.Data.SqlClient;
using Microsoft.Data.Sqlite;

using MongoDB.Driver;

namespace DataMigration.Questionnaires;

/// <summary>I/O shell around <see cref="QuestionnaireMigrationPlanner"/>: dry run by default, writes only with --apply.</summary>
public class QuestionnaireMigrationRunner
{
    private readonly IMongoCollection<Workshop> _workshops;
    private readonly IMongoCollection<Feedback> _feedback;
    private readonly IMongoCollection<Questionnaire> _questionnaires;
    private readonly IMongoCollection<QuestionnaireResponse> _responses;
    private readonly TextWriter _output;

    public QuestionnaireMigrationRunner(IMongoDatabase database, DotNetLiguriaDatabaseSettings settings, TextWriter output)
    {
        ArgumentNullException.ThrowIfNull(database);
        ArgumentNullException.ThrowIfNull(settings);
        _workshops = database.GetCollection<Workshop>(settings.WorkshopCollectionName);
        _feedback = database.GetCollection<Feedback>(settings.FeedbackCollectionName);
        _questionnaires = database.GetCollection<Questionnaire>(settings.QuestionnaireCollectionName);
        _responses = database.GetCollection<QuestionnaireResponse>(settings.QuestionnaireResponseCollectionName);
        _output = output;
    }

    public async Task<int> RunAsync(QuestionnaireMigrationOptions options, DateTime nowUtc, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(options);
        _output.WriteLine(options.Apply
            ? "Migrazione questionari: MODALITÀ APPLY (scrittura su MongoDB)."
            : "Migrazione questionari: dry run (nessuna scrittura). Usare --apply per scrivere.");

        var workshops = (await _workshops.Find(FilterDefinition<Workshop>.Empty).ToListAsync(cancellationToken))
            .ToDictionary(w => w.WorkshopId);
        var feedback = options.IncludeFeedback
            ? await _feedback.Find(FilterDefinition<Feedback>.Empty).ToListAsync(cancellationToken)
            : [];
        _output.WriteLine($"Workshop: {workshops.Count}; righe Feedback: {feedback.Count}");

        var legacyRows = new List<LegacyQuestionarioRow>();
        if (options.SqlServerConnectionString is { } sqlServer)
        {
            await using var connection = new SqlConnection(sqlServer);
            var rows = await LegacyQuestionarioReader.ReadAsync(connection, ResponseSource.LegacySqlServer, cancellationToken);
            _output.WriteLine($"Righe QuestionarioTest (SQL Server): {rows.Count}");
            legacyRows.AddRange(rows);
        }

        if (options.SqliteConnectionString is { } sqlite)
        {
            await using var connection = new SqliteConnection(sqlite);
            var rows = await LegacyQuestionarioReader.ReadAsync(connection, ResponseSource.LegacySqlite, cancellationToken);
            _output.WriteLine($"Righe QuestionarioTest (SQLite): {rows.Count}");
            legacyRows.AddRange(rows);
        }

        var batches = QuestionnaireMigrationPlanner.Plan(feedback, legacyRows, workshops, nowUtc);
        if (options.Apply)
        {
            await EnsureSourceKeyIndexAsync(cancellationToken);
        }

        int totalResponses = 0, totalNew = 0, newQuestionnaires = 0;
        foreach (var batch in batches)
        {
            var questionnaire = batch.Questionnaire;
            var exists = await _questionnaires.Find(q => q.QuestionnaireId == questionnaire.QuestionnaireId)
                .AnyAsync(cancellationToken);
            var keys = batch.Responses.Select(r => r.SourceKey).ToList();
            var existingKeys = (await _responses.Find(r => keys.Contains(r.SourceKey))
                .Project(r => r.SourceKey).ToListAsync(cancellationToken)).ToHashSet();
            var toInsert = batch.Responses.Where(r => !existingKeys.Contains(r.SourceKey)).ToList();

            if (options.Apply)
            {
                if (!exists)
                {
                    questionnaire.ResponseCount = batch.Responses.Count;
                    await _questionnaires.InsertOneAsync(questionnaire, cancellationToken: cancellationToken);
                }

                if (toInsert.Count > 0)
                {
                    await _responses.InsertManyAsync(toInsert, new InsertManyOptions { IsOrdered = false }, cancellationToken);
                }
            }

            newQuestionnaires += exists ? 0 : 1;
            totalResponses += batch.Responses.Count;
            totalNew += toInsert.Count;
            _output.WriteLine($"- [{questionnaire.Origin}] {questionnaire.Title} ({questionnaire.QuestionnaireId}): " +
                $"{batch.Responses.Count} risposte, {toInsert.Count} nuove{(exists ? ", questionario già presente" : string.Empty)}");
            foreach (var warning in batch.Warnings)
            {
                _output.WriteLine($"    ! {warning}");
            }
        }

        _output.WriteLine($"Totale: {batches.Count} questionari ({newQuestionnaires} nuovi), {totalResponses} risposte ({totalNew} nuove).");
        return 0;
    }

    // Same definition as MongoQuestionnaireStore so the website and the migration agree on the index.
    private Task EnsureSourceKeyIndexAsync(CancellationToken cancellationToken) =>
        _responses.Indexes.CreateOneAsync(new CreateIndexModel<QuestionnaireResponse>(
            Builders<QuestionnaireResponse>.IndexKeys.Ascending(r => r.SourceKey),
            new CreateIndexOptions { Unique = true, Sparse = true, Name = "SourceKey_unique" }), cancellationToken: cancellationToken);
}
