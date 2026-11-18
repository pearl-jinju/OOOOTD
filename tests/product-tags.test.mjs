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
