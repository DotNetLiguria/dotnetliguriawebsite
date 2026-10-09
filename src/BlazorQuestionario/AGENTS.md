# Hosted WebAssembly Questionnaire

Read the repository root AGENTS.md first. Client is WebAssembly; Server owns HTTP
endpoints and persistence; Shared owns contracts. Preserve questionnaire routes,
validation, legacy database mappings and QR upload responses.
Use stable .NET 10 WebAssembly hosting APIs. QR decoding must support Linux and Windows.
Do not introduce System.Drawing or Windows-only native dependencies.

Build: `dotnet build src/BlazorQuestionario/BlazorAppQuestionario.sln -c Release`.
Tests: `dotnet test tests/Questionnaire.Tests -c Release` from the repository root.
Never run schema updates or submissions against real databases during verification.