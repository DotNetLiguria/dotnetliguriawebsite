[CmdletBinding()]
param(
    [string]$InputFile,
    [string]$ProjectFile = (Join-Path $PSScriptRoot '..\src\dotnetliguriawebsite\DotNetLiguriaCore\DotNetLiguriaCore.csproj'),
    [string]$TargetDirectory = (Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)) 'DotNetLiguria\configuration'),
    [switch]$DeployToLxc
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$requiredKeys = @(
    'AuthServer__ClientSecret',
    'AuthServer__ClientId',
    'Privacy__ProtectedStorageApproved',
    'Privacy__IdentityAttributePermissionsApproved',
    'Privacy__AdminClientSecret',
    'Privacy__AdminClientId',
    'PermissionDirectory__ServiceClientSecret',
    'PermissionDirectory__ServiceClientId',
    'PermissionDirectory__ProtectedGroupIds__0',
    'PermissionDirectory__ProtectedGroupIds__1',
    'PermissionDirectory__Issuer',
    'PermissionDirectory__InvitationRedirectUri',
    'PermissionDirectory__InvitationClientId',
    'PermissionDirectory__InvitationLifespanSeconds',
    'PermissionDirectory__BoardGroupId',
    'PermissionDirectory__ApplicationClientId',
    'PermissionDirectory__AllowedInvitationRedirectUris__0',
    'PermissionDirectory__AllowedIdentityHost',
    'Newsletters__SmtpHost',
    'Newsletters__SmtpPort',
    'Newsletters__SmtpUseStartTls',
    'Newsletters__SmtpUserName',
    'Newsletters__SmtpPassword',
    'Newsletters__SenderAddress',
    'Newsletters__DefaultTestAddress'
)
$optionalKeys = @(
    'Eventbrite__AccessToken',
    'Kestrel__Endpoints__Https__Certificate__Password'
)
$allowedKeys = $requiredKeys + $optionalKeys
$nonEmptyKeys = $requiredKeys | Where-Object {
    $_ -notin @(
        'Newsletters__DefaultTestAddress',
        'Newsletters__SmtpUserName',
        'Newsletters__SmtpPassword'
    )
}

function Add-ConfigurationValue {
    param(
        [hashtable]$Values,
        [string]$Key,
        [AllowEmptyString()]
        [string]$Value
    )

    if ($allowedKeys -notcontains $Key) {
        return
    }
    if ($nonEmptyKeys -contains $Key -and [string]::IsNullOrWhiteSpace($Value)) {
        throw "Configuration key $Key must not be empty."
    }
    if ($Values.ContainsKey($Key)) {
        throw "Duplicate configuration key: $Key"
    }

    $Values[$Key] = $Value
}

function Deploy-ConfigurationToLxc {
    param(
        [hashtable]$Values,
        [string[]]$RequiredKeys,
        [string[]]$OptionalKeys
    )

    Get-Command ssh -ErrorAction Stop | Out-Null

    $remoteHost = Read-Host 'LXC SSH host'
    $remoteUser = Read-Host 'LXC SSH username'
    if ($remoteHost -notmatch '^[A-Za-z0-9][A-Za-z0-9.-]*$') {
        throw 'LXC SSH host contains unsupported characters.'
    }
    if ($remoteUser -notmatch '^[A-Za-z_][A-Za-z0-9_-]*$') {
        throw 'LXC SSH username contains unsupported characters.'
    }

    $remoteTarget = "$remoteUser@$remoteHost"
    $remoteDirectory = "/tmp/dotnetliguria-config-$([Guid]::NewGuid().ToString('N'))"
    $temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "dotnetliguria-config-$([Guid]::NewGuid().ToString('N'))"
    $temporaryArchive = "$temporaryDirectory.tar"
    $configurationKeys = $RequiredKeys + @($OptionalKeys | Where-Object { $Values.ContainsKey($_) })
    $configurationLines = foreach ($key in $configurationKeys) {
        $value = $Values[$key]
        if ($value.Contains("`r") -or $value.Contains("`n")) {
            throw "Configuration key $key contains an unsupported line break."
        }
        "$key=$value"
    }

    try {
        [System.IO.Directory]::CreateDirectory($temporaryDirectory) | Out-Null
        [System.IO.File]::WriteAllText(
            (Join-Path $temporaryDirectory 'configuration.env'),
            ([string]::Join("`n", $configurationLines) + "`n"),
            [System.Text.UTF8Encoding]::new($false))
        $remoteProvisioner = Join-Path $PSScriptRoot 'provision-dotnetliguria-config.sh'
        [System.IO.File]::Copy(
            $remoteProvisioner,
            (Join-Path $temporaryDirectory 'provision-dotnetliguria-config.sh'))
        [System.Formats.Tar.TarFile]::CreateFromDirectory($temporaryDirectory, $temporaryArchive, $false)
        $archiveContent = [Convert]::ToBase64String(
            [System.IO.File]::ReadAllBytes($temporaryArchive),
            [System.Base64FormattingOptions]::InsertLineBreaks)
        $provisionCommand = if ($remoteUser -eq 'root') {
            "sh `"`$remote_directory/provision-dotnetliguria-config.sh`" `"`$remote_directory/configuration.env`""
        }
        else {
            "sudo -n sh `"`$remote_directory/provision-dotnetliguria-config.sh`" `"`$remote_directory/configuration.env`""
        }
        $remoteCommand = "set -eu; remote_directory='$remoteDirectory'; encoded=`"`$remote_directory/configuration.base64`"; archive=`"`$remote_directory/configuration.tar`"; cleanup() { rm -rf `"`$remote_directory`"; }; trap cleanup EXIT HUP INT TERM; mkdir -m 700 `"`$remote_directory`"; tr -d '\015\012' > `"`$encoded`"; base64 -d `"`$encoded`" > `"`$archive`"; tar -tf `"`$archive`" >/dev/null; tar -xf `"`$archive`" -C `"`$remote_directory`"; $provisionCommand"
        $archiveContent | & ssh $remoteTarget $remoteCommand
        if ($LASTEXITCODE -ne 0) {
            throw 'The remote configuration provisioner failed.'
        }
    }
    finally {
        if (Test-Path -LiteralPath $temporaryDirectory) {
            Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
        }
        if (Test-Path -LiteralPath $temporaryArchive) {
            Remove-Item -LiteralPath $temporaryArchive -Force
        }
    }

    Write-Output 'Provisioned remote key-per-file settings at /docker_data/global_secrets/dotnetliguria.'
}

