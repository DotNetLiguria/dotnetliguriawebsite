# Website deployment

This guide describes a single-host Docker deployment with two long-running services:

1. MongoDB, reachable only on the private Docker network.
2. `DotNetLiguriaWebCore`, the ASP.NET Core site with the React app built into its published `wwwroot`.

The repository Dockerfile already runs `npm ci`, builds the React application, and includes its `dist` output in the website publish. Build and push an immutable image from the repository root before deploying it through Portainer:

```cmd
build-and-push-dotnetliguria.cmd 1.0.0
```

Use a new immutable version for every release; the batch file refuses to overwrite an existing registry tag. Use a pinned MongoDB image version that you have qualified, rather than `latest`. Keep deployment secrets in protected files mounted read-only outside the repository. Never commit real `.env`, `secrets.json`, connection strings, PEM files, private keys, or backups.

## Network and port map

| Service | Container port | Host mapping | Exposure |
| --- | ---: | ---: | --- |
| MongoDB | 27017/tcp | None | Private Docker network only; do not publish to the internet or host interfaces. |
| DotNetLiguriaWebCore | 8443/tcp | `443:8443` | Public HTTPS. Route the domain to this port and allow inbound 443 only. |

For local-only testing, bind the website to loopback, for example `127.0.0.1:8443:8443`. The production example uses Kestrel TLS directly. If a trusted reverse proxy terminates TLS instead, publish only the website's HTTP 8080 to that proxy on a private network, do not publish 8080 publicly, and set `Security:KnownProxies` to the proxy's exact container IP address(es). The proxy must overwrite forwarded headers; do not trust forwarded headers from arbitrary clients.

## Persistent storage

| Service | Container path | Purpose |
| --- | --- | --- |
| MongoDB | `/data/db` | MongoDB database files; use a protected host filesystem. |
| MongoDB | `/data/configdb` | MongoDB configuration-server files; use a protected host filesystem. |
| DotNetLiguriaWebCore | `/app/Contents` | Public website content and workshop/event assets. This tree is writable because new event content is created at runtime. |
| DotNetLiguriaWebCore | `/data` | Snapshot-managed private workshop uploads and profile photos. |
| DotNetLiguriaWebCore | `/backups` | Application snapshots plus privacy-control files under `/backups/.privacy`. Protect and back up this directory. |
| DotNetLiguriaWebCore | `/not-in-snapshot/data-protection-keys` | ASP.NET Core Data Protection keys. These protect authentication and encrypted policy state; back them up with `/backups`. |
| DotNetLiguriaWebCore | `/not-in-snapshot/logs` | Rolling application logs. Keep them out of public paths and apply retention/access controls. |
| DotNetLiguriaWebCore | `/not-in-snapshot/newsletter-operations` | Newsletter operational state and recovery markers. Back this up with the database/snapshot set. |
| DotNetLiguriaWebCore | `/data/private-uploads` | Private workshop assets that must not be served as public static files. |
| DotNetLiguriaWebCore | `/data/profile-photos` | Profile photo files when local profile-photo storage is enabled. |
| DotNetLiguriaWebCore | `/run/tls` | Read-only mount for the PEM certificate and private key. |

The repository separates website persistence into four sibling directories under `.persisted/`:

| Repository directory | Container mount | Contents and backup coverage |
| --- | --- | --- |
| `.persisted/contents` | `/app/Contents` | Public assets and dynamic event content. Entire tree is copied into each admin snapshot. |
| `.persisted/data` | `/data` | Private workshop uploads and profile-photo files. Referenced files are copied into each admin snapshot. |
| `.persisted/backups` | `/backups` | Admin snapshots and `.privacy` control files. Snapshots include all MongoDB collections and the snapshot-managed files above. |
| `.persisted/not-in-snapshot` | `/not-in-snapshot` | Data Protection keys, logs, and newsletter operational state. These are outside admin snapshots and must be protected by a separate host-level backup. |

Keep `.persisted/contents` writable because event creation and content updates write there. Persisted content is not bundled into the website image; a fresh deployment gets it through the snapshot import below. The image's React app remains in `wwwroot` and does not need a volume.

The current public content folders are:

| Repository folder | Purpose |
| --- | --- |
| `.persisted/contents/imported` | Imported event media and files, organized under the existing import structure. |
| `.persisted/contents/newsletters` | Public newsletter images and related content referenced by the site. |
| `.persisted/contents/profile` | Existing public profile images used by site pages. |
| `.persisted/contents/speakers` | Existing public speaker portraits used by site pages. |
| `.persisted/contents/workshops` | Event pages, workshop images, and public workshop material. New event content is written here. |

### `.persisted` inventory and backup status

