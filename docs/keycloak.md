# Keycloak authorization setup runbook

Use this procedure for the **currently implemented, client-role-backed**
authorization design. The application reads one multivalued `permissions` claim;
52 Keycloak client roles supply its values. The alternative of backing that
claim with protected user attributes was discussed but **not implemented**.
Changing only the mapper to attributes will not work: live checks still read
client-role assignments.

The architecture, permission meanings, delegation restrictions and rollout
limitations are in [authorization.md](authorization.md).

## Recommended: provision the existing realm with the setup tool

Use this instead of repeating the manual steps below. Requirements on the
operator machine: PowerShell 7.4+ (`pwsh`); .NET SDK for the optional local
user-secret installation. No new packages are required.

The tool configures the **existing** DotNetLiguriaCore and DotNetLiguriaSpa
clients. It does not recreate their login URLs or change their secrets. It
adopts existing permission roles, scopes and mappers; creates missing ones;
creates a separate runtime permission client; and can restore one deliberately
trusted human account to full application access.

### The one-time manual Keycloak bootstrap

You still need a working Keycloak Admin Console account. In the
**DotNetLiguria** realm:

1. Create an OpenID Connect client named **dotnetliguria-provisioner**.
2. Enable **Client authentication** and **Service accounts roles**. Disable
   Standard flow, Implicit flow, Direct access grants and other unused login
   flows. Authorization Services is not required.
3. In **Service accounts roles -> Assign role**, filter client roles by
   **realm-management** and assign this conventional provisioning set:

```text
manage-clients
view-clients
query-clients
manage-users
view-users
query-users
query-groups
```

4. Under **Client scopes -> dotnetliguria-provisioner-dedicated -> Scope**,
   keep **Full Scope Allowed OFF**, explicitly assign the same provider role
   set as scope mappings, and save. Keep the standard **roles** default client
   scope attached so the administration-role claims/audience are emitted.
5. Open **Credentials**. You will enter this client's own secret in a hidden
   local prompt, or store it in the separate provisioning secret store below.
6. Open **Users -> your human website account** and obtain its immutable user
   UUID from the console URL or approved admin tooling. Do not use an email,
   username or service-account UUID.

These provisioning powers are broad: manage-clients controls clients/scopes/
mappers and manage-users controls users/groups/assignments. They are not
website runtime privileges, and are not claimed to be a verified least-privilege
set for every Keycloak release. Provider fine-grained administration may
restrict them further; a failed preview reports the rejected operation's HTTP
status without printing provider bodies. Do not grant realm-admin as a
workaround. The tool never assigns these provisioning powers to the website.

**Do not reuse dotnetliguria-privacy-admin.** Leave that existing client and its
credentials unchanged. The tool creates/adopts
**dotnetliguria-permission-admin** for the new runtime permission checks.
Keep the provisioning credential outside the website and deployment artifacts.

### Preview, apply, verify

Run from the repository root. Replace `<your-user-uuid>` with the human user's
UUID from the previous section. The commands prompt for the provisioning
secret without displaying it:

```powershell
# Read-only inspection: no realm configuration mutations.
pwsh -File scripts\configure-keycloak.ps1 -Mode Preview `
  -RecoveryUserId <your-user-uuid> -GrantRecoveryAccess

# Apply the displayed type of changes to this exact realm.
pwsh -File scripts\configure-keycloak.ps1 -Mode Apply `
  -ConfirmRealm DotNetLiguria -RecoveryUserId <your-user-uuid> -GrantRecoveryAccess

# Read-only reconciliation and actual runtime service-account authentication.
pwsh -File scripts\configure-keycloak.ps1 -Mode Verify `
  -RecoveryUserId <your-user-uuid> -GrantRecoveryAccess

# Optional: install the verified runtime configuration in WEBSITE user secrets.
# This changes local settings, not realm configuration. No secret is printed.
pwsh -File scripts\configure-keycloak.ps1 -Mode InstallLocalSecrets `
  -RecoveryUserId <your-user-uuid> -GrantRecoveryAccess
```

`-GrantRecoveryAccess` is an explicit choice to give the named human account
all 52 application permissions through the protected
**Application recovery operators** group. It does not give that user Keycloak
realm administration rights. The flag also checks these grants during Verify
and InstallLocalSecrets. Without it, the tool does not manage human permission
assignments or membership. Every member of that group would inherit its
permissions, so the tool refuses recovery-grant mode if it finds another user
already in the group. Use a separate group name with `-RecoveryGroupName` when
appropriate; existing operator groups are not silently elevated.

The defaults target `https://hello.vevy.com/realms/DotNetLiguria`. Other trusted
realm URLs can be supplied with `-Issuer`; only canonical HTTPS DNS issuers on
port 443 with `/realms/{realm}` paths are accepted. Client IDs can be selected
with `-ProvisioningClientId` and `-RuntimeClientId`. This is not a full-realm
importer or a general Keycloak administration proxy.

### Repair an over-broad application permission scope

