"""Rebuild dashboard SEED array with all 25+ leads."""
import os, json

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(SCRIPTS_DIR))  # lead_agent_deepseek/scripts -> lead_agent_deepseek -> repo root
DASH = os.path.join(ROOT, 'docs', 'leads', 'dashboard', 'index.html')

with open(DASH, 'r', encoding='utf-8') as f:
    html = f.read()

# Build the complete SEED array
# Data from lead JSONs + original SEED entries
seeds = [
    # --- Original entries (keep) ---
    {"id":"physiofit","name":"Physiofit Bielefeld","industry":"Physiotherapie","hebel":"hoch","score":35,"website":"https://www.physio-fit-bielefeld.de/","problems":["Veraltete Vorlage (~2015 Squarespace)","Keine Online-Terminbuchung","Kein CTA above the fold","Keine Trust-Signale"],"opps":["Online-Terminbuchung 24/7","Google-Bewertungen prominent","WhatsApp- & Anruf-CTA above the fold"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/physiofit/"},
    {"id":"physiowell","name":"Physiowell Bielefeld","industry":"Physiotherapie","hebel":"mittel","score":57,"website":"https://www.physiowell-bielefeld.de/","problems":["Keine Online-Buchung (nur Formular)","Keine Bewertungen / Social Proof","Team ohne Fotos & Namen"],"opps":["Echtzeit-Terminbuchung","Google-Reviews-Widget","Team-Sektion mit Credentials"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/physiowell/"},
    {"id":"spuerbar","name":"SpürbarAnders","industry":"Physiotherapie","hebel":"niedrig","score":75,"website":"https://spuerbaranders.eu/","problems":["Telefon-CTA erst below the fold","Keine Google-Bewertungen sichtbar"],"opps":["Anruf-Button in den Hero","Reviews einbinden"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/spuerbar/"},
    {"id":"kreuzkrug","name":"Restaurant Kreuzkrug","industry":"Gastronomie","hebel":"hoch","score":48,"website":"https://www.kreuzkrug.de/","problems":["Veraltetes Design, kaum Bildwelt","Keine Bewertungen","Viele externe Weiterleitungen"],"opps":["Inline-Reservierung statt Redirects","Foto-Galerie","Historie seit 1829 inszenieren"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/kreuzkrug/"},
    {"id":"alt-bielefeld","name":"Restaurant Alt-Bielefeld","industry":"Gastronomie","hebel":"hoch","score":41,"website":"https://www.alt-bielefeld.com/","problems":["Veraltetes WordPress-Template (~2015)","Speisekarte nur als PDF","Keine Online-Reservierung","Keine Reviews above the fold"],"opps":["Online-Tischreservierung 24/7","Inline-Speisekarte statt PDF","Google-Reviews prominent"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/alt-bielefeld/"},
    {"id":"strothmann","name":"Maler Strothmann","industry":"Handwerk","hebel":"mittel","score":59,"website":"https://www.maler-strothmann.de/","problems":["Kein Angebots-/Kontaktformular","Keine Kundenstimmen","CTA-Hierarchie unklar"],"opps":["Angebotsformular mit Foto-Upload","Referenzen & Bewertungen","Klare Angebot-CTAs"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/strothmann/"},
    {"id":"schmitz","name":"Malermeister Schmitz","industry":"Handwerk","hebel":"mittel","score":59,"website":"https://maler-hans-schmitz.de/","problems":["Kein Angebots-/Kontaktformular","Keine Kundenbewertungen","Leistungen ohne Preis-Orientierung"],"opps":["Lead-Capture-Formular","Reviews & Referenzen","Leistungspakete mit Richtpreisen"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/schmitz/"},
    {"id":"kanzlei-kotte","name":"Kanzlei Kotte","industry":"Kanzlei","hebel":"hoch","score":39,"website":"https://www.kanzleikotte.de/","problems":["Template ~2010–2015","Kein Erstberatungsformular above the fold","Keine Mandantenbewertungen","Info-lastig statt conversion-orientiert"],"opps":["Erstberatungs-Formular above the fold","Mandantenstimmen & Trust","Mobile-optimiertes Layout"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/kanzlei-kotte/"},
    {"id":"cicco-friseur","name":"Cicco Friseur","industry":"Friseur","hebel":"mittel","score":51,"website":"https://cicco-friseur.de/","problems":["Keine Google-Bewertungen","Dated Template (alte Galerie)","Kein Kontaktformular"],"opps":["Google-Reviews prominent","Inline-Preisliste","Galerie & Online-Reservierung"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/cicco-friseur/"},
    {"id":"zahnarzt-kahlke","name":"Zahnarztpraxis Dr. Kahlke","industry":"Zahnarzt","hebel":"hoch","score":44,"website":"https://www.zahnarztpraxis-bielefeld.de/","problems":["Keine echte Online-Buchung (nur Rückruf)","Keine Google-Bewertungen","Dated 2010er-Template","Schwache primäre CTA"],"opps":["Echte Online-Terminbuchung","Google-Reviews einbinden","Team-Sektion mit Fotos"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/zahnarzt-kahlke/"},
    {"id":"dein-gym","name":"Dein Gym Bielefeld","industry":"Fitness","hebel":"mittel","score":55,"website":"https://deingym-bielefeld.de/","problems":["Intransparente Preise","Kein Probetraining sichtbar","Keine Bewertungen","Kein Lead-Formular above the fold"],"opps":["Transparente Preis-Tiers","Gratis-Probetraining als CTA","Reviews & Vorher-/Nachher"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/dein-gym/"},
    {"id":"heise-immobilien","name":"Heise Immobilien","industry":"Immobilien","hebel":"hoch","score":36,"website":"https://www.heise-immobilien.de/","problems":["Stark veraltet (.htm, Tabellen-Layout, ~10–15 J.)","Kein Lead-/Wertermittlungsformular above the fold","Keine Google-Bewertungen","Nicht mobil-optimiert"],"opps":["Kostenlose Wertermittlung above the fold","Objekt-Listings modern inszenieren","Google-Reviews & Trust einbinden","Mobile-first Redesign"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/heise-immobilien/"},
    {"id":"cafe-knigge","name":"Café Knigge","industry":"Gastronomie","hebel":"mittel","score":52,"website":"https://cafe-knigge.de/","problems":["Dated Template (~frühe 2010er)","Speisekarte nur als PDF","Keine Google-Bewertungen","CTA erst below the fold"],"opps":["Inline-Frühstückskarte statt PDF","Google-Reviews prominent","Torten-Galerie & Reservierung in den Hero"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/cafe-knigge/"},
    {"id":"cafe-woelke","name":"Café Wölke","industry":"Gastronomie","hebel":"mittel","score":46,"website":"https://cafe-woelke.de/","problems":["Veraltetes CMS (WorldSoft), dated Design","Keine Online-Torten-Anfrage/Bestellung","Keine Google-Bewertungen","Verschachtelte Navigation, CTA below the fold"],"opps":["Online-Torten-Anfrage above the fold","Google-Reviews prominent","Torten-Galerie & klare Anlass-CTAs","Familien-USP (Spielplatz/Terrasse) inszenieren"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/cafe-woelke/"},
    {"id":"optik-haertel","name":"Optik Haertel","industry":"Optiker","hebel":"mittel","score":48,"website":"https://www.optik-haertel.de/","problems":["Dated Design, unklar ob responsive","Keine Online-Terminbuchung","Keine Google-Bewertungen","Schwache CTA, Standort erst nach langem Scroll"],"opps":["Termin-Anfrage above the fold","Google-Reviews einbinden","Sehanalyse/Lupenbrillen-USP inszenieren","Sticky Kontakt-/Termin-Leiste"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/optik-haertel/"},

    # --- New daemon-processed leads ---
    {"id":"rancho-steakhouse","name":"Rancho Steakhouse","industry":"Gastronomie","hebel":"hoch","score":50,"website":"https://www.rancho-steakhouse.de/","problems":["Website sehr einfach (One-Pager, kaum SEO)","Keine Online-Reservierung (nur Telefon)","Keine Google-Bewertungen eingebunden","Keine Bilder der Location & Gerichte"],"opps":["Online-Reservierung integrieren","Foto-Galerie der Gerichte & Location","Google-Reviews prominent einbinden","SEO-optimierte Speisekarte inline"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/rancho-steakhouse/"},
    {"id":"cafe-schumacher","name":"Café Schumacher","industry":"Gastronomie","hebel":"mittel","score":50,"website":"https://cafe-schumacher.de/de/home","problems":["Website-Design veraltet (Statisch, nicht mobil-optimiert)","Speisekarte nur als PDF-Download","Keine Google-Bewertungen eingebunden","Keine Online-Torten-Bestellung möglich"],"opps":["Moderne, mobile Website","Inline-Speisekarte statt PDF","Google-Reviews einbinden","Online-Torten-Konfigurator"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/cafe-schumacher/"},
    {"id":"durchblick-bielefeld","name":"Durchblick Bielefeld","industry":"Dienstleistung","hebel":"hoch","score":50,"website":"https://www.durchblick-bielefeld.de/","problems":["Website sehr einfach (One-Pager, kein richtiges Branding)","Keine Preis-Orientierung","Keine Google-Bewertungen eingebunden","Kein richtiges Kontaktformular (nur externer Dienst)"],"opps":["Professionelles Branding & Website","Inline-Preise & Leistungs-Pakete","Google-Reviews einbinden","Eigenes Kontaktformular"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/durchblick-bielefeld/"},
    {"id":"handwerker-bielefeld","name":"Handwerker Bielefeld","industry":"Handwerk","hebel":"hoch","score":50,"website":"https://www.handwerker-bielefeld.com/","problems":["Nur One-Pager, keine Tiefe","Keine Referenzprojekte","Vertrauenssignale fehlen"],"opps":["Projekt-Galerie mit Vorher/Nachher","Bewertungen & Trust-Signale","Mehrseitige informative Website"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/handwerker-bielefeld/"},
    {"id":"its-stueckemann","name":"ITS Stückemann","industry":"Handwerk","hebel":"mittel","score":50,"website":"https://www.its-stueckemann.de/","problems":["Website sehr einfach gehalten","Keine Kundenbewertungen","Kein Online-Kontaktformular"],"opps":["Modernes, vertrauenswürdiges Design","Bewertungen einbinden","Kontaktformular integrieren"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/its-stueckemann/"},
    {"id":"kanzlei-fuchs","name":"Kanzlei Fuchs","industry":"Kanzlei","hebel":"mittel","score":50,"website":"https://kanzleifuchs.com/","problems":["Website nicht responsive-optimiert","Keine Kundenbewertungen","Wenig emotionale Ansprache"],"opps":["Mobile-First Redesign","Mandantenstimmen prominent","Persönlichere Ansprache"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/kanzlei-fuchs/"},
    {"id":"mader-miller","name":"Mader & Miller","industry":"Kanzlei","hebel":"mittel","score":50,"website":"https://mader-miller.de/","problems":["Keine Mandantenstimmen","Website könnte moderner sein","Wenig trust-building Elemente"],"opps":["Mandantenbewertungen einbinden","Modernes Kanzlei-Design","Online-Terminbuchung"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/mader-miller/"},
    {"id":"philipp-haustechnik","name":"Philipp Haustechnik","industry":"Handwerk","hebel":"mittel","score":50,"website":"https://www.philipp-haustechnik.de/","problems":["Design nicht zeitgemäß","Keine Kundenstimmen","Leistungen ohne Bildmaterial"],"opps":["Moderne Website mit Projekten","Kundenbewertungen einbinden","Foto-Dokumentation der Arbeiten"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/philipp-haustechnik/"},
    {"id":"bpp-kanzlei","name":"BPP Wirtschaftsprüfer","industry":"Kanzlei","hebel":"niedrig","score":50,"website":"https://www.b-p-p.de/","problems":["Sehr textlastig","Wenig visuelle Elemente","Keine Bewertungen sichtbar"],"opps":["Visuell aufwerten","Bewertungen einbinden","Klare Service-Struktur"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/bpp-kanzlei/"},
    {"id":"steuer-bielefeld","name":"Steuer-Bielefeld","industry":"Kanzlei","hebel":"hoch","score":50,"website":"https://www.steuer-bielefeld.de/","problems":["Website minimalistisch, wenig Vertrauen","Keine Kundenbewertungen","Keine Gesichter/Team-Fotos"],"opps":["Trust durch Team-Fotos","Mandantenstimmen einbinden","Klare Prozess-Darstellung"],"preview":"https://maikz91.github.io/the-tribe-bot/leads/steuer-bielefeld/"},
]

# Format as JS array
seed_js = '  var SEED=[\n'
for s in seeds:
    seed_js += f'    {{id:"{s["id"]}",name:"{s["name"]}",industry:"{s["industry"]}",hebel:"{s["hebel"]}",score:{s["score"]},website:"{s["website"]}",problems:{json.dumps(s["problems"], ensure_ascii=False)},opps:{json.dumps(s["opps"], ensure_ascii=False)},preview:"{s["preview"]}"}},\n'
seed_js += '  ];'

# Find and replace the SEED array
seed_start = html.find('var SEED=[')
seed_end = html.find('];', seed_start) + 2

html = html[:seed_start] + seed_js + html[seed_end:]

# Update EMAILS object
emails = {
    "physiofit":"info@physio-fit-bielefeld.de",
    "physiowell":"info@physiowell-bielefeld.de",
    "kreuzkrug":"info@kreuzkrug.de",
    "alt-bielefeld":"info@alt-bielefeld.de",
    "strothmann":"mail@maler-strothmann.de",
    "schmitz":"maler-schmitz@t-online.de",
    "kanzlei-kotte":"info@kanzleikotte.de",
    "zahnarzt-kahlke":"info@zahnarztpraxis-bielefeld.de",
    "dein-gym":"deingym.bielefeld@gmail.com",
    "heise-immobilien":"info@heise-immobilien.de",
    "spuerbar":"info@spuerbaranders.eu",
    "cafe-schumacher":"info@cafe-schumacher.de",
    "rancho-steakhouse":"info@rancho-steakhouse.de",
    "durchblick-bielefeld":"info@durchblick-bielefeld.de",
    "handwerker-bielefeld":"info@handwerker-bielefeld.com",
    "its-stueckemann":"info@its-stueckemann.de",
    "kanzlei-fuchs":"info@kanzleifuchs.com",
    "mader-miller":"info@mader-miller.de",
    "philipp-haustechnik":"info@philipp-haustechnik.de",
    "bpp-kanzlei":"info@b-p-p.de",
    "steuer-bielefeld":"info@steuer-bielefeld.de",
}

emails_js = '  var EMAILS={\n'
for k, v in emails.items():
    emails_js += f'    "{k}":"{v}",\n'
emails_js += '  };'

mail_start = html.find('var EMAILS={')
mail_end = html.find('};', mail_start) + 2

html = html[:mail_start] + emails_js + html[mail_end:]

with open(DASH, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Dashboard updated: {DASH}")
print(f"SEED entries: {len(seeds)}")
print(f"EMAILS entries: {len(emails)}")
