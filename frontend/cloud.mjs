import {connectOperations} from '../assets/operations.js';
import {createAuthClient} from '@neon/auth';
import {connectAccount} from './account.mjs';
import {analyzeGarmentPhoto} from './photo-analysis.mjs';
const config=await (await fetch('/cloud-config.json')).json();

const $=id=>document.getElementById(id);
const attemptedExpansion=new Set();
const options=OOOOTD_RULES.OCCASIONS;
$('upload-occasion').replaceChildren(...options.map(o=>Object.assign(document.createElement('option'),{value:o.id,textContent:o.name})));
window.cloudEnsureCatalog=async occasion=>{
 if(!session||attemptedExpansion.has(occasion))return;
 attemptedExpansion.add(occasion);
 const status=$('catalog-expansion-status');status.hidden=false;
 status.textContent='이 종류에 맞는 상품이 부족해 추가 의상을 수집하고 있어요.';
 try{
  const result=await api('/catalog/expand',{method:'POST',body:{occasion}});
  await loadCatalog();
  status.textContent=result.throttled?'추가 수집이 진행 중이거나 최근에 완료됐어요. 현재 DB에서 추천합니다.':'종류에 맞는 상품을 추가했어요.';
 }catch(e){status.textContent='추가 상품 수집을 완료하지 못했어요. 현재 확인된 의상으로 추천합니다.'}
};

