namespace DotNetLiguriaCore.Services.Access;

public sealed class AccessPermissionChangeRequest
{
    public string[] ExpectedDirectPermissions { get; set; } = [];
}