| Folder / files | What it contains | Admin snapshot? | Recovery treatment |
| --- | --- | --- | --- |
| `.persisted/contents/**` | The complete public content tree, including runtime-created files. | **Yes.** Every file is listed and checksummed in each snapshot. | Restore with the database snapshot. Size storage for the full source content tree; a populated workspace currently has 269 files (about 305 MB), and live content can be larger. |
| `.persisted/data/private-uploads/**` | Private workshop files whose metadata is stored in `WorkshopFile`. | **Yes, when referenced by records.** | Restore matching records and files together. Orphan files are not included by the snapshot feature. |
| `.persisted/data/profile-photos/**` | Local profile-photo variants and assets. | **Yes, when profile-photo assets exist.** | Restore the MongoDB photo metadata and corresponding image variants together. |
| `.persisted/backups/<snapshot-id>/**` | Complete application snapshots: all non-system MongoDB collections, `contents/`, referenced private uploads, and photo assets. | These folders **are** the snapshots; they are not recursively copied into another snapshot. | Keep multiple protected copies and transfer a complete snapshot folder for admin import. Also include in host-level backup/off-site retention. |
| `.persisted/backups/.privacy/backup.epoch` | The local privacy boundary for snapshot restore checks. | **No.** The selected snapshot records its own epoch in `manifest.json`. | Include in host-level backup for recovery of an existing instance. For the first import into a truly empty database, do not transfer this file; import adopts the selected snapshot's epoch. |
| `.persisted/backups/.privacy/retention.policy` | Encrypted retention overrides for privacy erasure. | **No.** | Host-level back up with `.persisted/not-in-snapshot/data-protection-keys`, which are required to decrypt it. If omitted, runtime configuration defaults apply. |
| `.persisted/backups/.privacy/*.operation` | Encrypted in-progress privacy-erasure journal entries. | **No.** | Snapshot creation is blocked while erasure is in progress. Preserve these for operational recovery; do not blindly apply stale operations to a new instance. |
| `.persisted/not-in-snapshot/data-protection-keys/**` | Keys for protected cookies and encrypted policy/journal files. | **No.** “Not in snapshot” means excluded from the admin application snapshot; it still needs a protected host-level backup. | Back up securely with `.persisted/backups/.privacy/retention.policy`; loss invalidates protected cookies and can make saved policy state unreadable. |
| `.persisted/not-in-snapshot/newsletter-operations/**` | Newsletter restore/suspension markers. | **No.** | Include in host-level continuity backups so a restored deployment does not accidentally lose operational suspension state. |
| `.persisted/not-in-snapshot/logs/**` | Rolling application logs. | **No.** | Not required to restore the application. Retain per the logging policy or ship to a protected central log service; a long-term backup is optional. |
| `/docker_data/containers_data/mongodb/db` | MongoDB's physical database files. | The admin snapshot captures logical collections, not these files. | Keep the bind mount durable; use the separate daily `mongodump` procedure as another recovery copy. |
| `/docker_data/containers_data/mongodb/configdb` | MongoDB's configuration-server files. | The admin snapshot captures logical collections, not these files. | Keep the bind mount durable with the database files. |
| TLS certificate/key mount `/run/tls` | Kestrel certificate and private key. | **No.** | Manage and back up through the certificate/secret-management process, outside the repository and application snapshots. |

The admin snapshot implementation copies the full `contents` tree and only private workshop uploads referenced by the database. It adds profile-photo assets when profile photos are enabled and present. It does not read `.persisted/backups` or `.persisted/not-in-snapshot`; those roots are outside the snapshot payload by design. The `.gitignore` rules control Git tracking only and do not determine what the admin snapshot includes.

The application creates the required directories at startup. Give the website container write access only to these four mapped roots, and no broader host filesystem access. Keep `/data`, `/backups`, and `/not-in-snapshot` outside public static paths and apply restrictive permissions. Back up `.persisted/backups` and `.persisted/not-in-snapshot` together: `/backups/.privacy/retention.policy` is encrypted using the Data Protection key ring in `/not-in-snapshot/data-protection-keys`. Losing the key ring can invalidate protected authentication/session data and make the saved retention policy unreadable. Logs can follow a shorter retention policy, but must remain access-restricted.

MongoDB `/data`, website `/data`, `/backups`, `/not-in-snapshot`, and `/app/Contents` are separate persistent mounts. Admin snapshots include every non-system MongoDB collection, the full `Contents` tree, referenced private workshop uploads, and profile-photo assets when present. The separate daily `mongodump` and host-level backup remain useful independent recovery layers.

The stack's `prepare-storage` service creates the persistent host-side roots and
assigns them to the container user before MongoDB or the website starts.

The React build is in the image's `wwwroot` and does not need a volume. Do not mount a host `wwwroot` over it.

## MongoDB credential files

MongoDB keeps its existing `_FILE` credential mechanism. The production Compose stack
mounts the following Compose secrets read-only at `/run/secrets`. Each source file
contains only the value; a trailing newline is ignored. Do not enter their contents
as Portainer environment values.

| Service | Host secret file | Container path | Environment variable |
| --- | --- | --- | --- |
| MongoDB | `/docker_data/global_secrets/MONGO_INITDB_ROOT_USERNAME_FILE.txt` | `/run/secrets/mongodb_root_username` | `MONGO_INITDB_ROOT_USERNAME_FILE` |
| MongoDB | `/docker_data/global_secrets/MONGO_INITDB_ROOT_PASSWORD_FILE.txt` | `/run/secrets/mongodb_root_password` | `MONGO_INITDB_ROOT_PASSWORD_FILE` |
| Website | `/docker_data/global_secrets/MONGO_APP_USERNAME_FILE.txt` | `/run/secrets/mongo_app_username` | `MONGO_APP_USERNAME_FILE` |
| Website | `/docker_data/global_secrets/MONGO_APP_PASSWORD_FILE.txt` | `/run/secrets/mongo_app_password` | `MONGO_APP_PASSWORD_FILE` |

The website uses these two application credentials only to build its MongoDB connection
string, URL-encoding both values and connecting to the private `mongodb` service.

## ASP.NET Core key-per-file configuration

All website configuration that must stay outside the repository is loaded with
ASP.NET Core's `KeyPerFileConfigurationProvider` in every environment. Every file
name is a configuration key, and its content is the value: double underscores map to
configuration colons. For example, `AuthServer__ClientSecret` provides
`AuthServer:ClientSecret`.

The website reads the absolute directory set by the non-secret
`DOTNETLIGURIA_CONFIG_DIRECTORY` environment variable. The production stack sets it
to `/run/dotnetliguria-config` and mounts
`/docker_data/global_secrets/dotnetliguria` there read-only. When the variable is not
set on a developer workstation, the website and PowerShell provisioner both use
`%LOCALAPPDATA%\DotNetLiguria\configuration`.

Do not use `.txt` extensions or `_FILE` suffixes in this directory. Each file must
contain one raw value without quotes or a trailing newline. Key-per-file is registered
after the normal ASP.NET Core configuration sources, so these values override
`appsettings.json` and environment variables.

Do not create the individual files manually. Create one protected, untracked
`KEY=value` input file outside the repository with these keys:

