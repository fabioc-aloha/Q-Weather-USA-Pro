# Security

## Reporting a vulnerability

Please open a private security advisory on the GitHub repo, or email the maintainer listed in `package.json`. Do not file public issues for vulnerabilities.

## Threat model

Q Weather USA Pro is a local Q Desktop applet that:

- Runs as a local Node.js process under the Q Desktop daemon
- Calls two public, keyless APIs over HTTPS: [api.weather.gov](https://api.weather.gov) (NWS) and [geocoding-api.open-meteo.com](https://geocoding-api.open-meteo.com) (Open-Meteo)
- Posts signal payloads to the local Q Desktop daemon on `http://127.0.0.1:27301` (loopback only)
- Stores no user data, holds no credentials, and exposes no network listener

There is no internet-facing surface and no authentication boundary inside this code.

## Dependency audit triage

`npm audit` currently reports **8 vulnerabilities (2 critical, 6 moderate)**, all transitive through the upstream `daskeyboard-applet` SDK. None are reachable from this applet's code paths. Summary:

| Package | Severity | Advisory | Reachable here? | Why |
|---|---|---|---|---|
| `form-data` <2.5.4 | Critical | [GHSA-fjxv-7rqg-78g4](https://github.com/advisories/GHSA-fjxv-7rqg-78g4) — unsafe random boundary | **No** | No multipart uploads anywhere in this applet |
| `form-data` <2.5.6 | High | [GHSA-hmw2-7cc7-3qxx](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) — CRLF injection in multipart field names | **No** | Same — no multipart construction with user-controlled field names |
| `request` / `request-promise` | Moderate | Deprecated; multiple CVEs | **Indirect** | Used only by the SDK's signal transport to `http://127.0.0.1:27301` (loopback). No untrusted input flows through it. All public-API HTTP uses native `fetch` via `src/util/http.js`. |
| `qs` <6.14.1 | Moderate | [GHSA-6rw7-vpxm-498p](https://github.com/advisories/GHSA-6rw7-vpxm-498p) — DoS via arrayLimit bypass | **No** | No `qs` query-string parsing in this applet |
| `tough-cookie` <4.1.3 | Moderate | [GHSA-72xf-g2v4-qvf3](https://github.com/advisories/GHSA-72xf-g2v4-qvf3) — prototype pollution | **No** | No cookie handling |
| `uuid` <11.1.1 | Moderate | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — buffer bounds with `buf` arg | **No** | Install scripts use `crypto.randomUUID()`; no v3/v5/v6 with buf |

No upstream fix is available because `daskeyboard-applet@2.11.1` still depends on the deprecated `request`/`request-promise` family. The decision is to **defer** rather than fork the SDK, on the grounds that none of the defects are reachable given this applet's code paths.

### Watchlist

Revisit this triage when any of the following happens:

- `daskeyboard-applet` ships a release that drops `request` / `request-promise`
- A new advisory against the SDK's transitive deps becomes reachable from code paths this applet uses
- 2026-12-31 — re-audit and decide whether to fork or migrate the SDK if it remains unmaintained

## Application-code hardening notes

- All NWS / Open-Meteo data rendered into the hover/click HTML message is escaped via `escapeHtml()` in `src/render/forecast-to-keys.js`.
- All public-API URLs are built with the `URL` + `searchParams` API or with numerically validated lat/lon — no string-concatenation injection vectors.
- All `fetch` calls have a 10-second `AbortController` timeout (`src/util/http.js`).
- No secrets are stored or required. NWS and Open-Meteo are keyless.
- Install scripts (`scripts/install.ps1`, `scripts/install.sh`) back up the Q Desktop registry before mutating it, exclude `.git` / `.github` / `node_modules` / build artefacts from the slot copy, and pass arguments to the embedded Node script via `process.argv` (no shell interpolation).
