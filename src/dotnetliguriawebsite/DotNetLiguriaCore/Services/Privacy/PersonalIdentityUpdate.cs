using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace DotNetLiguriaCore.Services.Privacy;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record PersonalIdentityUpdate(
    [property: StringLength(255)] string? FirstName,
    [property: StringLength(255)] string? LastName);
