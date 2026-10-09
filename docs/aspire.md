# Aspire Development

## One Launcher

From the repository root:

```powershell
dotnet run --project src\DotNetLiguria.AppHost
```

The AppHost and hosting integrations are pinned to stable Aspire 13.6.1 and
target .NET 10. NuGet supplies DCP and the dashboard rather than a machine-wide
Aspire CLI bundle; the intentional ASPIRE010 suppression is documented in the
project. No preview dependencies or global CLI update are required.

Prerequisites: the root-pinned SDK and Node version, Docker with Linux containers
(SQL Server needs x64), adequate container memory, and a trusted ASP.NET HTTPS
development certificate. Run `dotnet dev-certs https --trust` yourself if needed.
Aspire configures Vite HTTPS using that certificate; it does not need the
standalone frontend's manually supplied PEM files.

| Resource | Browser URL / storage |
| --- | --- |
| Website/API | https://localhost:5443; API below `/api`, files below `/Contents/` |
| React SPA | https://localhost:3443 |
| Hosted WebAssembly questionnaire | https://localhost:62045 |
| Server-side Blazor questionnaire | https://localhost:62048 |
| MongoDB | Pinned 8.0.32 container; database `DotNetLiguriaAspire` |
| SQL Server | Pinned 2022-CU27-ubuntu-22.04 container; database `DotNetLiguriaAspireQuestionnaire` |
| SQLite | `.artifacts/aspire-data/questionnaire.db` |

The WebAssembly client is served by its existing server, not launched separately.
Libraries/tests are built through the root solution, not runnable resources.
DataMigration is always manual. Questionnaire models with identical Shared
assembly names remain isolated.
AppHost defines its own endpoints and ignores personal application launch
profiles and legacy hosted-questionnaire deployment-file overrides.

The dashboard has resource status, structured logs, traces, and metrics.
Each server provides `/health` and `/alive`; the website readiness check pings
MongoDB and local questionnaire initialization finishes before the host listens.
Existing external Application Insights export is disabled only for Aspire runs.
Standalone application instrumentation and deployment remain supported.

## External Keycloak And Secrets

Keep the existing provider and clients. Register the website callback origin
`https://localhost:5443/*` and SPA callback/silent-callback origin
`https://localhost:3443/*`. Existing schemes, callback paths, roles and MFA remain
unchanged.

Existing website `AuthServer` configuration and website user secrets continue to
work. Alternatively supply `AuthServer:Authority`, `AuthServer:ClientId`,
`AuthServer:Audience`, `AuthServer:MetadataAddress`, and `AuthServer:ClientSecret`
through AppHost user secrets or environment configuration. AppHost overrides are
injected into the website; the client secret is an Aspire secret parameter.

```powershell
dotnet user-secrets set "AuthServer:ClientSecret" "<server-client-secret>" --project src\DotNetLiguria.AppHost
```

Use your real value locally, not in source control, screenshots, or shared output.
Only public authority and SPA client ID (`Spa:ClientId`) can reach the browser.
The OIDC worker trusted domains must also match any custom external authority;
update its explicit provider entries if you deliberately change providers.
The default provider and local API HTTPS 5443 are already trusted.

`VITE_API_BASE_URL` is injected from the browser-facing website endpoint. This
also derives the case-sensitive `/Contents/` base; it is not a secret.
Aspire also sets `VITE_API_URL` so local Axios requests cannot be redirected by an
old frontend environment file. Standalone explicit overrides remain supported.

## Local Storage Safety And Persistence

Aspire uses dedicated named volumes `dotnetliguria-aspire-mongo` and
`dotnetliguria-aspire-sql`, not the legacy Compose or production data. Generated
container passwords are kept outside source control in the AppHost secret store;
retain that store when reusing volumes. Do not print connection strings or
dashboard authentication tokens.

MongoDB connections consume Aspire's complete URI, including TLS/authentication
options. Certificate trust and hostname validation are required; do not disable
validation. The website's legacy DEBUG environment-file loader is skipped only
under Aspire, so it cannot redirect this stack to an existing MongoDB deployment.
MongoDB starts empty: the public SPA displays its empty-event state until a
workshop is supplied, rather than importing production content.

Only explicit Aspire Development startup initializes questionnaire data. SQLite
must target the designated absolute local file; SQL must target the designated
database on a loopback host and explicit port. Other initialization targets are
rejected before writes. Fresh schemas come from the current EF model, not a
replayed production migration chain. One synthetic workshop, track, speaker, and
server current-workshop selection are added only to an empty workshop database.
Submissions and existing workshops are never replaced.

Repeated launch does not duplicate sample data. Existing incompatible local
schemas cause startup failure; reset explicitly rather than automatically dropping
tables or modifying production migrations.

To reset, first stop this AppHost and its containers. Use Docker Desktop to remove
**only this AppHost's stopped MongoDB/SQL containers** and their two named volumes.
For SQLite, remove **only** `.artifacts/aspire-data/questionnaire.db` and its
associated `questionnaire.db-wal` / `questionnaire.db-shm` files if present.
Never prune Docker globally or delete an entire repository/artifacts directory.

## Verification And Troubleshooting

Run the isolated gate and independent publish checks from the repository root:

```powershell
pwsh -File scripts\verify.ps1 -Native
pwsh -File scripts\verify-publish.ps1
```

With this local Aspire stack running, explicitly opt into live HTTP checks:

```powershell
pwsh -File scripts\verify-aspire.ps1
```

These live checks are separate from the timed unit gate. They require trusted
certificates, containers, and initialized local schemas. Restart the same AppHost
and repeat the checks to exercise persistent sample data. Live login/logout/MFA
also requires external Keycloak access and the correct client registrations;
passing local HTTP checks alone does not prove authentication.

If a port is occupied, stop the conflicting application you own rather than
silently changing the registered origins. If MongoDB fails readiness, check
certificate trust and container health. If SQL Server fails, check Linux container
mode, x64 compatibility, memory and volume/password consistency. Inspect private
resource logs locally, without copying secrets to issues or chat.

Standalone application commands and project-specific publishing still work.
The old Compose setup is an alternative, never an Aspire prerequisite.
