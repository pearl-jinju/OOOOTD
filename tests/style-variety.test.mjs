import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {OCCASIONS,CATEGORIES,appropriate,genderCompatible,coverage} from '../shared/outfits.mjs';
const fixture=JSON.parse(await readFile('tests/fixtures/style-catalog.json','utf8'));
function engine(){
 const nodes=new Map(),element=()=>({style:{},classList:{add(){},remove(){}},appendChild(){},removeAttribute(){},getAttribute(){return ''}});
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},createElement:element,querySelectorAll(){return []},querySelector(){return null}};
 const c=vm.createContext({console,window:{addEventListener(){}},document});
 vm.runInContext(awaitRules,c);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],c);
 c.window.applyPublicCatalog(fixture);return c;
}
const awaitRules=await readFile('assets/outfit-rules-layers.js','utf8'),html=await readFile('index.html','utf8');
test('18 styles have real matching products for both genders in every category',()=>{
 assert.equal(OCCASIONS.length,18);
 const report=coverage(fixture);
 for(const gender of ['men','women'])for(const occasion of OCCASIONS){
  assert(report[gender][occasion.id].minimum>=6,gender+'/'+occasion.id);
 }
 assert(fixture.every(item=>item.price>0&&/^https:\/\/www.musinsa.com\/products\/\d+$/.test(item.sourceUrl)));
});
test('all 18 styles produce many unique valid outfits and can cycle beyond five',()=>{
 const c=engine();
 const result=vm.runInContext(`(()=>{
 requestedRecommendationMode='catalog';closetItems=[];let cases=0,min=200;
 for(const gender of ['men','women'])for(const occasion of OCCASIONS){
  currentGender=gender;currentOccasion=occasion.id;currentWeather.temp=15;recalculateRankedCombos();
  if(!rankedCombos.length)throw Error('empty '+gender+'/'+occasion.id);
  if(rankedCombos.some(combo=>combo.items.some(item=>!OOOOTD_RULES.genderCompatible(item,gender)||!isOccasionAppropriate(item))))throw Error('invalid style '+occasion.id);
  if(new Set(rankedCombos.map(combo=>combo.items.map(item=>item.id).join(','))).size!==rankedCombos.length)throw Error('duplicate combinations');
  if(rankedCombos.length>200)throw Error('unbounded ranking');
  if(rankedCombos.length>5){for(let i=0;i<6;i++)nextBestCombo();if(currentRankIndex!==6)throw Error('five-result cap remains')}
  min=Math.min(min,rankedCombos.length);cases++;
 }return {cases,min};
 })()`,c);
 assert.equal(result.cases,36);
 assert(result.min>=20,JSON.stringify(result));
});
test('special-purpose footwear is not replaced with unrelated shoes',()=>{
 for(const style of ['running','hiking','rainy']){
  assert.equal(appropriate({category:'shoes',name:'가죽 로퍼',occasion:style},style),false);
 }
 for(const style of ['work','interview','wedding','meeting']){
  assert.equal(appropriate({category:'top',name:'후드 셔츠',occasion:style},style),false);
 }
});
