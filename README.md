# Q Weather USA Pro — Das Keyboard Q applet

A modern US weather applet for the Das Keyboard Q series. Displays a 4-day
National Weather Service forecast as color-coded keys, and flashes a red
key when there's a severe-weather alert for your location. Click any key
to open the official NWS forecast page.

This is an actively-maintained alternative to the original
[`daskeyboard-applet--weather-usa`](https://github.com/daskeyboard/daskeyboard-applet--weather-usa),
rebuilt on the modern NWS API (so it doesn't break every time NWS
reorganizes their forecast zones) and on Open-Meteo geocoding (so you
search by city name, not by zone code).

## What it shows

Four keys, one per upcoming day:

| Color            | Weather                                                     |
| ---------------- | ----------------------------------------------------------- |
| Yellow           | Clear or sunny                                              |
| Purple           | Cloudy / overcast / fog                                     |
| Blue             | Rain / showers / drizzle                                    |
| Red              | Thunderstorm / hail                                         |
| White            | Snow / sleet / blizzard                                     |
| **Flashing red** | **Active severe-weather alert** (pushes onto the first key) |

Hover or click a key for the detailed forecast and to open the NWS page.

## Install

This applet is not in the Das Keyboard marketplace. Install it manually using
the included scripts. Q Desktop loads applets from a JSON **registry** at
`~/.quio/v2/q_storage/main/extensions`, **not** by scanning the
`q_extensions/` folder — so a plain folder copy will not work. The scripts
handle the registry edit, slot copy, and `npm install` in one shot. The
registry is backed up before every install or uninstall so changes are
always reversible.

### Prerequisites

- Das Keyboard Q series + Q Desktop app
- Node.js 18+ ([`nvm`](https://github.com/coreybutler/nvm-windows) or your installer of choice)
- Git, npm

### Windows (PowerShell)

```powershell
git clone https://github.com/fabioc-aloha/Q-Weather-USA-Pro.git
cd Q-Weather-USA-Pro
pwsh -File scripts/install.ps1
# To remove later:
pwsh -File scripts/uninstall.ps1
```

### macOS / Linux

```bash
git clone https://github.com/fabioc-aloha/Q-Weather-USA-Pro.git
cd Q-Weather-USA-Pro
bash scripts/install.sh
# To remove later:
bash scripts/uninstall.sh
```

Both scripts default to slot id `9001` and origin `(1, 1)` (which lights up
4 keys on the upper-left of your keyboard). To override:

```powershell
# Windows
pwsh -File scripts/install.ps1 -AppletId 9002 -Origin @{x=4; y=0}
```

```bash
# Mac / Linux
bash scripts/install.sh 9002 4 0    # appletId, originX, originY
```

After install, **start Q Desktop**, find **Q Weather USA Pro** in the applet
list, and use the search box to pick your city. The default is Charlotte, NC.

### Rollback

If anything goes wrong, the install script wrote a backup of the registry
to `~/.quio/v2/q_storage/main/extensions.bak-<timestamp>`. Stop Q Desktop,
copy the backup over the registry, and remove the slot/storage folders:

```powershell
# Windows
Stop-Process -Name das-keyboard-q
Copy-Item -Force "$env:USERPROFILE\.quio\v2\q_storage\main\extensions.bak-*" `
                 "$env:USERPROFILE\.quio\v2\q_storage\main\extensions"
```

### Dev mode (for development / experimentation)

Run the applet's data pipeline directly against the keyboard without
touching the install path. Q Desktop must be running.

```powershell
git clone https://github.com/fabioc-aloha/Q-Weather-USA-Pro.git
cd Q-Weather-USA-Pro
npm install

node scripts/dev/live.dev.mjs "Charlotte"
# or
node scripts/dev/live.dev.mjs "Seattle"
```

This bypasses the SDK and POSTs signals to Q Desktop directly, so it shows
the full data pipeline (geocode → resolve grid → forecast + alerts → keys)
without the install / configure cycle.

## Configure

In the Q Desktop applet settings, search for your city in the location
picker. Examples that work:

- `Charlotte` → Charlotte, North Carolina
- `Austin TX`
- `Seattle`
- `Honolulu`

The picker queries the Open-Meteo geocoding API live and shows up to 15
US matches. It resolves to a lat/lon, which the applet then uses to look
up the official NWS forecast grid.

## Data sources

| Purpose            | Provider                                 | Cost | API key |
| ------------------ | ---------------------------------------- | ---- | ------- |
| City search        | Open-Meteo geocoding                     | Free | None    |
| Forecast           | api.weather.gov (NWS grid endpoint)      | Free | None    |
| Alerts             | api.weather.gov (active alerts by point) | Free | None    |
| Forecast page link | forecast.weather.gov                     | Free | None    |

NWS asks API consumers to identify themselves with a User-Agent header —
this applet sends one identifying itself and linking to this repo per
their [documentation](https://www.weather.gov/documentation/services-web-api).

## Development

```powershell
npm install            # install deps
npm test               # run node:test suite
npm run lint           # eslint
npm run format:check   # prettier
npm run typecheck      # tsc --noEmit (JSDoc-driven)
```

CI runs all four on every push to `main` and every PR (Node 18 / 20 / 22).

## Project layout

```text
src/
  index.js                 # Bootstrap (Q Desktop entry point)
  weather-pro.js           # WeatherPro class (extends q.DesktopApp)
  providers/
    nws.js                 # NWS API client + shortForecast classifier
    geocoding.js           # Open-Meteo city search
  render/
    forecast-to-keys.js    # Forecast + alert -> Point row + HTML message
  util/
    http.js                # fetchJson helper (timeout + error wrapper)
  config/
    colors.js              # Palette, weather enum, User-Agent
  types.d.ts               # Ambient types for daskeyboard-applet SDK
test/
  http.test.js             # HTTP layer with stubbed fetch
  nws.test.js              # shortForecast classifier + severityRank + URL
  geocoding.test.js        # geocoding result mapping + key parsing
  render.test.js           # selectDaytimePeriods + renderRow + renderMessage
  fixtures/forecast-sample.json
scripts/
  install.ps1              # Windows: register applet with Q Desktop
  install.sh               # macOS / Linux: same, with Node-driven JSON edit
  uninstall.ps1            # Windows: remove registry entry + slot
  uninstall.sh             # macOS / Linux: same
  dev/
    live.dev.mjs           # Live test against real APIs + real keyboard
    smoke.dev.js           # Console-only smoke (no signal POST)
```

## Status

Active. v1.0.1. Contributions welcome.

## License

[MIT](LICENSE).
