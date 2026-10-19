#requires -Version 7.4
[CmdletBinding()]
param(
    [ValidateSet('Preview', 'Apply', 'Verify', 'InstallLocalSecrets')][string]$Mode = 'Preview',
    [string]$Issuer = 'https://hello.vevy.com/realms/DotNetLiguria',
    [string]$ProvisioningClientId = 'dotnetliguria-provisioner',
    [string]$RuntimeClientId = 'dotnetliguria-permission-admin',
    [Parameter(Mandatory)][guid]$RecoveryUserId,
    [string]$RecoveryGroupName = 'Application recovery operators',
    [string]$ConfirmRealm,
    [switch]$GrantRecoveryAccess,
    [switch]$RepairPermissionScope,
    [switch]$RemoveLegacySpaMappers,
    [switch]$UseStoredProvisioningSecret,
    [securestring]$ProvisioningSecret
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'KeycloakProvisioning.psm1') -Force
$root = Split-Path $PSScriptRoot -Parent
$project = Join-Path $root 'src/dotnetliguriawebsite/DotNetLiguriaCore/DotNetLiguriaCore.csproj'
$fixture = Get-Content (Join-Path $root 'keycloak/dev/realm-dotnetliguria.json') -Raw | ConvertFrom-Json -AsHashtable
if ($UseStoredProvisioningSecret) {
    if ($ProvisioningSecret) { throw 'Choose either the explicit SecureString or stored provisioning secret, not both.' }
    $storedJson = & dotnet user-secrets list --id dotnetliguria-provisioning --json
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect provisioning secret storage.' }
    $stored = ($storedJson -join "`n") | ConvertFrom-Json -AsHashtable
    if (!$stored.ContainsKey('KeycloakProvisioning:ClientSecret') -or
        [string]::IsNullOrWhiteSpace([string]$stored['KeycloakProvisioning:ClientSecret'])) {
        throw 'Store KeycloakProvisioning:ClientSecret in the separate dotnetliguria-provisioning user-secret store first.'
    }
    $ProvisioningSecret = ConvertTo-SecureString ([string]$stored['KeycloakProvisioning:ClientSecret']) -AsPlainText -Force
    $stored = $null
    $storedJson = $null
}
if (!$ProvisioningSecret) {
    $ProvisioningSecret = Read-Host "Secret for provisioning client $ProvisioningClientId (hidden)" -AsSecureString
}
$connection = $null
try {
    $connection = New-KeycloakSetupConnection -Issuer $Issuer -ClientId $ProvisioningClientId -ClientSecret $ProvisioningSecret
    $request = $connection.Request
    if ($Mode -eq 'Apply' -and $ConfirmRealm -cne $connection.Realm) {
        throw 'Apply requires -ConfirmRealm with the exact realm name. No realm changes made.'
    }
    $arguments = @{
        Request = $request; Fixture = $fixture; RecoveryUserId = $RecoveryUserId
        ProvisioningClientId = $ProvisioningClientId; RuntimeClientId = $RuntimeClientId
        RecoveryGroupName = $RecoveryGroupName; GrantRecoveryAccess = $GrantRecoveryAccess
        RepairPermissionScope = $RepairPermissionScope
        RemoveLegacySpaMappers = $RemoveLegacySpaMappers
    }
    $plan = New-KeycloakSetupPlan @arguments
    Write-Host "Realm: $($connection.Realm); mode: $Mode; planned operations: $($plan.Actions.Count)"
    Write-Host "Application clients: DotNetLiguriaCore, DotNetLiguriaSpa; runtime client: $RuntimeClientId; recovery group: $RecoveryGroupName"
    foreach ($action in $plan.Actions) { Write-Host "  $($action.Method): $($action.Label)" }
    if (!$GrantRecoveryAccess) {
        Write-Host 'Recovery grants/membership are NOT managed. Use -GrantRecoveryAccess only for a deliberately trusted full-access human account.'
    }
    if ($Mode -eq 'Preview') {
        Write-Host 'Preview complete. Only authentication and read requests were made; no realm configuration changed.'
        return
    }
    if ($Mode -eq 'Apply') {
        Write-Host 'Applying without deleting unrelated objects or rotating existing secrets. A failure may leave partial progress; rerun Preview.'
        Invoke-KeycloakSetupPlan -Plan $plan -Request $request
        $plan = New-KeycloakSetupPlan @arguments
    }
    if ($plan.Actions.Count) {
        throw 'Verification found pending configuration operations. Review Preview and apply before installing runtime configuration.'
    }
    Write-Host 'Configuration reconciliation verified: no remaining operations. This is NOT proof of interactive token issuance or recent MFA.'
    $secretResponse = & $request 'GET' "clients/$($plan.Aliases.runtime)/client-secret" $null
    if (!$secretResponse -or !([string]$secretResponse.value)) { throw 'Runtime client has no usable secret. No secret rotation was attempted.' }
    $runtimeSecret = ConvertTo-SecureString ([string]$secretResponse.value) -AsPlainText -Force
    $runtimeConnection = $null
    try {
        $runtimeConnection = New-KeycloakSetupConnection -Issuer $Issuer -ClientId $RuntimeClientId -ClientSecret $runtimeSecret
        $runtimeRequest = $runtimeConnection.Request
        $clients = @(& $runtimeRequest 'GET' 'clients?clientId=DotNetLiguriaCore' $null)
        if ($clients.Count -ne 1 -or $clients[0].id -cne $plan.Aliases.api) {
            throw 'Runtime credential cannot resolve the exact application client.'
        }
        $effective = @(& $runtimeRequest 'GET' "users/$RecoveryUserId/role-mappings/clients/$($plan.Aliases.api)/composite" $null)
        if ($GrantRecoveryAccess) {
            $expected = @($fixture.roles.client.DotNetLiguriaCore | ForEach-Object { $_.name })
            if (@($expected | Where-Object { $_ -cnotin @($effective | ForEach-Object { $_.name }) }).Count) {
                throw 'Recovery account does not have the full effective application catalogue.'
            }
        }
        Write-Host 'Runtime client credentials and application-role inspection verified against the realm.'
    } finally {
        if ($runtimeConnection) { $runtimeConnection.Client.Dispose() }
        $runtimeSecret = $null
    }
    Write-Host "PermissionDirectory__Issuer=$Issuer"
    Write-Host "PermissionDirectory__AllowedIdentityHost=$($connection.Hostname)"
    Write-Host "PermissionDirectory__ServiceClientId=$RuntimeClientId"
    Write-Host 'PermissionDirectory__ServiceClientSecret=<not displayed>'
    Write-Host 'PermissionDirectory__ApplicationClientId=DotNetLiguriaCore'
    Write-Host "PermissionDirectory__ProtectedGroupIds__0=$($plan.Aliases.recoveryGroup)"
    if ($Mode -ne 'InstallLocalSecrets') {
        Write-Host 'To install credentials locally without displaying them, run Mode InstallLocalSecrets with the same arguments. Production requires your approved secret store.'
        return
    }
    $existingJson = & dotnet user-secrets list --project $project --json
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect website user-secret key configuration.' }
    $existing = ($existingJson -join "`n") | ConvertFrom-Json -AsHashtable
    if ($existing.ContainsKey('Privacy:AdminClientId') -and $existing['Privacy:AdminClientId'] -ceq $RuntimeClientId -or
        $existing.ContainsKey('Privacy:AdminClientSecret') -and $existing['Privacy:AdminClientSecret'] -ceq $secretResponse.value) {
        throw 'Runtime permission credentials overlap the privacy credentials. No local settings changed.'
    }
    $settings = @{
        'PermissionDirectory:Issuer' = $Issuer
        'PermissionDirectory:AllowedIdentityHost' = $connection.Hostname
        'PermissionDirectory:ServiceClientId' = $RuntimeClientId
        'PermissionDirectory:ServiceClientSecret' = [string]$secretResponse.value
        'PermissionDirectory:ApplicationClientId' = 'DotNetLiguriaCore'
    }
    $protectedIds = @($existing.Keys | Where-Object { $_ -match '^PermissionDirectory:ProtectedGroupIds:\d+$' } |
        Sort-Object | ForEach-Object { $existing[$_] })
    if ($plan.Aliases.recoveryGroup -cnotin $protectedIds) { $protectedIds += $plan.Aliases.recoveryGroup }
    for ($index = 0; $index -lt $protectedIds.Count; $index++) {
        $id = [guid]::Empty
        if (![guid]::TryParse([string]$protectedIds[$index], [ref]$id)) {
            throw 'An existing protected-group ID is invalid. Resolve it before installing configuration.'
        }
        $settings["PermissionDirectory:ProtectedGroupIds:$index"] = $id.ToString('D')
    }
    # Send secret JSON through stdin, never command-line arguments or output files.
    $start = [System.Diagnostics.ProcessStartInfo]::new('dotnet')
    $start.UseShellExecute = $false
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($argument in @('user-secrets', 'set', '--project', $project)) { $start.ArgumentList.Add($argument) }
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $start
    try {
        if (!$process.Start()) { throw 'Could not start user-secret installation.' }
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $process.StandardInput.WriteLine((ConvertTo-Json -InputObject $settings -Compress))
        $process.StandardInput.Close()
        if (!$process.WaitForExit(30000)) {
            $process.Kill($true)
            throw 'Local configuration installation timed out. Inspect key presence before retrying.'
        }
        $null = $stdout.GetAwaiter().GetResult()
        $null = $stderr.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw 'Local configuration installation failed; no secret output was recorded.' }
    } finally { $process.Dispose() }
    Write-Host 'Website Development user secrets installed. Existing unrelated settings and protected group IDs preserved. Restart the backend, then sign out/in.'
} catch {
    # Deliberately do not print provider bodies, request content or credentials.
    Write-Error $_.Exception.Message -ErrorAction Continue
    exit 1
} finally {
    if ($connection) { $connection.Client.Dispose() }
    $ProvisioningSecret = $null
    $secretResponse = $null
    $settings = $null
}
