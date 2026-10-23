# Website deployment

This guide describes a single-host Docker deployment with two services:

1. MongoDB, reachable only on the private Docker network.
2. `DotNetLiguriaWebCore`, the ASP.NET Core site with the React app built into its published `wwwroot`.

The repository Dockerfile already runs `npm ci`, builds the React application, and includes its `dist` output in the website publish. Build with the repository root as the context so both projects are available:

```sh
docker build -f src/dotnetliguriawebsite/DotNetLiguriaCore/Dockerfile \
  -t dotnetliguria-webcore:release .
```

Use a pinned MongoDB image version that you have qualified, rather than `latest`. Keep deployment values in a protected secret manager or root-readable deployment files outside the repository. Never commit real `.env`, `secrets.json`, connection strings, PEM files, private keys, or backups.

## Network and port map

| Service | Container port | Host mapping | Exposure |
| --- | ---: | ---: | --- |
| MongoDB | 27017/tcp | None | Private Docker network only; do not publish to the internet or host interfaces. |
| DotNetLiguriaWebCore | 8443/tcp | `443:8443` | Public HTTPS. Route the domain to this port and allow inbound 443 only. |

For local-only testing, bind the website to loopback, for example `127.0.0.1:8443:8443`. The production example uses Kestrel TLS directly. If a trusted reverse proxy terminates TLS instead, publish only the website's HTTP 8080 to that proxy on a private network, do not publish 8080 publicly, and set `Security:KnownProxies` to the proxy's exact container IP address(es). The proxy must overwrite forwarded headers; do not trust forwarded headers from arbitrary clients.

## Persistent storage

| Service | Container path | Purpose |
| --- | --- | --- |
| MongoDB | `/data/db` | Database files; use a durable named volume or protected host filesystem. |
| DotNetLiguriaWebCore | `/app/Contents` | Historical static workshop/media files, uploaded content, profile photos, newsletter files, and application logs. |
| DotNetLiguriaWebCore | `/app/Backups` | Application-generated privacy/database backup files. Restrict access and include in backup policy. |
| DotNetLiguriaWebCore | `/app/PrivateUploads` | Private workshop asset files, if used. Keep outside public static paths. |
| DotNetLiguriaWebCore | `/run/tls` | Read-only mount for the PEM certificate and private key. |

**Seed `Contents` before first start.** The image contains the checked-in historical assets. An empty host bind mount at `/app/Contents` hides those image files and can break existing workshop pages. Copy the current `src/dotnetliguriawebsite/DotNetLiguriaCore/Contents` tree to the host volume first, then mount it. When deploying a newer image, overlay new checked-in assets into the persistent directory without deleting historical or uploaded files. Give the site container's non-root user write access only to the required content subdirectories, logs, backups, and private uploads. Do not make the whole host filesystem writable by the container.

The React build is in the image's `wwwroot` and does not need a volume. Do not mount a host `wwwroot` over it.

## Start the stack

Provision a private network and a durable database volume, then start MongoDB without a published port. Use a protected MongoDB environment file containing `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD`:

```sh
docker network create dotnetliguria-internal
docker volume create dotnetliguria-mongo-data
docker run -d --name mongodb --restart unless-stopped \
  --network dotnetliguria-internal \
  --mount source=dotnetliguria-mongo-data,target=/data/db \
  --env-file /etc/dotnetliguria/mongodb.env \
  mongo:<qualified-version> --auth
```

Create a separate MongoDB application user scoped to `DotNetLiguria` with the minimum read/write roles the site requires. Provision credentials through an interactive admin session or secret manager; do not paste credentials into commands or source files. The website URI's `authSource` must name the database where that application user is created. Keep the root credential for administration and backups only.

After seeding the persistent `Contents` directory and preparing the certificate files, start the website. The protected website env file contains the variables listed above, including the exact Kestrel endpoint and certificate paths:

```sh
docker run -d --name dotnetliguria-webcore --restart unless-stopped \
  --network dotnetliguria-internal \
  --publish 443:8443 \
  --env-file /etc/dotnetliguria/website.env \
  --mount type=bind,source=/srv/dotnetliguria/Contents,target=/app/Contents \
  --mount type=bind,source=/srv/dotnetliguria/Backups,target=/app/Backups \
  --mount type=bind,source=/srv/dotnetliguria/PrivateUploads,target=/app/PrivateUploads \
  --mount type=bind,source=/etc/dotnetliguria/tls,target=/run/tls,readonly \
  dotnetliguria-webcore:release
```

