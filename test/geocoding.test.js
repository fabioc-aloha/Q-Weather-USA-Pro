import { test } from 'node:test';
import assert from 'node:assert/strict';

import { geocodeResultToOption, parseLocationKey } from '../src/providers/geocoding.js';

test('geocodeResultToOption builds key and value with state', () => {
  const opt = geocodeResultToOption({
    name: 'Charlotte',
    latitude: 35.2271,
    longitude: -80.8431,
    country_code: 'US',
    admin1: 'North Carolina',
  });
  assert.equal(opt.value, 'Charlotte, North Carolina');
  assert.equal(opt.lat, 35.2271);
  assert.equal(opt.lon, -80.8431);
  assert.match(opt.key, /^35\.2271,-80\.8431\|Charlotte, North Carolina$/);
});

test('geocodeResultToOption tolerates missing admin1', () => {
  const opt = geocodeResultToOption({
    name: 'Honolulu',
    latitude: 21.3069,
    longitude: -157.8583,
    country_code: 'US',
  });
  assert.equal(opt.value, 'Honolulu');
});

test('parseLocationKey round-trips with geocodeResultToOption', () => {
  const opt = geocodeResultToOption({
    name: 'Austin',
    latitude: 30.2672,
    longitude: -97.7431,
    country_code: 'US',
    admin1: 'Texas',
  });
  const parsed = parseLocationKey(opt.key);
  assert.ok(parsed);
  assert.equal(parsed.lat, 30.2672);
  assert.equal(parsed.lon, -97.7431);
  assert.equal(parsed.name, 'Austin, Texas');
});

test('parseLocationKey rejects malformed input', () => {
  assert.equal(parseLocationKey(null), null);
  assert.equal(parseLocationKey(''), null);
  assert.equal(parseLocationKey('NCZ071'), null, 'No pipe separator');
  assert.equal(parseLocationKey('not-a-number,also-not|City'), null);
});
