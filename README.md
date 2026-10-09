# dotnetliguriawebsite
The DotNetLiguria website source code (ASP.NET Core)

## Development And Verification

Install the stable SDK selected by [global.json](global.json), Node selected by
[.node-version](.node-version), and PowerShell 7.4 or newer. From the repository root:

```powershell
pwsh -File scripts/verify.ps1 -Native
pwsh -File scripts/verify-publish.ps1
```

The shared gate builds every .NET project, checks the Vite frontend and enforces
counted, time-bounded units. Native QR checks are separate; browser and database
checks are not part of the unit gate. Publishing never executes an application.

Open [DotNetLiguria.slnx](DotNetLiguria.slnx) for all .NET projects, or run
`dotnet build DotNetLiguria.slnx -c Release`. Browser tests remain opt-in.

See [architecture](docs/architecture.md), [frontend setup](src/dotnetliguriaspa/README.md),
[website setup](src/dotnetliguriawebsite/website.md), and [test procedures](tests/Tests.md).
Read [AGENTS.md](AGENTS.md) and scoped guidance before editing. Canonical portable
skills live under [.agents/skills](.agents/skills), with Claude and Copilot adapters.

Do not execute DataMigration, apply schemas against real data, deploy, rotate
credentials or commit changes without explicit approval. Store secrets outside
source control and never expose them through frontend environment variables.

## Notes

The `docker-compose.yaml` file pulls and generates the image needed to run MongoDB in container

From this folder run (it will run and stay

```
docker-compose up -d
```

After this, you can start the container from Docker desktop directly.

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
