import {CLOTHING_COLORS} from '../shared/colors.mjs';
import {createChatHandler} from './chat.mjs';
import {gzipSync} from 'node:zlib';
import {OCCASIONS as OUTFIT_TYPES} from '../shared/outfits.mjs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {parseTriggerDelivery} from '@neon/functions/triggers';
import {attributes,refreshCatalog,checkPrices,expandCatalog,withCatalogTags} from './catalog.mjs';
export const BUCKET='closet-images';
const CATEGORIES=['outer','top','bottom','shoes'],GENDERS=['men','women'];
const COLORS=Object.keys(CLOTHING_COLORS);
const SEASONS=['winter','chilly','mild','warm','hot'];
const OCCASIONS=OUTFIT_TYPES.map(occasion=>occasion.id);
export function validateMetadata(input){
 const name=String(input.name||'').trim().slice(0,160);
 if(!name||!CATEGORIES.includes(input.category)||!GENDERS.includes(input.gender)||!COLORS.includes(input.color)||!SEASONS.includes(input.season)||!OCCASIONS.includes(input.occasion))throw Object.assign(Error('옷 정보를 확인해주세요.'),{status:400});
 return {name,category:input.category,gender:input.gender,color:input.color,season:input.season,occasion:input.occasion};
}
export function imageType(bytes){
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return ['image/jpeg','jpg'];
 if(bytes[0]===137&&Buffer.from(bytes.subarray(1,8)).toString('hex')==='504e470d0a1a0a')return ['image/png','png'];
 if(Buffer.from(bytes.subarray(0,4)).toString()==='RIFF'&&Buffer.from(bytes.subarray(8,12)).toString()==='WEBP')return ['image/webp','webp'];
 throw Object.assign(Error('JPG·PNG·WebP 이미지가 필요합니다.'),{status:400});
}
export function createApp({pool,verify,storage,analyze,weatherFetch=fetch,chatOptions,writeWeatherAudit=entry=>console.info(JSON.stringify(entry)),allowedOrigins=['https://ooootd.onrender.com','http://localhost:4173']}){
 const weatherCache=new Map();
 const chat=createChatHandler(chatOptions);
 let catalogCache=null;
 async function resolveSession(request){
   const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
   let userId;
   let role;
   if(token){
    try{userId=await verify(token)}catch{}
    if(userId)role='member';
    if(!userId&&/^[A-Za-z0-9_-]{43}$/.test(token)){
     const {rows}=await pool.query('SELECT user_id FROM device_sessions WHERE token_hash=$1 AND expires_at>now()',[createHash('sha256').update(token).digest('hex')]);
     userId=rows[0]?.user_id;
     if(userId)role='guest';
    }
   }
   return {userId,role};
 }
 async function owned(userId,fn){
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   await c.query('SET LOCAL ROLE ooootd_app');
   await c.query("SELECT set_config('app.user_id',$1,true)",[userId]);
   const value=await fn(c);
   await c.query('COMMIT');return value;
  }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
 }
 async function closetMember(request, userId, role){
  if(role==='member')return userId;
  const token=request.headers.get('x-ooootd-member');
  if(!token)return null;
  try{return await verify(token)||null}catch{return null}
 }
 function logCloset(c,userId,memberId,id,item,action){
  return c.query(
   'INSERT INTO ooootd_closet_activity(closet_owner_id,member_id,garment_id,garment_name,category,action) VALUES($1,$2,$3,$4,$5,$6)',
   [userId,memberId,id,String(item?.name??'').slice(0,160),item?.category??'unknown',action]
  );
 }
 return {async fetch(request){
  const origin=request.headers.get('origin');
  const headers={'Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(origin&&allowedOrigins.includes(origin)){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='Authorization,Content-Type,X-OOOOTD-Member';headers['Access-Control-Allow-Methods']='GET,POST,PUT,DELETE,OPTIONS'}
  const reply=(data,status=200)=>Response.json(data,{status,headers});
  if(origin&&!allowedOrigins.includes(origin))return reply({error:'Origin not allowed'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const path=new URL(request.url).pathname.replace(/\/$/,'')||'/';
  try{
   if(path==='/cron/catalog'&&request.method==='POST'){
    const parsed=await parseTriggerDelivery(request);
    if(!parsed.ok||parsed.invocation.type!=='schedule')return reply({error:'Unauthorized trigger'},401);
    const result=await refreshCatalog(pool);catalogCache=null;return reply(result);
   }
   if(path==='/weather'&&request.method==='GET'){
    let providerCalls=0;
    const finish=(decision,body,status=200)=>{
     writeWeatherAudit({time:new Date().toISOString(),accountAlias:'anonymous',action:'weather_lookup',decision,providerCalls});
     return reply(body,status);
    };
    const cities={Seoul:[37.5665,126.978],Busan:[35.1796,129.0756],Incheon:[37.4563,126.7052],Daegu:[35.8714,128.6014],Daejeon:[36.3504,127.3845],Gwangju:[35.1595,126.8526],Jeju:[33.4996,126.5312]};
    const city=new URL(request.url).searchParams.get('city')||'Seoul';
    if(!Object.hasOwn(cities,city))return finish('invalid_city',{error:'Unknown city'},400);
    const cached=weatherCache.get(city);
    if(cached&&Date.now()-cached.time<600000)return finish('allowed_cached',cached.data);
    const [lat,lon]=cities[city];
    let data;
    try{
     providerCalls++;
     const response=await weatherFetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&forecast_days=2&timezone=Asia%2FSeoul',{signal:AbortSignal.timeout(10000)});
     if(!response.ok)return finish('provider_failed',{error:'Forecast unavailable'},502);
     data=await response.json();
    }catch{return finish('provider_failed',{error:'Forecast unavailable'},502)}
    weatherCache.set(city,{time:Date.now(),data});
    return finish('allowed',data);
   }
   // This route contains only the public shopping catalog, never user clothes.
   if(path==='/catalog'&&request.method==='GET'){
    if(catalogCache&&Date.now()-catalogCache.time<15000){
     if(request.headers.get('accept-encoding')?.includes('gzip'))return new Response(catalogCache.gzip,{headers:{...headers,'Content-Type':'application/json','Content-Encoding':'gzip'}});
     return new Response(catalogCache.json,{headers:{...headers,'Content-Type':'application/json'}});
    }
    const {rows}=await pool.query('SELECT data FROM catalog_items WHERE active=true ORDER BY id');
    const {rows:runs}=await pool.query("SELECT status,created_at,details FROM agent_runs WHERE kind IN ('catalog_refresh','catalog_expand') AND status='success' ORDER BY id DESC LIMIT 1");
    const json=JSON.stringify({items:rows.map(r=>withCatalogTags(r.data)),lastRun:runs[0]||null});
    catalogCache={time:Date.now(),json,gzip:gzipSync(json)};
    if(request.headers.get('accept-encoding')?.includes('gzip'))return new Response(catalogCache.gzip,{headers:{...headers,'Content-Type':'application/json','Content-Encoding':'gzip'}});
    return new Response(json,{headers:{...headers,'Content-Type':'application/json'}});
   }
   if(path==='/session'&&request.method==='POST'){
    const token=randomBytes(32).toString('base64url');
    let userId='device:'+randomUUID();
    if(request.headers.get('content-type')?.includes('application/json')){
     const body=await request.json();
     if(body.claim){
      const {rows}=await pool.query('UPDATE device_claims SET used=true WHERE claim_hash=$1 AND used=false AND expires_at>now() RETURNING user_id',[createHash('sha256').update(String(body.claim)).digest('hex')]);
      if(!rows[0])return reply({error:'옷장 연결 링크가 만료되었거나 이미 사용되었습니다.'},400);
      userId=rows[0].user_id;
     }
    }
    await pool.query('INSERT INTO device_sessions(token_hash,user_id) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash',[createHash('sha256').update(token).digest('hex'),userId]);
    return reply({token,userId},201);
   }
   const {userId,role}=await resolveSession(request);
   if(!userId)return reply({error:'로그인이 필요합니다.'},401);
   if(request.method==='POST'&&(path==='/chat/interpret'||path==='/chat/transcribe'))return await chat(request,path,userId,reply);
   if(path==='/catalog/expand'&&request.method==='POST'){
    const {occasion}=await request.json();
    const result=await expandCatalog(pool,occasion);catalogCache=null;return reply(result);
   }
   if(path==='/session/transfer'&&request.method==='POST'){
    const claim=randomBytes(24).toString('base64url');
    await pool.query('INSERT INTO device_claims(claim_hash,user_id) VALUES($1,$2)',[createHash('sha256').update(claim).digest('hex'),userId]);
    return reply({claim});
   }
   if(path==='/closet'&&request.method==='GET'){
    const rows=await owned(userId,async c=>(await c.query('SELECT id,item,image_key FROM user_closet WHERE user_id=$1 AND (image_key IS NOT NULL OR NOT (item ? \'sourceCatalogId\')) ORDER BY id',[userId])).rows);
    const items=await Promise.all(rows.map(async row=>({...row.item,id:Number(row.id),isOwned:true,image:row.image_key?await storage.url(row.image_key):row.item.image})));
    return reply({items});
   }
   if(path==='/closet'&&request.method==='POST'){
    if(Number(request.headers.get('content-length'))>8*1024*1024)return reply({error:'이미지는 5MB 이하로 올려주세요.'},413);
    const form=await request.formData(),file=form.get('image');
    if(!file||typeof file.arrayBuffer!=='function'||file.size>5*1024*1024)return reply({error:'5MB 이하 이미지가 필요합니다.'},400);
    const item=validateMetadata(Object.fromEntries(form));
    const bytes=new Uint8Array(await file.arrayBuffer()),[type,ext]=imageType(bytes);
    const count=await owned(userId,async c=>Number((await c.query('SELECT count(*) FROM user_closet WHERE user_id=$1 AND (image_key IS NOT NULL OR NOT (item ? \'sourceCatalogId\'))',[userId])).rows[0].count));
    if(count>=1000)return reply({error:'개인 옷장은 1,000개까지 등록할 수 있습니다.'},400);
    const key='users/'+encodeURIComponent(userId)+'/'+randomUUID()+'.'+ext;
    await storage.put(key,bytes,type);
    try{
     const memberId=await closetMember(request,userId,role);
     const row=await owned(userId,async c=>{
      const {rows:[inserted]}=await c.query('INSERT INTO user_closet(user_id,item,image_key) VALUES($1,$2,$3) RETURNING id',[userId,item,key]);
      await logCloset(c,userId,memberId,inserted.id,item,'added');
      return inserted;
     });
     return reply({id:Number(row.id)},201);
    }catch(e){await storage.remove(key).catch(()=>{});throw e}
   }
   if(path==='/profile'&&request.method==='GET'){
    const rows=await owned(userId,async c=>(await c.query('SELECT sizes FROM user_profiles WHERE user_id=$1',[userId])).rows);
    return reply({sizes:rows[0]?.sizes||{}});
   }
   if(path==='/profile'&&request.method==='PUT'){
    const input=await request.json(),sizes={};
    for(const [key,min,max]of [['height',80,230],['weight',20,300],['shoe',180,350]]){
     if(input[key]!==''&&input[key]!=null){
      const value=Number(input[key]);if(!Number.isFinite(value)||value<min||value>max)return reply({error:'사이즈 범위를 확인해주세요.'},400);sizes[key]=value;
     }
    }
    for(const key of ['top','bottom'])if(input[key]!=null)sizes[key]=String(input[key]).trim().slice(0,30);
    if(input.fit&&!['slim','regular','relaxed'].includes(input.fit))return reply({error:'선호 핏을 확인해주세요.'},400);
    if(input.fit)sizes.fit=input.fit;
    await owned(userId,c=>c.query('INSERT INTO user_profiles(user_id,sizes) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET sizes=excluded.sizes,updated_at=now()',[userId,sizes]));
    return reply({sizes});
   }
   const match=path.match(/^\/closet\/(\d+)$/);
   if(match&&request.method==='DELETE'){
    const memberId=await closetMember(request,userId,role);
    const row=await owned(userId,async c=>{
     const {rows:[removed]}=await c.query('DELETE FROM user_closet WHERE id=$1 AND user_id=$2 RETURNING image_key,item',[match[1],userId]);
     if(removed)await logCloset(c,userId,memberId,match[1],removed.item,'removed');
     return removed;
    });
    if(!row)return reply({error:'해당 옷을 찾을 수 없습니다.'},404);
    if(row.image_key)await storage.remove(row.image_key).catch(()=>{});
    return reply({ok:true});
   }
   if(path==='/analyze'&&request.method==='POST'){
    const form=await request.formData(),file=form.get('image');
    if(!file||file.size>5*1024*1024)return reply({error:'5MB 이하 이미지가 필요합니다.'},400);
    const bytes=new Uint8Array(await file.arrayBuffer()),[type]=imageType(bytes);
    return reply(await analyze(bytes,type,String(form.get('name')||'').slice(0,160)));
   }
   if(path==='/prices'&&request.method==='POST'){
    const {ids}=await request.json();
    if(!Array.isArray(ids)||ids.length>4||ids.some(id=>!Number.isSafeInteger(id)||id<=0))return reply({error:'상품을 확인해주세요.'},400);
    return reply({items:await checkPrices(pool,ids)});
   }
   return reply({error:'Not found'},404);
  }catch(e){
   console.error('API failed',e.code||e.name,String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[connection]').slice(0,300));
   return reply({error:e.status?e.message:'요청 처리에 실패했습니다. 잠시 후 다시 시도해주세요.'},e.status||500);
  }
 }};
}
