import {appropriate} from '../shared/outfits.mjs';

const categories={outer:/겉옷|아우터|재킷|바람막이/,top:/상의|티셔츠|셔츠|니트/,bottom:/하의|바지|스커트/,shoes:/신발|운동화|구두|장화|샌들/};
const colors={black:/검정|검은|블랙/,white:/하얀|흰색|화이트|아이보리/,grey:/회색|그레이/,navy:/네이비/,blue:/파란|파랑|블루/,beige:/베이지|브라운/,khaki:/카키|올리브/};
const purposes={rainy:/비 오는|빗길|우천/,interview:/면접/,work:/출근|격식/,running:/러닝|달리기/,hiking:/등산|트레킹/,daily:/일상|데일리/};
const waterproof=/방수|고어.?텍스|\bwaterproof\b|gore.?tex/i;
const pick=(choices,query)=>Object.keys(choices).find(key=>choices[key].test(query));
const searchable=item=>[item.name,item.subcategory].filter(Boolean).join(' ');

export function rankPublicCatalog(items,question){
  const query=question.trim().toLowerCase();
  const category=pick(categories,query), color=pick(colors,query), purpose=pick(purposes,query);
  const criteria=[];
  if(category)criteria.push(['종류',25,item=>item.category===category]);
  if(color)criteria.push(['색상',20,item=>item.color===color]);
  if(purpose)criteria.push(['용도',20,item=>appropriate(item,purpose)]);
  if(waterproof.test(query))criteria.push(['방수 표기',35,item=>waterproof.test(searchable(item))]);
  if(!criteria.length)criteria.push(['상품명',100,item=>searchable(item).toLowerCase().includes(query)]);
  const max=criteria.reduce((acc,[,weight])=>acc+weight,0);
  return items.filter(item=>(!category||item.category===category)&&(!purpose||appropriate(item,purpose)))
    .map(item=>{
      const matched=criteria.filter(([, ,check])=>check(item));
      return {item,score:Math.round(matched.reduce((acc,[,weight])=>acc+weight,0)*100/max),matched:matched.map(([label])=>label)};
    })
    .filter(result=>result.score>0)
    .sort((left,right)=>right.score-left.score||Number(right.item.id)-Number(left.item.id))
    .slice(0,3);
}

if(typeof document!=='undefined'){
  const form=document.getElementById('catalog-question');
  const question=document.getElementById('question');
  const title=document.getElementById('search-question');
  const status=document.getElementById('search-status');
  const results=document.getElementById('search-results');
  let catalog;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const query=question.value.trim();
    if(!query)return;
    title.textContent='질문 · '+query;
    status.textContent='공개 카탈로그를 검색하고 있어요.';
    results.replaceChildren();
    form.querySelector('button').disabled=true;
    try{
      if(!catalog){
        const {apiUrl}=await (await fetch('../cloud-config.json')).json();
        const res=await fetch(apiUrl+'/catalog');
        if(!res.ok)throw Error('Catalog unavailable');
        catalog=(await res.json()).items;
      }
      const ranked=rankPublicCatalog(catalog,query);
      status.textContent=ranked.length?'가장 가까운 상품 '+ranked.length+'개 · 점수 기준 100점':'조건에 맞는 상품을 찾지 못했어요.';
      for(const {item,score,matched} of ranked){
        const row=document.createElement('li'), heading=document.createElement('div');
        heading.className='result-heading';
        const name=document.createElement('a'), points=document.createElement('strong'), evidence=document.createElement('p');
        name.textContent=item.name;
        if(/^https:\/\/www\.musinsa\.com\/products\/\d+$/.test(item.sourceUrl||'')){
          name.href=item.sourceUrl;
          name.target='_blank';
          name.rel='noopener noreferrer';
        }
        points.textContent=score+'점';
        evidence.textContent='일치 조건 · '+matched.join(' · ');
        heading.append(name,points);
        row.append(heading,evidence);
        results.append(row);
      }
    }catch{
      status.textContent='공개 카탈로그를 불러오지 못했어요. 잠시 후 다시 검색해 주세요.';
    }finally{form.querySelector('button').disabled=false;}
  });
}
