import {MUSINSA_HOME,parseFavoriteCommand,retailerProductUrl,retailerSearchUrl} from './favorite-commands.js';

const $=id=>document.getElementById(id);
const panel=$('outfit-chat');
const launcher=$('outfit-chat-launcher');
const log=$('outfit-chat-log');
const form=$('outfit-chat-form');
const input=$('outfit-chat-input');
const status=$('outfit-chat-status');
const send=$('outfit-chat-send');
const mic=$('outfit-chat-mic');
const engine=window.ooootdOutfitChat;
let context={},controller=null,recording=null,openingMic=false,revision=0;
let pendingFavorite=null;
let dialogue=[];

function element(tag,value){
 const node=document.createElement(tag);
 if(value!==undefined)node.textContent=value;
 return node;
}
function message(value,who='코디 챗봇'){
 const entry=element('article');
 entry.append(element('strong',who),element('p',value));
 if(who!=='나'){
  dialogue.push({role:'assistant',text:value.slice(0,400)});
  dialogue=dialogue.slice(-6);
 }
 log.append(entry);
 while(log.children.length>16)log.firstElementChild.remove();
 log.scrollTop=log.scrollHeight;
 return entry;
}
function actions(entry){
 const row=element('div');
 row.className='outfit-chat-actions';
 entry.append(row);
 return row;
}
function button(row,label,run){
 const node=element('button',label);
 node.type='button';
 node.addEventListener('click',run);
 row.append(node);
}
function busy(value){
 send.disabled=value;
 mic.disabled=value;
}
function openTab(tab,target){
 const button=[...document.querySelectorAll('.tab-btn')].find(node=>node.getAttribute('onclick')?.includes("'"+tab+"'"));
 panel.open=false;
 button?.click();
 const destination=$(target);
 if(destination){
  if(!destination.matches('button,input,select,a'))destination.tabIndex=-1;
  destination.focus({preventScroll:true});
  destination.scrollIntoView({block:'start'});
 }
}
function retailerLink(row,label,url){
 const link=element('a',label);
 Object.assign(link,{href:url,target:'_blank',rel:'noopener noreferrer'});
 row.append(link);
}
function outfitFavoriteResult(result){
 if(result.error){message(result.error);return}
 const text=result.removed?'OOOOTD 코디 찜을 해제했어요.':
  result.unchanged?'현재 코디는 찜 목록에 없어요.':
  result.alreadySaved?'이미 찜 목록에 있어요.':'OOOOTD 찜 목록에 저장했어요.';
 const row=actions(message(result.label+' · '+text));
 button(row,'OOOOTD 코디 찜 목록',()=>openTab('favoritesTab','favorites-title'));
}
function lookbookItemsResult(){
 const result=window.ooootdFavorites.addLookbookItems();
 if(result.error){message(result.error);return}
 const added=result.added?'룩북에 보이는 의상 '+result.added+'개를 찜 목록에 담았어요.':'룩북에 보이는 의상이 이미 찜 목록에 있어요.';
 const detail=result.added&&result.existing?' 이미 담긴 '+result.existing+'개는 그대로 두었어요.':'';
 const row=actions(message(added+detail));
 button(row,'찜 목록 열기',()=>openTab('favoritesTab','favorites-title'));
}
function productRecordButton(row,item){
 const record=element('button','찜 완료 기록');
 record.type='button';
 record.dataset.likeRecord=String(item.id);
 record.setAttribute('aria-pressed','false');
 row.append(record);
 window.ooootdFavorites?.refreshProductRecords();
}
function showRetailerProduct(item){
 const url=retailerProductUrl(item.sourceUrl);
 if(!url){message('무신사 상품 링크를 확인할 수 없어요.');return}
 const row=actions(message(item.name+' · 무신사 상품 페이지에서 로그인한 뒤 ♡ 좋아요를 눌러주세요.'));
 retailerLink(row,'무신사에서 찜 ↗',url);
 productRecordButton(row,item);
}
function chooseRetailerProduct(query){
 const found=window.ooootdFavorites.searchProducts(query);
 pendingFavorite=null;
 if(found.length===1){showRetailerProduct(found[0]);return}
 if(!found.length){
  const row=actions(message('OOOOTD 추천의상에서 일치하는 상품을 찾지 못했어요. 무신사에서 직접 검색하거나 상품명을 다시 알려주세요.'));
  pendingFavorite={};
  retailerLink(row,'무신사에서 검색 ↗',retailerSearchUrl(query));
  return;
 }
 const candidates=found.slice(0,5);
 pendingFavorite={candidates};
 const row=actions(message('일치하는 상품이 '+found.length+'개예요. 링크를 열어 무신사에서 ♡ 좋아요를 누르거나, 상품 번호를 입력해 주세요.'));
 for(const [index,item] of candidates.entries()){
  const price=Number.isSafeInteger(item.price)&&item.price>0?' · '+item.price.toLocaleString('ko-KR')+'원(수집가)':'';
  retailerLink(row,(index+1)+'. '+item.name+price+' · 무신사 ↗',retailerProductUrl(item.sourceUrl));
 }
}
function handleFavorite(text){
 const command=parseFavoriteCommand(text);
 const favorites=window.ooootdFavorites;
 if(!command&&!pendingFavorite)return false;
 if(!favorites){message('찜 기능을 불러오는 중이에요. 잠시 후 다시 시도해주세요.');return true}
 if(command){
  pendingFavorite=null;
  if(command.action==='list'||command.action==='info'){
   const row=actions(message(command.action==='list'?
    '상품 좋아요는 무신사에서 확인할 수 있어요. OOOOTD에서 저장한 코디는 아래 목록을 열어주세요.':
    '“검정 로퍼 찜해 줘”라고 하면 무신사 상품으로 연결해 드려요. “지금 룩북 전체 찜해 줘”는 화면의 의상을 하나씩 찜 목록에 담아요.'));
   retailerLink(row,'무신사 열기 ↗',MUSINSA_HOME);
   button(row,'OOOOTD 코디 찜 목록',()=>openTab('favoritesTab','favorites-title'));
  }else if(command.action==='retailer'){
   if(command.query)chooseRetailerProduct(command.query);
   else retailerLink(actions(message('무신사에서 상품을 찾고 직접 ♡ 좋아요를 눌러주세요.')),'무신사 열기 ↗',MUSINSA_HOME);
  }else if(command.action==='remove')outfitFavoriteResult(favorites.removeCurrent());
  else if(command.target==='lookbookItems')lookbookItemsResult();
  else if(command.target==='outfit')outfitFavoriteResult(favorites.addCurrent());
  else if(command.target==='product')chooseRetailerProduct(command.query);
  else{
   pendingFavorite={};
   message('어떤 상품을 찜할까요? 상품명을 입력하거나 “지금 코디 찜해 줘”라고 말해주세요.');
  }
  return true;
 }
 const current=pendingFavorite;
 pendingFavorite=null;
 if(/^(?:그만|취소|안\s*할래)[.!]*$/.test(text)){message('찜을 취소했어요.');return true}
 const selected=text.match(/^([1-5])\s*(?:번|번째)?[.!]?$/);
 if(selected){
  const item=current.candidates?.[Number(selected[1])-1];
  if(item)showRetailerProduct(item);
  else{pendingFavorite=current;message('표시된 후보 번호나 상품명을 입력해주세요.')}
  return true;
 }
 if(/[?？]|추천|보여|어떻게|사용법|도움말|바꿔|\n/.test(text)||text.length>100)return false;
 chooseRetailerProduct(text);
 return true;
}

