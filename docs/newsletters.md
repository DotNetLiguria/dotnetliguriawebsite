# Newsletter administration

The admin newsletter workflow prepares event announcements and generic Markdown
newsletters. Production submission sends **one email to one configured distribution
address**. The SMTP appliance, not the website, selects subscribers and forwards
that message. SMTP acceptance is not proof of delivery to subscribers.

## Access and editorial workflow

Assign `newsletters.read` to readers, add `newsletters.manage` for editors, and
add `newsletters.send` for trusted senders. Editing templates uses the same editor
permission. Manage and send never imply read or one another. Configure explicit
token role scopes using the existing approved provisioning procedure; do not turn
Full Scope Allowed on or change the live Identity Provider without approval.

The newsletter and template editors are separate admin sections:

- `/admin/newsletters`: drafts, archived items and submission history.
- `/admin/newsletter-templates`: reusable event/generic templates.

Create a draft, set its internal title and subject, then write Markdown or generate
it from a selected template. Event newsletters offer published ongoing and future
events. Event data is projected to JSON and merged on the server; private event
and integration fields are not included. Regeneration replaces the draft text
only after an explicit warning. Template and event edits never silently rewrite
an existing newsletter.

Save before preparing a preview. Upload PNG/JPEG images using the newsletter
editor, then insert the generated Markdown references. Arbitrary remote images,
HTML, SVG, and file paths are not supported. The server supplies the logo at the
top of every email. Templates cannot remove it.

Preview the prepared revision, then send a test. The test destination starts with
the configured default but can be changed to another **single** mailbox. It must
not be the production distribution address or a known distribution alias.
The website cannot discover hidden forwarding rules: operators must ensure test
mailboxes cannot forward to subscribers. Test sending is a privileged operation.

Inspect the received test in an email client. A successful SMTP test submission
does not establish visual correctness. Explicitly acknowledge visual approval,
then review the final production confirmation naming the subject and distribution
address. Changes to content, subject, images, email layout, sender or delivery
configuration require a fresh matching test/approval.

Production-accepted newsletters cannot be edited and resent. Clone one to create
a new draft without its approval or send state. Archiving preserves history.
The `.eml` download is test-addressed and does not count as a successful test.

## Templates and embedded images

Opening the template list lazily seeds the server-shipped event and generic
templates; subsequent edits are persisted with versions in MongoDB. Startup does
not require newsletter database writes or overwrite edited templates.
The template editor lists the supported fixed placeholders. Unknown
or malformed placeholders fail validation rather than appearing in a sent email.
Template values are not executable code and are never recursively expanded.

The email contains a plain-text alternative and email-safe HTML. All delivered
images use MIME Content-ID references with inline attachments; there are no
remote image loads, external stylesheets, tracking pixels or web fonts. Ordinary
event/map hyperlinks remain clickable. The appliance must preserve the MIME
structure and Content-ID parts when forwarding.

Image input, decoded pixels, stored bytes and the final encoded MIME message are
bounded. Transfer encoding increases size, so configure the final message limit
below the appliance's actual limit. Browser preview is not an email-client
compatibility certification; inspect real test messages.

## Production activation

Production is disabled by default. Enabling drafting/test sending does not enable
distribution. Keep SMTP credentials in runtime secret configuration, never in
client `VITE_` variables, source control, screenshots or logs.

Server options are bound from the `Newsletters` section. Relevant runtime keys:

| Keys | Purpose |
| --- | --- |
| `DefaultTestAddress`, `DistributionAddress`, `DistributionAliases` | Prefill, fixed production recipient, and prohibited test-routing aliases. |
| `TestEnabled`, `ProductionEnabled` | Independent test and production switches; leave production disabled until the readiness review is complete. |
| `ActivationGeneration`, `OperationalFolder` | Approved activation identity and protected, non-restored suspension storage. Use a new generation after restore reconciliation. |
| `PublicBaseUrl` | Approved HTTPS base for public event links. |
| `SenderAddress`, `SenderName`, `ReplyToAddress` | Approved sender identity and optional reply address. |
| `SmtpHost`, `SmtpPort`, `SmtpUseStartTls` | SMTP endpoint and TLS mode. |
| `SmtpUserName`, `SmtpPassword` | Runtime-only authentication secrets. |
| `SmtpTimeoutSeconds` | Bounded handoff timeout. |
| `MaxImageBytes`, `MaxImages`, `MaxMimeBytes` | Upload/count/final encoded-message bounds. |

Use the environment-variable form `Newsletters__DefaultTestAddress`, for example,
or the deployment secret/configuration provider. Do not publish private operational
storage under `wwwroot` or include it inside database snapshots.