$values = @{}
if ($InputFile) {
    if (-not (Test-Path -LiteralPath $InputFile -PathType Leaf)) {
        throw "Configuration input file does not exist: $InputFile"
    }

    foreach ($line in [System.IO.File]::ReadLines($InputFile)) {
        if ($line.Length -eq 0 -or $line.StartsWith('#')) {
            continue
        }

        $separator = $line.IndexOf('=')
        if ($separator -lt 1) {
            throw 'Invalid configuration entry. Expected KEY=value.'
        }

        $key = $line.Substring(0, $separator)
        $value = $line.Substring($separator + 1)
        if ($allowedKeys -notcontains $key) {
            throw "Unsupported configuration key: $key"
        }

        Add-ConfigurationValue -Values $values -Key $key -Value $value
    }
}
else {
    if (-not (Test-Path -LiteralPath $ProjectFile -PathType Leaf)) {
        throw "Website project file does not exist: $ProjectFile"
    }

    [xml]$project = [System.IO.File]::ReadAllText($ProjectFile)
    $userSecretsId = $project.Project.PropertyGroup.UserSecretsId | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($userSecretsId)) {
        throw "The website project does not define a UserSecretsId: $ProjectFile"
    }

    $userSecretsDirectory = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData)) "Microsoft\UserSecrets\$userSecretsId"
    $userSecretsFile = Join-Path $userSecretsDirectory 'secrets.json'
    if (-not (Test-Path -LiteralPath $userSecretsFile -PathType Leaf)) {
        throw "Development user-secrets file does not exist: $userSecretsFile. Supply -InputFile instead."
    }

    $userSecrets = [System.IO.File]::ReadAllText($userSecretsFile) | ConvertFrom-Json
    foreach ($property in $userSecrets.PSObject.Properties) {
        $key = $property.Name.Replace(':', '__')
        Add-ConfigurationValue -Values $values -Key $key -Value ([string]$property.Value)
    }
}

foreach ($key in $requiredKeys) {
    if (-not $values.ContainsKey($key)) {
        throw "Missing required configuration key: $key"
    }
}

[System.IO.Directory]::CreateDirectory($TargetDirectory) | Out-Null
$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
foreach ($key in $requiredKeys) {
    $temporaryPath = Join-Path $TargetDirectory ".$key.$([Guid]::NewGuid().ToString('N')).tmp"
    $destinationPath = Join-Path $TargetDirectory $key
    try {
        [System.IO.File]::WriteAllText($temporaryPath, $values[$key], $utf8WithoutBom)
        Move-Item -LiteralPath $temporaryPath -Destination $destinationPath -Force
    }
    finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force
        }
    }
}

foreach ($key in $optionalKeys) {
    $destinationPath = Join-Path $TargetDirectory $key
    if ($values.ContainsKey($key)) {
        $temporaryPath = Join-Path $TargetDirectory ".$key.$([Guid]::NewGuid().ToString('N')).tmp"
        try {
            [System.IO.File]::WriteAllText($temporaryPath, $values[$key], $utf8WithoutBom)
            Move-Item -LiteralPath $temporaryPath -Destination $destinationPath -Force
        }
        finally {
            if (Test-Path -LiteralPath $temporaryPath) {
                Remove-Item -LiteralPath $temporaryPath -Force
            }
        }
    }
    elseif (Test-Path -LiteralPath $destinationPath) {
        Remove-Item -LiteralPath $destinationPath -Force
    }
}

$configuredCount = $requiredKeys.Count + @($optionalKeys | Where-Object { $values.ContainsKey($_) }).Count
Write-Output "Provisioned $configuredCount key-per-file settings at $TargetDirectory."
if ($DeployToLxc) {
    Deploy-ConfigurationToLxc -Values $values -RequiredKeys $requiredKeys -OptionalKeys $optionalKeys
}
