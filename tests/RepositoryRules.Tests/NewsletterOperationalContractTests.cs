using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Xunit;

namespace RepositoryRules.Tests;

public sealed class NewsletterOperationalContractTests
{
    [Fact]
    public void DatabaseRestoreSuspendsNewsletterProductionBeforeAnySnapshotOrDatabaseMutation()
    {
        var source = ReadSource("Services", "DatabaseBackupService.cs");
        var restore = CSharpSyntaxTree.ParseText(source, cancellationToken: TestContext.Current.CancellationToken)
            .GetRoot(TestContext.Current.CancellationToken).DescendantNodes()
            .OfType<MethodDeclarationSyntax>().Single(method => method.Identifier.ValueText == "RestoreAsync");
        var calls = restore.DescendantNodes().OfType<InvocationExpressionSyntax>().ToArray();
        var guard = Assert.Single(calls, call => call.Expression.ToString()
            .EndsWith(".SuspendForRestoreAsync", StringComparison.Ordinal));
        var safetyCopy = Assert.Single(calls, call => call.Expression.ToString() == "CreateSnapshotAsync");
        var replace = Assert.Single(calls, call => call.Expression.ToString() == "ReplaceDatabaseAsync");
        Assert.True(guard.SpanStart < safetyCopy.SpanStart);
        Assert.True(guard.SpanStart < replace.SpanStart);
        var constructor = CSharpSyntaxTree.ParseText(source, cancellationToken: TestContext.Current.CancellationToken)
            .GetRoot(TestContext.Current.CancellationToken).DescendantNodes()
            .OfType<ConstructorDeclarationSyntax>().Single();
        var parameter = Assert.Single(constructor.ParameterList.Parameters,
            parameter => parameter.Type?.ToString() == "INewsletterRestoreGuard");
        Assert.Null(parameter.Default);
    }

    [Fact]
    public void AccountPrivacyCannotAssessNewsletterCollectionsWithoutTheirPrivacyCollaborator()
    {
        var source = ReadSource("Services", "Privacy", "MongoAccountPrivacyStore.cs");
        var type = CSharpSyntaxTree.ParseText(source, cancellationToken: TestContext.Current.CancellationToken)
            .GetRoot(TestContext.Current.CancellationToken).DescendantNodes()
            .OfType<ClassDeclarationSyntax>().Single();
        var parameter = Assert.Single(type.ParameterList!.Parameters,
            parameter => parameter.Type?.ToString() == "INewsletterPrivacyStore");
        Assert.Null(parameter.Default);
        var calls = type.DescendantNodes().OfType<InvocationExpressionSyntax>()
            .Select(call => call.Expression.ToString()).ToArray();
        Assert.Contains("newsletters.InspectAsync", calls);
        Assert.Contains("newsletters.ExportAsync", calls);
        Assert.Contains("newsletters.EraseAsync", calls);
        Assert.Contains(type.DescendantNodes().OfType<InvocationExpressionSyntax>(), call =>
            call.Expression.ToString() == "known.UnionWith" &&
            Assert.Single(call.ArgumentList.Arguments).Expression.ToString() == "newsletters.CollectionNames");
    }

    private static string ReadSource(params string[] parts)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "DotNetLiguria.slnx")))
            directory = directory.Parent;
        Assert.NotNull(directory);
        return File.ReadAllText(Path.Combine(
            [directory.FullName, "src", "dotnetliguriawebsite", "DotNetLiguriaCore", .. parts]));
    }
}
