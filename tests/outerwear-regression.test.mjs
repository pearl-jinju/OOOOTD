import test from 'node:test';
import assert from 'node:assert/strict';
import {appropriate,tagsFor} from '../shared/outfits.mjs';

test('the reported padded shirt jacket cannot fill the outerwear slot',()=>{
 const reported={id:7750182,name:'패딩 안감 코듀로이 셔츠형 자켓 D/그레이 (AM0GOJP45237)',category:'outer',gender:'men',color:'grey',subcategory:'슈트/블레이저 재킷'};
 assert.deepEqual(tagsFor(reported),[]);
 for(const name of ['Oxford Shirt','Corduroy Shacket','Padded Shirt Jacket','코듀로이 오버셔츠']){
  assert.equal(appropriate({...reported,name},'daily'),false,name);
 }
 assert.equal(appropriate({...reported,category:'top',name:'Oxford Shirt'},'daily'),true);
});

test('real outerwear and explicitly registered personal layers are still eligible',()=>{
 for(const name of ['코듀로이 트러커 재킷','데님 트러커 재킷','클래식 울 코트','Linen Blazer','Fleece Jacket']){
  assert.equal(appropriate({name,category:'outer'},'daily'),true,name);
 }
 assert.equal(appropriate({name:'My Overshirt',category:'outer',isOwned:true},'daily'),true);
});