function help(){
 const entry=message('날짜·지역은 날씨 영역에서, 용도와 다음·유사 코디는 룩북에서 바꿀 수 있어요. 내 옷장에서는 옷 사진을 등록할 수 있고, 룩북에서는 이미지 저장과 추천의상 구매 링크를 이용할 수 있어요. “지금 코디 찜해 줘”로 룩북을 저장할 수 있어요. 다른 기기에서 기존 옷장을 열려면 발급받은 옷장 연결 링크가 필요해요.');
 const row=actions(entry);
 button(row,'내 옷장',()=>openTab('closetTab','private-title'));
 button(row,'지역·날짜',()=>{panel.open=false;$('forecast-day').focus()});
 button(row,'룩북',()=>openTab('recommendTab','lookbook-day-title'));
 button(row,'추천의상',()=>openTab('catalogTab','catalog-search'));
 button(row,'찜 목록',()=>openTab('favoritesTab','favorites-title'));
}
function renderOutfit(result){
 const {conditions,weather,reason,mode,shortage,hasOutfit,closetReady}=result;
 const detail=hasOutfit?reason:
  mode==='owned'&&!closetReady?'내 옷장 연결을 확인해주세요.':
  mode==='owned'&&shortage.length?'내 옷장에서 조건에 맞는 '+shortage.join('·')+'이(가) 부족해요.':
  '현재 조건을 모두 만족하는 코디가 없어요. 예산, 제외 조건 또는 고정한 옷을 확인해주세요.';
 const entry=message([conditions,weather,detail].filter(Boolean).join('\n'));
 const row=actions(entry);
 if(!hasOutfit){
  button(row,'내 옷장 열기',()=>openTab('closetTab','private-title'));
  if(mode!=='owned')button(row,'추천의상 보기',()=>openTab('catalogTab','catalog-search'));
  return;
 }
 button(row,'룩북 보기',()=>openTab('recommendTab','lookbook-day-title'));
 if(result.hasNext)button(row,'다른 코디',()=>execute({action:'next'}));
 if(result.hasSimilar)button(row,'비슷한 코디',()=>execute({action:'similar'}));
}
function renderProducts(result,conditions){
 const shortage=result.closetReady&&result.shortage.length?'내 옷장에서 조건에 맞는 '+result.shortage.join('·')+'이(가) 부족해요.':'';
 const detail=result.products.length?'카탈로그에 기록된 가격과 판매 정보예요. 현재 가격·재고는 판매처에서 확인해주세요.':'조건에 맞는 상품을 현재 카탈로그에서 찾지 못했어요.';
 const entry=message([result.conditions,result.weather,shortage,detail].filter(Boolean).join('\n'));
 const grid=element('div');
 grid.className='outfit-chat-products';
 for(const item of result.products){
  const card=element('section');
  const name=element('h3',item.name);
  try{
   const url=new URL(item.image);
   if(url.protocol==='https:'&&['image.msscdn.net','img.musinsa.com'].includes(url.hostname)){
    const img=element('img');
    img.src=url.href;
    img.alt='';
    img.loading='lazy';
    card.append(img);
   }
  }catch{}
  const observed=new Date(item.priceCheckedAt||'');
  const price=Number.isSafeInteger(item.price)&&item.price>0?item.price.toLocaleString('ko-KR')+'원':'가격 미확인';
  card.append(name,element('p','무신사 · '+price+
   (Number.isFinite(observed.valueOf())?' · '+observed.toLocaleDateString('ko-KR')+' 확인':'')));
  const row=actions(card);
  const url=retailerProductUrl(item.sourceUrl);
  if(url){
   retailerLink(row,'무신사에서 찜 ↗',url);
   productRecordButton(row,item);
  }
  button(row,'이 상품으로 코디',()=>{
   execute({action:'recommend'},{conditions:{...conditions,mode:conditions.mode==='catalog'?'catalog':'mixed'},productId:item.id,productName:item.name});
  });
  grid.append(card);
 }
 entry.append(grid);
 log.scrollTop=log.scrollHeight;
}
function merge(patch,base=context){
 const {action,...change}=patch;
 const merged={...base,...change};
 if('avoidColor' in change&&!('avoidCategory' in change))delete merged.avoidCategory;
 if(change.include||change.mode==='owned')delete merged.productId;
 if(change.mode==='owned'&&base.productId!==undefined&&!change.include)delete merged.include;
 return merged;
}
async function execute(patch,options={}){
 if(controller||recording||openingMic)return;
 const task=new AbortController();
 revision++;
 controller=task;
 busy(true);
 try{
  if(!patch){
   const request=window.ooootdChatRequest;
   if(!request)throw Error('옷장에 연결 중이에요. 잠시 뒤 다시 시도해주세요.');
   const look=engine.result();
   const lookbook=look.hasOutfit?[look.conditions,look.weather,look.reason].filter(Boolean).join(' · '):'';
   const result=await request('/chat/interpret',{message:options.text,context,history:options.history,lookbook,lastReplacementCategory:look.lastReplacementCategory},task.signal);
   patch=result.intent;
   status.textContent=result.source==='local'?'기본 한국어 해석을 사용 중이에요.':'';
  }
  if(task.signal.aborted)return;
  if(!patch?.action)throw Error('질문을 해석하지 못했어요. 다시 시도해주세요.');
  if(patch.action==='help'){help();return}
  if(patch.action==='clarify'||patch.action==='respond'){
   message(patch.reply||'어떤 상황에 입을 코디인지 알려주실래요? 예를 들면 출근, 면접, 여행처럼요.');
   return;
  }
  if(patch.action==='favorite'){
   if(!window.ooootdFavorites){message('찜 기능을 불러오는 중이에요. 잠시 후 다시 시도해주세요.');return}
   if(patch.favoriteTarget==='product'&&patch.favoriteQuery){
    chooseRetailerProduct(patch.favoriteQuery);
   }else if(patch.favoriteTarget==='lookbookItems'){
    const row=actions(message('지금 룩북에 보이는 상품과 내 옷을 각각 찜 목록에 담을까요?'));
    button(row,'룩북 전체 찜',lookbookItemsResult);
   }else if(patch.favoriteTarget==='outfit'){
    const row=actions(message('현재 룩북 코디를 OOOOTD 찜 목록에 저장할까요?'));
    const current=window.ooootdFavoriteData.current();
    button(row,'현재 코디 찜',()=>{
     const latest=window.ooootdFavoriteData.current();
     if(!current||JSON.stringify(current)!==JSON.stringify(latest)){message('코디가 달라졌어요. 현재 룩북을 확인한 뒤 다시 요청해주세요.');return}
     outfitFavoriteResult(window.ooootdFavorites.addCurrent());
    });
   }else{
    pendingFavorite={};
    message('어떤 상품을 찜하고 싶으세요? 상품명을 알려주세요.');
   }
   return;
  }
  if(patch.action==='replace'){
   const result=await engine.apply(patch,{action:'replace',signal:task.signal});
   if(task.signal.aborted)return;
   if(result.error){message(result.error);return}
   const {label,previous,current}=result.replacement;
   const detail=current?label+'만 바꿨어요. '+previous+' → '+current:
    label+'만 바꿨어요. 로그인하면 바뀐 의상을 룩북에서 확인할 수 있어요.';
   const row=actions(message(detail));
   button(row,'룩북 보기',()=>openTab('recommendTab','lookbook-day-title'));
   button(row,'다른 '+label+'으로 바꾸기',()=>execute(patch));
   return;
  }
  const conditions=merge(patch,options.conditions??context);
  if(options.productId!==undefined){
   conditions.productId=options.productId;
   if(typeof options.productName==='string')conditions.include=options.productName;
  }
  const hasChanges=Object.keys(patch).some(key=>key!=='action');
  const action=hasChanges&&['next','similar'].includes(patch.action)?'recommend':patch.action;
  const result=await engine.apply(conditions,{action,signal:task.signal,productId:conditions.productId});
  if(task.signal.aborted||!result)return;
  if(result.error){message(result.error);return}
  context=conditions;
  if(action==='shop')renderProducts(result,conditions);
  else if(action==='similar'&&!result.similarChanged)message('현재 조건에 맞는 다른 유사 코디가 없어요.');
  else if(action==='next'&&!result.hasNext)message('현재 조건에 맞는 다른 코디가 없어요.');
  else renderOutfit(result);
 }catch(error){
  if(!task.signal.aborted){
   if(options.text&&!input.value)input.value=options.text;
   const fallback='채팅 연결에 실패했어요. 연결을 확인한 뒤 다시 시도해주세요.';
   message(error.status===404?'채팅 서버가 아직 연결되지 않았어요.':error instanceof TypeError?fallback:error.message||fallback);
  }
 }finally{
  if(controller===task){
   controller=null;busy(false);
   if(status.textContent==='코디 요청을 확인 중이에요.')status.textContent='';
  }
 }
}