```text
AuthServer__ClientSecret
AuthServer__ClientId
Privacy__ProtectedStorageApproved
Privacy__IdentityAttributePermissionsApproved
Privacy__AdminClientSecret
Privacy__AdminClientId
PermissionDirectory__ServiceClientSecret
PermissionDirectory__ServiceClientId
PermissionDirectory__ProtectedGroupIds__0
PermissionDirectory__ProtectedGroupIds__1
PermissionDirectory__Issuer
PermissionDirectory__InvitationRedirectUri
PermissionDirectory__InvitationClientId
PermissionDirectory__InvitationLifespanSeconds
PermissionDirectory__BoardGroupId
PermissionDirectory__ApplicationClientId
PermissionDirectory__AllowedInvitationRedirectUris__0
PermissionDirectory__AllowedIdentityHost
Newsletters__SmtpHost
Newsletters__SmtpPort
Newsletters__SmtpUseStartTls
Newsletters__SmtpUserName
Newsletters__SmtpPassword
Newsletters__SenderAddress
Newsletters__DefaultTestAddress
```

The preferred deployment workflow starts on the development machine. It reads the
website's local User Secrets, prompts for the LXC SSH host and username, then uses
one SSH authentication prompt. When the LXC `root` account is used, it streams the
temporary configuration and provisioner through that one SSH connection, then materializes
`/docker_data/global_secrets/dotnetliguria`, and removes the temporary remote files:

```powershell
pwsh -File scripts\provision-dotnetliguria-config.ps1 -DeployToLxc
```

As an operational fallback, run the non-secret
`scripts/provision-dotnetliguria-config.sh` directly on the deployment host with a
protected `KEY=value` input file:

```sh
sudo sh /secure/path/provision-dotnetliguria-config.sh /secure/path/dotnetliguria.production.env
```

For development, run the PowerShell provisioner with no arguments. It imports the
existing website project User Secrets into the same key-per-file format and writes to
the website's default development directory, so no additional environment variables,
input files, or per-profile settings are required:

```powershell
pwsh -File scripts\provision-dotnetliguria-config.ps1
```

The development User Secrets and the production input file can contain different
values, such as their respective invitation URLs, but they must use the same keys and
key-per-file workflow.

The script never prints values and rejects unknown, duplicate, missing, or empty
authentication, permission-directory, and required newsletter-transport values. Empty
SMTP username/password and the newsletter test recipient remain valid when SMTP
authentication or test delivery is intentionally disabled. Keep
the input file in the approved secret store for future rotations, or securely remove
it after provisioning. Rerun the same command and redeploy the stack after changing a
value. Do not include `Kestrel__Certificates__Development__Password` in production:
the stack uses the mounted PEM certificate and key instead.

To enable Eventbrite synchronization, add the optional
`Eventbrite__PrivateToken`, `Eventbrite__OrganizationId`, and
`Eventbrite__OrganizerId` settings to the same input file. All three are needed.
`Eventbrite__AccessToken` is still accepted as a legacy alias for the Private Token.
For an encrypted website PEM private key, also add the optional
`Kestrel__Endpoints__Https__Certificate__Password` key.

## First deployment and admin snapshot import

The admin dashboard imports a snapshot already staged on the website's backup volume; it does not upload a snapshot from the browser. A current snapshot contains `manifest.json`, MongoDB collection JSONL files, public `contents/`, private `workshop-uploads/`, and profile-photo assets when enabled. The manifest records file sizes and SHA-256 checksums, and import rejects missing, changed, extra, or unsafe-path assets before changing the database. Each snapshot copies the full public `Contents` tree, so size `.persisted/backups` for that tree per retained snapshot, plus MongoDB data and private media; there is no cross-snapshot deduplication. Plan enough protected free disk space for the source snapshot, an import safety snapshot of the empty target database, and the restored files. Snapshots contain personal data; encrypt them at rest and in transit and restrict access like the live database.

For a new deployment, follow this order:

1. On the source deployment, use **Admin dashboard → Backups → Create snapshot**. Wait for successful completion and copy the complete generated snapshot directory, preserving its snapshot ID and every file beneath it. Do not copy only `manifest.json` or only the MongoDB JSONL files.
2. Transfer the complete snapshot folder securely to the target host. Place it at `/docker_data/containers_data/dotnetliguria/backups/<snapshot-id>/` so the container sees `/backups/<snapshot-id>/manifest.json`. Keep the snapshot ID directory name intact. To preserve the source retention policy, also copy `.persisted/backups/.privacy/retention.policy` and its matching `.persisted/not-in-snapshot/data-protection-keys/` key ring; copy `newsletter-operations/` markers when preserving newsletter suspension state. Do not copy `.privacy/backup.epoch` to a fresh database: the import establishes its epoch from the snapshot. A successfully created snapshot cannot be made while an erasure operation is pending, so do not copy stale `.operation` files into the fresh deployment.
3. Start MongoDB with an empty `DotNetLiguria` database, then start the website with its production secrets, HTTPS certificate, and all four mounts. The app creates empty storage directories at startup. The website's MongoDB user must have the required database read/write and collection/index management permissions.
4. Open the production HTTPS website, authenticate as an administrator with the required recent MFA, then open **Admin dashboard → Backups**. Confirm the staged snapshot appears and select **Import**. Review the explicit confirmation and complete the import. The application validates collection files, photo assets, public content, private uploads, and checksums before changing the database. It first writes a safety snapshot of the empty target state.
5. On a fresh target only, when the database has zero documents and no local `.privacy/backup.epoch`, import adopts the validated snapshot's privacy epoch. This permits the first import while preserving the erasure boundary represented by that snapshot. An existing epoch must match; a non-empty database without an epoch is not considered fresh. Those cases are rejected when the epochs differ.
6. Verify the dashboard reports completion, check representative event pages and protected downloads, confirm expected records and photos, and review logs. Keep the source snapshot until verification and your retention process permit deletion. After the import, create a new snapshot on the target and confirm it is listed.

If importing an older snapshot created before media was included, the restore is allowed only when every referenced local asset is already present on the target. Otherwise create a new snapshot from the source deployment first. Never “solve” a failed validation by importing database JSONL files manually: that can leave public or private file references broken.

The website snapshot is an application-level recovery/export set. It complements, but does not replace, the daily MongoDB `mongodump` archive and coordinated host backup of `.persisted/backups` plus `.persisted/not-in-snapshot` (especially Data Protection keys and newsletter operation state).

For an existing installation migrating from the previous layout, stop the website container during the file move (MongoDB can remain online). Copy the old backup directory as a whole so hidden `.privacy` files are preserved; copy the three non-snapshot subdirectories to their new sibling root. Keep the old source directories until the new container starts successfully and the copied contents have been verified. Private uploads and profile photos remain under `.persisted/data`.

