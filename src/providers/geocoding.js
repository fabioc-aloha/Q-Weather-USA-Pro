import { USER_AGENT } from '../config/colors.js';

/**
 * Search US cities by name using Open-Meteo's free geocoding API
 * (no API key required, no rate-limit on reasonable use).
 *
 * @param {string} query - Free-text city name (e.g. "Charlotte", "Austin TX").
 * @param {number} [limit=10] - Max results to return (1..20).
 * @returns {Promise<Array<{key: string, value: string, lat: number, lon: number}>>}
 *   Options shaped for the Q Desktop search picker.
 */
export async function searchUsCities(query, limit = 10) {
  if (!query || !query.trim()) return [];
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query.trim());
  url.searchParams.set('count', String(Math.min(Math.max(limit, 1), 20)));
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Geocoding HTTP ${res.status}`);
  }
  const body = await res.json();
  const results = Array.isArray(body.results) ? body.results : [];

  // US-only filter (this applet's scope).
  return results.filter((r) => r.country_code === 'US').map((r) => geocodeResultToOption(r));
}

/**
 * Convert one Open-Meteo geocoding result into a Q-Desktop options entry.
 * The `key` encodes lat/lon so the applet can recover the point without
 * re-querying geocoding.
 *
 * @param {object} r - Raw geocoding result.
 * @returns {{key: string, value: string, lat: number, lon: number}}
 */
export function geocodeResultToOption(r) {
  const state = r.admin1 ? `, ${r.admin1}` : '';
  const value = `${r.name}${state}`;
  // key format: "lat,lon|Name, State" — parseable and human-readable in logs.
  const key = `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}|${value}`;
  return { key, value, lat: r.latitude, lon: r.longitude };
}

/**
 * Parse a location key (as stored in user config) back into lat/lon + name.
 *
 * @param {string} key - Key produced by `geocodeResultToOption()`.
 * @returns {{lat: number, lon: number, name: string} | null}
 */
export function parseLocationKey(key) {
  if (typeof key !== 'string' || !key.includes('|')) return null;
  const [coords, name] = key.split('|', 2);
  const [latStr, lonStr] = coords.split(',', 2);
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon, name };
}
