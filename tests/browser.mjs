import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
const dev=JSON.parse(await readFile('.build/dev-config.json','utf8'));
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/cloud-config.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(dev));return}
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root)){res.writeHead(403).end();return}
  const data=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404).end()}
});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const ca=await browser.newContext({viewport:{width:1280,height:900}}),cb=await browser.newContext();
 const a=await ca.newPage(),b=await cb.newPage();
 const errors=[];a.on('pageerror',e=>errors.push(e.message));
 for(const page of [a,b]){await page.route(/api\.open-meteo\.com|\/weather\?city=/,route=>route.fulfill({json:{current_weather:{temperature:15,weathercode:0,windspeed:2},daily:{time:['2026-11-17','2026-11-18'],temperature_2m_min:[5,5],temperature_2m_max:[15,13],weather_code:[0,3],precipitation_probability_max:[0,40]}}}));await page.goto('http://localhost:4173',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ooootdCloudReady===true).catch(async e=>{console.log('UI errors',errors,'cloud message',await page.locator('#cloud-message').textContent());throw e})}
 assert.equal(await a.locator('#closet-count').textContent(),'0');
 assert.equal(await b.locator('#closet-count').textContent(),'0');
 await a.locator('.tab-btn[onclick*="closetTab"]').click();
 assert.equal(await a.locator('#trial-import').count(),0);
 await a.locator('#upload-form').evaluate(form=>{form.closest('details').open=true});
 await a.locator('#upload-name').fill('Test Cotton Shirt');
 await a.locator('#upload-category').selectOption('top');
 assert.equal(await a.locator('#capture-image').getAttribute('capture'),'environment');
 const picker=a.waitForEvent('filechooser');
 await a.locator('#take-photo').click();
 assert.equal(await (await picker).element().getAttribute('id'),'capture-image');
 await a.locator('#capture-image').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU1sAAAAASUVORK5CYII=','base64')});
 await a.locator('#upload-submit').click();
 await a.waitForFunction(()=>document.getElementById('closet-count').textContent==='1');
 const publicCount=Number(await b.locator('#catalog-count').textContent());
 assert(publicCount>=300);
 assert.equal(Number(await a.locator('#catalog-count').textContent()),publicCount);
 assert.equal(await a.locator('.occasion-card').count(),18);
 assert.equal(await a.locator('.item-source').count(),4);
 assert((await a.locator('.item-source').allTextContents()).some(t=>t.includes('내 옷!')));
 await a.getByText('내 신체 사이즈 · 선택 입력',{exact:true}).click();
 await a.locator('#size-height').fill('178');await a.locator('#size-top').fill('L');
 await a.locator('#size-save').click();await a.waitForFunction(()=>document.getElementById('cloud-message').textContent.includes('사이즈를'));
 await a.reload({waitUntil:'domcontentloaded'});await a.waitForFunction(()=>window.ooootdCloudReady);
 assert.equal(await a.locator('#closet-count').textContent(),'1');
 assert.equal(await a.locator('#size-height').inputValue(),'178');
 assert.equal(await b.locator('#size-height').inputValue(),'');
 await a.evaluate(()=>selectOccasion('work'));
 const names=await a.locator('.item-name').allTextContents();
 assert(names.every(n=>!/후드|맨투맨|조거|트레이닝|hood|sweat|jogger/i.test(n)));
 await a.evaluate(()=>selectOccasion('interview'));
 await a.locator('.tab-btn[onclick*="recommendTab"]').click();
 const interviewNames=await a.locator('.item-name').allTextContents();
 assert(interviewNames.length===4);
 assert(interviewNames.every(name=>!/tracksuit|short[ _-]*sleeve|henley|paisley|pattern/i.test(name)));
 await a.waitForFunction(()=>[...document.querySelectorAll('#capture-outfit-container img')].every(img=>img.complete&&img.naturalWidth>0));
 await a.locator('#capture-outfit-container').screenshot({path:'.build/qa-interview.png'});
 await a.evaluate(()=>selectOccasion('daily'));
 await a.locator('.tab-btn[onclick*="recommendTab"]').click();
 await a.locator('#similar-combo-btn').click();
 assert.equal(await a.locator('#restore-combo-btn').isVisible(),true);
 await a.locator('#restore-combo-btn').click();
 await a.locator('#mode-catalog').click();
 assert((await a.locator('.item-source').allTextContents()).every(text=>text.includes('추천의상')));
 assert.equal(await a.locator('#purchase-summary').isVisible(),true);
 assert.equal(await a.locator('[data-price-for] a').count(),4);
 assert((await a.locator('#purchase-total').textContent()).includes('원'));
 await a.locator('#mode-owned').click();
 assert((await a.locator('.item-source').allTextContents()).some(text=>text.includes('내 옷!')));
 await a.locator('#forecast-day').selectOption('tomorrow');
 await a.waitForFunction(()=>document.getElementById('weather-condition').textContent.includes('내일'));
 assert.equal(await a.locator('#weather-temp').textContent(),'9°C');
 assert((await a.locator('#weather-tip').textContent()).includes('최저 5°C / 최고 13°C'));
 assert((await a.locator('#lookbook-day-title').textContent()).includes('내일'));
 await a.screenshot({path:'.build/qa-desktop.png',fullPage:true});
 await a.setViewportSize({width:390,height:844});
 await a.screenshot({path:'.build/qa-mobile.png',fullPage:true});
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: real browser independent users, private upload, owned badges, size save and reload, formal hoodie exclusion, similar and restore; desktop/mobile screenshots saved');
}finally{await browser.close();await new Promise(r=>server.close(r))}
