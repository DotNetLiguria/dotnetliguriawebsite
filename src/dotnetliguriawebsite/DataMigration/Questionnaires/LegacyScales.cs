using DotNetLiguriaCore.Model;

namespace DataMigration.Questionnaires;

/// <summary>Rating ranges declared by the legacy Blazor models ([Range] attributes).</summary>
public static class LegacyScales
{
    // BlazorQuestionarioServer: general ratings and Track01-03 are 0-5, Track04-05 kept 0-10.
    // BlazorQuestionario (hosted WASM): every rating is 0-10.
    public static (int Min, int Max) General(ResponseSource source) =>
        source == ResponseSource.LegacySqlServer ? (0, 5) : (0, 10);

    public static (int Min, int Max) Track(ResponseSource source, int slot) =>
        source == ResponseSource.LegacySqlServer && slot <= 3 ? (0, 5) : (0, 10);
}
