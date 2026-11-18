export {CLOTHING_COLORS} from './colors.mjs';
export {outfitTagDistance} from './product-tags.mjs';

export const OCCASIONS=[
{id:'daily',name:'일상생활',icon:'fa-mug-saucer',desc:'편안하게 입는 데일리 코디'},
{id:'library',name:'도서관·마실',icon:'fa-book-open',desc:'오래 앉아 있어도 편한 캐주얼'},
{id:'date',name:'데이트',icon:'fa-heart',desc:'단정하고 분위기 있는 데이트룩'},
{id:'work',name:'출근·격식',icon:'fa-briefcase',desc:'셔츠·슬랙스·로퍼 중심의 단정한 조합'},
{id:'interview',name:'면접',icon:'fa-user-tie',desc:'차분한 색과 격식 있는 옷차림'},
{id:'wedding',name:'결혼식 하객',icon:'fa-champagne-glasses',desc:'예의를 갖춘 차분한 하객룩'},
{id:'meeting',name:'비즈니스 미팅',icon:'fa-handshake',desc:'업무 미팅과 발표에 어울리는 정돈된 코디'},
{id:'travel',name:'여행',icon:'fa-suitcase',desc:'많이 걸어도 편한 여행 코디'},
{id:'cafe',name:'카페·브런치',icon:'fa-coffee',desc:'니트·셔츠 중심의 여유 있는 외출복'},
{id:'shopping',name:'쇼핑·나들이',icon:'fa-bag-shopping',desc:'움직이기 편한 가벼운 외출룩'},
{id:'party',name:'파티·모임',icon:'fa-martini-glass',desc:'블레이저·셔츠 등으로 꾸미는 모임룩'},
{id:'concert',name:'공연·페스티벌',icon:'fa-music',desc:'편한 신발과 활동적인 캐주얼'},
{id:'exercise',name:'운동·산책',icon:'fa-person-running',desc:'활동하기 편한 스포츠 캐주얼'},
{id:'hiking',name:'등산·트레킹',icon:'fa-mountain',desc:'아웃도어 의류와 트레킹용 신발'},
{id:'running',name:'러닝',icon:'fa-running',desc:'러닝화와 가벼운 운동복'},
{id:'beach',name:'바다·휴양지',icon:'fa-umbrella-beach',desc:'린넨·반팔·샌들 중심의 여름 코디'},
{id:'rainy',name:'비 오는 날',icon:'fa-cloud-rain',desc:'레인 아우터와 방수용 신발 중심'},
{id:'home',name:'집·편한 휴식',icon:'fa-house',desc:'홈웨어·스웨트와 편안한 실내화'}
];
export const CATEGORIES=['outer','top','bottom','shoes'];
const casual=/후드|맨투맨|스웨트|조거|트레이닝|반바지|쇼츠|카고|데님|청바지|슬리퍼|샌들|스니커|운동화|플리스|후리스|hood|sweat|jogger|training|shorts|cargo|denim|jeans|slipper|sandal|sneaker|fleece/i;
const text=item=>String(item.name||'')+' '+String(item.subcategory||'');
export const genderCompatible=(item,gender)=>item.gender===gender||item.unisex===true;
export const genderLabel=item=>item.unisex?'남녀공용':item.gender==='women'?'여성':'남성';
export function appropriate(item,occasion,gender=item.unisex?null:item.gender){
 const n=text(item),cat=item.category;
 if(!CATEGORIES.includes(cat))return false;
 if(['work','interview','wedding','meeting'].includes(occasion)){
  if(casual.test(n)||/tracks?[\s_-]*suits?|트랙[\s_-]*수트|트랙.?탑|track[\s_-]*(?:top|jacket)|하프.?집업|half[\s_-]*zip|쿼터.?집업|quarter[\s_-]*zip|저지|jersey|셔켓|shacket|shirt[\s_-]*jacket/i.test(n))return false;
  if(cat==='top'){
    if(/반팔|반소매|민소매|쇼트.?슬리브|하프.?슬리브|오픈.?카라|오픈.?칼라|캠프.?카라|하와이|리조트|페이즐리|플라워|꽃무늬|그래픽|프린트|타이다이|\b(?:short[ -]*sleeve|half[ -]*sleeve|sleeveless|open[ -]*collar|camp[ -]*collar|hawaiian|resort|paisley|floral|graphic|printed|tie[ -]*dye|polo|henley)\b/i.test(n))return false;
  }
  if(occasion==='interview'){
   const name=String(item.name||'');
   const flashy=/패턴|프린트|그래픽|플라워|하와이|페이즐리|체크|체커|도트|타이다이|로고|시스루|레이스|오버핏|오버사이즈|크롭|pattern|print|graphic|floral|hawai|paisley|check|polka|tie[\s_-]*dye|logo|sheer|see[\s_-]*through|lace|oversiz|crop/i;
   if(cat==='outer'){
    if(!['black','navy','grey'].includes(item.color)||flashy.test(name)||/레더|가죽|나일론|트위드|헤링본|부클|루즈|드롭.?숄더|leather|nylon|tweed|herringbone|boucle|relaxed|loose|drop.?shoulder/i.test(name))return false;
    return /블레이저|정장.?재킷|정장.?자켓|슈트.?재킷|수트.?재킷|테일러드.?재킷|테일러드.?자켓|\bblazers?\b|\bsuit[\s_-]+jackets?\b|\btailored[\s_-]+jackets?\b/i.test(name);
   }
   if(cat==='top'){
    if(!['white','blue','sky','grey','beige','black','navy'].includes(item.color)||flashy.test(name))return false;
    if(/폴로|피케|카라.?티|니트|polo|pique|knit|반팔|반소매|민소매|쇼트.?슬리브|하프.?슬리브|오픈.?카라|오픈.?칼라|리조트|헨리|린넨|리넨|티셔츠|티 셔츠|short[\s_-]*sleeve|half[\s_-]*sleeve|sleeveless|\bs\/s\b|\bss\b|open[\s_-]*collar|resort|henley|linen|t[\s_-]*shirt|\btee\b/i.test(name))return false;
    if(gender==='men'&&/블라우스|blouse/i.test(name))return false;
    return /셔츠|블라우스|\bshirts?\b|\bblouses?\b/i.test(name)&&/무지|솔리드|베이직|드레스|옥스포드|포플린|브로드|긴팔|긴소매|롱.?슬리브|클래식|수피마|basic|solid|plain|dress|oxford|poplin|broadcloth|long[\s_-]*sleeve|classic/i.test(name);
   }
   if(cat==='bottom'){
    if(!['black','navy','grey'].includes(item.color)||/부츠.?컷|플레어|벨보텀|boot[\s_-]*cut|flare|bell[\s_-]*bottom|밴딩|와이드|벌룬|플리츠.?와이드|조거|스웨트|트레이닝|오버|banding|wide|balloon|jogger|sweat|training|oversiz/i.test(name))return false;
    if(gender==='men'&&/스커트|skirt/i.test(name))return false;
    return /슬랙스|트라우저|정장|슈트.?팬츠|수트.?팬츠|펜슬.?스커트|\bslacks?\b|\btrousers?\b|suit[\s_-]*pants|pencil[\s_-]*skirt/i.test(name);
   }
   if(cat==='shoes'){
    if(gender==='men'&&/펌프스|메리.?제인|발레|레페토|힐|플랫|pumps?|mary[\s_-]*jane|ballet|repetto|heel|flat|court[\s_-]*shoe/i.test(name))return false;
    if(item.color!=='black'&&!(['beige','brown'].includes(item.color)&&/브라운|brown/i.test(name)))return false;
    if(/빈티지|주름|셔링|메쉬|메시|니트|청키|체인|스터드|플랫폼|스웨이드|뮬|vintage|wrinkl|shirr|mesh|knit|chunky|chain|studd|platform|suede|\bmule\b/i.test(name))return false;
    return /로퍼|더비|옥스포드|플레인.?토|스트레이트.?팁|펌프스|페니|\bloafer|\bderby|\boxford|plain[\s_-]*toe|straight[\s_-]*tip|\bpumps?\b|court[\s_-]*shoe/i.test(name);
   }
   return false;
  }
  if(occasion==='interview'&&item.color==='point')return false;
  const formal={outer:/블레이저|수트|정장|테일러|코트|blazer|\bsuits?\b|tailor|coat/i,top:/셔츠|블라우스|shirt|blouse/i,bottom:/슬랙스|트라우저|정장|수트|스커트|slack|trouser|\bsuits?\b|skirt/i,shoes:/로퍼|구두|더비|옥스포드|펌프스|메리.?제인|loafer|derby|oxford|pump|heel|dress shoe/i};
  if(cat==='top'&&/티셔츠|티 셔츠|t-shirt|tee|오버셔츠|overshirt/i.test(n))return false;
  return formal[cat].test(n);
 }
 if(occasion==='rainy'){
  if(cat==='outer'||cat==='shoes')return /레인|방수|고어.?텍스|장화|rain|waterproof|gore.?tex/i.test(n);
  return !/스웨이드|suede|기모|벨벳|velvet/i.test(n);
 }
 if(['exercise','running','hiking'].includes(occasion)){
  if(cat==='shoes'){
   if(occasion==='hiking')return /트레킹|트래킹|등산|하이킹|트레일|trek|hiking|trail/i.test(n);
   if(occasion==='running')return /러닝|런닝|마라톤|running|runner|run\b/i.test(n);
   return /운동화|스니커|러닝|런닝|트레일|sneaker|running|runner|trainer|trail/i.test(n);
  }
  if(cat==='outer')return /바람막이|윈드|아노락|트랙|트레이닝|플리스|후리스|고어|방수|등산|아웃도어|패딩|자켓|재킷|점퍼|wind|anorak|track|fleece|outdoor|jacket|puffer/i.test(n)&&!/블레이저|가죽|레더|무스탕|blazer|leather|shearling/i.test(n);
  if(cat==='bottom')return /조거|트레이닝|트랙|레깅스|쇼츠|반바지|카고|등산|아웃도어|jogger|training|track|legging|shorts|cargo|outdoor/i.test(n);
  return /티셔츠|티 셔츠|맨투맨|후드|스웨트|저지|탑|민소매|긴소매|반소매|t-shirt|tee|sweat|hood|jersey|tank|top/i.test(n)&&!/드레스.?셔츠|블라우스|dress.?shirt|blouse/i.test(n);
 }
 if(occasion==='beach'){
  if(cat==='outer')return /린넨|리넨|가디건|셔츠|시스루|linen|cardigan|shirt|sheer/i.test(n)&&!/패딩|다운|울|wool|down|puffer/i.test(n);
  if(cat==='top')return /린넨|리넨|반팔|반소매|민소매|니트.?탑|셔츠|슬리브리스|linen|t-shirt|tee|tank|shirt|sleeveless/i.test(n);
  if(cat==='bottom')return /쇼츠|반바지|린넨|리넨|스커트|shorts|linen|skirt/i.test(n);
  return /샌들|슬리퍼|플립플롭|쪼리|sandal|slide|flip.?flop/i.test(n);
 }
 if(occasion==='home'){
  if(cat==='shoes')return /슬리퍼|뮬|클로그|실내화|slipper|slide|mule|clog/i.test(n);
  if(cat==='outer')return /가디건|후드|플리스|후리스|집업|cardigan|hood|fleece|zip/i.test(n);
  if(cat==='top')return /티셔츠|맨투맨|스웨트|후드|니트|t-shirt|tee|sweat|hood|knit/i.test(n);
  return /스웨트|조거|트레이닝|와이드|밴딩|니트|쇼츠|반바지|sweat|jogger|training|wide|knit|shorts/i.test(n);
 }
 if(['travel','shopping','concert'].includes(occasion)){
  if(cat==='shoes')return /스니커|운동화|러닝|트레킹|로퍼|플랫|sneaker|running|trek|loafer|flat/i.test(n)&&!/힐|펌프스|스틸레토|heel|pump|stiletto/i.test(n);
  return !/턱시도|수영복|비키니|tuxedo|swim|bikini/i.test(n);
 }
 if(['date','cafe','party'].includes(occasion)){
  if(/트레이닝|레깅스|등산|고어텍스|training|legging|hiking|gore.?tex/i.test(n))return false;
  if(cat==='shoes')return !/실내화|슬리퍼|등산|트레킹|slipper|hiking|trek/i.test(n);
  if(occasion==='party')return !/맨투맨|후드|조거|스웨트|sweat|hood|jogger/i.test(n);
  return true;
 }
 return !/수영복|비키니|swimwear|bikini/i.test(n);
}
export function tagsFor(item){return OCCASIONS.filter(o=>appropriate(item,o.id)).map(o=>o.id)}
export function occasionScore(item,occasion){
 if(!appropriate(item,occasion))return -10000;
 const n=text(item);
 const preferences={
  daily:/데님|코튼|티셔츠|스니커|denim|cotton|tee|sneaker/i,
  library:/후드|맨투맨|스웨트|가디건|카디건|밴딩|hood|sweat|cardigan/i,
  date:/니트|셔츠|블라우스|코트|로퍼|knit|shirt|blouse|coat|loafer/i,
  work:/블레이저|슬랙스|셔츠|로퍼|blazer|slack|shirt|loafer/i,
  interview:/슈트|수트|정장|드레스.?셔츠|옥스포드|suit|dress.?shirt|oxford/i,
  wedding:/테일러|블라우스|플리츠|펌프스|레이스|tailor|blouse|pleat|pump|lace/i,
  meeting:/블레이저|테일러|카라|더비|blazer|tailor|collar|derby/i,
  travel:/바람막이|윈드|경량|카고|러닝|wind|light|cargo|running/i,
  cafe:/가디건|카디건|니트|코듀로이|로퍼|cardigan|knit|corduroy|loafer/i,
  shopping:/데님|코튼|후드|스니커|denim|cotton|hood|sneaker/i,
  party:/새틴|벨벳|레더|레이스|힐|satin|velvet|leather|lace|heel/i,
  concert:/그래픽|프린트|레더|데님|오버|워커|graphic|print|leather|denim|over|boot/i,
  exercise:/트랙|트레이닝|스웨트|조거|track|training|sweat|jogger/i,
  hiking:/등산|트레킹|트레일|고어|카고|hiking|trek|trail|gore|cargo/i,
  running:/러닝|런닝|경량|레깅스|쇼츠|running|runner|light|legging|shorts/i,
  beach:/린넨|리넨|반팔|쇼츠|샌들|플립|linen|shorts|sandal|flip/i,
  rainy:/레인|고어|방수|장화|rain|gore|waterproof/i,
  home:/라운지|홈|밴딩|스웨트|슬리퍼|lounge|home|sweat|slipper/i
 };
 let score=(item.occasion===occasion?35:25)+((item.occasions||[]).includes(occasion)?10:0);
 if(preferences[occasion]?.test(n))score+=18;
 const palettes={interview:['black','white','navy','grey'],meeting:['navy','grey','beige'],wedding:['navy','beige','grey'],cafe:['beige','white'],hiking:['khaki','navy','beige'],beach:['white','beige','blue'],rainy:['black','navy'],party:['black','point'],concert:['black','point']};
 if(palettes[occasion]?.includes(item.color))score+=8;
 return score;
}
export function coverage(items){
 const result={};
 for(const gender of ['men','women']){
  result[gender]={};
  for(const o of OCCASIONS){
   const counts=Object.fromEntries(CATEGORIES.map(cat=>[cat,items.filter(i=>genderCompatible(i,gender)&&i.category===cat&&appropriate(i,o.id,gender)).length]));
   result[gender][o.id]={...counts,minimum:Math.min(...Object.values(counts)),combinations:Object.values(counts).reduce((a,b)=>a*b,1)};
  }
 }return result;
}

