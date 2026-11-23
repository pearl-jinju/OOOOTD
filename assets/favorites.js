import {findFavoriteProducts,retailerProductUrl} from './favorite-commands.js';

const STORAGE_KEY='ooootd_favorites_v1';
const ITEM_LIMIT=100;
const categories={outer:'아우터',top:'상의',bottom:'하의',shoes:'신발'};
const validId=id=>Number.isSafeInteger(id)&&id>0;
const validOwnedItem=item=>item&&validId(item.id)&&typeof item.owned==='boolean'&&Object.hasOwn(categories,item.category);

export const productFavoriteKey=id=>'product:'+id;
export function outfitFavoriteKey(items,owner){
 return 'outfit:'+items.map(item=>
  item.category+':'+(item.owned?'closet:'+owner+':':'catalog:')+item.id
 ).sort().join('|');
}
function normalize(favorite){
 if(!favorite||typeof favorite!=='object')return null;
 if(favorite.type==='product'&&validId(favorite.id)){
  const entry={type:'product',id:favorite.id,key:productFavoriteKey(favorite.id)};
  const url=retailerProductUrl(favorite.sourceUrl);
  if(favorite.reportedLiked===true&&url)return {...entry,reportedLiked:true,sourceUrl:url,name:String(favorite.name||'').trim().slice(0,160)};
  return entry;
 }
 if(favorite.type!=='outfit'||!Array.isArray(favorite.items)||favorite.items.length<3||favorite.items.length>4||
  !favorite.items.every(validOwnedItem)||new Set(favorite.items.map(item=>item.category)).size!==favorite.items.length)return null;
 const items=favorite.items.map(({id,owned,category})=>({id,owned,category}));
 const owner=items.some(item=>item.owned)?favorite.owner:null;
 if(items.some(item=>item.owned)&&(!owner||typeof owner!=='string'||owner.length>150))return null;
 const title=typeof favorite.title==='string'&&favorite.title.trim()?favorite.title.trim().slice(0,80):'찜한 코디';
 return {type:'outfit',title,owner,items,key:outfitFavoriteKey(items,owner)};
}
export function readFavorites(storage){
 try{
  const value=JSON.parse(storage.getItem(STORAGE_KEY)||'[]');
  if(!Array.isArray(value))return [];
  return [...new Map(value.slice(0,ITEM_LIMIT).map(normalize).filter(Boolean).map(item=>[item.key,item])).values()];
 }catch{return []}
}
export function updateFavorites(storage,favorites,value,{addOnly=false}={}){
 const favorite=typeof value==='string'?null:normalize(value);
 const key=typeof value==='string'?value:favorite?.key;
 if(!key)return {favorites,error:'찜할 항목을 확인하지 못했어요.'};
 const existing=favorites.find(item=>item.key===key);
 const upgrade=Boolean(existing?.type==='product'&&!existing.reportedLiked&&favorite?.reportedLiked);
 if(existing&&addOnly&&!upgrade)return {favorites,alreadySaved:true};
 if(!existing&&!favorite)return {favorites,unchanged:true};
 if(favorite?.type==='product'&&!favorite.reportedLiked)return {favorites,error:'무신사에서 좋아요를 누른 뒤 완료를 기록해 주세요.'};
 if(!existing&&favorites.length>=ITEM_LIMIT)return {favorites,error:'찜은 최대 100개까지 저장할 수 있어요. 목록에서 항목을 지운 뒤 다시 시도해주세요.'};
 const removed=Boolean(existing&&!upgrade);
 const next=removed?favorites.filter(item=>item.key!==key):[favorite,...favorites.filter(item=>item.key!==key)];
 try{storage.setItem(STORAGE_KEY,JSON.stringify(next));return {favorites:next,removed}}
 catch{return {favorites,error:'찜 목록을 저장하지 못했어요. 브라우저 저장 설정을 확인해주세요.'}}
}

