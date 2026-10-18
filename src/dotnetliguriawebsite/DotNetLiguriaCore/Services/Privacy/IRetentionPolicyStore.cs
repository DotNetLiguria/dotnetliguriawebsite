namespace DotNetLiguriaCore.Services.Privacy;

public interface IRetentionPolicyStore
{
    Task<Dictionary<string, string>> ReadAsync(CancellationToken cancellationToken);
    Task ReplaceAsync(Dictionary<string, string> overrides, CancellationToken cancellationToken);
}
