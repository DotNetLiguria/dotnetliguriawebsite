#requires -Version 7.4
[CmdletBinding()]
param([string]$ArtifactDirectory)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path $PSScriptRoot -Parent
$output = Join-Path $root '.artifacts/publish'
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
}

if ($ArtifactDirectory) {
    Assert-NoPrivateArtifacts $ArtifactDirectory
    Write-Host 'Artifact confidentiality check passed.'
    return
}

Push-Location $root
try {
    foreach ($name in $projects.Keys) {
        $destination = Join-Path $output $name
        if (Test-Path $destination) { Remove-Item $destination -Recurse -Force }
        & dotnet publish $projects[$name] -c Release --no-restore -o $destination --nologo -v minimal
        if ($LASTEXITCODE -ne 0) { throw "Publish failed: $name" }
        if (!(Get-ChildItem $destination -Filter '*.runtimeconfig.json' -File)) { throw "Missing executable artifact: $name" }
    }

    $dist = Join-Path $root 'src/dotnetliguriaspa/dist'
    $website = Join-Path $output 'website'
    Assert-NoPrivateArtifacts $website
    $assets = @(Get-ChildItem $dist -File -Recurse)
    if (!$assets.Count -or !(Test-Path "$dist/index.html")) { throw 'Missing Vite output' }
    foreach ($asset in $assets) {
        $relative = [IO.Path]::GetRelativePath($dist, $asset.FullName)
        $published = Join-Path $website "wwwroot/$relative"
        if (!(Test-Path $published) -or (Get-FileHash $asset.FullName).Hash -ne (Get-FileHash $published).Hash) {
            throw "Published SPA asset mismatch: $relative"
        }
    }
    foreach ($workshop in @('workshop001', 'workshop032')) {
        $relative = "Contents/workshops/$workshop/workshop.png"
        $source = Join-Path $root "src/dotnetliguriawebsite/DotNetLiguriaCore/$relative"
        if ((Get-FileHash $source).Hash -ne (Get-FileHash (Join-Path $website $relative)).Hash) {
            throw "Historical asset changed: $workshop"
        }
    }
    Write-Host "Website and DataMigration published; $($assets.Count) SPA files match; historical assets verified. No applications were executed."
}
finally { Pop-Location }