import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatHandler,interpretLocally,validateChatIntent} from '../backend/chat.mjs';

const reply=(data,status=200)=>({data,status});
const interpret=(message,context)=>new Request('https://test.invalid/chat/interpret',{
 method:'POST',body:JSON.stringify({message,context})
});

test('Korean fallback returns only new, supported conditions',()=>{
 assert.deepEqual(interpretLocally('내일 서울에서 면접 코디 추천해줘'),{
  day:'tomorrow',city:'Seoul',occasion:'interview',action:'recommend'
 });
 assert.deepEqual(interpretLocally('검정색 바지는 빼고 조금 더 편하게'),{
  avoidColor:'black',avoidCategory:'bottom',style:'comfortable',action:'recommend'
 });
 assert.deepEqual(interpretLocally('비 오는 날 신을 신발이 없는데 5만 원 안에서 찾아줘'),{
  occasion:'rainy',budget:50000,category:'shoes',action:'shop'
 });
 assert.equal(interpretLocally('내 옷만 써서 출근룩 추천해줘').mode,'owned');
 assert.equal(interpretLocally('모레 면접 코디').action,'clarify');
});

test('Gemini receives only validated context and cannot supply IDs, links or new tools',async()=>{
 const run=createChatHandler({
  env:{GEMINI_API_KEY:'test',GEMINI_MODEL:'gemini-test-flash'},
  fetchImpl:async (url,options)=>{
   assert.match(url,/gemini-test-flash:generateContent$/);
   assert.equal(options.headers['x-goog-api-key'],'test');
   const payload=JSON.parse(options.body);
   assert.equal(payload.generationConfig.responseJsonSchema.additionalProperties,false);
   assert.deepEqual(JSON.parse(payload.contents[0].parts[0].text).context,{city:'Seoul'});
   return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({
    action:'recommend',occasion:'interview',id:42,include:'https://example.invalid',price:1
   })}]}}]});
  }
 });
 const result=await run(interpret('면접룩',{city:'Seoul',id:42,action:'help'}),'/chat/interpret','user',reply);
 assert.deepEqual(result,{status:200,data:{intent:{action:'recommend',occasion:'interview'},source:'gemini'}});
 assert.deepEqual(validateChatIntent({action:'fetch',budget:'50000',avoidCategory:'shoes'}),{});
});

test('provider failure falls back and limits requests independently of speech',async()=>{
 const run=createChatHandler({
  env:{GEMINI_API_KEY:'test',GEMINI_MODEL:'gemini-test-flash'},
  fetchImpl:async()=>new Response('unavailable',{status:429})
 });
 for(let attempt=0;attempt<12;attempt++){
  const result=await run(interpret('내 옷만 써서 출근룩 추천해줘'),'/chat/interpret','user',reply);
  assert.equal(result.data.source,'local');
  assert.equal(result.data.intent.mode,'owned');
 }
 assert.equal((await run(interpret('출근룩'),'/chat/interpret','user',reply)).status,429);
 assert.equal((await run(new Request('https://test.invalid'),'/chat/transcribe','user',reply)).status,503);
});

test('Groq receives Korean audio as multipart and returns editable transcript data',async()=>{
 const run=createChatHandler({
  env:{GROQ_API_KEY:'test'},
  fetchImpl:async (url,options)=>{
   assert.match(url,/^https:\/\/api\.groq\.com.*transcriptions$/);
   assert.equal(options.body.get('language'),'ko');
   assert.equal(options.body.get('model'),'whisper-large-v3-turbo');
   assert.equal(options.body.get('file').name,'recording.webm');
   return Response.json({text:' 내일 서울 면접 '});
  }
 });
 const form=new FormData();
 form.set('audio',new Blob(['clip'],{type:'audio/webm;codecs=opus'}),'sample');
 const result=await run(new Request('https://test.invalid/chat/transcribe',{method:'POST',body:form}),'/chat/transcribe','user',reply);
 assert.deepEqual(result,{status:200,data:{text:'내일 서울 면접'}});
 const oversize=new Request('https://test.invalid/chat/transcribe',{
  method:'POST',headers:{'content-type':'multipart/form-data; boundary=abc','content-length':'3000000'},body:'clip'
 });
 assert.equal((await run(oversize,'/chat/transcribe','user',reply)).status,413);
});
