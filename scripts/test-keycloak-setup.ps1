#requires -Version 7.4
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'KeycloakProvisioning.psm1') -Force
$fixture = Get-Content (Join-Path (Split-Path $PSScriptRoot -Parent) 'keycloak/dev/realm-dotnetliguria.json') -Raw |
    ConvertFrom-Json -AsHashtable
$recoveryId = '00000000-0000-0000-0000-000000000010'
$script:passed = 0

function Assert-True([bool]$Value, [string]$Message) {
    if (!$Value) { throw $Message }
}
function Assert-Fails([scriptblock]$Action, [string]$Expected) {
    try { & $Action } catch {
        if ($_.Exception.Message -notlike "*$Expected*") { throw }
        return
    }
    throw "Expected failure containing: $Expected"
}
function Test-Case([string]$Name, [scriptblock]$Action) {
    & $Action
    $script:passed++
    Write-Host "PASS $Name"
}
function New-FakeProvider {
    $state = @{
        Counter = 100; Writes = 0; Reads = 0; FailWrite = 0
        Clients = @{}; Scopes = @{}; Roles = @{}; Groups = @{}; Mappings = @{}
        Defaults = @{}; Optional = @{}; Mappers = @{}; Memberships = @{}
        ScopeRealmMappings = @{}; ScopeClientMappings = @{}
        Users = @{
            $recoveryId = @{ id = $recoveryId; username = 'synthetic-recovery'; enabled = $true }
        }
    }
    foreach ($entry in @(@('DotNetLiguriaCore', '1'), @('DotNetLiguriaSpa', '2'), @('realm-management', '3'), @('account', '6'))) {
        $id = '00000000-0000-0000-0000-' + $entry[1].PadLeft(12, '0')
        $state.Clients[$id] = @{
            id = $id; clientId = $entry[0]; protocol = 'openid-connect'; enabled = $true
            fullScopeAllowed = $true; consentRequired = $true; attributes = @{ keep = 'unchanged' }
            redirectUris = @('https://localhost:5443/callback'); webOrigins = @('https://localhost:5443')
        }
        $state.Roles[$id] = @()
        $state.Defaults[$id] = @()
        $state.Optional[$id] = @()
        $state.Mappers["clients/$id"] = @()
    }
    $state.ApiId = @($state.Clients.Values | Where-Object clientId -eq 'DotNetLiguriaCore')[0].id
    $state.SpaId = @($state.Clients.Values | Where-Object clientId -eq 'DotNetLiguriaSpa')[0].id
    $state.ManagementId = @($state.Clients.Values | Where-Object clientId -eq 'realm-management')[0].id
    $state.AccountId = @($state.Clients.Values | Where-Object clientId -eq 'account')[0].id
    foreach ($name in @('view-profile', 'manage-account', 'manage-account-links', 'delete-account')) {
        $state.Counter++
        $state.Roles[$state.AccountId] += @{
            id = ([guid]::new("00000000-0000-0000-0000-$($state.Counter.ToString().PadLeft(12,'0'))")).ToString()
            name = $name; clientRole = $true; composite = $false; containerId = $state.AccountId
        }
    }
    foreach ($name in @('view-users', 'query-users', 'view-clients', 'query-clients', 'manage-users')) {
        $state.Counter++
        $state.Roles[$state.ManagementId] += @{
            id = ([guid]::new("00000000-0000-0000-0000-$($state.Counter.ToString().PadLeft(12,'0'))")).ToString()
            name = $name; clientRole = $true; composite = $false; containerId = $state.ManagementId
        }
    }
    $scopeId = '00000000-0000-0000-0000-000000000004'
    $state.Scopes[$scopeId] = @{ id = $scopeId; name = 'roles'; protocol = 'openid-connect' }
    $state.Mappers["client-scopes/$scopeId"] = @()
    $provisionerId = '00000000-0000-0000-0000-000000000005'
    $state.Clients[$provisionerId] = @{
        id = $provisionerId; clientId = 'dotnetliguria-provisioner'
        protocol = 'openid-connect'; fullScopeAllowed = $false; publicClient = $false
        enabled = $true; serviceAccountsEnabled = $true
    }
    $request = {
        param($Method, $Path, $Body)
        if ($Method -eq 'GET') { $state.Reads++ } else {
            $state.Writes++
            if ($state.FailWrite -and $state.Writes -eq $state.FailWrite) { throw 'Synthetic write failure' }
        }
        if ($Path -match '^clients\?clientId=(.+)$') {
            return @($state.Clients.Values | Where-Object { $_.clientId -ceq $Matches[1] })
        }
        if ($Path -eq 'client-scopes') {
            if ($Method -eq 'GET') { return @($state.Scopes.Values) }
            $state.Counter++
            $id = "00000000-0000-0000-0000-$($state.Counter.ToString().PadLeft(12,'0'))"
            $Body.id = $id
            $state.Scopes[$id] = $Body
            $state.Mappers["client-scopes/$id"] = @()
            return
        }
        if ($Path -match '^clients/([^/]+)/roles(?:\?first=0&max=513|/(.+))?$') {
            $id = $Matches[1]
            if ($Method -eq 'GET') {
                if ($Matches.ContainsKey(2)) { return @($state.Roles[$id] | Where-Object { $_.name -ceq $Matches[2] })[0] }
                return $state.Roles[$id]
            }
            $state.Counter++
            $state.Roles[$id] += @{
                id = "00000000-0000-0000-0000-$($state.Counter.ToString().PadLeft(12,'0'))"
                name = $Body.name; clientRole = $true; composite = $false; containerId = $id
            }
            return
        }
        if ($Path -eq 'clients' -and $Method -eq 'POST') {
            $state.Counter++
            $id = "00000000-0000-0000-0000-$($state.Counter.ToString().PadLeft(12,'0'))"
            $Body.id = $id; $Body.redirectUris = @(); $Body.webOrigins = @()
            $state.Clients[$id] = $Body
            $state.Roles[$id] = @(); $state.Defaults[$id] = @(); $state.Optional[$id] = @()
            $state.Mappers["clients/$id"] = @()
            return
        }
        if ($Path -match '^clients/([^/]+)/service-account-user$') {
            $id = $Matches[1]
            $userId = '00000000-0000-0000-0000-000000000099'
            $state.Users[$userId] = @{ id = $userId; enabled = $true; username = 'service-account-runtime' }
            return $state.Users[$userId]
        }
        if ($Path -match '^clients/([^/]+)/(default|optional)-client-scopes(?:/([^/]+))?$') {
            $id = $Matches[1]; $kind = $Matches[2]
            $collection = if ($kind -eq 'default') { $state.Defaults } else { $state.Optional }
            if ($Method -eq 'GET') { return @($collection[$id] | ForEach-Object { $state.Scopes[$_] }) }
            $scope = $Matches[3]
            if ($Method -eq 'PUT') { $collection[$id] += $scope }
            if ($Method -eq 'DELETE') { $collection[$id] = @($collection[$id] | Where-Object { $_ -cne $scope }) }
            return
        }
        if ($Path -match '^((?:client-scopes|clients)/[^/]+)/protocol-mappers/models(?:/([^/]+))?$') {
            $parent = $Matches[1]
            if ($Method -eq 'GET') { return $state.Mappers[$parent] }
            if ($Method -eq 'POST') {
                $state.Counter++
                $Body.id = "00000000-0000-0000-0000-$($state.Counter.ToString().PadLeft(12,'0'))"
                $state.Mappers[$parent] += $Body
            } else {
                $mapperId = $Matches[2]
                $state.Mappers[$parent] = @($state.Mappers[$parent] | Where-Object { $_.id -cne $mapperId })
                if ($Method -eq 'PUT') { $state.Mappers[$parent] += @($Body) }
            }
            return
        }
        if ($Path -match '^(client-scopes/[^/]+)/scope-mappings$') {
            $parent = $Matches[1]
            $realm = if ($state.ScopeRealmMappings.ContainsKey($parent)) { $state.ScopeRealmMappings[$parent] } else { @() }
            $clients = if ($state.ScopeClientMappings.ContainsKey($parent)) { $state.ScopeClientMappings[$parent] } else { @{} }
            return @{ realmMappings = $realm; clientMappings = $clients }
        }
        if ($Path -match '^(client-scopes/[^/]+)/scope-mappings/realm$' -and $Method -eq 'DELETE') {
            $state.ScopeRealmMappings[$Matches[1]] = @()
            return
        }
        if ($Path -match '^(client-scopes/[^/]+)/scope-mappings/clients/([^/]+)$' -and $Method -eq 'DELETE') {
            $parent = $Matches[1]; $clientId = $Matches[2]
            foreach ($key in @($state.ScopeClientMappings[$parent].Keys)) {
                if ($state.ScopeClientMappings[$parent][$key].id -ceq $clientId) { $state.ScopeClientMappings[$parent].Remove($key) }
            }
            return
        }
        if ($Path -match '^(?:client-scopes|clients)/[^/]+/scope-mappings/clients/[^/]+$' -or
            $Path -match '^(?:groups|users)/[^/]+/role-mappings/clients/[^/]+(?:/composite)?$') {
            if ($Method -eq 'GET') {
                if ($state.Mappings.ContainsKey($Path)) { return $state.Mappings[$Path] }
                return @()
            }
            $current = if ($state.Mappings.ContainsKey($Path)) { @($state.Mappings[$Path]) } else { @() }
            $state.Mappings[$Path] = @($current) + @($Body)
            return
        }
        if ($Path -match '^groups\?search=') { return @($state.Groups.Values) }
        if ($Path -match '^groups/([^/]+)/members\?first=0&max=101$') {
            $groupId = $Matches[1]
            return @($state.Memberships.Keys | Where-Object { $groupId -cin $state.Memberships[$_] } |
                ForEach-Object { $state.Users[$_] })
        }
        if ($Path -eq 'groups' -and $Method -eq 'POST') {
            $state.Counter++
            $id = "00000000-0000-0000-0000-$($state.Counter.ToString().PadLeft(12,'0'))"
            $state.Groups[$id] = @{ id = $id; name = $Body.name; path = '/' + $Body.name }
            return
        }
        if ($Path -match '^users/([^/]+)/groups(?:\?first=0&max=101|/([^/]+))$') {
            $id = $Matches[1]
            if ($Method -eq 'GET') {
                if ($state.Memberships.ContainsKey($id)) { return @($state.Memberships[$id] | ForEach-Object { $state.Groups[$_] }) }
                return @()
            }
            $state.Memberships[$id] = @($Matches[2])
            return
        }
        if ($Path -match '^users/([^/]+)$') { return $state.Users[$Matches[1]] }
        if ($Path -match '^clients/([^/]+)$') {
            if ($Method -eq 'GET') { return $state.Clients[$Matches[1]] }
            $state.Clients[$Matches[1]] = $Body
            return
        }
        if ($Path -match '^client-scopes/([^/]+)$' -and $Method -eq 'PUT') {
            $state.Scopes[$Matches[1]] = $Body
            return
        }
        throw "Unhandled fake endpoint $Method $Path"
    }.GetNewClosure()
    return @{ State = $state; Request = $request }
}

