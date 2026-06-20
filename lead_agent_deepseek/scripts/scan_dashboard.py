"""Scan all lead directories and rebuild dashboard SEED."""
import os, json, re

ROOT = r'C:\Users\Maik Zschach\the-tribe'
LEADS_DIR = os.path.join(ROOT, 'docs', 'leads')
DASHBOARD = os.path.join(LEADS_DIR, 'dashboard', 'index.html')

# Scan all lead directories
leads = []
for d in os.listdir(LEADS_DIR):
    dpath = os.path.join(LEADS_DIR, d)
    if not os.path.isdir(dpath) or d == 'dashboard':
        continue
    idx = os.path.join(dpath, 'index.html')
    if not os.path.exists(idx):
        continue
    
    # Read the HTML to extract basic info
    with open(idx, 'r', encoding='utf-8') as f:
        html = f.read()
    
    title = (re.search(r'<title>([^<]+)</title>', html) or ['', d])[1]
    name = title.split('—')[0].split('|')[0].split('–')[0].strip() or d.replace('-', ' ').title()
    industry = 'Dienstleistung'
    if re.search(r'friseur|hair|salon', title, re.I): industry = 'Friseur'
    elif re.search(r'zahnarzt|zahn', title, re.I): industry = 'Zahnarzt'
    elif re.search(r'restaurant|café|cafe|bäck|bäcker', title, re.I): industry = 'Gastronomie'
    elif re.search(r'maler|dach|elektro|tischler|schreiner|bau', title, re.I): industry = 'Handwerk'
    elif re.search(r'physio|massage|therapie', title, re.I): industry = 'Physiotherapie'
    elif re.search(r'foto', title, re.I): industry = 'Fotografie'
    elif re.search(r'immobilien', title, re.I): industry = 'Immobilien'
    elif re.search(r'blumen|florist', title, re.I): industry = 'Florist'
    elif re.search(r'tierarzt|tier', title, re.I): industry = 'Tierarzt'
    elif re.search(r'kosmetik|beauty|nail', title, re.I): industry = 'Kosmetik'
    elif re.search(r'gold|juwel|schmuck', title, re.I): industry = 'Einzelhandel'
    elif re.search(r'auto|kfz|werkstatt', title, re.I): industry = 'Automotive'
    elif re.search(r'kanzlei|steuer|recht', title, re.I): industry = 'Kanzlei'
    elif re.search(r'reinigung|gebäude', title, re.I): industry = 'Dienstleistung'
    elif re.search(r'klavier|musik', title, re.I): industry = 'Einzelhandel'
    
    leads.append({
        'id': d,
        'name': name,
        'industry': industry,
        'hebel': 'mittel',
        'score': 50,
        'website': '',
        'problems': ['Website verbesserungswürdig'],
        'opps': ['Moderne Website'],
        'preview': f'https://maikz91.github.io/the-tribe-bot/leads/{d}/',
    })

print(f'{len(leads)} lead directories found')

# Read dashboard
with open(DASHBOARD, 'r', encoding='utf-8') as f:
    html = f.read()

# Build new SEED
seed_js = '  var SEED=[\n'
for l in leads:
    seed_js += f'    {{id:"{l["id"]}",name:"{l["name"]}",industry:"{l["industry"]}",hebel:"{l["hebel"]}",score:{l["score"]},website:"{l["website"]}",problems:{json.dumps(l["problems"], ensure_ascii=False)},opps:{json.dumps(l["opps"], ensure_ascii=False)},preview:"{l["preview"]}"}},\n'
seed_js += '  ];'

seed_start = html.find('var SEED=[')
seed_end = html.find('];', seed_start) + 2
html = html[:seed_start] + seed_js + html[seed_end:]

with open(DASHBOARD, 'w', encoding='utf-8') as f:
    f.write(html)

print(f'Dashboard updated with {len(leads)} leads')