```sh
mkdir -p /docker_data/containers_data/dotnetliguria/backups \
  /docker_data/containers_data/dotnetliguria/not-in-snapshot
rsync -a /srv/dotnetliguria/.persisted/data/backups/ \
  /docker_data/containers_data/dotnetliguria/backups/
rsync -a /srv/dotnetliguria/.persisted/data/data-protection-keys/ \
  /docker_data/containers_data/dotnetliguria/not-in-snapshot/data-protection-keys/
rsync -a /srv/dotnetliguria/.persisted/data/logs/ \
  /docker_data/containers_data/dotnetliguria/not-in-snapshot/logs/
rsync -a /srv/dotnetliguria/.persisted/data/newsletter-operations/ \
  /docker_data/containers_data/dotnetliguria/not-in-snapshot/newsletter-operations/
```

## Start the Portainer stack

Publish the immutable website image, then deploy the repository's root
`docker-compose.yaml` through the Portainer Web editor. The stack creates the private
MongoDB network, publishes only HTTPS, and does not accept secret values as Portainer
environment variables.

The `prepare-storage` service creates the persistent MongoDB and website bind-mount
directories and assigns them to `10000:10000` before either long-running service
starts. Before deploying, create only the global certificate and secret directories:

```sh
sudo install -d -m 700 \
  /docker_data/global_certs/dotnetliguria \
  /docker_data/global_secrets
```

