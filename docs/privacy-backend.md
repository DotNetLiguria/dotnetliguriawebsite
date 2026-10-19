# Privacy and notification backend

This documents the isolated backend surfaces, not production rollout approval.
No existing-data migration or event/marketing delivery provider is included.
Administrative privacy notices use a separate, explicitly configured SMTP transport.

## Wiring

Import `DotNetLiguriaCore.Services.Privacy` and
`DotNetLiguriaCore.Endpoints`, then register
`builder.Services.AddPrivacyServices(builder.Configuration, builder.Environment)`.
Map `app.MapPrivacyEndpoints()` and `app.MapNotificationEndpoints()`.
Map `app.MapAccountEndpoints()` for authenticated policy-backed capability flags.
Use the existing JWT validation and exception middleware; do not enable cookies
on these routes. The unsubscribe capability is the only anonymous mutation.
The wired bearer validation additionally checks the current Keycloak account,
under the shared gate, on every authenticated API request. Disabled/deleted
accounts cannot retain access using an otherwise unexpired signed token.
Identity verification outages return explicit JSON 503, not successful access or
a misleading login redirect. Live authentication uses the validated caller's
access token at the fixed issuer's Keycloak UserInfo endpoint, which checks the
current account and session. The response must identify the same subject.
Ordinary login and capability checks do not require identity-admin service
credentials. These credentials remain required for privacy/consent operations
that read or modify accounts. Redirects, cookies and HTTP-client logging are
disabled for both identity clients; unavailable verification never grants access.

Every account-linked write, including questionnaire author edits, must hold
`PrivacyOperationGate.EnterAsync(cancellationToken)` and then call
`PrivacyCoordinator.EnsureAccountActiveAsync(new AccountReference(issuer, subject),
cancellationToken)` **inside the lease**. Hold it through the database write.
Serialize anonymous questionnaire writes through the same gate because erasure can
delete an authored definition and its responses. The gate is single-instance only.
Backup create/restore already acquire it. Do not nest gate acquisitions.

Restore authorization and recent MFA remain in the existing import endpoint.
Self-erasure, administrative recovery and reconciliation check `RecentMfa` here.

## Runtime configuration and release gates

Configure the following under `Privacy` through trusted server configuration:

| Setting | Requirement |
| --- | --- |
| `Issuer` | Exact canonical HTTPS `https://hello.vevy.com/realms/<realm>` matching validated JWT `iss`; no query, fragment, custom port or alternative path |
| `AllowedIdentityHost` | Explicit approved fixed identity hostname; defaults to `hello.vevy.com` |
| `AdminClientId`, `AdminClientSecret` | Dedicated least-privilege Keycloak service account; secret from runtime secret management only |
| `AuthorizationClientId` | Explicit role namespace; defaults to `DotNetLiguriaCore` |
| `AdministratorRole` | Explicit role required by `PrivacyAdministrator`; absent means access denied |
| `NotificationAdministratorRole` | Explicit role required by `NotificationAdministrator`; absent means access denied |
| `ConsentVersion` | Controller-approved current purpose/notice version |
| `IdentityAttributePermissionsApproved` | Operator attestation that users cannot self-edit the server-controlled consent evidence and that those attributes cannot grant privileges |
| `AutomaticIdentityDeletion` | Defaults to `true`; `false` disables automatic Keycloak deletion, not account disablement or website erasure |
| `ProtectedStorageApproved` | Operator approval of backup/journal permissions, encryption-at-rest and persistent protected Data Protection keys |
| `ExternalCopiesErasureApproved` | Approval of effective deletion of operator/provider copies and downloaded exports, including procedures not owned by this application |
| `AssessedNonAccountCollections` | Exact collection-name inventory assessed not to contain ordinary account linkage; unassessed collections block erasure |
| `RetentionOverrides` | Initial field-path/action dictionary; only action `delete` permits completion |

