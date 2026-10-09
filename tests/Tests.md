# Verification

Run from the repository root with PowerShell 7.4+, the pinned .NET SDK and Node:

```powershell
pwsh -File scripts/verify.ps1 -Native
pwsh -File scripts/verify-publish.ps1
```

The unit gate builds all fifteen .NET projects and runs frontend clean install,
typecheck, lint and production build before timing test execution. It rejects zero
discovery, reduced counts, skips, failures and process overruns. TRX, Vitest JSON
and elapsed timings are written under `.artifacts/test-results`.

| Suite | Baseline Tests | Median Seconds | Observed Maximum | Ceiling Seconds |
| --- | ---: | ---: | ---: | ---: |
| RepositoryRules.Tests | 23 | 4.719 | 5.209 | 20 |
| DotNetLiguriaCore.Tests | 23 | 4.063 | 4.448 | 15 |
| Questionnaire.Tests (non-native) | 18 | 5.283 | 5.442 | 20 |
| ServerQuestionnaire.Tests | 8 | 5.207 | 5.770 | 20 |
| Vitest | 28 | 17.107 | 18.575 | 60 |

Baseline: Windows, SDK 10.0.401, Node 24.14.0, one warmup and five green runs,
100 units total, zero skips. The backend was remeasured with the same five-run
method after adding two offline authentication-option tests; its ceiling did not
increase. The normal gate also passed on the updated Node 24.21.0/npm 11.19.0 pin
without increasing the frontend ceiling. Elapsed time includes process/runner startup. Restore,
build, tooling, native and browser/database checks are excluded. Ceilings are three
times observed maxima rounded up to five seconds. The checked-in source of truth
is [timing-budgets.json](../scripts/timing-budgets.json); update counts when adding
tests, and explain measured regressions before changing ceilings.

For a focused rerun after the relevant build/install:

```powershell
pwsh -File scripts/verify.ps1 -NoBuild -NoFrontendChecks
dotnet test tests/DotNetLiguriaCore.Tests -c Release --no-build
dotnet test tests/Questionnaire.Tests -c Release --no-build --filter 'Category!=Native'
dotnet test tests/ServerQuestionnaire.Tests -c Release --no-build
```

Use `-Measure -Runs 5` only to recalibrate locally after meaningful changes. It runs
an additional warmup and cannot bypass budgets in CI. Do not increase timeouts to
hide sleeps, external calls or a failing assertion. Frontend tests stub auth/fetch
and Axios and reset storage/state; circuit tests use FakeTimeProvider. EF tests
inspect metadata without database connections. BSON/JWT inputs are synthetic.

## Separate Checks

`-Native` runs two SkiaSharp/ZXing image checks after units with its own 120-second
deadline. Both passed on Windows and Ubuntu WSL (the Linux probe links the actual
decoder and existing tests using a local-only SDK). CI also executes the full hosted
project's native suite on Ubuntu. Keep platform
dependencies out of the timed pure-unit phase.

The publish gate restores nothing: run the shared gate first. It publishes the
website, hosted questionnaire, server questionnaire and migration executable to
fresh `.artifacts/publish` subdirectories. Asset hashes and client output are checked;
no migration or host is executed. CI runs both gates on Windows/Linux and builds
the Docker image on Ubuntu. Require both Verify jobs through branch protection.

Browser snapshots are opt-in. Provision a disposable application and database
yourself; never point these checks at real data. Install browsers for the built
Playwright test project using its generated `playwright.ps1`, explicitly set
`QUESTIONNAIRE_TEST_BASE_URL`, then run:

```powershell
dotnet test src/BlazorQuestionarioServer/BlazorQuestionarioServer.Tests/BlazorQuestionarioServer.Tests.csproj -c Release --filter 'Category=Browser'
```

The fixture fails early without an HTTP(S) URL, runs headlessly, and disposes
browsers/contexts even after initialization/navigation failure. Snapshots and live
OIDC/MFA/database integration were not run during the isolated modernization gate.
Full Linux application/image execution and host skill discovery still require their CI or
host-specific smoke checks; static configuration tests do not prove runtime success.

## Revalidation Completed: 2026-10-09

- [x] Checked the updated website startup source without changing the user's edits.
- [x] Forced Release recompilation (`-t:Rebuild`) of all 15 .NET projects: zero errors.
- [x] Clean frontend install, TypeScript check, lint and production build: passed; npm audit reported zero vulnerabilities.
- [x] All 100 units passed with zero failures/skips and within unchanged timing ceilings.
- [x] Separate native QR checks passed: two on Windows and two on Ubuntu WSL after rebuilding the linked production decoder/test probe.
- [x] All four executable publishes passed; all 12 SPA files matched by hash, and hosted client output and historical workshop samples were verified.

Toolchains: SDK 10.0.401, Node 24.21.0 and npm 11.19.0. Rebuild logs and test reports
are retained in ignored verification artifacts. No backend hosts or data migrations
were executed. Existing compiler/lint, large-bundle and AXA lifecycle warnings remain.

This completes local recompilation and isolated validation, not deployment approval.
Full Linux application/container execution, live browser/OIDC/database integration,
host discovery and the previously reported nine high builder-image findings remain
separate follow-ups; they are not marked as passed by this checklist.
