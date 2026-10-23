import re
from pathlib import Path

app_js = Path('web/app.js').read_text(encoding='utf-8')
arena_js = Path('web/arena_3d_view.js').read_text(encoding='utf-8')
brain_js = Path('web/brain_3d_view.js').read_text(encoding='utf-8')
html = Path('web/index.html').read_text(encoding='utf-8')

all_js = app_js + '\n' + arena_js + '\n' + brain_js

ids = set(re.findall(r'document\.getElementById\([\'"]([^\'"]+)[\'"]\)', all_js))
dynamic_prefixes = ['pop-bar-', 'rate-val-', 'fill-', 'wedge-fill-', 'cam-']
static_ids = [i for i in ids if not any(i.startswith(p) for p in dynamic_prefixes)]

missing = [i for i in static_ids if f'id="{i}"' not in html and f"id='{i}'" not in html]
print(f"Total unique IDs checked: {len(static_ids)}")
print(f"Missing IDs in HTML: {missing}")
