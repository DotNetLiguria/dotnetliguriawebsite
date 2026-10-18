# Security release and existing-data transition

This is a release procedure, not deployment approval or a claim of GDPR compliance.
Do not run production writes, restore, credential rotation or migration commands
until separately authorized. DataMigration has not been functionally changed.
See `hardening.md` for task evidence and `privacy-backend.md` for endpoint contracts.

## Release blockers

1. Supply runtime MongoDB configuration, the confidential backend OIDC secret,
   and a separate least-privilege Keycloak administration credential. Never put
   credentials in SPA configuration, committed files, images or documentation.
2. Configure the exact NGINX upstream IP in `Security__KnownProxies__0`, restrict
   backend network access to that proxy, and verify HTTPS on both hops.
   Production `AllowedHosts` must contain only the apex and www hostnames.
3. Independently verify encrypted backup storage, restrictive ACLs, persistent
   protected ASP.NET Data Protection keys, operational-copy deletion and recovery.
   Only then set the corresponding `Privacy` approval flags. Those flags are
   attestations, not an implementation of encryption or external-copy erasure.
4. Complete the read-only legacy inventory and separately approve any data writes.
   Unassessed collections, legacy identifiers and unsafe retention block erasure.
5. Approve legal/controller contacts, purposes, identifiable-data retention and
   provider locations. Replace the privacy notice's explicit placeholders.
6. Validate synthetic staging login, step-up, erasure, reconciliation and restore.
   Linux and Windows CI, browser and real Keycloak checks are separate evidence.
7. Do not enable delivery without an approved provider, disclosure/deletion
   controls and unsubscribe integration. Campaign confirmation intentionally
   returns unavailable, never "sent".
8. Configure and approve the separate administrative SMTP transport before
   relying on email notification of pending identity removal. Its messages must
   contain no account identifiers; the restricted dashboard is the authoritative
   task queue. SMTP acceptance is not proof of mailbox delivery.

## Keycloak configuration checklist

* Realm issuer: `https://hello.vevy.com/realms/DotNetLiguria`. Keep validated
  issuer/audience/signature/lifetime checks; an audience is not a privilege.
  `Privacy:Issuer` must match `AuthServer:Authority` exactly at startup.
* `DotNetLiguriaSpa`: public client, Standard Flow enabled, implicit and direct
  password grants disabled, PKCE challenge method **S256 required**. No browser
  client secret. Restrict callback/silent-callback/logout URLs to the actual
  checked-in `/authentication/` routes on the apex and www HTTPS origins.
  Do not use wildcard origins, subdomains or path-prefix redirects.
* Keep development localhost callbacks in a separate environment/client policy;
  do not add localhost or port 3443 as a production token destination.
* `DotNetLiguriaCore`: confidential backend client and expected API audience.
  Load its secret at runtime. Audit audience mappers separately from privileges.
* Administrative roles are case-sensitive realm roles or roles under the exact
  `DotNetLiguriaCore` namespace, not another client's roles. Dedicated Boolean
  privilege claims must be issuer-controlled and exactly true.
* Configure explicit `privacyadmin` / `notificationadmin` assignments or change
  the corresponding server role options. UI hints are not authorization.
  Dashboard access additionally requires the configured `WebDevAdmin`
  privilege. A board record or a specialized role alone does not grant dashboard
  access. Do not broaden API policies to compensate for missing assignments.
* Restore and destructive privacy operations require `acr` equal to `mfa` or
  `hwk` and one numeric `auth_time` no more than 300 seconds old. Ensure these
  issuer-controlled claims are present in **access tokens**, not only ID tokens.
  `acr_values=mfa`, `max_age=0`, `prompt=login` request step-up; they do not prove it.
  Do not turn this into mandatory MFA for ordinary questionnaire/admin login.
* Approve a current notification consent version. Keep
  `dnl_notifications_monthly` and `dnl_notifications_events` server-controlled;
  do not allow account-profile edits to forge consent evidence or privileges.
  Require current verified email for opt-in. No auto-subscription by email match.
* The identity-admin service account needs only the supported read/update,
  disable/logout and delete permissions for this realm. Validate actual minimum
  permissions with synthetic users; do not grant realm-admin as a shortcut.
  Every authenticated API request verifies that its subject still exists and is
  enabled, in addition to offline JWT validation. Missing identity-read
  configuration or identity outages fail closed with JSON 503; disabled/deleted
  identities are rejected even while an older token remains unexpired.
* Deletions initiated directly in Keycloak need reliable event delivery or an
  audited operator process invoking the MFA-protected reconciliation endpoint.
  An automatic Keycloak event listener is **not** included.
* `Privacy:AutomaticIdentityDeletion` defaults to true. Where automated deletion
  is intentionally unavailable, it may be disabled without disabling the
  immediate account disable/logout step or website erasure. Failed automatic
  deletion requires verified disablement before a manual-removal fallback is
  accepted; identity outages remain explicitly blocked.

## Manual identity-removal queue

Website administrators with privacy-administration permission use `/admin/privacy`.
Only the protected pending task retains the issuer/subject needed for Keycloak
removal. Access to that detail and destructive verification requires fresh MFA.
Do not copy subjects or personal data into tickets, email, screenshots or logs.

