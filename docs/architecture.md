# Architecture

## Repository Layout

The repository contains three independently hosted .NET applications, a React SPA,
a data-migration executable and isolated verification projects. All fifteen .NET
projects target `net10.0`: eleven application/library/browser projects and four
unit-test projects. The website solution does not contain the questionnaire apps.

| Location | Responsibility |
| --- | --- |
| [DotNetLiguriaCore](../src/dotnetliguriawebsite/DotNetLiguriaCore) | ASP.NET Core API, authentication, static files and SPA fallback |
| [DotNetLiguriaCore.Model](../src/dotnetliguriawebsite/DotNetLiguriaCore.Model) | Website domain types, API contracts and BSON compatibility |
| [CommonAuth](../src/dotnetliguriawebsite/CommonAuth) | Keycloak cookie/OIDC setup and token helpers |
| [CommonWeb](../src/dotnetliguriawebsite/CommonWeb) | Development environment-file loading |
| [DataMigration](../src/dotnetliguriawebsite/DataMigration) | Historical SQL/EF data export and MongoDB migration |
| [dotnetliguriaspa](../src/dotnetliguriaspa) | React public/admin UI, Vite, TypeScript and Vitest |
| [BlazorQuestionario/Client](../src/BlazorQuestionario/Client) | Hosted WebAssembly questionnaire UI |
| [BlazorQuestionario/Server](../src/BlazorQuestionario/Server) | Hosted questionnaire HTTP endpoints, SQLite and QR uploads |
| [BlazorQuestionario/Shared](../src/BlazorQuestionario/Shared) | Hosted questionnaire validation/domain contracts |
| [BlazorQuestionarioServer/BlazorQuestionarioServer](../src/BlazorQuestionarioServer/BlazorQuestionarioServer) | Server-side Blazor, SQL Server and circuit telemetry |
| [BlazorQuestionarioServer/Shared](../src/BlazorQuestionarioServer/Shared) | Server questionnaire validation/domain contracts |
| [BlazorQuestionarioServer.Tests](../src/BlazorQuestionarioServer/BlazorQuestionarioServer.Tests) | Separate Playwright/Verify browser checks |
| [tests](../tests) | Four isolated unit suites, including executable repository standards |
| [DotNetLiguriaCore/wwwroot/workshops](../DotNetLiguriaCore/wwwroot/workshops) | Historical workshop assets, retained in place |

Build the website with `src/dotnetliguriawebsite/dotnetliguriawebsite.slnx`, the
hosted questionnaire with `src/BlazorQuestionario/BlazorAppQuestionario.sln`, and
the server questionnaire with `src/BlazorQuestionarioServer/BlazorQuestionarioServer.sln`.
The browser project and isolated tests are built separately by the shared gate.

Both questionnaire Shared projects retain assembly name and namespace
`BlazorAppTest.Shared`, but contain different models. They must not be referenced
together or casually renamed. Their unit suites run in separate test processes.

## Website Request Flow

```mermaid
flowchart LR
    Browser[React UI] --> API[ASP.NET Core controllers]
    Browser --> Static[wwwroot and /Contents]
    Browser --> Identity[Keycloak OIDC]
    API --> Auth[Cookie or JWT authorization]
    API --> Services[Website services]
    Services --> Mongo[(MongoDB)]
    API --> Stats[Pure feedback statistics calculator]
```

Controllers are mapped before the `index.html` fallback. `wwwroot` serves the SPA;
the separate `Contents` directory is exposed at the case-sensitive `/Contents`
path. Keep API URLs and content URLs distinct, especially on Linux. Historical
workshop archives, images and downloads must not be deleted by frontend staging.

Website services use MongoDB collections configured through
`DotNetLiguriaDatabase`. The model assembly owns persisted BSON and public JSON
contracts. `FeedbackStatisticsCalculator` contains the pure rating aggregation
used by both statistics endpoints; eleven bins, rounding, event grouping and
historical note semantics are covered without MongoDB.

## Authentication And Configuration

The website retains cookie/OIDC and JWT bearer schemes. Keycloak uses authorization
code flow with PKCE; the server cookie remains Secure and SameSite=None. JWT claim
mapping and existing role/acr policies are preserved. An unsatisfied OTP requirement
records the requested `acr` for the existing challenge flow. Pushed authorization
requests are explicitly disabled to retain the pre-upgrade provider behavior.

