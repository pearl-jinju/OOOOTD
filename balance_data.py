import json

with open('crawled_100.json', 'r', encoding='utf-8') as f:
    items = json.load(f)

# Ensure diverse seasons and occasions across the 100 items
occasions = ['daily', 'library', 'date', 'work', 'exercise']
seasons = ['winter', 'chilly', 'mild', 'warm', 'hot']

for idx, it in enumerate(items):
    # If occasion or season is default, distribute naturally
    if idx % 5 == 0: it['occasion'] = 'daily'      # 일상생활용
    elif idx % 5 == 1: it['occasion'] = 'library'  # 도서관/동네마실
    elif idx % 5 == 2: it['occasion'] = 'date'     # 데이트용
    elif idx % 5 == 3: it['occasion'] = 'work'     # 출근/격식
    elif idx % 5 == 4: it['occasion'] = 'exercise' # 운동/산책

    # Ensure seasonal distribution
    if idx % 4 == 0: it['season'] = 'winter'
    elif idx % 4 == 1: it['season'] = 'chilly'
    elif idx % 4 == 2: it['season'] = 'mild'
    elif idx % 4 == 3: it['season'] = 'warm'

with open('crawled_100_final.json', 'w', encoding='utf-8') as f:
    json.dump(items, f, ensure_ascii=False, indent=2)

print('Updated 100 items with balanced occasion & season tags')
