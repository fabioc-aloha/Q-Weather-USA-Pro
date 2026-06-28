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

| Color | Weather |
|---|---|
| Yellow | Clear or sunny |
| Purple | Cloudy / overcast / fog |
| Blue | Rain / showers / drizzle |
| Red | Thunderstorm / hail |
| White | Snow / sleet / blizzard |
| **Flashing red** | **Active severe-weather alert** (pushes onto the first key) |

Hover or click a key for the detailed forecast and to open the NWS page.

## Install

This applet is not in the Das Keyboard marketplace. Install it manually:

### Prerequisites

- Das Keyboard Q series + Q Desktop app
- Node.js 18+ ([`nvm`](https://github.com/coreybutler/nvm-windows) or your installer of choice)
- Git

### Option 1: Sideload into Q Desktop

This is the right choice if you just want to use the applet daily.

```powershell
# 1. Close the Q Desktop app completely (right-click tray icon -> Quit)
# 2. Clone next to the existing extensions
cd "$env:USERPROFILE\.quio\v2\q_extensions"
git clone https://github.com/fabioc-aloha/Q-Weather-USA-Pro.git Q-Weather-USA-Pro

# 3. Install runtime dependencies
cd Q-Weather-USA-Pro
npm install --omit=dev

# 4. Restart Q Desktop. The new applet appears as "Q Weather USA Pro".
```

To uninstall, delete `~/.quio/v2/q_extensions/Q-Weather-USA-Pro/` and restart
Q Desktop.

### Option 2: Dev mode (for development / experimentation)

Run the applet directly. It sends signals to your keyboard in real time
without going through the Q Desktop install path.

```powershell
git clone https://github.com/fabioc-aloha/Q-Weather-USA-Pro.git
cd Q-Weather-USA-Pro
npm install

# Replace lat/lon with your location. Q Desktop must be running.
node src/index.js dev '{\"applet\":{\"user\":{\"location\":\"35.2271,-80.8431|Charlotte, NC\"}},\"geometry\":{\"width\":4,\"height\":1,\"origin\":{\"x\":1,\"y\":1}}}'
```

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

| Purpose | Provider | Cost | API key |
|---|---|---|---|
| City search | Open-Meteo geocoding | Free | None |
| Forecast | api.weather.gov (NWS grid endpoint) | Free | None |
| Alerts | api.weather.gov (active alerts by point) | Free | None |
| Forecast page link | forecast.weather.gov | Free | None |

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
  config/
    colors.js              # Palette, weather enum, User-Agent
test/
  nws.test.js
  geocoding.test.js
  render.test.js
  fixtures/forecast-sample.json
```

## Status

Active. v1.0.0. Contributions welcome.

## License

[MIT](LICENSE).