form.addEventListener('submit',event=>{
 event.preventDefault();
 const text=input.value.trim();
 if(!text||controller||recording||openingMic)return;
 const history=dialogue.slice(-4);
 dialogue=[...dialogue,{role:'user',text}].slice(-6);
 message(text,'나');
 input.value='';
 status.textContent='';
 if(handleFavorite(text))return;
 status.textContent='코디 요청을 확인 중이에요.';
 execute(null,{text,history});
});
$('outfit-chat-examples').addEventListener('click',event=>{
 const example=event.target.closest('button[data-prompt]');
 if(!example||controller||recording||openingMic)return;
 input.value=example.dataset.prompt;
 form.requestSubmit();
});

function stopRecording(cancel=false){
 if(!recording)return;
 const clip=recording;
 clip.cancelled||=cancel;
 clearTimeout(clip.timeout);
 if(clip.recorder.state!=='inactive')clip.recorder.stop();
 clip.stream.getTracks().forEach(track=>track.stop());
 mic.textContent='말하기';
 mic.setAttribute('aria-pressed','false');
 panel.classList.remove('outfit-chat-recording');
}
async function sendRecording(clip){
 if(recording!==clip)return;
 recording=null;
 if(clip.cancelled)return;
 const audio=new Blob(clip.chunks,{type:clip.recorder.mimeType||clip.chunks[0]?.type});
 if(!audio.size||audio.size>2*1024*1024){
  status.textContent='녹음 파일이 비어 있거나 너무 커요. 짧게 다시 녹음해주세요.';
  busy(false);
  return;
 }
 const task=new AbortController();
 controller=task;
 busy(true);
 status.textContent='한국어 음성을 인식하고 있어요.';
 const body=new FormData();
 body.set('audio',audio,'recording');
 try{
  const result=await window.ooootdChatRequest('/chat/transcribe',body,task.signal);
  if(task.signal.aborted)return;
  if(typeof result.text!=='string'||!result.text.trim())throw Error('인식된 음성이 없어요. 다시 말하거나 직접 입력해주세요.');
  input.value=result.text;
  status.textContent='인식한 문장을 수정하거나 확인한 뒤 보내주세요.';
  input.focus();
 }catch(error){
  if(!task.signal.aborted)status.textContent=error.status===404?'음성 서버가 아직 연결되지 않았어요. 텍스트로 입력해주세요.':
   error instanceof TypeError?'음성 서버 연결을 확인해주세요. 텍스트로 입력할 수 있어요.':
   error.message||'음성 인식에 실패했어요. 텍스트로 입력할 수 있어요.';
 }finally{
  if(controller===task){controller=null;busy(false)}
 }
}

