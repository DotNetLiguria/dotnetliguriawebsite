# Importing the workshop JSON exports

**Online comparison and local repair: 2026-10-22.** All 44 exported event pages
matched the live website in the fields checked. March 5 now has separate folder
ownership and its exact online-original poster; the Test event was preserved.
See [the audit](data-import-audit.md) for evidence and remaining source limitations.

Publishing or starting the website does **not** import the JSON exports. Run
DataMigration explicitly from the same release as the website.

This revision contains 44 workshops, 35 speakers, 160 tracks and 135 file records;
the latest event date is 2026-05-07. This describes the checked-in export, not a
guarantee that the historical SQL database has no newer content.

The [asset review](data-import-assets.md) records 71 recovered file references,
four remaining source URLs returning 404, and four external poster references
whose original bytes were not verified. Review those limitations before production.

## Import behavior

`--from-json --update-existing` inserts missing workshops, speakers and files and
updates their mapped fields from JSON. Tracks are embedded in workshops;
`workshopTracks.json` is checked against the embedded track/workshop IDs before
any writes. Legacy upload paths resolve missing file/workshop relationships.
Folder, image and recovered-file ownership is explicit in `workshopFolders.json`,
`workshopImages.json` and `workshopFilePaths.json`, keyed by stable source IDs.
Adding an older event cannot renumber assets. All four SQL-export files and these
maps are packaged with DataMigration. `workshopAssetSources.json` records online
source URLs and SHA256 hashes for 111 verified assets. New events need reviewed
map entries; SQL export alone does not invent an asset association.

Existing ownership conflicts block import before writes. Moving an existing
event between folders requires the explicit `--repair-asset-folders` switch and
a reviewed map. Even that switch cannot take a folder owned by another event.
March 5 maps to `workshop-dcb2f15f-f653-469f-91e6-568cccc7ca2d`; Test keeps
`workshop043`. Forty online-original posters and 71 recovered file references
use ID-based paths under `Contents/imported`, preserving historical assets.

Existing workshop slugs and extra top-level BSON fields are preserved. Existing
mapped content, including tracks and speaker profile fields, is overwritten.
Records outside the export remain. Old random file IDs are reused for unambiguous
natural-key matches; distinct export IDs sharing a filename remain distinct.
Pre-existing duplicates/orphans are not automatically deleted.