Create the four files listed in [MongoDB credential files](#mongodb-credential-files)
with their actual values, then use
`scripts/provision-dotnetliguria-config.sh` to materialize the ASP.NET Core
configuration directory. Place the PEM certificate and key in
`/docker_data/global_certs/dotnetliguria/` before deploying. The stack does not
create empty secret or certificate files: startup must fail rather than accept
missing credentials or TLS material.

The one-shot `mongodb-init` service waits for MongoDB health, then creates or updates
the application user named by `MONGO_APP_USERNAME_FILE.txt`. It synchronizes that user's
password and `readWrite`/`dbAdmin` roles for the `DotNetLiguria` database from the
secret files on every stack deployment. Change `MONGO_APP_PASSWORD_FILE.txt` and redeploy
the stack to rotate the application password. Keep the root credentials for
initialization, administration, and backups only.

For an existing MongoDB 8.0 data volume, follow MongoDB's documented 8.0-to-9.0 upgrade procedure: take a verified logical backup, validate the upgrade in staging, and keep the previous image available until the application has completed its burn-in period. Do not remove or recreate the persistent volume as part of this image update.

The website's TLS, MongoDB-secret, and key-per-file configuration mounts are read-only.
Restrict the host firewall to public HTTPS and trusted administrative access. For
updates, build and scan a new immutable image, take a database backup, then redeploy
the stack with a new image tag while retaining the persistent bind mounts. Avoid
`docker compose down -v` and any command that removes data directories during routine
releases.

## Website configuration

ASP.NET Core reads environment variables using double underscores in place of
configuration colons. The same spelling is the key-per-file filename in the
production configuration directory; for example, `AuthServer:ClientSecret` becomes
`AuthServer__ClientSecret`.

### Required for production

| Configuration key | Environment variable or key-per-file filename | Value / guidance |
| --- | --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `ASPNETCORE_ENVIRONMENT` | Set to `Production`; never enable Development in the public deployment. |
| `Kestrel:Endpoints:Https:Url` | `Kestrel__Endpoints__Https__Url` | `https://+:8443` |
| `Kestrel:Endpoints:Https:Certificate:Path` | `Kestrel__Endpoints__Https__Certificate__Path` | Container path to the PEM certificate, e.g. `/run/tls/site-cert.pem`. |
| `Kestrel:Endpoints:Https:Certificate:KeyPath` | `Kestrel__Endpoints__Https__Certificate__KeyPath` | Container path to its matching private key, e.g. `/run/tls/site-key.pem`. |
| `Kestrel:Endpoints:Https:Certificate:Password` | `Kestrel__Endpoints__Https__Certificate__Password` | Optional key-per-file filename for an encrypted PEM private-key passphrase. Omit it when the key is intentionally unencrypted. |
| `Storage:ContentsRoot` | `Storage__ContentsRoot` | Set to `/app/Contents`, the writable public content mount. |
| `Storage:DataRoot` | `Storage__DataRoot` | Set to `/data`, the snapshot-managed private workshop-upload and profile-photo mount. |
| `Storage:BackupsRoot` | `Storage__BackupsRoot` | Set to `/backups`, the admin snapshot and privacy-state mount. |
| `Storage:NotInSnapshotRoot` | `Storage__NotInSnapshotRoot` | Set to `/not-in-snapshot`, the separate state mount for Data Protection keys, logs, and newsletter operations. |
| `AuthServer:ClientSecret` | `AuthServer__ClientSecret` | Key-per-file configuration filename for the confidential OIDC client secret. Required outside Development. |
| `DotNetLiguriaDatabase:ConnectionString` | `MONGO_APP_USERNAME_FILE`, `MONGO_APP_PASSWORD_FILE` | Paths to the app-specific MongoDB username and password files. The website URL-encodes them and constructs `mongodb://<user>:<password>@mongodb:27017/DotNetLiguria?authSource=DotNetLiguria&tls=false`; configure trusted CA certificates and a separate deployment path before enabling MongoDB TLS. |
| `AllowedHosts` | `AllowedHosts` | Explicit production host names, e.g. `dotnetliguria.net;www.dotnetliguria.net`. Do not use `*`. |
| `AuthServer:Authority` | `AuthServer__Authority` | The HTTPS issuer for the configured identity realm. |
| `AuthServer:MetadataAddress` | `AuthServer__MetadataAddress` | HTTPS OIDC discovery URL from the same issuer. |
| `AuthServer:ClientId` | `AuthServer__ClientId` | Registered confidential client ID. |
| `AuthServer:Audience` | `AuthServer__Audience` | Expected API audience configured at the identity provider. |
| `Privacy:Issuer` | `Privacy__Issuer` | Must exactly match `AuthServer:Authority`; startup fails if it differs. |
| `Privacy:AllowedIdentityHost` | `Privacy__AllowedIdentityHost` | Exact identity-provider hostname allowed for privacy operations. |
| `Newsletters:PublicBaseUrl` | `Newsletters__PublicBaseUrl` | Canonical HTTPS public site URL. |

The shipped `appsettings.json` contains the current identity issuer and public-domain defaults. Review them against the production identity provider and domain before launch. The application requires the identity issuer and OIDC metadata endpoint to use HTTPS and match.

### Optional settings, set only when enabling the feature

| Configuration key | Environment variable or key-per-file filename | When needed |
| --- | --- | --- |
| `Security:KnownProxies:0` | `Security__KnownProxies__0` | When running behind a reverse proxy; add one indexed value for each exact trusted proxy IP. |
| `Security:CorsOrigins:0` | `Security__CorsOrigins__0` | Only if browser clients are hosted on a separate origin. Use exact HTTPS origins without wildcards. Same-origin SPA/API hosting needs no CORS origin. |
| `ProfilePhotos:Enabled` | `ProfilePhotos__Enabled` | Set `true` only if profile photo storage is ready. |
| `ProfilePhotos:Root` | `ProfilePhotos__Root` | Optional override. The default is `/data/profile-photos`; keep profile photos in private persistent storage, outside public `Contents`. |
| `PermissionDirectory:ServiceClientId` | `PermissionDirectory__ServiceClientId` | Keycloak service client used for permission administration. |
| `PermissionDirectory:ServiceClientSecret` | `PermissionDirectory__ServiceClientSecret` | Key-per-file configuration filename for that service client; keep it separate from the OIDC login client secret. |
| `PermissionDirectory:Issuer` | `PermissionDirectory__Issuer` | Identity issuer for the permission directory integration. |
| `PermissionDirectory:ProtectedGroupIds:0` | `PermissionDirectory__ProtectedGroupIds__0` | Repeat by index for groups whose memberships are protected. |
| `Privacy:AdminClientId` | `Privacy__AdminClientId` | Identity-provider admin client for privacy account operations. |
| `Privacy:AdminClientSecret` | `Privacy__AdminClientSecret` | Key-per-file configuration filename for the dedicated admin client secret; never reuse another client secret. |
| `Eventbrite:PrivateToken` | `Eventbrite__PrivateToken` | Private Token used as the backend bearer credential; required for synchronization. |
| `Eventbrite:AccessToken` | `Eventbrite__AccessToken` | Legacy alias for `Eventbrite:PrivateToken`. |
| `Eventbrite:OrganizationId` | `Eventbrite__OrganizationId` | Eventbrite organization used to create venues and events. |
| `Eventbrite:OrganizerId` | `Eventbrite__OrganizerId` | Eventbrite organizer assigned to created venues and events. |
| `Newsletters:SmtpHost` | `Newsletters__SmtpHost` | SMTP host when outbound newsletter delivery is enabled. Also set port, STARTTLS, sender, recipient and related settings in `appsettings.json` or runtime configuration. |
| `Newsletters:SmtpUserName` | `Newsletters__SmtpUserName` | SMTP account when authentication is required. |
| `Newsletters:SmtpPassword` | `Newsletters__SmtpPassword` | Key-per-file configuration filename when authentication is enabled. |
| `Newsletters:ProductionEnabled` | `Newsletters__ProductionEnabled` | Keep `false` until SMTP, recipients, consent handling, and operational approval are verified. |

The database name, collection names, timezone, privacy consent version, retention settings and newsletter policy flags are ordinary application settings already present in `appsettings.json`. Review and change them through deployment configuration only when the production setup requires it. Do not enable data collection or newsletter production delivery by copying example values without an operational/privacy review.

### TLS certificate files

Mount the certificate and private key from `/docker_data/global_certs/dotnetliguria/` to container `/run/tls/`. Use a valid PEM certificate chain for the production domain and its matching private key. Renew certificates before expiry and restart/reload the site after renewal. Limit host access to the certificate files; the private key should be readable only by the deployment administrator and the website process. Do not put PEM contents or passphrases in an image, source control, command-line arguments, or logs. For an encrypted key, add `Kestrel__Endpoints__Https__Certificate__Password` to the protected key-per-file input.

### MongoDB runtime variables

| Variable | Guidance |
| --- | --- |
| `MONGO_INITDB_ROOT_USERNAME_FILE` | Path to the root-administration username file, used only for provisioning and maintenance. |
| `MONGO_INITDB_ROOT_PASSWORD_FILE` | Path to the root-administration password file. Never use the development sample or reuse the application account. |

The official image reads these file variables only when initializing an empty `/data/db`; rotating a file later does not rotate the existing database user's password. Rotate it with authenticated database administration. Create a separate least-privilege user scoped to the `DotNetLiguria` database for the website. The website connection string must use that account instead of the root account. Do not publish MongoDB port 27017. Restrict Docker socket and host access because they can bypass container boundaries.

## Development user secrets

For local development, store passwords and access tokens in ASP.NET Core user secrets or an ignored local secrets file. Never add real values to `appsettings.Development.json`. The companion `secrets-template.json` beside `appsettings.json` documents the keys and uses fake values only.

When running through `src/DotNetLiguria.AppHost`, do not set the website MongoDB connection string manually: Aspire starts MongoDB, creates the `DotNetLiguriaAspire` database resource, and injects its generated connection string into the website process as `DotNetLiguriaDatabase__ConnectionString`. The current AppHost does not supply a MongoDB credential parameter, so Aspire chooses the default username `admin` and generates the password. The generated URI uses `authSource=admin`; this credential is not stored in the website project's user secrets or in the repository. The Aspire MongoDB data volume is named `dotnetliguria-aspire-mongo`.

If you need a known, stable local credential, update the AppHost to create an Aspire secret parameter and pass it to `AddMongoDB`, then store it as `Parameters:mongo-password` in the AppHost's user secrets before starting. Aspire guidance recommends an explicit persistent password with a data volume. Do not simply introduce a new password against an already-initialized `dotnetliguria-aspire-mongo` volume: MongoDB keeps the user created on first initialization, so first preserve the existing credential or perform a deliberate authenticated credential rotation. An OIDC client secret is supplied separately through AppHost configuration if the local identity provider requires it. When running the website project directly, outside Aspire, provide `DotNetLiguriaDatabase:ConnectionString` yourself through user secrets or an environment variable. The PEM key path/password entries are needed only when running local HTTPS with a PEM certificate; a plain local HTTP profile does not need them.

For .NET user secrets, run from the website project directory, replacing the examples with local-only values:

```sh
dotnet user-secrets set "DotNetLiguriaDatabase:ConnectionString" "mongodb://<local-app-user>:<local-password>@localhost:27017/DotNetLiguria?authSource=DotNetLiguria"
dotnet user-secrets set "AuthServer:ClientSecret" "<local-oidc-client-secret>"
```

Do not copy fake template values into a running environment.

## Configuration value reference

This section explains each setting in `appsettings.json` and `secrets-template.json`. The template is a reference only: ASP.NET Core does not load it automatically. For local development, put real secret values in the website project's User Secrets; for deployment, use the protected ASP.NET Core key-per-file directory. MongoDB remains the sole exception and uses its official `_FILE` variables. Never copy the `FAKE_...`, `example.invalid`, or fake MongoDB values into a running site.

### `appsettings.json`

| Key | Purpose and where to get the value |
| --- | --- |
| `AuthServer:ClientId` | The confidential OIDC client ID registered for the website in the identity provider (Keycloak). Match the client registration exactly. |
| `AuthServer:Audience` | The API audience expected in access tokens. Take it from the identity-provider client/audience configuration and keep it consistent with API token issuance. |
| `AuthServer:MetadataAddress` | The OIDC discovery document URL published by the same identity realm, normally `{Authority}/.well-known/openid-configuration`. Confirm it loads over HTTPS and reports the expected issuer. |
| `AuthServer:Authority` | The exact HTTPS issuer URL for the realm. Copy the issuer from its discovery document or Keycloak realm configuration; it must agree with `Privacy:Issuer`. |
| `AuthServer:SignInPath` | The application path the authentication integration uses for sign-in behavior. `/` is the current site default; change only with a tested route/authentication change. |
| `AuthServer:SignOutPath` | The application path used after sign-out. `/` is the current site default; keep it aligned with the OIDC client logout/callback configuration. |
| `AuthServer:Scopes` | Additional OIDC scopes requested by the site. Leave empty unless the identity provider has configured and approved extra scopes; `openid` and `email` are handled by the SPA's OIDC configuration. |
| `Logging:LogLevel:Default` | Default minimum application log level. Choose from .NET log levels based on the production logging policy; keep routine production logs at `Information` or less verbose. |
| `Logging:LogLevel:Microsoft.AspNetCore` | Log threshold for ASP.NET Core framework categories. `Warning` reduces routine framework noise; change only to meet a temporary diagnostic need, then restore it. |
| `AllowedHosts` | Semicolon-separated public host names served by this deployment. Take them from the DNS/TLS domain plan (for example, apex and `www` names); do not use `*`. |
| `Authorization:EventTimeZoneId` | Time zone used to interpret/display event times. Use the event organizer's agreed time zone; the current value `Europe/Rome` is an IANA time-zone ID. |
| `Newsletters:PublicBaseUrl` | Canonical HTTPS base URL used to create public links in newsletter content. Take it from the production DNS/canonical URL decision, without a trailing route. |
| `Newsletters:TestEnabled` | Enables the newsletter test workflow. Keep `true` only while a safe test address and SMTP configuration are in place. |
| `Newsletters:ProductionEnabled` | Enables production newsletter delivery. Keep `false` until recipient policy, sender/domain verification, consent, SMTP, and operational approval are complete. |
| `Privacy:Issuer` | Issuer value attached to privacy/account operations. Copy the exact `AuthServer:Authority` issuer; startup rejects a mismatch. |
| `Privacy:AllowedIdentityHost` | Host name only for the approved identity provider, taken from the realm issuer (no scheme, port, or path). It limits which identity host privacy operations may contact. |
| `Privacy:ConsentVersion` | Version identifier for the currently approved privacy notice/consent text. Set it from the published notice revision and update it only when that notice/purpose changes. |
| `Privacy:IdentityAttributePermissionsApproved` | Operator approval flag for the reviewed identity-attribute permissions model. Keep `false` until the conditions documented in [privacy-backend.md](privacy-backend.md) have been verified and approved. |
| `Privacy:ProtectedStorageApproved` | Approval that privacy journals/backups and their keys/permissions have the required protection. Keep `false` until storage controls and recovery access are reviewed. See [privacy-backend.md](privacy-backend.md). |
| `Privacy:ExternalCopiesErasureApproved` | Approval that procedures cover deletion from operator/provider copies and downloaded exports outside the application's direct control. Keep `false` until those procedures are established. |
| `Privacy:AssessedNonAccountCollections` | Exact MongoDB collection names reviewed and documented as not containing ordinary account linkage. Populate only from a complete data inventory; an empty list is safer than claiming an unassessed collection is safe. |
| `Privacy:RetentionOverrides` | Collection/field-path retention exceptions and their approved actions. Take these from the signed retention policy and reviewed data inventory; do not guess. The erasure workflow recognizes only supported actions (currently `delete`) as clearing a blocker. |
| `ProfilePhotos:Enabled` | Feature switch for local profile-photo file storage. Keep `false` until a durable, access-restricted storage path is provisioned and included in backup/privacy procedures. |
| `ProfilePhotos:Root` | Writable persistent directory for profile photos when enabled. Defaults to `/data/profile-photos`; this path is included in admin snapshots and must remain outside public `Contents`. |
| `DotNetLiguriaDatabase:BackupFolder` | Application-managed database snapshot and privacy-state root. Set it to `/backups`; `.privacy` control files live here beside snapshot folders. |
| `DotNetLiguriaDatabase:ConnectionString` | MongoDB URI for the website's least-privilege database user. In Aspire, the AppHost injects this at runtime, so no local value is required. For standalone/deployment use, construct it from the MongoDB host, database, authentication database, and app-specific username/password issued during provisioning. URL-encode URI credentials. |
| `DotNetLiguriaDatabase:DatabaseName` | Database name the website uses. Preserve the existing production database name; the local Aspire AppHost overrides it with `DotNetLiguriaAspire`. |
| `DotNetLiguriaDatabase:WorkshopCollectionName` | Existing MongoDB collection for workshops. Preserve the deployed collection name when connecting to existing data. |
| `DotNetLiguriaDatabase:SpeakerCollectionName` | Existing MongoDB collection for speakers. Preserve the deployed collection name. |
| `DotNetLiguriaDatabase:WorkshopFileCollectionName` | Existing collection for workshop file metadata. Preserve the deployed collection name. |
| `DotNetLiguriaDatabase:FileTypeCollectionName` | Existing collection for file-type metadata. Preserve the deployed collection name. |
| `DotNetLiguriaDatabase:BoardCollectionName` | Existing collection for board members. Preserve the deployed collection name. |
| `DotNetLiguriaDatabase:CounterCollectionName` | Existing collection for application counters. Preserve the deployed collection name. |
| `DotNetLiguriaDatabase:TopMenuCollectionName` | Existing collection for top-menu entries. Preserve the deployed collection name. |
| `DotNetLiguriaDatabase:VenueCollectionName` | Existing collection for event venues. Preserve the deployed collection name. |
| `DotNetLiguriaDatabase:QuestionnaireCollectionName` | Collection for questionnaire definitions. Keep aligned with the existing database. |
| `DotNetLiguriaDatabase:QuestionnaireResponseCollectionName` | Collection for questionnaire responses, which may contain personal data. Keep aligned with the existing database and privacy retention policy. |

### `secrets-template.json`

Every value in this file is fake. Where a value is a client ID, host, group UUID, URL, or mailbox, take the real value from the named system; where it is a password/token, create or retrieve it through that system's secret-management process and store it in User Secrets locally or a deployment secret manager in production.

| Key | Purpose and where to get the value |
| --- | --- |
| `X-Note1` | User-defined note key; no website code reads it. Replace with a fake/local note only if you use it in your own development workflow, or omit it from both local secrets and the template. |
| `X-Note2` | User-defined note key; no website code reads it. Replace with a fake/local note only if you use it in your own development workflow, or omit it from both local secrets and the template. |
| `AuthServer:ClientSecret` | Secret for the confidential website OIDC client whose ID is `AuthServer:ClientId`. Generate/rotate it in the identity provider's client credentials page; it is required for production. |
| `AuthServer:ClientId` | Client ID registered in Keycloak for the website. The template value is deliberately fake; for local Aspire, use the local Keycloak client ID supplied to the SPA/backend setup. |
| `DotNetLiguriaDatabase:ConnectionString` | Standalone local-development MongoDB URI using a local app database user. Aspire replaces this value at runtime through `DotNetLiguriaDatabase__ConnectionString`; do not put the Aspire-generated password in this template. For a direct website launch, obtain the URI from the local MongoDB provisioning step. |
| `Kestrel:Certificates:Development:Password` | Password used when exporting the local ASP.NET Core HTTPS development certificate to a PFX file. Use the same password supplied to `dotnet dev-certs https --export-path ... --password ...`; it is not a production PEM-key password. If using the certificate store/Aspire-managed certificate without an exported PFX, this setting may be unnecessary. See Microsoft's [development certificate guide](https://learn.microsoft.com/en-us/dotnet/core/additional-tools/self-signed-certificates-guide). |
| `Privacy:ProtectedStorageApproved` | Local boolean approval for the privacy protected-storage safeguards. Keep `false` unless the developer environment's backup/journal/key protection has actually been reviewed. |
| `Privacy:IdentityAttributePermissionsApproved` | Local boolean approval for the identity-attribute permissions safeguards. Keep `false` unless the local identity-provider attribute permissions and self-edit controls have been reviewed. |
| `Privacy:AdminClientSecret` | Secret for a dedicated Keycloak admin/service client used for privacy account operations. Create it in Keycloak with only the required account-management permissions; do not reuse `AuthServer:ClientSecret` or `PermissionDirectory:ServiceClientSecret`. |
| `Privacy:AdminClientId` | Client ID for that dedicated privacy account-management client. Take it from the Keycloak client you created for the privacy backend. |
| `PermissionDirectory:ServiceClientSecret` | Secret for the Keycloak permission-directory service client. Generate it in that service client's credentials and grant only the documented permission lookup/delegation roles. It must differ from the privacy admin secret. See [keycloak.md](keycloak.md). |
| `PermissionDirectory:ServiceClientId` | Client ID of the dedicated permission-directory service client, copied from Keycloak. |
| `PermissionDirectory:ProtectedGroupIds:1` | Fake example of the second protected Keycloak group UUID. Replace with a real immutable group ID only if a second protected group is in use; use consecutive indexes. |
| `PermissionDirectory:ProtectedGroupIds:0` | Fake example of the first protected Keycloak group UUID. Replace with the UUID of the operator/maintainer group that must not be managed through ordinary access administration. Get the UUID from Keycloak's group details, not its display name. |
| `PermissionDirectory:Issuer` | Exact HTTPS realm issuer for accounts managed by this directory. Copy from Keycloak's OIDC discovery document; it must correspond to `AllowedIdentityHost`. |
| `PermissionDirectory:InvitationRedirectUri` | The exact approved return/callback URL used by the invitation flow. Take it from the configured frontend route and register the same URL with the relevant Keycloak client. |
| `PermissionDirectory:InvitationLifespanSeconds` | Maximum invitation lifetime in seconds. Choose it from the account-invitation security policy; the template's `1800` is a 30-minute example, not a secret. |
| `PermissionDirectory:InvitationClientId` | Keycloak client ID used to build invitation links. Take it from the client configured for account invitations. |
| `PermissionDirectory:BoardGroupId` | Immutable Keycloak UUID of the board group whose membership is used by board access rules. Take it from the group details and preserve the existing group mapping. |
| `PermissionDirectory:ApplicationClientId` | Client ID for the website application in Keycloak, usually the SPA/public client configured for login; copy from the Keycloak client registration. |
| `PermissionDirectory:AllowedInvitationRedirectUris:0` | First exact redirect URI permitted for invitation callbacks. It must be an HTTPS URL in production and must exactly match the identity-provider client allow-list; add further entries with `:1`, `:2`, etc. |
| `PermissionDirectory:AllowedIdentityHost` | Identity-provider DNS host only, copied from the issuer URL (for example, no scheme or realm path). Do not use a wildcard. |
| `Newsletters:SmtpHost` | SMTP hostname from the mail provider/account administrator. Use the provider's authenticated submission endpoint, not an arbitrary mail server. |
| `Newsletters:SmtpPort` | Submission port specified by the mail provider. The template's `25` is only a fake example; production submission commonly uses the provider's configured STARTTLS port. |
| `Newsletters:SmtpUseStartTls` | Whether the provider requires STARTTLS on the selected port. Take this from the mail-provider instructions; keep `true` unless the provider explicitly documents another secure transport. |
| `Newsletters:SmtpUserName` | Username for a dedicated SMTP submission account, if the provider requires authentication. Obtain it from the mail provider; omit authentication only when the provider explicitly supports it safely. |
| `Newsletters:SmtpPassword` | Password or app-specific SMTP credential for that dedicated account, from the provider's credential page/secret manager. Do not use a personal mailbox password. |
| `Newsletters:SenderAddress` | Sender mailbox on a domain authorized by the mail provider (SPF/DKIM/DMARC as required). Take it from the approved newsletter sender identity. |
| `Newsletters:DefaultTestAddress` | Safe test mailbox controlled by the team. It must not be the production distribution address or one of its aliases; use it for test sends only. See [newsletters.md](newsletters.md). |

The template mirrors the website project's current development-secret keys. If a local secret is added or removed, update the template's key set without copying its value. A key beginning with `--` is not an ASP.NET Core hierarchical-key escape; it is a different, unused key. The application expects the unprefixed `DotNetLiguriaDatabase:ConnectionString`, while Aspire's environment variable takes precedence over a matching user secret.

## MongoDB daily backup and restore

Use `mongodump`/`mongorestore` from a MongoDB Database Tools container compatible with the server version. Store backups outside the database data volume and outside the public `Contents` path. Encrypt them at rest and in transit, restrict access, retain multiple daily/weekly copies off-host, and test restores on an isolated database regularly. Backups contain personal and operational data and must follow the site's retention and erasure policy.

The examples assume the MongoDB container is named `mongodb`, its private data directories are mounted at `/data/db` and `/data/configdb`, and a root-only Database Tools configuration file is mounted read-only at `/run/secrets/mongo-tools.yaml`. It should hold the backup operator's URI/password (with the required backup/restore privileges), not the website user's credentials. For example, use YAML keys `uri` and `password`, with `uri` pointing at `mongodb:27017` and using `authSource=admin`. Protect this file with restrictive permissions and do not put its contents in source control or shell history. Provision a restricted backup directory such as `/docker_data/containers_data/mongodb-backups` and mount it read/write into the tools container at `/backup`.

Daily compressed archive backup (run from the host or a scheduled job runner attached to the private Docker network):

```sh
docker run --rm --network dotnetliguria-internal \
  --volume /docker_data/containers_data/mongodb-backups:/backup \
  --volume /docker_data/global_secrets/mongo-tools.yaml:/run/secrets/mongo-tools.yaml:ro \
  mongo-database-tools:<qualified-version> sh -c \
  'mongodump --config=/run/secrets/mongo-tools.yaml --db=DotNetLiguria --archive="/backup/DotNetLiguria-$(date -u +%Y-%m-%dT%H%M%SZ).archive.gz" --gzip'
```

Schedule it once per day using the host scheduler. Alert on nonzero exit, insufficient disk space, or a missing/empty archive; apply a retention policy and copy encrypted archives off-host. Keep the tools configuration file outside the repository and unreadable by other host users.

Restore a selected archive into the target database. **`--drop` deletes the matching existing collections before restoring**; confirm the target and take a fresh backup first. For a safe rehearsal, use a separate empty database name and verify application behavior there.

```sh
docker run --rm --network dotnetliguria-internal \
  --volume /docker_data/containers_data/mongodb-backups:/backup:ro \
  --volume /docker_data/global_secrets/mongo-tools.yaml:/run/secrets/mongo-tools.yaml:ro \
  mongo-database-tools:<qualified-version> \
  mongorestore --config=/run/secrets/mongo-tools.yaml --archive=/backup/DotNetLiguria-<timestamp>.archive.gz \
  --gzip --nsInclude='DotNetLiguria.*' --drop
```

After a restore, verify collection counts, indexes, and representative site workflows. A filesystem copy of `/data/db` is not a substitute for a consistent logical backup while MongoDB is running.

## Security and release checklist

- Use supported, pinned image versions and rebuild from reviewed source; scan images and dependencies and deploy immutable image tags/digests.
- Use `Production` mode, exact allowed host names, HTTPS everywhere, HSTS through the app, and secure cookies. Keep certificate renewal and monitoring in place.
- Keep MongoDB on a private network, require authentication, use a least-privilege application identity, and enable TLS between containers where the threat model or network boundary requires it.
- Keep credentials and private keys in a secret manager/container secret store. Restrict access to host files and Docker administration; rotate credentials and revoke unused OIDC/integration clients.
- Run containers as non-root (the website image already switches to the .NET non-root user); avoid privileged mode, host networking, and unnecessary Linux capabilities. Consider a read-only container root filesystem with only the documented writable mounts.
- Restrict inbound firewall rules to HTTPS and administrative access from trusted sources. Apply host and container updates promptly and monitor authentication, application, and database logs without logging secrets or tokens.
- Protect workshop uploads and user-generated files against unsafe content and unauthorized access. Keep logs, private uploads, database files, and backups out of public web paths.
- Review privacy consent, retention, export/erasure behavior and backup retention for production. Restrict and audit staff access to personal data; test recovery and access revocation.
- Health-check both services, monitor disk and certificate expiry, alert on backup failures, and periodically test restore procedures on isolated data.
