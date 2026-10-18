# Privacy and notification backend

This documents the isolated backend surfaces, not production rollout approval.
No migration or delivery provider is included.

## Wiring

Import `DotNetLiguriaCore.Services.Privacy` and
`DotNetLiguriaCore.Endpoints`, then register
`builder.Services.AddPrivacyServices(builder.Configuration, builder.Environment)`.
Map `app.MapPrivacyEndpoints()` and `app.MapNotificationEndpoints()`.
Use the existing JWT validation and exception middleware; do not enable cookies
on these routes. The unsubscribe capability is the only anonymous mutation.
The wired bearer validation additionally checks the current Keycloak account,
under the shared gate, on every authenticated API request. Disabled/deleted
accounts cannot retain access using an otherwise unexpired signed token.
Identity verification outages return explicit JSON 503, not successful access or
a misleading login redirect. This requires the configured identity-admin read
permission for all authenticated API use; ordinary anonymous reads do not.

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

## Erasure semantics

`GET /api/privacy/status`, `GET /api/privacy/export`, and
`POST /api/privacy/erase` operate only on the authenticated caller's JWT issuer
and subject. Erasure requires recent MFA and
`X-Confirm-Erasure: erase-my-account`. Success is returned only after identity
disable/logout, application deletion, snapshot purge, verified Keycloak deletion
and removal of the pending journal.

Default behavior is deliberately destructive, **not text anonymization**:

* Delete complete account-linked questionnaire responses, including answers,
  timestamps, identity/source/deduplication keys and unknown fields.
* Delete complete questionnaires authored by the account **and all their
  responses**, including other respondents' responses. Authored free text is not
  presumed anonymous. The UI must disclose this before confirming erasure.
* Delete campaign metadata attributed to the account.
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
accounts. `GET /api/privacy/admin/operations/{id}/report` reports blockers without
field values. `POST /api/privacy/admin/operations/{id}/resume`, recent MFA and
`X-Confirm-Erasure: resume-erasure` retry idempotent stages. Interrupted/corrupt
atomic writes block operations and require restricted operator recovery; never
delete a journal merely to make status appear complete.

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

`GET /api/notifications/subscription/` returns
`{version,monthlyUpcomingEvents,eventAnnouncements}`.
`PUT` accepts `{purpose,version,optIn}`, where purpose is
`monthly-upcoming-events` or `event-announcements`. Opt-in requires a current
version and a live enabled Keycloak account with verified valid email.
Opt-out does not require accepting a new notice version.
An enabled account can withdraw consent even while an erasure preflight is
blocked; pending erasure must not be used to prevent withdrawal.

Consent evidence, including purpose/version/time, exists only in Keycloak
attributes `dnl_notifications_monthly` and `dnl_notifications_events`.
There is no MongoDB subscriber directory or durable recipient email copy.

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