Preview normally stops if `dotnetliguria-permissions` contains realm roles or
roles belonging to another client. To review a narrowly scoped repair, add
`-RepairPermissionScope` to Preview, then to Apply after reviewing the plan.
This removes only those role-scope eligibility mappings from that application
scope. It does **not** delete role definitions, remove user/group assignments,
or change the provisioning, runtime or privacy clients' own scope mappings.
Unknown DotNetLiguriaCore roles still stop preflight for manual review.

Do not attach provider administration roles such as `realm-admin` to the
application permission scope. Service-account role assignments and eligibility
belong to their separate service clients. Full Scope Allowed remains OFF.

The repair also removes `account` client eligibility from this scope. The
personal page needs that eligibility, so the tool always adds a separate
dedicated SPA scope mapping to exactly the `account` client's `view-profile`
and `manage-account` roles (Preview stops if other `account` roles are scoped).
With these roles, the standard `roles` scope adds `aud=account`, so the
Identity Provider Account API accepts the user's token. Users receive the
roles from `default-roles-<realm>`; the tool never assigns them. Without this
mapping the personal page shows "Accedi di nuovo al tuo account" and
`/api/privacy/profile` returns 401 `profile_session_expired`.

### Remove obsolete dedicated SPA mappers

Add `-RemoveLegacySpaMappers` to Preview, review the plan, then use the same
flag with Apply/Verify. It removes only the dedicated SPA mapper named
`realm roles` with type `oidc-usermodel-realm-role-mapper` and claim `roles`,
and the dedicated `audience` mapper when it targets only DotNetLiguriaCore
access tokens (not ID tokens or UserInfo, and with no custom audience).
The canonical permission scope supplies the replacement API audience.
MFA, profile and unrelated/custom mappers are preserved.

This cleanup was applied to the live realm on 2026-10-19. Reconciliation found
no pending changes, and post-cleanup provider evaluation retained exactly the
52 recovery permissions and API audience without the old flattened `roles`
claim. The operator confirmed dashboard entry before this cleanup; a renewed
browser token after cleanup has not been independently observed.

### Allow an unattended local run without sharing secrets

For an approved operator/assistant to run the tool without an interactive
prompt, store **only the provisioning secret** using your local secret editor
or this hidden-input PowerShell session:

```powershell
$secret = Read-Host 'Provisioning client secret' -AsSecureString
$credential = [pscredential]::new('unused', $secret)
@{
  'KeycloakProvisioning:ClientSecret' = $credential.GetNetworkCredential().Password
} | ConvertTo-Json -Compress | dotnet user-secrets set --id dotnetliguria-provisioning
$credential = $null
$secret = $null
```

Add **`-UseStoredProvisioningSecret`** to each command. This reads the separate
`dotnetliguria-provisioning` store, not the website or AppHost store. Do not
paste a credential into chat, a command-line argument, a transcript or a file
in the repository. .NET user secrets are local development storage, not an
encrypted production vault; protect the operator account and use the approved
secret manager for deployment automation.

After the provisioning session, disable the provisioning client when not
needed and remove the local bootstrap secret:

```powershell
dotnet user-secrets remove 'KeycloakProvisioning:ClientSecret' --id dotnetliguria-provisioning
```

Re-enable the client only for an approved later configuration run.

### What the tool changes and preserves

| Surface | Behavior |
| --- | --- |
| Existing SPA/API clients | Full scope OFF; first-party OAuth consent OFF; preserves callback URLs, origins, other attributes and secrets |
| API permissions | Creates missing exact leaf roles; rejects composites or incompatible ownership |
| Permission scope | Exact approved API role eligibility; default SPA attachment; removes optional attachment when promoting to default; explicit RepairPermissionScope also removes foreign/realm role eligibility from this scope only |
| Mappers | Restricted client-role permission mapper and explicit API audience; rejects conflicting claim sources |
| Legacy SPA mappers | Only with RemoveLegacySpaMappers: deletes the exact old flattened-role mapper and redundant access-token-only API audience mapper described above |
| Consent display | Internal permission scope hidden from consent |
| Runtime permission client | Confidential service-account client with full scope OFF; conventional five-role provider assignments AND explicit role scopes |
| Recovery account | Only with explicit flag: full application-role group assignment and human membership |
| Website local secrets | Only in InstallLocalSecrets mode: installs real runtime credentials and protected group UUID without printing them; preserves unrelated values and existing protected UUIDs |
| Privacy/provisioning accounts | Never edited; privacy settings/roles/secrets are not replaced |
| Other users, roles, groups, scopes | Object definitions never deleted; unexpected/conflicting grants stop preflight except for the explicit, application-scope-only repair above |

Runtime provider roles are `view-users`, `query-users`, `view-clients`,
`query-clients` and `manage-users`. As with the manual procedure, manage-users
can confer broader provider privileges than the website's allowlisted
delegation API. This conventional setup is explicit, not a claim that the
credential is narrowly constrained. Fine-grained provider restrictions remain
version-specific and must be assessed for the deployment.