Approval flags default to false. They are external gates, not encryption,
filesystem ACL enforcement, proof of legal compliance or an external-copy deletion
implementation. Configure persistent protected Data Protection keys separately;
ephemeral/default unprotected keys are not a production solution.
Exclude identity-admin HTTP URLs from telemetry: paths contain opaque subjects.
The HTTP client disables redirects, cookies and HTTP-client loggers and never
logs credentials, response bodies or recipient addresses.

The fixed issuer/realm and immutable subject select Keycloak users. Email is
never an account lookup key. Service credentials must support reading users and
attributes, updating only the necessary user fields, disabling/logging out and
deleting the intended users. Validate the least supported Keycloak permissions
with synthetic staging accounts before release.

### Configure the Keycloak service account

The personal area's `identity_admin_not_configured` error means the dedicated
identity-admin client is missing or the fixed issuer/host configuration is invalid.
The checked-in issuer is `https://hello.vevy.com/realms/DotNetLiguria`.
`AuthServer:ClientSecret` belongs to the interactive backend login client: it does
not configure `Privacy:AdminClientSecret`. Never put either secret in the SPA,
`VITE_*` variables or committed configuration.

1. In the **DotNetLiguria** realm (not `master`), create a dedicated OpenID Connect
   client, for example `dotnetliguria-privacy-admin`.
2. Enable **Client authentication** and **Service accounts roles**. Disable
   **Standard flow**, **Implicit flow** and **Direct access grants**; this client
   uses only `client_credentials`, with no browser login or redirect URI.
3. Under **Service account roles**, assign permissions for the required Admin REST
   operations. With the built-in `realm-management` client roles, `view-users`
   supports profile reads and `query-users` supports directory enumeration.
   `manage-users` supports user updates, disable/logout and deletion, but is
   realm-wide and is **not** an attribute-only permission. Use supported
   fine-grained admin permissions to restrict the managed users where possible;
   verify GET user, list users, PUT user, POST user logout and DELETE user with
   synthetic accounts. Do not assign `realm-admin` or `manage-realm`. Read-only
   profile/history use does not require granting write/delete permissions.
4. Ensure the client's role scope mappings include its assigned administrative
   roles. Keycloak service-account token roles are the intersection of assigned
   roles and permitted role scopes; assigning a role alone may not put it in the
   token. Prefer explicit scopes rather than enabling unrestricted scope.
5. Obtain the client secret from **Credentials** and store it in trusted backend
   runtime configuration. Configure these keys on the **website project**:

   | Configuration key | Value |
   | --- | --- |
   | `Privacy:Issuer` | `https://hello.vevy.com/realms/DotNetLiguria` (must equal `AuthServer:Authority`) |
   | `Privacy:AllowedIdentityHost` | `hello.vevy.com` |
   | `Privacy:AdminClientId` | `dotnetliguria-privacy-admin` (or the client ID you chose) |
   | `Privacy:AdminClientSecret` | The dedicated client's secret, supplied by your secret manager |

   For local development, use **Manage User Secrets** on
   `src\dotnetliguriawebsite\DotNetLiguriaCore\DotNetLiguriaCore.csproj`.
   A non-secret setting can also be written from the repository root:

   ```powershell
   dotnet user-secrets set "Privacy:AdminClientId" "dotnetliguria-privacy-admin" --project src\dotnetliguriawebsite\DotNetLiguriaCore\DotNetLiguriaCore.csproj
   ```

   Set `Privacy:AdminClientSecret` in that same project's user secrets without
   printing it or putting it in shell history. User secrets are development-only,
   not an encrypted production vault. Aspire launches this website in Development,
   so its own user secrets are loaded; the AppHost currently forwards `AuthServer`
   settings only, not `Privacy` settings. Putting these keys only in the AppHost's
   user secrets is therefore insufficient. In production, inject the equivalent
   `Privacy__AdminClientId` and `Privacy__AdminClientSecret` environment variables
   through the hosting platform's secret management.
6. Restart the website resource after configuring it. Sign in normally and retry
   `GET /api/privacy/data?offset=0` and
   `GET /api/notifications/consents?offset=0` from the personal area. The application
   obtains its own service-account token; do not paste one into the SPA. A configured
   client with rejected credentials or insufficient permissions returns
   `identity_admin_unavailable`; check token issuance and the administrative role
   scopes without logging tokens, secrets or user-response bodies.

