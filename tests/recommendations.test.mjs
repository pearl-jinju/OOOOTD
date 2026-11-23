import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile('index.html','utf8');
const ruleBundle=await readFile('assets/outfit-rules-layers.js','utf8');
const catalog=JSON.parse(await readFile('catalog_300.json','utf8'));
function context(){
 const nodes=new Map();
 const element=()=>({style:{},classList:{add(){},remove(){},toggle(){}},querySelector(){return {hidden:false}},toggleAttribute(){},appendChild(){},removeAttribute(){},getAttribute(){return ''}});
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
 vm.runInContext(`currentOccasion='work';currentWeather={temp:8};
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
 if(rankedCombos[0].items.find(item=>item.category==='shoes').isOwned)throw Error('missing shoes not supplemented');
 closetItems.push({...fixture[3],id:4,isOwned:true,sourceCatalogId:fixture[3].id});
 recalculateRankedCombos();
 if(recommendationMode!=='owned'||rankedCombos[0].items.some(item=>!item.isOwned))throw Error('owned mode not restored');
 selectRecommendationMode('catalog');
 if(recommendationMode!=='catalog')throw Error('explicit catalog mode overwritten');
 `,c);
});

test('outfit layers adapt to weather, occasion and owned clothes',()=>{
 const c=context();
 vm.runInContext(`
  const base=['top','bottom','shoes'].map((category,i)=>({id:100+i,category,name:'fixture '+category,gender:'men',color:'black',season:'hot',occasion:'daily',isOwned:true}));
  const light={id:103,category:'outer',name:'summer linen blazer',gender:'men',color:'navy',season:'hot',occasion:'work'};
  const coat={...light,id:104,name:'wool overcoat',season:'winter'};
  currentOccasion='daily';currentWeather={temp:31};
  closetItems=[...base,{...coat,isOwned:true}];CATALOG_ITEMS=[light,coat];
  selectRecommendationMode('owned');
  if(recommendationMode!=='owned'||!rankedCombos.length||rankedCombos.some(combo=>combo.items.length!==3))throw Error('hot look needs an outer');
  if(!document.getElementById('lookbook-outer').hidden)throw Error('outer tile remained');
  currentWeather={temp:18};recalculateRankedCombos();
  if(recommendationMode!=='owned'||rankedCombos.some(combo=>combo.items.length!==3))throw Error('heavy outer appeared in mild weather');
  closetItems.push({...light,isOwned:true});
  recalculateRankedCombos();
  if(!rankedCombos.some(combo=>combo.items.length===3)||!rankedCombos.some(combo=>combo.items.length===4))throw Error('optional layering not available');
  closetItems=base;recalculateRankedCombos();
  if(recommendationMode!=='owned'||rankedCombos.some(combo=>combo.items.length!==3))throw Error('optional outer was suggested for purchase');
  currentWeather={temp:8};recalculateRankedCombos();
  if(recommendationMode!=='mixed'||!rankedCombos[0]?.items.some(item=>item.category==='outer'))throw Error('cold look missed layer');
  closetItems=[
   ...base.map((item,i)=>({...item,name:['Solid Long Sleeve Dress Shirt','Suit Trousers','Plain Toe Derby'][i]})),
   {...coat,isOwned:true}
  ];
  currentOccasion='interview';currentWeather={temp:31};recalculateRankedCombos();
  if(!rankedCombos.length||rankedCombos.some(combo=>combo.items.find(item=>item.category==='outer')?.id!==light.id))throw Error('hot interview lacks suitable jacket');
 `,c);
});

