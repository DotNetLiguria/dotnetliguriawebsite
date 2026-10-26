#requires -Version 7.4
[CmdletBinding()]
param([string]$ArtifactDirectory, [switch]$KeepArtifacts)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path $PSScriptRoot -Parent
$output = Join-Path $root '.artifacts/publish'
$verificationPassed = $false
$speakerFixtures = Join-Path $root 'tests/RepositoryRules.Tests/TestData/SpeakerAssets'
$fixtureContentRoot = Join-Path $speakerFixtures 'Contents'
$fixtureManifest = Join-Path $speakerFixtures 'speakerAssetSources.json'
$fixtureSpeakers = Join-Path $speakerFixtures 'workshopSpeakers.json'
$projects = [ordered]@{
    website = 'src/dotnetliguriawebsite/DotNetLiguriaCore/DotNetLiguriaCore.csproj'
    dataMigration = 'src/dotnetliguriawebsite/DataMigration/DataMigration.csproj'
}

function Assert-NoPrivateArtifacts([string]$Directory) {
    if (!(Test-Path $Directory -PathType Container)) { throw 'Artifact directory does not exist.' }
    $forbidden = @(Get-ChildItem $Directory -File -Recurse -Force | Where-Object {
        $_.Name -match '^\.env($|\.)|privatekey|^secrets.*\.(json|ya?ml)$|\.(pfx|p12|pem|key|bson)$|^appsettings\.(Development|.*\.local)\.json$' -or
        $_.FullName -match '[\\/](Backups|PrivateUploads|\.privacy)[\\/]' -or
        ($_.FullName -match '[\\/]wwwroot[\\/]assets[\\/]' -and $_.Extension -eq '.map')
    })
    if ($forbidden.Count) {
        throw "Published website contains forbidden private configuration, keys or data files ($($forbidden.Count) files)."
    }
    foreach ($relative in @('Contents', 'RecoveryData', 'json')) {
        if (Test-Path -LiteralPath (Join-Path $Directory $relative)) {
            throw "Published website contains runtime content or historical migration data: $relative"
        }
    }
}

if ($ArtifactDirectory) {
    Assert-NoPrivateArtifacts $ArtifactDirectory
    Write-Host 'Artifact confidentiality check passed.'
    return
}

Push-Location $root
try {
    if (!(Test-Path -LiteralPath $fixtureContentRoot -PathType Container)) {
        throw 'Committed speaker asset test fixture is missing.'
    }
    foreach ($name in $projects.Keys) {
        $destination = Join-Path $output $name
        $resolvedRoot = [IO.Path]::GetFullPath($root)
        $resolvedDestination = [IO.Path]::GetFullPath($destination)
        if (!$resolvedDestination.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Publish output path escapes the repository.'
        }
        if (Test-Path $destination) { Remove-Item $destination -Recurse -Force }
        & dotnet publish $projects[$name] -c Release --no-restore -o $destination --nologo -v minimal -m:2 -nr:false
        if ($LASTEXITCODE -ne 0) { throw "Publish failed: $name" }
        if (!(Get-ChildItem $destination -Filter '*.runtimeconfig.json' -File)) { throw "Missing executable artifact: $name" }
    }

    $dist = Join-Path $root 'src/dotnetliguriaspa/dist'
    $website = Join-Path $output 'website'
    Assert-NoPrivateArtifacts $website
    & (Join-Path $PSScriptRoot 'verify-speaker-assets.ps1') -ContentRoot $fixtureContentRoot -ManifestPath $fixtureManifest -SpeakerExportPath $fixtureSpeakers
    $assets = @(Get-ChildItem $dist -File -Recurse)
    if (!$assets.Count -or !(Test-Path "$dist/index.html")) { throw 'Missing Vite output' }
    foreach ($asset in $assets) {
        $relative = [IO.Path]::GetRelativePath($dist, $asset.FullName)
        $published = Join-Path $website "wwwroot/$relative"
        if (!(Test-Path $published) -or (Get-FileHash $asset.FullName).Hash -ne (Get-FileHash $published).Hash) {
            throw "Published SPA asset mismatch: $relative"
        }
    }
    $verificationPassed = $true
    Write-Host "Website and DataMigration published; $($assets.Count) SPA files match. No applications were executed."
}
finally {
    if ($verificationPassed -and !$KeepArtifacts -and (Test-Path -LiteralPath $output)) {
        $resolvedRoot = [IO.Path]::GetFullPath($root)
        $resolvedOutput = [IO.Path]::GetFullPath($output)
        if (!$resolvedOutput.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Publish cleanup path escapes the repository.'
        }
        Remove-Item -LiteralPath $resolvedOutput -Recurse -Force
        Write-Host 'Temporary publish output removed; pass -KeepArtifacts to retain it.'
    }
    Pop-Location
}