The SPA retains AXA OIDC callbacks, silent callbacks and service-worker URLs. A
postinstall script copies the worker from the installed OIDC worker package while
preserving the trusted-domain configuration. Live provider login/logout and MFA
still require an integration check with the deployment's registered origins.

Server secrets belong in ASP.NET user secrets or deployment secret configuration,
never in checked-in examples, frontend variables, certificates or Docker layers.
Development environment-file loading runs only in DEBUG builds. Vite variables are
public build-time data: `VITE_API_BASE_URL` controls service requests and
`VITE_API_URL` optionally overrides the shared Axios base URL. Existing
`REACT_APP_API_BASE_URL` and `REACT_APP_API_URL` names remain supported as fallbacks.
Only those legacy public settings are exposed by the compatibility bridge.

## Persistence Compatibility

MongoDB 3 no longer supports the old unspecified GUID serializer defaults.
`BsonCompatibility.Configure()` runs before website or migration executable work.
Its idempotent registration writes CSharpLegacy UUID bytes, matching the old
BSON 2.19.1 behavior, and reads both legacy and Standard UUID subtypes. Local date
annotations and JSON names remain unchanged. Tests use synthetic BSON/JSON, not
production documents; migration approval is still required for real data.

DataMigration reads historical SQL entities and writes export/MongoDB data. Build
and publish checks never execute it. Do not run it, rotate credentials or apply
schema changes against real data without explicit approval.

The hosted questionnaire uses the supplied `DefaultConnection-Sqlite` connection
configuration. The server questionnaire uses SQL Server `DefaultConnection` and
WebSocket-only Blazor circuits. Composite join keys and column mappings are tested
through EF metadata without opening either database. Their historically different
rating ranges are preserved rather than unified during modernization.

QR decoding uses ZXing with SkiaSharp and includes Windows and Linux native assets;
System.Drawing is not used. The decoder does not own the caller's input stream.
Native PNG decoding is checked separately from timed units. Existing QR prefix
matching, upload-count handling and questionnaire routes remain unchanged.

The circuit handler owns a disposable TimeProvider timer, publishes
`NumCircuitiAperti` every 30 seconds, and synchronizes circuit membership/counts.
Unit tests advance fake time and replace telemetry with an in-memory collaborator.
ApplicationInsights.AspNetCore stays at 2.23.0: newer 3.x removes the TrackPageView
API used by the existing component. This is a stable compatibility exception, not
permission to install previews or suppress peer-dependency conflicts.

## Toolchains And Publishing

`global.json` pins SDK 10.0.401 with stable latest-patch roll-forward; `.node-version`
pins Node 24.21.0 (npm 11.19.0). The original timing baseline used Node 24.14.0;
frontend timings are rechecked on the updated pin. Use `npm ci` and the
checked-in package lock. React 19, current compatible MUI and Vite replace CRA;
Vitest runs the frontend tests. Preserve the UI and routes during upgrades.

### Upgrade Inventory

Stable versions were resolved from official .NET release metadata, NuGet and npm
registries; manifests and the npm lock retain the exact selected versions.

| Area | Previous | Selected | Compatibility Decision |
| --- | --- | --- | --- |
| .NET targets | net6/net7/net9/netstandard | net10.0, SDK 10.0.401 | All eleven existing projects plus four unit projects |
| Microsoft ASP.NET/EF | Mixed 3/6/7-era dependencies | 10.0.12 | Replace removed hosting APIs; preserve DB models |
| MongoDB Driver/Bson | 2.19.1 | 3.12.0 | Explicit legacy-compatible GUID serializer |
| Swagger | 6.5.0 | 10.3.0 | Retain existing API metadata integration |
| React and types | 18 | 19.3.0 | Upgrade runtime, DOM and types together |
| CRA/TypeScript | react-scripts 5 / TS 4.9 | Vite 8.3.4 / TS 6.0.3 | New HTML entry and public environment bridge |
| MUI/Data Grid | 5 | Material 9.4.0 / Grid 9.15.0 | Grid, slots, pagination and selection API migration |
| Test runners | Legacy Jest/browser-only .NET checks | Vitest 5.0.3 / xUnit 2.9.3 | Separate isolated units from browser/native checks |
| QR imaging | Windows drawing bindings | ZXing Skia binding 0.16.24 / SkiaSharp 4.153.1 | Windows and Linux native assets |
| Application Insights | TrackPageView-based component | 2.23.0 | Stable API-compatible exception to breaking 3.x |

