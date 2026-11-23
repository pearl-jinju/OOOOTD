const colors={
 검정:'black',검정색:'black',검은:'black',블랙:'black',흰:'white',흰색:'white',하얀:'white',화이트:'white',
 회색:'grey',그레이:'grey',네이비:'navy',남색:'navy',베이지:'beige',갈색:'brown',브라운:'brown',
 파랑:'blue',파란:'blue',빨강:'red',빨간:'red',초록:'green',분홍:'pink'
};
const normalized=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const current=/^(?:지금|현재|이|오늘|추천한|방금\s*추천한)?\s*(?:코디|룩북|조합)$/;
const generic=/^(?:이|그|해당)?\s*(?:상품|옷|제품|항목)$/;

export function parseFavoriteCommand(message){
 const value=String(message??'').normalize('NFKC').trim();
 if(!/찜|관심\s*(?:상품|목록)|즐겨\s*찾기/.test(value))return null;
 const remove=value.match(/^(.*?)\s*찜\s*해제(?:\s*(?:해\s*)?(?:줘|주세요|줄래))?[.!]*$/);
 if(remove&&current.test(remove[1].trim().replace(/(?:을|를)$/,'').trim()))return {action:'remove',target:'outfit'};
 if(/[“”"'`]/.test(value)||/\?|(?:되는지|가능한지|할까|되나요|돼요|돼|될까요|있어|있나요|가능해|방법|어떻게|뭐야|뭔가요|하지\s*마|말아\s*줘|하지\s*말|해제|취소|하지\s*않|하지\s*못|나중에|만약|저장\s*하지)/.test(value)){
  return {action:'info'};
 }
 if(/^(?:내\s*)?(?:찜|관심\s*상품)\s*목록(?:을)?\s*(?:보여\s*(?:줘|주세요)|열어\s*(?:줘|주세요)|보기)[.!]*$/.test(value))return {action:'list'};
 const match=value.match(/^(.*?)\s*(?:찜\s*(?:해\s*(?:줘|주세요|주라|줄래)|하기|하자|해))[.!]*$/);
 const add=match||value.match(/^(.*?)\s*(?:(?:찜|관심\s*상품|관심|즐겨\s*찾기)\s*(?:목록)?\s*(?:에|으로)\s*(?:추가|저장|넣어)\s*(?:해\s*)?(?:줘|주세요))[.!]*$/);
 if(!add)return {action:'info'};
 const target=add[1].trim().replace(/(?:을|를)$/, '').trim();
 if(/무신사(?:에서|에)\s*$/.test(target))return {action:'retailer',query:target.replace(/무신사(?:에서|에)\s*$/,'').trim().replace(/(?:을|를)$/,'').trim()};
 if(current.test(target))return {action:'add',target:'outfit'};
 if(!target||generic.test(target))return {action:'add'};
 return {action:'add',target:'product',query:target.replace(/^무신사\s+/,'')};
}

export const MUSINSA_HOME='https://www.musinsa.com/';
export const retailerSearchUrl=query=>MUSINSA_HOME+'search/goods?keyword='+encodeURIComponent(query);

export function retailerProductUrl(value){
 return typeof value==='string'&&/^https:\/\/www\.musinsa\.com\/products\/[1-9]\d*$/.test(value)?value:null;
}

export function findFavoriteProducts(items,query){
 const words=String(query??'').normalize('NFKC').trim().split(/\s+/).map(normalized).filter(Boolean);
 if(!words.length||words.join('').length<2)return [];
 const exactName=words.join('');
 const exact=[],partial=[];
 const seen=new Set();
 for(const item of items){
  const url=retailerProductUrl(item.sourceUrl);
  if(!url||item.availability==='sold_out'||seen.has(url))continue;
  const name=normalized(item.name),brand=normalized(item.brand);
  if(name!==exactName&&!words.every(word=>name.includes(word)||brand.includes(word)||Object.hasOwn(colors,word)&&colors[word]===item.color))continue;
  seen.add(url);
  (name===exactName?exact:partial).push(item);
 }
 return exact.length?exact:partial;
}
