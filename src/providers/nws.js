import q from 'daskeyboard-applet';

import { fetchJson } from '../util/http.js';
import { USER_AGENT, WEATHER } from '../config/colors.js';

const logger = q.logger;
const NWS_BASE = 'https://api.weather.gov';

/**
 * GET helper for NWS endpoints. Adds the required User-Agent header and
 * the geo+json Accept type. Inherits timeout + error handling from fetchJson.
 *
 * @param {string} url
 * @returns {Promise<any>}
 */
function nwsGet(url) {
  return fetchJson(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/geo+json',
    },
  });
}

/**
 * Resolve a lat/lon to an NWS forecast grid. The grid metadata is stable
 * across NWS zone reorganisations (which is why we use it instead of zones).
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{forecastUrl: string, forecastHourlyUrl: string, gridId: string, gridX: number, gridY: number, city: string, state: string}>}
 */
export async function resolvePoint(lat, lon) {
  // NWS recommends 4 decimal places max for the points endpoint.
  const latStr = Number(lat).toFixed(4);
  const lonStr = Number(lon).toFixed(4);
  const body = await nwsGet(`${NWS_BASE}/points/${latStr},${lonStr}`);
  const p = body.properties || {};
  const rel = p.relativeLocation?.properties || {};
  return {
    forecastUrl: p.forecast,
    forecastHourlyUrl: p.forecastHourly,
    gridId: p.gridId,
    gridX: p.gridX,
    gridY: p.gridY,
    city: rel.city || '',
    state: rel.state || '',
  };
}

/**
 * Fetch the multi-day forecast for a previously-resolved point.
 *
 * @param {string} forecastUrl - The `forecast` URL from `resolvePoint()`.
 * @returns {Promise<{updated: string, periods: Array<object>}>}
 */
export async function getForecast(forecastUrl) {
  const body = await nwsGet(forecastUrl);
  const p = body.properties || {};
  return { updated: p.updated || '', periods: p.periods || [] };
}

/**
 * Fetch active alerts for a lat/lon. Returns the highest-severity alert
 * (or null if none), since the keyboard can only render one alert state.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{event: string, severity: string, headline: string} | null>}
 */
export async function getActiveAlert(lat, lon) {
  const latStr = Number(lat).toFixed(4);
  const lonStr = Number(lon).toFixed(4);
  const body = await nwsGet(`${NWS_BASE}/alerts/active?point=${latStr},${lonStr}`);
  const features = Array.isArray(body.features) ? body.features : [];
  if (features.length === 0) return null;

  const candidates = features.map((f) => f.properties || {});
  const eventful = candidates.filter((a) => a.event);
  const dropped = candidates.length - eventful.length;
  if (dropped > 0) {
    logger.warn(`Dropped ${dropped} NWS alert(s) with no 'event' field at ${latStr},${lonStr}`);
  }
  if (eventful.length === 0) return null;

  const ranked = eventful.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const top = ranked[0];
  return {
    event: top.event,
    severity: top.severity || 'Unknown',
    headline: top.headline || top.event,
  };
}

/**
 * NWS severity ordering: Extreme > Severe > Moderate > Minor > Unknown.
 *
 * @param {string} sev
 * @returns {number}
 */
export function severityRank(sev) {
  switch (sev) {
    case 'Extreme':
      return 4;
    case 'Severe':
      return 3;
    case 'Moderate':
      return 2;
    case 'Minor':
      return 1;
    default:
      return 0;
  }
}

/**
 * Map an NWS `shortForecast` string to one of our weather-type buckets.
 * `shortForecast` is a clean, controlled-vocabulary field — much more
 * reliable than regex-matching `detailedForecast`.
 *
 * Examples of values NWS returns: "Sunny", "Mostly Sunny", "Partly Cloudy",
 * "Cloudy", "Chance Showers And Thunderstorms", "Slight Chance Rain Showers",
 * "Snow Likely", "Heavy Snow", "Freezing Rain", "Patchy Fog", etc.
 *
 * @param {string} shortForecast
 * @returns {string} A value from WEATHER.
 */
export function shortForecastToWeatherType(shortForecast) {
  if (!shortForecast || typeof shortForecast !== 'string') return WEATHER.UNKNOWN;
  const s = shortForecast.toLowerCase();

  // Order matters: more specific / more severe conditions first. Note that
  // "Freezing Rain" / "Freezing Drizzle" must be classified as SNOW (frozen
  // precip) BEFORE the rain/drizzle branch would catch them.
  if (s.includes('freezing')) {
    return WEATHER.SNOW;
  }
  if (
    s.includes('snow') ||
    s.includes('blizzard') ||
    s.includes('flurries') ||
    s.includes('sleet')
  ) {
    return WEATHER.SNOW;
  }
  if (s.includes('thunderstorm') || s.includes('storm') || s.includes('hail')) {
    return WEATHER.STORM;
  }
  if (s.includes('rain') || s.includes('shower') || s.includes('drizzle')) {
    return WEATHER.SHOWER;
  }
  if (s.includes('cloud') || s.includes('overcast') || s.includes('fog')) {
    return WEATHER.CLOUDY;
  }
  if (s.includes('sunny')) {
    return WEATHER.SUNNY;
  }
  if (s.includes('clear') || s.includes('fair')) {
    return WEATHER.CLEAR;
  }
  logger.warn(`Unknown NWS shortForecast: "${shortForecast}"`);
  return WEATHER.UNKNOWN;
}

/**
 * Build a clickable URL for the NWS public forecast page for a point.
 *
 * Callers in this applet only pass numerically validated lat/lon (see
 * `parseLocationKey()`), so injection is not currently reachable. The
 * `encodeURIComponent` calls are defense-in-depth in case a future caller
 * forwards an unvalidated value.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
export function nwsForecastPageUrl(lat, lon) {
  const latEnc = encodeURIComponent(String(lat));
  const lonEnc = encodeURIComponent(String(lon));
  return `https://forecast.weather.gov/MapClick.php?lat=${latEnc}&lon=${lonEnc}`;
}
