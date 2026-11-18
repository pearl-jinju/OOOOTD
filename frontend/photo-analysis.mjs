
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
const colors={black:'검정',white:'흰색',grey:'회색',navy:'네이비',beige:'베이지',khaki:'카키',blue:'파랑',point:'포인트 색'};
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

function pixelColor(r,g,b){
 const max=Math.max(r,g,b),min=Math.min(r,g,b),spread=max-min;
 if(max<48)return 'black';
 if(spread<25||spread/max<0.16)return max>=213?'white':'grey';
 let hue=max===r?(g-b)/spread:max===g?2+(b-r)/spread:4+(r-g)/spread;
 hue=(hue*60+360)%360;
 if(hue>=175&&hue<=255)return max<115?'navy':'blue';
 if(hue>=60&&hue<175)return 'khaki';
 if((hue<60||hue>=350)&&(max<170||spread/max<0.55))return 'beige';
 return 'point';
}

function garmentColor(data,width,height){
 const corners=[[0.05,0.05],[0.95,0.05],[0.05,0.95],[0.95,0.95]].map(([x,y])=>{
  const n=(Math.floor(y*height)*width+Math.floor(x*width))*4;
  return [data[n],data[n+1],data[n+2]];
 });
 const background=corners.find(([r,g,b])=>corners.filter(c=>Math.hypot(r-c[0],g-c[1],b-c[2])<38).length>=3);
 const foreground={},center={};
 for(let y=Math.floor(height*0.22);y<height*0.8;y+=2){
  for(let x=Math.floor(width*0.28);x<width*0.72;x+=2){
   const n=(y*width+x)*4,r=data[n],g=data[n+1],b=data[n+2];
   const color=pixelColor(r,g,b);
   center[color]=(center[color]||0)+1;
   if(!background||Math.hypot(r-background[0],g-background[1],b-background[2])>=40){
    foreground[color]=(foreground[color]||0)+1;
   }
  }
 }
 const enough=Object.values(foreground).reduce((a,b)=>a+b,0)>=width*height*0.012;
 return Object.entries(enough?foreground:center).sort((a,b)=>b[1]-a[1])[0]?.[0]||'grey';
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
  return {name:colors[color]+' '+label,category,color,season,occasion};
 }finally{URL.revokeObjectURL(url);}
}