test('chat keeps strict owned mode, budgets and selected catalog products in the existing lookbook',async()=>{
 const c=context();
 await vm.runInContext(`(async()=>{
  currentWeather={temp:26,code:0,date:'2026-11-23'};
  const fixture=[
   {id:100,category:'top',name:'코튼 티셔츠',color:'white',price:18000},
   {id:101,category:'bottom',name:'네이비 바지',color:'navy',price:21000},
   {id:102,category:'shoes',name:'흰색 스니커즈',color:'white',price:17000},
   {id:103,category:'bottom',name:'검정 바지',color:'black',price:20000},
   {id:104,category:'shoes',name:'링크 없는 스니커즈',color:'white',price:1000,sourceUrl:'https://example.invalid/'}
  ].map(item=>({gender:'men',season:'hot',occasion:'daily',sourceUrl:'https://www.musinsa.com/products/'+item.id,...item}));
  CATALOG_ITEMS=fixture;
  closetItems=[{...fixture[0],id:1,isOwned:true}];
  chatClosetOwner='chat-test';
  const owned=await applyOutfitChat({mode:'owned'});
  if(owned.hasOutfit||owned.mode!=='owned'||!owned.shortage.includes('신발'))throw Error('strict owned supplemented');
  const products=await applyOutfitChat({category:'shoes',budget:20000},{action:'shop'});
  if(products.products.length!==1||products.products[0].id!==102)throw Error('catalog constraints ignored');
  const result=await applyOutfitChat({mode:'mixed',budget:40000,avoidColor:'black',avoidCategory:'bottom'},{productId:102});
  if(!result.hasOutfit||rankedCombos.some(combo=>!combo.items.some(i=>i.id===102)||
   combo.items.some(i=>i.category==='bottom'&&i.color==='black')))throw Error('follow-up constraints ignored');
  const tooSmall=await applyOutfitChat({mode:'mixed',budget:30000},{productId:102});
  if(tooSmall.hasOutfit)throw Error('total budget ignored');
  clearOutfitChat();
  if(recommendationMode!=='mixed'||!rankedCombos.length)throw Error('normal auto-supplement was not restored');
 })()`,c);
});

test('single garment replacement changes the displayed lookbook and preserves other items, pins and budgets',async()=>{
 const c=context();
 await vm.runInContext(`(async()=>{
  forecastDay='tomorrow';
  currentWeather={temp:26,code:0,date:'2026-11-24'};
  const fixture=[
   {id:501,category:'top',name:'티셔츠 A',color:'white',price:22000},
   {id:502,category:'top',name:'티셔츠 B',color:'black',price:26000},
   {id:503,category:'bottom',name:'면바지',color:'navy',price:20000},
   {id:504,category:'shoes',name:'검정 스니커즈',color:'black',price:23000},
   {id:505,category:'shoes',name:'흰색 스니커즈',color:'white',price:45000}
  ].map(item=>({gender:'men',season:'hot',occasion:'daily',...item}));
  CATALOG_ITEMS=fixture;
  selectRecommendationMode('catalog');
  const first=selectedLookbookItems();
  const firstTop=first.find(item=>item.category==='top');
  const wanted=fixture.find(item=>item.category==='top'&&item.id!==firstTop.id);
  const result=await applyOutfitChat({category:'top',preferColor:wanted.color},{action:'replace'});
  if(result.replacement?.current!==wanted.name)throw Error('did not use requested top');
  const after=selectedLookbookItems();
  if(after.some(item=>item.category!=='top'&&item!==first.find(base=>base.category===item.category)))throw Error('replaced a second item');
  const currentShoes=after.find(item=>item.category==='shoes');
  pinnedGarments.set('shoes',currentShoes);
  if(!(await applyOutfitChat({category:'shoes'},{action:'replace'})).error)throw Error('replaced a pinned item');
  pinnedGarments.delete('shoes');
  if(!(await applyOutfitChat({category:'shoes',budget:1},{action:'replace'})).error||selectedLookbookItems()!==after)throw Error('violated budget or discarded the current selection');
  if(!(await applyOutfitChat({category:'shoes'},{action:'replace'})).replacement)throw Error('shoe replacement failed');
  if(selectedLookbookItems().find(item=>item.category==='top')?.id!==wanted.id)throw Error('lost previous top replacement');
  restoreOriginalCombo();
  if(selectedLookbookItems()!==first)throw Error('restore did not recover the original selection');
 })()`,c);
});