```powershell
pwsh -File scripts/verify.ps1 -Native
pwsh -File scripts/verify-publish.ps1
```

The first command restores/builds all projects, clean-installs the frontend, checks
types/lint/build, runs counted units with deadlines, then separate native checks.
The second publishes four executables into `.artifacts/publish` without executing
them. It compares every Vite output file by hash, checks historical workshop
samples, and verifies hosted WebAssembly client assets.

`npm run build` only produces `src/dotnetliguriaspa/dist`; it does not copy to source
`wwwroot`. Website `dotnet publish` overlays that built dist into the publish
artifact and replaces only matching SPA paths. Missing dist fails explicitly.
`PublishSpa=false` is an intentional API-only escape hatch, not the normal website
deployment. Use a fresh publish destination so obsolete generated assets cannot
accumulate across releases. Source historical content is never cleaned.

Build the Docker image from the repository root:

```powershell
docker build -f src/dotnetliguriawebsite/DotNetLiguriaCore/Dockerfile -t dotnetliguria .
```

The image builds the SPA with pinned Node, restores all referenced website projects,
and publishes with pinned .NET 10 SDK/runtime images. Public API build arguments
default to same-origin `/api`. The non-root runtime listens on HTTP 8080; provision
TLS and registered OIDC origins at the deployment boundary. The root dockerignore
excludes local environment files, certificates, private keys and generated output.
Do not place deployment secrets in image build arguments.

## Verification And Agent Guidance

See [test procedures](../tests/Tests.md) and
[timing budgets](../scripts/timing-budgets.json). The measured baseline is 100 units
with zero skips: 23 repository, 23 backend, 18 hosted questionnaire, 8 server
questionnaire and 28 frontend. Each suite has five warmed Windows runs, with the
backend remeasured after adding offline authentication-option coverage. Timings include process startup
but exclude restore/build, native, browser and database work. Ceilings are three
times observed maxima, rounded up to five seconds; dropped discovery counts,
skips, failures and timeout overruns fail the gate.

`.editorconfig` and build code-style settings support private-field naming.
Roslyn tests are the executable backstop for `_camelCase`, including implicit,
static, readonly and constant private fields, and one handwritten type per file
(including nested types, interfaces, records, enums, structs and delegates).
Razor code blocks and DEBUG/Release branches are scanned. Generated exemptions
require an expected generated filename and an auto-generated banner.

Root/scoped AGENTS.md files guide ownership and safety. Codex reads AGENTS.md and
canonical skills under `.agents/skills`; Claude uses CLAUDE.md and forwarding
`.claude/skills`; Copilot uses `.github/copilot-instructions.md` and forwarding
`.github/skills`. Shared skills cover dependency modernization and fast verification.
Their paths/frontmatter are checked, but instructions do not enforce code rules by
themselves and live host skill-discovery has not been smoke-tested.

The CI workflow runs the shared gate, native checks and publish checks on Windows
and Linux, plus an Ubuntu container build. Configure repository branch protection
to require both Verify checks; YAML alone does not configure that policy.

At modernization verification, all fifteen projects built, all 100 units and two
Windows-native QR checks passed, and all four publishes succeeded. Both native QR
checks also passed on Ubuntu WSL, linking the production decoder and existing tests
in an ignored probe with a checksum-verified local-only SDK 10.0.401. Full Linux
application builds/publishes and the image build were not run locally; Docker's
engine is not running, and the CI matrix is the remaining full platform gate.
Live OIDC, browser snapshots and real
database behavior were not exercised. Historical compiler/lint warnings and the
large frontend bundle warning remain; they are not silently treated as clean checks.
The editor image scan reports nine high findings in the Node 24.21.0 Alpine builder
(no critical findings after replacing the older image). This is a build-only stage,
not the final .NET runtime image, but its findings still need authenticated Scout
triage before deployment. Scout inspection could not proceed without Docker login.
The npm package audit passed with zero findings; that does not clear image findings.
Npm 11.19 also warns about unapproved AXA informational lifecycle scripts; the root
postinstall worker-sync step runs successfully without granting them extra permissions.