All planned reads finish before the first mutation. Apply requires the exact
realm confirmation. The tool stops on failure, never automatically retries a
mutation or rotates a secret, and does not promise a transaction/rollback
across provider calls. If interrupted, rerun Preview: completed objects are
adopted. Do not run concurrent configuration writers.

Verify checks persisted configuration, client-credentials authentication and
current role inspection using the **runtime** credential. It does not prove
interactive SPA token issuance, MFA, browser UX, permission writes/audit storage
or production deployment. After local installation, restart the backend,
sign out/in and check `/api/account/capabilities` and `/admin/access`
("Accessi utenti"). Recovery users are protected: change their own permissions
out of band, not through the dashboard.

Offline reconciliation tests run with:

```powershell
pwsh -File scripts\test-keycloak-setup.ps1
```

The shared verification script also runs them. They use a fake provider and
perform no HTTP calls or real account changes.

### Retire legacy application roles after confirming recovery

Legacy role candidates from former application configuration and the
operator's realm inspection:

```text
dnl-webdevadmin
feedbackadmin
backupadmin
privacyadmin
notificationadmin
dnl-standardsubscriber
dnl-webcontentadmin
```

The last two names were reported by the operator and are not referenced in the
current repository. Ordinary authenticated members do not need a subscriber
role; content operators use explicit task permissions. Do not translate either
role into all application permissions.
The operator subsequently confirmed deleting these last two roles. A read-only
recheck found no legacy references in inspected application/shared scope
mappings or mapper claim names, but realm-role inventory remains HTTP 403;
their absence could not be independently checked with this credential.

They grant nothing in the new application. They are retirement candidates,
not a list of roles verified to exist in every realm. Check both **Realm roles**
and **Clients -> DotNetLiguriaCore -> Roles**: the old implementation accepted
roles from either namespace. Do not remove similarly named roles by pattern.

1. Restart the backend after installing runtime settings, sign out/in, and
   confirm dashboard entry, `/api/account/capabilities` and **Accessi utenti**
   with the protected recovery account. Verify the new permissions claim and
   intended specialist assignments before deleting legacy grants.
2. Inspect each candidate's user/group assignments, composite membership and
   use by other clients/mappers. Record only the required rollback information
   in approved protected storage. Deleting a role removes its existing
   mappings; recreating the name alone does not restore assignments.
3. Migrate affected users/groups to reviewed task bundles. There is no automatic
   translation from a legacy administrator role to all 52 new permissions.
4. Using an authorized realm operator, remove obsolete mapper/scope/composite
   references and delete only confirmed application-exclusive legacy roles.
   Preserve provider defaults, `realm-management`, `account`, `broker`, privacy
   service-account administration roles and all new application permissions.
5. Renew/revoke affected sessions as appropriate and repeat allowed/denied
   checks. Already-issued tokens are not rewritten by deleting a role.

The setup tool intentionally does not delete realm-role definitions. Its
documented provisioning credential cannot list realm roles on the current
deployment (HTTP 403), so existence and dependencies remain unverified.
The operator has now confirmed dashboard access. None of the five names exists
in the API-client namespace, and no matching realm-role scope references were
found in inspected client scopes or the SPA/API dedicated scope mappings.
The remaining realm-role check still requires an authorized realm operator.
Never add `realm-admin` as a workaround. If an operator explicitly chooses
automated realm-role cleanup, a temporary `manage-realm` grant and matching
provisioner role-scope eligibility may be required; this is broad realm
configuration power, not part of the normal bootstrap. Obtain explicit
approval, keep full scope OFF, remove both temporary mappings afterward and
verify using a newly issued service token. No such privilege expansion or
realm-role deletion has been performed.

## Manual procedure (reference and troubleshooting)

The following sections explain the configuration the tool manages. Do not
repeat already completed work; use Preview to inspect your current realm first.

## Resume safely

You can resume halfway through: inspect each numbered section and perform only
missing configuration. Do not recreate existing clients, scopes or mappers.
This runbook must not be treated as evidence of the current realm configuration.
An approved operator run can apply the configuration to a live realm; rerun
Preview/Verify to establish its current state.

- Select the **DotNetLiguria realm**, not `master`.
- Record your installed Keycloak version; console labels vary by version.
- Preserve the existing working login, callback URLs, PKCE, UserInfo, privacy
  service-account configuration and MFA flows.
- Record existing configuration before changing it, using approved protected
  storage. Realm exports can contain sensitive information.
- Never paste real access tokens into external JWT decoder websites.
- Do not import `keycloak/dev/realm-dotnetliguria.json` over a live realm.
  It is a development fixture, not a production provisioning/migration script.

## 1. Create the application permission roles

Open **Clients -> DotNetLiguriaCore -> Roles**. Create the following exact
case-sensitive client roles. Keep them non-composite leaf roles. Do not create
them under realm roles or under DotNetLiguriaSpa.

