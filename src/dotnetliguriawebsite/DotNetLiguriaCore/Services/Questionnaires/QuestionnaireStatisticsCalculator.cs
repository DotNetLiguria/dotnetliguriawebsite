using System.Globalization;
using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services.Questionnaires;

public static class QuestionnaireStatisticsCalculator
{
    public static QuestionnaireStatistics Calculate(Questionnaire questionnaire, IReadOnlyCollection<QuestionnaireResponse> responses)
    {
        var statistics = new QuestionnaireStatistics
        {
            QuestionnaireId = questionnaire.QuestionnaireId,
            Title = questionnaire.Title,
            ResponseCount = responses.Count,
            FirstResponseAt = responses.Count == 0 ? null : responses.Min(r => r.SubmittedAt),
            LastResponseAt = responses.Count == 0 ? null : responses.Max(r => r.SubmittedAt),
            ResponsesPerDay = responses
                .GroupBy(r => r.SubmittedAt.Date)
                .OrderBy(g => g.Key)
                .Select(g => new DailyCount { Date = g.Key.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), Count = g.Count() })
                .ToList(),
        };

        var ordered = responses.OrderBy(r => r.SubmittedAt).ToList();
        foreach (var question in QuestionnaireRules.AllQuestions(questionnaire).Where(q => QuestionnaireRules.IsAnswerable(q.Type)))
        {
            var answers = ordered
                .Select(r => (Response: r, Answer: r.Answers.FirstOrDefault(a => a.QuestionId == question.Id)))
                .Where(x => QuestionnaireRules.HasValue(x.Answer))
                .ToList();
            var item = new QuestionStatistics
            {
                QuestionId = question.Id,
                Title = question.Title,
                Type = question.Type,
                AnsweredCount = answers.Count,
            };

            switch (question.Type)
            {
                case QuestionType.Rating:
                case QuestionType.Scale:
                    var (min, max) = QuestionnaireRules.ScaleBounds(question);
                    FillNumeric(item, answers.Select(a => a.Answer!.Number).OfType<double>().ToList());
                    item.Distribution = Distribution(min, max, answers.Select(a => a.Answer!.Number).OfType<double>().Select(v => (int)v));
                    break;
                case QuestionType.Number:
                    FillNumeric(item, answers.Select(a => a.Answer!.Number).OfType<double>().ToList());
                    break;
                case QuestionType.YesNo:
                    item.Options =
                    [
                        new OptionCount { OptionId = "true", Label = "Sì", Count = answers.Count(a => a.Answer!.Bool == true) },
                        new OptionCount { OptionId = "false", Label = "No", Count = answers.Count(a => a.Answer!.Bool == false) },
                    ];
                    break;
                case QuestionType.SingleChoice:
                case QuestionType.MultipleChoice:
                    item.Options = question.Options
                        .Select(o => new OptionCount { OptionId = o.Id, Label = o.Label, Count = answers.Count(a => a.Answer!.Choices?.Contains(o.Id) == true) })
                        .ToList();
                    if (question.Settings.AllowOther)
                    {
                        item.Options.Add(new OptionCount
                        {
                            OptionId = QuestionnaireRules.OtherOptionId,
                            Label = question.Settings.OtherLabel ?? "Altro",
                            Count = answers.Count(a => a.Answer!.Choices?.Contains(QuestionnaireRules.OtherOptionId) == true),
                        });
                        item.TextAnswers = TextAnswers(answers, a => a.OtherText);
                    }

                    break;
                case QuestionType.Matrix:
                    var bounds = QuestionnaireRules.ScaleBounds(question);
                    item.Rows = question.Rows.Select(row =>
                    {
                        var values = answers
                            .SelectMany(a => a.Answer!.Rows ?? [])
                            .Where(r => r.RowId == row.Id)
                            .Select(r => r.Value)
                            .ToList();
                        return new MatrixRowStatistics
                        {
                            RowId = row.Id,
                            Label = row.Label,
                            AnsweredCount = values.Count,
                            Average = values.Count == 0 ? null : Math.Round(values.Average(), 2),
                            Distribution = Distribution(bounds.Min, bounds.Max, values),
                        };
                    }).ToList();
                    break;
                default:
                    item.TextAnswers = TextAnswers(answers, a => a.Text);
                    break;
            }

            statistics.Questions.Add(item);
        }

        return statistics;
    }

    private static void FillNumeric(QuestionStatistics item, List<double> values)
    {
        if (values.Count == 0)
        {
            return;
        }

        item.Average = Math.Round(values.Average(), 2);
        item.Min = values.Min();
        item.Max = values.Max();
    }

    private static List<ValueCount> Distribution(int min, int max, IEnumerable<int> values)
    {
        var counts = values.GroupBy(v => v).ToDictionary(g => g.Key, g => g.Count());
        return Enumerable.Range(min, Math.Max(0, max - min + 1))
            .Select(v => new ValueCount { Value = v, Count = counts.GetValueOrDefault(v) })
            .ToList();
    }

    private static List<TextAnswer> TextAnswers(List<(QuestionnaireResponse Response, QuestionAnswer? Answer)> answers,
        Func<QuestionAnswer, string?> selector) =>
        answers
            .Where(a => !string.IsNullOrWhiteSpace(selector(a.Answer!)))
            .Select(a => new TextAnswer { ResponseId = a.Response.ResponseId, SubmittedAt = a.Response.SubmittedAt, Text = selector(a.Answer!)! })
            .ToList();
}
