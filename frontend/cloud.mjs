const config=await (await fetch('/cloud-config.json')).json();
window.ooootdApiUrl=config.apiUrl;
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
async function api(path,{method='GET',body}={}){
 const generation=epoch;
 if(!session?.token)throw Error('개인 옷장에 연결 중입니다.');
 const response=await fetch(config.apiUrl+path,{method,headers:{Authorization:'Bearer '+session.token,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
 const data=await response.json();
 if(generation!==epoch)throw Error('사용자가 변경되어 요청을 취소했습니다.');
 if(!response.ok)throw Object.assign(Error(data.error||'요청에 실패했습니다.'),{status:response.status});
 return data;
}
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
 try{await newSession();await loadCloset();await loadProfile();say('새 사용자의 빈 옷장으로 전환했어요.')}
 catch(e){say(e.message,true)}
};
$('trial-import').onclick=async()=>{
 $('trial-import').disabled=true;say('남성 옷 50개를 내 옷으로 등록하고 있어요.');
 try{const r=await api('/closet/trial',{method:'POST',body:{}});await loadCloset();say(r.added?'남성 옷 '+r.added+'개를 내 옷장에 넣었어요.':'이미 내 옷장에 등록된 실험용 옷이에요.')}
 catch(e){say(e.message,true)}finally{$('trial-import').disabled=false}
};
$('upload-form').onsubmit=async e=>{
 e.preventDefault();$('upload-submit').disabled=true;
 try{await api('/closet',{method:'POST',body:new FormData(e.target)});e.target.reset();await loadCloset();say('내 옷에 등록했어요.')}
 catch(e){say(e.message,true)}finally{$('upload-submit').disabled=false}
};
$('analyze-image').onclick=async()=>{
 const file=$('upload-image').files[0];
 if(!file){say('사진을 먼저 선택해주세요.',true);return}
 $('analyze-image').disabled=true;say('사진을 분석하고 있어요.');
 try{
  const form=new FormData();form.set('image',file);form.set('name',$('upload-name').value);
  const r=await api('/analyze',{method:'POST',body:form});
  for(const key of ['name','category','color','season','occasion'])if(r[key])$('upload-'+key).value=r[key];
  say(r.message);
 }catch(e){say(e.message,true)}finally{$('analyze-image').disabled=false}
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
window.fetchLiveWeather();
try{await connect()}catch(e){window.applyCloudCloset([],null);say(e.message,true)}
window.ooootdCloudReady=true;
