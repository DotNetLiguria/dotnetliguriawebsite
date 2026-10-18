# Production security and privacy hardening

## Scope and decisions

Harden all production frontend/backend code, content serving, container artifacts
and NGINX/Keycloak integration. DataMigration changes and real-data operations are
excluded. Preserve routes, historical assets and compatible JSON/BSON contracts
where possible. Never weaken authorization-code login with **PKCE S256**.

The website is a single instance behind NGINX with HTTPS on both connections.
Public hosts are `dotnetliguria.net` and `www.dotnetliguria.net`; identity is managed
by Keycloak. Audience validation is necessary but is not
administrative authorization or permission to call the identity administration API.

Ordinary account names/email belong in Keycloak only; MongoDB may contain validated
issuer/subject references. Consented public speaker/board names, biographies and
photos are an editorial exception. Their contact emails remain private and
administrator-only. Anonymous questionnaires must not acquire account identity;
authenticated questionnaires must derive identity from validated Keycloak tokens.

Require recent server-verified MFA for backup restore and destructive privacy
operations, not ordinary login. Retain only demonstrably anonymized application
data indefinitely. Removing an identifier, hashing email or labeling a record
"deleted user" does not itself establish anonymity.

Erasure configuration defaults unassessed/identifying fields to deletion.
Administrators may change overrides, but unsafe retention must block completion
and report retained fields. Remove the Keycloak profile, all identifying
application links and affected snapshots; retain unaffected backups. External
copies and data whose anonymity cannot be established remain explicit blockers.

Notifications require verified-email opt-in, administrator preview/confirmation
and unsubscribe. Prepare recipients transiently through a provider-neutral
boundary. No approved delivery provider exists; do not invent one, store email
lists in MongoDB or report messages as sent.

## Findings

Confidence reflects observed code behavior, not proof of production exploitation.
Production NGINX/Keycloak settings and real data have not been inspected.

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟠 HIGH | src\dotnetliguriaspa\public\OidcTrustedDomains.js | 6-18 | Lookalike destinations match token injection rules; exploitation requires a controlled-page request | 10/10 |
| 2 | 🟠 HIGH | src\dotnetliguriawebsite\DotNetLiguriaCore\Authorization\AdminClaimMatcher.cs | 17-39, 76-90 | Client-agnostic role matching and loose privilege claim values; impact depends on issuer mappings | 9/10 |
| 3 | 🟡 MEDIUM | src\dotnetliguriawebsite\DotNetLiguriaCore\Services\Questionnaires\QuestionnaireService.cs | 263-280 | Raw respondent PII/email deduplication keys persisted outside Keycloak | 10/10 |
| 4 | 🟡 MEDIUM | src\dotnetliguriawebsite\DotNetLiguriaCore\Endpoints\ApiEndpointMappings.cs | 383-387, 1191-1192 | Unverified submitted respondent identity; username/email author attribution | 10/10 |
| 5 | 🟡 MEDIUM | src\dotnetliguriawebsite\DotNetLiguriaCore\Program.cs | 100-140, 322-338 | No explicit trusted-forwarding boundary for IP limits/URL generation | 9/10 |
| 6 | 🟡 MEDIUM | src\dotnetliguriawebsite\DotNetLiguriaCore\Program.cs | 48-58, 100-142 | Wildcard CORS and missing application browser-security policies | 9/10 |
| 7 | 🟡 MEDIUM | src\dotnetliguriawebsite\DotNetLiguriaCore\Services\DatabaseBackupService.cs | 145-181, 213-235 | Plaintext snapshots lack account-erasure lifecycle; external encryption unknown | 9/10 |
| 8 | 🟡 MEDIUM | src\dotnetliguriawebsite\DotNetLiguriaCore\Endpoints\ApiEndpointMappings.cs | 883-997 | Extension-only upload validation; unpublished uploads in public static tree | 9/10 |
| 9 | ⚪ LOW | src\dotnetliguriaspa\src\components\QuestionnaireRunner\QuestionnaireRunner.tsx | 29-35, 72-74 | Indefinite browser answer drafts, including arbitrary free text | 10/10 |
| 10 | ⚪ LOW | src\dotnetliguriawebsite\CommonAuth\KeycloakServiceExtensions.cs | 57-61 | HTTPS metadata not required despite HTTPS defaults | 10/10 |

