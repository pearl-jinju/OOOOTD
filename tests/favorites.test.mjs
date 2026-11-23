import test from 'node:test';
import assert from 'node:assert/strict';
import {canShowOutfitItem,outfitFavoriteKey,productFavoriteKey,readFavorites,updateFavorites} from '../assets/favorites.js';

function browserStorage(){
 let value=null;
 return {getItem:()=>value,setItem:(key,encoded)=>{value=encoded}};
}
const publicItems=[
 {category:'top',owned:false,id:10},
 {category:'bottom',owned:false,id:20},
 {category:'shoes',owned:false,id:30}
];
test('legacy products remain readable while outfits toggle independently',()=>{
 const storage=browserStorage();
 const product={type:'product',id:10};
 const outfit={type:'outfit',title:'서울 · 면접',items:publicItems};
 storage.setItem('ooootd_favorites_v1',JSON.stringify([product]));
 let state=updateFavorites(storage,readFavorites(storage),outfit);
 assert.equal(readFavorites(storage).length,2);
 assert.equal(readFavorites(storage)[1].key,productFavoriteKey(10));
 state=updateFavorites(storage,readFavorites(storage),{...outfit,items:publicItems.toReversed()});
 assert.equal(state.removed,true);
 assert.deepEqual(readFavorites(storage),[{type:'product',id:10,key:'product:10'}]);
 assert.equal(updateFavorites(storage,state.favorites,productFavoriteKey(10)).removed,true);
 assert.deepEqual(readFavorites(storage),[]);
});

test('private garment states use the current closet identity and omit private media',()=>{
 const storage=browserStorage();
 const items=[{...publicItems[0],owned:true,image:'https://private.example/image?token=secret'},...publicItems.slice(1)];
 const saved=updateFavorites(storage,[],{type:'outfit',owner:'closet-a',items}).favorites[0];
 assert.equal(saved.owner,'closet-a');
 assert.equal(saved.key,outfitFavoriteKey(items,'closet-a'));
 assert.notEqual(saved.key,outfitFavoriteKey(items,'closet-b'));
 assert.equal(storage.getItem().includes('token'),false);
 assert.equal(updateFavorites(storage,[],{type:'outfit',items}).favorites.length,0);
 assert.equal(canShowOutfitItem(items[0],false),true);
 assert.equal(canShowOutfitItem(items[1],false),false);
 assert.equal(canShowOutfitItem(items[2],true),true);
});

test('damaged data and storage denial do not create favorites',()=>{
 assert.deepEqual(readFavorites({getItem:()=>'{malformed'}),[]);
 const storage={setItem(){throw Error('denied')}};
 const current=[];
 const result=updateFavorites(storage,current,{type:'outfit',items:publicItems});
 assert.equal(result.favorites,current);
 assert.match(result.error,/저장 설정/);
 assert.match(updateFavorites(storage,current,{type:'product',id:'10'}).error,/확인/);
});

test('chat add is idempotent and both the toggle and explicit removal can clear an outfit',()=>{
 const storage=browserStorage();
 const outfit={type:'outfit',items:publicItems};
 const added=updateFavorites(storage,[],outfit,{addOnly:true});
 const repeated=updateFavorites(storage,added.favorites,outfit,{addOnly:true});
 assert.equal(repeated.alreadySaved,true);
 assert.equal(repeated.favorites.length,1);
 assert.equal(updateFavorites(storage,repeated.favorites,outfit).removed,true);
 assert.equal(readFavorites(storage).length,0);
 const key=outfitFavoriteKey(publicItems,null);
 assert.equal(updateFavorites(storage,[],key).unchanged,true);
 const restored=updateFavorites(storage,[],outfit);
 assert.equal(updateFavorites(storage,restored.favorites,key).removed,true);
});
test('new products can only be liked on Musinsa',()=>{
 const storage=browserStorage();
 const result=updateFavorites(storage,[],{type:'product',id:10},{addOnly:true});
 assert.match(result.error,/무신사/);
 assert.deepEqual(readFavorites(storage),[]);
});
