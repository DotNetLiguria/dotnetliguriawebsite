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

Prerequisites: the root-pinned SDK and Node version, Docker with Linux containers,
adequate container memory, and a trusted ASP.NET HTTPS
development certificate. Run `dotnet dev-certs https --trust` yourself if needed.
Aspire configures Vite HTTPS using that certificate; it does not need the
standalone frontend's manually supplied PEM files.

| Resource | Browser URL / storage |
| --- | --- |
| Website/API | https://localhost:5443; API below `/api`, files below `/Contents/` |
| React SPA | https://localhost:3443 |
| MongoDB | Pinned 8.0.32 container; database `DotNetLiguriaAspire` |

The questionnaire is part of the main React SPA and uses the website's MongoDB API.
Libraries/tests are built through the root solution, not runnable resources.
DataMigration is always manual; historical SQL Server/SQLite imports do not need
the retired applications. AppHost defines its own endpoints and ignores personal
application launch profiles.

The dashboard has resource status, structured logs, traces, and metrics.
Each server provides `/health` and `/alive`; the website readiness check pings
MongoDB. OpenTelemetry supplies server instrumentation. Standalone application
instrumentation and deployment remain supported.

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

Aspire uses the dedicated named volume `dotnetliguria-aspire-mongo`, not the legacy
Compose or production data. Generated
container passwords are kept outside source control in the AppHost secret store;
retain that store when reusing volumes. Do not print connection strings or
dashboard authentication tokens.

MongoDB connections consume Aspire's complete URI, including TLS/authentication
options. Certificate trust and hostname validation are required; do not disable
validation. The website's legacy DEBUG environment-file loader is skipped only
under Aspire, so it cannot redirect this stack to an existing MongoDB deployment.
MongoDB starts empty: the public SPA displays its empty-event state until a
workshop is supplied, rather than importing production content. See
[the explicit DataMigration procedure](questionnaire.md#b8-migration-of-historical-data) to populate
the local container from the checked-in JSON export or import historical answers.
Questionnaires are created through `/admin/questionnaires`; no SQL schema is initialized.

To reset, first stop this AppHost and its container. Use Docker Desktop to remove
**only this AppHost's stopped MongoDB container** and its named volume.
Never prune Docker globally or delete an entire repository/artifacts directory.
The retired questionnaire database files and old SQL volume are not started or
deleted by this launcher; retain them separately if historical imports are needed.

## Verification And Troubleshooting

Run the isolated gate and independent publish checks from the repository root:

```powershell
pwsh -File scripts\verify.ps1
pwsh -File scripts\verify-publish.ps1
```

With this local Aspire stack running, explicitly opt into live HTTP checks:

```powershell
pwsh -File scripts\verify-aspire.ps1
```

These live checks are separate from the timed unit gate. They require trusted
certificates and the MongoDB container. Restart the same AppHost
and repeat the checks to exercise persistent data. Live login/logout/MFA
also requires external Keycloak access and the correct client registrations;
passing local HTTP checks alone does not prove authentication.

If a port is occupied, stop the conflicting application you own rather than
silently changing the registered origins. If MongoDB fails readiness, check
certificate trust and container health. Inspect private
resource logs locally, without copying secrets to issues or chat.

Standalone application commands and project-specific publishing still work.
The old Compose setup is an alternative, never an Aspire prerequisite.