```text
events.read
events.manage
events.publish
events.delete
events.homepage.manage
events.past.manage
event-assets.read
event-assets.manage
event-assets.delete
eventbrite.read
eventbrite.manage
eventbrite.publish
speakers.read
speakers.manage
speakers.delete
speakers.merge
venues.read
venues.manage
venues.delete
board.read
board.manage
board.delete
site-menu.read
site-menu.manage
site-menu.delete
questionnaires.read
questionnaires.manage
questionnaires.publish
questionnaires.delete
questionnaire-results.read
questionnaire-responses.read
questionnaire-responses.export
questionnaire-responses.delete
backups.read
backups.create
backups.restore
maintenance.counters.read
maintenance.counters.manage
maintenance.speaker-references.repair
maintenance.diagnostics.manage
privacy.operations.read
privacy.operations.manage
privacy.identities.read
privacy.notifications.retry
privacy.retention.read
privacy.retention.manage
notifications.preview
notifications.confirm
access.users.read
access.permissions.grant
access.permissions.revoke
access.audit.read
```

Creating roles does not assign them. There is no wildcard or administrator
bypass; `manage` does not imply read, publish, export or delete.

## 2. Keep Full Scope Allowed OFF

For each relevant client, open **Clients -> client -> Client scopes ->
client-dedicated -> Scope** and set **Full Scope Allowed = OFF**. On older
versions this setting may be directly under the client's Scope tab.
Click **Save** if shown and reload to verify persistence.

Apply this to:

- `DotNetLiguriaSpa`.
- `DotNetLiguriaCore`.
- The permission-directory service client created in step 5.
- Existing privacy/identity administration service clients.

Before disabling full scope on an existing service client, explicitly scope
its approved provider administration roles so existing functionality is not
accidentally broken. Do not expand the privacy service account for permission
administration.

**Full Scope Allowed** and **Include in token scope** are different settings.
Missing roles or scope mappings should not automatically turn full scope on.
See troubleshooting below if the setting reverts.

## 3. Create and attach the application permission client scope

### Create or inspect the scope

Open **Client scopes -> Create client scope**:

| Setting | Value |
| --- | --- |
| Name | `dotnetliguria-permissions` |
| Protocol | OpenID Connect |
| Display on consent screen | OFF; this is internal authorization metadata, not a user-requested privilege |
| Include in token scope | ON is acceptable; this does not grant permissions |

Save. Do not make this a realm-wide default for unrelated clients; attach it
explicitly to the SPA as described below.

If Keycloak shows "Grant Access" with `dotnetliguria-permissions` during login,
open **Client scopes -> dotnetliguria-permissions -> Settings**, set
**Display on consent screen = OFF**, and save. Do not remove the scope, its
mappers or its role-scope mappings. User consent does not assign application
permissions; administrators control those assignments.

For a first-party website that should not show an OAuth consent page at all,
also inspect **Clients -> the actual requesting login client -> Settings ->
Login settings -> Consent required**. Set **Consent required = OFF** if that
matches the site's consent policy. Check DotNetLiguriaSpa for SPA logins and
DotNetLiguriaCore for backend interactive logins; use the request's `client_id`
to identify the actual client rather than relying on the displayed client name.
Keeping client consent enabled for other scopes is compatible with hiding only
this internal scope. Do not disable MFA, privacy notices or marketing consent:
they are separate controls.

### Explicitly allow the API roles

Inside **Client scopes -> dotnetliguria-permissions -> Scope**:

1. Choose **Assign role**.
2. Filter by client roles and select **DotNetLiguriaCore**.
3. Select all 52 roles in step 1, then assign.
4. Confirm no foreign-client, legacy administrator or realm-management roles
   are in this application's permission scope allowlist.

Allowing these roles in the scope **does not grant them to every user**.
It makes a role eligible for token emission only when the user also holds it.

### Attach it as a default SPA scope

Open **Clients -> DotNetLiguriaSpa -> Client scopes**:

1. Choose **Add client scope**.
2. Select `dotnetliguria-permissions`.
3. Add it as **Default**, not Optional.
4. Verify Full Scope Allowed is still OFF in the dedicated scope.

Keep existing required scopes such as `profile`, `email`, `roles` and
`web-origins`. Preserve the normal `openid` request and working UserInfo
configuration. The SPA must not need to request an optional permission scope.

The backend's interactive OIDC client is separate: only attach this scope there
if its interactive flow needs application permission claims, and explicitly
allow only the roles required by that flow. Its cookie/ID token does not
authorize Bearer-only API routes.

Do **not** attach the application permission scope to administration service
clients.

## 4. Configure permission and audience mappers

Open **Client scopes -> dotnetliguria-permissions -> Mappers**. Reuse correct
existing mappers rather than adding duplicates with the same claim name.

### Permission mapper

Choose **Configure a new mapper -> User Client Role**:

| Setting | Value |
| --- | --- |
| Name | `application-permissions` |
| Client ID | `DotNetLiguriaCore` |
| Client Role prefix | Empty |
| Token Claim Name | `permissions` |
| Claim JSON Type | String |
| Multivalued | ON |
| Add to access token | ON |
| Add to ID token | OFF |
| Add to userinfo | OFF |

Save. Use normal access tokens for the initial rollout. If lightweight access
tokens are enabled, verify that this mapper and the API audience are actually
included in the token delivered to this API; configure the corresponding
lightweight-token mapper options where supported.

