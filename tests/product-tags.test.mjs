import test from 'node:test';
import assert from 'node:assert/strict';
import {outfitTagDistance, withProductTags} from '../shared/product-tags.mjs';

test('legacy Korean product titles receive evidence-based tags used for diversity', () => {
  const item = {id: 1, name: "네이비 와이드 린넨 스트라이프 경량 셔츠"};
  const tagged = withProductTags(item);
  assert.deepEqual(tagged.productTags, {tone:['dark'], fit:['wide'], pattern:['stripe'], material:['linen'], weight:['lightweight']});
  assert.equal(withProductTags(tagged), tagged);
  const different = {id: 2, name: 'white slim plain cotton shirt'};
  const unknown = {id: 3, name: 'shirt'};
  assert.equal(outfitTagDistance([different], [item]), 4);
  assert.equal(outfitTagDistance([unknown], [item]), 0);
});

test('tags distinguish sleeve lengths, faux leather, optional lining and shoe names', () => {
  const legacy = {category:'outer', name:"비건 레더 오버핏 롱슬리브 자켓 [기모/논기모]", productTagVersion:1, productTags:{material:['leather'],weight:['lined']}};
  const {productTags} = withProductTags(legacy);
  assert.deepEqual(productTags.material,['fauxLeather']);
  assert.deepEqual(productTags.length,['long']);
  assert.equal(productTags.weight,undefined);
  assert.deepEqual(withProductTags({name:"반소매 티셔츠"}).productTags.length,['short']);
  assert.deepEqual(withProductTags({category:'shoes',name:"맥시 스트레이트팁 플레인토 구두"}).productTags,{});
  assert.deepEqual(withProductTags({name:'Long Sleeveless Top'}).productTags.length,['short']);
});
