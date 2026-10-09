using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Questionnaires;
using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Controllers;

public static class QuestionnaireActionResults
{
    public static IActionResult From<T>(QuestionnaireOperationResult<T> result, Func<T, IActionResult> onSuccess)
    {
        if (result.Status == QuestionnaireOperationStatus.Ok)
        {
            return onSuccess(result.Value!);
        }

        var body = new QuestionnaireProblem
        {
            Code = result.Status.ToString(),
            Message = result.Message ?? string.Empty,
            Errors = result.Errors.ToList(),
        };
        var statusCode = result.Status switch
        {
            QuestionnaireOperationStatus.NotFound => StatusCodes.Status404NotFound,
            QuestionnaireOperationStatus.Invalid => StatusCodes.Status400BadRequest,
            QuestionnaireOperationStatus.Unavailable => StatusCodes.Status410Gone,
            _ => StatusCodes.Status409Conflict,
        };
        return new ObjectResult(body) { StatusCode = statusCode };
    }
}