Delete the indicated disabled identity in the approved realm, then invoke the
task's verified-completion action. The backend must independently confirm the
identity is absent and complete application/backup cleanup before removing the
task. Do not delete journal files, re-enable the identity, restore an old backup,
or manually mark work complete to clear a warning. Pending tasks continue the
existing global backup/restore restrictions.

SMTP delivery failures do not undo website erasure and must not turn a pending
identity removal into a completed status. Retry only through the restricted
notification action. Resolve tasks promptly; an outstanding issuer/subject is
still identifying data, not anonymized history.

Consent history begins with the new feature; there is no fabricated historic
ledger. Current Keycloak grants remain authoritative. History contains minimal
account references and is deleted on account erasure, including unfinished
intents. Approve any different legal retention requirement separately rather
than retaining a hash/tombstone by default.

## NGINX boundary

The following is a template, not a runnable production configuration. Replace
certificate/upstream placeholders through the deployment secret/configuration
mechanism; do not copy private material into this repository.

```nginx
# http context: never log request bodies, Authorization/Cookie headers, query
# strings, OIDC callback parameters or unsubscribe capability URLs.
map $uri $security_log_route {
    ~^/(authentication|signin-oidc|signout) identity-route;
    ~^/api/(privacy|notifications|Questionnaire|Backup) restricted-route;
    default public-route;
}
log_format minimized '$request_method $security_log_route $status $request_time';

server {
    listen 443 ssl;
    server_name dotnetliguria.net www.dotnetliguria.net;
    # ssl_certificate / ssl_certificate_key: provision outside source control.
    access_log /var/log/nginx/dotnetliguria-access.log minimized;
    client_max_body_size 26m;
    client_body_timeout 30s;
    keepalive_timeout 30s;

    location / {
        proxy_pass https://APPROVED_BACKEND:5443;
        proxy_ssl_verify on;
        proxy_ssl_server_name on;
        # Set proxy_ssl_name and proxy_ssl_trusted_certificate for the actual
        # trusted upstream certificate; do not disable verification.
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host "";
        proxy_set_header Forwarded "";
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_no_cache $http_authorization;
        proxy_cache_bypass $http_authorization;
    }
}
```

Use a rejecting default virtual host for unknown Host/SNI names. Do not redirect
authenticated API requests between www/apex. Do not enable proxy caching for
private, authorization, privacy or notification routes. Retention/access rules
also apply to NGINX error logs, Keycloak logs and infrastructure telemetry.

## Read-only legacy inventory

Use a dedicated read-only identity/database account, outside the web application.
Produce restricted **counts and field paths**, not raw values in build logs.
Inventory all collection names, BSON schemas, unknown/nested fields, filesystem
snapshots, safety/staging directories, downloads and external/operator copies.
Do not treat an empty sample as proof that a collection is safe.

Assess at least:

* Legacy `Respondent` names/email, `EmailNormalized`, `UniqueEmailKey`,
  free-text answers, rare answer combinations, timestamps and source metadata.
* `CreatedBy` usernames/emails, immutable issuer/subject references and dedup keys.
* Authored questionnaire free text, campaigns, indexes and archived export files.
* Private board/speaker emails versus consented public editorial data. These are
  not subscriber identities; never automatically create accounts or opt-ins.
* Every backup format and location, including copies outside the configured root.

Populate `Privacy:AssessedNonAccountCollections` only from an approved complete
inventory. Unknown collections/new fields must not become silently "safe".
Retention overrides accept arbitrary actions but anything other than deletion
blocks erasure; this implementation makes **no** arbitrary-text anonymity claim.

## Dry-run and separately approved transition

1. Run inventory against synthetic fixtures first: legacy respondent/email keys,
   unknown nested fields, free text, authored definitions with other respondents,
   unaffected editorial contacts, invalid backup paths and external copies.
2. Produce an approved per-collection disposition, cardinality bounds, affected
   snapshot list, expected counts, and an explicit rollback policy. Never infer
   ownership or reconnect accounts by matching unverified email.
3. Obtain controller/operator approval for production writes. Use an independently
   reviewed, bounded transition procedure; no transition writer is supplied here.
4. Verify old direct PII/attribution and incompatible indexes are removed where
   approved. Retain legacy BSON decoding until the verified transition completes.
5. Verify the real account deletion path with synthetic staging accounts only.
   It deletes complete linked responses and authored questionnaires **including
   other people's responses to them**. The UI discloses this consequence.
6. Confirm interrupted operations remain recoverable and visibly incomplete.
   Do not remove journals to clear a blocked state.
7. An erasure rotates a non-personal backup epoch and conservatively purges all
   owned snapshots because unaffected historical snapshots cannot currently be
   proven safe. Restore of old/pre-epoch or reintroduced copies must fail.
   Do not roll back by restoring an erased identity.
8. Audit external/export/provider copies separately. A flag or passing test does
   not physically remove external data or establish legal completion.

## Upload and artifact transition

New assets are outside static roots and served through publication-aware API
downloads. Historical `Contents` URLs remain intact; inventory previously public
drafts before release. Office archives are rejected until a malware-scanning
integration is approved. Signature/dimension checks and attachment delivery
mitigate type confusion; they are not an antivirus or arbitrary-polyglot detector.

Run `scripts\verify-security.ps1` and `scripts\verify-publish.ps1` in addition to
the shared verification gate. Advisory results are point-in-time, not proof of
absence of vulnerabilities. Publish exclusions do not remove already tracked
development secrets from Git history or rotate any real credential; assess that
separately without printing contents.