Line numbers describe the review baseline and will move during implementation.
Also review private-response caching, public workshop internal fields, observability
redaction, bounded inputs/outputs, uniqueness enforcement, backup protection,
legacy browser tokens, publish artifacts and supply-chain advisories.

Existing protections to retain: signed JWT issuer/audience/lifetime validation,
bearer-only role-specific mutation policies, DOMPurify, safe link handling,
JSON-LD escaping, CSV formula neutralization, upload path containment, fixed
outbound integration hosts, backup path/manifest checks and non-root containers.

## Implementation tracking

The table tracks repository implementation and local acceptance, not production
approval. `done` requires acceptance evidence. `blocked` is not completion.
Operational rollout remains blocked by the separate gates below. Do not commit/deploy,
rotate credentials or transform real data without separate authorization.

| ID | Task | Depends on | Status |
|---|---|---|---|
| H01 | Publish agreed plan and risk dispositions | None | done |
| H02 | Restrict token destinations; protect PKCE S256 | H01 | done |
| H03 | Validate identity settings, scoped roles and recent MFA | H01 | done |
| H04 | NGINX trust, hosts, CORS, browser policies and abuse limits | H01 | done |
| H05 | Public/private API projections and input contracts | H03 | done |
| H06 | Content-aware uploads and unpublished file access | H04, H05 | done |
| H07 | Account-reference-only authenticated questionnaires | H02, H03, H05 | done |
| H08 | Browser storage, sensitive caching and telemetry minimization | H02, H05, H07 | done |
| H09 | Fail-closed configurable anonymization/privacy workflow | H03, H07 | done |
| H10 | Erasure-aware protected backups and restore | H03, H09 | done |
| H11 | Cross-system Keycloak/application/snapshot erasure | H08, H09, H10, H12 | done |
| H12 | Consent, unsubscribe and transient recipient preparation | H03, H09 | done |
| H13 | Privacy/subscription/questionnaire frontend and notices | H07, H11, H12 | done |
| H14 | Secrets, publish artifacts and supply-chain checks | H01 | done |
| H15 | Existing-data transition and operational runbooks | H07, H10, H11, H12, H14 | done |
| H16 | Integrated verification and recorded evidence | H02-H15 | done |

### H02: OIDC browser boundary

Use supported OIDC worker configuration with anchored escaped exact origins/paths;
include both production hosts, exclude production localhost/beta/subdomain
wildcards. Test lookalike/userinfo/suffix/port/protocol rejection. Keep the worker
generated by `scripts\sync-oidc.mjs`, not manually patched. Remove the legacy
localStorage ACCESS_TOKEN fallback and clear legacy state. Add application-owned
code/S256, state/nonce/verifier and callback/renewal/logout regression tests.

### H03: Identity and privileges

Require HTTPS issuer/metadata and validated production settings. Match only
configured realm roles or roles under the permitted client ID; reject arbitrary
nested claims and loosely truthy values. Preserve signature, issuer, audience,
lifetime and bearer-policy checks. Verify fresh MFA on restore/destructive privacy
operations server-side using issuer-controlled assurance and authentication time.
Self-service deletion also requires subject ownership. Preserve cookie/callback
contracts and add antiforgery wherever cookie-authenticated mutations exist.

### H04: HTTP boundaries

Process forwarded headers only from explicitly configured NGINX addresses/networks,
before auth/redirects/rate limits. Validate hosts. Use same-origin production
requests or explicitly allowed CORS origins. Add CSP, nosniff, frame/referrer and
permissions policies compatible with callbacks, workers, styles and historical
downloads. Bound bodies, multipart size, collections, pagination and expensive
operations. Separate public questionnaire reads from submission limits.

### H05-H06: API and uploads

Return explicit public projections, excluding private email and internal
integration state/errors throughout nested payloads. Keep private editorial
contacts restricted. Use allowlisted writes and safe structured failures.
Validate file signatures, size and decompression risks; write atomically and
quarantine unsupported/unscanned types. New draft content must not be served
anonymously, even with a known URL. Preserve historical published assets.

### H07-H08: Questionnaires and minimization