The actual JWT payload must contain a string array, even for one value:

```json
{
  "permissions": ["events.read"]
}
```

Do not use Boolean claims, a space/CSV-separated string, hardcoded permission
lists or editable user attributes as alternative grant sources.

### API audience mapper

Preserve an existing mapper if it already reliably includes DotNetLiguriaCore
in the SPA access-token audience. Otherwise choose **Audience**:

| Setting | Value |
| --- | --- |
| Name | `api-audience` |
| Included Client Audience | `DotNetLiguriaCore` |
| Included Custom Audience | Empty |
| Add to access token | ON |
| Add to ID token | OFF |

The `aud` value may be a string or an array, but must contain
`DotNetLiguriaCore`. Audience identifies the API; it grants no task permission.

### Evaluate before continuing

Under **Clients -> DotNetLiguriaSpa -> Client scopes -> Evaluate**, select a
synthetic user with a known small assignment. Inspect the generated access
token locally. Confirm its issuer, audience and permission values. Evaluation
is useful configuration evidence, but also test actual issued login tokens
during the final staging checks.

After a mapper or scope change, obtain a new token. Existing tokens are not
rewritten.

## 5. Create the dedicated permission-directory service client

The backend uses this machine identity for live permission inspection and
dashboard permission changes. It is not a browser client, and must not reuse
the privacy administration credential.

### Client settings

Open **Clients -> Create client**:

| Setting | Value |
| --- | --- |
| Client type | OpenID Connect |
| Client ID | `dotnetliguria-permission-admin` |
| Client authentication | ON |
| Authorization Services | OFF; not required by this integration |
| Standard flow | OFF |
| Implicit flow | OFF |
| Direct access grants | OFF |
| Service accounts roles | ON |

Disable other unused authentication flows. No redirect URI or browser web
origin is needed. Keep **Full Scope Allowed OFF**.

### Assign provider permissions AND allow them into its token

These are separate controls:

| Console location | Purpose |
| --- | --- |
| Service accounts roles | Assigns administration powers to the machine identity |
| Client scopes -> dedicated scope -> Scope | Makes approved assigned roles scope-eligible with full scope OFF |

For conventional realm-management administration, the candidate role set in the
implementation prospect is:

```text
realm-management: view-users
realm-management: query-users
realm-management: view-clients
realm-management: query-clients
realm-management: manage-users
```

This is **not a verified minimum for your installed release**. Determine the
approved set using that release's administration model and synthetic tests.
Some roles are composite or overlap; do not claim the five names prove least
privilege.

Where supported, prefer fine-grained provider permissions restricting the
service account to the required users and application-client role mappings.
The adapter needs fixed-client lookup, client-role inspection, user/group
inspection, direct/effective client-role reads and direct role-mapping writes.
Verify these actual operations, not merely successful client-credentials login.

In **Service accounts roles**, assign the approved provider roles. In the
service client's dedicated **Scope** tab, explicitly allow the approved roles.
Preserve the standard `roles` client scope and verify the provider-required
administration claims/audience are emitted. Do not attach
`dotnetliguria-permissions`.

**Do not grant `realm-admin` or `manage-realm` as a shortcut.** Conventional
`manage-users` may allow broader account administration than this application
needs. Website delegation safeguards do not constrain a stolen credential
used directly against Keycloak. Accepting that residual power is an explicit
operator decision, not something the website silently solves.

### Backend runtime configuration

Obtain the secret from the client's **Credentials** tab. Store it only in the
backend's approved runtime secret store. Never put it in source control,
documentation, frontend configuration, `VITE_*` variables or logs.

Supply these environment variables to the backend. The issuer and hostname
below match the repository's configured realm; the client ID matches this
runbook. If you created a differently named service client, use its actual ID.
Only the secret and protected group UUID must be supplied from your live setup:

```text
PermissionDirectory__Issuer=https://hello.vevy.com/realms/DotNetLiguria
PermissionDirectory__AllowedIdentityHost=hello.vevy.com
PermissionDirectory__ServiceClientId=dotnetliguria-permission-admin
PermissionDirectory__ServiceClientSecret=<runtime secret>
PermissionDirectory__ApplicationClientId=DotNetLiguriaCore
PermissionDirectory__ProtectedGroupIds__0=<protected operator group UUID>
```

| Variable | Value or where to obtain it |
| --- | --- |
| `PermissionDirectory__Issuer` | `https://hello.vevy.com/realms/DotNetLiguria`; must equal `AuthServer:Authority` and `Privacy:Issuer` |
| `PermissionDirectory__AllowedIdentityHost` | `hello.vevy.com` |
| `PermissionDirectory__ServiceClientId` | `dotnetliguria-permission-admin`, as created in step 5 |
| `PermissionDirectory__ServiceClientSecret` | Clients -> dotnetliguria-permission-admin -> Credentials -> Client secret; put the actual value only in the runtime secret store |
| `PermissionDirectory__ApplicationClientId` | `DotNetLiguriaCore` |
| `PermissionDirectory__ProtectedGroupIds__0` | UUID of the protected operator group from step 6; open Groups -> your group and obtain the group ID from its console URL or approved admin tooling |

