#!/usr/bin/env bash
# Remove a Q-Weather-USA-Pro install from Q Desktop on macOS / Linux.
#
# Usage:
#   scripts/uninstall.sh         # default appletId 9001
#   scripts/uninstall.sh 9001    # explicit appletId

set -euo pipefail

applet_id="${1:-9001}"

quio="$HOME/.quio/v2"
reg="$quio/q_storage/main/extensions"
slot="$quio/q_extensions/$applet_id"

if [[ ! -f "$reg" ]]; then
  echo "Q Desktop registry not found at $reg." >&2
  exit 1
fi

echo "Stopping Q Desktop (if running)..."
pkill -f 'das-keyboard-q' 2>/dev/null || true
sleep 1

bak="$reg.bak-$(date +%Y%m%d-%H%M%S)"
cp "$reg" "$bak"
echo "Backed up registry -> $bak"

node --input-type=module - "$reg" "$applet_id" "$slot" <<'NODE'
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

const [reg, appletIdStr, slot] = process.argv.slice(2);
const appletId = Number(appletIdStr);
const raw = readFileSync(reg, 'utf8');
const prefix = raw.slice(0, 3);
const entries = JSON.parse(raw.slice(3));

const keep = entries.filter((e) => e.appletId !== appletId);
const removed = entries.filter((e) => e.appletId === appletId);

if (removed.length === 0) {
  console.log(`No registry entry with appletId=${appletId} found.`);
} else {
  writeFileSync(reg, prefix + JSON.stringify(keep));
  console.log(`Removed ${removed.length} registry entry(ies) for appletId=${appletId}`);
  for (const e of removed) {
    const loc = e.config?.storageLocation;
    if (loc && existsSync(loc)) {
      rmSync(loc, { recursive: true, force: true });
      console.log(`  removed storage: ${loc}`);
    }
  }
}

if (existsSync(slot)) {
  rmSync(slot, { recursive: true, force: true });
  console.log(`Removed slot folder: ${slot}`);
}
NODE

echo ''
echo 'Uninstalled. Restart Q Desktop to see the applet disappear.'
