"""Fix queue.json entries with proper industry content."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
QUEUE_FILE = os.path.join(ROOT, "lead_agent_deepseek", "queue.json")

with open(QUEUE_FILE, encoding="utf-8") as f:
    queue = json.load(f)

# Map by lead id - more reliable than industry string matching
CONTENT_BY_ID = {}
for lead in queue['leads']:
    lid = lead['id']
    if lid.startswith('friseur-'):
        CONTENT_BY_ID[lid] = {
            'heroH1': 'Ihr Stil.<br><em>Unsere Leidenschaft.</em>',
            'heroSub': 'Haarschnitt, Coloration und Styling in Bielefeld. Pers\u00f6nliche Beratung, moderne Techniken, Wohlf\u00fchl-Garantie.',
            'ctaText': 'Termin vereinbaren',
            'features': ['Haarschnitt & Styling', 'Coloration & Str\u00e4hnen', 'Haarpflege & Beratung'],
        }
    elif lid.startswith('baeckerei-'):
        CONTENT_BY_ID[lid] = {
            'heroH1': 'Frisch gebacken.<br><em>T\u00e4glich in Bielefeld.</em>',
            'heroSub': 'Brot, Br\u00f6tchen, Kuchen und Torten aus eigener Herstellung. Handwerkliche Backkunst mit besten Zutaten.',
            'ctaText': 'Jetzt bestellen',
            'features': ['T\u00e4glich frische Backwaren', 'Kuchen & Torten', 'Fr\u00fchst\u00fccksservice'],
        }
    elif lid.startswith('zahnarzt-'):
        CONTENT_BY_ID[lid] = {
            'heroH1': 'Ihr L\u00e4cheln.<br><em>Unsere Mission.</em>',
            'heroSub': 'Moderne Zahnheilkunde in Bielefeld \u2014 von der Prophylaxe bis zur Implantologie. Ihre Zahngesundheit in besten H\u00e4nden.',
            'ctaText': 'Termin anfragen',
            'features': ['Professionelle Zahnreinigung', 'Zahn\u00e4sthetik & Bleaching', 'Implantologie'],
        }

# Manual short name overrides for better readability
SHORT_NAMES = {
    'baeckerei-lechtermann-pollmeier': 'Lechtermann-Pollmeier',
    'baeckerei-olsson': 'Olsson',
    'baeckerei-sundermann': 'Sundermann',
    'friseur-dio-salon': 'Dio Salon',
    'friseur-friseurteam-feldstrasse': 'Friseur-Team',
    'friseur-haarquelle': 'HaarQuelle',
    'zahnarzt-benz': 'Dr. Benz',
    'zahnarzt-durali-mosch': 'Durali & Mosch',
    'zahnarzt-nawartschi': 'Dr. Nawartschi',
    'zahnarzt-thedentalcompany': 'The Dental Company',
}

fixed = 0
for lead in queue['leads']:
    lid = lead['id']
    ic = CONTENT_BY_ID.get(lid)
    if ic:
        lead['heroH1'] = ic['heroH1']
        lead['heroSub'] = ic['heroSub']
        lead['ctaText'] = ic['ctaText']
        lead['features'] = ic['features']
        fixed += 1
    
    lead['nameShort'] = SHORT_NAMES.get(lid, lead.get('nameShort', lead['name'].split()[-1]))
    
    print(f"  {lid}: nameShort={lead['nameShort']} | features={lead['features']}")

with open(QUEUE_FILE, "w", encoding="utf-8") as f:
    json.dump(queue, f, ensure_ascii=False, indent=2)

print(f"\nFixed {fixed} entries. Queue saved.")
