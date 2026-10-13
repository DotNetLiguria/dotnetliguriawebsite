# Verification

Run from the repository root with PowerShell 7.4+, the pinned .NET SDK and Node:

```powershell
pwsh -File scripts/verify.ps1
pwsh -File scripts/verify-publish.ps1
```

The unit gate builds the nine .NET projects and runs frontend clean install,
typecheck, lint and production build before timing test execution. It rejects zero
discovery, reduced counts, skips, failures and process overruns. TRX, Vitest JSON
and elapsed timings are written under `.artifacts/test-results`.

| Suite | Minimum Tests | Ceiling Seconds |
| --- | ---: | ---: |
| RepositoryRules.Tests | 25 | 20 |
| DotNetLiguriaCore.Tests | 97 | 15 |
| Vitest | 414 | 60 |

The backend suite covers authentication, BSON/JSON compatibility, questionnaire
validation, APIs, statistics, CSV export and historical migration mappings.
Repository rules also require all nine remaining projects to be in the root
solution, reject retired runtime dependencies and check the Aspire resource model
(website, SPA and MongoDB only). The four old feedback-statistics tests were removed
with the obsolete endpoints; replacement questionnaire-statistics tests remain.

Timing ceilings retain the earlier warmed Windows baseline (SDK 10.0.401); since
2026-10-12 Vitest runs on several workers (`vite.config.ts`, now four, one per CI
vCPU), which keeps the grown frontend suite under the same ceiling on CI runners.
Elapsed time includes process/runner startup; restore/build and live integration
checks are excluded. The checked-in source of truth is
[timing-budgets.json](../scripts/timing-budgets.json). Update counts when adding or
intentionally removing coverage, and explain measured regressions before changing
ceilings. The old questionnaire unit/browser suites and native decoder are removed,
not skipped; they have no verification switches or CI hooks.

For a focused rerun after the relevant build/install:

```powershell
pwsh -File scripts/verify.ps1 -NoBuild -NoFrontendChecks
dotnet test tests/RepositoryRules.Tests -c Release --no-build
dotnet test tests/DotNetLiguriaCore.Tests -c Release --no-build
```

Use `-Measure -Runs 5` only to recalibrate locally after meaningful changes. It runs
an additional warmup and cannot bypass budgets in CI. Do not increase timeouts to
hide sleeps, external calls or a failing assertion. Frontend tests stub auth/fetch
and Axios and reset storage/state; backend inputs are synthetic and require no
MongoDB, SQL Server, SQLite files, browsers or external identity service.

## Separate Integration And Publish Checks

The [local Aspire HTTP check](../scripts/verify-aspire.ps1) is explicitly opt-in
and requires the [isolated development stack](../docs/aspire.md) already running.
It is not part of the timed unit gate and never starts DataMigration. Container
persistence, authenticated questionnaire administration and Keycloak login/MFA
must be verified separately.

The publish gate restores nothing: run the shared gate first. It publishes only
the website and DataMigration into fresh `.artifacts/publish` subdirectories.
Every generated SPA asset is checked by hash, alongside historical workshop
samples and executable entrypoints. No migration or host is executed.
CI runs both gates on Windows/Linux and builds the Docker image on Ubuntu.
Require both Verify jobs through branch protection.

After frontend changes, also overlay `dist` into the locally served backend
`wwwroot` without deleting historical assets, and verify the current frontend
and API at https://localhost:5443. Port 3443 alone does not validate the
dashboard-linked website.
