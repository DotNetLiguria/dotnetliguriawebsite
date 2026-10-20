namespace DotNetLiguriaCore.Services.Access;

public sealed record BoardMembershipRequest(string Subject, bool ExpectedMember, bool Join);
