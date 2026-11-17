import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile('index.html','utf8');
const ruleBundle=await readFile('assets/outfit-rules.js','utf8');
const catalog=JSON.parse(await readFile('catalog_300.json','utf8'));
function context(){
 const nodes=new Map();
 const element=()=>({style:{},classList:{add(){},remove(){}},appendChild(){},removeAttribute(){},getAttribute(){return ''}});
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},createElement:element,querySelectorAll(){return []}};
 const c=vm.createContext({document,console,window:{addEventListener(){}},alert(){}});
 vm.runInContext(ruleBundle,c);
 vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],c);c.window.applyPublicCatalog(catalog);return c;
}
test('new users have no sample clothing and recommendations use only owned items',()=>{
 const c=context();
 vm.runInContext(`initCloset(); if(closetItems.length!==0)throw Error('shared seed leaked');
 const quotas={outer:12,top:16,bottom:14,shoes:8};
 const own=Object.entries(quotas).flatMap(([category,count])=>CATALOG_ITEMS.filter(i=>i.gender==='men'&&i.category===category).slice(0,count));
 window.applyCloudCloset(own,'test-user');
 for(const temp of [0,8,17,24,30])for(const occ of OCCASIONS){
  currentWeather.temp=temp;currentOccasion=occ.id;recalculateRankedCombos();
  for(const combo of rankedCombos)for(const item of combo.items){
   const available=own.filter(o=>o.category===item.category&&isOccasionAppropriate(o));
   if(available.length&&(!item.isOwned||!own.some(o=>o.id===item.id)))throw Error('owned category replaced');
   if(!available.length&&recommendationMode!=='mixed')throw Error('missing automatic supplement');
   if(occ.id==='work'&&!isOccasionAppropriate(item))throw Error('formal violation');
  }
 }
 `,c);
});
test('formal rules reject hoodies, sweatshirts and sportswear including similar outfits',()=>{
 const c=context();
 assert.equal(vm.runInContext(`[
 {name:'후드 셔츠',category:'top',occasion:'work'},
 {name:'오버핏 맨투맨',category:'top',occasion:'work'},
 {name:'조거 트레이닝 팬츠',category:'bottom',occasion:'work'},
 {name:'가죽 스니커즈',category:'shoes',occasion:'work'},
 {name:'티셔츠',category:'top',occasion:'work'}
 ].every(item=>!isOccasionAppropriate(item,'work'))`,c),true);
 vm.runInContext(`currentOccasion='work';
 closetItems=[
 {id:1,category:'outer',name:'울 코트',gender:'men',color:'black',season:'mild',occasion:'work',isOwned:true},
 {id:2,category:'top',name:'면 드레스 셔츠',gender:'men',color:'white',season:'mild',occasion:'work',isOwned:true},
 {id:3,category:'bottom',name:'울 슬랙스',gender:'men',color:'black',season:'mild',occasion:'work',isOwned:true},
 {id:4,category:'shoes',name:'가죽 로퍼',gender:'men',color:'black',season:'mild',occasion:'work',isOwned:true},
 {id:5,category:'top',name:'후드 셔츠',gender:'men',color:'white',season:'mild',occasion:'work',isOwned:true}
 ];recalculateRankedCombos();
 if(rankedCombos.length!==1)throw Error('hoodie entered formal');
 if(buildSimilarVariants(rankedCombos[0]).length)throw Error('similar formal included hoodie');
 closetItems=closetItems.filter(i=>i.id!==2);recalculateRankedCombos();
 if(recommendationMode!=='mixed')throw Error('formal shortage did not supplement');
 if(rankedCombos.some(combo=>combo.items.some(item=>!isOccasionAppropriate(item))))throw Error('casual fallback');
 `,c);
});

test('automatic supplement fills only missing parts and restores owned mode when complete',()=>{
 const c=context();
 vm.runInContext(`
 currentOccasion='daily';
 const fixture=['outer','top','bottom','shoes'].map((category,i)=>({id:100+i,category,name:'fixture',gender:'men',color:'black',season:'mild',occasion:'daily',price:10000,sourceUrl:'https://www.musinsa.com/products/'+(100+i)}));
 CATALOG_ITEMS=fixture;
 closetItems=fixture.slice(0,3).map((item,i)=>({...item,id:i+1,isOwned:true,sourceCatalogId:item.id}));
 selectRecommendationMode('owned');
 if(recommendationMode!=='mixed'||!rankedCombos.length)throw Error('no fallback');
 if(rankedCombos[0].items.filter(item=>item.isOwned).length!==3)throw Error('owned parts not preserved');
 if(rankedCombos[0].items[3].isOwned)throw Error('missing shoes not supplemented');
 closetItems.push({...fixture[3],id:4,isOwned:true,sourceCatalogId:fixture[3].id});
 recalculateRankedCombos();
 if(recommendationMode!=='owned'||rankedCombos[0].items.some(item=>!item.isOwned))throw Error('owned mode not restored');
 selectRecommendationMode('catalog');
 if(recommendationMode!=='catalog')throw Error('explicit catalog mode overwritten');
 `,c);
});