### Evidence/history reads versus consent changes

`GET /api/notifications/consents` reads existing Keycloak evidence and stored
history even when `IdentityAttributePermissionsApproved` is false or
`ConsentVersion` is unset. Reading does not grant consent, rewrite identity
attributes or invent historical entries. Existing pending history intents are
still reconciled against the observed identity evidence. Identity-admin credentials
and MongoDB availability remain required; dependency failures are not replaced
with a misleading empty history.

Subscription operations remain gated by `ConsentVersion` and
`IdentityAttributePermissionsApproved`. Before enabling them, configure
`dnl_notifications_monthly` and `dnl_notifications_events` in Keycloak's user
profile so administrators can read/write them, users cannot edit them through
registration/account/profile APIs, and neither attribute grants roles or privileges.
Verify attribute persistence/readback with the service account and rejection of
self-edits with a synthetic ordinary user. Only then attest
`Privacy:IdentityAttributePermissionsApproved=true`, keeping the controller-approved
`Privacy:ConsentVersion` (currently `2026-10`). Do not turn on this flag, storage
approval or external-erasure approval just to hide an error.

Reference: [Keycloak server administration guide: service accounts](https://www.keycloak.org/docs/latest/server_admin/index.html#_service_accounts).

## Erasure semantics

`GET /api/privacy/status`, `GET /api/privacy/data`, `GET /api/privacy/export`, and
`POST /api/privacy/erase` operate only on the authenticated caller's JWT issuer
and subject. Erasure requires recent MFA and
`X-Confirm-Erasure: erase-my-account`. Success is returned only after identity
disable/logout, application deletion, snapshot purge, verified Keycloak deletion
and removal of the pending journal. The normal completed response remains
HTTP 200 `{status:"completed"}`.

Website-admin authorization is separate from authentication. The SPA's
`/area-personale` is available to ordinary active accounts, while the dashboard
requires the existing `WebDevAdmin` policy. `/admin/profile/` redirects to the
personal area. Name edits are forwarded to Keycloak; email changes, password, MFA
and email verification remain in the Keycloak account console. The capabilities endpoint
uses the existing server policies, not board membership or an audience claim.
Narrower privacy/notification/questionnaire/backup API permissions remain separate.

### Edit personal data without local persistence

`GET /api/privacy/profile` and `PUT /api/privacy/profile` forward the authenticated
caller's bearer token to the fixed issuer's Keycloak Account REST API. They never
use the identity-admin service token to edit a profile. Reads are independent of
the site's MongoDB records and identity-admin credentials.

The PUT body permits only `{firstName,lastName}`; unknown fields (including
`email`, account IDs, usernames, attributes, roles and `emailVerified`) are rejected.
The caller cannot select another identity. The backend reads the current account,
checks its immutable subject, preserves the current email, username and account attributes,
forwards only the allowed changes, then reads back the persisted values. Keycloak
remains responsible for user-profile permissions and required fields.
Readback must preserve the email and its verification state as well as confirm the names.
A failure or mismatched readback is explicit:
an upstream success status alone is not reported as a confirmed save.

The personal area offers **Modifica dati personali**, **Salva dati personali** and
**Annulla modifiche**. Profile values and unsaved edits remain in component memory
only, with no database, file, localStorage or sessionStorage copy. Responses use
`no-store, private`; profile HTTP loggers and redirects are disabled. Updates share
the erasure gate, and a pending erasure prevents profile changes. Keycloak itself
may record profile-change events according to its audit configuration.

For this feature, the realm's built-in **account** client must be enabled, and the
ordinary user's access token must have the **account** audience and
`resource_access.account.roles` containing **manage-account**. Configure these in
the SPA login client's role scope mappings/audience mapper, retaining the backend's
existing audience; do not grant users `realm-management` roles. Sign in again after
changing token scopes. A read may use `view-profile`, but saving requires
`manage-account`. Missing account audience can return 401; missing permissions
return 403. No token exchange or additional login grant is needed.

In **Realm settings -> User profile**, allow ordinary users to edit `firstName`,
`lastName` and `email` where intended; keep notification evidence admin-only.
Read-only/federated profiles and additional realm-required attributes can still
cause Keycloak to reject an update. The site deliberately does not bypass those
rules with administrator privileges: the Account Console remains available.
Email is always read-only on the website, including in edit mode. The single
**Modifica account e sicurezza** link opens the Account Console for email and
security changes; the website never submits a new address. User-facing copy names
the service **Identity Provider**, not its implementation.
For verification-before-replacement, enable the supported **Update Email**
required action in Keycloak and configure **Force Email Verification** (or the
realm's **Verify email** policy), with working realm SMTP. Enable the `update-email`
server feature if required by the installed Keycloak version. Do not make this
action a default required action for every login. Validate the actual flow in
staging: without verification enabled, merely opening the console does not
guarantee verification-before-replacement. The website does not change these realm
settings, send verification messages or claim that an email change completed.
After returning, **Aggiorna dati personali** rereads Keycloak.

With Google brokering, email changes do not change Google's address or the stable
external identity link. Review the identity provider and mapper sync modes:
`FORCE` can overwrite a locally changed profile on a later brokered login.
Use the intended `IMPORT`/mapper policy rather than promising that an email
change will survive all synchronization configurations.

`GET /api/privacy/data?offset=0` returns a fresh identity projection and pages of
50 attributable record summaries, with a legacy-coverage warning. The same
1,000-record export boundary applies; a limit failure is explicit, not a claim
that no data exists. Full recorded values remain available in the personal export.
Neither the summary nor export is a proof that unattributable legacy data is absent.

Default behavior is deliberately destructive, **not text anonymization**:

* Delete complete account-linked questionnaire responses, including answers,
  timestamps, identity/source/deduplication keys and unknown fields.
* Delete complete questionnaires authored by the account **and all their
  responses**, including other respondents' responses. Authored free text is not
  presumed anonymous. The UI must disclose this before confirming erasure.
* Delete campaign metadata attributed to the account.
* Delete complete account-linked `ConsentHistory` documents, including pending
  change intents and unknown fields. No historical consent or subject hash is
  retained after completed erasure.
* Do not match names against public board/speaker editorial content, or treat
  those contacts as accounts/subscribers.
* Block on legacy respondent objects/email deduplication keys, unattributable
  references, legacy author PII and unassessed collections. An approved existing
  data transition is still required; there is no email-based linking fallback.
* Any retaining override, including unknown/nested fields, blocks completion.
  There is no assessed safe aggregation implementation or arbitrary-text
  anonymity detector.

The versioned field inventory and overrides are available to
`PrivacyAdministrator` at `GET /api/privacy/admin/retention`.
`PUT` the same path with a JSON field/action dictionary and
`X-Confirm-Retention-Policy: replace` to durably replace overrides. Arbitrary
actions are accepted within size bounds, but every action except `delete`
appears in the restricted blocking report. Policy is protected outside MongoDB
and outside snapshots, so restore cannot roll it back.

Pending state is Data-Protection-protected under `<BackupFolder>/.privacy`.
`GET /api/privacy/admin/operations` exposes transient operation IDs/stages, not
accounts; it also reports administrative-notice status, attempts and sanitized
failure codes. `GET /api/privacy/admin/operations/{id}/report` reports blockers without
field values. `POST /api/privacy/admin/operations/{id}/resume`, recent MFA and
`X-Confirm-Erasure: resume-erasure` retry idempotent stages. Interrupted/corrupt
atomic writes block operations and require restricted operator recovery; never
delete a journal merely to make status appear complete.

If automatic deletion is disabled or fails, the coordinator verifies that the
remaining Keycloak identity is disabled before returning HTTP 202
`{status:"awaiting_manual_identity_removal"}`. Website data and owned snapshots
have been erased, but identity erasure is **not complete**. A lost DELETE response
is verified: an already absent identity can complete normally. Unavailable final
identity verification leaves `identity_verification_blocked`, not a fabricated
disabled/completed state. Failure to disable/logout or verify disablement before
website erasure stops destructive application work.

Pending manual removal keeps only the protected issuer/subject and transient
coordination/notice state. It continues to block backups/restores under existing
safety rules. It is not an anonymous completed record or a retention exception.
The user's session is ended after an accepted removal; a disabled user is not
required to sign back in to finish the administrator's work.

Privacy administrators can retrieve the minimal identity at
`GET /api/privacy/admin/operations/{id}/identity` after recent MFA. No name/email
directory is returned. After manual Keycloak deletion, POST
`/api/privacy/admin/operations/{id}/verify-removal` with recent MFA and
`X-Confirm-Erasure: verify-identity-removal`. It verifies actual identity absence
and cleanup before deleting the protected task. An unchecked "mark done" is not
supported. Existing resume/reconciliation endpoints remain available; resume can
also return HTTP 202 while identity removal is still pending.

For an identity deleted directly in Keycloak, an administrator can invoke
`POST /api/privacy/admin/reconcile-deleted-identity` with JSON `{issuer,subject}`,
recent MFA and `X-Confirm-Erasure: reconcile-deleted-account`. It refuses to act
while that identity still exists. This is an authenticated manual reconciliation
boundary, **not an automatic Keycloak event listener**. Reliable event delivery
or an audited operator reconciliation process remains a release gate.

Failure leaves a restricted retryable operation; it is not a distributed
transaction. A completed erasure leaves no subject tombstone/hash or permanent
job correlation. Consequently status says `no_pending_request`, not a permanent
historical assertion. Export is bounded to 1,000 linked application records plus
the current Keycloak profile/consents. It warns that unattributable legacy data
requires inventory; it is not proof of absence.

## Backups

Backup roots cannot be `wwwroot`, `Contents`, their descendants, or an ancestor
of the application root. Linked ancestors/snapshot trees/manifests/collection
files are rejected. Existing manifest validation remains in effect.

Erasure rotates a non-personal global backup epoch and conservatively purges
**all** regular, safety, staging and unrecognized copies owned by the configured
backup root, except protected coordination/policy files. There is no schema-wide
proof that an old copy is unaffected; therefore it is not silently retained.
Deletion failures block completion. Restore requires a matching epoch, so legacy
or externally reintroduced pre-erasure snapshots are refused before database
replacement. New safety snapshots cannot be created while erasure is pending.
Application encryption and authenticated snapshot integrity are not implemented;
protected storage is an explicit rollout gate.

## Notifications

### Administrative SMTP

Configure these trusted server settings under `Privacy:Smtp`. Do not put runtime
credentials or real mailbox values into checked-in configuration or the SPA.

| Setting | Requirement |
| --- | --- |
| `Host`, `Port` | Approved SMTP endpoint; port defaults to 587 |
| `TlsMode` | `StartTls` (default, required upgrade) or `SslOnConnect`; no plaintext mode |
| `Sender` | Approved operational sender mailbox |
| `AdministratorRecipients` | One to twenty approved administrator mailboxes |
| `DashboardUrl` | Trusted absolute HTTPS URL whose path is exactly `/admin/privacy`, with no userinfo, query or fragment |
| `UserName`, `Password` | Required authenticated SMTP credentials from runtime secret management |

Normal certificate/revocation validation and TLS 1.2/1.3 apply. Notices have a
generic subject/body and dashboard link, not a user name, address, issuer,
subject, operation ID or action token. This sender does not contact the erased
user or enable event campaigns.

The hosted worker stores retry state only inside the protected pending operation.
It sends outside the privacy gate, attempts at most five times, and persists
backoff/recovery state across restarts. The status `accepted_by_smtp` means SMTP
acceptance, **not inbox delivery**. A crash after acceptance may cause a duplicate;
exactly-once delivery is not claimed. Removed tasks are never recreated by a late
send result.

Missing/invalid configuration and SMTP failures remain visible as sanitized
notification codes on the task and the `privacy_smtp` health check. POST
`/api/privacy/admin/operations/{id}/retry-notification` with
`X-Confirm-Erasure: retry-notification` to reset bounded retries for an outstanding
task. This action cannot resurrect a resolved operation. Configure mailbox
access/retention separately, even though messages contain no per-user identifiers.

### Event notification preferences

`GET /api/notifications/subscription/` returns
`{version,monthlyUpcomingEvents,eventAnnouncements}`.
`PUT` accepts `{purpose,version,optIn}`, where purpose is
`monthly-upcoming-events` or `event-announcements`. Opt-in requires a current
version and a live enabled Keycloak account with verified valid email.
Opt-out does not require accepting a new notice version.
An enabled account can withdraw consent even while an erasure preflight is
blocked; pending erasure must not be used to prevent withdrawal.

Current notification consent remains authoritative in Keycloak attributes
`dnl_notifications_monthly` and `dnl_notifications_events`. `ConsentHistory` in
MongoDB records future changes only: issuer/subject, purpose, notice version at
the action, server UTC time, grant/withdraw action and minimal recovery state.
It stores no name, email, IP, user agent or answer content. This is not a
subscriber email directory.

`GET /api/notifications/consents?offset=0` returns current stored grant evidence
and pages of 50 future history entries. Existing grants are not backfilled as
invented history. Questionnaire consent is shown separately using the evidence
actually present in the response; unknown historical notice/version information
must not be inferred.

Preference changes and one-click unsubscribe persist an intent before updating
and verifying Keycloak, then finalize it. This is not a distributed transaction.
An interrupted intent stays visibly pending until a read/change reconciles it
against current Keycloak evidence as completed or superseded. Recovery observes
state; it never replays an old grant over a later withdrawal. Failures are
explicit. Withdrawals for already-disabled identities remove the Keycloak grant
without recreating erased website history. New history is covered by the
versioned inventory, export, full-record erasure and backup epoch protections.

`NotificationAdministrator` can
`POST /api/notifications/campaigns/preview` with `{purpose,eventIds}`.
Monthly previews select published events in the coming month; event announcements
require 1–20 explicit published upcoming event IDs. The response contains campaign
ID, event IDs, eligible count, expiry and `dispatchAvailable:false`, not addresses.
Campaign metadata expires for use after 30 minutes.

`POST /api/notifications/campaigns/{id}/confirm` requires
`X-Confirm-Campaign: <id>`. It records confirmation and returns **503**
`notification_dispatch_unavailable_no_approved_provider`. Nothing is sent.
`INotificationRecipientPreparation.PrepareConfirmedRecipientsAsync` is a
server-only, transient integration boundary for a future approved provider;
it re-resolves current enabled/verified accounts and current consent immediately
before yielding an address and protected unsubscribe token. It is not mapped to
a directory-download endpoint. A future dispatcher must recheck withdrawal at
actual delivery and implement provider deletion, bounded retries and disclosure
controls before claiming delivery.

Unsubscribe tokens are purpose-bound, authenticated/encrypted, valid for 30 days
and contain no cleartext account/email URL fields. GET
`/api/notifications/unsubscribe/{token}` changes nothing. POST the same URL with
form `List-Unsubscribe=One-Click` to revoke that purpose idempotently. No token
can opt in, change roles or revoke a different account. A future delivered
message must provide the HTTPS link and RFC 8058 headers; old expired links
require authenticated self-service opt-out.

## Offline checks

After the parent solution build, run:

```powershell
dotnet run --project tests\DotNetLiguriaCore.Tests -c Release --no-build --no-restore -- -class '*PrivacyCoordinatorTests' -class '*PrivacyBoundaryTests' -class '*PrivacyStorageTests' -class '*NotificationServiceTests' -class '*KeycloakIdentityAccountAdminTests' -class '*DatabaseBackupServiceTests'
```

These tests use fake identity/database/snapshot collaborators, fake time,
mock HTTP and isolated repository-local files. They do not validate real
Keycloak permissions, storage encryption, external-copy erasure, SMTP/provider
delivery or Linux execution.
