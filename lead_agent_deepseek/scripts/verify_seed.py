"""Verify dashboard SEED."""
import re

DASH = r'C:\Users\Maik Zschach\the-tribe\docs\leads\dashboard\index.html'
with open(DASH, 'r', encoding='utf-8') as f:
    h = f.read()

m = re.search(r'var SEED=\[(.*?)\];', h, re.DOTALL)
if m:
    ids = re.findall(r'id:"([^"]+)"', m.group(1))
    print(f'{len(ids)} leads in SEED:')
    for i in ids:
        print(f'  {i}')
else:
    print('SEED not found!')
