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

Managed personal, Board and speaker photos use `ProfilePhotoSelections` and
`ProfilePhotoAssets`, described below. They are not embedded image bytes.

All application document identifiers are GUIDs serialized as MongoDB `_id`; MongoDB
therefore provides the `_id_` unique index for every collection.

| Collection | Stored shape and relationship | Assessment |
|---|---|---|
| `Workshop` | Event aggregate: metadata, publishing flags, HTML/text, external ticketing fields, embedded `Location`, tracks, talks, agenda, and `Materials`/`Photos` lists. Talks contain both a speaker ID and display snapshots such as name, image, and biography. | Correct aggregate boundary for an event page: it is normally fetched as a whole and does not need joins. Keep embedded schedules and talk snapshots. Monitor document size; image/file content must remain outside MongoDB. |
| `Speaker` | Reusable speaker profile, private stable account association, email, Sessionize identifier, active flag, and normalized name. Talks/tracks refer to speakers and may duplicate display information. | Separate collection is appropriate. Managed photo selections override images in public read projections by stable speaker ID; archived names and biographies are not rewritten. |
| `WorkshopFile` | File metadata and path/URL, type, and parent `WorkshopId`; binary content is not stored here. | Good separation of binary storage from document data. `Workshop.Materials` and `Workshop.Photos` are also serializable lists, so verify whether file metadata is being duplicated in both locations. Choose `WorkshopFile` as the source of truth and build response projections, or remove the redundant persisted representation after a migration. |
| `Board` | Board-member profile, contact/social links, active flag, and display order. | Small independent content collection. |
| `TopMenuElements` | Navigation label, URL, active flag, and display order. | Small independent content collection. |
| `Venue` | Venue name, address, map URL, capacity, and coordinates represented as a string. | Appropriate for the present name-sorted lookup. It is not geo-queryable. Migrate coordinates to GeoJSON only if proximity/map queries are introduced. |
| `Counter` | Named integer counters. One workshop counter is updated atomically with `FindOneAndUpdate`. | Appropriate for low-cardinality counters. Name lookup is currently case-normalized in the query rather than stored/indexed. |
| `Questionnaire` | Versioned questionnaire definition: lifecycle, respondent mode, consent text, open/close dates, optional workshop link, and embedded sections/questions/options. | Correct to embed a definition because it is read and versioned as one unit. Optimistic concurrency is used on `_id` plus `Version`. |
| `QuestionnaireResponse` | One response per document: questionnaire/version link, UTC submission time, optional identified respondent, consent, source/idempotency keys, and embedded answers. | Correct separation from the definition: responses are unbounded and must not be embedded in `Questionnaire`. This is the collection most likely to grow materially. It can contain names, email addresses, and unstructured feedback. |
| `ProfilePhotoSelections` | Unique scope key, optimistic version, source (`account`, `asset`, `none`), immutable asset reference or retained legacy URL. | Separate server-controlled selections prevent CRUD/import payloads from overwriting photo choices. Missing selection means legacy, not deliberate removal. |
| `ProfilePhotoAssets` | Opaque asset ID, ownership/provenance, checksums for normalized variants. | Binaries reside in the protected persistent media directory, never in MongoDB or published static files. |

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

## Managed profile photos

Personal photos are optional. A Board or speaker selection can follow the linked
account photo, select an existing image as a fixed copy, or use a new independent
upload. Fixed selections share immutable bytes, not future changes. Uploading a
Board/speaker image never replaces the account photo. Account-only images require
authenticated access; the media endpoint permits anonymous delivery only while a
public editorial profile selects the asset.

Board editors with `board.manage` and `speakers.read` can also select a fixed copy
from matching speaker profiles, including profiles without a linked account.
A speaker must have the same non-empty email (ignoring case and surrounding
whitespace) or the same surname (ignoring case, accents and extra whitespace).
Because profiles store a single full-name field, surname matching compares the
last word and requires both names to contain at least two words. Matching only a
first name is not sufficient. The server rechecks this match for previews and
copies; suggestions are never applied automatically.
This does not link accounts or change the speaker's photo. Historical speaker photos use the
same shipped name-based fallback as the public speaker list; explicit photo
removal still suppresses that fallback.

The photo editor's local current/proposed image URLs include a SHA256 query
version, so correcting a portrait under the same filename requests fresh bytes.
Stored legacy URLs remain unversioned. Candidate copy versions also include the
file hash; copying a source changed since preview requires reloading its status.

The same reuse choices are available in the personal photo editor and speaker
editor. Personal suggestions use the current name and email read server-side
from the Identity Provider, not caller-supplied profile fields. Access to the
admin dashboard and the source's `board.read` or `speakers.read` permission are
required to list, preview or copy editorial photos, including linked/public
profiles. Accounts without dashboard access can still upload or remove their
own photo, but cannot select Board or speaker photos.

