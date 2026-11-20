import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {createApp} from '../backend/app.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const aliases = new Map([
 [digest('weather-audit:fixture-member').slice(0,24), 'A'],
 [digest('weather-audit:device:fixture-guest').slice(0,24), 'B'],
]);
const deviceToken = 'b'.repeat(43);

test('weather authorizes before reading cache or calling its provider', async () => {
 const audit = [];
 let calls = 0;
 const app = createApp({
  pool: {async query(sql, params) {
   assert.match(sql, /device_sessions.*expires_at>now/);
   assert.deepEqual(params, [digest(deviceToken)]);
   return {rows:[{user_id:'device:fixture-guest'}]};
  }},
  verify: async token => token === 'fixture-member-token' ? 'fixture-member' : null,
  weatherFetch: async url => {
   calls++;
   if (new URL(url).searchParams.get('latitude') === '35.1796') {
    throw Error('fixture provider error that should never enter the audit');
   }
   return Response.json({current_weather:{temperature:19}});
  },
  writeWeatherAudit: entry => audit.push(entry),
 });
 const cases = [
  ['A', 'fixture-member-token', 'Seoul', 200, 'allowed', 1],
  ['B', deviceToken, 'Seoul', 403, 'denied', 0],
  ['A', 'fixture-member-token', 'Busan', 502, 'provider_failed', 1],
  ['anonymous', null, 'Seoul', 401, 'unauthenticated', 0],
 ];
 for (const [accountAlias, token, city, status, decision, providerCalls] of cases) {
  const before = calls;
  const response = await app.fetch(new Request('https://test.invalid/weather?city='+city, {
   headers: token ? {Authorization:'Bearer '+token} : {},
  }));
  assert.equal(response.status, status);
  assert.equal(calls - before, providerCalls);
  const {time, accountAlias:loggedAlias, ...fields} = audit.at(-1);
  assert.equal(new Date(time).toISOString(), time);
  assert.equal(aliases.get(loggedAlias) ?? loggedAlias, accountAlias);
  assert.deepEqual(fields, {action:'weather_lookup',decision,providerCalls});
  console.log(JSON.stringify({time,accountAlias,...fields}));
 }
 assert.equal(audit.length, cases.length);
});
