"""Add 4 new leads to dashboard SEED and EMAILS."""
import os, json

ROOT = r'C:\Users\Maik Zschach\the-tribe'
DASH = os.path.join(ROOT, 'docs', 'leads', 'dashboard', 'index.html')

with open(DASH, 'r', encoding='utf-8') as f:
    h = f.read()

new_leads = [
    {"id":"glueckundseligkeit-bielefeld","name":"Glückundseligkeit","industry":"Gastronomie","hebel":"mittel","score":50,"website":"https://www.glueckundseligkeit.de/","problems":["Kein Online-Reservierungssystem direkt","Wenige Bilder der Location","Keine Google-Bewertungen eingebunden"],"opps":["OpenTable-Integration hervorheben","Atmosphäre-Bilder zeigen","Google-Reviews prominent"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/glueckundseligkeit-bielefeld/","email":"info@glueckundseligkeit.de"},
    {"id":"krebs-bedachungen-bielefeld","name":"Krebs Bedachungen","industry":"Handwerk","hebel":"mittel","score":48,"website":"https://www.krebs-bedachungen.de/","problems":["Design nicht zeitgemäß","Keine Referenzprojekte auf Startseite","Keine Google-Bewertungen"],"opps":["Moderne Projekt-Galerie","70 Jahre Tradition inszenieren","Bewertungen & Trust-Signale"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/krebs-bedachungen-bielefeld/","email":"info@krebs-bedachungen.de"},
    {"id":"praxis-zwanzig-bielefeld","name":"Praxis Dr. Zwanzig","industry":"Zahnarzt","hebel":"mittel","score":52,"website":"https://praxis-zwanzig.de/","problems":["Wenige Vertrauens-Elemente","Keine Online-Terminbuchung","Team-Fotos fehlen"],"opps":["Online-Terminbuchung","Team-Seite mit Fotos","Patientenbewertungen einbinden"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/praxis-zwanzig-bielefeld/","email":"info@praxis-zwanzig.de"},
    {"id":"julia-voelzow-fotografie","name":"Julia Völzow Fotografie","industry":"Dienstleistung","hebel":"mittel","score":54,"website":"https://www.juliavoelzow.de/","problems":["Portfolio zu textlastig","Keine Preis-Orientierung","CTA nicht prominent genug"],"opps":["Bildgewaltiges Hero-Layout","Preis-Pakete mit Beispielen","Klare Call-to-Actions"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/julia-voelzow-fotografie/","email":"info@juliavoelzow.de"},
]

seed_start = h.find('var SEED=[')
seed_end = h.find('];', seed_start)

for lead in new_leads:
    if f'id:"{lead["id"]}"' in h: continue
    entry = f'\n    {{id:"{lead["id"]}",name:"{lead["name"]}",industry:"{lead["industry"]}",hebel:"{lead["hebel"]}",score:{lead["score"]},website:"{lead["website"]}",problems:{json.dumps(lead["problems"], ensure_ascii=False)},opps:{json.dumps(lead["opps"], ensure_ascii=False)},preview:"{lead["preview"]}"}},'
    h = h[:seed_end] + entry + h[seed_end:]
    seed_end += len(entry)

    if lead.get('email'):
        mail_start = h.find('var EMAILS={')
        mail_end = h.find('};', mail_start)
        if f'"{lead["id"]}":' not in h:
            h = h[:mail_end] + f'\n    "{lead["id"]}":"{lead["email"]}",' + h[mail_end:]

    print(f'  Added: {lead["id"]}')

with open(DASH, 'w', encoding='utf-8') as f:
    f.write(h)
print(f'Dashboard updated: {DASH}')