New Board publication requires a photo. New profiles may be saved as drafts.
Previously published legacy profiles are not hidden merely by enabling this
feature. Removing a required photo explicitly confirms affected Board profiles
and unpublishes them, without changing the account's Board group membership.
Deliberate removal is stored as `none` so legacy/name-based fallbacks cannot
resurrect an image.

### Storage activation

Profile/account links require the reviewed unique partial identity indexes on
both Board and speaker collections. Set a protected
`DOTNET_LIGURIA_PROFILE_MONGODB_URI` environment variable and run
`pwsh -File scripts\configure-profile-account-indexes.ps1 -Mode Preview -DatabaseName <database>`.
The preview prints counts, never account identities or the connection string.
Resolve incomplete/duplicate links before a separately approved `-Mode Apply`.
The application inspects these indexes and fails closed; it does not create them
while saving a profile. This script has not been applied to real data as part of
the photo feature.

Speaker invitation setup is separate: an operator needs the explicitly
provisioned, nondelegable `access.users.create` permission, working realm SMTP,
enabled password/email required actions and an allowlisted invitation client/
redirect. Existing accounts are linked without password resets. A failed or
uncertain creation must be reconciled administratively, not repeated: durable
`<SpeakerCollection>AccountOperations` records prevent duplicate creation.
They are included in personal-data export/erasure when attributable by immutable
issuer/subject. An unresolved identity operation blocks privacy preflight rather
than attributing an account by an email guess.

Set `ProfilePhotos:Enabled=true` and `ProfilePhotos:Root` to a dedicated absolute
persistent directory outside the application/source/publish directory. The
directory and its ancestors must not be symbolic links. Do not expose it through
a web-server static mount. Grant only the application identity read/write access;
encrypt the volume and include it in the controller's external-copy inventory.
Do not reuse a directory containing other applications' files.
Photo mutations also require the existing `Privacy:ProtectedStorageApproved`
controller approval; enabling the photo feature does not grant that approval.

Aspire supplies a persistent host directory under the current user's local
application-data directory, `DotNetLiguria\ProfilePhotos`; override
`ProfilePhotos:Root` in AppHost configuration where needed. Containers must mount
a persistent volume at the configured absolute path. Missing/unsafe storage
blocks photo writes explicitly; deployment does not import legacy photos.

Uploads accept decoded JPEG/PNG/WebP up to 5 MiB, 8,192 pixels per dimension and
16 million total pixels. Animated/invalid images and invalid crop coordinates
are rejected. Orientation is normalized and metadata discarded; only 128/512
pixel WebP variants remain. SkiaSharp and its matching Linux native assets are
MIT-licensed; Windows/Linux native smoke checks are required when updating them.
No arbitrary remote image is downloaded server-side.

Writes use exclusive temporary files, immutable generated names, checksums and
conditional MongoDB versions. Incomplete upload metadata remains attributable;
successful mutations and the next coordinated backup remove only unreferenced
managed assets. The bounded library has a 1,000-asset ceiling;
photo mutations have a separate per-account 20/minute rate limit. A capacity or
I/O error is not reported as a successful replacement.

The current application uses the existing in-process privacy/backup operation
gate: run one active application writer against this media/database pair. Do not
scale to multiple writers without introducing a distributed operation lease.
Asset IDs and selection versions still provide uniqueness/stale-write rejection,
but are not a substitute for the cross-resource gate.

### Media-aware snapshots and privacy

New application snapshots use manifest version 2 and include a `photos` manifest,
checksums and every retained asset's two variants. MongoDB records and media are
captured under the shared operation gate; the safety snapshot includes both.
Restore validates the complete manifest and media before replacing data. Version
1 database-only snapshots remain readable, but restoring one with managed photo
references and missing media is rejected. External `mongodump` alone is not a
complete photo backup: coordinate the media volume with it.

Personal export includes attributable selections, metadata and normalized image
bytes (base64 in the JSON export, with an explicit bounded-size failure). Account
erasure removes attributable assets and fixed role copies, detaches account
links and suppresses legacy fallbacks. Unlinked speaker uploads are attributed
to that profile until a confirmed account link is made. Profile association is
never guessed by name. Public editorial names/biographies and unlinked shipped
historical or remote pictures remain separate controller-managed retention
boundaries; deleting managed photos is not a claim to erase external copies.
The existing erasure journal and snapshot purge include media snapshots. Volume,
reverse-proxy and browser copies remain subject to the external-copy approval;
public media uses revalidation rather than long-lived immutable caching.