The last two placeholders requiring live values are not usable configuration:
do not copy their angle-bracket text literally. The service secret must never
be recorded in this document. The protected group UUID is not known from the
repository and must not be invented or replaced with the group name.

Constraints:

- Issuer must match the users' token issuer, use HTTPS port 443, and have the
  supported `/realms/{realm}` path with no query, fragment or embedded user info.
- AllowedIdentityHost is the hostname only, without scheme or path.
- Service client ID and secret must differ from `Privacy:AdminClientId` and
  `Privacy:AdminClientSecret`.
- ApplicationClientId is exactly `DotNetLiguriaCore`; the backend resolves its
  internal client UUID itself.
- ProtectedGroupIds is a non-empty array of real group UUIDs, not display names.
  Use `__1`, `__2`, etc. for additional groups.

Create the protected group in step 6 if it does not yet exist. Missing/invalid
directory configuration returns `permission_directory_not_configured` (503).
Even if assignments are managed manually, administrative requests still need
this service credential for live checks. Ordinary accounts with no application
permission candidates do not need it merely to obtain empty capabilities.

## 6. Give your account access, then assign other people's tasks

This step is about **human users**, not the service account from step 5.
It has two separate effects:

| Action | What it does |
| --- | --- |
| Assign application roles to a group and put a user in it | Gives that user those permissions |
| Put the group's UUID in `PermissionDirectory__ProtectedGroupIds` | Prevents the website's access-management page from changing permissions of users in that group |

There is no special "protected" switch to enable on a Keycloak group.
**The backend configuration makes the group protected.** Its name is only a
label. Protection does not grant permissions and does not prevent changes
made directly by an authorized Keycloak administrator.

### 6A. Create the group for your administrator account

1. In the DotNetLiguria realm, open **Groups**.
2. Click **Create group** and name it `Application access operators`.
3. Open the group and select **Role mapping**.
4. Click **Assign role**, filter by client roles, and select client
   **DotNetLiguriaCore**.
5. Assign these four roles:

| Role | What you can do in the website |
| --- | --- |
| `access.users.read` | Find users and inspect their application permissions |
| `access.permissions.grant` | Give eligible permissions to another user |
| `access.permissions.revoke` | Remove eligible direct permissions from another user |
| `access.audit.read` | Read the permission-change audit |

These four roles **do not give you event editing, publishing or other content
permissions**.

### 6B. Add the task permissions you need

The website lets you delegate only permissions that **you also hold**, and
only those the application marks as delegable.

For example, if you must edit events and give event-editing access to others,
also assign these roles to `Application access operators`:

```text
events.read
events.manage
speakers.read
venues.read
```

With these roles plus the four access roles above, you can inspect users,
grant/revoke eligible event-editor permissions, and edit current draft events.
You cannot publish, delete or edit past events without additional permissions.

If your own account intentionally needs every application task, assign all
52 DotNetLiguriaCore roles from step 1 to this group instead. This is an
explicit full-access assignment, not a special administrator bypass. Choose
it only if every member of this group should have all those powers. New roles
will still need a deliberate assignment later.

Some permissions can **never** be assigned through the website:
`access.*`, `privacy.*`, `maintenance.*` and `backups.restore`. Assign or remove
those directly in Keycloak, even when the website operator holds them.

### 6C. Put your user account in the group

1. Open **Users** and select the account you use to log in to the website.
2. Open its **Groups** tab and choose **Join group**.
3. Select `Application access operators` and confirm.

Do not add the `service-account-dotnetliguria-permission-admin` machine user:
that account uses the provider administration roles from step 5, not these
human application roles.

### 6D. Protect the group in the backend configuration

1. Return to **Groups -> Application access operators**.
2. Obtain this group's UUID from its console URL or approved admin tooling.
   Use the group ID, not the realm ID, client ID or group name.
3. Set the backend runtime environment variable:

```text
PermissionDirectory__ProtectedGroupIds__0=<UUID of Application access operators>
```

4. Restart/reload the backend through your normal approved configuration
   process so it reads the updated value.

The website will now refuse permission changes targeting any member of this
group. This is intentional: manage these trusted accounts directly in
Keycloak. The website also rejects users changing their own permissions,
whether or not they are in a protected group.

If you create another trusted recovery/operator group, add its UUID as
`PermissionDirectory__ProtectedGroupIds__1`, and so on.

### 6E. Create specialist groups only when needed

You can postpone this section while finishing your own setup. To give another
person a limited job, create a group, assign its roles using the same
**Role mapping -> Assign role -> DotNetLiguriaCore** procedure, then add that
person through **Users -> user -> Groups -> Join group**.

Do not add ordinary specialist group UUIDs to ProtectedGroupIds unless you
intend to prevent website permission changes for every member.

Suggested exact starting bundles:

| Group | Application roles |
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
| Backup operators | backups.read, backups.create |