function New-TestPlan($Provider, [switch]$Grant) {
    return New-KeycloakSetupPlan -Request $Provider.Request -Fixture $fixture `
        -RecoveryUserId $recoveryId -ProvisioningClientId 'dotnetliguria-provisioner' -GrantRecoveryAccess:$Grant
}

Test-Case 'Preview is read-only and plans the complete missing setup' {
    $provider = New-FakeProvider
    $plan = New-TestPlan $provider -Grant
    Assert-True ($provider.State.Writes -eq 0) 'Preview wrote to realm'
    Assert-True (@($plan.Actions | Where-Object Label -like 'Create permission *').Count -eq 52) 'Missing role actions'
    Assert-True (@($plan.Actions | Where-Object Label -eq 'Create dedicated runtime permission client').Count -eq 1) 'Missing runtime client action'
}
Test-Case 'Apply is repeatable and preserves existing client configuration' {
    $provider = New-FakeProvider
    $plan = New-TestPlan $provider -Grant
    Invoke-KeycloakSetupPlan -Plan $plan -Request $provider.Request
    $second = New-TestPlan $provider -Grant
    Assert-True ($second.Actions.Count -eq 0) "Not idempotent: $(@($second.Actions | ForEach-Object { $_.Label }) -join ', ')"
    $spa = $provider.State.Clients[$provider.State.SpaId]
    Assert-True (!$spa.fullScopeAllowed -and !$spa.consentRequired) 'SPA remained permissive'
    Assert-True ($spa.attributes.keep -eq 'unchanged') 'Unrelated client attributes changed'
    Assert-True ($spa.redirectUris[0] -eq 'https://localhost:5443/callback') 'Redirect changed'
    Assert-True ($provider.State.Roles[$provider.State.ApiId].Count -eq 52) 'Role catalogue mismatch'
    $scopeId = $second.Aliases.scope
    Assert-True ($provider.State.Scopes[$scopeId].attributes['display.on.consent.screen'] -eq 'false') 'Internal scope shows on consent'
}
Test-Case 'SPA tokens are scoped to exactly the personal-page account roles' {
    $provider = New-FakeProvider
    $plan = New-TestPlan $provider
    $actions = @($plan.Actions | Where-Object Path -eq 'clients/{spa}/scope-mappings/clients/{account}')
    Assert-True ($actions.Count -eq 1) 'Missing SPA account scope action'
    Assert-True ((@($actions[0].Body | ForEach-Object { $_.name }) -join ',') -ceq 'view-profile,manage-account') 'Wrong account roles'
    $path = "clients/$($provider.State.SpaId)/scope-mappings/clients/$($provider.State.AccountId)"
    $provider.State.Mappings[$path] = @(@($provider.State.Roles[$provider.State.AccountId] | Where-Object name -eq 'delete-account'))
    Assert-Fails { New-TestPlan $provider } 'additional account-client roles'
}
Test-Case 'Without explicit recovery flag the tool never grants user/group access' {
    $provider = New-FakeProvider
    $plan = New-TestPlan $provider
    Assert-True (@($plan.Actions | Where-Object { $_.Path -like 'groups/*/role-mappings/*' -or $_.Path -like "users/$recoveryId/groups/*" }).Count -eq 0) 'Implicit recovery grants'
}
Test-Case 'Composite application roles fail during preflight before any write' {
    $provider = New-FakeProvider
    $provider.State.Roles[$provider.State.ApiId] = @(@{
        id = '00000000-0000-0000-0000-000000000050'; name = 'events.read'
        clientRole = $true; composite = $true; containerId = $provider.State.ApiId
    })
    Assert-Fails { New-TestPlan $provider -Grant } 'non-composite'
    Assert-True ($provider.State.Writes -eq 0) 'Preflight conflict caused mutation'
}
Test-Case 'Duplicate permission mappers are not silently removed or overridden' {
    $provider = New-FakeProvider
    $provider.State.Mappers["clients/$($provider.State.SpaId)"] = @(@{
        id = '00000000-0000-0000-0000-000000000051'; name = 'other'
        config = @{ 'claim.name' = 'permissions' }
    })
    Assert-Fails { New-TestPlan $provider } 'dedicated scope also emits'
    Assert-True ($provider.State.Writes -eq 0) 'Mapper conflict caused mutation'
}
Test-Case 'Partial failure is explicit and subsequent preview adopts completed work' {
    $provider = New-FakeProvider
    $plan = New-TestPlan $provider -Grant
    $provider.State.FailWrite = 8
    Assert-Fails { Invoke-KeycloakSetupPlan -Plan $plan -Request $provider.Request } 'Synthetic write failure'
    $provider.State.FailWrite = 0
    $next = New-TestPlan $provider -Grant
    Assert-True ($next.Actions.Count -lt $plan.Actions.Count) 'Completed changes not adopted'
    Invoke-KeycloakSetupPlan -Plan $next -Request $provider.Request
    Assert-True ((New-TestPlan $provider -Grant).Actions.Count -eq 0) 'Partial progress could not resume'
}
Test-Case 'Runtime client cannot reuse the privacy or provisioning identity' {
    $provider = New-FakeProvider
    Assert-Fails {
        New-KeycloakSetupPlan -Request $provider.Request -Fixture $fixture -RecoveryUserId $recoveryId `
            -ProvisioningClientId 'dotnetliguria-provisioner' -RuntimeClientId 'dotnetliguria-privacy-admin'
    } 'must be separate'
}
Test-Case 'Service accounts cannot be selected as human recovery accounts' {
    $provider = New-FakeProvider
    $provider.State.Users[$recoveryId].username = 'service-account-synthetic'
    Assert-Fails { New-TestPlan $provider -Grant } 'enabled human'
    Assert-True ($provider.State.Writes -eq 0) 'Invalid recovery account caused mutation'
}
Test-Case 'Unknown permission scope mappings fail rather than being deleted' {
    $provider = New-FakeProvider
    $plan = New-TestPlan $provider
    Invoke-KeycloakSetupPlan -Plan $plan -Request $provider.Request
    $provider.State.Mappings["client-scopes/$($plan.Aliases.scope)/scope-mappings/clients/$($provider.State.ApiId)"] += @{
        id = '00000000-0000-0000-0000-000000000052'; name = 'unreviewed.permission'
    }
    $before = $provider.State.Writes
    Assert-Fails { New-TestPlan $provider } 'unknown API roles'
    Assert-True ($before -eq $provider.State.Writes) 'Unexpected grant was mutated'
}
Test-Case 'Existing runtime client credentials are never rotated or overwritten' {
    $provider = New-FakeProvider
    $plan = New-TestPlan $provider
    Invoke-KeycloakSetupPlan -Plan $plan -Request $provider.Request
    $client = $provider.State.Clients[$plan.Aliases.runtime]
    $client.attributes = @{ untouched = 'yes' }
    $client.fullScopeAllowed = $true
    $next = New-TestPlan $provider
    $update = @($next.Actions | Where-Object { $_.Path -eq 'clients/{runtime}' })[0]
    Assert-True (!$update.Body.ContainsKey('secret')) 'Credential included in client update'
    Assert-True ($update.Body.attributes.untouched -eq 'yes') 'Runtime attributes lost'
    Assert-True (@($next.Actions | Where-Object { $_.Path -like '*client-secret*' }).Count -eq 0) 'Secret regeneration action'
}
Test-Case 'Recovery grants cannot silently elevate other existing group members' {
    $provider = New-FakeProvider
    $plan = New-TestPlan $provider
    Invoke-KeycloakSetupPlan -Plan $plan -Request $provider.Request
    $other = '00000000-0000-0000-0000-000000000088'
    $provider.State.Users[$other] = @{ id = $other; username = 'other'; enabled = $true }
    $provider.State.Memberships[$other] = @($plan.Aliases.recoveryGroup)
    Assert-Fails { New-TestPlan $provider -Grant } 'contains other users'
}
Test-Case 'Optional permission scope is promoted without removing other defaults' {
    $provider = New-FakeProvider
    $plan = New-TestPlan $provider
    Invoke-KeycloakSetupPlan -Plan $plan -Request $provider.Request
    $provider.State.Defaults[$provider.State.SpaId] = @('00000000-0000-0000-0000-000000000004')
    $provider.State.Optional[$provider.State.SpaId] = @($plan.Aliases.scope)
    $next = New-TestPlan $provider
    Invoke-KeycloakSetupPlan -Plan $next -Request $provider.Request
    Assert-True ('00000000-0000-0000-0000-000000000004' -cin $provider.State.Defaults[$provider.State.SpaId]) 'Unrelated default scope removed'
    Assert-True ($plan.Aliases.scope -cin $provider.State.Defaults[$provider.State.SpaId]) 'Permission scope not made default'
    Assert-True ($provider.State.Optional[$provider.State.SpaId].Count -eq 0) 'Optional attachment not removed'
}
Test-Case 'Provisioner must also keep Full Scope Allowed OFF' {
    $provider = New-FakeProvider
    $provider.State.Clients['00000000-0000-0000-0000-000000000005'].fullScopeAllowed = $true
    Assert-Fails { New-TestPlan $provider } 'Full Scope Allowed OFF'
    Assert-True ($provider.State.Writes -eq 0) 'Provisioner scope violation caused mutation'
}
Test-Case 'Read failure aborts preflight without mutations' {
    $request = { param($Method, $Path, $Body); throw 'Synthetic permission denied HTTP403' }
    Assert-Fails {
        New-KeycloakSetupPlan -Request $request -Fixture $fixture -RecoveryUserId $recoveryId `
            -ProvisioningClientId 'dotnetliguria-provisioner'
    } 'HTTP403'
}
Test-Case 'Unsafe issuers are rejected without network access' {
    $secret = ConvertTo-SecureString 'synthetic-test-input' -AsPlainText -Force
    foreach ($issuer in @('http://example.test/realms/Test', 'https://example.test:8443/realms/Test',
        'https://example.test/realms/Test/', 'https://example.test/realms/Test?x=1')) {
        Assert-Fails { New-KeycloakSetupConnection -Issuer $issuer -ClientId 'test' -ClientSecret $secret } 'canonical HTTPS'
    }
    Test-Case 'Explicit scope repair removes only foreign eligibility and never user assignments' {
        $provider = New-FakeProvider
        $plan = New-TestPlan $provider
        Invoke-KeycloakSetupPlan -Plan $plan -Request $provider.Request
        $parent = "client-scopes/$($plan.Aliases.scope)"
        $provider.State.ScopeRealmMappings[$parent] = @(@{ id = '00000000-0000-0000-0000-000000000070'; name = 'default-roles-test' })
        $provider.State.ScopeClientMappings[$parent] = @{
            'realm-management' = @{
                id = $provider.State.ManagementId; client = 'realm-management'
                mappings = @(@{ id = '00000000-0000-0000-0000-000000000071'; name = 'realm-admin' })
            }
        }
        Assert-Fails { New-TestPlan $provider } 'realm-role mappings'
        $repair = New-KeycloakSetupPlan -Request $provider.Request -Fixture $fixture -RecoveryUserId $recoveryId `
            -ProvisioningClientId 'dotnetliguria-provisioner' -RepairPermissionScope
        $deletes = @($repair.Actions | Where-Object Method -eq 'DELETE')
        Assert-True ($deletes.Count -eq 2) 'Expected only two eligibility deletions'
        Assert-True (@($deletes | Where-Object { $_.Path -notlike 'client-scopes/{scope}/scope-mappings/*' }).Count -eq 0) 'Repair targeted assignments outside scope'
        Invoke-KeycloakSetupPlan -Plan $repair -Request $provider.Request
        Assert-True ((New-TestPlan $provider).Actions.Count -eq 0) 'Repaired scope not converged'
    }
    Test-Case 'Explicit legacy SPA cleanup preserves current and unrelated mappers' {
        $provider = New-FakeProvider
        $plan = New-TestPlan $provider
        Invoke-KeycloakSetupPlan -Plan $plan -Request $provider.Request
        $parent = "clients/$($provider.State.SpaId)"
        $provider.State.Mappers[$parent] = @(
            @{ id = '00000000-0000-0000-0000-000000000080'; name = 'realm roles'
                protocolMapper = 'oidc-usermodel-realm-role-mapper'; config = @{ 'claim.name' = 'roles' } },
            @{ id = '00000000-0000-0000-0000-000000000081'; name = 'audience'
                protocolMapper = 'oidc-audience-mapper'; config = @{
                    'included.client.audience' = 'DotNetLiguriaCore'; 'access.token.claim' = 'true'
                    'id.token.claim' = 'false'; 'userinfo.token.claim' = 'false' } },
            @{ id = '00000000-0000-0000-0000-000000000082'; name = 'acr loa level'
                protocolMapper = 'oidc-acr-mapper'; config = @{} }
        )
        Assert-True ((New-TestPlan $provider).Actions.Count -eq 0) 'Legacy removal was not opt-in'
        $arguments = @{
            Request = $provider.Request; Fixture = $fixture; RecoveryUserId = $recoveryId
            ProvisioningClientId = 'dotnetliguria-provisioner'; RemoveLegacySpaMappers = $true
        }
        $cleanup = New-KeycloakSetupPlan @arguments
        Assert-True ($cleanup.Actions.Count -eq 2) 'Expected only two mapper deletions'
        Assert-True (@($cleanup.Actions | Where-Object Method -ne 'DELETE').Count -eq 0) 'Unexpected cleanup mutation'
        Invoke-KeycloakSetupPlan -Plan $cleanup -Request $provider.Request
        Assert-True ($provider.State.Mappers[$parent].Count -eq 1) 'Unrelated SPA mapper removed'
        Assert-True ($provider.State.Mappers[$parent][0].name -ceq 'acr loa level') 'MFA mapper was not preserved'
        Assert-True ((New-KeycloakSetupPlan @arguments).Actions.Count -eq 0) 'Cleanup did not converge'
        Assert-True ($provider.State.Mappers["client-scopes/$($plan.Aliases.scope)"].Count -eq 2) 'Canonical mappers changed'
    }
    Test-Case 'Legacy cleanup preserves a custom audience and a different realm-role claim' {
        $provider = New-FakeProvider
        $plan = New-TestPlan $provider
        Invoke-KeycloakSetupPlan -Plan $plan -Request $provider.Request
        $provider.State.Mappers["clients/$($provider.State.SpaId)"] = @(
            @{ id = '00000000-0000-0000-0000-000000000083'; name = 'audience'
                protocolMapper = 'oidc-audience-mapper'; config = @{
                    'included.client.audience' = 'DotNetLiguriaCore'; 'included.custom.audience' = 'another-api'
                    'access.token.claim' = 'true' } },
            @{ id = '00000000-0000-0000-0000-000000000084'; name = 'realm roles'
                protocolMapper = 'oidc-usermodel-realm-role-mapper'; config = @{ 'claim.name' = 'custom_roles' } }
        )
        $cleanup = New-KeycloakSetupPlan -Request $provider.Request -Fixture $fixture -RecoveryUserId $recoveryId `
            -ProvisioningClientId 'dotnetliguria-provisioner' -RemoveLegacySpaMappers
        Assert-True ($cleanup.Actions.Count -eq 0) 'Cleanup removed a non-legacy claim or custom audience'
    }
    Test-Case 'Server omission of an empty role prefix does not cause permanent mapper drift' {
        $provider = New-FakeProvider
        $plan = New-TestPlan $provider
        Invoke-KeycloakSetupPlan -Plan $plan -Request $provider.Request
        $mapper = @($provider.State.Mappers["client-scopes/$($plan.Aliases.scope)"] |
            Where-Object name -eq 'application-permissions')[0]
        $mapper.config.Remove('usermodel.clientRoleMapping.rolePrefix')
        Assert-True ((New-TestPlan $provider).Actions.Count -eq 0) 'Empty mapper prefix causes perpetual update'
        $mapper.config['usermodel.clientRoleMapping.rolePrefix'] = 'unexpected-'
        Assert-True ((New-TestPlan $provider).Actions.Count -eq 1) 'Nonempty wrong prefix was ignored'
    }
}
Write-Host "$script:passed offline provisioning tests passed. No network, provider or database was used."
