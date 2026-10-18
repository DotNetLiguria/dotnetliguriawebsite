# MongoDB storage review and backup runbook

## Scope and evidence

This review is based on the MongoDB serializers, services, migrations, and backup
implementation in this repository. The known database name and collection names are
configuration values; they are not hard-coded into the review.

An authenticated inspection of the running database is still required before treating
document counts, data size, or the deployed index catalog as fact. The local MongoDB
container accepts TLS connections but rejected unauthenticated catalog access during
this review. No documents, credentials, or production data were read or changed.

Run the following with an authorized, read-only operational account to record the
actual inventory. Do not copy sampled response documents into tickets or logs: some
collections contain personal data and free-text answers.

```javascript
// Run in mongosh after selecting the application database.
const collections = db.getCollectionNames()
  .filter(name => !name.startsWith("system."));

for (const name of collections) {
  const collection = db.getCollection(name);
  const stats = collection.stats();
  printjson({
    collection: name,
    documents: stats.count,
    dataSizeBytes: stats.size,
    storageSizeBytes: stats.storageSize,
    totalIndexSizeBytes: stats.totalIndexSize,
    indexes: collection.getIndexes(),
  });
}
```

Use the result to confirm the collection names below, detect historical collections
that are no longer used, and compare actual indexes with the required indexes.

## Current organization

All application document identifiers are GUIDs serialized as MongoDB `_id`; MongoDB
therefore provides the `_id_` unique index for every collection.

| Collection | Stored shape and relationship | Assessment |
|---|---|---|
| `Workshop` | Event aggregate: metadata, publishing flags, HTML/text, external ticketing fields, embedded `Location`, tracks, talks, agenda, and `Materials`/`Photos` lists. Talks contain both a speaker ID and display snapshots such as name, image, and biography. | Correct aggregate boundary for an event page: it is normally fetched as a whole and does not need joins. Keep embedded schedules and talk snapshots. Monitor document size; image/file content must remain outside MongoDB. |
| `Speaker` | Reusable speaker profile, email, Sessionize identifier, active flag, and normalized name. Talks/tracks refer to speakers and may duplicate display information. | Separate collection is appropriate because speaker profiles are reused. The duplicated talk data is a deliberate historical/read-model snapshot, but it must have an explicit synchronization policy. |
| `WorkshopFile` | File metadata and path/URL, type, and parent `WorkshopId`; binary content is not stored here. | Good separation of binary storage from document data. `Workshop.Materials` and `Workshop.Photos` are also serializable lists, so verify whether file metadata is being duplicated in both locations. Choose `WorkshopFile` as the source of truth and build response projections, or remove the redundant persisted representation after a migration. |
| `Board` | Board-member profile, contact/social links, active flag, and display order. | Small independent content collection. |
| `TopMenuElements` | Navigation label, URL, active flag, and display order. | Small independent content collection. |
| `Venue` | Venue name, address, map URL, capacity, and coordinates represented as a string. | Appropriate for the present name-sorted lookup. It is not geo-queryable. Migrate coordinates to GeoJSON only if proximity/map queries are introduced. |
| `Counter` | Named integer counters. One workshop counter is updated atomically with `FindOneAndUpdate`. | Appropriate for low-cardinality counters. Name lookup is currently case-normalized in the query rather than stored/indexed. |
| `Questionnaire` | Versioned questionnaire definition: lifecycle, respondent mode, consent text, open/close dates, optional workshop link, and embedded sections/questions/options. | Correct to embed a definition because it is read and versioned as one unit. Optimistic concurrency is used on `_id` plus `Version`. |
| `QuestionnaireResponse` | One response per document: questionnaire/version link, UTC submission time, optional identified respondent, consent, source/idempotency keys, and embedded answers. | Correct separation from the definition: responses are unbounded and must not be embedded in `Questionnaire`. This is the collection most likely to grow materially. It can contain names, email addresses, and unstructured feedback. |

`FileType` and `Feedback` appear in the data-migration configuration and legacy
models. They are not configured as current website runtime collections. Treat them as
historical until the live inventory confirms their presence and retention need; do not
drop them before exporting and approving a data-retention decision.

## Indexes

### Indexes created by the application

The questionnaire store creates the following indexes when its first write succeeds:

| Collection | Index | Purpose |
|---|---|---|
| `QuestionnaireResponse` | `{ QuestionnaireId: 1, SubmittedAt: 1 }` | Listing and counting a questionnaire's responses in submission order. |
| `QuestionnaireResponse` | unique sparse `{ UniqueEmailKey: 1 }` | Enforces one response per identified email when enabled. The key includes the questionnaire ID, so global uniqueness implements per-questionnaire uniqueness. |
| `QuestionnaireResponse` | unique sparse `{ SourceKey: 1 }` | Makes imports idempotent when source keys are consistently namespaced. |
| `Questionnaire` | `{ WorkshopId: 1 }` | Fetches questionnaires linked to a workshop. |

