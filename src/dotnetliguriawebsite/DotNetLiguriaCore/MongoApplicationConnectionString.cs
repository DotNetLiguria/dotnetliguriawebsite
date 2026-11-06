namespace DotNetLiguriaCore;

public static class MongoApplicationConnectionString
{
    private const string _usernameConfigurationKey = "MONGO_APP_USERNAME";
    private const string _passwordConfigurationKey = "MONGO_APP_PASSWORD";

    public static string? Create(IReadOnlyDictionary<string, string?> fileEnvironmentSecrets,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(fileEnvironmentSecrets);
        ArgumentNullException.ThrowIfNull(configuration);

        fileEnvironmentSecrets.TryGetValue(_usernameConfigurationKey, out var username);
        fileEnvironmentSecrets.TryGetValue(_passwordConfigurationKey, out var password);
        if (string.IsNullOrWhiteSpace(username) && string.IsNullOrWhiteSpace(password))
            return null;
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException(
                "MONGO_APP_USERNAME_FILE and MONGO_APP_PASSWORD_FILE must both name readable secret files.");

        var databaseName = configuration["DotNetLiguriaDatabase:DatabaseName"];
        if (string.IsNullOrWhiteSpace(databaseName))
            throw new InvalidOperationException("DotNetLiguriaDatabase:DatabaseName must be configured.");

        var escapedUsername = Uri.EscapeDataString(username);
        var escapedPassword = Uri.EscapeDataString(password);
        var escapedDatabaseName = Uri.EscapeDataString(databaseName);
        return $"mongodb://{escapedUsername}:{escapedPassword}@mongodb:27017/{escapedDatabaseName}" +
               $"?authSource={escapedDatabaseName}&tls=false";
    }
}
