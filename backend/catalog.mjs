import {OCCASIONS,CATEGORIES,appropriate,tagsFor,coverage} from '../shared/outfits.mjs';
import {withProductTags, PRODUCT_TAG_VERSION} from '../shared/product-tags.mjs';
const ROOTS={outer:['002'],top:['001'],bottom:['003','100'],shoes:['103']};
export function walk(node,out=[]){
 if(Array.isArray(node))for(const v of node)walk(v,out);
 else if(node&&typeof node==='object'){
  if(node.goodsNo&&node.goodsName&&node.thumbnail&&node.displayGenderText)out.push(node);
  for(const v of Object.values(node))walk(v,out);
 }return out;
}
export function attributes(name){
 const n=name.toLowerCase();
 const match=(groups,fallback)=>groups.find(([,words])=>words.some(w=>n.includes(w)))?.[0]||fallback;
 return {
 color:match([['black',['블랙','검정','black']],['white',['화이트','아이보리','크림','white','ivory']],['grey',['그레이','차콜','grey','gray','charcoal']],['navy',['네이비','navy']],['beige',['베이지','브라운','카멜','beige','brown']],['khaki',['카키','올리브','그린','khaki','green']],['blue',['블루','데님','인디고','blue','denim']],['point',['레드','핑크','옐로우','퍼플','red','pink','yellow','purple']]],'black'),
 season:match([['winter',['패딩','다운','기모','방한','무스탕','down','shearling']],['hot',['반팔','린넨','리넨','쇼츠','반바지','샌들','슬리퍼','shorts','sandal']],['chilly',['코트','울','플리스','후리스','니트','가디건','fleece','wool','coat','knit']],['warm',['반소매','티셔츠','tee','t-shirt']]],'mild'),
 occasion:match([['hiking',['등산','트레킹','트래킹','hiking','trekking']],['running',['러닝','런닝','running']],['exercise',['트레이닝','조거','training']],['work',['블레이저','슬랙스','로퍼','구두','수트','loafer','blazer']],['date',['코트','니트','가디건','펌프스','스커트','coat','cardigan']],['library',['후드','맨투맨','스웨트','hood','sweat']]],'daily')
 };
}
export async function merchantPage(url){
 const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Merchant HTTP '+r.status);
 const text=await r.text();
 const m=text.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
 if(!m)throw Error('Merchant structured data missing');
 return JSON.parse(m[1]);
}
function leaves(node,out=new Map()){
 if(Array.isArray(node))for(const v of node)leaves(v,out);
 else if(node&&typeof node==='object'){
  if(node.categoryCode&&node.categoryTitle&&node.hasSubCategory===false)out.set(node.categoryCode,node.categoryTitle);
  for(const v of Object.values(node))if(v&&typeof v==='object')leaves(v,out);
 }return out;
}
async function parallel(tasks,fn,limit=6){
 let at=0;const result=[];
 await Promise.all(Array.from({length:Math.min(limit,tasks.length)},async()=>{
  while(at<tasks.length){const task=tasks[at++];try{result.push(await fn(task))}catch{}}
 }));return result;
}
function supportedLeaf(category,title){
 if(category==='bottom')return /팬츠|슬랙스|하의|스커트|레깅스|오버올|pants|skirt|shorts/i.test(title)&&!/원피스|드레스|가방|백팩|지갑|백$|dress|bag/i.test(title);
 if(category==='shoes')return !/용품|보호 쿠션|패드|스프레이|탈취제|신발끈|구두약|염색제|신발 커버|주걱|깔창|브러시|구두솔|슈트리|키퍼/.test(title);
 return true;
}
export async function collectCatalog({occasion,minimum=2000}={}){
 const records=new Map(),soldOut=new Set(),sources=[],deadline=Date.now()+120000;
 function accept(data,source){
  for(const p of walk(data)){
   const label=p.displayGenderText;
   if(source.category==='bottom'&&source.code==='100'&&!/스커트|skirt/i.test(p.goodsName))continue;
   if(/(?:^|\s|\[|\()(?:키즈|주니어|아동|유아|kids|junior)(?:\s|\]|\)|$)/i.test(p.goodsName))continue;
   if(source.category==='shoes'&&/깔창|슈레이스|신발끈|슈케어|구두약|구두솔|구둣주걱|슈트리|부츠키퍼|신발.?커버|신발.?주머니|인솔|탈취제|shoelace|insole|shoe.?care/i.test(p.goodsName))continue;
   if(!['남성','여성','공용'].includes(label)||label!=='공용'&&label!==source.label)continue;
   if(p.isSoldOut){soldOut.add(p.goodsNo);continue}
   const price=Number(p.price);
   if(!Number.isSafeInteger(price)||price<=0||!String(p.thumbnail).startsWith('https://image.msscdn.net/'))continue;
   const item={id:p.goodsNo,name:p.goodsName.replace(/&amp;/g,'&'),category:source.category,gender:source.gender,
    unisex:label==='공용',sourceGender:label,genderOptions:label==='공용'?['men','women']:[source.gender],
    subcategory:source.title||'',...attributes(p.goodsName),image:p.thumbnail,
    sourceUrl:'https://www.musinsa.com/products/'+p.goodsNo,price,currency:'KRW',
    priceCheckedAt:new Date().toISOString(),availability:'in_stock'};
   item.occasions=tagsFor(item);
   const previous=records.get(item.id);
   if(!previous||(previous.unisex&&!item.unisex)||(!previous.subcategory&&item.subcategory))records.set(item.id,item);
  }
 }
 const roots=[];
 for(const [gender,gf,label]of [['men','M','남성'],['women','F','여성']])for(const [category,codes]of Object.entries(ROOTS))for(const code of codes)roots.push({gender,gf,label,category,code,title:''});
 await parallel(roots,async source=>{
  const data=await merchantPage('https://www.musinsa.com/category/'+source.code+'/goods?gf='+source.gf+'&sortCode=NEW');
  accept(data,source);
  for(const [code,title]of leaves(data)){
   if(!code.startsWith(source.code)||!supportedLeaf(source.category,title))continue;
   if(occasion&&!appropriate({name:title,category:source.category,occasion:'daily'},occasion))continue;
   sources.push({...source,code,title});
  }
  sources.push(source);
 });
 const unique=[...new Map(sources.map(s=>[s.gf+':'+s.code,s])).values()];
 const tasks=unique.flatMap(source=>['NEW','POPULAR'].map(sort=>({...source,sort})));
 await parallel(tasks,async source=>{
  if(Date.now()>deadline)return;
  const data=await merchantPage('https://www.musinsa.com/category/'+source.code+'/goods?gf='+source.gf+'&sortCode='+source.sort);
  accept(data,source);
 });
 const items=[...records.values()];
 if(!occasion&&items.length<minimum)throw Error('Expanded catalog below minimum: '+items.length);
 if(!occasion){const report=coverage(items);const gaps=Object.entries(report).flatMap(([gender,types])=>Object.entries(types).filter(([,row])=>row.minimum<4).map(([type])=>gender+'/'+type));if(gaps.length)throw Error('Insufficient type coverage: '+gaps.join(','));}
 if(occasion&&!items.some(i=>appropriate(i,occasion)))throw Error('No verified '+occasion+' products found');
 Object.defineProperty(items,'soldOutIds',{value:[...soldOut].filter(id=>!records.has(id)),enumerable:false});
 return items;
}
async function saveBatch(pool,items,kind,extra={}){
 const c=await pool.connect();
 try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(7100300)');
  const {rows:existing}=await c.query("SELECT id,data FROM catalog_items WHERE id=ANY($1::bigint[]) AND data->>'productTagVersion'=$2",[items.map(item=>item.id),String(PRODUCT_TAG_VERSION)]);
  const byId=new Map(existing.map(row=>[String(row.id),row.data]));
  const tagged=items.map(item=>{
   const previous=byId.get(String(item.id));
   return withProductTags(previous?.name===item.name
    ? {...item,productTags:previous.productTags,productTagVersion:previous.productTagVersion}
    : item);
  });
  await c.query(`INSERT INTO catalog_items(id,data,active,updated_at)
   SELECT (value->>'id')::bigint,value,true,now() FROM jsonb_array_elements($1::jsonb)
   ON CONFLICT(id) DO UPDATE SET data=excluded.data,active=true,updated_at=now()`,[JSON.stringify(tagged)]);
  if(items.soldOutIds?.length)await c.query('UPDATE catalog_items SET active=false WHERE id=ANY($1::bigint[])',[items.soldOutIds]);
  if(kind==='catalog_refresh'){
   const {rows:untagged}=await c.query("SELECT data FROM catalog_items WHERE active=true AND data->>'productTagVersion' IS DISTINCT FROM $1",[String(PRODUCT_TAG_VERSION)]);
   if(untagged.length)await c.query('UPDATE catalog_items AS item SET data=item.data || (patch.value - \'id\') FROM jsonb_array_elements($1::jsonb) AS patch(value) WHERE item.id=(patch.value->>\'id\')::bigint',[JSON.stringify(untagged.map(({data})=>({id:data.id,productTags:withProductTags(data).productTags,productTagVersion:PRODUCT_TAG_VERSION})))]);
  }
  const {rows}=await c.query('SELECT count(*)::int AS count FROM catalog_items WHERE active=true');
  const details={count:rows[0].count,collected:items.length,men:items.filter(i=>i.gender==='men'&&!i.unisex).length,women:items.filter(i=>i.gender==='women'&&!i.unisex).length,unisex:items.filter(i=>i.unisex).length,sort:'NEW+POPULAR',...extra};
  await c.query('INSERT INTO agent_runs(kind,status,details) VALUES($1,\'success\',$2)',[kind,JSON.stringify(details)]);
  await c.query('COMMIT');return details;
 }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}
