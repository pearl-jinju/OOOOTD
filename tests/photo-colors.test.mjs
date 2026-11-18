import test from 'node:test';
import assert from 'node:assert/strict';
import {CLOTHING_COLORS} from '../shared/colors.mjs';
import {garmentColor} from '../frontend/photo-analysis.mjs';
function photo(garment,background,shadow=garment){
 const size=100,data=new Uint8ClampedArray(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const color=x>=30&&x<70&&y>=20&&y<80?(x<38?shadow:garment):background;
  data.set([...color,255],(y*size+x)*4);
 }
 return garmentColor(data,size,size);
}
test('all individual supported swatches are classified with a contrasting background',()=>{
 for(const [color,[,hex]] of Object.entries(CLOTHING_COLORS)){
  if(color==='point')continue;
  const rgb=hex.match(/[a-f0-9]{2}/gi).map(channel=>parseInt(channel,16));
  const background=color==='white'?[70,67,63]:[238,238,238];
  assert.equal(photo(rgb,background),color,color);
 }
});
test('lighting and backgrounds do not merge white and gray or blue and yellow',()=>{
 assert.equal(photo([186,185,184],[212,211,209],[157,156,156]),'white');
 assert.equal(photo([151,149,150],[220,220,220],[110,109,110]),'grey');
 assert.equal(photo([38,104,177],[213,173,49]),'blue');
 assert.equal(photo([218,174,40],[30,93,174]),'yellow');
 assert.equal(photo([245,234,199],[239,237,240]),'yellow');
 assert.equal(photo([38,62,126],[255,255,255]),'blue');
});