mic.addEventListener('click',async ()=>{
 if(recording){busy(true);stopRecording();return}
 if(controller||openingMic)return;
 if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
  status.textContent='이 브라우저에서는 녹음을 사용할 수 없어요. 텍스트로 입력해주세요.';
  return;
 }
 if(!window.ooootdChatRequest){
  status.textContent='옷장에 연결 중이에요. 잠시 뒤 다시 시도해주세요.';
  return;
 }
 const turn=revision;
 openingMic=true;
 let stream;
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:true});
  if(turn!==revision||!panel.open){stream.getTracks().forEach(track=>track.stop());return}
  const mimeType=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
  const recorder=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),audioBitsPerSecond:32000});
  const clip={recorder,stream,chunks:[],cancelled:false};
  recording=clip;
  recorder.addEventListener('dataavailable',event=>{if(!clip.cancelled&&event.data.size)clip.chunks.push(event.data)});
  recorder.addEventListener('stop',()=>{stopRecording();sendRecording(clip)},{once:true});
  recorder.addEventListener('error',()=>{
   stopRecording(true);
   busy(false);
   status.textContent='녹음이 중단됐어요. 다시 말하거나 텍스트로 입력해주세요.';
  },{once:true});
  recorder.start();
  clip.timeout=setTimeout(()=>{busy(true);stopRecording()},20000);
  send.disabled=true;
  mic.textContent='녹음 중지';
  mic.setAttribute('aria-pressed','true');
  panel.classList.add('outfit-chat-recording');
  status.textContent='녹음 중 · 최대 20초. 음성은 전사를 위해 Google Gemini로 전송됩니다.';
 }catch(error){
  stream?.getTracks().forEach(track=>track.stop());
  recording=null;
  status.textContent=error.name==='NotAllowedError'?
   '마이크 권한이 거부됐어요. 브라우저 권한을 확인하거나 텍스트로 입력해주세요.':
   '마이크를 사용할 수 없어요. 텍스트로 입력해주세요.';
 }finally{openingMic=false}
});
function reset(){
 revision++;
 controller?.abort();
 controller=null;
 stopRecording(true);
 recording=null;
 context={};
 pendingFavorite=null;
 dialogue=[];
 input.value='';
 status.textContent='';
 log.replaceChildren();
 engine.reset();
 busy(false);
}
$('outfit-chat-reset').addEventListener('click',reset);
window.addEventListener('ooootd-closet-changed',reset);
window.addEventListener('ooootd-account-changed',reset);
panel.addEventListener('toggle',()=>{
 if(!panel.open&&recording){
  stopRecording(true);
  recording=null;
  busy(false);
  status.textContent='';
 }
 if(!panel.open&&openingMic)revision++;
});
window.addEventListener('pagehide',()=>stopRecording(true));

panel.addEventListener('keydown',event=>{
 if(event.key!=='Escape'||!panel.open)return;
 event.preventDefault();
 panel.open=false;
 launcher.focus();
});
const viewport=window.visualViewport;
if(viewport){
 const placeChat=()=>{
  const keyboard=Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop);
  panel.style.setProperty('--outfit-chat-height',viewport.height+'px');
  panel.style.setProperty('--outfit-chat-keyboard',keyboard+'px');
 };
 viewport.addEventListener('resize',placeChat);
 viewport.addEventListener('scroll',placeChat);
 placeChat();
}
