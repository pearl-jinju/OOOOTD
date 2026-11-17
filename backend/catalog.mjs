const COUNTS={outer:40,top:45,bottom:40,shoes:25};
const CODES={outer:'002',top:'001',bottom:'003',shoes:'103'};
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
 season:match([['winter',['패딩','다운','기모','방한','무스탕','down','shearling']],['hot',['반팔','린넨','쇼츠','반바지','샌들','슬리퍼','shorts','sandal']],['chilly',['코트','울','플리스','후리스','니트','가디건','fleece','wool','coat','knit']],['warm',['반소매','티셔츠','tee','t-shirt']]],'mild'),
 occasion:match([['exercise',['러닝','트레이닝','조거','running','training']],['work',['블레이저','슬랙스','로퍼','구두','수트','loafer','blazer']],['date',['코트','니트','가디건','펌프스','스커트','coat','cardigan']],['library',['후드','맨투맨','스웨트','hood','sweat']]],'daily')
 };
}
export async function merchantPage(url){
 const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('Merchant HTTP '+r.status);
 const text=await r.text();
 const m=text.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
 if(!m)throw Error('Merchant structured data missing');
 return JSON.parse(m[1]);
}
export async function collectCatalog(){
 const items=[],seen=new Set();
 for(const [gender,gf,label]of [['men','M','남성'],['women','F','여성']]){
  for(const [category,count]of Object.entries(COUNTS)){
   let selected=0;
   for(let part=0;part<12&&selected<count;part++){
    const code=part?CODES[category]+String(part).padStart(3,'0'):CODES[category];
    const data=await merchantPage('https://www.musinsa.com/category/'+code+'/goods?gf='+gf+'&sortCode=NEW');
    for(const p of walk(data)){
     if(p.displayGenderText!==label||seen.has(p.goodsNo)||p.isSoldOut)continue;
     const price=Number(p.price);
     if(!Number.isSafeInteger(price)||price<=0||!String(p.thumbnail).startsWith('https://image.msscdn.net/'))continue;
     seen.add(p.goodsNo);
     items.push({id:p.goodsNo,name:p.goodsName.replace(/&amp;/g,'&'),category,gender,sourceGender:label,...attributes(p.goodsName),image:p.thumbnail,sourceUrl:'https://www.musinsa.com/products/'+p.goodsNo,price,currency:'KRW',priceCheckedAt:new Date().toISOString(),availability:'in_stock'});
     if(++selected===count)break;
    }
   }
   if(selected!==count)throw Error('Insufficient verified products: '+gender+'/'+category+' '+selected);
  }
 }
 if(items.length!==300)throw Error('Expected 300 products');
 return items;
}
export async function refreshCatalog(pool){
 try{
  const items=await collectCatalog();
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   await c.query('SELECT pg_advisory_xact_lock(7100300)');
   await c.query('UPDATE catalog_items SET active=false WHERE active=true');
   await c.query(`INSERT INTO catalog_items(id,data,active,updated_at)
     SELECT (value->>'id')::bigint,value,true,now() FROM jsonb_array_elements($1::jsonb)
     ON CONFLICT(id) DO UPDATE SET data=excluded.data,active=true,updated_at=now()`,[JSON.stringify(items)]);
   await c.query("INSERT INTO agent_runs(kind,status,details) VALUES('catalog_refresh','success',$1)",[JSON.stringify({count:items.length,men:150,women:150,sort:'NEW'})]);
   await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
  return {count:items.length};
 }catch(e){
  await pool.query("INSERT INTO agent_runs(kind,status,details) VALUES('catalog_refresh','failed',$1)",[JSON.stringify({message:e.message})]);
  throw e;
 }
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
   await pool.query('UPDATE catalog_items SET data=$2,updated_at=now() WHERE id=$1',[row.id,updated]);
   return {...updated,verification:'live'};
  }catch{return {...previous,verification:'cached',priceWarning:'실시간 확인 실패 · 마지막 수집 가격입니다.'}}
 }));
}