Retain legacy BSON decoding but stop new unauthenticated identified submissions.
Add authenticated mode, explicitly authenticate bearer tokens on public routes,
derive issuer/subject server-side and deduplicate by account. Never attach account
identity to anonymous answers. Replace username/email attribution. Make uniqueness
index failures explicit. Wire designer/runner/results/exports together.

Use expiring/session drafts with discard/cleanup and safe blocked-storage behavior.
Purge legacy drafts/tokens on logout/account changes/erasure. Add private/no-store
to sensitive surfaces and redact token/identity/query/body data from logs/traces.

### H09-H11: Privacy and backups

Inventory nested/legacy identifiers, free text, timestamps, metadata, audit and
notification fields. Unknown schema/unsafe configured retention blocks completion.
Retain structured data only after indirect identification assessment; delete whole
records or retain disclosure-controlled aggregates when necessary.

Implement authenticated own-data export/status/erasure with confirmation, recent
MFA, idempotency and explicit partial failures. Keep protected temporary job
correlation only as long as needed; do not retain per-erased-user join keys.

Keep backups outside served/published roots with restrictive access and protected
storage. Coordinate snapshot/restore/erasure to prevent races and resurrection.
Delete or sanitize all affected regular/safety snapshots; remove snapshots whose
safety cannot be established. Reject unsafe restore activation.

Use a narrow injectable Keycloak administrative client with runtime credentials
and minimum permissions. Revoke subscriptions/sessions and orchestrate application
anonymization, snapshot cleanup and Keycloak deletion as an idempotent workflow.
Account for deletions initiated directly in Keycloak. Never reconnect a new account
to erased data by matching email. External copies remain operational gates.

### H12-H13: Notifications and UI

Keep purpose/version-specific opt-in evidence in Keycloak. Require verified email.
Store campaign metadata and opaque account references, resolving recipient identity
transiently immediately before preparation through a restricted provider boundary.
Preview counts/content, not the whole directory. Confirm broadcasts explicitly.
Unsubscribe tokens must be single-purpose, identity-safe and resistant to scanner
GET/replay surprises; eventual delivery must recheck consent. Missing provider must
not look like successful sending.

Add accessible Italian questionnaire login, account privacy, erasure status,
step-up, subscription/unsubscribe and campaign-preparation UI with truthful
pending/blocked/error states. Remove obsolete unimplemented profile collection.
Update privacy/cookie notices without inventing legal bases or guarantees.

### H14-H15: Release hygiene and transition

Keep production secrets in runtime configuration; exclude local keys, `.env`,
snapshots and sensitive configuration from publish artifacts. Add rejection
fixtures and appropriate secret/dependency/artifact checks. Do not rotate live
credentials or rewrite history without approval.

Prepare a read-only legacy inventory and dry-run transition outside DataMigration
changes. Real data writes require separate approval. Do not link accounts by
unverified email or create users automatically. Document exact Keycloak audience,
role, S256, callback, assurance, consent and service-account settings, NGINX trust,
external-copy erasure and notification-provider approval.

### H16: Acceptance

Use focused isolated xUnit v3/Vitest tests with fake clocks, stores, filesystem and
Keycloak/provider HTTP. Run the root solution build, `scripts\verify.ps1` and
`scripts\verify-publish.ps1`, preserving discovery/timing gates. After frontend
changes run typecheck/lint/tests/build, publish the website by project path and
overlay dist into Aspire-served wwwroot without deleting historical assets.
Verify the actual updated SPA/API at `https://localhost:5443`.

Record executed commands, counts, timings, failures and gaps. Linux/Windows CI and
opt-in synthetic staging smoke checks are separate. Never claim unexecuted
platform/production checks passed.

## Evidence and release gates

### Implemented controls and acceptance

