#requires -Version 7.0
<#
.SYNOPSIS
  Remove a Q-Weather-USA-Pro install from Q Desktop.

.DESCRIPTION
  Stops Q Desktop, removes the registry entry for the given AppletId
  (and the corresponding per-extension storage folder), and deletes the
  slot folder. The most recent registry backup is left in place.

.PARAMETER AppletId
  The numeric slot id used when installing. Default 9001.
#>
[CmdletBinding()]
param([int] $AppletId = 9001)

$ErrorActionPreference = 'Stop'

$quio = Join-Path $env:USERPROFILE '.quio\v2'
$reg = Join-Path $quio 'q_storage\main\extensions'
$slot = Join-Path $quio "q_extensions\$AppletId"

if (-not (Test-Path $reg)) {
  throw "Q Desktop registry not found at $reg."
}

# 1. Stop Q Desktop.
$running = Get-Process das-keyboard-q -ErrorAction SilentlyContinue
if ($running) {
  Write-Host "Stopping Q Desktop ($($running.Count) processes)..."
  $running | Stop-Process -Force
  Start-Sleep -Milliseconds 1500
}

# 2. Back up registry.
$bak = "$reg.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item $reg $bak
Write-Host "Backed up registry -> $bak"

# 3. Strip entry from registry.
$raw = Get-Content $reg -Raw
$prefix = $raw.Substring(0, 3)
$entries = $raw.Substring(3) | ConvertFrom-Json

$keep = @($entries | Where-Object { $_.appletId -ne $AppletId })
$removed = @($entries | Where-Object { $_.appletId -eq $AppletId })

if ($removed.Count -eq 0) {
  Write-Host "No registry entry with appletId=$AppletId found. Nothing to remove."
} else {
  $encoded = $prefix + ($keep | ConvertTo-Json -Depth 30 -Compress)
  Set-Content -Path $reg -Value $encoded -Encoding UTF8 -NoNewline
  Write-Host "Removed $($removed.Count) registry entry(ies) for appletId=$AppletId"

  # 4. Drop per-extension storage folders referenced by removed entries.
  foreach ($e in $removed) {
    if ($e.config.storageLocation -and (Test-Path $e.config.storageLocation)) {
      Remove-Item -Recurse -Force $e.config.storageLocation
      Write-Host "  removed storage: $($e.config.storageLocation)"
    }
  }
}

# 5. Remove slot folder.
if (Test-Path $slot) {
  Remove-Item -Recurse -Force $slot
  Write-Host "Removed slot folder: $slot"
}

Write-Host ''
Write-Host 'Uninstalled. Restart Q Desktop to see the applet disappear.'