Before enabling production, the operator and appliance owner must verify:

1. The approved TLS SMTP endpoint, sender identity, distribution address, routing
   aliases, distinct test default and encoded-message limit.
2. Successful forwarding of a test through a non-production distribution route,
   including CID images and plain-text/HTML alternatives in real email clients.
3. Eligible audience handling for **both** event announcements and generic
   newsletters. An account or event-related audience is not automatically an
   approved audience for unrelated communications.
4. Consent/opt-out handling, footer identity, unsubscribe behavior and any
   appliance-managed list headers. The website does not fabricate per-subscriber
   unsubscribe tokens or manage the appliance's mailing list.
5. Provider approval and reviewed public privacy wording. The current public
   policy must not claim sending is unavailable once production is activated.
   This feature does not itself approve a provider or establish a lawful basis.
6. Durable protected operational storage and a fresh activation generation, with
   backup/restore suspension and SMTP-log reconciliation exercised.

Do not send to the real subscriber distribution address merely to perform a
smoke check. That action requires separate explicit approval.

## SMTP outcomes, duplicate protection and reconciliation

The application persists the prepared content and send intent before SMTP
handoff. Confirmation is short-lived and bound to the operator, revision,
snapshot and destination. A durable production claim prevents double clicks,
parallel submissions and replayed confirmations from producing duplicate sends.

SMTP does not offer a general exactly-once guarantee. A lost final response or
process crash can leave acceptance uncertain. Such attempts are not automatically
retried. Check the appliance logs using the recorded Message-ID and attempt time,
then explicitly reconcile the attempt as accepted or definitely not submitted,
with a reason. Only confirmed non-submission may allow a new approval/send
workflow. Never clear a claim merely because the browser reported an error.
For uncertain outcomes, reconciliation remains unavailable until the configured
SMTP timeout plus a two-minute safety margin has elapsed, so it cannot race a
live submission. If the attempt outcome was durably recorded but its newsletter
status update failed, recovery permits only that already-recorded outcome.
Uncertain test attempts can also be reconciled; doing so does not count as a
new successful test or authorize production.

A failed QUIT after SMTP acceptance does not make the email rejected. A successful
test or production status reports acceptance by the appliance, not the inboxes
of individual subscribers. Subscriber counts and bounce/delivery analytics are
not available in this phase.

## Persistence, privacy and restoration

Templates/revisions, drafts, bounded image documents, prepared snapshots and
submission attempts are private MongoDB data included in database snapshots.
Do not expose collections, previews or image documents as public static files.
Author references and edited test mailboxes are personal data; keep operational
exports restricted and apply the account export/erasure process. Newsletter text
is author-controlled and must not be assumed anonymous.

Restoring a snapshot must never resume an old submission or make a previously sent
newsletter eligible merely because the snapshot predates its send. Restore
suspends production through an operational marker outside database snapshots.
In-flight/uncertain attempts must be reconciled before a restore can destroy their
evidence. After restore, compare appliance logs with restored history, then use a
new approved activation generation; reusing an invalidated generation is unsafe.
Do not remove the suspension marker to work around the gate.
The operational folder must be an absolute private path outside the website
content tree and must survive redeployments and database restoration. All
instances must share that protected suspension storage. Backup/restore and
account-erasure gates are process-local: deployments with multiple website
processes require an operator-enforced maintenance window that stops other
writers before these operations.

Account erasure must preserve anonymous production duplicate-protection evidence
while removing attributable newsletter content and mailbox data. External copies
already received by the appliance or test clients require the existing approved
external-copies procedure; deleting a website record cannot retract an email.

No automatic age-based deletion of drafts, prepared snapshots, inline images or
attempt evidence is enabled. Retain only as long as operationally necessary under
an approved policy; until automated retention is separately implemented, review
private data and account-erasure requests through the existing restricted tools.
Never delete an image still required by a retained draft or prepared message.

## Verification

Use the root solution, existing xUnit.net v3 projects and frontend Vitest suites.
Unit tests fake storage, time, authentication and SMTP; they must not contact a
database, Identity Provider, browser or mail server.

Run `scripts\verify.ps1` for the shared gate and
`scripts\verify-publish.ps1` for website/migration publish artifacts. The latter
never runs DataMigration. After frontend changes, rebuild and publish, overlay
the SPA into the local backend's `wwwroot` without deleting historical assets,
and verify the frontend and APIs at `https://localhost:5443`, not only Vite.
Keep real SMTP/client and database/browser checks separate and explicitly approved.

Direct subscriber management, scheduling, analytics and per-recipient delivery
are deliberately deferred to a separate design.
