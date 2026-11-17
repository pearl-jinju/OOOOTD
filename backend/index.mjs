import pg from 'pg';
import {attachDatabasePool} from '@neon/functions';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {createApp,BUCKET} from './app.mjs';
import {attributes} from './catalog.mjs';
const connectionString=process.env.OOOOTD_DATABASE_URL||process.env.DATABASE_URL;
const connectionInfo=new URL(connectionString);
console.log('DB configuration ready',JSON.stringify({custom:!!process.env.OOOOTD_DATABASE_URL,passwordPresent:!!connectionInfo.password}));
const pool=new pg.Pool({connectionString,max:5});
attachDatabasePool(pool);
const jwks=createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));
const s3=new S3Client({forcePathStyle:true,endpoint:process.env.AWS_ENDPOINT_URL_S3,region:process.env.AWS_REGION,credentials:process.env.AWS_ACCESS_KEY_ID?{accessKeyId:process.env.AWS_ACCESS_KEY_ID,secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY}:undefined});
let visionModel;
async function analyze(bytes,type,name){
 const fallback={...attributes(name),name,needsReview:true,analysis:'manual',message:'자동 이미지 분석을 사용할 수 없어 직접 선택한 정보로 등록합니다.'};
 const base=process.env.NEON_AI_GATEWAY_BASE_URL,token=process.env.NEON_AI_GATEWAY_TOKEN;
 if(!base||!token)return fallback;
 try{
  if(!visionModel){
   const r=await fetch(base+'/v1/models',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
   const models=await r.json();
   const available=models.data?.filter(m=>m.enabled!==false)||[];
   visionModel=available.find(m=>/gemini.*flash|gpt.*mini/i.test(m.id))?.id;
   if(!visionModel)return fallback;
  }
  const r=await fetch(base+'/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(45000),body:JSON.stringify({model:visionModel,max_tokens:400,messages:[{role:'user',content:[{type:'text',text:'Analyze this clothing image. Return ONLY JSON with name (short Korean), category (outer|top|bottom|shoes), color (black|white|grey|navy|beige|khaki|blue|point), season (winter|chilly|mild|warm|hot), occasion (daily|library|date|work|exercise). Do not infer gender or invent brand, price, ownership. User label: '+name},{type:'image_url',image_url:{url:'data:'+type+';base64,'+Buffer.from(bytes).toString('base64')}}]}]})});
  if(!r.ok)return fallback;
  const data=await r.json(),text=data.choices?.[0]?.message?.content||'';
  const value=JSON.parse(text.replace(/^\s*```(?:json)?/,'').replace(/```\s*$/,''));
  const safe={...fallback};
  if(['outer','top','bottom','shoes'].includes(value.category))safe.category=value.category;
  for(const [key,valid]of Object.entries({color:['black','white','grey','navy','beige','khaki','blue','point'],season:['winter','chilly','mild','warm','hot'],occasion:['daily','library','date','work','exercise']}))if(valid.includes(value[key]))safe[key]=value[key];
  safe.name=String(value.name||name).slice(0,160);safe.analysis='ai';safe.message='사진 분석 결과입니다. 확인 후 등록해주세요.';return safe;
 }catch{return fallback}
}
export default createApp({pool,verify:async token=>{
 const {payload}=await jwtVerify(token,jwks,{issuer:new URL(process.env.NEON_AUTH_BASE_URL).origin,algorithms:['EdDSA']});
 return typeof payload.sub==='string'&&!payload.is_anonymous?payload.sub:null;
},storage:{
 put:(key,body,type)=>s3.send(new PutObjectCommand({Bucket:BUCKET,Key:key,Body:body,ContentType:type,CacheControl:'private,max-age=3600'})),
 url:key=>getSignedUrl(s3,new GetObjectCommand({Bucket:BUCKET,Key:key}),{expiresIn:3600}),
 remove:key=>s3.send(new DeleteObjectCommand({Bucket:BUCKET,Key:key}))
},analyze});
