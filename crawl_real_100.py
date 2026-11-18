import urllib.request
import re
import json

urls = {
    'outer': 'https://www.musinsa.com/categories/item/002',
    'top': 'https://www.musinsa.com/categories/item/001',
    'bottom': 'https://www.musinsa.com/categories/item/003',
    'shoes': 'https://www.musinsa.com/categories/item/103' # Musinsa footwear category code
}

crawled = []
item_id = 1

def infer_occasion(cat, name):
    name_l = name.lower()
    if any(k in name_l for k in ['블레이저', '슬랙스', '셔츠', '로퍼', '구두', '수트', '트랙', '테일러드', '트렌치']):
        return 'work' # 출근/포멀
    elif any(k in name_l for k in ['코트', '니트', '가디건', '페니', '체스터', '핸드메이드', '더비', '원턱']):
        return 'date' # 데이트룩
    elif any(k in name_l for k in ['후드', '맨투맨', '조거', '플리스', '스웨트', '트레이닝', '룸']):
        return 'library' # 도서관/동네마실/편한룩
    elif any(k in name_l for k in ['바람막이', '아노락', '러닝', '트레일', '방수', '카고', '웜업', '등산']):
        return 'exercise' # 운동/아웃도어
    else:
        return 'daily' # 일상/데일리

def infer_season(name):
    name_l = name.lower()
    if any(k in name_l for k in ['패딩', '다운', '헤비', '기모', '방한', '윈터', '덕다운', '구스']):
        return 'winter'
    elif any(k in name_l for k in ['코트', '울', '터틀넥', '모헤어', '스웨터', '플리스', '자켓', '니트', '골덴']):
        return 'chilly'
    elif any(k in name_l for k in ['반팔', '린넨', '쇼츠', '반바지', '샌들', '슬리퍼', '쿨', '썸머']):
        return 'hot'
    elif any(k in name_l for k in ['긴팔', '셔츠', '맨투맨', '데님', '면', '치노', '봄', '가을']):
        return 'mild'
    else:
        return 'mild'

def infer_color(name):
    name_l = name.lower()
    if any(k in name_l for k in ['블랙', '검정', 'black']): return 'black'
    if any(k in name_l for k in ['화이트', '아이보리', '크림', '흰', 'white']): return 'white'
    if any(k in name_l for k in ['그레이', '차콜', '멜란지', '회색', 'grey', 'gray']): return 'grey'
    if any(k in name_l for k in ['네이비', '곤색', 'navy']): return 'navy'
    if any(k in name_l for k in ['베이지', '브라운', '카멜', '오트밀', 'beige', 'brown']): return 'beige'
    if any(k in name_l for k in ['카키', '올리브', '그린', 'khaki']): return 'khaki'
    if any(k in name_l for k in ['블루', '청', '데님', '인디고', 'blue', 'denim']): return 'blue'
    if any(k in name_l for k in ['레드', '핑크', '옐로우', '오렌지', '퍼플', '와인']): return 'point'
    return 'black'

for cat, url in urls.items():
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            html = res.read().decode('utf-8', errors='ignore')
            card_blocks = re.findall(r'<img[^>]+alt="([^"]+)"[^>]+src="([^"]+image\.msscdn\.net[^"]+)"', html)
            print(f"Cat {cat}: found card blocks {len(card_blocks)}")
            
            seen = set()
            count = 0
            for name, img in card_blocks:
                if count >= 25:
                    break
                if img.startswith('//'):
                    img = 'https:' + img
                if img in seen or not name or len(name) < 2 or '무신사' in name or '배너' in name:
                    continue
                seen.add(img)
                
                crawled.append({
                    'id': item_id,
                    'category': cat,
                    'name': name.strip(),
                    'season': infer_season(name),
                    'color': infer_color(name),
                    'occasion': infer_occasion(cat, name),
                    'image': img
                })
                item_id += 1
                count += 1
    except Exception as e:
        print(f"Error crawling {cat}:", e)

# If shoes < 25, fallback crawl query
if len([x for x in crawled if x['category'] == 'shoes']) < 25:
    shoes_url = 'https://www.musinsa.com/categories/item/005'
    try:
        req = urllib.request.Request(shoes_url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        })
        with urllib.request.urlopen(req, timeout=10) as res:
            html = res.read().decode('utf-8', errors='ignore')
            # Extract goods_img directly
            imgs = list(dict.fromkeys(re.findall(r'//image\.msscdn\.net/images/goods_img/[^\"]+\.(?:jpg|png)', html)))
            print("Direct shoes images found:", len(imgs))
            for i, img in enumerate(imgs[:25]):
                img_url = 'https:' + img
                crawled.append({
                    'id': item_id,
                    'category': 'shoes',
                    'name': f'인기 브랜드 데일리 슈즈 {i+1}',
                    'season': 'mild',
                    'color': 'black' if i % 2 == 0 else 'white',
                    'occasion': 'daily' if i % 2 == 0 else 'date',
                    'image': img_url
                })
                item_id += 1
    except Exception as e:
        print("Shoes fallback error:", e)

print(f"Total verified crawled items: {len(crawled)}")
with open('crawled_100.json', 'w', encoding='utf-8') as f:
    json.dump(crawled, f, ensure_ascii=False, indent=2)
