import test from 'node:test';
import assert from 'node:assert/strict';
import {genderCompatible,withCatalogAudience} from '../shared/outfits.mjs';
test('reported catalog product and exclusive seller labels override unisex',()=>{
 const report={id:7730672,gender:'men',unisex:true,sourceGender:'\uACF5\uC6A9'};
 assert.equal(withCatalogAudience(report).gender,'women');
 assert.equal(genderCompatible(report,'men'),false);
 assert.equal(genderCompatible(report,'women'),true);
 assert.equal(genderCompatible({...report,isOwned:true},'men'),true);
 assert.equal(genderCompatible({id:4,gender:'men',unisex:true,sourceGender:'\uC5EC\uC131'},'men'),false);
 assert.equal(genderCompatible({id:5,gender:'men',unisex:true,sourceGender:'\uACF5\uC6A9'},'women'),true);
});
