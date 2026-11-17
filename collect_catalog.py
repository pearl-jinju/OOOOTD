"""Collect gender-verified Musinsa products and update the deployed default closet."""
import json,re,html,urllib.request,time
from pathlib import Path
from collections import Counter
BASE=Path(__file__).resolve().parent
COUNTS={'outer':40,'top':45,'bottom':40,'shoes':25}
CODES={'outer':'002','top':'001','bottom':'003','shoes':'103'}
def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
    for attempt in range(3):
        try:return urllib.request.urlopen(req,timeout=30).read().decode('utf-8')
        except Exception:
            if attempt==2:raise
            time.sleep(1)
def objects(node):
    if isinstance(node,dict):
        if all(k in node for k in ('goodsNo','goodsName','thumbnail','displayGenderText')):yield node
        for v in node.values():yield from objects(v)
    elif isinstance(node,list):
        for v in node:yield from objects(v)
def color(name):
    for value,words in [('black',['블랙','검정','black']),('white',['화이트','아이보리','크림','white','ivory']),('grey',['그레이','차콜','멜란지','grey','gray','charcoal']),('navy',['네이비','navy']),('beige',['베이지','브라운','카멜','오트밀','beige','brown']),('khaki',['카키','올리브','그린','khaki','green']),('blue',['블루','데님','인디고','blue','denim']),('point',['레드','핑크','옐로우','퍼플','와인','red','pink','yellow','purple'])]:
        if any(w in name.lower() for w in words):return value
    return 'black'
def season(name):
    n=name.lower()
    for value,words in [('winter',['패딩','다운','기모','방한','윈터','무스탕','퍼 자켓','down','shearling']),('hot',['반팔','린넨','쇼츠','반바지','샌들','슬리퍼','sandal','shorts']),('chilly',['코트','울','플리스','후리스','니트','스웨터','가디건','fleece','wool','coat','knit']),('warm',['반소매','티셔츠','반팔','short sleeve'])]:
        if any(w in n for w in words):return value
    return 'mild'
def occasion(name):
    n=name.lower()
    for value,words in [('exercise',['러닝','트레이닝','조거','아노락','등산','running','training']),('work',['블레이저','슬랙스','로퍼','구두','수트','테일러드','loafer','blazer']),('date',['코트','니트','가디건','메리제인','펌프스','스커트','coat','cardigan']),('library',['후드','맨투맨','스웨트','hood','sweat'])]:
        if any(w in n for w in words):return value
    return 'daily'
def main():
    items=[];seen=set()
    for gender,gf,label in [('men','M','남성'),('women','F','여성')]:
        for category,count in COUNTS.items():
            selected=[]
            for page in range(1,8):
                code=CODES[category] if page==1 else CODES[category]+f'{page-1:03d}'
                url=f'https://www.musinsa.com/category/{code}/goods?gf={gf}'
                s=get(url)
                match=re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',s,re.S)
                if not match:raise RuntimeError('Missing structured product data: '+url)
                products=list(objects(json.loads(match.group(1))))
                print(gender,category,'page',page,'products',len(products),'genders',dict(Counter(p['displayGenderText'] for p in products)),flush=True)
                for p in products:
                    # Only explicit single-gender products; never relabel unisex or infer from index.
                    if p['displayGenderText']!=label or p['goodsNo'] in seen:continue
                    name=html.unescape(p['goodsName']).strip()
                    if not name or not p['thumbnail'].startswith('https://'):continue
                    seen.add(p['goodsNo'])
                    selected.append({'id':p['goodsNo'],'category':category,'name':name,'season':season(name),'color':color(name),'occasion':occasion(name),'image':p['thumbnail'],'gender':gender,'sourceGender':label,'sourceUrl':p.get('goodsLinkUrl') or f'https://www.musinsa.com/products/{p["goodsNo"]}'})
                    if len(selected)==count:break
                if len(selected)==count:break
            if len(selected)!=count:raise RuntimeError(f'Insufficient verified products: {gender}/{category}: {len(selected)}/{count}')
            items.extend(selected)
    assert len(items)==300 and len(seen)==300
    path=BASE/'catalog_300.json';path.write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    index=BASE/'index.html';s=index.read_text(encoding='utf-8')
    s,n=re.subn(r'const (?:CRAWLED_100_ITEMS|CATALOG_ITEMS) = .*?;\n',lambda m:'const CATALOG_ITEMS = '+json.dumps(items,ensure_ascii=False)+';\n',s,count=1)
    if n!=1:raise RuntimeError('Catalog marker not found')
    s=s.replace('CRAWLED_100_ITEMS','CATALOG_ITEMS')
    index.write_text(s,encoding='utf-8')
    print('Saved',len(items),'verified products',dict(Counter(i['gender'] for i in items)))
if __name__=='__main__':main()
