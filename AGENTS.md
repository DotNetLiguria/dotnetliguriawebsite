# Repository Guidance

## Scope
Read this file and the nearest scoped AGENTS.md before editing. Scoped guidance adds
project-specific requirements; it does not relax the standards below.

- `src/dotnetliguriawebsite`: ASP.NET Core website, authentication, models and data migration.
- `src/dotnetliguriaspa`: React frontend served separately during development.
- `tests`: isolated unit tests and repository standards checks.

## Required Standards
- Target .NET 10 for every .NET project. Use stable, compatible dependencies only.
- **MANDATORY: use xUnit.net v3 for every test project. Reference `xunit.v3`;
  never reference the deprecated `xunit` package. Do not create or migrate a test
  project with `xunit`, even when a template suggests it.**
- Name every handwritten private C# field `_camelCase`, including static, readonly,
  constant and implicitly private fields. Do not use `s_` or omit the underscore.
- Declare one handwritten type per file, including interfaces, records, enums,
  structs, delegates and helper types. Genuine tool-generated code is exempt.
- Preserve public type names, namespaces, JSON/BSON contracts, routes, authentication,
  database mappings and historical workshop assets unless a change is explicitly requested.
- Keep changes focused and preserve existing uncommitted changes.
- Never include credentials, keys, tokens or certificate contents in output or documentation.
- Never run DataMigration or database schema updates against real data without approval.

## Verification
- Add focused tests for changed behavior; run the narrowest relevant checks after editing.
- Unit tests must not require MongoDB, SQL Server, Keycloak, browsers or external network calls.
- Fake time and collaborators; do not use sleeps or wall-clock delays in unit tests.
- Keep browser and database checks separate from the timed unit-test gate.
- Build all affected projects using the root solution. Validate Linux and Windows
  compatibility for the website and migration tool.
- After any frontend change, rebuild the React app and publish the website using its
  project path. For local Aspire, also overlay the generated `dist` files into the
  backend's served `wwwroot` without deleting historical assets. Verify that
  `https://localhost:5443` serves the updated frontend and its API calls work before
  reporting completion; checking only the Vite app on port 3443 is not sufficient.
- Report checks actually executed and any remaining verification gaps. Never claim that
  documentation or instructions alone enforce a rule.

## Toolchains and Workflows
Before ending a task, stop every background process started by the agent for that
task or earlier work in the session, unless the user explicitly asks to keep it
running. This includes Vite, Aspire AppHost, website hosts, watchers, build workers
and their child processes. Track process IDs when starting them, clean up after failures
as well as success, and verify that the processes have exited and their listening
ports have closed. Stop task-owned containers without deleting their data volumes.
Do not stop unrelated processes. Report the cleanup actually verified; a written
rule alone does not satisfy this requirement.

Use the root `DotNetLiguria.slnx` for all .NET projects. Keep live browser/database
checks opt-in. Publish applications using their project paths.
Use the checked-in SDK and Node pins, lockfiles and verification scripts when present.
Resolve upgrades from official release metadata; do not use forced peer resolution or previews.
Repository skills under `.agents/skills` describe modernization and fast verification.
Do not commit, deploy, rotate credentials or change machine-wide tooling without approval.
