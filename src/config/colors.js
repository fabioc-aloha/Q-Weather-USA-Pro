// User-Agent for all NWS API calls. NWS asks API consumers to identify
// themselves with contact info. See https://www.weather.gov/documentation/services-web-api
export const USER_AGENT =
  'q-weather-usa-pro/1.0.2 ' + '(https://github.com/fabioc-aloha/Q-Weather-USA-Pro)';

/**
 * Color palette used to render forecast keys.
 * Keys are weather-type identifiers returned by `shortForecastToWeatherType()`.
 */
export const COLORS = Object.freeze({
  CLEAR: '#FFFF00',
  SUNNY: '#FFFF00',
  CLOUDY: '#FF00FF',
  SHOWER: '#0000FF',
  STORM: '#FF0000',
  SNOW: '#FFFFFF',
  UNKNOWN: '#202020',
  ALERT: '#FF0000',
});

/**
 * Weather-type enum returned by the forecast parser.
 */
export const WEATHER = Object.freeze({
  CLEAR: 'CLEAR',
  SUNNY: 'SUNNY',
  CLOUDY: 'CLOUDY',
  SHOWER: 'SHOWER',
  STORM: 'STORM',
  SNOW: 'SNOW',
  UNKNOWN: 'UNKNOWN',
});
