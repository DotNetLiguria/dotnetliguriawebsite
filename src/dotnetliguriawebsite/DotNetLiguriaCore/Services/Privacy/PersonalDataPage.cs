namespace DotNetLiguriaCore.Services.Privacy;

public sealed record PersonalDataPage(
    PersonalIdentity? Identity, IReadOnlyList<PersonalDataRecord> Records, bool HasMore, string Warning);
