using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = BackupAuthorizationOptions.PolicyName)]
public sealed class BackupController(
    DatabaseBackupService backupService,
    ILogger<BackupController> logger) : ControllerBase
{
    [HttpGet("snapshots")]
    public async Task<ActionResult<IReadOnlyList<BackupSnapshotInfo>>> ListSnapshots(CancellationToken cancellationToken) =>
        Ok(await backupService.ListAsync(cancellationToken));

    [HttpPost("export")]
    public async Task<ActionResult<BackupSnapshotInfo>> Export(CancellationToken cancellationToken) =>
        Ok(await backupService.CreateAsync(cancellationToken));

    [HttpPost("import")]
    public async Task<ActionResult<BackupRestoreResult>> Import(
        BackupRestoreRequest request,
        CancellationToken cancellationToken)
    {
        if (!request.ConfirmReplace)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Conferma richiesta",
                Detail = "Confermare esplicitamente la sostituzione dei dati prima di importare il backup.",
            });
        }

        try
        {
            var result = await backupService.RestoreAsync(request.SnapshotId, cancellationToken);
            return result is null ? NotFound() : Ok(result);
        }
        catch (ArgumentException exception)
        {
            logger.LogWarning(exception, "Rejected an invalid database backup snapshot identifier.");
            return BadRequest(new ProblemDetails
            {
                Title = "Snapshot non valido",
                Detail = "L'identificativo del backup selezionato non è valido.",
            });
        }
        catch (InvalidDataException exception)
        {
            logger.LogWarning(exception, "Rejected an invalid database backup snapshot.");
            return BadRequest(new ProblemDetails
            {
                Title = "Backup non valido",
                Detail = "Il backup selezionato non è integro o non è supportato. Nessun dato è stato sostituito.",
            });
        }
    }
}
