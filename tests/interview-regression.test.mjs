
import test from 'node:test';
import assert from 'node:assert/strict';
import {appropriate} from '../shared/outfits.mjs';
test('reported interview failures are rejected even with misleading formal metadata',()=>{
 const bad=[
  {name:'(U) Navy Tracksuit Top (NAVY/WHITE)',category:'outer',color:'white',subcategory:'슈트/블레이저 재킷'},
  {name:'(M) SHORT SLEEVE SHIRT (TORTORA)',category:'top',color:'black',subcategory:'셔츠/블라우스'},
  {name:'(M) HENLEY SHORT SLEEVE (DEEP BLACK)',category:'top',color:'black'},
  {name:'빈티지 레더 주름 셔링 로퍼',category:'shoes',color:'black'},
  {name:'Paisley Pattern Long Sleeve Dress Shirt',category:'top',color:'white'},
  {name:'하프 집업 트레이닝 셔츠',category:'top',color:'white'},
  {name:'UNKNOWN PRODUCT 01',category:'top',color:'white',subcategory:'셔츠/블라우스'}
 ];
 for(const item of bad)assert.equal(appropriate({...item,occasion:'interview',occasions:['interview']},'interview'),false,item.name);
 for(const occasion of ['work','wedding','meeting'])assert.equal(appropriate(bad[0],occasion),false);
});
test('plain conservative interview clothing remains available',()=>{
 for(const item of [
  {name:'클래식 울 블레이저',category:'outer',color:'navy'},
  {name:'솔리드 긴소매 드레스 셔츠',category:'top',color:'white'},
  {name:'(U) Navy Pinstripe Double Pleat Trousers (NAVY)',category:'bottom',color:'navy'},
  {name:'클래식 가죽 옥스포드 구두',category:'shoes',color:'black'}
 ])assert.equal(appropriate(item,'interview'),true,item.name);
});

test('visual review excludes polos, flared pants and casual tweed from default interview looks',()=>{
 for(const item of [
 {name:'롱 슬리브 피케 폴로 셔츠',category:'top',color:'black'},
 {name:'LONG SLEEVE PIQUE POLO SHIRT',category:'top',color:'black'},
 {name:'세미 부츠컷 슬랙스',category:'bottom',color:'black'},
 {name:'헤링본 트위드 블레이저',category:'outer',color:'grey'},
 {name:'심플 레페토 디자인 옥스포드 구두',category:'shoes',color:'black',unisex:true}
 ])assert.equal(appropriate(item,'interview','men'),false,item.name);
});

test('formal occasions reject resort and short-sleeve shirts even with stale catalog labels',()=>{
  for(const occasion of ['work','interview','wedding','meeting']){
    for(const name of ['(M) SHORT SLEEVE SHIRT (TORTORA)','Paisley Pattern Long Sleeve Dress Shirt','하와이안 반소매 셔츠','Camp Collar Shirt']){
      assert.equal(appropriate({name,category:'top',color:'black',occasion,occasions:[occasion]},occasion),false,name);
    }
    assert.equal(appropriate({name:'Solid Long Sleeve Dress Shirt',category:'top',color:'white'},occasion),true);
  }
  assert.equal(appropriate({name:'(M) SHORT SLEEVE SHIRT (TORTORA)',category:'top'},'daily'),true);
});
