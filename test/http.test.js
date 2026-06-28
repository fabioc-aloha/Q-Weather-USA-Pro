// HTTP-layer tests. Stubs globalThis.fetch to exercise the wire format
// without hitting real NWS / Open-Meteo.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { fetchJson } from '../src/util/http.js';
import { resolvePoint, getForecast, getActiveAlert } from '../src/providers/nws.js';
import { searchUsCities } from '../src/providers/geocoding.js';
import { USER_AGENT } from '../src/config/colors.js';

let realFetch;
let calls;

beforeEach(() => {
  realFetch = globalThis.fetch;
  calls = [];
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

// --- Helpers ----------------------------------------------------------------

function stubOk(body) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

function stubStatus(status, body = '') {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(body, { status });
  };
}

function stubThrow(err) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    throw err;
  };
}

function stubNeverResolves() {
  globalThis.fetch = (url, init) => {
    calls.push({ url: String(url), init });
    return new Promise((_, reject) => {
      // Resolve when the AbortController fires.
      init?.signal?.addEventListener('abort', () => {
        const e = new Error('Aborted');
        e.name = 'AbortError';
        reject(e);
      });
    });
  };
}

// --- fetchJson --------------------------------------------------------------

test('fetchJson surfaces non-2xx as a thrown error with status + body snippet', async () => {
  stubStatus(503, 'service unavailable');
  await assert.rejects(() => fetchJson('https://example.test/x'), /HTTP 503.*service unavailable/);
});

test('fetchJson surfaces malformed JSON', async () => {
  globalThis.fetch = async () =>
    new Response('not json{', { status: 200, headers: { 'content-type': 'application/json' } });
  await assert.rejects(() => fetchJson('https://example.test/x'), /Invalid JSON/);
});

test('fetchJson aborts after timeout and throws a clear error', async () => {
  stubNeverResolves();
  await assert.rejects(
    () => fetchJson('https://example.test/x', { timeoutMs: 50 }),
    /Timeout after 50ms/,
  );
});

test('fetchJson surfaces network errors verbatim', async () => {
  stubThrow(new Error('getaddrinfo ENOTFOUND example.test'));
  await assert.rejects(() => fetchJson('https://example.test/x'), /ENOTFOUND/);
});

// --- NWS providers ----------------------------------------------------------

test('resolvePoint sends User-Agent + geo+json Accept, returns grid metadata', async () => {
  stubOk({
    properties: {
      forecast: 'https://api.weather.gov/gridpoints/GSP/119,65/forecast',
      forecastHourly: 'https://api.weather.gov/gridpoints/GSP/119,65/forecast/hourly',
      gridId: 'GSP',
      gridX: 119,
      gridY: 65,
      relativeLocation: { properties: { city: 'Charlotte', state: 'NC' } },
    },
  });
  const grid = await resolvePoint(35.22709, -80.84313);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.weather.gov/points/35.2271,-80.8431');
  assert.equal(calls[0].init.headers['User-Agent'], USER_AGENT);
  assert.equal(calls[0].init.headers.Accept, 'application/geo+json');
  assert.equal(grid.gridId, 'GSP');
  assert.equal(grid.city, 'Charlotte');
  assert.equal(grid.state, 'NC');
  assert.equal(grid.forecastUrl, 'https://api.weather.gov/gridpoints/GSP/119,65/forecast');
});

test('getForecast returns periods array even when properties absent', async () => {
  stubOk({});
  const r = await getForecast('https://api.weather.gov/gridpoints/GSP/119,65/forecast');
  assert.deepEqual(r.periods, []);
  assert.equal(r.updated, '');
});

test('getActiveAlert returns null when features is empty', async () => {
  stubOk({ features: [] });
  const a = await getActiveAlert(35.22, -80.84);
  assert.equal(a, null);
});

test('getActiveAlert returns null when features is missing entirely', async () => {
  stubOk({});
  const a = await getActiveAlert(35.22, -80.84);
  assert.equal(a, null);
});

test('getActiveAlert picks the highest-severity alert when multiple are active', async () => {
  stubOk({
    features: [
      { properties: { event: 'Heat Advisory', severity: 'Minor', headline: 'It is hot' } },
      { properties: { event: 'Tornado Warning', severity: 'Extreme', headline: 'TAKE COVER' } },
      { properties: { event: 'Flood Watch', severity: 'Moderate', headline: 'Watch streams' } },
    ],
  });
  const a = await getActiveAlert(35.22, -80.84);
  assert.equal(a.event, 'Tornado Warning');
  assert.equal(a.severity, 'Extreme');
});

test('getActiveAlert skips alerts with no event and surfaces only the eventful ones', async () => {
  stubOk({
    features: [
      { properties: { severity: 'Extreme' } }, // no event - should be dropped
      { properties: { event: 'Flood Watch', severity: 'Moderate', headline: 'streams' } },
    ],
  });
  const a = await getActiveAlert(35.22, -80.84);
  assert.equal(a.event, 'Flood Watch');
});

test('getActiveAlert returns null if every alert lacks an event', async () => {
  stubOk({
    features: [{ properties: { severity: 'Severe' } }, { properties: { severity: 'Minor' } }],
  });
  const a = await getActiveAlert(35.22, -80.84);
  assert.equal(a, null);
});

// --- Geocoding --------------------------------------------------------------

test('searchUsCities requests count=100 and filters to US results only', async () => {
  stubOk({
    results: [
      { name: 'Berlin', latitude: 52.5, longitude: 13.4, country_code: 'DE', admin1: 'Berlin' },
      {
        name: 'Charlotte',
        latitude: 35.22,
        longitude: -80.84,
        country_code: 'US',
        admin1: 'North Carolina',
      },
      { name: 'Charlotte', latitude: -36.85, longitude: 174.76, country_code: 'NZ' },
      { name: 'Austin', latitude: 30.27, longitude: -97.74, country_code: 'US', admin1: 'Texas' },
    ],
  });
  const out = await searchUsCities('charlotte');
  assert.equal(calls.length, 1);
  const u = new URL(calls[0].url);
  assert.equal(u.searchParams.get('count'), '100', 'always ask Open-Meteo for the max');
  assert.equal(u.searchParams.get('name'), 'charlotte');
  // Only the 2 US entries survived, preserving order.
  assert.deepEqual(
    out.map((o) => o.value),
    ['Charlotte, North Carolina', 'Austin, Texas'],
  );
});

test('searchUsCities returns [] for empty / whitespace queries without fetching', async () => {
  globalThis.fetch = async () => {
    throw new Error('should not be called');
  };
  assert.deepEqual(await searchUsCities(''), []);
  assert.deepEqual(await searchUsCities('   '), []);
});

test('searchUsCities truncates to the caller-requested limit after US filter', async () => {
  const us = (i) => ({
    name: `City${i}`,
    latitude: 30 + i,
    longitude: -90 - i,
    country_code: 'US',
    admin1: 'TX',
  });
  stubOk({ results: Array.from({ length: 25 }, (_, i) => us(i)) });
  const out = await searchUsCities('city', 5);
  assert.equal(out.length, 5);
});

test('searchUsCities surfaces upstream HTTP errors', async () => {
  stubStatus(500, 'oops');
  await assert.rejects(() => searchUsCities('x'), /HTTP 500/);
});