`Speaker` has a unique partial index on `NormalizedName`
(`uq_speakers_normalized_name`), but it is created by the duplicate-reconciliation
operation rather than at application startup. Do not assume it exists in every
environment until the inventory confirms it.

No application code declares indexes for the main workshop, file, board, menu, venue,
or counter query paths. Their deployed databases may have manually-created indexes,
which is why the authenticated catalog inspection is required.

### Required index migration

Apply the following only after checking duplicates with the live inventory. Run it as
a controlled migration, record the result, and keep the definitions in a repeatable
deployment/migration mechanism rather than relying on manual production changes.

```javascript
db.Workshop.createIndexes([
  {
    key: { Published: 1, EventDate: -1 },
    name: "published_eventDate_desc"
  },
  {
    key: { Published: 1, In_homepage: 1, EventDate: -1 },
    name: "published_homepage_eventDate_desc",
    partialFilterExpression: { Published: true, In_homepage: true }
  }
]);

db.WorkshopFile.createIndex(
  { WorkshopId: 1 },
  { name: "workshopId" }
);

db.Speaker.createIndex(
  { IsActive: 1 },
  { name: "isActive" }
);

db.Board.createIndex(
  { IsActive: 1, Order: 1 },
  { name: "isActive_order" }
);

db.TopMenuElements.createIndex(
  { IsActive: 1, Order: 1 },
  { name: "isActive_order" }
);

db.Venue.createIndex(
  { Name: 1 },
  { name: "name" }
);

db.Questionnaire.createIndex(
  { UpdatedAt: -1 },
  { name: "updatedAt_desc" }
);
```

The indexes match the current query shapes:

- published workshops and workshop archives are filtered/sorted by `Published` and
  `EventDate`; the home page additionally filters by `In_homepage`;
- files are loaded by `WorkshopId`;
- board and navigation pages filter by `IsActive` and sort by `Order`;
- venues are sorted by `Name`; and
- the administrative questionnaire list is sorted by `UpdatedAt`.

Do **not** add speculative indexes for fields that are not queried. Each index makes
writes and backups larger. Use `explain("executionStats")` for representative
production-shaped queries after creating these indexes.

`Counter.GetByNameAsync` upper-cases the field inside the query. A regular `{ Name: 1
}` index will not reliably serve that expression. If counters grow beyond a handful
of documents, add a maintained `NormalizedName` field and a unique index on it after
resolving case-insensitive duplicates. This is a low-priority refactor for the
current expected cardinality.

## Refactor priorities

The collection split itself does **not** need a disruptive redesign. The following
changes should be planned in priority order.

1. **Make index management repeatable.** Put the required index definitions in a
   startup-safe migration or an operational migration script with duplicate checks.
   Also ensure the speaker uniqueness index is installed during deployment, not only
   after a repair action.
2. **Eliminate ambiguous file duplication.** Confirm whether `Workshop.Materials`
   and `Workshop.Photos` persist the same metadata as `WorkshopFile`. If so, retain
   only one authoritative persisted form and construct the other as a read
   projection. This avoids stale file paths and doubled document size.
3. **Bound aggregate growth.** `Workshop` is an appropriate aggregate, but its
   HTML, talks, schedules, and material lists can grow. Alert well before MongoDB's
   16 MiB document limit. Keep actual images, videos, and attachments in object/file
   storage, retaining only paths, metadata, and optional checksums in MongoDB.
4. **Make date semantics consistent.** Questionnaire dates are explicitly UTC,
   whereas several workshop/legacy dates are serialized as local time. Introduce UTC
   fields through a backwards-compatible migration before changing reads; do not
   reinterpret existing local values in place.
5. **Manage PII and retention.** Identified questionnaire responses contain
   respondent details and arbitrary free text; speaker and board documents also may
   contain email addresses. Define access roles, a retention/deletion policy, and
   export/delete procedures. Backups inherit this sensitivity and need the same
   access and encryption controls.
6. **Add integrity reporting, not MongoDB joins.** MongoDB does not enforce the
   workshop/speaker/file/questionnaire references. Run a scheduled report for
   orphaned `WorkshopFile`, questionnaire, and speaker references. Preserve embedded
   talk snapshots as historical content rather than trying to normalize them away.
7. **Use schema versioning for future changes.** The BSON models intentionally ignore
   unknown fields, which helps compatibility but can hide schema drift. Add a
   `SchemaVersion` only when a migration requires it, validate new writes at the
   application boundary, and migrate existing documents in batches with rollback
   evidence.

For a large response volume, assess the all-questionnaire response-count aggregation
before redesigning it. The current `{ QuestionnaireId, SubmittedAt }` index serves
per-questionnaire reads; an aggregation that counts every questionnaire will still
scan response data. Cache/increment response counts only after measurement, and use
transactions or compensating updates so deletions remain correct.