Create host directories first and assign ownership/permissions so the container's non-root application user can write only where required. The TLS mount is read-only. Restrict the host firewall to public HTTPS and trusted administrative access. For updates, build and scan a new immutable image, take a database backup, stop/replace only the website container, and retain the persistent data volumes. Avoid `docker compose down -v` and any command that removes volumes during routine releases.

## Website configuration

ASP.NET Core reads environment variables using double underscores in place of configuration colons. The table gives configuration keys; for example, `AuthServer:ClientSecret` becomes `AuthServer__ClientSecret`.

### Required for production

| Configuration key | Environment variable | Value / guidance |
| --- | --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `ASPNETCORE_ENVIRONMENT` | Set to `Production`; never enable Development in the public deployment. |
| `Kestrel:Endpoints:Https:Url` | `Kestrel__Endpoints__Https__Url` | `https://+:8443` |
| `Kestrel:Endpoints:Https:Certificate:Path` | `Kestrel__Endpoints__Https__Certificate__Path` | Container path to the PEM certificate, e.g. `/run/tls/site-cert.pem`. |
| `Kestrel:Endpoints:Https:Certificate:KeyPath` | `Kestrel__Endpoints__Https__Certificate__KeyPath` | Container path to its matching private key, e.g. `/run/tls/site-key.pem`. |
| `Kestrel:Endpoints:Https:Certificate:Password` | `Kestrel__Endpoints__Https__Certificate__Password` | Passphrase for an encrypted PEM private key; use an empty value only if the key is intentionally unencrypted. Keep the key file protected either way. |
| `AuthServer:ClientSecret` | `AuthServer__ClientSecret` | Confidential OIDC client secret issued for this website. Required by the app outside Development. |
| `DotNetLiguriaDatabase:ConnectionString` | `DotNetLiguriaDatabase__ConnectionString` | MongoDB URI using the app-specific database user (see MongoDB setup below), e.g. `mongodb://<app-user>:<url-encoded-password>@mongodb:27017/DotNetLiguria?authSource=DotNetLiguria&tls=false`. Set `tls=true` and configure trusted CA certificates if MongoDB TLS is enabled. |
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

| Configuration key | Environment variable | When needed |
| --- | --- | --- |
| `Security:KnownProxies:0` | `Security__KnownProxies__0` | When running behind a reverse proxy; add one indexed value for each exact trusted proxy IP. |
| `Security:CorsOrigins:0` | `Security__CorsOrigins__0` | Only if browser clients are hosted on a separate origin. Use exact HTTPS origins without wildcards. Same-origin SPA/API hosting needs no CORS origin. |
| `ProfilePhotos:Enabled` | `ProfilePhotos__Enabled` | Set `true` only if profile photo storage is ready. |
| `ProfilePhotos:Root` | `ProfilePhotos__Root` | Durable writable directory inside the mounted content tree when profile photos are enabled. |
| `PermissionDirectory:ServiceClientId` | `PermissionDirectory__ServiceClientId` | Keycloak service client used for permission administration. |
| `PermissionDirectory:ServiceClientSecret` | `PermissionDirectory__ServiceClientSecret` | Secret for that service client; keep separate from the OIDC login client secret. |
| `PermissionDirectory:Issuer` | `PermissionDirectory__Issuer` | Identity issuer for the permission directory integration. |
| `PermissionDirectory:ProtectedGroupIds:0` | `PermissionDirectory__ProtectedGroupIds__0` | Repeat by index for groups whose memberships are protected. |
| `Privacy:AdminClientId` | `Privacy__AdminClientId` | Identity-provider admin client for privacy account operations. |
| `Privacy:AdminClientSecret` | `Privacy__AdminClientSecret` | Dedicated admin client secret; never reuse another client secret. |
| `Eventbrite:AccessToken` | `Eventbrite__AccessToken` | Only for Eventbrite synchronization. Configure its organization and organizer IDs as required by that integration. |
| `Newsletters:SmtpHost` | `Newsletters__SmtpHost` | SMTP host when outbound newsletter delivery is enabled. Also set port, STARTTLS, sender, recipient and related settings in `appsettings.json` or runtime configuration. |
| `Newsletters:SmtpUserName` | `Newsletters__SmtpUserName` | SMTP account when authentication is required. |
| `Newsletters:SmtpPassword` | `Newsletters__SmtpPassword` | SMTP password when authentication is enabled. |
| `Newsletters:ProductionEnabled` | `Newsletters__ProductionEnabled` | Keep `false` until SMTP, recipients, consent handling, and operational approval are verified. |