export async function refreshCatalog(pool){
 try{return await saveBatch(pool,await collectCatalog(),'catalog_refresh')}
 catch(e){await pool.query("INSERT INTO agent_runs(kind,status,details) VALUES('catalog_refresh','failed',$1)",[JSON.stringify({message:e.message})]);throw e}
}
export async function expandCatalog(pool,occasion){
 if(!OCCASIONS.some(o=>o.id===occasion))throw Object.assign(Error('Unknown outfit type'),{status:400});
 const c=await pool.connect();let shouldCollect=false;
 try{
  await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(7100301)');
  const {rows}=await c.query("SELECT id FROM agent_runs WHERE kind='catalog_expand' AND details->>'occasion'=$1 AND created_at>now()-interval '20 minutes' LIMIT 1",[occasion]);
  if(!rows.length){await c.query("INSERT INTO agent_runs(kind,status,details) VALUES('catalog_expand','started',$1)",[JSON.stringify({occasion})]);shouldCollect=true}
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 if(!shouldCollect)return {throttled:true};
 try{return await saveBatch(pool,await collectCatalog({occasion,minimum:0}),'catalog_expand',{occasion})}
 catch(e){await pool.query("INSERT INTO agent_runs(kind,status,details) VALUES('catalog_expand','failed',$1)",[JSON.stringify({occasion,message:e.message})]);throw e}
}
export async function checkPrices(pool,ids){
 const {rows}=await pool.query('SELECT id,data,updated_at FROM catalog_items WHERE id=ANY($1::bigint[])',[ids]);
 return await Promise.all(rows.map(async row=>{
  const previous=row.data;
  try{
   const r=await fetch('https://www.musinsa.com/products/'+row.id,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error('Merchant HTTP '+r.status);
   const html=await r.text();
   const scripts=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
   let offer;
   const find=n=>{if(Array.isArray(n)){for(const v of n)find(v)}else if(n&&typeof n==='object'){if(n.offers)offer=Array.isArray(n.offers)?n.offers[0]:n.offers;for(const v of Object.values(n))if(typeof v==='object')find(v)}};
   for(const s of scripts){try{find(JSON.parse(s[1]))}catch{}}
   const price=Number(offer?.price??offer?.lowPrice);
   if(!Number.isSafeInteger(price)||price<=0)throw Error('Live price unavailable');
   const updated={...previous,price,priceCheckedAt:new Date().toISOString(),availability:String(offer.availability||'').includes('OutOfStock')?'sold_out':'in_stock'};
   const {priceCheckedAt,availability}=updated;
   await pool.query('UPDATE catalog_items SET data=data || $2::jsonb,updated_at=now() WHERE id=$1',[row.id,JSON.stringify({price,priceCheckedAt,availability})]);
   return {...updated,verification:'live'};
  }catch{return {...previous,verification:'cached',priceWarning:'실시간 확인 실패 · 마지막 수집 가격입니다.'}}
 }));
}
