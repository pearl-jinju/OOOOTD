import urllib.request
import re
import json

urls = {
    'outer': 'https://www.musinsa.com/categories/item/002',
    'top': 'https://www.musinsa.com/categories/item/001',
    'bottom': 'https://www.musinsa.com/categories/item/003',
    'shoes': 'https://www.musinsa.com/categories/item/005'
}

crawled = []
item_id = 1

for cat, url in urls.items():
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            html = res.read().decode('utf-8', errors='ignore')
            
            # Find item cards or images
            # Pattern for goods image and name
            # image.msscdn.net/images/goods_img/202...
            matches = re.findall(r'//image\.msscdn\.net/images/goods_img/([0-9]+)/([0-9]+/[0-9]+_[0-9]+_500\.jpg)', html)
            print(f"Cat {cat}: found {len(matches)} goods images")
            
            # Extract alt/title tags if available
            card_blocks = re.findall(r'<img[^>]+alt="([^"]+)"[^>]+src="([^"]+image\.msscdn\.net[^"]+)"', html)
            print(f"Cat {cat}: found card blocks {len(card_blocks)}")
            
            seen = set()
            count = 0
            for name, img in card_blocks:
                if count >= 25:
                    break
                if img.startswith('//'):
                    img = 'https:' + img
                if img in seen or not name or len(name) < 2:
                    continue
                seen.add(img)
                
                # Classify season and color and occasion based on name
                crawled.append({
                    'id': item_id,
                    'category': cat,
                    'name': name.strip(),
                    'image': img
                })
                item_id += 1
                count += 1
    except Exception as e:
        print(f"Error crawling {cat}:", e)

print(f"Total crawled items: {len(crawled)}")
with open('crawled_musinsa.json', 'w', encoding='utf-8') as f:
    json.dump(crawled, f, ensure_ascii=False, indent=2)
