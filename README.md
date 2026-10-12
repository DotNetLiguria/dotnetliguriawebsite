# dotnetliguriawebsite
The DotNetLiguria website source code (ASP.NET Core)

## Development And Verification

Install the stable SDK selected by [global.json](global.json), Node selected by
[.node-version](.node-version), and PowerShell 7.4 or newer. From the repository root:

```powershell
pwsh -File scripts/verify.ps1
pwsh -File scripts/verify-publish.ps1
```

The shared gate builds every .NET project, checks the Vite frontend and enforces
counted, time-bounded units. Live browser and database checks are not part of the
unit gate. Publishing never executes an application.

Open [DotNetLiguria.slnx](DotNetLiguria.slnx) for all .NET projects, or run
`dotnet build DotNetLiguria.slnx -c Release`. The solution contains nine .NET projects:
the website and migration tool, three website libraries, two Aspire projects and
two unit-test projects. The questionnaire is integrated into the React SPA and MongoDB.

See [architecture](docs/architecture.md), [frontend setup](src/dotnetliguriaspa/README.md),
[website setup](src/dotnetliguriawebsite/website.md), and [test procedures](tests/Tests.md).
Read [AGENTS.md](AGENTS.md) and scoped guidance before editing. Canonical portable
skills live under [.agents/skills](.agents/skills), with Claude and Copilot adapters.

The Keycloak login theme (`keycloak/`, outside the solution) is documented in
[docs/keycloak-theme.md](docs/keycloak-theme.md), including local testing and
the container-image build and deployment steps for production.

Do not execute DataMigration, apply schemas against real data, deploy, rotate
credentials or commit changes without explicit approval. Store secrets outside
source control and never expose them through frontend environment variables.

## Run All Applications With Aspire

Use the pinned .NET SDK/Node, a running Docker engine with Linux containers,
and a trusted ASP.NET development certificate (`dotnet dev-certs https --trust`).
From the repository root:

```powershell
dotnet run --project src\DotNetLiguria.AppHost
```

Alternatively select **Launch DotNetLiguria (Aspire)** in VS Code. One launcher
starts the website/API (https://localhost:5443), React SPA
(https://localhost:3443), and MongoDB. Open the dashboard URL printed by the launcher; its login token is
private. No global Aspire CLI installation/update is required: orchestration
dependencies are restored from pinned Aspire 13.6.1 NuGet packages.

Keycloak remains external. Supply its server client secret using website user
secrets or AppHost user secrets, never frontend variables. The existing provider
must allow `https://localhost:5443/*` and `https://localhost:3443/*`. See
[Aspire development](docs/aspire.md) for configuration, storage safety, and checks.
The website and DataMigration retain independent publishing.

Aspire creates **new isolated databases** and persists them across launcher
restarts. It never starts DataMigration or touches existing databases. Use the
explicit migration procedures in [questionnaire documentation](docs/questionnaire.md)
to populate an empty local database. Stop the launcher before resetting its data.

The existing `docker-compose.yaml` is a legacy/manual MongoDB alternative, not
part of the Aspire startup. Do not start it to prepare the Aspire stack or reuse
its volume for development initialization.

## backup/restore

```
mongodump -u<mongodbUsername> -p<mongodbPassword> --archive=/tmp/backup.gz --gzip --db <mongodbDatabase>
unzip the backup copied
	cd \tmp
	tar xzfv backup.gz

Restore the database (dump is the folder with the unzipped data):
	mongorestore --verbose -u root -p <password> --nsInclude="*" /tmp/dump/
```

## Client tools
[Windows download](https://www.mongodb.com/try/download/compass)

[Ubuntu download](https://www.digitalocean.com/community/tutorials/how-to-install-mongodb-on-ubuntu-20-04)
