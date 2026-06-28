import { shortForecastToWeatherType } from '../providers/nws.js';
import { COLORS, WEATHER } from '../config/colors.js';

/**
 * Select the daytime forecast periods that should be displayed across the
 * keyboard. NWS returns alternating daytime/nighttime periods (or only
 * daytime once it's already evening). This filters to daytime periods up
 * to the requested count, preserving order.
 *
 * @param {Array<object>} periods - NWS forecast periods.
 * @param {number} count - How many to keep.
 * @returns {Array<object>}
 */
export function selectDaytimePeriods(periods, count) {
  if (!Array.isArray(periods)) return [];
  const daytime = periods.filter((p) => p && p.isDaytime !== false);
  return daytime.slice(0, count);
}

/**
 * Render a forecast (and optional active alert) into a single row of points
 * suitable for a `q.Signal({ points: [<row>] })`.
 *
 * Layout when no alert is active:
 *   [day0, day1, day2, day3] (each color encodes the day's weather type)
 *
 * Layout when an alert is active:
 *   [ALERT, day0, day1, day2] (alert pushes the first forecast off the row)
 *
 * @param {object} args
 * @param {Array<object>} args.periods - NWS daytime periods (already filtered).
 * @param {number} args.width - Keyboard width in keys.
 * @param {object | null} args.alert - Active alert or null.
 * @param {(color: string, effect?: string) => object} args.pointFactory - Constructor for a Point (e.g. `(c, e) => new q.Point(c, e)`).
 * @param {string} [args.blinkEffect='BLINK'] - Effect name to use for the alert key.
 * @returns {Array<object>} A row of point objects (length === width).
 */
export function renderRow({ periods, width, alert, pointFactory, blinkEffect = 'BLINK' }) {
  const row = [];

  if (alert) {
    row.push(pointFactory(COLORS.ALERT, blinkEffect));
  }

  for (const period of periods) {
    if (row.length >= width) break;
    const type = shortForecastToWeatherType(period.shortForecast);
    const color = COLORS[type] || COLORS.UNKNOWN;
    row.push(pointFactory(color));
  }

  // Pad with UNKNOWN keys if we have fewer forecast periods than width.
  while (row.length < width) {
    row.push(pointFactory(COLORS.UNKNOWN));
  }

  return row.slice(0, width);
}

/**
 * Compose the HTML message body shown when the user hovers / clicks a key.
 *
 * @param {object} args
 * @param {string} args.locationName
 * @param {object | null} args.alert
 * @param {Array<object>} args.periods
 * @returns {string}
 */
export function renderMessage({ locationName, alert, periods }) {
  const parts = [];
  parts.push(`<div><b>Weather Forecast for ${escapeHtml(locationName)}:</b></div>`);
  if (alert) {
    parts.push(
      `<div style="color:#c00"><b>[${escapeHtml(alert.severity)}] ${escapeHtml(alert.event)}</b><br>${escapeHtml(alert.headline)}</div>`,
    );
  }
  for (const p of periods) {
    const detailed = (p.detailedForecast || p.shortForecast || '').replace(/\s+/g, ' ').trim();
    parts.push(`<em>${escapeHtml(p.name)}:</em> <div>${escapeHtml(detailed)}</div>`);
  }
  return parts.join('\n');
}

/**
 * Minimal HTML escape for message text. Sufficient for NWS-supplied forecast
 * strings, which contain plain prose.
 *
 * @param {string} s
 * @returns {string}
 */
export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Re-export so callers don't have to import from two places.
export { COLORS, WEATHER };
