// Manual smoke test: hits the real NWS + Open-Meteo APIs.
// Not part of the test suite (no network in CI sandboxing rules).
// Run with: node test/smoke.js

import { searchUsCities, parseLocationKey } from '../src/providers/geocoding.js';
import { resolvePoint, getForecast, getActiveAlert } from '../src/providers/nws.js';
import { selectDaytimePeriods, renderRow } from '../src/render/forecast-to-keys.js';

const point = (color, effect) => ({ color, effect: effect || 'SET_COLOR' });

async function main() {
  console.log('1. Geocoding "Charlotte"...');
  const results = await searchUsCities('Charlotte', 3);
  console.log(`   Found ${results.length} US matches:`);
  for (const r of results) console.log(`   - ${r.value}  (${r.lat}, ${r.lon})`);
  const top = results[0];
  if (!top) throw new Error('No geocoding results');

  console.log('\n2. Resolving NWS grid...');
  const parsed = parseLocationKey(top.key);
  const grid = await resolvePoint(parsed.lat, parsed.lon);
  console.log(`   gridId=${grid.gridId} gridX=${grid.gridX} gridY=${grid.gridY}`);
  console.log(`   forecast URL: ${grid.forecastUrl}`);

  console.log('\n3. Fetching forecast...');
  const forecast = await getForecast(grid.forecastUrl);
  console.log(`   updated: ${forecast.updated}`);
  console.log(`   ${forecast.periods.length} periods returned`);
  const day = selectDaytimePeriods(forecast.periods, 4);
  for (const p of day) console.log(`   - ${p.name}: ${p.shortForecast} (${p.temperature}\u00b0F)`);

  console.log('\n4. Fetching active alerts...');
  const alert = await getActiveAlert(parsed.lat, parsed.lon);
  console.log(`   ${alert ? `ACTIVE: [${alert.severity}] ${alert.event}` : 'No active alerts.'}`);

  console.log('\n5. Rendering row...');
  const row = renderRow({ periods: day, width: 4, alert, pointFactory: point });
  console.log(`   ${JSON.stringify(row)}`);

  console.log('\nSmoke test OK.');
}

main().catch((e) => {
  console.error('SMOKE FAIL:', e);
  process.exit(1);
});