The database name, collection names, timezone, privacy consent version, retention settings and newsletter policy flags are ordinary application settings already present in `appsettings.json`. Review and change them through deployment configuration only when the production setup requires it. Do not enable data collection or newsletter production delivery by copying example values without an operational/privacy review.

### TLS certificate files

Mount the certificate and private key as read-only files, for example host `/etc/dotnetliguria/tls/` to container `/run/tls/`. Use a valid PEM certificate chain for the production domain and its matching private key. Renew certificates before expiry and restart/reload the site after renewal. Limit host access to the certificate files; the private key should be readable only by the deployment administrator and the website process. Do not put PEM contents or passphrases in an image, source control, command-line arguments, or logs. Prefer a secret manager or container secrets; environment variables are visible to Docker administrators and may be exposed by diagnostics.

### MongoDB runtime variables

| Variable | Guidance |
| --- | --- |
| `MONGO_INITDB_ROOT_USERNAME` | Unique MongoDB administration account, used only for provisioning and maintenance. |
| `MONGO_INITDB_ROOT_PASSWORD` | Long random password from a secret store; never use the development sample or reuse the application account. |

The official image uses these variables only when initializing an empty `/data/db`; rotating the variable later does not rotate the existing database user's password. Rotate it with authenticated database administration. Create a separate least-privilege user scoped to the `DotNetLiguria` database for the website. The website connection string must use that account instead of the root account. Do not publish MongoDB port 27017. Restrict Docker socket and host access because they can bypass container boundaries.

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

This section explains each setting in `appsettings.json` and `secrets-template.json`. The template is a reference only: ASP.NET Core does not load it automatically. For local development, put real secret values in the website project's User Secrets; for deployment, inject them from a protected secret store or runtime environment. Never copy the `FAKE_...`, `example.invalid`, or fake MongoDB values into a running site.

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
| `ProfilePhotos:Root` | Writable persistent directory for profile photos when enabled. Use a path under the mounted `Contents` tree or another durable storage mount; never use a temporary container path. |
| `DotNetLiguriaDatabase:BackupFolder` | Application-managed backup/privacy storage root relative to the app content root unless configured as an absolute path. In the container, `/app/Backups` is mounted separately; do not put backups beneath public `Contents`. |
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

The examples assume the MongoDB container is named `mongodb`, its private data volume is mounted at `/data/db`, and a root-only Database Tools configuration file is mounted read-only at `/run/secrets/mongo-tools.yaml`. It should hold the backup operator's URI/password (with the required backup/restore privileges), not the website user's credentials. For example, use YAML keys `uri` and `password`, with `uri` pointing at `mongodb:27017` and using `authSource=admin`. Protect this file with restrictive permissions and do not put its contents in source control or shell history. Provision a restricted backup directory such as `/srv/dotnetliguria/mongodb-backups` and mount it read/write into the tools container at `/backup`.

Daily compressed archive backup (run from the host or a scheduled job runner attached to the private Docker network):

```sh
docker run --rm --network dotnetliguria-internal \
  --volume /srv/dotnetliguria/mongodb-backups:/backup \
  --volume /etc/dotnetliguria/mongo-tools.yaml:/run/secrets/mongo-tools.yaml:ro \
  mongo-database-tools:<qualified-version> sh -c \
  'mongodump --config=/run/secrets/mongo-tools.yaml --db=DotNetLiguria --archive="/backup/DotNetLiguria-$(date -u +%Y-%m-%dT%H%M%SZ).archive.gz" --gzip'
```

Schedule it once per day using the host scheduler. Alert on nonzero exit, insufficient disk space, or a missing/empty archive; apply a retention policy and copy encrypted archives off-host. Keep the tools configuration file outside the repository and unreadable by other host users.

Restore a selected archive into the target database. **`--drop` deletes the matching existing collections before restoring**; confirm the target and take a fresh backup first. For a safe rehearsal, use a separate empty database name and verify application behavior there.

```sh
docker run --rm --network dotnetliguria-internal \
  --volume /srv/dotnetliguria/mongodb-backups:/backup:ro \
  --volume /etc/dotnetliguria/mongo-tools.yaml:/run/secrets/mongo-tools.yaml:ro \
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
