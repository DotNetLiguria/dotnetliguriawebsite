#requires -Version 7.4
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    $nugetText = & dotnet list DotNetLiguria.slnx package --vulnerable --include-transitive --format json
    if ($LASTEXITCODE -ne 0) { throw 'NuGet advisory query failed.' }
    $nuget = ($nugetText -join "`n") | ConvertFrom-Json
    if ($nuget.problems) { throw 'NuGet advisory query reported problems.' }
    $vulnerable = @($nuget.projects | ForEach-Object { $_.frameworks } |
        ForEach-Object { $_.topLevelPackages; $_.transitivePackages } |
        Where-Object { $_ -and $_.vulnerabilities })
    if ($vulnerable.Count) { throw "NuGet advisory query found $($vulnerable.Count) vulnerable package references." }

    Push-Location (Join-Path $root 'src/dotnetliguriaspa')
    try {
        & npm audit --omit=dev --audit-level=moderate
        if ($LASTEXITCODE -ne 0) { throw 'Production npm advisory check failed.' }
    }
    finally { Pop-Location }
    Write-Host 'No known vulnerable runtime npm/NuGet dependencies reported by the configured advisory services.'
}
finally { Pop-Location }
