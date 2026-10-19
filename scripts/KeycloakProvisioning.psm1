#requires -Version 7.4
Set-StrictMode -Version Latest

function Get-SetupField($Object, [string]$Name, $Default = $null) {
    if ($null -ne $Object -and $Object.Contains($Name)) { return $Object[$Name] }
    return $Default
}

function Assert-SetupId($Object) {
    $id = [guid]::Empty
    if ($null -eq $Object -or ![guid]::TryParse([string](Get-SetupField $Object 'id'), [ref]$id)) {
        throw 'Provider returned an object without a valid UUID. No automatic retry.'
    }
    return $id.ToString('D')
}

function Get-SetupMatch($Items, [string]$Field, [string]$Value) {
    $matches = @($Items | Where-Object { (Get-SetupField $_ $Field) -ceq $Value })
    if ($matches.Count -gt 1) { throw "Ambiguous provider configuration for $Field=$Value." }
    if ($matches.Count -eq 1) { return $matches[0] }
    return $null
}

function Add-SetupAction($Plan, [string]$Method, [string]$Path, $Body, [string]$Label,
    [string]$Alias = '', [string]$Lookup = '', [string]$MatchField = '', [string]$MatchValue = '') {
    $Plan.Actions.Add(@{
        Method = $Method; Path = $Path; Body = $Body; Label = $Label
        Alias = $Alias; Lookup = $Lookup; MatchField = $MatchField; MatchValue = $MatchValue
    })
}

function Add-SetupPatch($Plan, $Existing, $Desired, [string]$Path, [string]$Label) {
    $changed = $false
    $body = @{}
    foreach ($key in $Existing.Keys) { $body[$key] = $Existing[$key] }
    foreach ($key in $Desired.Keys) {
        if ($key -eq 'attributes' -or $key -eq 'config') {
            $nested = @{}
            $old = Get-SetupField $Existing $key @{}
            foreach ($name in $old.Keys) { $nested[$name] = $old[$name] }
            foreach ($name in $Desired[$key].Keys) {
                $actual = Get-SetupField $old $name
                $expected = $Desired[$key][$name]
                # Keycloak omits an empty client-role prefix when persisting a mapper.
                $emptyPrefix = $key -eq 'config' -and $name -eq 'usermodel.clientRoleMapping.rolePrefix' -and
                    $expected -ceq '' -and $null -eq $actual
                if (!$emptyPrefix -and $actual -cne $expected) { $changed = $true }
                $nested[$name] = $Desired[$key][$name]
            }
            $body[$key] = $nested
        } else {
            if ((Get-SetupField $Existing $key) -cne $Desired[$key]) { $changed = $true }
            $body[$key] = $Desired[$key]
        }
    }
    # Never round-trip credentials in client configuration updates.
    $body.Remove('secret')
    $body.Remove('registrationAccessToken')
    if ($changed) { Add-SetupAction $Plan 'PUT' $Path $body $Label }
}

