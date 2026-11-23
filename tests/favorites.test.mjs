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
test('products and outfits toggle independently and survive a reload',()=>{
 const storage=browserStorage();
 const product={type:'product',id:10};
 const outfit={type:'outfit',title:'서울 · 면접',items:publicItems};
 let state=updateFavorites(storage,readFavorites(storage),product);
 state=updateFavorites(storage,state.favorites,outfit);
 assert.equal(readFavorites(storage).length,2);
 assert.equal(readFavorites(storage)[1].key,productFavoriteKey(10));
 state=updateFavorites(storage,readFavorites(storage),{...outfit,items:publicItems.toReversed()});
 assert.equal(state.removed,true);
 assert.deepEqual(readFavorites(storage),[{type:'product',id:10,key:'product:10'}]);
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
 const result=updateFavorites(storage,current,{type:'product',id:10});
 assert.equal(result.favorites,current);
 assert.match(result.error,/저장 설정/);
 assert.match(updateFavorites(storage,current,{type:'product',id:'10'}).error,/확인/);
});

test('adding through chat is idempotent while a second click can still remove the item',()=>{
 const storage=browserStorage();
 const product={type:'product',id:10};
 const added=updateFavorites(storage,[],product,{addOnly:true});
 const repeated=updateFavorites(storage,added.favorites,product,{addOnly:true});
 assert.equal(repeated.alreadySaved,true);
 assert.equal(repeated.favorites.length,1);
 assert.equal(updateFavorites(storage,repeated.favorites,product).removed,true);
 assert.equal(readFavorites(storage).length,0);
});
