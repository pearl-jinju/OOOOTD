const diagram = document.getElementById('runtime-svg');
const nodes = [...diagram.querySelectorAll('.runtime-node')];
const paths = [...diagram.querySelectorAll('.runtime-links path')];
const packet = document.getElementById('runtime-packet');
const caption = document.getElementById('runtime-caption');
const progress = document.getElementById('runtime-progress');
const previous = document.getElementById('runtime-prev');
const next = document.getElementById('runtime-next');
const replay = document.getElementById('runtime-play');
const mobile = matchMedia('(max-width: 600px)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const stages = [
  [0,1,'Render가 웹 화면을 브라우저에 전달해요.'],
  [1,2,'브라우저가 Neon API에 날씨, 공개 상품, 내 옷장 데이터를 요청해요.'],
  [2,3,'Neon API가 저장소를 조회해요. 날씨는 Open-Meteo에서 가져와요.'],
  [2,1,'브라우저가 받은 데이터를 조합해 상황에 맞는 룩북을 보여줘요.']
];
const horizontal = [
  'M205 85H245','M440 85H480','M675 85H715',
  'M578 129V162Q578 175 565 175H355Q342 175 342 162V132'
];
const vertical = [
  'M150 97V120','M150 211V234','M150 325V348',
  'M247 282H266Q280 282 280 268V183Q280 168 266 168H251'
];

let index = 0, playing = false, animationFrame, timer;

function paint() {
  const [from,to,message] = stages[index];
  nodes.forEach((node,i) => node.classList.toggle('active',i===from||i===to));
  paths.forEach((path,i) => path.classList.toggle('active',i===index));
  caption.textContent = message;
  progress.textContent = (index+1)+' / '+stages.length;
  previous.disabled = index===0;
  next.disabled = index===stages.length-1;
  replay.textContent = playing?'일시정지':index===stages.length-1?'다시 재생':'재생';
}

function pause() {
  playing=false;
  cancelAnimationFrame(animationFrame);
  clearTimeout(timer);
  packet.setAttribute('hidden','');
  paint();
}

function layout() {
  pause();
  diagram.setAttribute('viewBox',mobile.matches?'0 0 310 447':'0 0 932 205');
  const routes=mobile.matches?vertical:horizontal;
  paths.forEach((path,i)=>path.setAttribute('d',routes[i]));
  nodes.forEach((node,i)=>node.setAttribute('transform',mobile.matches?'translate(54 '+(10+i*114)+')':'translate('+(13+i*235)+' 42)'));
}

function runStage() {
  paint();
  if (!reduceMotion.matches) {
    const path = paths[index], length = path.getTotalLength(), start = performance.now();
    packet.removeAttribute('hidden');
    const advance = time => {
      const fraction = Math.min(1,(time-start)/780);
      const point = path.getPointAtLength(length*fraction);
      packet.setAttribute('cx',point.x);
      packet.setAttribute('cy',point.y);
      if(fraction<1)animationFrame=requestAnimationFrame(advance);
    };
    animationFrame=requestAnimationFrame(advance);
  }
  timer=setTimeout(()=>{
    if(index===stages.length-1){pause();return;}
    index++;
    runStage();
  },reduceMotion.matches?1550:1750);
}

previous.addEventListener('click',()=>{index=Math.max(0,index-1);pause();});
next.addEventListener('click',()=>{index=Math.min(stages.length-1,index+1);pause();});
replay.addEventListener('click',()=>{
  if(playing){pause();return;}
  if(index===stages.length-1)index=0;
  playing=true;
  runStage();
});
mobile.addEventListener('change',layout);
layout();
