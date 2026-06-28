// End-to-end live test that bypasses the daskeyboard-applet SDK's broken
// signal-send transport (it uses deprecated request-promise which appears
// to hang on Node 24 + ESM). Hits NWS + Open-Meteo + Q Desktop directly.
//
// Run with: node scripts/dev/live.dev.mjs [optional city]
//   node scripts/dev/live.dev.mjs              -> Charlotte, NC
//   node scripts/dev/live.dev.mjs "Seattle"    -> first US match for Seattle
//
// Lights up 4 keys at origin (1,1). Loops, polling every 30s for the
// duration the process is alive. Ctrl+C to stop.

import { searchUsCities, parseLocationKey } from '../../src/providers/geocoding.js';
import { resolvePoint, getForecast, getActiveAlert } from '../../src/providers/nws.js';
import {
  selectDaytimePeriods,
  renderRow,
  renderMessage,
} from '../../src/render/forecast-to-keys.js';

const Q_SIGNAL_ENDPOINT = 'http://127.0.0.1:27301/api/2.0/signals';
const ORIGIN = { x: 1, y: 1 };
const WIDTH = 4;
const HEIGHT = 1;
const POLL_MS = 30_000; // 30s for testing (production is 30 min)

const cityQuery = process.argv[2] || 'Charlotte';

const point = (color, effect) => ({ color, effect: effect || 'SET_COLOR' });

/**
 * POST a signal payload directly to the local Q Desktop signal API.
 * This is the raw protocol the SDK normally handles.
 */
async function postSignal({ rowPoints, name, message, link }) {
  // Q Desktop expects actionValue as a JSON-stringified array of
  // { zoneId: "x,y", effect, color } entries. zoneId here is "col,row".
  const actionValue = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < rowPoints.length; x++) {
      const p = rowPoints[x];
      actionValue.push({
        zoneId: `${ORIGIN.x + x},${ORIGIN.y + y}`,
        effect: p.effect,
        color: p.color,
      });
    }
  }

  const body = {
    action: 'DRAW',
    actionValue: JSON.stringify(actionValue),
    clientName: 'q-weather-usa-pro-live-test',
    data: null,
    link,
    errors: [],
    isMuted: true,
    message,
    name,
    pid: 'Q_MATRIX',
  };

  const res = await fetch(Q_SIGNAL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Q Desktop signal POST failed: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.id;
}

async function poll(location) {
  const { lat, lon, name } = location;
  console.log(`\n[${new Date().toISOString()}] polling ${name}`);

  const grid = await resolvePoint(lat, lon);
  const [forecast, alert] = await Promise.all([
    getForecast(grid.forecastUrl),
    getActiveAlert(lat, lon).catch(() => null),
  ]);
  const periods = selectDaytimePeriods(forecast.periods, WIDTH);

  console.log('  Forecast (first 4 daytime periods):');
  for (const p of periods) {
    console.log(`    - ${p.name}: ${p.shortForecast} (${p.temperature}\u00b0${p.temperatureUnit})`);
  }
  console.log(`  Alert: ${alert ? `[${alert.severity}] ${alert.event}` : 'none'}`);

  const row = renderRow({ periods, width: WIDTH, alert, pointFactory: point });
  console.log(
    `  Keys: ${row.map((p) => p.color + (p.effect === 'BLINK' ? ' (blink)' : '')).join(' | ')}`,
  );

  const signalId = await postSignal({
    rowPoints: row,
    name: alert ? `${alert.event} \u2014 ${name}` : name,
    message: renderMessage({ locationName: name, alert, periods }),
    link: {
      url: alert?.url || `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}`,
      label: alert ? 'View alert details' : 'Open NWS forecast',
    },
  });
  console.log(`  -> Q Desktop signal id=${signalId} sent.`);
}

async function main() {
  console.log(`Searching geocoding for "${cityQuery}"...`);
  const matches = await searchUsCities(cityQuery, 3);
  if (matches.length === 0) {
    throw new Error(`No US matches for "${cityQuery}"`);
  }
  console.log('  Matches:');
  for (const m of matches) console.log(`    ${m.value} (${m.lat}, ${m.lon})`);
  const location = parseLocationKey(matches[0].key);
  console.log(`  Using: ${location.name}`);

  await poll(location);

  console.log(`\nPolling every ${POLL_MS / 1000}s. Ctrl+C to stop.`);
  setInterval(() => {
    poll(location).catch((e) => console.error('  poll error:', e.message));
  }, POLL_MS);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
