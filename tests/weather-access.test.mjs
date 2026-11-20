import assert from 'node:assert/strict';
import test from 'node:test';
import {createApp} from '../backend/app.mjs';

test('weather is public, validates cities, and caches forecasts', async () => {
 const audit = [];
 const forecast = {current_weather:{temperature:19},daily:{temperature_2m_max:[22,24]}};
 let calls = 0;
 const app = createApp({
  pool: {query() {assert.fail('Weather must not query account sessions');}},
  verify() {assert.fail('Weather must not verify accounts');},
  weatherFetch: async url => {
   calls++;
   const params = new URL(url).searchParams;
   assert.equal(params.get('timezone'), 'Asia/Seoul');
   assert.equal(params.get('forecast_days'), '2');
   if (params.get('latitude') === '35.1796') throw Error('Provider unavailable');
   return Response.json(forecast);
  },
  writeWeatherAudit: entry => audit.push(entry),
 });
 const cases = [
  ['Seoul', 200, 'allowed', 1],
  ['Seoul', 200, 'allowed_cached', 0],
  ['Busan', 502, 'provider_failed', 1],
  ['toString', 400, 'invalid_city', 0],
 ];
 for (const [city, status, decision, providerCalls] of cases) {
  const before = calls;
  const response = await app.fetch(new Request('https://test.invalid/weather?city='+city));
  assert.equal(response.status, status);
  if (response.ok) assert.deepEqual(await response.json(), forecast);
  assert.equal(calls - before, providerCalls);
  const {time, ...fields} = audit.at(-1);
  assert.equal(new Date(time).toISOString(), time);
  assert.deepEqual(fields, {accountAlias:'anonymous',action:'weather_lookup',decision,providerCalls});
 }
});
