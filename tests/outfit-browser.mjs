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
const channel = process.env.OOOOTD_TEST_BROWSER_CHANNEL;
const browser = await chromium.launch({headless:true, channel});
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
 await page.evaluate(() => {
  currentWeather = {temp:15};
  selectGender('men');
  selectOccasion('daily',false);
  selectRecommendationMode('catalog');
 });
 const currentTop = () => page.locator('#board-img-top').getAttribute('alt');
 const originalTop = await currentTop();
 const before = await page.evaluate(() => rankedCombos[currentRankIndex].items.map(item=>item.id));
 const pin = page.locator('#outfit-pin-top');
 await pin.click();
 assert.equal(await pin.getAttribute('aria-pressed'),'true');
 assert.equal(await currentTop(),originalTop);
 await page.locator('#next-combo-btn').click();
 assert.equal(await currentTop(),originalTop);
 const after = await page.evaluate(() => rankedCombos[currentRankIndex].items.map(item=>item.id));
 assert.notDeepEqual(after,before);
 await pin.click();
 assert.equal(await pin.getAttribute('aria-pressed'),'false');

 await page.evaluate(() => {
  const make = (id,category,name,color) => ({id,category,name,color,season:'mild',gender:'men',occasion:'interview'});
  window.applyPublicCatalog([
   make(101,'outer','클래식 울 블레이저','navy'),
   make(102,'top','긴팔 스판 언더셔츠 BOK-352 (검정)','black'),
   make(103,'bottom','울 슬랙스','navy'),
   make(104,'shoes','클래식 가죽 옥스포드 구두','black'),
  ]);
  selectOccasion('daily',false);
  selectRecommendationMode('catalog');
 });
 await pin.click();
 await page.evaluate(() => selectOccasion('interview',false));
 assert(await page.locator('#lookbook-top').isHidden());
 assert.match(await page.locator('#outfit-pin-status').textContent(),/고정 해제/);
 await page.evaluate(() => {
  window.applyPublicCatalog([...CATALOG_ITEMS,{
   id:105,category:'top',name:'솔리드 긴소매 드레스 셔츠',color:'white',season:'mild',gender:'men',occasion:'interview',
  }]);
 });
 assert.equal(await currentTop(),'솔리드 긴소매 드레스 셔츠');
 assert.deepEqual(errors,[]);
 console.log('PASS: 40 outfit scenarios, garment pinning, and interview base-layer regression.');
} finally {
 await browser.close();
}