export function canShowOutfitItem(item,signedIn){
 return signedIn||!['bottom','shoes'].includes(item.category);
}

function initFavorites(){
 const byId=id=>document.getElementById(id);
 const tab=byId('favoritesTab'),count=byId('favorites-count'),list=byId('favorites-list');
 const outfitButton=byId('favorite-outfit'),status=byId('favorites-status');
 const data=window.ooootdFavoriteData;
 if(!data||!tab||!outfitButton)return;
 const storage={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)};
 let favorites=readFavorites(storage);
 let keys=new Set(favorites.map(item=>item.key));
 let noticeTimer;
 function say(message){
  clearTimeout(noticeTimer);
  status.textContent=message;
  noticeTimer=setTimeout(()=>{status.textContent=''},3200);
 }

 function node(tag,label){
  const element=document.createElement(tag);
  if(label!==undefined)element.textContent=label;
  return element;
 }
 function addImage(parent,item){
  try{
   const url=new URL(item.image);
   if(url.protocol!=='https:'||(!item.isOwned&&url.hostname!=='image.msscdn.net'))return;
   const image=node('img');
   image.src=url.href;
   image.alt='';
   image.loading='lazy';
   parent.append(image);
  }catch{}
 }
 function addRetailerLink(parent,item){
  const url=retailerProductUrl(item?.sourceUrl);
  if(!url)return;
  const link=node('a','무신사에서 찜 ↗');
  Object.assign(link,{href:url,target:'_blank',rel:'noopener noreferrer'});
  parent.append(link);
 }
 function setButton(button,selected,label){
  button.setAttribute('aria-pressed',String(selected));
  button.title=label;
  button.setAttribute('aria-label',label);
  button.querySelector('span').textContent=selected?'♥':'♡';
 }
 function markCurrent(){
  const outfit=data.current();
  outfitButton.disabled=!outfit;
  const selected=!!outfit&&keys.has(outfitFavoriteKey(outfit.items,outfit.owner));
  setButton(outfitButton,selected,selected?'현재 코디 찜 해제':'현재 코디 찜하기');
  outfitButton.querySelector('strong').textContent=selected?'찜 해제':'코디 찜';
 }
 function markProductRecords(){
  const reported=new Set(favorites.filter(item=>item.reportedLiked).map(item=>item.id));
  for(const button of document.querySelectorAll('[data-like-record]')){
   const marked=reported.has(Number(button.dataset.likeRecord));
   button.setAttribute('aria-pressed',String(marked));
   button.textContent=marked?'찜 기록 해제':'찜 완료 기록';
  }
 }
 function render(){
  const owner=data.owner();
  const signedIn=!byId('account-sign-out').hidden;
  const visible=favorites.filter(item=>item.type==='product'||!item.owner||item.owner===owner);
  count.textContent=String(visible.length);
  if(!tab.classList.contains('active'))return;
  list.replaceChildren();
  byId('favorites-empty').hidden=visible.length>0;
  if(!visible.length)return;
  const products=new Map(data.catalog().map(item=>[item.id,item]));
  const closet=new Map(data.closet().map(item=>[item.id,item]));
  for(const favorite of visible){
   const card=node('article');
   card.className='favorite-card';
   card.dataset.favoriteKey=favorite.key;
   if(favorite.type==='product'){
    const item=products.get(favorite.id);
    card.append(node('h3',item?.name||favorite.name||'상품 정보 없음'));
    if(item){
     addImage(card,item);
     const price=Number.isSafeInteger(item.price)&&item.price>0?item.price.toLocaleString('ko-KR')+'원 · 수집가':'가격 확인 필요';
     card.append(node('p',price+(favorite.reportedLiked?' · 내가 기록한 무신사 찜':' · 이전에 OOOOTD에 저장한 상품')));
     addRetailerLink(card,item);
    }else{
     card.append(node('p','현재 추천의상 목록에서 찾을 수 없어요.'));
     if(favorite.reportedLiked)addRetailerLink(card,favorite);
    }
   }else{
    card.append(node('h3',favorite.title));
    const grid=node('ul');
    grid.className='favorite-outfit-items';
    for(const ref of favorite.items){
     const tile=node('li');
     const category=categories[ref.category];
     if(!canShowOutfitItem(ref,signedIn))tile.append(node('p',category+' · 로그인 후 보기'));
     else{
      const item=(ref.owned?closet:products).get(ref.id);
      if(item)addImage(tile,item);
      tile.append(node('p',item?.name||category+' · 정보 없음'));
      if(item&&!ref.owned)addRetailerLink(tile,item);
     }
     grid.append(tile);
    }
    card.append(grid);
   }
   const removeLabel=favorite.type==='outfit'?'찜 해제':favorite.reportedLiked?'찜 기록 해제':'OOOOTD 기록 삭제';
   const remove=node('button',removeLabel);
   remove.className='favorite-remove';
   remove.type='button';
   remove.setAttribute('aria-label',card.firstChild.textContent+' '+removeLabel);
   remove.addEventListener('click',()=>{
    const adjacent=card.nextElementSibling||card.previousElementSibling;
    if(!change(favorite.key).error)list.querySelectorAll('article').forEach(element=>{
     if(element.dataset.favoriteKey===adjacent?.dataset.favoriteKey)element.querySelector('button').focus();
    });
    if(!list.children.length)byId('favorites-tab-button').focus();
   });
   card.append(remove);
   list.append(card);
  }
 }
 function change(item,options){
  const result=updateFavorites(storage,readFavorites(storage),item,options);
  if(result.error){say(result.error);return result}
  favorites=result.favorites;
  keys=new Set(favorites.map(item=>item.key));
  if(!result.alreadySaved&&!result.unchanged){
   const product=typeof item==='string'?item.startsWith('product:'):item.type==='product';
   say(product?(result.removed?'OOOOTD 찜 기록을 해제했어요.':'무신사에서 찜했다고 OOOOTD에 기록했어요.'):
    (result.removed?'찜을 해제했어요.':'찜 목록에 저장했어요.'));
  }
  markCurrent();markProductRecords();render();
  return result;
 }
 outfitButton.addEventListener('click',()=>{
  const current=data.current();
  if(current)change({type:'outfit',...current});
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-like-record]');
  if(!button)return;
  const id=Number(button.dataset.likeRecord);
  const existing=readFavorites(storage).find(item=>item.key===productFavoriteKey(id));
  if(existing?.reportedLiked){change(existing.key);return}
  const item=data.catalog().find(item=>item.id===id);
  if(!retailerProductUrl(item?.sourceUrl)){say('무신사 상품 링크를 확인할 수 없어요.');return}
  change({type:'product',id,name:item.name,sourceUrl:item.sourceUrl,reportedLiked:true},{addOnly:true});
 });
 window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY&&event.key!==null)return;
  favorites=readFavorites(storage);
  keys=new Set(favorites.map(item=>item.key));
  markCurrent();markProductRecords();render();
 });
 window.addEventListener('ooootd-account-changed',render);
 window.ooootdFavorites={
  outfitChanged:markCurrent,catalogChanged(){markProductRecords();render()},open:render,
  refreshProductRecords:markProductRecords,
  searchProducts:query=>findFavoriteProducts(data.catalog(),query),
  addCurrent(){
   const current=data.current();
   if(!current)return {error:'지금 룩북에 찜할 코디가 없어요. 먼저 코디를 추천받아 주세요.'};
   return {...change({type:'outfit',...current},{addOnly:true}),label:current.title};
  },
  removeCurrent(){
   const current=data.current();
   if(!current)return {error:'지금 룩북에 표시된 코디가 없어요.'};
   return {...change(outfitFavoriteKey(current.items,current.owner)),label:current.title};
  }
 };
 markCurrent();markProductRecords();render();
}

if(typeof window!=='undefined'&&typeof document!=='undefined')initFavorites();
