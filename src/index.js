// Bootstrap entry point. Q Desktop invokes this via `node src/index.js`.
// Tests import the class from `./weather-pro.js` instead so they don't
// trigger SDK constructor side-effects (signal handlers, polling, etc.).

import { WeatherPro } from './weather-pro.js';

new WeatherPro();
