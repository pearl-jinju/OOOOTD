import {CLOTHING_COLORS} from '../shared/colors.mjs';

const runtimeUrl='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';
const modelUrl='https://huggingface.co/Prikol5ist/pasma/resolve/5346fc6adf7c345fef3ff0ac84abfc11a210b959/models/pasma_small_320_fp32.onnx';
const size=320;
const garments=[
 ['티셔츠','top','warm','daily'],['셔츠','top','mild','daily'],
 ['블라우스','top','mild','date'],['니트','top','chilly','daily'],
 ['후드티','top','chilly','library'],['바지','bottom','mild','daily'],
 ['청바지','bottom','mild','daily'],['반바지','bottom','hot','daily'],
 ['스커트','bottom','mild','daily'],['재킷','outer','chilly','daily'],
 ['코트','outer','winter','daily'],['조끼','outer','mild','daily'],
 null,['구두','shoes','mild','work'],['부츠','shoes','chilly','daily'],
 ['운동화','shoes','mild','daily'],['샌들','shoes','hot','daily'],
 null,null,null
];
let modelPromise;

function loadModel(){
 if(!modelPromise){
  modelPromise=(async()=>{
   const {env,InferenceSession,Tensor}=await import(runtimeUrl+'ort.wasm.min.mjs');
   env.wasm.numThreads=1;
   env.wasm.wasmPaths=runtimeUrl;
   const session=await InferenceSession.create(modelUrl,{executionProviders:['wasm']});
   return {session,Tensor};
  })().catch(error=>{modelPromise=undefined;throw error;});
 }
 return modelPromise;
}


function pixelColor(r,g,b,whiteThreshold){
 const high=Math.max(r,g,b),low=Math.min(r,g,b),spread=high-low;
 const light=0.2126*r+0.7152*g+0.0722*b;
 if(high<54)return 'black';
 const saturation=spread/high;
 if(spread<22||saturation<0.15)return light>=whiteThreshold?'white':'grey';
 const hue=((high===r?(g-b)/spread:high===g?2+(b-r)/spread:4+(r-g)/spread)*60+360)%360;
 if(hue<13||hue>=345){
  if(high<145&&light<105&&saturation>0.32)return 'burgundy';
  if(saturation<0.50&&light>137)return 'pink';
  return 'red';
 }
 if(hue>=37&&hue<67&&high>=220&&saturation>=0.16&&g>=r*0.88)return 'yellow';
 if(hue<44){
  if(saturation<0.42&&light>=126)return 'beige';
  return light<126?'brown':'orange';
 }
 if(hue<67){
  if(saturation<0.38&&light>=139)return 'beige';
  return light<125?'khaki':'yellow';
 }
 if(hue<157)return (hue<100&&light<166&&saturation<0.63)?'khaki':'green';
 if(hue<193)return light>161&&saturation<0.35?'sky':'teal';
 if(hue<257){
  if(high<100||(high<132&&light<95&&saturation<0.64))return 'navy';
  if(light>145&&saturation<0.58)return 'sky';
  return 'blue';
 }
 if(hue<306)return 'purple';
 if(light<107)return 'burgundy';
 return 'pink';
}

export function garmentColor(data,width,height){
 const pixel=(x,y)=>{
  const i=(Math.floor(y*height)*width+Math.floor(x*width))*4;
  return [data[i],data[i+1],data[i+2]];
 };
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 const corners=[pixel(.06,.06),pixel(.94,.06),pixel(.06,.94),pixel(.94,.94)];
 const background=corners.find(color=>corners.filter(other=>distance(color,other)<33).length>=3);
 const neutralBackground=background&&Math.max(...background)-Math.min(...background)<=24;
 const reference=neutralBackground?background.reduce((a,b)=>a+b,0)/3:232;
 const whiteThreshold=reference>=176?Math.max(170,Math.min(204,reference*0.86)):204;
 const foreground={},center={};
 let foregroundCount=0,centerCount=0;
 for(let y=Math.floor(height*.2);y<height*.81;y+=2){
  for(let x=Math.floor(width*.26);x<width*.74;x+=2){
   const i=(y*width+x)*4;
   const rgb=[data[i],data[i+1],data[i+2]];
   const color=pixelColor(...rgb,whiteThreshold);
   center[color]=(center[color]||0)+1;
   centerCount++;
   if(!background||distance(rgb,background)>=32){
    foreground[color]=(foreground[color]||0)+1;
    foregroundCount++;
   }
  }
 }
 const votes=foregroundCount>=centerCount*.17?foreground:center;
 const [first,second]=Object.entries(votes).sort((a,b)=>b[1]-a[1]);
 if(first?.[0]==='grey'&&second?.[0]==='white'&&second[1]/(first[1]+second[1])>=.34)return 'white';
 return first?.[0]||'grey';
}
export async function analyzeGarmentPhoto(file){
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();
  image.src=url;
  await image.decode();
  const scale=size/Math.max(image.naturalWidth,image.naturalHeight);
  const w=Math.max(1,Math.round(image.naturalWidth*scale)),h=Math.max(1,Math.round(image.naturalHeight*scale));
  const x=Math.floor((size-w)/2),y=Math.floor((size-h)/2);
  ctx.fillStyle='#808080';
  ctx.fillRect(0,0,size,size);
  ctx.drawImage(image,x,y,w,h);
  const rgba=ctx.getImageData(0,0,size,size).data;
  const plane=size*size;
  const data=new Float32Array(plane*3);
  for(let i=0;i<plane;i++){
   for(let c=0;c<3;c++)data[c*plane+i]=rgba[4*i+c]/255;
  }
  const {session,Tensor}=await loadModel();
  const output=await session.run({image:new Tensor('float32',data,[1,3,size,size])});
  const scores=output.prob_type.data;
  const type=scores.indexOf(Math.max(...scores));
  const garment=garments[type];
  if(!garment||scores[type]<0.35)return null;
  const [label,category,season,occasion]=garment;
  const color=garmentColor(ctx.getImageData(x,y,w,h).data,w,h);
  return {name:CLOTHING_COLORS[color][0]+' '+label,category,color,season,occasion};
 }finally{URL.revokeObjectURL(url);}
}
