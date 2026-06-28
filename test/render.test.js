import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  selectDaytimePeriods,
  renderRow,
  renderMessage,
  escapeHtml,
} from '../src/render/forecast-to-keys.js';
import { COLORS } from '../src/config/colors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FORECAST = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'forecast-sample.json'), 'utf8'),
);
const PERIODS = FORECAST.properties.periods;

// Minimal Point factory for tests; the real one wraps q.Point.
const point = (color, effect) => ({ color, effect: effect || 'SET_COLOR' });

test('selectDaytimePeriods picks daytime periods up to count', () => {
  const picked = selectDaytimePeriods(PERIODS, 4);
  assert.equal(picked.length, 4);
  for (const p of picked) {
    assert.equal(p.isDaytime, true, `Period "${p.name}" should be daytime`);
  }
  assert.deepEqual(
    picked.map((p) => p.name),
    ['This Afternoon', 'Monday', 'Tuesday', 'Wednesday'],
  );
});

test('selectDaytimePeriods returns [] when input contains only nighttime periods', () => {
  const nights = [
    { name: 'Tonight', isDaytime: false, shortForecast: 'Mostly Clear' },
    { name: 'Monday Night', isDaytime: false, shortForecast: 'Partly Cloudy' },
  ];
  assert.deepEqual(selectDaytimePeriods(nights, 4), []);
});

test('selectDaytimePeriods tolerates missing or empty input', () => {
  assert.deepEqual(selectDaytimePeriods(null, 4), []);
  assert.deepEqual(selectDaytimePeriods([], 4), []);
});

test('renderRow without alert produces width keys keyed by weather type', () => {
  const periods = selectDaytimePeriods(PERIODS, 4);
  const row = renderRow({ periods, width: 4, alert: null, pointFactory: point });
  assert.equal(row.length, 4);
  // From the fixture: Sunny, Showers+Thunderstorms Likely, Partly Cloudy, Sunny
  assert.equal(row[0].color, COLORS.SUNNY);
  assert.equal(row[1].color, COLORS.STORM);
  assert.equal(row[2].color, COLORS.CLOUDY);
  assert.equal(row[3].color, COLORS.SUNNY);
});

test('renderRow with alert prepends a flashing ALERT key', () => {
  const periods = selectDaytimePeriods(PERIODS, 4);
  const alert = { event: 'Tornado Warning', severity: 'Extreme', headline: '...', url: '' };
  const row = renderRow({ periods, width: 4, alert, pointFactory: point });
  assert.equal(row.length, 4);
  assert.equal(row[0].color, COLORS.ALERT);
  assert.equal(row[0].effect, 'BLINK');
  // Alert pushed the fourth forecast off the row.
  assert.equal(row[1].color, COLORS.SUNNY);
  assert.equal(row[2].color, COLORS.STORM);
  assert.equal(row[3].color, COLORS.CLOUDY);
});

test('renderRow pads with UNKNOWN keys when fewer periods than width', () => {
  const periods = selectDaytimePeriods(PERIODS, 2);
  const row = renderRow({ periods, width: 4, alert: null, pointFactory: point });
  assert.equal(row.length, 4);
  assert.equal(row[0].color, COLORS.SUNNY);
  assert.equal(row[1].color, COLORS.STORM);
  assert.equal(row[2].color, COLORS.UNKNOWN);
  assert.equal(row[3].color, COLORS.UNKNOWN);
});

test('renderMessage includes location, alert when present, and period prose', () => {
  const periods = selectDaytimePeriods(PERIODS, 2);
  const alert = {
    event: 'Severe Thunderstorm Warning',
    severity: 'Severe',
    headline: 'Hail and 60mph winds',
    url: '',
  };
  const msg = renderMessage({ locationName: 'Charlotte, NC', alert, periods });
  assert.match(msg, /Weather Forecast for Charlotte, NC/);
  assert.match(msg, /Severe Thunderstorm Warning/);
  assert.match(msg, /\[Severe\]/);
  assert.match(msg, /Hail and 60mph winds/);
  assert.match(msg, /This Afternoon/);
});

test('renderMessage works without an alert', () => {
  const periods = selectDaytimePeriods(PERIODS, 1);
  const msg = renderMessage({ locationName: 'Austin, TX', alert: null, periods });
  assert.match(msg, /Weather Forecast for Austin, TX/);
  assert.doesNotMatch(msg, /\[Severe\]/);
});

test('escapeHtml neutralises script-injection vectors', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(escapeHtml('a&b'), 'a&amp;b');
  assert.equal(escapeHtml('"\''), '&quot;&#39;');
  assert.equal(escapeHtml(null), '');
});
