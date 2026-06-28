import q from 'daskeyboard-applet';

import { searchUsCities, parseLocationKey } from './providers/geocoding.js';
import { resolvePoint, getForecast, getActiveAlert, nwsForecastPageUrl } from './providers/nws.js';
import { selectDaytimePeriods, renderRow, renderMessage } from './render/forecast-to-keys.js';

const logger = q.logger;

// Poll every 30 minutes. NWS asks consumers not to poll their endpoints more
// frequently than every ~10 minutes.
const POLL_INTERVAL_MS = 30 * 60 * 1000;

/**
 * One-entry cache for the resolved NWS forecast grid. The grid lookup is
 * stable per (lat, lon), so re-resolving on every poll would be wasteful.
 * Invalidated automatically when the configured location key changes.
 */
class PointCache {
  constructor() {
    this.locationKey = null;
    this.point = null;
  }

  set(key, point) {
    this.locationKey = key;
    this.point = point;
  }

  get(key) {
    return this.locationKey === key ? this.point : null;
  }
}

export class WeatherPro extends q.DesktopApp {
  constructor() {
    super();
    this.pollingInterval = POLL_INTERVAL_MS;
    this.pointCache = new PointCache();
  }

  /**
   * Q Desktop calls this for the location search picker. Forwards the
   * free-text query to the Open-Meteo geocoding provider (US-filtered).
   *
   * @param {string} _fieldId - Always 'location' for this applet.
   * @param {string} search - User's free-text query.
   * @returns {Promise<Array<{key: string, value: string}>>}
   */
  async options(_fieldId, search) {
    if (!search || !search.trim()) return [];
    try {
      const results = await searchUsCities(search, 15);
      logger.info(`Geocoding "${search}" returned ${results.length} US results.`);
      return results.map(({ key, value }) => ({ key, value }));
    } catch (err) {
      logger.error(`Geocoding error: ${err.message}`);
      return [];
    }
  }

  /**
   * Polling tick. Resolves the configured location to an NWS grid (cached),
   * fetches forecast + active alerts in parallel, and returns a Q Signal.
   *
   * @returns {Promise<object | null>}
   */
  async run() {
    const locationKey = this.config?.location;
    if (!locationKey) {
      logger.info('No location configured yet.');
      return null;
    }

    const parsed = parseLocationKey(locationKey);
    if (!parsed) {
      logger.error(`Could not parse location key: ${locationKey}`);
      return q.Signal.error([`Invalid location format. Please re-select your city.`]);
    }
    const { lat, lon, name } = parsed;

    try {
      let point = this.pointCache.get(locationKey);
      if (!point) {
        logger.info(`Resolving NWS grid for ${name} (${lat}, ${lon})`);
        point = await resolvePoint(lat, lon);
        this.pointCache.set(locationKey, point);
      }

      const [forecast, alert] = await Promise.all([
        getForecast(point.forecastUrl),
        getActiveAlert(lat, lon).catch((err) => {
          // Alerts are best-effort; a failure must not blank the forecast.
          logger.error(`Alerts fetch failed: ${err.message}`);
          return null;
        }),
      ]);

      const width = this.geometry?.width || 4;
      const periods = selectDaytimePeriods(forecast.periods, width);

      const row = renderRow({
        periods,
        width,
        alert,
        pointFactory: (color, effect) =>
          effect ? new q.Point(color, q.Effects[effect] || effect) : new q.Point(color),
      });

      return new q.Signal({
        points: [row],
        name: alert ? `${alert.event} \u2014 ${name}` : name,
        message: renderMessage({ locationName: name, alert, periods }),
        link: {
          url: alert?.url || nwsForecastPageUrl(lat, lon),
          label: alert ? 'View alert details' : 'Open NWS forecast',
        },
      });
    } catch (err) {
      logger.error(`run() failed: ${err.message}`);
      return q.Signal.error([`Weather Pro: ${err.message}`]);
    }
  }
}
