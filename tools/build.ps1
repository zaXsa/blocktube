<#
.SYNOPSIS
    Builds a BlockTube extension package on Windows.

.DESCRIPTION
    A Windows-native equivalent of tools/build.sh (same inputs, same outputs:
    an unpacked directory ready for Load unpacked / Load Temporary Add-on,
    plus a .zip package by default). Windows packaging needs no Node
    toolchain. Pass -NoZip to skip the package (local Chrome use — Chrome
    cannot load a .zip anyway).

    Packaging only: if you edited src/scripts/inject/*.js fragments (or
    src/scripts/consts.js), regenerate the bundle first with
    `npm run build:inject` -- this script, like build.sh, just copies
    src/scripts/inject.js as-is.

    Safety: rebuilds its target directory from scratch every run (mirrors
    build.sh), so stale files never survive. Writes only inside <repo>\dist
    and refuses paths outside it. No network access.

.EXAMPLE
    PS> .\tools\build.ps1 -Browser chrome -NoZip
    (from Command Prompt instead:
    powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Browser chrome -NoZip)

.EXAMPLE
    PS> .\tools\build.ps1 -Browser firefox_selfhosted
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('firefox', 'firefox_selfhosted', 'chrome')]
    [string]$Browser,

    [string]$Version,

    [string]$UpdateUrl,

    [switch]$NoZip
)

$ErrorActionPreference = 'Stop'

$BaseDir  = Split-Path -Parent $PSScriptRoot
$DistRoot = Join-Path $BaseDir 'dist'
$Dest     = Join-Path $DistRoot $Browser

if (-not $Version) {
    $Version = (Get-Content (Join-Path $BaseDir 'VERSION') -Raw).Trim()
}

# Never operate outside <repo>\dist, whatever the inputs were.
$resolvedDistRoot = [System.IO.Path]::GetFullPath($DistRoot)
$resolvedDest     = [System.IO.Path]::GetFullPath($Dest)
if (-not $resolvedDest.StartsWith($resolvedDistRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to build: '$resolvedDest' is outside '$resolvedDistRoot'."
}

# Rebuild from scratch every run, like build.sh: an overlay copy would let
# stale files from a previous build survive. dist/ is disposable output, and
# the guard above already refuses anything outside it.
if (Test-Path $Dest) {
    Remove-Item -LiteralPath $Dest -Recurse -Force
}

New-Item -ItemType Directory -Path $Dest -Force | Out-Null

Write-Host "Building $Browser v$Version to $Dest"

Copy-Item (Join-Path $BaseDir 'src')     $Dest -Recurse
Copy-Item (Join-Path $BaseDir 'assets')  $Dest -Recurse
Copy-Item (Join-Path $BaseDir 'LICENSE') $Dest
Copy-Item (Join-Path $BaseDir 'VERSION') $Dest
Copy-Item (Join-Path $BaseDir "platform\$Browser\manifest.json") $Dest

# Substitute {EXT_VERSION}. Written as UTF-8 *without* a BOM -- Windows
# PowerShell's -Encoding utf8 emits a BOM, and a BOM in manifest.json makes
# Firefox reject the JSON.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
foreach ($rel in @('manifest.json', 'src\ui\options.html')) {
    $file = Join-Path $Dest $rel
    $text = [System.IO.File]::ReadAllText($file)
    $text = $text.Replace('{EXT_VERSION}', $Version)
    [System.IO.File]::WriteAllText($file, $text, $utf8NoBom)
}

$remaining = Select-String -Path (Join-Path $Dest 'manifest.json') -Pattern 'EXT_VERSION' -ErrorAction SilentlyContinue
if ($remaining) {
    throw "manifest.json still contains the {EXT_VERSION} placeholder -- the build is incomplete."
}

# Optional self-hosted update URL (Firefox self-distribution). Only the
# firefox_selfhosted manifest carries an update_url key; elsewhere this is a
# harmless no-op.
if ($UpdateUrl) {
    $manifestFile = Join-Path $Dest 'manifest.json'
    $mtext = [System.IO.File]::ReadAllText($manifestFile)
    $replacement = '"update_url": "' + $UpdateUrl + '"'
    $mtext = [regex]::Replace($mtext, '"update_url":\s*"[^"]*"', { param($m) $replacement })
    [System.IO.File]::WriteAllText($manifestFile, $mtext, $utf8NoBom)
}

# Shareable package (store submissions, releases, Firefox signing). Skipped
# with -NoZip — Chrome cannot load a .zip anyway, so local Chrome builds
# don't need it. Entries are added one at a time rather than with
# [ZipFile]::CreateFromDirectory or Compress-Archive: on Windows PowerShell 5.1
# both write the OS separator into entry names ("src\scripts\background.js").
# ZIP requires forward slashes, and Firefox cannot resolve manifest paths
# without them.
$zip = $null
if (-not $NoZip) {
    $zip = Join-Path $Dest "blocktube_${Browser}_v${Version}.zip"
    if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    Add-Type -AssemblyName System.IO.Compression
    $destFull = [System.IO.Path]::GetFullPath($Dest)
    # Enumerate BEFORE creating the archive: the .zip lives inside $Dest, so
    # creating it first would make the scan find the (still empty) archive
    # and try to pack it into itself.
    $files = Get-ChildItem -LiteralPath $Dest -Recurse -File
    $zipStream = [System.IO.File]::Open($zip, [System.IO.FileMode]::CreateNew)
    try {
        $archive = New-Object System.IO.Compression.ZipArchive(
            $zipStream, [System.IO.Compression.ZipArchiveMode]::Create)
        try {
            foreach ($file in $files) {
                $relative = $file.FullName.Substring($destFull.Length).TrimStart('\', '/')
                $entryName = $relative -replace '\\', '/'
                $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
                $entryStream = $entry.Open()
                try {
                    $fileStream = [System.IO.File]::OpenRead($file.FullName)
                    try { $fileStream.CopyTo($entryStream) } finally { $fileStream.Dispose() }
                } finally { $entryStream.Dispose() }
            }
        } finally { $archive.Dispose() }
    } finally { $zipStream.Dispose() }
}

Write-Host ""
Write-Host "Unpacked : $Dest"
if ($zip) { Write-Host "Package  : $zip" }
Write-Host ""
Write-Host "Chrome  : chrome://extensions -> Developer mode -> Load unpacked -> $Dest"
Write-Host "Firefox : about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> $Dest\manifest.json"
