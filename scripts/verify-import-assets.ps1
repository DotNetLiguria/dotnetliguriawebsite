#requires -Version 7.4
[CmdletBinding()]
param(
    [string]$ContentRoot,
    [string]$ManifestPath
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (!$ContentRoot) { $ContentRoot = Join-Path $root '.persisted/contents' }
if (!$ManifestPath) { $ManifestPath = Join-Path $root 'src/dotnetliguriawebsite/DataMigration/json/workshopAssetSources.json' }
$resolvedRoot = [IO.Path]::GetFullPath($ContentRoot)
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
foreach ($asset in $manifest.verifiedAssets) {
    $target = [IO.Path]::GetFullPath((Join-Path $resolvedRoot $asset.path))
    if (!$target.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Asset manifest path escapes Contents.'
    }
    if (!(Test-Path -LiteralPath $target -PathType Leaf)) { throw "Missing verified asset: $($asset.path)" }
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $asset.sha256) {
        throw "Original-source hash mismatch: $($asset.path)"
    }
}
Write-Output "$($manifest.verifiedAssets.Count) imported assets match the recorded online-original SHA256 hashes."
Write-Output "$($manifest.unavailableMedia.Count) source media URLs returned 404; $($manifest.externalPosters.Count) externally hosted posters retain historical local images."
