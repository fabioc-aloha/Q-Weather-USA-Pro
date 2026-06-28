# Changelog

## 1.0.0 — 2026-06-28

Initial release. Modern US weather applet for Das Keyboard Q, built fresh
on the lessons learned from `daskeyboard-applet--weather-usa`.

### Features

- **NWS forecast on 4 keys** — one daytime period per key, color-coded
  (yellow sunny, purple cloudy, blue rain, red storm, white snow).
- **Active alerts as a flashing red key** — when the National Weather
  Service has any active alert for your location, it pushes onto the first
  key and blinks. Highest-severity alert wins (Extreme > Severe > Moderate
  > Minor).
- **Click-to-open** — clicking a key opens the official NWS forecast page
  (or alert detail page if an alert is active) in your browser.
- **City search, no zone IDs** — type a city name; we resolve via
  Open-Meteo geocoding (free, no API key) and convert to a stable NWS
  grid lookup. No more "missing city" or stale zone-code drift.
- **Grid-based NWS lookup** — uses the modern `/points` + `/gridpoints`
  endpoints instead of the legacy `/zones` API. Survives NWS zone
  reorganizations.

### Engineering

- **Modern stack**: ESM, Node 18+ native `fetch`, `node:test`, ESLint flat
  config, Prettier, JSDoc with `tsc --checkJs`.
- **CI**: GitHub Actions matrix on Node 18 / 20 / 22.
- **Dependabot**: weekly npm + monthly GitHub Actions update PRs.
- **Single runtime dependency**: `daskeyboard-applet` (the Q SDK). No HTTP
  library; uses built-in `fetch`. No keyword matching on forecast prose;
  uses the structured `shortForecast` field.
- **MIT licensed.**

### Differences from `daskeyboard-applet--weather-usa`

| Feature | weather-usa | weather-pro |
|---|---|---|
| API | NWS `/zones` (deprecating, drifts) | NWS `/points` + `/gridpoints` (stable) |
| Location picker | 3,700+ NWS zone names | City search via Open-Meteo geocoding |
| Severe weather alerts | None | Flashing red key |
| Click action | None | Opens NWS page |
| Forecast parsing | Regex on prose | NWS `shortForecast` controlled vocab |
| Module system | CommonJS | ESM |
| HTTP | `request-promise` (deprecated) | Native `fetch` |
| Tests | Mocha | `node:test` |
| CI | None | GitHub Actions on 3 Node versions |
