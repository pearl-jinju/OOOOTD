import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {OCCASIONS, appropriate, genderCompatible, outerwearPolicy, suitableWeatherItem} from '../shared/outfits.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [html, rules, fixture] = await Promise.all([
 read('index.html'), read('assets/outfit-rules-layers.js'), read('tests/fixtures/style-catalog.json').then(JSON.parse),
]);
const origin = 'http://outfit-check.test';
const browser = await chromium.launch({headless:true});
const categories = ['outer','top','bottom','shoes'];
const core = ['top','bottom','shoes'];
const errors = [];

try {
 const page = await browser.newPage({viewport:{width:1280,height:900}});
 page.on('pageerror', error => errors.push(error.message));
 await page.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin === origin && url.pathname === '/') return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
  if (url.origin === origin && url.pathname === '/assets/outfit-rules-layers.js') {
   return route.fulfill({contentType:'text/javascript; charset=utf-8',body:rules});
  }
  // The browser exercises the site's own recommendation code against a fixed catalog and weather.
  return route.abort();
 });
 await page.goto(origin);
 await page.evaluate(items => window.applyPublicCatalog(items), fixture);

 const verify = async ({occasion, gender, temp}) => {
  const weather = {temp};
  const policy = outerwearPolicy(weather, occasion);
  const label = [gender, occasion, temp].join('/');
  const cards = await page.evaluate(({occasion,gender,temp,categories}) => {
   currentWeather = {temp};
   selectGender(gender);
   selectOccasion(occasion, false);
   selectRecommendationMode('catalog');
   return categories.flatMap(category => {
    const card = document.getElementById('lookbook-' + category);
    return card.hidden ? [] : [{category, name:card.querySelector('img').alt}];
   });
  }, {occasion,gender,temp,categories});
  assert.deepEqual(cards.map(card => card.category).filter(category => category !== 'outer'), core, label);
  if (policy === 'required') assert(cards.some(card => card.category === 'outer'), label + ' requires outerwear');
  if (policy === 'omit') assert(!cards.some(card => card.category === 'outer'), label + ' must omit outerwear');
  for (const card of cards) {
   assert(fixture.some(item => item.category === card.category && item.name === card.name &&
    appropriate(item, occasion, gender) && genderCompatible(item, gender) && suitableWeatherItem(item, weather)),
   label + ' displayed an unsuitable garment: ' + card.name);
  }
 };

 for (const gender of ['men','women']) {
  for (const {id:occasion} of OCCASIONS) await verify({occasion,gender,temp:15});
  await verify({occasion:'daily',gender,temp:31});
  await verify({occasion:'daily',gender,temp:4});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: 40 browser checks across occasions, genders and temperatures.');
} finally {
 await browser.close();
}
