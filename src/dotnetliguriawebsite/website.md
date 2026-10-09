# Website Setup

Read [AGENTS.md](AGENTS.md) and [architecture](../../docs/architecture.md).
Use the root-pinned .NET 10 SDK and Node toolchain. From the repository root:

```powershell
dotnet build DotNetLiguria.slnx -c Release
dotnet test tests/DotNetLiguriaCore.Tests -c Release
```

## Configuration And Safety

The primary local entrypoint is the root [Aspire launcher](../../docs/aspire.md).
It provisions isolated MongoDB, injects the full generated URI, and exposes the
website at https://localhost:5443. External Keycloak and production publishing
remain unchanged. Legacy DEBUG environment-file loading is skipped for Aspire
so local orchestration configuration cannot be overwritten.

Provision an isolated MongoDB instance and matching Keycloak registration before
running the website. Supply `DotNetLiguriaDatabase` and `AuthServer` configuration
through ASP.NET configuration, keeping secrets in user secrets or deployment secret
storage. Configure the registered callback, signout and trusted frontend origins to
match the actual URLs. Never print or commit secrets or certificate contents.

The historical collections include workshops, workshopFiles, workshopSpeakers and
workshopTracks; service configuration also supplies the other collection names.
Do not use DataMigration as an automatic setup command. It can read SQL data and
write MongoDB/export files: execute it or change schemas only with explicit approval
and a reviewed backup/restore plan. The shared verification gate never needs a DB.

CommonWeb's environment-file loader is used in DEBUG builds. Keep environment files
out of source control and free of secrets; Release configuration must be supplied
through standard ASP.NET providers. Local launch profiles may choose different
ports, so explicitly set the frontend public API URL rather than assuming a match.

After configuration, the website can be run explicitly with its project path.
Use a trusted local development certificate for HTTPS; the separate Vite HTTPS
server requires its own supplied PEM paths. See [frontend setup](../dotnetliguriaspa/README.md).

## Publishing

Build the frontend using `npm ci` and `npm run build` in `src/dotnetliguriaspa` first.
Then, from the repository root:

```powershell
dotnet publish src/dotnetliguriawebsite/DotNetLiguriaCore/DotNetLiguriaCore.csproj -c Release -o .artifacts/publish/website
```

Vite produces dist only. Website publishing overlays dist into the artifact's
wwwroot, replacing matching SPA files but never deleting historical workshop
content. Missing dist fails explicitly; `PublishSpa=false` is for intentional
API-only artifacts. Use fresh output destinations. The root publish gate checks
SPA hashes, workshop samples and both website/DataMigration executable entrypoints
without running them. Historical SQL Server/SQLite questionnaire imports are owned
entirely by DataMigration; the running website only needs MongoDB.

Build Docker from the repository root using the website Dockerfile. The .NET 10
non-root runtime listens on HTTP 8080; supply TLS, secrets and identity-provider
registration at the deployment boundary. Images exclude local certificates and
environment files. Do not deploy or change real data as part of verification.

