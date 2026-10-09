# Server-Side Blazor Questionnaire

Read the repository root AGENTS.md first. Preserve server-side circuits, WebSocket
hosting, questionnaire routes, validation and SQL composite-key/column mappings.
Timers must be injectable and disposable; tests advance fake time without sleeps.
Telemetry must not contact external services in unit tests.

Build all projects: `dotnet build DotNetLiguria.slnx -c Release` from the repository root.
Unit tests live under tests/ServerQuestionnaire.Tests; do not co-reference the
hosted questionnaire's same-named Shared assembly. Existing Playwright tests are
separate browser checks and need an explicitly supplied disposable application URL.
Do not include browser checks in the fast unit gate or automatically run SQL migrations.