const SESSION_KEY='ooootd_private_session_v1';
let session=null,epoch=0;
const say=(message,error=false)=>{$('cloud-message').textContent=message;$('cloud-message').style.color=error?'#b91c1c':'#475569'};
async function api(path,{method='GET',body,signal}={}){
 const generation=epoch;
 if(!session?.token)throw Error('개인 옷장에 연결 중입니다.');
 const response=await fetch(config.apiUrl+path,{method,signal,headers:{Authorization:'Bearer '+session.token,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
 const data=await response.json();
 if(generation!==epoch)throw Error('사용자가 변경되어 요청을 취소했습니다.');
 if(!response.ok)throw Object.assign(Error(data.error||'요청에 실패했습니다.'),{status:response.status});
 return data;
}
const auth=config.authUrl ? createAuthClient(config.authUrl) : null;
window.cloudFetchWeather=async city=>{
 const response=await fetch(config.apiUrl+'/weather?city='+encodeURIComponent(city),{
  signal:AbortSignal.timeout(12000),
 });
 if(!response.ok)throw Error('날씨 조회에 실패했습니다.');
 return response.json();
};
const refreshOperations=auth ? connectOperations(auth,config.apiUrl) : null;
connectAccount(auth,()=>{window.fetchLiveWeather(); refreshOperations?.();});
async function loadCloset(){
 const gen=epoch,data=await api('/closet');
 if(gen===epoch)window.applyCloudCloset(data.items,session.userId);
}
async function loadProfile(){
 const gen=epoch,data=await api('/profile');
 if(gen!==epoch)return;
 $('size-form').reset();
 for(const [key,value]of Object.entries(data.sizes||{})){const field=$('size-'+key);if(field)field.value=value}
}
async function newSession(claim=null){
 epoch++;session=null;window.applyCloudCloset([],null);$('size-form').reset();
 const response=await fetch(config.apiUrl+'/session',{method:'POST',...(claim?{headers:{'Content-Type':'application/json'},body:JSON.stringify({claim})}:{})});
 if(!response.ok)throw Error('개인 옷장 생성에 실패했습니다.');
 session=await response.json();
 try{localStorage.setItem(SESSION_KEY,JSON.stringify(session))}catch{say('브라우저 저장을 허용해야 다음 방문에도 같은 옷장을 볼 수 있어요.',true)}
}
async function connect(){
 const fragment=new URLSearchParams(window.location.hash.slice(1));
 const claim=fragment.get('closet');
 if(claim){
  history.replaceState(null,'',window.location.pathname+window.location.search);
  await newSession(claim);
 }else{try{session=JSON.parse(localStorage.getItem(SESSION_KEY))}catch{}}
 if(!session?.token)await newSession();
 try{await loadCloset()}catch(e){if(e.status!==401)throw e;await newSession();await loadCloset()}
 await loadProfile();
 $('auth-user').textContent='이 브라우저의 개인 옷장 · 다른 사용자와 분리되어 있어요.';
 $('member-panel').hidden=false;
 say('내 옷만으로 코디를 추천합니다.');
}
$('new-user').onclick=async()=>{
 if(!confirm('새 사용자로 전환하면 현재 브라우저에서는 새 빈 옷장을 사용합니다. 계속할까요?'))return;
 try{await newSession();photoForm.reset();await loadCloset();await loadProfile();say('새 사용자의 빈 옷장으로 전환했어요.')}
 catch(e){say(e.message,true)}
};
const cameraInput=$('capture-image'),galleryInput=$('upload-image');
const photoForm=$('upload-form');
const photoStatus=$('selected-photo');
const photoLimit=5*1024*1024;

const analysisDetails=$('photo-details'),analysisSummary=$('photo-analysis');
let photoRevision=0,photoJob=null,suggestedName='';
$('take-photo').onclick=()=>cameraInput.click();
$('choose-photo').onclick=()=>galleryInput.click();
for(const [input,other] of [[cameraInput,galleryInput],[galleryInput,cameraInput]]){
 input.addEventListener('change',()=>{
  if(!input.files.length)return;
  other.value='';
  photoStatus.textContent=input.files[0].name;
  analyzeSelection();
 });
}
photoForm.addEventListener('reset',()=>{
 photoRevision++;photoJob=null;suggestedName='';
 photoStatus.textContent='사진을 찍거나 선택해 주세요.';
 analysisSummary.textContent='';analysisDetails.open=false;analysisDetails.hidden=true;
 $('upload-submit').disabled=false;
});
function analyzeSelection(){
 const revision=++photoRevision,generation=epoch;
 const current=()=>revision===photoRevision&&generation===epoch;
 $('upload-submit').disabled=true;
 analysisDetails.hidden=true;analysisDetails.open=false;
 for(const key of ['category','color','season','occasion'])$('upload-'+key).selectedIndex=0;
 analysisSummary.textContent='사진 속 옷을 분석 중이에요. 처음에는 분석 모델을 불러오는 데 시간이 걸릴 수 있어요.';
 photoJob=(async()=>{
  const file=await uploadPhoto();
  if(!current())return null;
  let modelUnavailable=false;
  const result=await analyzeGarmentPhoto(file).catch(()=>{modelUnavailable=true;return null;});
  if(!current())return null;
  if(result){
   const name=$('upload-name');
   if(!name.value.trim()||name.value===suggestedName)name.value=result.name;
   suggestedName=result.name;
   for(const key of ['category','color','season','occasion'])$('upload-'+key).value=result[key];
   analysisSummary.textContent=['category','color','season','occasion'].map(key=>{
    const field=$('upload-'+key);
    return field.selectedOptions[0]?.textContent;
   }).filter(Boolean).join(' · ');
   analysisDetails.hidden=false;
  }else{
   analysisSummary.textContent=modelUnavailable?"사진 분석 모델을 불러오지 못했어요. 다시 찍거나 자동 분류 항목을 직접 확인해 주세요.":'옷을 확실히 구분하기 어려워요. 옷 한 벌이 화면 가운데 오도록 다시 찍거나 분류를 확인해 주세요.';
   analysisDetails.hidden=false;analysisDetails.open=true;
  }
  return file;
 })().catch(error=>{
  if(current())analysisSummary.textContent=error.message;
  return null;
 }).finally(()=>{if(current())$('upload-submit').disabled=false;});
}
async function uploadPhoto(){
 const file=cameraInput.files[0]||galleryInput.files[0];
 if(!file)throw Error('사진을 먼저 찍거나 선택해주세요.');
 if(['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=photoLimit)return file;
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();
  image.src=url;
  await image.decode();
  const scale=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext('2d',{alpha:false});
  context.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));
  if(blob&&blob.size<=photoLimit)return new File([blob],'closet-photo.jpg',{type:'image/jpeg'});
 }catch{}finally{URL.revokeObjectURL(url)}
 throw Error('이 사진을 열 수 없어요. 카메라로 다시 찍거나 JPG·PNG·WebP 사진을 선택해 주세요.');
}

photoForm.onsubmit=async e=>{
 e.preventDefault();
 const generation=epoch,revision=photoRevision;
 $('upload-submit').disabled=true;
 try{
  const file=await (photoJob||uploadPhoto());
  if(!file||generation!==epoch||revision!==photoRevision)return;
  const body=new FormData(photoForm);body.set('image',file);
  body.set('gender',currentGender);
  await api('/closet',{method:'POST',body});
  if(revision===photoRevision)photoForm.reset();
  await loadCloset();say('내 옷에 등록했어요.');
 }catch(e){say(e.message,true)}finally{if(revision===photoRevision)$('upload-submit').disabled=false;}
};
$('size-form').onsubmit=async e=>{
 e.preventDefault();$('size-save').disabled=true;
 try{await api('/profile',{method:'PUT',body:Object.fromEntries(new FormData(e.target))});say('신체 사이즈를 나만 볼 수 있도록 저장했어요.')}
 catch(e){say(e.message,true)}finally{$('size-save').disabled=false}
};
window.cloudPriceCheck=async items=>api('/prices',{method:'POST',body:{ids:items.map(item=>item.id)}});
window.cloudDeleteCloth=async id=>{
 try{await api('/closet/'+id,{method:'DELETE'});await loadCloset();say('내 옷장에서 삭제했어요.')}
 catch(e){say(e.message,true)}
};
async function loadCatalog(){
 try{
  const r=await fetch(config.apiUrl+'/catalog');
  if(!r.ok)throw Error();
  const data=await r.json();window.applyPublicCatalog(data.items);
  const date=data.lastRun?.created_at;
  $('catalog-updated').textContent=date?'공용 상품 DB 갱신: '+new Date(date).toLocaleString('ko-KR')+' · 매주 월요일 오전 9시':'매주 월요일 오전 9시 공용 상품 갱신';
 }catch{$('catalog-updated').textContent='공용 상품 DB 연결을 확인 중입니다.'}
}
window.addEventListener('focus',()=>{if(session)loadCloset().catch(()=>{})});
await loadCatalog();
try{await connect()}catch(e){window.applyCloudCloset([],null);say(e.message,true)}
window.fetchLiveWeather();
window.ooootdCloudReady=true;