test('multi-item adjustments apply together and respect locked outerwear rules',async()=>{
 const c=context();
 await vm.runInContext(`(async()=>{
  forecastDay='tomorrow';
  currentWeather={temp:18,code:0,date:'2026-11-24'};
  const item=(id,category,name,color,price)=>({id,category,name,color,price,gender:'men',season:'mild',occasion:'daily'});
  const top=item(601,'top','검정 티셔츠','black',20000);
  const light=item(602,'top','밝은 면 셔츠','white',21000);
  const pants=item(603,'bottom','면바지','navy',16000);
  const boots=item(604,'shoes','짙은 부츠','black',30000);
  const sneaker=item(605,'shoes','편한 스니커즈','white',31000);
  const outer=item(606,'outer','가벼운 린넨 재킷','beige',35000);
  CATALOG_ITEMS=[top,light,pants,boots,sneaker,outer];
  requestedRecommendationMode=recommendationMode='catalog';
  rankedCombos=[{items:[top,pants,boots]}];
  const edits=[{category:'top',tone:'light'},{category:'shoes',style:'comfortable'}];
  pinnedGarments.set('shoes',boots);
  if(!(await applyOutfitChat({edits},{action:'replace'})).error||selectedLookbookItems()[0]!==top)throw Error('partial update when a requested item is locked');
  pinnedGarments.delete('shoes');
  const result=await applyOutfitChat({edits},{action:'replace'});
  if(result.replacements?.length!==2||selectedLookbookItems().map(item=>item.id).join()!=='602,603,605')throw Error('did not apply both scoped edits');
  if(!(await applyOutfitChat({category:'outer',operation:'add'},{action:'replace'})).replacement||!selectedLookbookItems().some(item=>item.id===606))throw Error('optional outerwear was not added');
  if(!(await applyOutfitChat({category:'outer',operation:'remove'},{action:'replace'})).replacement||selectedLookbookItems().some(item=>item.category==='outer'))throw Error('optional outerwear was not removed');
  if(!(await applyOutfitChat({category:'top',operation:'remove'},{action:'replace'})).error)throw Error('removed a required garment');
 })()`,c);
});

test('per-item price cap does not accidentally cap the entire lookbook total',async()=>{
 const c=context();
 await vm.runInContext(`(async()=>{
  forecastDay='tomorrow';
  currentWeather={temp:26,code:0,date:'2026-11-24'};
  const item=(id,category,name,price)=>({id,category,name,price,gender:'men',color:'navy',season:'hot',occasion:'daily'});
  CATALOG_ITEMS=[
   item(701,'top','면 티셔츠',55000),item(702,'bottom','면바지',58000),
   item(703,'shoes','스니커즈',59000),item(704,'shoes','가죽 스니커즈',60000)
  ];
  const perItem=await applyOutfitChat({mode:'catalog',budget:59999,budgetScope:'item'});
  if(!perItem.hasOutfit||!perItem.budgetLabel.includes('하나당'))throw Error('per-item budget was applied to overall total');
  if(selectedLookbookItems().some(item=>item.price>59999)||chatCost(selectedLookbookItems())<=59999)throw Error('wrong affordable selection');
  const total=await applyOutfitChat({mode:'catalog',budget:59999,budgetScope:'outfit'});
  if(total.hasOutfit||!total.budgetLabel.includes('합계'))throw Error('total budget was not enforced');
 })()`,c);
});

test('budget-only catalog shopping returns actual matches and excludes unknown or higher prices',async()=>{
 const c=context();
 await vm.runInContext(`(async()=>{
  const item=(id,category,name,price,availability)=>({id,category,name,price,availability,sourceUrl:'https://www.musinsa.com/products/'+id});
  CATALOG_ITEMS=[
   item(801,'top','티셔츠',34999),item(802,'shoes','로퍼',35000),
   item(803,'bottom','면바지',35001),item(804,'outer','재킷',null),
   item(805,'shoes','운동화',30000,'sold_out')
  ];
  const result=await applyOutfitChat({budget:35000},{action:'shop'});
  if(result.error||result.productCount!==2||result.products.map(item=>item.id).join()!=='801,802')throw Error('budget-only lookup returned invalid products');
  window.ooootdShowCatalogBudget(35000,undefined,'로퍼');
  const body=document.getElementById('catalog-table-body').innerHTML;
  if(!body.includes('로퍼')||body.includes('티셔츠')||body.includes('운동화')||body.includes('면바지'))throw Error('catalog handoff lost price or keyword');
 })()`,c);
});