Add deletion, export, restore, external publication and other sensitive duties
only after review. Past-event mutations and sensitive related actions require
the underlying permission **and** `events.past.manage`. Published-content edits
also require the corresponding publish permission.

Group permissions are inherited. The website displays them but cannot remove
them by deleting a user's direct permission. To remove a group-derived grant,
change that user's membership or the group's role mapping in Keycloak. The
website can manage only eligible **direct user grants**.

### 6F. Sign in again and check sensitive-operation MFA

Sign out of the website and sign back in to obtain a token containing the new
permissions. Your account should now enter the admin dashboard and show the
tasks you assigned. Complete the checks in step 7 before relying on this setup.

Preserve/configure the existing MFA flow so actual access tokens carry
`acr=mfa` or `acr=hwk`, plus exactly one numeric `auth_time`. The application
requires authentication no more than 300 seconds old and not in the future.
An assigned role, enrolled OTP or hardcoded `acr` mapper is not proof of a
recent MFA authentication. Verify the deployed flow/step-up mechanism with
synthetic accounts. Explicit application confirmation headers are also
required for relevant sensitive actions; MFA does not replace them.

Users enroll a second factor from the website's **Area personale → Account →
Secondo fattore di accesso (MFA)**. Its buttons start Keycloak
application-initiated actions (`kc_action=CONFIGURE_TOTP` or
`kc_action=webauthn-register`) and return to the personal page. Keep the
**Configure OTP** and **Webauthn Register** required actions enabled under
**Authentication → Required actions**. Enrollment alone does not issue
`acr=mfa`: the realm browser flow (and, for brokered Google sign-ins, the
identity provider's post-login flow) must require the second factor when
`mfa` is requested and map the `mfa` ACR to that level.

### 6G. Configure MFA step-up for password and Google sign-ins

Keycloak runs two different flows, and each needs its own setup:

- **Password sign-in** runs the browser flow bound to the SPA client
  (**Clients → DotNetLiguriaSpa → Advanced → Authentication flow overrides →
  Browser Flow**, here "Browser step-up with TOTP_RAF").
- **Google sign-in** never reaches that browser flow's OTP step. After Google
  returns, Keycloak runs only the Google identity provider's **Post login flow**.

On the SPA client (**Advanced → Advanced settings → ACR to LoA Mapping**) map
`pwd` = 1, `mfa` = 2, `hwk` = 3. The website requests `acr_values=pwd` for
ordinary sign-in and `acr_values=mfa` for **Verifica MFA**.

**Browser flow (password sign-in), unchanged:**

```
Cookie                                             (Alternative)
Auth flow                                          (Alternative)
├─ 1st Condition Flow                              (Conditional)
│   ├─ Condition - Level of Authentication [level 1]           (Required)
│   └─ Username Password Form                                   (Required)
└─ 2nd Condition Flow                              (Conditional)
    ├─ Condition - Level of Authentication [level 2, max age 300] (Required)
    └─ OTP Form                                                 (Required)
```

**Google post-login flow:**

1. In **Authentication**, duplicate the browser step-up flow, for example as
   "Browser step-up with TOTP_RAF (Google)".
2. In the copy, delete **Cookie** (the cookie belongs only to the browser flow,
   so SSO is unaffected).
3. In the 1st Condition Flow, delete **Username Password Form**. Then add the
   step **Allow access** and set it to Required. Keep the level-1 condition.
4. Keep the 2nd Condition Flow as is (level 2, max age 300, OTP Form).
5. Set the top-level **Auth flow** to Required.
6. In **Identity providers → google → Advanced settings → Post login flow**,
   select this copy and save. Leave **First login flow** unchanged.

```
Auth flow                                          (Required)
├─ 1st Condition Flow                              (Conditional)
│   ├─ Condition - Level of Authentication [level 1]           (Required)
│   └─ Allow access                                             (Required)
└─ 2nd Condition Flow                              (Conditional)
    ├─ Condition - Level of Authentication [level 2, max age 300] (Required)
    └─ OTP Form                                                 (Required)
```

Why each piece matters:

- **Level-1 subflow is required.** "Condition - Level of Authentication"
  matches whenever no level has been reached yet in the current authentication.
  Without the level-1 subflow, the level-2 condition matches on every Google
  login and always asks for OTP.
- **Use Allow access, not Username Password Form.** That form renders the
  login page again with the Google button. Choosing Google re-runs the
  post-login flow, which causes an infinite loop. Allow access records level 1
  silently, because the Google sign-in is the level-1 proof.
- **Level 2** runs only when `mfa` is requested (`pwd` → level 1 < 2 is
  skipped). Max age 300 matches the application's 5-minute MFA window.

Expected behavior, to verify with a test account after every flow change:

| Action | Password account | Google account |
| --- | --- | --- |
| Ordinary sign-in | Password, no OTP, `acr=pwd` | Google, no OTP, `acr=pwd` |
| **Verifica MFA** with an SSO session | OTP only, `acr=mfa` | OTP only, `acr=mfa` |
| **Verifica MFA** within 300 s of a previous OTP | No prompt, `acr=mfa` | No prompt, `acr=mfa` |

Verify `acr` on **Area personale → Account** or **Accessi utenti**; both show
the current level.
## 7. Renew sessions, verify and cut over

Use synthetic accounts and approved staging infrastructure. Do not use real
destructive data operations to test permission boundaries.

| Scenario | Expected result |
| --- | --- |
| Assigned API role and eligible SPA scope | Permission appears in a newly issued token and capabilities |
| Scope-eligible but unassigned role | Permission absent |
| Assigned role omitted from token scope | No API grant; live lookup cannot restore it |
| Group role assignment | Appears as effective/inherited access; inherited grants read-only in dashboard |
| Realm/foreign-client/legacy administrator role only | No application permission from that role |
| Ordinary account with no application permissions | Normal login/self-service; empty admin capabilities |
| Live assignment removed | Next administrative authorization evaluation denies that permission |
| New assignment added | Requires a current live grant and a renewed eligible token |
| Permission service unavailable | Administrative authorization fails closed with explicit 503 |
| Self/protected permission-change target | Dashboard mutation denied |
| Expired/missing MFA or confirmation | Sensitive action denied |

Verify actual browser login and `GET /api/account/capabilities`, permitted and
denied specialist operations, direct grant/revoke outcomes and restricted audit
persistence. For mutations, the API's expected-state and audit requirements
must also succeed; a valid Keycloak token alone does not establish that.

Release matching API/SPA/configuration artifacts through the approved deployment
process. Renew affected tokens/sessions after scope/mapper changes. Before
retiring legacy role/mapping configuration, confirm reviewed replacements and
protected recovery access work. Legacy-only tokens must not grant admin access.
Rollback uses matching artifacts/configuration, never full scope ON or a
temporary authorization bypass.

Real provider issuance, version-specific fine-grained administration, MFA and
database/browser flows were not verified by repository unit tests. The local
HTTPS smoke used synthetic unreachable dependencies; it does not prove this
live setup works. Multi-instance coordination and audit age-based retention
remain deployment/operator decisions documented in authorization.md.

## Troubleshooting

### Full Scope Allowed returns to ON

First confirm you are on the intended client's dedicated **Scope** tab, not
editing **Include in token scope**. Set OFF, save if shown, wait for success
and reload.

If it reverts, inspect browser Developer Tools -> Network locally:

| Observation | Next investigation |
| --- | --- |
| No update request | Unsaved toggle or console UI problem |
| Update returns 403 | Console operator lacks client-update rights |
| Other update error | Inspect the provider's error without exposing sensitive response data |
| Update succeeds, later reads show ON | Check external provisioning/reconciliation, concurrent operators and version-specific console/server defects |
| Changes after restart | Inspect startup import/provisioning behavior |

Missing scope mappings should not automatically re-enable full scope.

### Personal area returns 503 `identity_admin_unavailable`

The personal area (**Dati condivisi**, export, consents, erasure) reads the
account through the privacy service client `dotnetliguria-privacy-admin`.
If that client has **Full Scope Allowed = OFF** without explicit scope mappings,
its service account still holds the `realm-management` roles, but they are
filtered out of its token. The Keycloak admin API then answers 403, and the
website reports 503 `identity_admin_unavailable`.

Fix, without turning full scope back on:

1. **Clients → dotnetliguria-privacy-admin → Client scopes →
   dotnetliguria-privacy-admin-dedicated → Scope**.
2. **Assign role → Filter by clients**, select `realm-management` and add the
   roles already assigned to its service account: `view-users`,
   `manage-users`, `query-users`, `view-clients`, `query-clients`.
3. Reload **Dati condivisi**; no restart is needed because the website
   requests a new service token on each call.

Check with **Client scopes → Evaluate** on that client (user: its service
account): the generated access token must contain those `realm-management`
roles. Do not add any role the service account is not already assigned.
The website does not modify this setting. Diagnose failed persistence instead
of enabling it as a workaround. Do not share raw network exports, tokens or
credentials.

### Login works but there is no dashboard access

Check role ownership, actual user/group assignment, SPA default scope attachment,
explicit role-scope allowlist, mapper fields and the newly issued access token.
Then check server capabilities. A modifier-only grant does not unlock the shell.

### Administrative requests return 503

- `permission_directory_not_configured`: check runtime keys and protected UUIDs.
- `permission_directory_unavailable`: check approved connectivity, service-client
  authentication, role assignments, scope eligibility and provider authorization.
- `permission_directory_invalid_response`: inspect sanitized server diagnostics
  and verify the deployed provider/API response contract.
- Access writes can also fail because audit storage or post-write verification
  is unavailable; do not treat these as successful changes or automatically retry.

Never turn full scope ON, assign realm-admin or weaken the backend checks to
hide these errors.

## References

- [Application authorization prospect](authorization.md)
- [Keycloak Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/index.html)
- [Keycloak Admin REST API](https://www.keycloak.org/docs-api/latest/rest-api/index.html)

Use official documentation matching your installed release; the `latest` links
are references, not evidence of the version running in your environment.