| Tasks | Implementation and isolated regression evidence |
|---|---|
| H01-H02 | Approved plan published here. Supported OIDC worker rules constrain exact API/realm destinations, reject lookalikes and separate localhost. Tests exercise an actual library authorization request with fresh verifier, state/nonce and SHA-256/base64url S256, including an attempted plain override. Legacy Axios localStorage token precedence is removed. |
| H03 | HTTPS authority/metadata and runtime confidential-client settings required. Exact issuer/client-scoped roles and privilege values; signed token issuer/audience/lifetime tests. Restore/destructive privacy require fresh server-verified MFA. Bearer validation checks live Keycloak account existence/enabled state under the privacy gate, so disabling/deleting an account revokes unexpired JWT access. Dependency failures return JSON 503, not permissive authentication; ordinary challenges return JSON 401. |
| H04-H05 | Explicit proxy/host/CORS policies, production CSP and other security headers, sensitive no-store, JSON/multipart and rate limits. Public workshop projections omit nested/internal/contact data. Editor validation covers field sizes, URL schemes/credentials, nested cardinalities and malformed structures. Workshop editor allowlist preserves server-owned identity, creation/storage and integration state. Safe errors expose correlation IDs, not exception text. Bounded reads and pagination are described below. |
| H06 | New assets stored privately with generated names, atomic writes, signature/size/image-dimension checks and publication-aware downloads. Unsupported office formats are rejected. Draft assets return 404 anonymously. Tests cover content/path constraints. Signature checks are not antivirus or proof against arbitrary polyglots; untrusted non-images are attachments with nosniff. |
| H07-H08 | Anonymous versus authenticated questionnaire flows; server-derived issuer/subject and account-based uniqueness; no new raw respondent identity. Legacy enum decoding retained without spoofable identity fallback. Index failures fail closed. Drafts are owner-bound sessionStorage with 30-minute inactivity expiry and discard/logout/account-switch cleanup. Diagnostics, sensitive telemetry and cache behavior are minimized and tested. |
| H09-H11 | Protected temporary erasure journal, schema/retention preflight and shared operation gate. Unknown schema/unsafe overrides block completion. Linked responses and authored questionnaires plus their responses are deleted; no automatic free-text anonymizer or claimed safe aggregates. Retryable Keycloak disable/logout, application deletion, owned-snapshot purge and verified Keycloak removal; successful jobs leave no per-user tombstone. Synthetic store/HTTP/filesystem tests cover policy, failures, retry and restore/erasure coordination. |
| H12-H13 | Verified-email consent is server-controlled in Keycloak, with purpose/version evidence, transient recipient preparation, count-only campaign previews and explicit confirmation. Pending erasure does not prevent consent withdrawal. Purpose-bound expiring unsubscribe GET confirmation/one-click POST. Missing provider truthfully returns unavailable, never sent. Italian profile/privacy/admin UI, notices and error/confirmation tests are integrated. |
| H14 | Sanitized runtime configuration, publish exclusions (including development/local appsettings) and artifact checks; synthetic safe-artifact acceptance and forbidden configuration rejection fixtures exercised. CI advisory check added. Runtime npm and direct/transitive NuGet audits reported no known vulnerabilities from configured advisory services. No dependency upgrade, credential rotation or history rewrite performed. |
| H15 | `docs\security-operations.md` documents NGINX/Keycloak configuration and separately approved legacy inventory/transition. `docs\privacy-backend.md` documents privacy contracts, failure states, configuration and release gates. Synthetic legacy/unknown-field fixtures exercise fail-closed handling. No real-data transition has run. |

### Bounded reads and compatibility

- Existing unpaged JSON array contracts are retained up to **1,000 records and
  16 MiB of serialized BSON per database read**. Overflow returns an explicit
  HTTP 413; data is never silently truncated. Mongo find batches are 16 records
  and have a 10-second server execution limit.
- Workshop lists/year lists and administrator questionnaire lists, by-workshop
  definitions and responses accept `offset` (0-100000) and `limit` (1-200).
  `X-Page-Offset`, `X-Page-Limit` and, when applicable, `X-Next-Offset` describe
  continuation; the body remains an array. These headers are exposed to the
  approved development CORS origin. Ordering includes an immutable ID tie-breaker.
- Existing frontend calls remain unpaged. Collections exceeding the legacy read
  budget require an explicitly paged API client; the current UI does not silently
  display the first page as a complete collection.
- Statistics and CSV remain full-dataset operations within the same read budget.
  Larger datasets return 413, not sampled/incomplete statistics or CSV. A streaming
  large-dataset reporting UI is not implemented.
- Questionnaire list counts are restricted to the selected questionnaires.
  Workshop list enrichment batches file lookup and reuses speaker lookup rather
  than issuing a full speaker/file query per workshop.