Board/top menu are seeded only when empty; missing file types are inserted.
Questionnaires, responses, accounts, permissions, newsletters and other application
collections are untouched. [Historical questionnaires have a separate command](questionnaire.md#b8-migration-of-historical-data).

`--from-json` alone retains the older insert/skip behavior and cannot refresh an
existing dataset. Add `--dry-run` to validate exports and print current counts
without writing. Apply reads back each saved export record to verify its mapped
BSON fields. Writes are incremental, not transactional: after failure fix the
cause and rerun, or restore the backup. Do not later overwrite newer production
edits with a stale export.

## Local Aspire database

Start Docker Desktop and the existing Aspire stack/container. Keep its volume.
From the repository root identify the container:

```powershell
docker ps -a --filter ancestor=mongo:8.0.32 --format '{{.Names}} {{.Status}}'
```

Back up first. Substitute the real container name for `mongo-NAME` and use a fresh
archive filename each time. Keep backups private and outside publish artifacts.
Credentials below are read inside the container and are not printed.

```powershell
docker exec mongo-NAME sh -c 'mongodump --quiet --host localhost --ssl --tlsInsecure -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db DotNetLiguriaAspire --archive=/tmp/before-json.archive.gz --gzip'
if ($LASTEXITCODE -ne 0) { throw 'Backup failed' }
New-Item -ItemType Directory -Path .artifacts/private-backups -Force | Out-Null
docker cp mongo-NAME:/tmp/before-json.archive.gz .artifacts/private-backups/before-json.archive.gz
if ($LASTEXITCODE -ne 0) { throw 'Backup copy failed' }

pwsh -File src/dotnetliguriawebsite/DataMigration/import.ps1 -ContainerName mongo-NAME
pwsh -File src/dotnetliguriawebsite/DataMigration/import.ps1 -ContainerName mongo-NAME -Apply
```

If repairing the earlier shared-folder import, first verify the assets with
`pwsh -File scripts/verify-import-assets.ps1`, then run the helper with
`-RepairAssetFolders` for dry run and `-RepairAssetFolders -Apply` for apply.
Normal subsequent imports require no repair switch.

The helper defaults to dry run, requires the Aspire volume and loopback port,
targets `DotNetLiguriaAspire`, and restores its process environment afterward.
Insecure TLS is exclusively for the local Aspire certificate. Rerun `-Apply`
and confirm counts stay stable to check repeatability.

## Exact production release sequence

1. Select the release commit, all four SQL-export JSON files, the four ownership/
   provenance JSON files in `DataMigration/json`, and matching website `Contents`
   assets including `Contents/imported`. If the old SQL source has newer changes,
   first export them in a separate workspace using the approved SQL connection:
   run DataMigration **without arguments** from its project directory. This writes
   the four JSON files and stops; it does not import MongoDB. Review and package
   the new exports and matching media together. Skip SQL export when deploying
   the already reviewed checked-in data.
2. Build/test the release and publish each application by project path, from the
   repository root (these commands work on Windows and Linux):

   ```powershell
   dotnet build DotNetLiguria.slnx -c Release
   dotnet run --project tests/DotNetLiguriaCore.Tests -c Release --no-build
   dotnet publish src/dotnetliguriawebsite/DataMigration/DataMigration.csproj -c Release -o .artifacts/release/dataMigration
   dotnet publish src/dotnetliguriawebsite/DotNetLiguriaCore/DotNetLiguriaCore.csproj -c Release -o .artifacts/release/website
   pwsh -File scripts/verify-import-assets.ps1 -ContentRoot .artifacts/release/website/Contents -ManifestPath .artifacts/release/dataMigration/json/workshopAssetSources.json
   ```

   DataMigration publishes its `json` directory automatically. Keep this artifact
   private, separate from the public website. Both framework-dependent artifacts
   require .NET 10. Use the repository frontend build procedure when building a
   website release from source.
3. Obtain production import authorization. Put the website into maintenance mode
   and stop all writers. Back up production MongoDB **and media** using the
   [storage backup procedure](storage.md); retain the previous application release.
   Test restore into an isolated database. Keep writers stopped through validation
   so rollback does not lose intervening application writes.
4. Install the website release with its complete `Contents` directory, preserving
   separately managed/historical media. Install DataMigration into a private
   directory. Inject these through the deployment's secret mechanism:

   ```text
   DotNetLiguriaDatabase__ConnectionString = the production MongoDB URI
   DotNetLiguriaDatabase__DatabaseName = the exact production database name
   ```

   Verify the target independently. The default database name is `DotNetLiguria`,
   which may differ from your deployment. Override any non-default
   `DotNetLiguriaDatabase__*CollectionName` settings to match the website.
   Environment variables override JSON/user secrets. Use production authentication
   and validated TLS, never the local `tlsInsecure=true` option. No SQL connection
   is required for JSON import.
5. Change directory to the **published DataMigration directory** containing
   `DataMigration.dll`, `appsettings.json`, and `json/`. Run in order; stop if any
   command exits unsuccessfully:

   ```text
   dotnet DataMigration.dll --from-json --update-existing --dry-run
   dotnet DataMigration.dll --from-json --update-existing
   dotnet DataMigration.dll --from-json --update-existing --dry-run
   ```

   Review the first report's target database, export totals and current counts
   before apply. Successful apply includes per-record read-back checks. Counts
   may exceed export totals because unrelated records remain; do not drop
   collections to force equality. Optionally rerun apply and confirm stable counts.

   If the previous import assigned March 5 to `workshop043`, review the explicit
   folder map and verified asset paths, then add `--repair-asset-folders` to both
   dry run and apply. Preserve the prior owner's assets. Subsequent imports use
   the standard commands above. The repair switch never changes folder maps or
   copies files itself; deploy and hash-verify the media first.
6. Start the website with the same MongoDB target. Check public event list/detail
   APIs/pages, latest events, tracks, speakers and actual material/photo links.
   JSON stores metadata, not file bytes; DataMigration does not copy uploads.
   Missing links require original files at the corresponding published `Contents`
   paths. Check existing accounts/questionnaires and other application content.
   Reopen writes only after validation.
7. If checks fail, keep writers stopped and restore the paired database/media
   backup and previous application release using the storage recovery procedure.
   Do not restore over a live writable site.

No production import runs automatically during build, publish, startup or deploy.
