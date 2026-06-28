import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  shortForecastToWeatherType,
  severityRank,
  nwsForecastPageUrl,
} from '../src/providers/nws.js';
import { WEATHER } from '../src/config/colors.js';

test('shortForecastToWeatherType handles common NWS phrases', () => {
  assert.equal(shortForecastToWeatherType('Sunny'), WEATHER.SUNNY);
  assert.equal(shortForecastToWeatherType('Mostly Sunny'), WEATHER.SUNNY);
  assert.equal(shortForecastToWeatherType('Clear'), WEATHER.CLEAR);
  assert.equal(shortForecastToWeatherType('Mostly Clear'), WEATHER.CLEAR);
  assert.equal(shortForecastToWeatherType('Partly Cloudy'), WEATHER.CLOUDY);
  assert.equal(shortForecastToWeatherType('Cloudy'), WEATHER.CLOUDY);
  assert.equal(shortForecastToWeatherType('Patchy Fog'), WEATHER.CLOUDY);
  assert.equal(shortForecastToWeatherType('Chance Showers'), WEATHER.SHOWER);
  assert.equal(shortForecastToWeatherType('Light Rain'), WEATHER.SHOWER);
  assert.equal(shortForecastToWeatherType('Drizzle'), WEATHER.SHOWER);
  assert.equal(
    shortForecastToWeatherType('Showers And Thunderstorms Likely'),
    WEATHER.STORM,
    'Storm should outrank shower when both words appear',
  );
  assert.equal(shortForecastToWeatherType('Heavy Snow'), WEATHER.SNOW);
  assert.equal(shortForecastToWeatherType('Snow Showers'), WEATHER.SNOW, 'Snow outranks shower');
  assert.equal(shortForecastToWeatherType('Blizzard Conditions'), WEATHER.SNOW);
  assert.equal(
    shortForecastToWeatherType('Freezing Rain'),
    WEATHER.SNOW,
    'Freezing precip must outrank the rain branch',
  );
  assert.equal(shortForecastToWeatherType('Freezing Drizzle'), WEATHER.SNOW);
});

test('shortForecastToWeatherType returns UNKNOWN for unfamiliar input', () => {
  assert.equal(shortForecastToWeatherType(''), WEATHER.UNKNOWN);
  assert.equal(shortForecastToWeatherType(null), WEATHER.UNKNOWN);
  assert.equal(shortForecastToWeatherType('Volcanic Ash'), WEATHER.UNKNOWN);
});

test('severityRank orders Extreme > Severe > Moderate > Minor > Unknown', () => {
  assert.ok(severityRank('Extreme') > severityRank('Severe'));
  assert.ok(severityRank('Severe') > severityRank('Moderate'));
  assert.ok(severityRank('Moderate') > severityRank('Minor'));
  assert.ok(severityRank('Minor') > severityRank('Unknown'));
  assert.ok(severityRank('Minor') > severityRank('Mystery'));
});

test('nwsForecastPageUrl builds the public MapClick URL', () => {
  const url = nwsForecastPageUrl(35.2271, -80.8431);
  assert.match(url, /^https:\/\/forecast\.weather\.gov\/MapClick\.php/);
  assert.match(url, /lat=35\.2271/);
  assert.match(url, /lon=-80\.8431/);
});