function New-KeycloakSetupPlan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][scriptblock]$Request,
        [Parameter(Mandatory)][hashtable]$Fixture,
        [Parameter(Mandatory)][guid]$RecoveryUserId,
        [Parameter(Mandatory)][string]$ProvisioningClientId,
        [string]$RuntimeClientId = 'dotnetliguria-permission-admin',
        [string]$RecoveryGroupName = 'Application recovery operators',
        [switch]$RepairPermissionScope,
        [switch]$RemoveLegacySpaMappers,
        [switch]$GrantRecoveryAccess
    )
    if ($RecoveryUserId -eq [guid]::Empty) { throw 'Recovery user UUID must not be empty.' }
    foreach ($name in @($ProvisioningClientId, $RuntimeClientId)) {
        if ($name -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$') { throw 'Invalid service client ID.' }
    }
    if ($RuntimeClientId -cin @($ProvisioningClientId, 'dotnetliguria-privacy-admin', 'DotNetLiguriaCore', 'DotNetLiguriaSpa')) {
        throw 'The runtime permission client must be separate from provisioning, privacy and interactive clients.'
    }
    if ($ProvisioningClientId -cin @('dotnetliguria-privacy-admin', 'DotNetLiguriaCore', 'DotNetLiguriaSpa')) {
        throw 'Use a separate provisioning identity, not a privacy or interactive client.'
    }
    if ($RecoveryGroupName -cnotmatch '^[A-Za-z][A-Za-z0-9 _-]{0,99}$') { throw 'Invalid recovery group name.' }
    $plan = @{
        Actions = [System.Collections.Generic.List[object]]::new()
        Aliases = @{}; RuntimeClientId = $RuntimeClientId; RecoveryUserId = $RecoveryUserId.ToString('D')
    }
    $provisioner = Get-SetupMatch @(& $Request 'GET' "clients?clientId=$ProvisioningClientId" $null) 'clientId' $ProvisioningClientId
    if (!$provisioner) { throw 'The provisioning client must already exist in this realm.' }
    $provisioner = & $Request 'GET' "clients/$(Assert-SetupId $provisioner)" $null
    if ((Get-SetupField $provisioner 'fullScopeAllowed' $true) -or
        !(Get-SetupField $provisioner 'serviceAccountsEnabled' $false) -or
        (Get-SetupField $provisioner 'publicClient' $true)) {
        throw 'Provisioning client must be confidential, service-account enabled and Full Scope Allowed OFF.'
    }
    $api = Get-SetupMatch @(& $Request 'GET' 'clients?clientId=DotNetLiguriaCore' $null) 'clientId' 'DotNetLiguriaCore'
    $spa = Get-SetupMatch @(& $Request 'GET' 'clients?clientId=DotNetLiguriaSpa' $null) 'clientId' 'DotNetLiguriaSpa'
    if (!$api -or !$spa) { throw 'Existing DotNetLiguriaCore and DotNetLiguriaSpa clients are required. Login clients are not recreated.' }
    $plan.Aliases.api = Assert-SetupId $api
    $plan.Aliases.spa = Assert-SetupId $spa
    foreach ($entry in @(@{ Name = 'api'; Client = $api }, @{ Name = 'spa'; Client = $spa })) {
        $client = & $Request 'GET' "clients/$($plan.Aliases[$entry.Name])" $null
        if ((Get-SetupField $client 'protocol') -cne 'openid-connect' -or !(Get-SetupField $client 'enabled' $false)) {
            throw 'Application login clients must be enabled OpenID Connect clients.'
        }
        Add-SetupPatch $plan $client @{ fullScopeAllowed = $false; consentRequired = $false } `
            "clients/{$($entry.Name)}" "Restrict $($entry.Name) full scope and disable first-party OAuth consent"
    }
    $user = & $Request 'GET' "users/$RecoveryUserId" $null
    if ((Assert-SetupId $user) -cne $RecoveryUserId.ToString('D') -or
        !(Get-SetupField $user 'enabled' $false) -or
        (Get-SetupField $user 'serviceAccountClientId') -or
        ([string](Get-SetupField $user 'username')).StartsWith('service-account-', [StringComparison]::Ordinal)) {
        throw 'Recovery user must be an existing enabled human account.'
    }
    $catalogue = @($Fixture.roles.client.DotNetLiguriaCore | ForEach-Object { $_.name })
    if ($catalogue.Count -ne 52 -or @($catalogue | Sort-Object -Unique).Count -ne $catalogue.Count) {
        throw 'Unexpected application catalogue. Review tool/fixture changes before provisioning.'
    }
    $existingRoles = @(& $Request 'GET' "clients/$($plan.Aliases.api)/roles?first=0&max=513" $null)
    if ($existingRoles.Count -ge 513) { throw 'API role list exceeded the supported bound.' }
    $roles = @()
    for ($index = 0; $index -lt $catalogue.Count; $index++) {
        $name = $catalogue[$index]
        if ($name -cnotmatch '^[a-z][a-z.-]+$') { throw 'Invalid catalogue permission.' }
        $role = Get-SetupMatch $existingRoles 'name' $name
        $alias = "role$index"
        if ($role) {
            if ((Get-SetupField $role 'composite' $false) -or
                !(Get-SetupField $role 'clientRole' $false) -or
                (Get-SetupField $role 'containerId') -cne $plan.Aliases.api) {
                throw "Permission $name is not a non-composite API-client role."
            }
            $plan.Aliases[$alias] = Assert-SetupId $role
        } else {
            Add-SetupAction $plan 'POST' 'clients/{api}/roles' @{ name = $name; composite = $false } `
                "Create permission $name" $alias "clients/{api}/roles/$name"
        }
        $roles += @{ id = "{$alias}"; name = $name }
    }
    $scopes = @(& $Request 'GET' 'client-scopes' $null)
    if ($scopes.Count -gt 512) { throw 'Client scope list exceeded the supported bound.' }
    $scopeName = 'dotnetliguria-permissions'
    $scope = Get-SetupMatch $scopes 'name' $scopeName
    $desiredScope = @{
        name = $scopeName; protocol = 'openid-connect'
        attributes = @{ 'include.in.token.scope' = 'true'; 'display.on.consent.screen' = 'false' }
    }
    if ($scope) {
        if ($scope.protocol -cne 'openid-connect') { throw 'Permission scope has an incompatible protocol.' }
        $plan.Aliases.scope = Assert-SetupId $scope
        Add-SetupPatch $plan $scope $desiredScope 'client-scopes/{scope}' 'Hide internal permission scope from OAuth consent'
        $mappings = & $Request 'GET' "client-scopes/$($plan.Aliases.scope)/scope-mappings" $null
        $realmMappings = @(Get-SetupField $mappings 'realmMappings' @())
        if ($realmMappings.Count) {
            if (!$RepairPermissionScope) { throw 'Permission scope contains realm-role mappings. Review Preview with -RepairPermissionScope.' }
            Add-SetupAction $plan 'DELETE' 'client-scopes/{scope}/scope-mappings/realm' $realmMappings `
                'Remove realm-role eligibility from application permission scope (not user assignments)'
        }
        $clientMappings = Get-SetupField $mappings 'clientMappings' @{}
        foreach ($mapping in $clientMappings.Values) {
            if ($mapping.client -cne 'DotNetLiguriaCore' -and @($mapping.mappings).Count) {
                if (!$RepairPermissionScope) { throw 'Permission scope contains foreign-client role mappings. Review Preview with -RepairPermissionScope.' }
                $foreignId = Assert-SetupId $mapping
                Add-SetupAction $plan 'DELETE' "client-scopes/{scope}/scope-mappings/clients/$foreignId" @($mapping.mappings) `
                    "Remove $($mapping.client) eligibility from application permission scope (not user assignments)"
            }
        }
    } else {
        Add-SetupAction $plan 'POST' 'client-scopes' $desiredScope 'Create application permission scope' `
            'scope' 'client-scopes' 'name' $scopeName
    }
    $scopePath = 'client-scopes/{scope}/scope-mappings/clients/{api}'
    $readScopePath = if ($scope) { "client-scopes/$($plan.Aliases.scope)/scope-mappings/clients/$($plan.Aliases.api)" } else { '' }
    $mapped = if ($scope) { @(& $Request 'GET' $readScopePath $null) } else { @() }
    if (@($mapped | Where-Object { $_.name -cnotin $catalogue }).Count) { throw 'Permission scope allows unknown API roles. Review manually.' }
    $missing = @($roles | Where-Object { $_.name -cnotin @($mapped | ForEach-Object { $_.name }) })
    if ($missing.Count) { Add-SetupAction $plan 'POST' $scopePath $missing 'Explicitly scope application permissions' }
    $mappers = if ($scope) { @(& $Request 'GET' "client-scopes/$($plan.Aliases.scope)/protocol-mappers/models" $null) } else { @() }
    $desiredMappers = @($Fixture.clientScopes | Where-Object { $_.name -ceq $scopeName })[0].protocolMappers
    foreach ($desired in $desiredMappers) {
        $existing = Get-SetupMatch $mappers 'name' $desired.name
        if ($existing -and $existing.protocolMapper -cne $desired.protocolMapper) {
            throw "Mapper $($desired.name) has an incompatible type. Review manually."
        }
        if ($existing) {
            $mapperId = Assert-SetupId $existing
            Add-SetupPatch $plan $existing $desired "client-scopes/{scope}/protocol-mappers/models/$mapperId" "Configure mapper $($desired.name)"
        } else {
            Add-SetupAction $plan 'POST' 'client-scopes/{scope}/protocol-mappers/models' $desired "Create mapper $($desired.name)"
        }
    }
    foreach ($mapper in $mappers) {
        if ((Get-SetupField (Get-SetupField $mapper 'config' @{}) 'claim.name') -ceq 'permissions' -and $mapper.name -cne 'application-permissions') {
            throw 'Another mapper emits permissions. Remove the ambiguity manually before applying.'
        }
    }
    $defaults = @(& $Request 'GET' "clients/$($plan.Aliases.spa)/default-client-scopes" $null)
    $optional = @(& $Request 'GET' "clients/$($plan.Aliases.spa)/optional-client-scopes" $null)
    foreach ($attached in @($defaults + $optional)) {
        if ($attached.name -ceq $scopeName) { continue }
        $attachedId = Assert-SetupId $attached
        foreach ($mapper in @(& $Request 'GET' "client-scopes/$attachedId/protocol-mappers/models" $null)) {
            if ((Get-SetupField (Get-SetupField $mapper 'config' @{}) 'claim.name') -ceq 'permissions') {
                throw 'Another attached client scope emits permissions. Resolve it manually.'
            }
        }
    }
    foreach ($mapper in @(& $Request 'GET' "clients/$($plan.Aliases.spa)/protocol-mappers/models" $null)) {
        $config = Get-SetupField $mapper 'config' @{}
        if ((Get-SetupField $config 'claim.name') -ceq 'permissions') {
            throw 'The SPA dedicated scope also emits permissions. Resolve it manually.'
        }
        if ($RemoveLegacySpaMappers) {
            $legacyRoles = $mapper.name -ceq 'realm roles' -and
                $mapper.protocolMapper -ceq 'oidc-usermodel-realm-role-mapper' -and
                (Get-SetupField $config 'claim.name') -ceq 'roles'
            $duplicateAudience = $mapper.name -ceq 'audience' -and
                $mapper.protocolMapper -ceq 'oidc-audience-mapper' -and
                (Get-SetupField $config 'included.client.audience') -ceq 'DotNetLiguriaCore' -and
                !(Get-SetupField $config 'included.custom.audience') -and
                (Get-SetupField $config 'access.token.claim') -ceq 'true' -and
                (Get-SetupField $config 'id.token.claim' 'false') -ceq 'false' -and
                (Get-SetupField $config 'userinfo.token.claim' 'false') -ceq 'false'
            if ($legacyRoles -or $duplicateAudience) {
                $mapperId = Assert-SetupId $mapper
                Add-SetupAction $plan 'DELETE' "clients/{spa}/protocol-mappers/models/$mapperId" $null `
                    "Remove obsolete SPA mapper $($mapper.name); retain canonical permission-scope mappers"
            }
        }
    }
    if (@($optional | Where-Object { $_.name -ceq $scopeName }).Count) {
        Add-SetupAction $plan 'DELETE' 'clients/{spa}/optional-client-scopes/{scope}' $null 'Move permission scope from optional to default'
    }
    if (!@($defaults | Where-Object { $_.name -ceq $scopeName }).Count) {
        Add-SetupAction $plan 'PUT' 'clients/{spa}/default-client-scopes/{scope}' $null 'Attach permission scope as SPA default'
    }
    # With Full Scope Allowed OFF the SPA token must explicitly carry the account
    # roles the Identity Provider Account API checks for the personal page.
    $accountClient = Get-SetupMatch @(& $Request 'GET' 'clients?clientId=account' $null) 'clientId' 'account'
    if (!$accountClient) { throw 'The standard account client is required for personal-page profile access.' }
    $plan.Aliases.account = Assert-SetupId $accountClient
    $selfServiceRoleNames = @('view-profile', 'manage-account')
    $selfServiceRoles = foreach ($name in $selfServiceRoleNames) {
        $role = & $Request 'GET' "clients/$($plan.Aliases.account)/roles/$name" $null
        if (!$role -or $role.name -cne $name) { throw "Account client role $name not found." }
        @{ id = (Assert-SetupId $role); name = $role.name; clientRole = $true; containerId = $plan.Aliases.account }
    }
    $currentSpaAccountScope = @(& $Request 'GET' "clients/$($plan.Aliases.spa)/scope-mappings/clients/$($plan.Aliases.account)" $null |
        Where-Object { $_ })
    if (@($currentSpaAccountScope | Where-Object { $_.name -cnotin $selfServiceRoleNames }).Count) {
        throw 'SPA scope has additional account-client roles. Review manually.'
    }
    $missing = @($selfServiceRoles | Where-Object { $_.name -cnotin @($currentSpaAccountScope | ForEach-Object { $_.name }) })
    if ($missing.Count) {
        Add-SetupAction $plan 'POST' 'clients/{spa}/scope-mappings/clients/{account}' $missing `
            'Scope SPA tokens to account view-profile/manage-account for the personal page'
    }
    $rolesScope = Get-SetupMatch $scopes 'name' 'roles'
    if (!$rolesScope) { throw 'The standard roles client scope is required; restore it through approved provider configuration.' }
    $plan.Aliases.rolesScope = Assert-SetupId $rolesScope
    $management = Get-SetupMatch @(& $Request 'GET' 'clients?clientId=realm-management' $null) 'clientId' 'realm-management'
    if (!$management) { throw 'realm-management client not found in the target realm.' }
    $plan.Aliases.management = Assert-SetupId $management
    $providerRoles = @()
    foreach ($name in @('view-users', 'query-users', 'view-clients', 'query-clients', 'manage-users')) {
        $role = & $Request 'GET' "clients/$($plan.Aliases.management)/roles/$name" $null
        $providerRoles += @{ id = (Assert-SetupId $role); name = $name }
    }
    $runtime = Get-SetupMatch @(& $Request 'GET' "clients?clientId=$RuntimeClientId" $null) 'clientId' $RuntimeClientId
    $runtimeDesired = @{
        clientId = $RuntimeClientId; protocol = 'openid-connect'; enabled = $true
        publicClient = $false; bearerOnly = $false; clientAuthenticatorType = 'client-secret'
        standardFlowEnabled = $false; implicitFlowEnabled = $false; directAccessGrantsEnabled = $false
        serviceAccountsEnabled = $true; fullScopeAllowed = $false; consentRequired = $false
    }
    if ($runtime) {
        $plan.Aliases.runtime = Assert-SetupId $runtime
        $runtime = & $Request 'GET' "clients/$($plan.Aliases.runtime)" $null
        if ($runtime.protocol -cne 'openid-connect' -or $runtime.publicClient -or
            @($runtime.redirectUris).Count -or @($runtime.webOrigins).Count -or $runtime.standardFlowEnabled -or
            (Get-SetupField $runtime 'clientAuthenticatorType' 'client-secret') -cne 'client-secret') {
            throw 'Existing runtime client has interactive/public configuration. It will not be repurposed automatically.'
        }
        Add-SetupPatch $plan $runtime $runtimeDesired 'clients/{runtime}' 'Configure dedicated runtime client without rotating its secret'
        $serviceUser = if ($runtime.serviceAccountsEnabled) {
            & $Request 'GET' "clients/$($plan.Aliases.runtime)/service-account-user" $null
        } else { $null }
        if ($serviceUser) { $plan.Aliases.serviceUser = Assert-SetupId $serviceUser }
        if ($serviceUser) {
            $effectiveProviderRoles = @(& $Request 'GET' "users/$($plan.Aliases.serviceUser)/role-mappings/clients/$($plan.Aliases.management)/composite" $null)
            $dangerous = @($effectiveProviderRoles | Where-Object { $_.name -cin @('realm-admin', 'manage-realm', 'manage-clients') })
            if ($dangerous.Count) { throw 'Runtime service account inherits broad realm/client administration. Review manually.' }
        }
        $runtimeDefaults = @(& $Request 'GET' "clients/$($plan.Aliases.runtime)/default-client-scopes" $null)
        $runtimeOptional = @(& $Request 'GET' "clients/$($plan.Aliases.runtime)/optional-client-scopes" $null)
        if (@($runtimeDefaults + $runtimeOptional | Where-Object { $_.name -ceq $scopeName }).Count) {
            throw 'Runtime client has the application permission scope attached. Remove that attachment manually.'
        }
    } else {
        Add-SetupAction $plan 'POST' 'clients' $runtimeDesired 'Create dedicated runtime permission client' `
            'runtime' "clients?clientId=$RuntimeClientId" 'clientId' $RuntimeClientId
        $runtimeDefaults = @()
        $serviceUser = $null
    }
    if (!$serviceUser) {
        # A GET action resolves the generated service account only after the client exists.
        Add-SetupAction $plan 'GET' 'clients/{runtime}/service-account-user' $null 'Resolve runtime service account' 'serviceUser'
    }
    if (!@($runtimeDefaults | Where-Object { $_.name -ceq 'roles' }).Count) {
        Add-SetupAction $plan 'PUT' 'clients/{runtime}/default-client-scopes/{rolesScope}' $null 'Attach standard service-token role mappers'
    }
    $currentServiceRoles = if ($serviceUser) {
        @(& $Request 'GET' "users/$($plan.Aliases.serviceUser)/role-mappings/clients/$($plan.Aliases.management)" $null)
    } else { @() }
    $approved = @($providerRoles | ForEach-Object { $_.name })
    if (@($currentServiceRoles | Where-Object { $_.name -cnotin $approved }).Count) {
        throw 'Existing runtime service account has additional realm-management roles. Review manually.'
    }
    $missing = @($providerRoles | Where-Object { $_.name -cnotin @($currentServiceRoles | ForEach-Object { $_.name }) })
    if ($missing.Count) {
        Add-SetupAction $plan 'POST' 'users/{serviceUser}/role-mappings/clients/{management}' $missing 'Assign approved runtime provider roles'
    }
    $currentServiceScope = if ($runtime) {
        @(& $Request 'GET' "clients/$($plan.Aliases.runtime)/scope-mappings/clients/$($plan.Aliases.management)" $null)
    } else { @() }
    if (@($currentServiceScope | Where-Object { $_.name -cnotin $approved }).Count) {
        throw 'Runtime scope has additional realm-management roles. Review manually.'
    }
    $missing = @($providerRoles | Where-Object { $_.name -cnotin @($currentServiceScope | ForEach-Object { $_.name }) })
    if ($missing.Count) {
        Add-SetupAction $plan 'POST' 'clients/{runtime}/scope-mappings/clients/{management}' $missing 'Explicitly scope runtime provider roles'
    }
    $groupQuery = 'groups?search=' + [uri]::EscapeDataString($RecoveryGroupName) + '&exact=true&first=0&max=101'
    $groups = @(& $Request 'GET' $groupQuery $null)
    if ($groups.Count -ge 101) { throw 'Recovery group search exceeded its bound.' }
    $group = Get-SetupMatch $groups 'name' $RecoveryGroupName
    if ($group) {
        if ((Get-SetupField $group 'path') -cne "/$RecoveryGroupName") {
            throw 'Recovery group must be a uniquely named top-level group.'
        }
        $plan.Aliases.recoveryGroup = Assert-SetupId $group
    } else {
        Add-SetupAction $plan 'POST' 'groups' @{ name = $RecoveryGroupName } 'Create protected recovery group' `
            'recoveryGroup' $groupQuery 'name' $RecoveryGroupName
    }
    if ($GrantRecoveryAccess) {
        if ($group) {
            $members = @(& $Request 'GET' "groups/$($plan.Aliases.recoveryGroup)/members?first=0&max=101" $null)
            if ($members.Count -ge 101 -or @($members | Where-Object { $_.id -cne $RecoveryUserId.ToString('D') }).Count) {
                throw 'Recovery group contains other users. Choose a separate recovery group to avoid granting them full access.'
            }
        }
        $groupRoles = if ($group) { @(& $Request 'GET' "groups/$($plan.Aliases.recoveryGroup)/role-mappings/clients/$($plan.Aliases.api)" $null) } else { @() }
        $missing = @($roles | Where-Object { $_.name -cnotin @($groupRoles | ForEach-Object { $_.name }) })
        if ($missing.Count) {
            Add-SetupAction $plan 'POST' 'groups/{recoveryGroup}/role-mappings/clients/{api}' $missing 'Explicitly grant all catalogue permissions to recovery group'
        }
        $memberships = @(& $Request 'GET' "users/$RecoveryUserId/groups?first=0&max=101" $null)
        if ($memberships.Count -ge 101) { throw 'Recovery user group list exceeded the supported bound.' }
        if (!$group -or !@($memberships | Where-Object { $_.id -ceq $plan.Aliases.recoveryGroup }).Count) {
            Add-SetupAction $plan 'PUT' "users/$RecoveryUserId/groups/{recoveryGroup}" $null 'Join specified human recovery account to protected group'
        }
    }
    return $plan
}

function Resolve-SetupValue($Value, $Aliases) {
    if ($Value -is [string]) {
        if ($Value -cmatch '^\{([A-Za-z0-9_-]+)\}$') {
            if (!$Aliases.ContainsKey($Matches[1])) { throw 'Unresolved provisioning dependency. Stop and rerun preview.' }
            return $Aliases[$Matches[1]]
        }
        return $Value
    }
    if ($Value -is [System.Collections.IDictionary]) {
        $result = @{}
        foreach ($key in $Value.Keys) { $result[$key] = Resolve-SetupValue $Value[$key] $Aliases }
        return $result
    }
    if ($Value -is [array]) { return ,@($Value | ForEach-Object { Resolve-SetupValue $_ $Aliases }) }
    return $Value
}

function Resolve-SetupPath([string]$Path, $Aliases) {
    foreach ($key in $Aliases.Keys) { $Path = $Path.Replace("{$key}", $Aliases[$key]) }
    if ($Path.Contains('{')) { throw 'Unresolved provisioning path. Stop and rerun preview.' }
    return $Path
}

function Invoke-KeycloakSetupPlan {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$Plan, [Parameter(Mandatory)][scriptblock]$Request)
    foreach ($action in $Plan.Actions) {
        $path = Resolve-SetupPath $action.Path $Plan.Aliases
        $body = Resolve-SetupValue $action.Body $Plan.Aliases
        $response = & $Request $action.Method $path $body
        if ($action.Alias) {
            if ($action.Lookup) {
                $lookup = Resolve-SetupPath $action.Lookup $Plan.Aliases
                $response = & $Request 'GET' $lookup $null
                if ($action.MatchField) {
                    $response = Get-SetupMatch @($response) $action.MatchField $action.MatchValue
                }
            }
            $Plan.Aliases[$action.Alias] = Assert-SetupId $response
        }
    }
}

function New-KeycloakSetupConnection {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Issuer, [Parameter(Mandatory)][string]$ClientId,
        [Parameter(Mandatory)][securestring]$ClientSecret)
    $uri = $null
    if (![uri]::TryCreate($Issuer, [UriKind]::Absolute, [ref]$uri) -or
        $uri.Scheme -ne 'https' -or $uri.Port -ne 443 -or $uri.UserInfo -or $uri.Query -or $uri.Fragment -or
        $uri.AbsoluteUri -cne $Issuer -or $uri.AbsolutePath -cnotmatch '^/realms/[A-Za-z0-9_-]{1,100}$' -or
        [uri]::CheckHostName($uri.IdnHost) -ne [UriHostNameType]::Dns) {
        throw 'Issuer must be a canonical HTTPS DNS realm URL on port443, without trailing slash or credentials.'
    }
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $handler.UseCookies = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [timespan]::FromSeconds(20)
    $client.MaxResponseContentBufferSize = 4MB
    $client.DefaultRequestHeaders.Accept.ParseAdd('application/json')
    $credential = [pscredential]::new($ClientId, $ClientSecret)
    $fields = [System.Collections.Generic.Dictionary[string,string]]::new()
    $fields.Add('grant_type', 'client_credentials')
    $fields.Add('client_id', $ClientId)
    $fields.Add('client_secret', $credential.GetNetworkCredential().Password)
    $form = [System.Net.Http.FormUrlEncodedContent]::new($fields)
    $authenticationFailure = 'Provisioning authentication transport failed. Check trusted HTTPS issuer and connectivity; no response bodies are logged.'
    try {
        $response = $client.PostAsync("$Issuer/protocol/openid-connect/token", $form).GetAwaiter().GetResult()
        try {
            if (!$response.IsSuccessStatusCode) {
                $authenticationFailure = "Provisioning login failed: HTTP $([int]$response.StatusCode). Check client credentials and service-account enablement."
                throw $authenticationFailure
            }
            $authenticationFailure = 'Provider returned an invalid provisioning token response. No response bodies are logged.'
            $token = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json -AsHashtable
            if (!(Get-SetupField $token 'access_token') -or [int](Get-SetupField $token 'expires_in' 0) -lt 60) {
                throw 'Provider returned an invalid or too-short-lived provisioning token.'
            }
            $client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token.access_token)
            $expires = [datetimeoffset]::UtcNow.AddSeconds([int]$token.expires_in - 15)
        } finally { $response.Dispose() }
    } catch {
        $client.Dispose()
        throw $authenticationFailure
    } finally { $form.Dispose(); $credential = $null }
    $base = $uri.GetLeftPart([UriPartial]::Authority) + '/admin' + $uri.AbsolutePath + '/'
    $request = {
        param($Method, $Path, $Body)
        if ([datetimeoffset]::UtcNow -ge $expires) { throw 'Provisioning token expired. Rerun preview; no mutation is retried automatically.' }
        if (!$Path -or $Path.StartsWith('/') -or $Path.Contains('..') -or $Path.Contains('\') -or
            $Path.Contains(':') -or $Path.Contains('#')) { throw 'Unsafe provisioning endpoint path.' }
        $message = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $base + $Path)
        if ($null -ne $Body) {
            $message.Content = [System.Net.Http.StringContent]::new(
                (ConvertTo-Json -InputObject $Body -Depth 50 -Compress), [text.encoding]::UTF8, 'application/json')
        }
        try {
            try { $response = $client.SendAsync($message).GetAwaiter().GetResult() }
            catch { throw 'Provider transport failed. No mutation is retried; rerun preview to inspect partial progress.' }
            try {
                if (!$response.IsSuccessStatusCode) {
                    throw "Provider operation failed: $Method HTTP $([int]$response.StatusCode). Check provisioning privileges/conflicts; no bodies are logged."
                }
                $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                if ($text) {
                    try { return ConvertFrom-Json -InputObject $text -AsHashtable }
                    catch { throw 'Provider returned invalid JSON. No mutation is retried.' }
                }
                return $null
            } finally { $response.Dispose() }
        } finally { $message.Dispose() }
    }.GetNewClosure()
    return @{ Request = $request; Client = $client; Realm = $uri.Segments[-1]; Hostname = $uri.IdnHost }
}

Export-ModuleMember -Function New-KeycloakSetupPlan, Invoke-KeycloakSetupPlan, New-KeycloakSetupConnection
