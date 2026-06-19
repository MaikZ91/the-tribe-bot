"""Add Glueckundseligkeit to dashboard."""
import os, json

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(SCRIPTS_DIR))
DASH = os.path.join(ROOT, 'docs', 'leads', 'dashboard', 'index.html')

lead = {
    "id":"glueckundseligkeit-bielefeld",
    "name":"GLÜCKUNDSELIGKEIT",
    "industry":"Gastronomie",
    "hebel":"mittel",
    "score":48,
    "website":"https://www.glueckundseligkeit.de/",
    "problems":["Selbstgebautes HTML (~2018)","Mobil-Navigation umständlich","Keine Online-Reservierung direkt","Keine Google-Bewertungen eingebunden"],
    "opps":["Online-Tischreservierung integrieren","OpenTable-Award prominent","Mobile-First Redesign","Instagram-Feed einbinden"],
    "preview":"https://maikz91.github.io/the-tribe-bot/leads/glueckundseligkeit-bielefeld/",
    "email":"info@glueckundseligkeit.de"
}

with open(DASH, 'r', encoding='utf-8') as f:
    h = f.read()

if f'id:"{lead["id"]}"' not in h:
    seed_start = h.find('var SEED=[')
    seed_end = h.find('];', seed_start)
    entry = f'\n    {{id:"{lead["id"]}",name:"{lead["name"]}",industry:"{lead["industry"]}",hebel:"{lead["hebel"]}",score:{lead["score"]},website:"{lead["website"]}",problems:{json.dumps(lead["problems"],ensure_ascii=False)},opps:{json.dumps(lead["opps"],ensure_ascii=False)},preview:"{lead["preview"]}"}},'
    h = h[:seed_end] + entry + h[seed_end:]
    
    mail_start = h.find('var EMAILS={')
    mail_end = h.find('};', mail_start)
    if f'"{lead["id"]}":' not in h:
        h = h[:mail_end] + f'\n    "{lead["id"]}":"{lead["email"]}",' + h[mail_end:]
    
    with open(DASH, 'w', encoding='utf-8') as f:
        f.write(h)
    print(f"Dashboard: +{lead['id']}")
else:
    print("Already in dashboard")