const everydayLayers=['daily','library','date','work','travel','cafe','shopping','party','concert'];
const outdoorLayers=['exercise','running','hiking','beach'];
const jacketDressCodes=['interview','meeting','wedding'];

export function outerwearPolicy(weather,occasion){
 const {temp,min,max,wind}=weather;
 if(jacketDressCodes.includes(occasion))return 'required';
 if(occasion==='home')return 'omit';
 if(temp<=11||(temp<=14&&wind>=28&&!outdoorLayers.includes(occasion)))return 'required';
 if(occasion==='rainy')return temp<=18?'required':temp<26?'optional':'omit';
 if(outdoorLayers.includes(occasion))return temp<=16?'optional':'omit';
 if(everydayLayers.includes(occasion)&&(temp<=21||(min<=17&&max-min>=8&&temp<26)))return 'optional';
 return 'omit';
}

export function suitableWeatherItem(item,weather){
 if(weather.temp<(item.category==='outer'?17:24)||item.category==='shoes')return true;
 const name=String(item.name||'');
 const heavy=/한겨울|헤비다운|롱패딩|패딩|구스다운|덕다운|무스탕|양털|플리스|후리스|기모(?![\/]|\s*(?:선택|유무))|(?:^|[\s_-])(?:puffer|parka|shearling|fleece|heavyweight)(?:$|[\s_-])/i;
 if(heavy.test(name)||item.season==='winter')return false;
 if(item.category!=='outer')return true;
 if(/린넨|리넨|시어서커|홑겹|언라인드|여름|경량|\b(?:linen|seersucker|unlined|summer|lightweight)\b/i.test(name))return true;
 return weather.temp<24||!/코트|(?:^|[\s_-])(?:overcoat|coat)(?:$|[\s_-])/i.test(name);
}
