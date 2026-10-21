# Website authorization

This is the application authorization prospect and operator configuration
contract. It does not authorize production realm edits, deployments, credential
changes or data migrations. Configure and exercise the provider using synthetic
staging accounts before rollout.

For the resumable, step-by-step Admin Console procedure, see
[Keycloak setup runbook](keycloak.md).
That runbook now starts with the external `scripts/configure-keycloak.ps1`
preview/apply/verify tool and its one-time provisioning-account bootstrap.
Provisioning credentials must never be installed in the website process.

## Decision: permissions in claims, roles for assignment

Applications authorize tasks, not job titles. Keycloak remains the assignment
source: **client roles are leaf permissions**, groups bundle them, and a
restricted mapper emits the effective permissions in one access-token claim.
ASP.NET Core policies enforce the permission IDs. Group names never appear in
authorization decisions.

Roles and claims are not mutually exclusive. Replacing five broad administrator
roles with many Boolean user attributes would require many mappers, risk
profile-attribute mistakes, and make assignment less understandable. Retaining
client roles as the provider's assignment mechanism while checking a permission
claim gives granular control without those disadvantages.

There is no `admin`, wildcard or super-administrator bypass. Full access means
explicitly holding every approved permission. A newly introduced permission is
not automatically assigned to a maintainer or added to a scope allowlist.
`manage` never implies publish, delete, export, restore or another domain.

The old `dnl-webdevadmin`, `feedbackadmin`, `backupadmin` and configured
privacy/notification administrator roles are not runtime fallback grants.
The dashboard no longer requires an umbrella website role before a specialist
can perform their own work.

## Current deployment and cleanup status (2026-10-19)

The operator subsequently identified and reported deleting two additional legacy realm roles:
`dnl-standardsubscriber` and `dnl-webcontentadmin`. Neither name is referenced
by the current repository, and neither grants application access in the new
model. Ordinary authenticated members need no subscriber role; content
operators need explicit task permissions. Include these roles in the
dependency review and retirement procedure below, without automatically
converting their holders to administrator permissions. Their deletion is
operator-confirmed, not independently verified by the provisioning credential.

The approved provisioning run has configured the existing live
**DotNetLiguria** realm. The operator has confirmed a successful sign-in and
access to the admin dashboard with the new authorization model.

- **Application configuration:** legacy role/Boolean-claim handlers and option
  classes are removed. No obsolete authorization keys were found in website/
  AppHost user secrets, website appsettings/Development settings, AppHost
  appsettings, the backend `.env`, or checked process/user/machine environment
  overrides. Active `Privacy` credentials/settings remain required and separate.
- **Provider configuration:** SPA, API, privacy, runtime permission and
  provisioning clients were checked with Full Scope Allowed OFF.
  `dotnetliguria-permissions` has the exact 52 API-role eligibility mappings and
  canonical permission/API-audience mappers. Unintended realm-management,
  broker and account eligibility was removed from this application scope only.
- **Legacy token output:** the SPA's dedicated `realm roles` mapper emitting
  the flattened `roles` claim and duplicate dedicated `audience` mapper were
  deleted. The canonical application-scope audience mapper remains.
  Post-cleanup provider scope evaluation still returns exactly 52 recovery
  permissions and the DotNetLiguriaCore audience, without the flattened
  `roles` claim. Existing tokens are not rewritten; renew them to observe this.
- **Recovery/runtime:** the dedicated `dotnetliguria-permission-admin`
  credential authenticates and reads current application-role assignments.
  Website Development user secrets contain this credential and protected group
  IDs. `Application recovery operators` supplies explicit full application
  recovery. The existing `Application access operators` group has current
  access-management grants and a member; it is active, not obsolete. Both
  protected group references were verified and retained.
- **Preserved deliberately:** the working privacy client, login URLs, profile/
  locale/provider-name/picture and MFA mappers, standard provider client scopes
  (including `roles`), provider/system roles and the backend's own required
  audience mapper. These are not old application authorization fallbacks.
