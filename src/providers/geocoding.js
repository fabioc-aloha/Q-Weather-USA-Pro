import { fetchJson } from '../util/http.js';
import { USER_AGENT } from '../config/colors.js';

/**
 * Search US cities by name using Open-Meteo's free geocoding API
 * (no API key required, no rate-limit on reasonable use).
 *
 * The Open-Meteo API has no built-in country filter, so we ask for a wide
 * pool (default 100, its maximum) and then post-filter to US. Without this,
 * short ambiguous prefixes like "c" or "char" return zero US matches —
 * the top 15 global results happen to be non-US, and US cities never even
 * appear in the response.
 *
 * @param {string} query - Free-text city name (e.g. "Charlotte", "Austin TX").
 * @param {number} [limit=15] - Max US results to return to the caller.
 * @returns {Promise<Array<{key: string, value: string, lat: number, lon: number}>>}
 *   Options shaped for the Q Desktop search picker.
 */
export async function searchUsCities(query, limit = 15) {
  if (!query || !query.trim()) return [];
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query.trim());
  // Always ask for the API max so US results have a chance to appear even
  // for ambiguous short prefixes. Open-Meteo caps `count` at 100.
  url.searchParams.set('count', '100');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const body = await fetchJson(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  const results = Array.isArray(body.results) ? body.results : [];

  // US-only filter (this applet's scope), then truncate to the caller's limit.
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  return results
    .filter((r) => r.country_code === 'US')
    .slice(0, safeLimit)
    .map((r) => geocodeResultToOption(r));
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