- Input limits intentionally reject previously accepted oversized or unsafe editor
  values. Existing stored/historical assets are not rewritten. New definitions are
  limited to 30 sections, 200 questions, 100 options and 50 matrix rows per question.
- Backup erasure conservatively purges **all application-owned snapshots** because
  the application cannot prove an old snapshot is unaffected; it does not claim
  to retain unaffected copies without reliable attribution. A nonpersonal epoch
  rejects pre-erasure restores. This is an intentional safety trade-off.

### Executed local checks

The final local shared gate used the session-local, official SHA256-verified
Node **24.21.0**, without changing machine-wide tooling:

| Command/check | Result |
|---|---|
| `pwsh -File scripts\verify.ps1 -NoFrontendChecks` | Root Release solution build; repository 26/26 in 6.28s, backend 255/255 in 6.81s, frontend 453/453 in 91.54s; no skips. The switch skips only frontend install/typecheck/lint/build, not its tests. |
| `node --run typecheck`, `node --run lint`, `node --run build` in the SPA | Passed. Lint has zero errors and four existing warnings; Vite reports the existing large-bundle warning. |
| Focused xUnit runs | Input bounds, URL rejection, server-field preservation, collection continuation/overflow, questionnaire behavior, authentication, privacy and route policies passed before the shared gate. |
| `pwsh -File scripts\verify-publish.ps1` | Final publish passed after all code changes: 35 SPA files match, historical assets unchanged and confidential-artifact gate passed. Development/local appsettings are excluded; a synthetic development-config rejection and safe-directory acceptance fixture passed and was removed. |
| `pwsh -File scripts\verify-security.ps1` | Reported zero known vulnerable runtime npm/NuGet dependencies; this is an advisory result, not proof of absence of vulnerabilities. |
| Production-mode published host at `https://localhost:5443` | Normal TLS validation; SPA index exactly matches rebuilt dist, current JS is served, CSP/nosniff present, protected privacy/backup APIs return JSON 401/no-store, unknown API returns JSON 404, WeatherForecast returns its five JSON records and hostile Host returns 400. Invalid pagination returns safe JSON 400 before a database read. |
| Body and unsubscribe HTTPS boundaries | Known-length and valid chunked oversized JSON return 413. Unsubscribe GET is a no-store HTML confirmation without mutation; oversized known-length form is rejected with 400 before parsing, oversized chunked form with 413. Initial smoke assertions expected 413 for malformed JSON/known-length form; corrected assertions verify their intentional 400 behavior rather than treating it as a bypass. |
| Final hygiene | `git diff --check` passed after normalizing generated HTML line endings. Temporary artifact fixture removed and both isolated smoke hosts stopped. No unrelated service was stopped. |

### Production release remains blocked

1. Configure runtime backend/identity-admin secrets and minimum Keycloak
   permissions; validate live audience/role mappings, required S256 callbacks,
   verified email, protected consent attributes and fresh MFA `acr`/`auth_time`.
   Authenticated APIs now depend on live identity-admin account verification.
2. Supply exact trusted proxy addresses and enforce HTTPS upstream/network
   isolation. Apply and test the NGINX template; production was not probed.
3. Provide encrypted/restricted backup and privacy storage plus protected,
   persistent Data Protection keys. Approval flags default false. The application
   does not implement snapshot encryption/authenticated integrity itself.
4. Inventory and separately authorize legacy MongoDB/free-text/editorial data and
   every old snapshot, safety copy, downloaded export, log and external storage
   copy. Legacy PII has not been migrated. Externally initiated Keycloak deletion
   requires authenticated reconciliation; automatic event ingestion is not implemented.
5. Controller/legal sign-off must define purposes, retention, contact/provider
   information and disclosure risk. Notices deliberately flag missing decisions.
   No software guarantees anonymity of arbitrary free text or public image metadata.
6. Approve a delivery provider and test consent again at dispatch, one-click
   unsubscribe and external recipient handling. Real email delivery is unavailable.
7. Run opt-in synthetic staging browser/Keycloak/database erasure/restore tests and
   the Linux/Windows CI matrix. Local execution was on Windows; a loopback HTTPS
   smoke is not proof of a real proxy, browser SSO, database or production rollout.

No commits, deployment, production probes, machine-wide tooling changes,
real-database/schema writes, real erasure/restore or credential rotation were
performed.
