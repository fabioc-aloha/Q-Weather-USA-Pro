#requires -Version 7.0
<#
.SYNOPSIS
  Install Q-Weather-USA-Pro into Q Desktop on Windows.

.DESCRIPTION
  Q Desktop loads applets from a registry at
  `~/.quio/v2/q_storage/main/extensions` (a `~{~`-prefixed JSON array),
  NOT by scanning the q_extensions folder. This script:

    1. Stops Q Desktop (if running)
    2. Backs up the registry file
    3. Copies the applet code into a numeric slot folder
    4. Installs the runtime dependencies inside the slot
    5. Appends a new registry entry with a generated UUID
    6. Prints what to do next

  Reversible: see `uninstall.ps1`, or restore the .bak file and remove the
  slot/storage folders manually.

.PARAMETER AppletId
  Numeric slot id. Default 9001. Pick anything not already in use; the
  marketplace uses small numbers (typically < 100).

.PARAMETER Origin
  Hashtable @{x=N; y=N} for the starting key. Default @{x=1; y=1}.
#>
[CmdletBinding()]
param(
  [int] $AppletId = 9001,
  [hashtable] $Origin = @{ x = 1; y = 1 }
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$quio = Join-Path $env:USERPROFILE '.quio\v2'
$reg = Join-Path $quio 'q_storage\main\extensions'
$slot = Join-Path $quio "q_extensions\$AppletId"

if (-not (Test-Path $reg)) {
  throw "Q Desktop registry not found at $reg. Is Q Desktop installed?"
}

# 1. Stop Q Desktop (kernel driver QServiceEM05G is fine to leave running).
$running = Get-Process das-keyboard-q -ErrorAction SilentlyContinue
if ($running) {
  Write-Host "Stopping Q Desktop ($($running.Count) processes)..."
  $running | Stop-Process -Force
  Start-Sleep -Milliseconds 1500
  if (Get-Process das-keyboard-q -ErrorAction SilentlyContinue) {
    throw 'Q Desktop still running after stop attempt.'
  }
}

# 2. Back up the registry.
$bak = "$reg.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item $reg $bak
Write-Host "Backed up registry -> $bak"

# 3. Copy applet into slot.
if (Test-Path $slot) {
  Write-Host "Slot $AppletId exists; clearing"
  Remove-Item -Recurse -Force $slot
}
New-Item -ItemType Directory -Path $slot | Out-Null
$exclude = @('node_modules', '.git', 'coverage', 'dist', '*.log', '.github')
Get-ChildItem -Path $repo -Force | Where-Object {
  $n = $_.Name
  -not ($exclude | Where-Object { $n -like $_ })
} | ForEach-Object { Copy-Item -Path $_.FullName -Destination $slot -Recurse -Force }
Write-Host "Copied $(Get-ChildItem $slot -Recurse -File | Measure-Object | Select-Object -ExpandProperty Count) files into slot $AppletId"

# 4. Install runtime deps.
Push-Location $slot
& npm install --omit=dev --no-audit --no-fund 2>&1 | Select-Object -Last 2
Pop-Location

# 5. Append registry entry.
$extId = [guid]::NewGuid().Guid
$storagePath = Join-Path $quio "q_storage\extensions\$extId"
New-Item -ItemType Directory -Force -Path $storagePath | Out-Null

$raw = Get-Content $reg -Raw
$prefix = $raw.Substring(0, 3)
if ($prefix -ne '~{~') { throw "Unexpected registry prefix: '$prefix'" }
$allEntries = @($raw.Substring(3) | ConvertFrom-Json)
$pkg = Get-Content (Join-Path $slot 'package.json') -Raw | ConvertFrom-Json

# Dedupe: strip any existing entries for this AppletId (and clean their
# per-extension storage folders) so re-running the script replaces in place
# instead of stacking duplicate registry entries.
$existing = @($allEntries | Where-Object { $_.appletId -eq $AppletId })
$entries = @($allEntries | Where-Object { $_.appletId -ne $AppletId })
foreach ($e in $existing) {
  if ($e.config.storageLocation -and (Test-Path $e.config.storageLocation)) {
    Remove-Item -Recurse -Force $e.config.storageLocation
    Write-Host "  removed stale storage: $($e.config.storageLocation)"
  }
}
if ($existing.Count -gt 0) {
  Write-Host "Replaced $($existing.Count) existing entry(ies) for appletId=$AppletId"
}

$newEntry = [ordered]@{
  releaseUrl  = ''
  id          = $extId
  appletId    = $AppletId
  package     = $pkg
  name        = $pkg.name
  entryPoint  = $pkg.main
  enabled     = $true
  config      = [ordered]@{
    authorization   = [ordered]@{ apiKey = '' }
    applet          = [ordered]@{ user = [ordered]@{}; defaults = [ordered]@{} }
    geometry        = [ordered]@{ width = 4; height = 1; origin = [ordered]@{ x = $Origin.x; y = $Origin.y } }
    extensionId     = $extId
    storageLocation = $storagePath
  }
  status      = 'STARTED'
  isSingleton = $false
}

$updated = @($entries) + $newEntry
$encoded = $prefix + ($updated | ConvertTo-Json -Depth 30 -Compress)
Set-Content -Path $reg -Value $encoded -Encoding UTF8 -NoNewline

Write-Host ''
Write-Host '=== installed ==='
Write-Host "  appletId:     $AppletId"
Write-Host "  extensionId:  $extId"
Write-Host "  registry has $($updated.Count) entries (was $($entries.Count))"
Write-Host ''
Write-Host "Now start Q Desktop. Look for '$($pkg.displayName)' in the applet list."
Write-Host "To uninstall: pwsh -File scripts\uninstall.ps1 -AppletId $AppletId"
