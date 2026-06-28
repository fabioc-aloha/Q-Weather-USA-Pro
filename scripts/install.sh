#!/usr/bin/env bash
# Install Q-Weather-USA-Pro into Q Desktop on macOS / Linux.
#
# Q Desktop loads applets from a registry at ~/.quio/v2/q_storage/main/extensions
# (a `~{~`-prefixed JSON array), NOT by scanning the q_extensions folder. This
# script handles the registry edit + folder copy + npm install in one shot.
#
# Reversible: see uninstall.sh, or restore the .bak file and remove the
# slot/storage folders manually.
#
# Usage:
#   scripts/install.sh                 # default appletId 9001, origin (1,1)
#   scripts/install.sh 9001 1 1        # appletId, originX, originY

set -euo pipefail

applet_id="${1:-9001}"
origin_x="${2:-1}"
origin_y="${3:-1}"

repo="$(cd "$(dirname "$0")/.." && pwd)"
quio="$HOME/.quio/v2"
reg="$quio/q_storage/main/extensions"
slot="$quio/q_extensions/$applet_id"

if [[ ! -f "$reg" ]]; then
  echo "Q Desktop registry not found at $reg. Is Q Desktop installed?" >&2
  exit 1
fi

# 1. Stop Q Desktop. Different binary names on mac vs linux; ignore errors.
echo "Stopping Q Desktop (if running)..."
pkill -f 'das-keyboard-q' 2>/dev/null || true
sleep 1

# 2. Back up the registry.
bak="$reg.bak-$(date +%Y%m%d-%H%M%S)"
cp "$reg" "$bak"
echo "Backed up registry -> $bak"

# 3. Copy applet into slot (skip node_modules, .git, .github, coverage, dist).
rm -rf "$slot"
mkdir -p "$slot"
rsync -a \
  --exclude node_modules --exclude .git --exclude .github \
  --exclude coverage --exclude dist --exclude '*.log' \
  "$repo/" "$slot/"
file_count=$(find "$slot" -type f | wc -l | tr -d ' ')
echo "Copied $file_count files into slot $applet_id"

# 4. Install runtime deps.
( cd "$slot" && npm install --omit=dev --no-audit --no-fund | tail -n 2 )

# 5. Append registry entry. Done in Node because the registry has a `~{~`
#    prefix and we need correct JSON encoding for the appended entry.
node --input-type=module - "$reg" "$slot" "$applet_id" "$origin_x" "$origin_y" "$quio" <<'NODE'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const [reg, slot, appletId, originX, originY, quio] = process.argv.slice(2);
const raw = readFileSync(reg, 'utf8');
const prefix = raw.slice(0, 3);
if (prefix !== '~{~') {
  console.error(`Unexpected registry prefix: ${JSON.stringify(prefix)}`);
  process.exit(1);
}
const entries = JSON.parse(raw.slice(3));
const pkg = JSON.parse(readFileSync(join(slot, 'package.json'), 'utf8'));
const extId = randomUUID();
const storagePath = join(quio, 'q_storage', 'extensions', extId);
mkdirSync(storagePath, { recursive: true });

const entry = {
  releaseUrl: '',
  id: extId,
  appletId: Number(appletId),
  package: pkg,
  name: pkg.name,
  entryPoint: pkg.main,
  enabled: true,
  config: {
    authorization: { apiKey: '' },
    applet: { user: {}, defaults: {} },
    geometry: {
      width: 4,
      height: 1,
      origin: { x: Number(originX), y: Number(originY) },
    },
    extensionId: extId,
    storageLocation: storagePath,
  },
  status: 'STARTED',
  isSingleton: false,
};

entries.push(entry);
writeFileSync(reg, prefix + JSON.stringify(entries));

console.log('');
console.log('=== installed ===');
console.log(`  appletId:     ${appletId}`);
console.log(`  extensionId:  ${extId}`);
console.log(`  registry has ${entries.length} entries`);
console.log('');
console.log(`Now start Q Desktop. Look for '${pkg.displayName}' in the applet list.`);
console.log(`To uninstall: scripts/uninstall.sh ${appletId}`);
NODE
