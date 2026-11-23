import test from 'node:test';
import assert from 'node:assert/strict';
import {findFavoriteProducts,parseFavoriteCommand,retailerProductUrl,retailerSearchUrl} from '../assets/favorite-commands.js';

test('Korean chat separates save requests, questions and retailer-account requests',()=>{
 assert.deepEqual(parseFavoriteCommand('지금 코디 찜해 줘.'),{action:'add',target:'outfit'});
 assert.deepEqual(parseFavoriteCommand('검정 로퍼를 찜해주세요'),{action:'add',target:'product',query:'검정 로퍼'});
 assert.deepEqual(parseFavoriteCommand('로퍼 관심 목록에 넣어 줘'),{action:'add',target:'product',query:'로퍼'});
 assert.deepEqual(parseFavoriteCommand('찜해 줘'),{action:'add'});
 assert.deepEqual(parseFavoriteCommand('찜 목록 보여줘'),{action:'list'});
 assert.deepEqual(parseFavoriteCommand('이 코디 찜할 수 있어?'),{action:'info'});
 assert.deepEqual(parseFavoriteCommand('로퍼 찜하지 말아 줘'),{action:'info'});
 assert.deepEqual(parseFavoriteCommand('검정 로퍼를 무신사에서 찜해줘'),{action:'retailer',query:'검정 로퍼'});
 assert.deepEqual(parseFavoriteCommand('지금 코디 찜 해제해 줘'),{action:'remove',target:'outfit'});
 assert.deepEqual(parseFavoriteCommand('지금 코디 찜 해제할 수 있어?'),{action:'info'});
 assert.equal(parseFavoriteCommand('내일 면접 코디 알려줘'),null);
});

test('catalog matching prefers exact names and rejects invalid links or known sold-out entries',()=>{
 const item=(id,name,extra={})=>({id,name,sourceUrl:'https://www.musinsa.com/products/'+id,...extra});
 const black=item(11,'클래식 로퍼',{color:'black'});
 const different=item(12,'레더 로퍼',{color:'black'});
 const brown=item(13,'브라운 로퍼',{color:'brown'});
 const items=[black,different,brown,
  item(14,'로퍼',{sourceUrl:'https://www.musinsa.com.evil.test/products/14'}),
  item(15,'로퍼',{availability:'sold_out'}),item(16,'러닝화')];
 assert.deepEqual(findFavoriteProducts(items,'검정 로퍼'),[black,different]);
 assert.deepEqual(findFavoriteProducts(items,'클래식 로퍼'),[black]);
 assert.deepEqual(findFavoriteProducts(items,'로퍼'),[black,different,brown]);
 assert.deepEqual(findFavoriteProducts(items,'자켓'),[]);
 assert.equal(retailerProductUrl('https://www.musinsa.com/products/11?redirect=external'),null);
 assert.match(retailerSearchUrl('로퍼&next=example'),/^https:\/\/www\.musinsa\.com\/search\/goods\?keyword=[^&]+$/);
});

test('whole lookbook language is distinct from one outfit or one named product',()=>{
 assert.deepEqual(parseFavoriteCommand('지금 룩북 전체 찜해줘'),{action:'add',target:'lookbookItems'});
 assert.deepEqual(parseFavoriteCommand('이 룩북에 보이는 상품들을 찜해 줘'),{action:'add',target:'lookbookItems'});
 assert.deepEqual(parseFavoriteCommand('지금 룩북 전체를 찜 목록에 넣어 줘'),{action:'add',target:'lookbookItems'});
 assert.deepEqual(parseFavoriteCommand('지금 룩북 찜해 줘'),{action:'add',target:'outfit'});
 assert.deepEqual(parseFavoriteCommand('검정 로퍼 찜해 줘'),{action:'add',target:'product',query:'검정 로퍼'});
});
