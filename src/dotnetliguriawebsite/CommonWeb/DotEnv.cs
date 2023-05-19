using System;

namespace CommonWeb;

public static class DotEnv
{
    private static readonly string BaseDotEnv = ".env";
    public static void SetCurrentProfile(string profile = "")
    {
        var currentDir = Environment.CurrentDirectory;
        var baseFile = Path.Combine(currentDir, BaseDotEnv);
        var profileFile = Path.Combine(currentDir, $"{BaseDotEnv}.{profile}");
        if(File.Exists(baseFile))
        {
            Set(baseFile);
        }

        if(File.Exists(profileFile))
        {
            Set(profileFile);
        }
    }

    /// <summary>
    /// Se the environment variables to the current process according to the
    /// .env file passed as argument
    /// </summary>
    /// <param name="filename">A filename formatted according to .env specs</param>
    public static void Set(string filename)
    {
        ReadAll(filename, ((string, string)? tuple, string? comment) =>
        {
            if (tuple != null)
            {
                var key = tuple.Value.Item1;
                var value = tuple.Value.Item2;
                Environment.SetEnvironmentVariable(key, value);
            }
        });
    }


    /// <summary>
    /// Read a .env file with the data to set into the environment variables of the
    /// starting process
    /// </summary>
    /// <param name="filename">The .env file to read from</param>
    /// <param name="onData">The first parameter is a tuple with key/value, if any.
    /// The second parameter is the string comment which can be inline.</param>
    private static void ReadAll(string filename, Action<(string, string)?, string?> onData)
    {
        using StreamReader sr = new StreamReader(filename);
        string? line = null;
        while ((line = sr.ReadLine()) != null)
        {
            line = line.Trim();
            if(line.Length == 0)
            {
                continue;
            }

            if (line.StartsWith('#'))
            {
                // this is a comment
                onData(null, line);
                continue;
            }

            string? comment = null;
            var commentIndex = line.IndexOf('#');
            if(commentIndex != -1)
            {
                // there is an inline comment
                comment = line.Substring(commentIndex);
                line = line.Substring(0, commentIndex);
            }

            var parts = line.Split('=');
            if (parts.Length != 2)
            {
                throw new Exception($"The file {filename} is not well formed:\n{line}");
            }
            var key = parts[0].Trim();
            var value = parts[1].Trim();

            onData((key, value), comment);
        }
    }
}