# Changelog

## 1.0.2 — 2026-06-29

Maintenance release. No runtime behaviour change. All checks (32 tests,
ESLint, Prettier, TypeScript) green on the new versions before and after
the bumps.

### Tooling

- `tsconfig.json`: added explicit `types: ["node"]` so `tsc --noEmit`
  resolves Node built-in module typings under TypeScript 6 (which
  stopped auto-discovering `@types/node` from `node_modules`).
- Bumped dev-only dependencies via Dependabot, all CI-validated:
  - `typescript` 5.9.3 → 6.0.3
  - `eslint` 9.39.4 → 10.6.0
  - `@types/node` 20.19.43 → 26.0.1
  - `globals` 15.15.0 → 17.7.0
- Bumped GitHub Actions:
  - `actions/checkout` v4 → v7
  - `actions/setup-node` v4 → v6

## 1.0.1 — 2026-06-28

Follow-up release applying every finding from the v1.0.0 code review.

### Bug fixes

- **Click-to-open now opens the NWS forecast page, not a JSON file.** The
  alert key previously linked to `alert['@id']` which serves raw JSON.
  Both the alert and forecast cases now link to
  `forecast.weather.gov/MapClick.php?lat=X&lon=Y`.
- **Freezing Rain / Freezing Drizzle now classify as SNOW** instead of
  SHOWER. The previous `s.includes('rain')` branch caught these before
  the SNOW branch could. Tested.
- **No more silent grey-key fallback** when NWS returns zero daytime
  periods. The applet now surfaces "Forecast temporarily unavailable" as
  an error signal so the user knows something went wrong.

### Reliability

- **10-second timeout on every outbound HTTP call.** A new `fetchJson`
  helper in `src/util/http.js` wraps `globalThis.fetch` with an
  `AbortController` so slow NWS / Open-Meteo responses can't hang the
  polling loop.
- **All HTTP helpers route through `fetchJson`**: consistent error
  messages, consistent timeouts, consistent JSON parsing.
- **Alerts with no `event` field are dropped with a logger.warn**
  instead of silently. Same for unknown `shortForecast` values.

### Tests

- New `test/http.test.js` exercises the HTTP layer with a stubbed
  `globalThis.fetch`: User-Agent header, URL shape, 5xx surfacing,
  malformed JSON, timeout, alert ranking (multiple, missing event,
  all-missing), geocoding US-filter, count=100 parameter, limit
  truncation.
- New tests for freezing-rain classification and all-nighttime period
  handling.

### Tooling

- **Real install scripts** (`scripts/install.ps1`, `scripts/install.sh`)
  that do what we discovered Q Desktop actually requires: edit the
  registry at `~/.quio/v2/q_storage/main/extensions`, create the slot
  folder, run `npm install`, and back up the registry first.
- **Matching uninstall scripts** strip the entry, remove storage, drop
  the slot folder.
- README rewritten with the real install path (the previous "clone into
  q_extensions" instruction was wrong — Q Desktop doesn't scan the
  folder, it reads the registry).
- Dev helpers (`smoke`, `live`) moved out of `test/` and into
  `scripts/dev/` with `.dev.js` / `.dev.mjs` extensions so they can't be
  accidentally swept up by the test runner.
- Removed the broken `dev-charlotte.mjs` artifact.

### Internal

- `pointFactory` no longer double-resolves through `q.Effects[name]`
  (the lookup was a no-op since `q.Effects.X === 'X'` already).
- `getActiveAlert` no longer returns a `url` field (was unused after the
  click-fix).

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

| Feature               | weather-usa                        | weather-pro                            |
| --------------------- | ---------------------------------- | -------------------------------------- |
| API                   | NWS `/zones` (deprecating, drifts) | NWS `/points` + `/gridpoints` (stable) |
| Location picker       | 3,700+ NWS zone names              | City search via Open-Meteo geocoding   |
| Severe weather alerts | None                               | Flashing red key                       |
| Click action          | None                               | Opens NWS page                         |
| Forecast parsing      | Regex on prose                     | NWS `shortForecast` controlled vocab   |
| Module system         | CommonJS                           | ESM                                    |
| HTTP                  | `request-promise` (deprecated)     | Native `fetch`                         |
| Tests                 | Mocha                              | `node:test`                            |
| CI                    | None                               | GitHub Actions on 3 Node versions      |
