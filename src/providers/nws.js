import { USER_AGENT, WEATHER } from '../config/colors.js';

const NWS_BASE = 'https://api.weather.gov';

/**
 * GET helper for NWS endpoints. Adds the required User-Agent header and
 * parses JSON. Throws on non-2xx.
 *
 * @param {string} url
 * @returns {Promise<any>}
 */
async function nwsGet(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/geo+json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`NWS HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`);
  }
  return res.json();
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
 * @returns {Promise<{event: string, severity: string, headline: string, url: string} | null>}
 */
export async function getActiveAlert(lat, lon) {
  const latStr = Number(lat).toFixed(4);
  const lonStr = Number(lon).toFixed(4);
  const body = await nwsGet(`${NWS_BASE}/alerts/active?point=${latStr},${lonStr}`);
  const features = Array.isArray(body.features) ? body.features : [];
  if (features.length === 0) return null;

  const ranked = features
    .map((f) => f.properties || {})
    .filter((p) => p.event)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  if (ranked.length === 0) return null;

  const top = ranked[0];
  return {
    event: top.event,
    severity: top.severity || 'Unknown',
    headline: top.headline || top.event,
    url: top['@id'] || '',
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
 * "Snow Likely", "Heavy Snow", "Patchy Fog", etc.
 *
 * @param {string} shortForecast
 * @returns {string} A value from WEATHER.
 */
export function shortForecastToWeatherType(shortForecast) {
  if (!shortForecast || typeof shortForecast !== 'string') return WEATHER.UNKNOWN;
  const s = shortForecast.toLowerCase();

  // Order matters: more specific / more severe conditions first.
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
  return WEATHER.UNKNOWN;
}

/**
 * Build a clickable URL for the NWS public forecast page for a point.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
export function nwsForecastPageUrl(lat, lon) {
  return `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}`;
}
