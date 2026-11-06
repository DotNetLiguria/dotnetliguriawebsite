using System.Collections;

namespace CommonWeb;

public static class FileEnvironmentSecrets
{
    private const string _fileSuffix = "_FILE";

    public static IReadOnlyDictionary<string, string?> Read()
    {
        var environmentVariables = new List<KeyValuePair<string, string?>>();
        foreach (DictionaryEntry entry in Environment.GetEnvironmentVariables())
        {
            if (entry.Key is string name)
                environmentVariables.Add(new KeyValuePair<string, string?>(name, entry.Value as string));
        }

        return Read(environmentVariables);
    }

    public static IReadOnlyDictionary<string, string?> Read(
        IEnumerable<KeyValuePair<string, string?>> environmentVariables)
    {
        ArgumentNullException.ThrowIfNull(environmentVariables);

        var configurationValues = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var (name, filePath) in environmentVariables)
        {
            if (!name.EndsWith(_fileSuffix, StringComparison.Ordinal))
                continue;

            var configurationKey = name[..^_fileSuffix.Length];
            if (string.IsNullOrWhiteSpace(configurationKey))
                throw new InvalidOperationException($"{name} does not name a configuration key.");
            if (string.IsNullOrWhiteSpace(filePath))
                throw new InvalidOperationException($"{name} must name a readable secret file.");

            var value = ReadSecretFile(name, filePath);
            var normalizedConfigurationKey = configurationKey.Replace("__", ":", StringComparison.Ordinal);
            if (!configurationValues.TryAdd(normalizedConfigurationKey, value))
                throw new InvalidOperationException($"{name} duplicates a file-backed configuration key.");
        }

        return configurationValues;
    }

    private static string ReadSecretFile(string variableName, string filePath)
    {
        try
        {
            return File.ReadAllText(filePath).TrimEnd('\r', '\n');
        }
        catch (IOException exception)
        {
            throw new InvalidOperationException($"Could not read the secret file named by {variableName}.", exception);
        }
        catch (UnauthorizedAccessException exception)
        {
            throw new InvalidOperationException($"Could not read the secret file named by {variableName}.", exception);
        }
    }
}
