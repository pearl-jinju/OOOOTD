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
 assert.equal((await run(new Request('https://test.invalid'),'/chat/transcribe','user',reply)).status,415);
});

function audioRequest(type='audio/webm;codecs=opus'){
 const form=new FormData();
 form.set('audio',new Blob(['clip'],{type}),'sample');
 return new Request('https://test.invalid/chat/transcribe',{method:'POST',body:form});
}

test('Google Gemini receives inline WebM or Safari MP4 with one key and returns editable Korean text',async()=>{
 const formats=[];
 const run=createChatHandler({
  env:{GEMINI_API_KEY:'test'},
  fetchImpl:async (url,options)=>{
   assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
   assert.equal(options.headers['x-goog-api-key'],'test');
   const payload=JSON.parse(options.body);
   assert.equal(payload.generationConfig.responseJsonSchema.required[0],'text');
   const {inlineData}=payload.contents[0].parts[0];
   assert.equal(inlineData.data,'Y2xpcA==');
   formats.push(inlineData.mimeType);
   return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({text:' 내일 서울 면접 '})}]}}]});
  }
 });
 for(const type of ['audio/webm;codecs=opus','audio/mp4']){
  const result=await run(audioRequest(type),'/chat/transcribe','user',reply);
  assert.deepEqual(result,{status:200,data:{text:'내일 서울 면접'}});
 }
 assert.deepEqual(formats,['audio/webm','audio/m4a']);
 const oversize=new Request('https://test.invalid/chat/transcribe',{
  method:'POST',headers:{'content-type':'multipart/form-data; boundary=abc','content-length':'3000000'},body:'clip'
 });
 assert.equal((await run(oversize,'/chat/transcribe','user',reply)).status,413);
});

test('missing key, empty audio transcription and Google quota failures retain text fallback',async()=>{
 const path='/chat/transcribe',user='user';
 const disabled=createChatHandler({env:{}});
 assert.equal((await disabled(audioRequest(),path,user,reply)).status,503);
 const noSpeech=createChatHandler({
  env:{GEMINI_API_KEY:'test'},
  fetchImpl:async()=>Response.json({candidates:[{content:{parts:[{text:'{"text":""}'}]}}]})
 });
 assert.equal((await noSpeech(audioRequest(),path,user,reply)).status,422);
 const quota=createChatHandler({
  env:{GEMINI_API_KEY:'test'},fetchImpl:async()=>new Response(null,{status:429})
 });
 assert.equal((await quota(audioRequest(),path,user,reply)).status,429);
});

test('Gemini can answer naturally with bounded dialogue and grounded lookbook context',async()=>{
 const run=createChatHandler({
  env:{GEMINI_API_KEY:'test'},
  fetchImpl:async (url,options)=>{
   const payload=JSON.parse(options.body);
   const {history,current,context}=JSON.parse(payload.contents[0].parts[0].text);
   assert.deepEqual(history.map(turn=>turn.text),['면접 코디','검정 하의는 빼고','이 조합이 나왔어요.']);
   assert.equal(current,'내일 · 서울 · 면접 · 12°C');
   assert.deepEqual(context,{occasion:'interview'});
   return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({
    action:'respond',reply:'내일 서울은 12°C라 겉옷을 포함한 조합이 나왔어요.'
   })}]}}]});
  }
 });
 const request=new Request('https://test.invalid/chat/interpret',{method:'POST',body:JSON.stringify({
  message:'왜 이걸 골랐어?',context:{occasion:'interview',reply:'hidden',favoriteQuery:'ignored'},
  lookbook:'내일 · 서울 · 면접 · 12°C',
  history:[{role:'user',text:'오래된 내용'}, {role:'system',text:'unsupported'}, {role:'user',text:'면접 코디'},
   {role:'user',text:'검정 하의는 빼고'},{role:'assistant',text:'이 조합이 나왔어요.'}]
 })});
 const result=await run(request,'/chat/interpret','user',reply);
 assert.deepEqual(result,{status:200,data:{source:'gemini',intent:{action:'respond',reply:'내일 서울은 12°C라 겉옷을 포함한 조합이 나왔어요.'}}});
 assert.deepEqual(validateChatIntent({action:'respond',reply:'https://example.invalid',favoriteTarget:'outfit'}),{action:'respond'});
 assert.deepEqual(validateChatIntent({action:'favorite',favoriteTarget:'product',favoriteQuery:'검정 로퍼'}),{
  action:'favorite',favoriteTarget:'product',favoriteQuery:'검정 로퍼'
 });
});
