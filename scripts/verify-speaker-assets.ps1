#requires -Version 7.4
[CmdletBinding()]
param([string]$ContentRoot, [string]$ManifestPath, [string]$SpeakerExportPath)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (!$ContentRoot) { $ContentRoot = Join-Path $root '.persisted/contents' }
if (!$ManifestPath) { $ManifestPath = Join-Path $root 'src/dotnetliguriawebsite/DataMigration/json/speakerAssetSources.json' }
if (!$SpeakerExportPath) { $SpeakerExportPath = Join-Path $root 'src/dotnetliguriawebsite/DataMigration/json/workshopSpeakers.json' }
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$speakers = @(Get-Content -LiteralPath $SpeakerExportPath -Raw | ConvertFrom-Json)
$resolvedRoot = [IO.Path]::GetFullPath($ContentRoot)
$ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$paths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($entry in @($manifest.verifiedAssets) + @($manifest.unavailableMedia)) {
    if (!$ids.Add($entry.speakerId)) { throw 'Duplicate speaker ID in photo provenance.' }
    $source = @($speakers | Where-Object WorkshopSpeakerId -eq $entry.speakerId)
    if ($source.Count -ne 1 -or $source[0].Name -cne $entry.name -or
        $source[0].ProfileImage -cne $entry.sourcePath -or !$entry.sourcePath) {
        throw "Speaker photo identity/source mismatch: $($entry.speakerId)"
    }
    $uri = [Uri]$entry.sourceUrl
    if ($uri.Scheme -ne 'https' -or $uri.Host -ne 'www.dotnetliguria.net' -or
        [Uri]::UnescapeDataString($uri.AbsolutePath) -cne $entry.sourcePath) {
        throw "Speaker photo provenance URL mismatch: $($entry.speakerId)"
    }
}
foreach ($source in $speakers | Where-Object { ![string]::IsNullOrWhiteSpace($_.ProfileImage) }) {
    if (!$ids.Contains($source.WorkshopSpeakerId)) { throw "Missing speaker photo provenance: $($source.WorkshopSpeakerId)" }
}
foreach ($entry in $manifest.unavailableMedia) {
    if ($entry.httpStatus -notin @(404, 410)) { throw 'Unavailable speaker photos require a reviewed 404/410 source result.' }
}
foreach ($asset in $manifest.verifiedAssets) {
    if ($asset.path -cnotmatch '^speakers/[a-z0-9_-]+\.(jpg|jpeg|png|webp)$' -or
        $asset.sha256 -notmatch '^[0-9a-fA-F]{64}$' -or $asset.bytes -le 0) {
        throw 'Invalid or nonportable speaker photo path/hash/length.'
    }
    if (!$paths.Add($asset.path)) { throw 'Duplicate portrait destination in photo provenance.' }
    $target = [IO.Path]::GetFullPath((Join-Path $resolvedRoot $asset.path))
    if (!$target.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Speaker photo path escapes Contents.'
    }
    if (!(Test-Path -LiteralPath $target -PathType Leaf)) { throw "Missing speaker photo: $($asset.path)" }
    if ((Get-Item -LiteralPath $target).Length -ne $asset.bytes) { throw "Incomplete speaker photo: $($asset.path)" }
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $asset.sha256) {
        throw "Speaker original-source hash mismatch: $($asset.path)"
    }
}
Write-Output "$($manifest.verifiedAssets.Count) speaker portraits match their exported identities and online-original SHA256 hashes; $($manifest.unavailableMedia.Count) source unavailable."