- **Unfinished realm-role cleanup:** none of the five legacy role names exists
  under DotNetLiguriaCore. No legacy-role references were found in inspected
  client scopes or SPA/API dedicated role-scope mappings. Reading each legacy
  **realm** role still returns HTTP 403 with the provisioning credential.
  Their existence, assignments, composite dependencies and deletion therefore
  remain unverified. No realm role was deleted and no provisioning privilege
  was expanded. An authorized realm operator must finish the
  [legacy-role retirement procedure](keycloak.md#retire-legacy-application-roles-after-confirming-recovery);
  this is not a claim that the entire realm is free of legacy configuration.

Specialist separation, fresh MFA, live grant/revoke/audit persistence, privacy
flows, production deployment and Linux execution remain separate verification
items. Dashboard entry and generated provider example tokens do not establish
these outcomes.

### Read-only recheck after operator role deletion

The subsequent live recheck found zero reconciliation operations. The API has
exactly 52 roles, no extra roles and no composites. All five application/service
clients inspected are enabled, have full scope OFF and consent OFF. Only the
canonical application-scope mapper emits `permissions`; neither retired SPA
mapper reappeared. No references to the seven known legacy role names were
found in inspected application-client/shared-scope role mappings or mapper
claim names. Recovery example-token evaluation again returned exactly the
catalogue and API audience, without the flattened `roles` claim.

The client inventory consists of the two application clients, three dedicated
service clients and Keycloak's standard account/administration/broker clients;
no alternate obsolete permission-admin client was found. Standard default/
optional scopes and provider-created Docker mappers remain; these were not
identified as legacy application configuration and were not deleted merely
because they are unused by this authorization model.

Realm-role inventory still returns HTTP 403. Therefore this is a clean result
for the inspected application authorization surfaces, not a complete realm
audit or independent certification of realm-role deletion. The provisioning
client remains enabled for approved configuration work; disable it when the
operator session is finished, as described in the runbook.

## Token and request contract

Illustrative access-token fragment:

```json
{
  "permissions": ["events.read", "events.manage", "speakers.read", "venues.read"]
}
```

Create one multivalued `permissions` claim, not a separate claim type for every
permission. Values are exact case-sensitive strings from the catalogue below.
The API accepts neither a comma-separated scope string nor arbitrary role
trees/Boolean aliases as replacement permission evidence.

Authentication still validates issuer, API audience, signature and lifetime.
Existing live active-account/session verification remains separate. The
permission evaluator intersects token permissions with the user's **current
effective client-role assignments**:

```text
Issued permissions = effective assigned API roles
                     intersect requesting client's permitted role scopes
                     restricted to the API namespace by the claim mapper

Allowed request permissions = validated issued permissions
                              intersect current effective API leaf roles
```

A live lookup can remove access, never restore a permission absent from the
token. Grants need an eligible newly issued token; removing an assignment
blocks the next administrative authorization evaluation after the provider
commits it. In-flight operations are not retroactively canceled.
Role-scope/mapper configuration changes do not rewrite existing tokens:
invalidate affected sessions or renew tokens during a configuration cutover.

Permission reads are deduplicated within the request, not cached positively
across requests. Administrative dependency failures fail closed, with explicit
JSON errors; they do not return successful empty lists or login redirects.
Ordinary users with no application permission claim can still authenticate and
receive empty capabilities without the new administration credential.

`GET /api/account/capabilities` returns a no-store response:

```json
{
  "schemaVersion": 1,
  "permissions": ["questionnaires.read", "questionnaires.manage"],
  "canAccessAdmin": true
}
```

A modifier alone, such as `events.past.manage`, does not unlock the dashboard.
The frontend uses this server-evaluated contract, not decoded browser roles.
Full administrative event responses include `authorization` with `isPast`,
`allowedActions` (permission IDs) and a possible `scheduleErrorCode`.
These describe UI affordances; mutations always reauthorize on the server.

## Complete Keycloak client-role catalogue

Create these exact leaf roles under **DotNetLiguriaCore**, not realm roles and
not roles owned by DotNetLiguriaSpa.

| Permission | Authorized task |
| --- | --- |
| `events.read` | Administrative event list/details, including drafts and past events. |
| `events.manage` | Create and edit routine event content. Restricted changed fields require their additional permission. |
| `events.publish` | Publish/unpublish and change already-published public content. |
| `events.delete` | Delete an event; does not introduce new cascades. |
| `events.homepage.manage` | Select/remove the homepage event. |
| `events.past.manage` | Additional requirement for past-event mutations and sensitive related actions; never grants an action alone. |
| `event-assets.read` | Administrative asset metadata and unpublished file access. Published public downloads remain public. |
| `event-assets.manage` | Upload/replace event images, photos and materials. |
| `event-assets.delete` | Delete event assets. |
| `eventbrite.read` | Read ticket-sales and integration information. |
| `eventbrite.manage` | Configure, synchronize and change ticket capacity. |
| `eventbrite.publish` | Publish the event externally. |
| `speakers.read` | Administrative speaker records. |
| `speakers.manage` | Create/edit global speaker records. |
| `speakers.delete` | Delete a speaker. |
| `speakers.merge` | Reconcile duplicate speakers. |
| `venues.read` | Administrative venue records. |
| `venues.manage` | Create/edit venues. |
| `venues.delete` | Delete venues. |
| `board.read` | Administrative board records, including inactive/internal data. |
| `board.manage` | Create/edit board records. A board record is not an authorization assignment. |
| `board.delete` | Delete a board record. |
| `site-menu.read` | Administrative menu records, including inactive entries. |
| `site-menu.manage` | Create/edit/activate menu entries. |
| `site-menu.delete` | Delete menu entries. |
| `questionnaires.read` | Read questionnaire definitions and lists. |
| `questionnaires.manage` | Create/edit/duplicate/close/archive definitions. Published content changes also require publication permission. |
| `questionnaires.publish` | Publish/reopen questionnaires. |
| `questionnaires.delete` | Delete a definition when existing lifecycle rules permit it. |
| `questionnaire-results.read` | Aggregate statistics, not raw responses or CSV. Aggregates are not automatically anonymous. |
| `questionnaire-responses.read` | Read individual responses. |
| `questionnaire-responses.export` | Export CSV responses. |
| `questionnaire-responses.delete` | Delete a response. |
| `backups.read` | List server snapshot metadata. |
| `backups.create` | Create a server snapshot. The existing export route is not a browser dataset download. |
| `backups.restore` | Replace database contents from a snapshot, with recent MFA and confirmation. |
| `maintenance.counters.read` | Administrative counters. |
| `maintenance.counters.manage` | Create/update counters; internal event numbering remains part of event creation. |
| `maintenance.speaker-references.repair` | Run historical speaker-reference repair, with recent MFA, confirmation and past-event permission. |
| `maintenance.diagnostics.manage` | Retained authenticated Values diagnostic writes. |
| `privacy.operations.read` | Privacy queue and non-value reports. |
| `privacy.operations.manage` | Resume, verify or reconcile erasure, with existing recent-MFA and confirmation requirements. |
| `privacy.identities.read` | Reveal a privacy operation's restricted identity details, with recent MFA. |
| `privacy.notifications.retry` | Retry an administrative privacy notice; not marketing delivery. |
| `privacy.retention.read` | Read assessed retention/deletion rules. |
| `privacy.retention.manage` | Replace rules, with recent MFA and explicit confirmation. |
| `notifications.preview` | Prepare a campaign preview and recipient count. |
| `notifications.confirm` | Confirm campaign preparation, not delivery. |
| `newsletters.read` | Read newsletter drafts, templates, private previews, MIME exports and submission history. |
| `newsletters.manage` | With newsletter read access, edit drafts/templates, upload images, generate event content, clone and archive. Does not authorize sending. |
| `newsletters.send` | With newsletter read access, submit a test, approve and confirm a production handoff, or explicitly reconcile an uncertain SMTP attempt. Production readiness and revision checks still apply. |
| `access.users.read` | Bounded user lookup and application grant inspection. |
| `access.users.create` | Explicit speaker-account creation and onboarding invitation/resend; nondelegable. Never grants application access. |
| `access.permissions.grant` | Grant an eligible direct permission to another permitted target, subject to delegation checks and recent MFA. |
| `access.permissions.revoke` | Remove an eligible direct permission, subject to the same restrictions. |
| `access.audit.read` | Restricted access-assignment audit inspection. |

## Task bundles

### Board membership

Provisioning creates a separate top-level `Board members` group, with exactly
`events.read`, `event-assets.read`, `speakers.read`, `venues.read`, `board.read`,
`site-menu.read`, `questionnaires.read`, and `questionnaire-results.read`.
There are no writes, raw response reads, ticketing integration, backups, privacy,
maintenance or access-directory permissions in this baseline.
Full Scope Allowed remains OFF; ordinary explicit application scope mappings
govern which assigned permissions appear in renewed tokens. Live group lookups
never restore permissions omitted from the operator's token.

The Board page first saves public content, including the free-text **Ruolo**
(`Description`). Operators can then discover an existing account by exact email
or explicitly select one through the private directory, confirm its stable
issuer/subject link, and separately confirm joining the fixed group.
Profile saves cannot create or modify links or membership. Hidden and legacy
unlinked profiles remain editable. Account email changes never switch links.
There is no automatic enrollment or relinking.

Bearer-only operations are under `/api/admin/board-accounts/{id}`:
`GET` reads account state, `POST /link` confirms a new link and
`POST /membership` joins/leaves. Linking requires `board.manage` and
`access.users.read`, recent MFA and `X-Confirm-Board-Change: link`; it does
not require grant authority or the Board baseline and never enrolls the user.
Membership writes require `board.manage`, the appropriate
`access.permissions.grant`/`revoke`, recent MFA and `X-Confirm-Board-Change`
(`join` or `leave`). Discovery also requires `access.users.read`;
reading account state additionally requires `board.read`. Joins require the
operator's current possession of every baseline permission.
Only this fixed group permits self/protected targets; arbitrary direct grants
retain their existing restrictions. Runtime group validation rejects foreign,
realm, composite, missing or extra roles and nested/replaced groups.

Linking requires the separately approved partial unique MongoDB index described
in [keycloak.md](keycloak.md). The index enforces identity uniqueness across
application instances; ordinary content editing does not require it.
Linking and photo attribution share the privacy-erasure operation gate; actor
and target active-account/journal checks happen inside that lease. Membership
changes retain their existing serialization. Expected
link/member state rejects stale requests, but provider changes outside this
application are not a distributed transaction. Audit intent precedes each write;
readback must verify it. Failures leave explicit unverified state: reload and
inspect, never assume rollback or automatically retry.
Membership audit actions are `board-join`/`board-leave` with `GroupId`; profile
linking uses `board-link`. These are not direct permission grants.

Leaving changes only that group's membership. The public profile, title, stable
link, direct grants and unrelated groups survive. Hiding or deleting a profile
does not revoke membership. Renew the affected user's token/sign in again to
obtain newly granted reads.

Account privacy export includes only the private Board link, and erasure detaches
it by exact issuer/subject with readback verification (inventory version 4).
Historical public editorial profiles are retained, not inferred as disposable by
email. Their content/contact retention remains a separate controller-approved
policy boundary; this feature does not claim complete public-profile erasure.

### Speaker account association and onboarding

Bearer-only routes under `/api/admin/speaker-accounts/{id:guid}`:

| Operation | Permissions | Confirmation/body |
| --- | --- | --- |
| `GET` | `speakers.read` + `access.users.read` | No mutation |
| `POST /link` | `speakers.manage` + `access.users.read` | `link`; `{subject,expectedEmail}` |
| `POST /create-and-invite` | Above + `access.users.create` | `create-and-invite`; `{expectedEmail}` |
| `POST /resend-invitation` | Above + `access.users.create` | `resend-invitation`; `{subject,expectedEmail}` |

Every mutation requires recent MFA and the exact action in
`X-Confirm-Speaker-Change`. `access.users.create` is deliberately nondelegable;
approved provider provisioning, not the access-grant UI, assigns it.
Link returns 204. Other operations return
`{speakerId,email,account,candidates,onboardingState}`; `account` and candidates
use the existing private `AccessUserSummary` shape. Public speaker JSON never
contains account issuer/subject. Discovery is read-only and never automatically
links, creates an account or grants anything.

Linking requires a unique exact case-insensitive email match, an enabled human,
and the unchanged expected profile email. Ambiguous, disabled, service-account,
stale and foreign-issuer selections fail closed. Both account identity fields
are immutable through ordinary profile updates. A linked identity survives
email changes. A separately approved partial unique identity index is mandatory
for linking and creation (see keycloak.md); no runtime index creation occurs.

Creation refuses any existing matching account: use explicit link instead.
It creates only an enabled, unverified account, with `UPDATE_PASSWORD` and
`VERIFY_EMAIL`; it never supplies temporary passwords, marks email verified,
resets an existing matching account's password, joins groups or grants roles.
The configured allowlisted client/redirect and bounded lifetime are passed to
Keycloak `execute-actions-email`. SMTP and required actions must be operational
before enabling this capability.

Audit intent precedes each provider/link mutation; account and link readback
must verify success. Durable per-profile creation reservations live in
`<SpeakerCollectionName>AccountOperations`, separately from public profiles.
Records retain the immutable `Issuer`/`Subject` (subject can be unknown after
transport uncertainty), email, state and audit correlation. All speaker mutations
hold the same application-local privacy gate as erasure, rechecking actor and
target active-account/journal state inside it before account-linked writes.
States `create-pending`/`create-uncertain`/`created-unverified` require deliberate
operator reconciliation, never automatic or blind POST retries. An uncertain
provider POST might already have created an account: reload discovery and
inspect the provider, then explicitly link the unique verified account.
This alone does not authorize resetting/inviting a pre-existing account.

`created` means a provider account exists, not that email succeeded.
Email failure preserves the new account and link and returns
`invitation-failed`; an interrupted email attempt may remain `invitation-pending`.
Only an explicit resend for the same linked account originally created by the
recorded operation may retry. Resend includes only still-pending password action
and email verification when not yet verified; a completed password is not reset.
`invited`/audit `accepted` means provider acceptance, **not delivery**.
Provider/link failures are audited `unverified`; no distributed transaction or
delivery receipt is claimed. No live provider/database writes were needed to
implement or unit-test this workflow.

### Other task bundles

Groups are conveniences, not additional privileges. Use independently
composable groups; explicitly assign destructive/sensitive additions.

| Suggested group | Exact initial membership |
| --- | --- |
| Event editors | events.read, events.manage, speakers.read, venues.read |
| Event publishers | events.read, events.publish, events.homepage.manage |
| Event media editors | events.read, event-assets.read, event-assets.manage |
| Ticketing operators | events.read, eventbrite.read, eventbrite.manage |
| Questionnaire designers | events.read, questionnaires.read, questionnaires.manage |
| Questionnaire publishers | questionnaires.read, questionnaires.publish |
| Feedback analysts | events.read, questionnaires.read, questionnaire-results.read |
| Community editors | board.read, board.manage |
| Speaker editors | speakers.read, speakers.manage |
| Venue editors | venues.read, venues.manage |
| Site menu editors | site-menu.read, site-menu.manage |
| Privacy operators | privacy.operations.read, privacy.operations.manage, privacy.retention.read |
| Notification preparers | notifications.preview |
| Newsletter editors | newsletters.read, newsletters.manage |
| Newsletter senders | newsletters.read, newsletters.send |
| Backup operators | backups.read, backups.create |

Historical operators receive their chosen task bundle plus events.past.manage.
For example, a historical questionnaire exporter needs
questionnaire-responses.export AND events.past.manage, together with the read
permissions needed to navigate their dashboard.

Access operators receive access.users.read and the approved grant/revoke
controls, plus only the task permissions they may delegate. Provision these
operators out of band. Protected maintainers receive an explicit reviewed
expansion of this catalogue, not `*` or an automatically expanding composite.
The development realm contains a small set of illustrative groups, not a
complete production user/assignment inventory.

## Full Scope Allowed MUST be OFF

Set **Full Scope Allowed = OFF** (`fullScopeAllowed: false`) for the SPA,
backend and every relevant service-account client. Do not enable it to
troubleshoot missing permissions.

Role assignment, role-scope eligibility, claim mapping and audience mapping
are separate controls:

| Requesting client | Explicit role-scope mapping | Token output |
| --- | --- | --- |
| DotNetLiguriaSpa | Approved API leaf roles via the default application-permissions client scope. | Eligible assigned API roles in permissions; explicit API audience. No provider administration privileges. |
| DotNetLiguriaCore interactive backend | Only application roles actually needed by that interactive flow. | No implicit API access from a backend cookie or ID token. |
| Permission directory/assignment service account | Only approved provider administration roles, both assigned to the service account and explicitly scope-eligible. | Provider-required administration role claims/audience, not the SPA permissions mapper. |
| Existing privacy identity-admin service account | Only separately approved privacy operations, both assigned and scope-eligible. | No application task grants or unrelated role-administration expansion. |

The implementation supports a dedicated permission-directory credential; do not
misrepresent a shared read/write credential as read-only. Split credentials
further if required by deployment. Actual fine-grained provider permissions must
be verified against the installed Keycloak release. `manage-users` may confer
broader provider powers than the application's allowlisted role-mapping API;
application guards do not constrain a stolen provider credential.

### Application mapper setup

1. Create the exact DotNetLiguriaCore client roles listed above.
2. Create default client scope `dotnetliguria-permissions`, protocol OpenID
   Connect, and attach it to DotNetLiguriaSpa. This must not depend on the
   browser requesting an optional scope.
3. In its role-scope mappings, explicitly allow the approved DotNetLiguriaCore
   leaf roles. Group assignment alone does not create scope mappings.
4. Add **User Client Role** mapper, restricted client ID DotNetLiguriaCore,
   empty role prefix, token claim name `permissions`, String JSON type,
   multivalued ON, access token ON. ID token/UserInfo exposure is not needed
   for API authorization. Do not use a hardcoded list or editable user
   attribute as the permission source.
5. Preserve/configure the explicit DotNetLiguriaCore API audience mapper.
   Keep `openid` and the existing UserInfo response used by live authentication.
   An audience is not an authorization grant.
6. With full scope OFF, configure administration service-account assignments
   AND their explicit role-scope mappings separately. Keep service tokens and
   runtime credentials out of the browser, VITE variables, logs and source.
7. Use client-scope evaluation and synthetic users to check assigned+allowed,
   assigned+out-of-scope, unassigned+allowed, inherited and foreign-client
   roles. An unassigned role must not appear just because it is scope-eligible.
8. Test ordinary members whose role-restricted application scope emits no
   permissions. They must still use normal login and self-service.
9. Adding a permission requires coordinated catalogue, role, scope mapping,
   reviewed assignment, test and documentation changes. Renew tokens afterward.

`keycloak\dev\realm-dotnetliguria.json` explicitly disables full scope and
contains the non-secret application mapper/role-scope fixture. It is a local
theme/development fixture, not a production realm export or an automatic
least-privilege service-account provisioning script. Its service account is
intentionally unprivileged until an operator configures approved provider
administration permissions.

## Endpoint and field-level enforcement

The canonical policy catalogue and method/route mapping are under
`DotNetLiguriaCore\Authorization`. Every permission policy selects the Bearer
scheme. Existing broad endpoint declarations are replaced by the final
route-convention mapping, not combined with legacy-role authorization.

- Event creation/update/deletion uses events.manage/delete. Dedicated
  `PUT /api/Workshop/Publication/{id}` with `{ "published": true }` and
  `PUT /api/Workshop/Homepage/{id}` with `{ "selected": true }` let publishers
  work without routine event-editing power.
- Whole-record PUT additionally checks actual changes to publication, homepage,
  asset URLs, feedback and Eventbrite settings. Unchanged restricted fields do
  not require new powers; unauthorized changes return 403, not silent success.
- Already-published public changes require events.publish. Updating assets of a
  published event also requires it. No content-version staging workflow is
  implied: draft-only editors cannot silently change live content.
- Sessionize preview needs events.read plus speakers.read; import needs
  events.manage plus speakers.manage because it changes shared speaker data.
- Eventbrite reads, manage operations and external publication are separate.
  `PUT /api/Eventbrite/Configuration/{id}` accepts only `{salesStart,salesEnd,ticketCapacity?}`
  (nullable local `yyyy-MM-ddTHH:mm` strings in the configured Eventbrite time
  zone) with `eventbrite.manage`, without `events.manage`. It validates the
  window/DST, preserves unrelated event fields and returns 204; reload the
  administrative event afterward. Uncertain provider-creation/reconciliation
  states return 409 rather than resetting their duplicate-prevention guard.
  The optional capacity sets the initial quantity before a provider ticket
  exists. Once a ticket exists, changed capacity must use the existing
  SetTicketCapacity action with live sold/pending verification; otherwise the
  configuration action returns `eventbrite_capacity_requires_live_verification`.
  Synchronization and publication actions remain separate;
  historical configuration changes additionally need `events.past.manage`.
- Questionnaire definition/lifecycle, aggregate statistics, raw-response
  access, export and response deletion use distinct policies.
- Backup listing, creation and restore are separate. Restore retains the
  existing privacy gates, confirmation and recent MFA. Creation accepts an
  optional `name` query parameter (up to 120 characters, no control characters).
  Names are display metadata in the snapshot manifest and list response, never
  filesystem identifiers; older unnamed snapshots remain supported.
- Privacy queue/report, identity reveal, recovery, notice retry and retention
  use separate policies. Ordinary personal-area routes retain their own
  authenticated-account ownership rules.
- Campaign confirmation still returns unavailable when no approved provider
  exists. A permission change must not enable marketing delivery or claim
  that a message was sent.
- Existing deliberately public reads/submissions remain public under their
  existing projection, consent and lifecycle rules. Administrative fetches to
  mixed public/admin collection routes send `X-Admin-Request: true`; the
  server checks the domain read permission before allowing that administrative
  request. Omitting the header never authorizes private record projections.

## Current and past events

Use stored event data, injected time and Europe/Rome (configurable through
Authorization:EventTimeZoneId), never browser or machine-local time.
An event is past at its scheduled end, with legacy track ends as a fallback.
A date-only event ends at the next local midnight, not a fixed 24 hours later.
Ambiguous legacy DST end times use the later instant. Invalid/undated published
records require explicit correction, not an assumption that they are current.
Unscheduled drafts remain editable; publication needs a valid date.

Normal administrative read permissions cover both periods. Writes, deletes,
publication, raw-response reads/exports and sensitive integrations involving a
past event need their task permission AND events.past.manage. Linked assets
and questionnaires inherit this boundary. Standalone questionnaires do not.

Check both stored and proposed event dates/linkage, including questionnaire
creation, relinking, detachment and duplication. Moving a past event into the
future must not evade authorization. Homepage changes also check the historical
items they clear. The whole-dataset speaker-reference repair conservatively
requires the past modifier.

Shared speaker, board and venue records are globally managed. Their edits can
change how past events render. Global privacy erasure and whole-database
restore retain their independent authorization; they are not blocked by this
event-period modifier.

Resource decisions and writes are serialized within the current application
instance. This is not distributed locking or provider/database atomicity.
Multi-instance writers and out-of-band data edits require additional supported
coordination/conditional-write controls before deployment relies on a global
serialization guarantee.

## Access management and audit

The access page manages direct application leaf permissions only. Group/
inherited permissions are visible but read-only. Removing a direct grant that
is also inherited does not remove effective access; the result must say so.

Actors need the correct grant/revoke control, user inspection rights, the
current target permission themselves, recent MFA and explicit confirmation.
Self-edits, service accounts, protected operators/maintainers, foreign-client
roles and composite role assignments are rejected.

The server delegation allowlist excludes access.*, maintenance.*, privacy.*
and backups.restore. Holding those privileges does not make them delegable
through this page. Use the approved provider console for protected assignments
and recovery; do not add a temporary application bypass.

The provider adapter uses a fixed issuer/client boundary, immutable subject
identifiers, bounded requests, no redirects/cookies and no credential/body
logging. Mutations are role-mapping deltas, not full user/profile replacements.
Expected-state checks and persistence verification expose conflicts or
unverified outcomes rather than reporting false success.

Audit records are restricted operational data. Actor/target references remain
personal data even without names/emails: their storage, export, retention and
erasure handling must be integrated with the existing privacy lifecycle.
Never copy audit subjects, tokens or provider response bodies into public logs.
Out-of-band console changes and concurrent provider writers cannot be made
transactional by an in-process application lock.

### PermissionDirectory configuration

`AddPermissionDirectory(configuration)` binds the `PermissionDirectory`
section. Missing or invalid values fail closed with HTTP 503
`permission_directory_not_configured`; they never produce an empty grant set.

| Key | Constraint |
| --- | --- |
| `Issuer` | Absolute HTTPS URI on port 443 whose host equals `AllowedIdentityHost` and whose path is exactly `/realms/{realm}` (realm: 1-100 letters, digits, `-` or `_`). No user info, query or fragment. Must equal the token issuer of managed accounts. |
| `AllowedIdentityHost` | Defaults to `hello.vevy.com`. |
| `ServiceClientId` | Required. Confidential service client used only for permission lookup/delegation. Must differ from `Privacy:AdminClientId`. |
| `ServiceClientSecret` | Required secret (user secrets/environment/secret store only). Must differ from `Privacy:AdminClientSecret`. |
| `ApplicationClientId` | Must be exactly `DotNetLiguriaCore`. Its internal client UUID is resolved server-side with `GET /admin/realms/{realm}/clients?clientId=DotNetLiguriaCore`; exactly one matching client with a GUID `id` is required. |
| `ProtectedGroupIds` | Non-empty array of GUID group IDs whose members are protected targets (for example operators/maintainers). |

The service client uses the client-credentials grant at
`{Issuer}/protocol/openid-connect/token` (`expires_in` 1-86400 seconds; the
token is cached per request scope until 30 seconds before expiry). It needs only
realm-management `view-users`, `query-users`, `view-clients`, `query-clients` and
`manage-users` (for role-mapping deltas); keep Full Scope Allowed OFF for it
too. The named `PermissionDirectory` HttpClient has a 20 second timeout, 256 KiB
response buffer, no automatic redirects, no cookies/default credentials, no
activity propagation and no HTTP client logging.

Live lookup reads direct (`/users/{subject}/role-mappings/clients/{clientUuid}`)
and effective (`.../composite`) client roles. Every known role must have an
`id`, `name`, `containerId` equal to the client UUID, `clientRole: true` and be
non-composite; unknown roles are ignored; more than 512 mappings is rejected.
Inherited roles are read from `/users/{subject}/groups?first=0&max=100&briefRepresentation=false`
(`clientRoles.DotNetLiguriaCore`); 100 or more groups fail closed. Writes fetch
`/clients/{clientUuid}/roles/{permission}` and POST/DELETE exactly that one
non-composite role on the user's direct client mapping. Provider non-success,
network and timeout failures return 503 `permission_directory_unavailable`;
malformed or non-JSON responses return 503
`permission_directory_invalid_response`; unknown users return 404
`access_target_not_found`.

### Access API contract

Base path `/api/admin/access`. Bearer authentication is required; every
response carries `Cache-Control: no-store, private` and `Pragma: no-cache`.
Errors are problem JSON with a stable `code` extension. Subjects must be GUIDs.

| Route | Policy | Request | Response |
| --- | --- | --- | --- |
| `GET /permissions` | any of `access.users.read`, `access.permissions.grant`, `access.permissions.revoke` | - | `{permissions:[{id,delegable}]}` |
| `GET /users?search=&first=0&max=20` | `access.users.read` | `search` optional, at most 100 chars, no control characters; blank lists all users through bounded pages; `first` 0-10000; `max` 1-50 | `{users:[{issuer,subject,username,enabled,protectedTarget}],first,max,hasMore}`; `protectedTarget` is `true` for service accounts, otherwise `null` (resolved in detail) |
| `GET /users/{subject}` | `access.users.read` | - | `{issuer,subject,username,enabled,directPermissions,inheritedPermissions,effectivePermissions,protectedTarget,isSelf,canGrant,canRevoke,grantablePermissions,revocablePermissions}` |
| `POST /users/{subject}/permissions/{permissionId}` | `access.users.read` + `access.permissions.grant` | header `X-Confirm-Access-Change: grant`; body `{expectedDirectPermissions:string[]}` | `{issuer,subject,directPermissions,inheritedPermissions,effectivePermissions,changed,correlationId}` |
| `DELETE /users/{subject}/permissions/{permissionId}` | `access.users.read` + `access.permissions.revoke` | header `X-Confirm-Access-Change: revoke`; same body | same as POST |
| `GET /audit?first=0&max=50` | `access.audit.read` | `first` 0-10000; `max` 1-100 | `{entries:[{at,action,permission,actorSubject,actorUsername,targetSubject,targetUsername,outcome,correlationId}],first,max,hasMore}`, newest first; usernames resolved at read time (null when unavailable) |

Mutation rules, all checked server-side:

- recent MFA and the exact confirmation header value;
- the actor's live intersected permissions include the policy permissions and
  the target permission itself; the permission must be delegable (not
  `access.*`, `maintenance.*`, `privacy.*` or `backups.restore`);
- the target is not the actor, is enabled and is not protected (service
  account, effective holder of any non-delegable permission, or member of a
  `ProtectedGroupIds` group);
- `expectedDirectPermissions` is a unique set of known IDs exactly equal to the
  current direct grants (malformed: 400 `invalid_expected_access_snapshot`;
  stale: 409 `access_assignment_changed`, the client must reload);
- granting an existing direct grant returns `changed:false` with an empty
  `correlationId`; revoking a non-direct permission returns 409
  `permission_remains_inherited` or `permission_not_directly_assigned`;
  revoking a direct grant that is also inherited succeeds and stays effective;
- after the write the direct set is re-read and must equal the expected delta
  (a grant must also be effective); otherwise 503 and an `unverified` audit.

Other stable codes: `self_access_change_forbidden` (403),
`explicit_access_confirmation_required` (400), `access_change_forbidden` (403),
`protected_access_target` (403), `access_target_unavailable` (409, disabled
target), `access_change_not_verified`/`access_change_unverified` (503),
`invalid_access_search`, `invalid_access_target`, `invalid_access_audit_page`
(400). Changes are serialized per target only inside one application instance.

The **Accessi utenti** page defaults to **Solo board** (25 per page), listing
direct members of the configured **Board members** Identity Provider group.
MongoDB profiles, email, title and public visibility do not affect this filter.
The bounded provider scan fails explicitly instead of silently truncating at
10,000 members; searches match usernames before page slicing. Missing group
configuration or unsafe group grants are errors, not empty results. The API
uses `boardOnly=true` to filter before pagination; omitting it preserves the
unfiltered API behavior. Search and paging retain the chosen filter, while
**Mostra tutti** clears the search and shows all accounts. Selecting a user displays a permission
table with a direct-assignment checkbox, inherited status and effective status.
Checking/unchecking opens a confirmation dialog; it does not bypass recent MFA,
optimistic concurrency, delegation, self/protected-target restrictions or
verified persistence. Inherited grants remain read-only and survive removal of
a duplicate direct grant. The **Cronologia modifiche ai permessi** section
explains its last 25 application-recorded grant/revoke operations and uses
**Ricarica cronologia modifiche**; it does not represent provider-console edits.

Failed permission changes keep the selected user and last-read permission
table visible. The table is explicitly marked stale and further changes stay
disabled until **Ricarica accessi selezionati** succeeds, including when a
write may have succeeded but its follow-up verification failed. Failed reloads
also preserve the table; mutations are never retried automatically.
Errors retain the API code and explain MFA, concurrency conflicts, target
restrictions, audit outages and provider failures. MFA/target restrictions do
not invalidate the operator's capabilities; actual authorization denials still
do. The reported live grant failure's original response code was unavailable,
so its particular cause and a successful live grant remain unverified.
Failure-recovery verification passed all 18 focused specialist tests and all
539 frontend tests, plus typecheck and lint (four existing warnings).
The rebuilt 35 SPA files match both website publish output and the local
served `wwwroot`, without deleting historical files. The final HTTPS check
could not run because the backend had stopped: no website process or 5443
listener was present. Restart the backend to exercise the new recovery UX
and capture the original grant failure code; no live grants were changed
for this verification.
The operator subsequently observed HTTP 403 on the grant POST, but its
response code remains unavailable; status alone does not establish an MFA or
permission cause. A further feedback update places a prominent, focusable,
sticky result beside the selected permissions, shows progress in the
confirmation dialog, explains disabled checkboxes and replaces silent
confirmation exits with explicit errors. All 19 focused specialist tests,
typecheck and lint passed (four existing lint warnings). The website was
republished and the new bundle verified at HTTPS 5443; anonymous directory
access still returns 401. A successful authenticated grant remains unverified.

#### Recent-MFA prerequisite for grant/revoke

Grant/revoke require an access token with `acr` = `mfa` or `hwk` and an
`auth_time` no older than 300 seconds. **Verifica MFA per modificare gli
accessi** requests only `acr_values=mfa` (see below for why `max_age=0` and
`prompt=login` are not sent), but the
Identity Provider can certify `mfa` only for accounts with a second factor
(OTP or security key) and a step-up browser flow mapping that level.
A read-only check (2026-10-19) found the recovery operator account signs in
through the Google broker and has no Keycloak OTP credential, so step-up
cannot yield `acr=mfa`; the resulting 403 `recent_mfa_required` is the
intended fail-closed behavior, not a defect. The observed service-worker
"Failed to fetch" on a `/admin/access` navigation is unrelated: the login
callback navigates client-side, and the backend was continuously reachable.

Operator fix (do not weaken the backend check): configure OTP for the
operator account (Keycloak account console, or the user's **Configure OTP**
required action), and confirm the realm's bound browser flow is the step-up
flow whose level 2 condition requires OTP for brokered and local sign-ins,
with the realm ACR→LoA map containing `mfa` (the discovery document already
advertises `pwd`, `mfa`, `hwk`). The provisioning client cannot read
authentication flows (HTTP 403), so the flow binding remains operator-verified.

The page now shows the current sign-in level from the ID token `acr` claim
and, when it is not `mfa`/`hwk`, links to **Area personale**. That page's
**Secondo fattore di accesso (MFA)** section starts OTP or security-key
enrollment through Keycloak application-initiated actions (`CONFIGURE_TOTP`,
`webauthn-register`, both verified enabled in the realm).
Enrollment alone does not raise the level: the default login requests
`acr_values=pwd`. **Verifica MFA ora** (and every other MFA button, via the
shared `account/mfaStepUp.ts`) requests only `acr_values=mfa`. It deliberately
does not send `prompt=login`/`max_age=0`: forcing a full re-login shows the
Google button again, and a brokered sign-in skips the realm OTP step. A real
step-up reuses the session (level 1 satisfied) and asks only for OTP, refreshing
`auth_time`; grant/revoke must follow
within 5 minutes. If the level stays `pwd`, the realm browser flow (and, for
brokered accounts such as Google, the identity provider's post-login flow) must
require OTP for the `mfa` level, with the ACR-to-LoA mapping `mfa` = 2.
Verified live: the SPA client overrides the browser flow with
"Browser step-up with TOTP_RAF" and maps `pwd`=1, `mfa`=2, `hwk`=3. Google-brokered
sign-ins bypass that flow's conditional OTP. Confirmed 2026-10-19 with a browser
network trace: on step-up (`acr_values=mfa`) Keycloak sends a Google-linked user
straight to `/broker/google/login`; Google answers silently (`prompt=none`) and
`/broker/google/endpoint` returns to the SPA callback without running the
browser flow's level-2 OTP Form, so `acr` stays `pwd`. The fix is the Google
identity provider's **Post login flow**, with two Conditional subflows in order:

1. Level 1: "Condition - Level of Authentication" (level 1) + "Allow access"
   (both Required). The Google sign-in itself is the level-1 proof.
2. Level 2: "Condition - Level of Authentication" (level 2, max age 300) +
   "OTP Form" (both Required).

The level-1 subflow is mandatory. Keycloak's `ConditionalLoaAuthenticator`
returns `true` whenever no level has been reached yet in the current
authentication. After a Google login no level is recorded, so a lone level-2
condition matches on every login and always asks for OTP. Once level 1 is
recorded, the level-2 condition matches only when `mfa` is requested
(`pwd` → 1 < 2 is skipped). Keep Cookie and Username Password Form out of this
flow. SSO is unaffected because the cookie stays in the client's browser flow.
Step-by-step console instructions are in `docs\keycloak.md`, section 6G. Earlier analysis notes: a Google-only session has no recorded LoA, so the step-up
re-runs the level-1 condition (Username Password Form, which also offers Google);
completing it through Google ends the flow before the level-2 OTP Form.

The 2026-10-19 permission-scope repair had also removed `account` client
eligibility, so SPA tokens lost `aud=account` and the personal page failed with
401 `profile_session_expired`. The provisioning tool now keeps a dedicated SPA
scope mapping to exactly `account/view-profile` and `account/manage-account`.
It was applied and verified with zero remaining operations; scope evaluation
shows `aud` = DotNetLiguriaCore and account, account roles only, no realm
roles. Full Scope Allowed remains OFF. 20 offline provisioning tests passed. The `recent_mfa_required` error explains the 5-minute window. This
hint is UI-only; the backend remains authoritative. 21 focused specialist
tests and typecheck passed; the rebuilt bundle was published, overlaid and
verified at HTTPS 5443.

The operator confirmed that a Google-brokered step-up asks for OTP. The first
version of the flow lacked the level-1 subflow, so it also asked for OTP on every
Google login; adding the level-1 subflow fixes that.

#### Access page layout and MFA gating

For operators holding grant or revoke, **Accessi utenti** is ordered as:

1. **Verifica MFA** – a live status from the ID token (`acr`, `auth_time`),
   refreshed every second: "MFA attiva … M:SS minuti", "MFA scaduta" or
   "MFA non attiva per questo accesso (livello: X)".
2. The step-up button **Verifica MFA**, without a personal-area configuration
   link. The same status and step-up section appears at the top of **Backup e
   import** for operators holding restore permission; it returns to the current
   page, preserving its query and fragment.
3. **Seleziona un utente** – paged list and optional search.
4. **Permessi di <utente>** – the permission table. Checkboxes stay disabled
   until the MFA window is active, with an explicit explanation; a confirmation
   that arrives after the window expires is refused locally without any request.

The UI rule mirrors `RecentMfa` (`mfa`/`hwk`, at most 300 seconds) only as a
hint; the backend remains authoritative and still returns 403
`recent_mfa_required`. Read/audit-only operators see no MFA step and no step numbering.

The audit table shows date, **Eseguita da** (actor), **Utente modificato**
(target), operation, permission, outcome and reference. The server resolves
actor and target subjects to usernames through the permission directory at
read time; names are never written to `AccessPermissionAudit`. Unresolvable
subjects (deleted account, directory outage, non-GUID) show **Account non più
disponibile** with the subject underneath; directory failures never block the
audit read.

Verification: 23 focused specialist tests (including MFA status/order/gating
and audit names), all 547 frontend tests, typecheck, lint and 19 backend
Access tests (including name resolution without persistence) passed. The SPA
was rebuilt, the website published, `dist` overlaid, and the new bundle
verified at HTTPS 5443 after restarting Aspire; anonymous audit access returns
401. Authenticated name display remains to be checked by the operator.
### Audit storage and privacy

Mongo collection `AccessPermissionAudit` stores only `_id`, `At`, `Action`
(`grant`/`revoke`), `Permission`, `ActorIssuer`, `ActorSubject`,
`TargetIssuer`, `TargetSubject`, `Outcome` (`intent`, `verified`,
`unverified`) and `CorrelationId`. No names, emails, tokens or provider bodies
are stored. An `intent` row is written before each provider write; audit store
failures return 503 `access_audit_unavailable` and block the change. The API
omits `_id` and issuers. The collection is part of erasure inventory version 3:
account export includes rows where the account is actor or target with the
counterparty reference redacted, and erasure deletes those rows and verifies
none remain. No separate time-based retention is implemented yet; rows remain
until account erasure, so an explicit retention period must still be decided.

## Breaking cutover and recovery

| Legacy grant | Reviewed replacement starting point, not automatic migration |
| --- | --- |
| dnl-webdevadmin | Selected event, speaker, venue, board and menu editor groups; publishing, deletion and integrations explicitly reviewed. |
| feedbackadmin | Questionnaire designer/publisher or feedback analyst groups according to actual duties; raw responses/exports separately reviewed. |
| backupadmin | Backup operator group; restore independently reviewed and MFA protected. |
| privacyadmin (former configured privacy administrator) | Privacy queue/operator duties; identity disclosure, notice retry and retention management independently reviewed. |
| notificationadmin (former configured notification administrator) | Preview/confirmation duties; no delivery permission. |

1. Configure full scope OFF, roles, exact scope mappings, mapper and audience in
   staging. Provision runtime-only service credentials and approved provider
   restrictions. Verify token contents without logging actual tokens.
2. Bootstrap protected access operators and an explicit maintainer recovery
   group in the provider. Test recovery before removing any old assignment.
3. Assign reviewed bundles to synthetic personas and test both allowed and
   forbidden operations, direct/inherited grants, live revocation and MFA.
4. Release matched API and SPA artifacts. Old-only privilege tokens must gain
   no new permission. Renew/revoke old sessions as needed.
5. Verify the backend-served SPA and API at https://localhost:5443 locally and
   the approved staging origin. Checking Vite alone is insufficient.
6. After confirming protected recovery access, inspect and retire confirmed
   application-exclusive legacy roles (`dnl-webdevadmin`, `feedbackadmin`,
   `backupadmin`, `privacyadmin`, `notificationadmin`) and their obsolete
   mapper/scope references. Check both realm and API-client namespaces, user/
   group assignments, composites and other clients before deletion. Preserve
   provider/system roles and privacy service-account privileges. Follow the
   [legacy-role retirement procedure](keycloak.md#retire-legacy-application-roles-after-confirming-recovery);
   the provisioning tool does not delete realm-role definitions.
7. Roll back matched application/configuration artifacts if required; never
   enable full scope, retain a legacy-role fallback or introduce an authorization
   bypass as a rollback mechanism.

## Authorization verification

xUnit.net v3 tests cover catalogue/token/live intersections, exact role-scope
fixtures, issuer/audience rejection, every permission through the in-memory
authentication/authorization pipeline, zero downstream execution on denial,
route mappings, changed-field boundaries, event time/DST and access management.
Vitest covers server capability parsing, specialists, page/action gates and
suppressed private data loads. Unit collaborators are fake: no real identity
provider, network, browser, database, sleep or wall-clock waits.

Use the checked-in xUnit executable runner on the pinned .NET 10 toolchain:
`dotnet run --project tests\DotNetLiguriaCore.Tests -c Release --no-build --no-restore --`.
The older VSTest `dotnet test` invocation is not supported by the current test
platform configuration. Use `scripts\verify.ps1` for the shared counted gate
and `scripts\verify-publish.ps1` for project-path publish/static-asset checks.

Real provider token issuance, the installed release's fine-grained
administration model, Windows/Linux evidence and live browser/database checks
are separate rollout evidence. Configuration/unit tests do not establish that
these checks have been executed successfully.

### Implementation verification snapshot

- Windows root solution build passed with no warnings/errors.
- The shared counted gate passed: 531 backend tests, 530 frontend tests and
  26 repository-standard tests, within the existing time budgets.
- Frontend typecheck and production build passed. Lint passed with four
  existing warnings; the existing bundle-size warning remains.
- Website and DataMigration project-path publishing passed. All 35 generated
  SPA files matched the published output, historical asset hashes matched,
  and the served backend `wwwroot` was overlaid without deleting old assets.
  All 35 overlaid SPA files matched the production build. Neither application
  nor DataMigration was executed by the publish verification.
- A temporary backend at `https://localhost:5443` served the rebuilt SPA index
  and both entry assets. Anonymous capability, access-catalogue and backup-list
  requests returned 401 without redirects; an unknown API route returned 404.
  Synthetic dependencies used unreachable loopback addresses; no real provider
  or database was used. The temporary host was stopped afterward. This startup
  check exposed and fixed missing explicit DELETE-body binding on permission
  revocation; an endpoint-materialization regression test now covers it.
- Later approved live provisioning verified reconciliation, runtime credential
  authentication, recovery effective grants and provider scope evaluation with
  Full Scope Allowed OFF; local runtime settings were installed without
  displaying secrets. The operator confirmed authenticated dashboard entry.
  After legacy SPA-mapper deletion, scope evaluation again verified all 52
  exact permissions, the API audience and absence of the flattened roles claim.
  These runs changed realm configuration, not application database records,
  and did not deploy application artifacts.
- Provisioning reconciliation/cleanup tests now cover 19 offline cases,
  including opt-in, narrowly matched legacy-mapper removal, preservation of
  custom/MFA/canonical mappers and repeatability.
- The latest cleanup shared gate built the solution and passed 26 repository
  tests (5.62s) and 531 backend tests (6.43s). Both cleanup full-gate attempts
  failed in frontend execution. The first passed 529 of 530 tests, with the
  AdminShell Ctrl+K quick-search test failing to find its dialog. Its focused
  rerun passed all 11 AdminShell tests in 7.70s. No frontend code was changed
  for this cleanup, no test budgets were increased, and no green full-gate
  result is claimed.
- Linux CI, specialist browser flows, provider fine-grained administration,
  fresh MFA and live audit persistence remain unverified. Audit age-based
  retention and stronger multi-instance coordination remain explicit
  operator/deployment decisions.

### User-directory and checkbox-table update

The subsequent shared gate passed: 26 repository tests (6.52s), 536 backend
tests (5.81s) and 533 frontend tests (96.76s). Added coverage checks unfiltered
bounded pagination, optional search/reset, checkbox grant/revoke confirmation,
cancellation, inherited/protected grants and audit-only history access.
After adding the focus-managed confirmation modal, the 12 focused specialist
tests and frontend typecheck passed again. Lint has no errors and four existing
warnings. Production build retains the existing bundle-size warning.

Final website/DataMigration publishing verified 35 SPA files and historical
assets. Generated files were overlaid into the backend's served `wwwroot`
without deletion. HTTPS 5443 serves the updated access-page index and bundle;
the anonymous user-directory API returns 401. The running backend is managed
by Visual Studio and was not stopped or detached from its debugger. It must be
restarted to load the API change permitting unfiltered listing; authenticated
browser listing and real permission writes after that restart remain
unverified. No database migration or live permission mutation was used to test
this UI change.

## Further improvements and boundaries

Future options include periodic access reviews, expiry-limited grants,
two-person approval for high-risk actions, suppression of identifying small
statistical cohorts and distributed coordination. They are not implicit
features of this redesign.

Arbitrary per-event ownership, generic policy editors, website group/bundle
editing, mandatory MFA for ordinary admin login, external policy engines and
marketing delivery are outside this scope. Keep the explicit task catalogue
small enough for operators to understand; add permissions only for real
separation-of-duty requirements.

References: [Keycloak Server Administration](https://www.keycloak.org/docs/latest/server_admin/index.html)
and [Admin REST API](https://www.keycloak.org/docs-api/latest/rest-api/index.html).
Use documentation matching the installed provider release before provisioning.
