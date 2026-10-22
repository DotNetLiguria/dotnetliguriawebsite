#requires -Version 7.4
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ContainerName,
    [switch]$Apply,
    [switch]$RepairAssetFolders
)

$ErrorActionPreference = 'Stop'
$previousConnection = $env:DotNetLiguriaDatabase__ConnectionString
$previousDatabase = $env:DotNetLiguriaDatabase__DatabaseName
Push-Location $PSScriptRoot
try {
    $mounts = & docker inspect $ContainerName --format '{{json .Mounts}}' | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or !($mounts | Where-Object Name -eq 'dotnetliguria-aspire-mongo')) {
        throw 'Expected the existing local Aspire MongoDB volume.'
    }
    $password = & docker exec $ContainerName printenv MONGO_INITDB_ROOT_PASSWORD
    if ($LASTEXITCODE -ne 0 -or !$password) { throw 'Cannot read local MongoDB credentials.' }
    $username = & docker exec $ContainerName printenv MONGO_INITDB_ROOT_USERNAME
    if ($LASTEXITCODE -ne 0 -or !$username) { throw 'Cannot read local MongoDB username.' }
    $binding = & docker port $ContainerName 27017
    if ($LASTEXITCODE -ne 0 -or $binding -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Expected a single loopback port binding.' }
    $port = $Matches[1]
    $env:DotNetLiguriaDatabase__DatabaseName = 'DotNetLiguriaAspire'
    $env:DotNetLiguriaDatabase__ConnectionString = "mongodb://$([uri]::EscapeDataString($username)):$([uri]::EscapeDataString($password))@127.0.0.1:$port/?authSource=admin&tls=true&tlsInsecure=true"
    $arguments = @('--from-json', '--update-existing')
    if ($RepairAssetFolders) { $arguments += '--repair-asset-folders' }
    if (!$Apply) { $arguments += '--dry-run' }
    & dotnet run --project DataMigration.csproj -c Release -- @arguments
    if ($LASTEXITCODE -ne 0) { throw 'DataMigration failed.' }
}
finally {
    $env:DotNetLiguriaDatabase__ConnectionString = $previousConnection
    $env:DotNetLiguriaDatabase__DatabaseName = $previousDatabase
    $password = $null
    Pop-Location
}