## Existing application backup

`DatabaseBackupService` writes an application-level snapshot under
`DotNetLiguriaDatabase:BackupFolder`. It enumerates all non-system collections,
writes their documents as newline-delimited extended JSON, records collection
metadata and indexes in a manifest, and recreates indexes on restore. The protected
API exposes:

| Endpoint | Function |
|---|---|
| `GET /api/Backup/snapshots` | Lists valid snapshots. |
| `POST /api/Backup/export` | Creates a snapshot. |
| `POST /api/Backup/import` | Restores a selected snapshot after explicit replacement confirmation; it creates a safety snapshot first. |

The application does **not** schedule exports, set retention, encrypt snapshots, or
copy them off-host. The endpoint is useful for an authorized administrative export
and recovery workflow, but an external scheduler is more reliable for unattended
backups because it does not depend on an interactive API token.

## Automated backup policy

Use a MongoDB-native backup as the recovery backup:

- run daily at 01:30 local server time, outside expected event traffic;
- retain 35 daily copies, 12 monthly copies, and an off-site immutable copy;
- use a dedicated backup account with only the MongoDB `backup` role (and a separate
  restore account only when needed);
- use TLS, store its URI/certificate material in the server secret store rather than
  in this repository, task arguments, or logs;
- use a replica set and `mongodump --oplog` for a point-in-time-consistent dump. A
  standalone MongoDB instance cannot provide the same cross-collection consistency;
- checksum every archive, alert on non-zero exit status or an unexpectedly small
  backup, and restore into an isolated environment at least monthly.

Example backup command, where `MONGODB_BACKUP_URI` is supplied by a protected secret
provider to the backup service account:

```powershell
$timestamp = Get-Date -Format "yyyyMMddTHHmmssZ"
$destination = "D:\MongoBackups\dotnetliguria-$timestamp.archive.gz"

if ([string]::IsNullOrWhiteSpace($env:MONGODB_BACKUP_URI)) {
    throw "MONGODB_BACKUP_URI is not available to the backup account."
}

& mongodump --uri $env:MONGODB_BACKUP_URI --gzip --archive=$destination --oplog
if ($LASTEXITCODE -ne 0) {
    throw "mongodump failed with exit code $LASTEXITCODE."
}

Get-FileHash -Algorithm SHA256 $destination |
    Select-Object Algorithm, Hash, Path |
    ConvertTo-Json |
    Set-Content -NoNewline "$destination.sha256.json"
```

Create a scheduled task that runs a protected `.ps1` file containing that command:

1. Store the script outside the repository with ACLs limited to a dedicated backup
   service account. Give the account read access to the backup secret and write access
   only to the backup staging directory.
2. In Windows Task Scheduler, create a task under that service account, select **Run
   whether user is logged on or not**, set a daily trigger at `01:30`, and set the
   action to `powershell.exe -NoProfile -NonInteractive -File
   C:\Ops\Backup-Mongo.ps1`. Do not place the MongoDB URI in the action arguments.
3. After the archive and checksum are written, copy both to a separate encrypted,
   access-controlled backup destination. Apply retention there rather than deleting
   the only copy.
4. Configure task failure notifications and review the first successful run and its
   restore test.

On Linux, the same protected script can be scheduled with a service-account crontab:

```cron
30 1 * * * /opt/dotnetliguria/backup-mongo.sh >> /var/log/dotnetliguria/mongodb-backup.log 2>&1
```

If the deployment uses MongoDB Atlas, prefer Atlas continuous cloud backups with
point-in-time recovery and scheduled snapshots, then keep a periodic independent
`mongodump` copy for provider-independent recovery.

## Recovery test

At least monthly, restore one selected archive to an isolated MongoDB deployment,
compare collection names, document counts, and index definitions with the backup
manifest/live inventory, and exercise an application read against the restored
database. Never test a restore by replacing the live database. Document the restore
duration and the newest recovered timestamp so the recovery point and recovery time
objectives are measurable.

## Source references

- Runtime MongoDB settings and backup folder: `src/dotnetliguriawebsite/DotNetLiguriaCore/DotNetLiguriaDatabaseSettings.cs`
- Collection access/query paths: `src/dotnetliguriawebsite/DotNetLiguriaCore/Services`
- BSON document contracts: `src/dotnetliguriawebsite/DotNetLiguriaCore.Model`
- Questionnaire index initialization: `src/dotnetliguriawebsite/DotNetLiguriaCore/Services/Questionnaires/MongoQuestionnaireStore.cs`
- Logical snapshot and restore implementation: `src/dotnetliguriawebsite/DotNetLiguriaCore/Services/DatabaseBackupService.cs`
- Legacy/migration-only collection contracts: `src/dotnetliguriawebsite/DataMigration`
