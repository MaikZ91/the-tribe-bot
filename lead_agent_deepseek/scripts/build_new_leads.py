"""Build previews for 4 new leads and update dashboard."""
import os, json, re

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(SCRIPTS_DIR))
TEMPLATE_FILE = os.path.join(ROOT, 'lead_agent_deepseek', 'templates', 'preview.html')
DASHBOARD_FILE = os.path.join(ROOT, 'docs', 'leads', 'dashboard', 'index.html')
PREVIEW_DIR = os.path.join(ROOT, 'docs', 'leads')
LEADS_DIR = os.path.join(ROOT, 'lead_agent_deepseek', 'leads')

COLORS = {
    'gastronomie':   {'accent': '#c2410c', 'dark': '#7c2d12', 'light': '#fdba74'},
    'handwerk':      {'accent': '#b45309', 'dark': '#78350f', 'light': '#fcd34d'},
    'einzelhandel':  {'accent': '#0d9488', 'dark': '#134e4a', 'light': '#5eead4'},
    'dienstleistung':{'accent': '#2563eb', 'dark': '#1e3a5f', 'light': '#93c5fd'},
    'friseur':       {'accent': '#c77e6e', 'dark': '#a85f4f', 'light': '#d9a89b'},
    'physio':        {'accent': '#0d9488', 'dark': '#0f766e', 'light': '#5eead4'},
    'kanzlei':       {'accent': '#b8860b', 'dark': '#7c5e10', 'light': '#fde047'},
    'zahnarzt':      {'accent': '#0891b2', 'dark': '#155e75', 'light': '#67e8f9'},
    'fitness':       {'accent': '#65a30d', 'dark': '#3f6212', 'light': '#bef264'},
    'optiker':       {'accent': '#1d4ed8', 'dark': '#1e3a5f', 'light': '#93c5fd'},
    'immobilien':    {'accent': '#7c3aed', 'dark': '#4c1d95', 'light': '#c4b5fd'},
    'automotive':    {'accent': '#dc2626', 'dark': '#991b1b', 'light': '#fca5a5'},
    'florist':       {'accent': '#db2777', 'dark': '#9d174d', 'light': '#f9a8d4'},
    'default':       {'accent': '#6366f1', 'dark': '#3730a3', 'light': '#a5b4fc'},
}

leads = [
    {
        "id": "kfz-rautenstrauch",
        "name": "Rautenstrauch Kfz-Werkstatt GmbH",
        "nameShort": "Rautenstrauch",
        "industry": "Automotive",
        "category": "automotive",
        "hebel": "hoch",
        "website": "http://www.kfz-rautenstrauch.de/",
        "phone": "+495210000000",
        "email": "info@kfz-rautenstrauch.de",
        "heroH1": "30 Jahre Erfahrung.<br><em>Ihre Kfz-Werkstatt in Bielefeld.</em>",
        "heroSub": "Reparaturen, Inspektionen und Reifenservice für alle Fahrzeuge — Pkw, Lkw und Anhänger. Meisterbetrieb seit über 30 Jahren in Bielefeld.",
        "ctaText": "Termin anfragen",
        "ctaHref": "#termin",
        "secondaryCta": "Leistungen ansehen",
        "stripItems": ["✦ Alle Marken", "✦ Seit über 30 Jahren", "✦ Karosserie & Lack", "✦ Reifenservice"],
        "features": ["Kfz-Reparaturen", "Inspektionen & HU/AU", "Reifenservice"],
        "problems": ["HTTP-only, keine HTTPS-Verschlüsselung", "Veraltetes Template (~2010)", "Keine Online-Terminbuchung", "Keine Google-Bewertungen"],
        "opps": ["Moderne, responsive Website", "Online-Terminbuchung", "Google-Bewertungen einbinden", "SSL/HTTPS"],
        "reviews": [
            {"stars": 5, "text": '"Seit Jahren zufriedener Kunde. Faire Preise, gute Arbeit."', "author": "Stammkunde · Google"},
            {"stars": 5, "text": '"Schnelle Reparatur, freundliches Team. Klare Empfehlung."', "author": "Kundin · Google"},
            {"stars": 5, "text": '"Lackierung top, Preis-Leistung unschlagbar."', "author": "Kunde · Google"}
        ],
        "reviewFootnote": "Echte Google-Bewertungen sichtbar machen — schafft Vertrauen.",
        "ctaBandEyebrow": "Jetzt Termin sichern",
        "ctaBandH2": "Ihr Auto in besten Händen?",
        "ctaBandSub": "Rufen Sie an oder schreiben Sie uns — wir melden uns zeitnah mit einem Angebot.",
        "contactDl": "<dt>Adresse</dt><dd>Bielefeld</dd><dt>Telefon</dt><dd><a href=\"tel:+495210000000\" style=\"color:var(--accent-d);font-weight:700\">0521 · 00 00 00</a></dd><dt>E-Mail</dt><dd>info@kfz-rautenstrauch.de</dd>",
        "footerDesc": "Rautenstrauch Kfz-Werkstatt GmbH — Ihr Meisterbetrieb in Bielefeld. Seit über 30 Jahren: Reparatur, Service, Lack.",
        "mobileCtaShort": "Termin",
        "metaDesc": "Rautenstrauch Kfz-Werkstatt Bielefeld — Meisterbetrieb seit 30+ Jahren. Reparatur, Inspektion, Reifenservice für alle Marken. Konzept-Vorschau MZ.9.",
    },
    {
        "id": "blumen-boutique-bielefeld",
        "name": "Blumen-Boutique Bielefeld",
        "nameShort": "Blumen-Boutique",
        "industry": "Florist",
        "category": "florist",
        "hebel": "hoch",
        "website": "https://www.blumen-boutique-bielefeld.de/",
        "phone": "+495210000000",
        "email": "info@blumen-boutique-bielefeld.de",
        "heroH1": "Blumen, die<br><em>Gefühle sprechen lassen.</em>",
        "heroSub": "Schnittblumen, Gestecke & florale Dekoration in Bielefeld. Für Hochzeiten, Feste oder einfach so — mit Liebe zum Detail.",
        "ctaText": "Strauß bestellen",
        "ctaHref": "#bestellen",
        "secondaryCta": "Galerie ansehen",
        "stripItems": ["✦ Schnittblumen", "✦ Hochzeitsfloristik", "✦ Trauerfloristik", "✦ Raumdekoration"],
        "features": ["Hochzeitsfloristik", "Festliche Gestecke", "Trauerfloristik"],
        "problems": ["Veraltetes Template (~2010)", "Kein Online-Shop", "Keine Google-Bewertungen", "Inkonsistente Typografie (Inline-Styles)"],
        "opps": ["Moderne, emotionale Website", "Online-Bestellung mit Lieferung", "Google-Bewertungen prominent", "Bildergalerie mit Lightbox"],
        "reviews": [
            {"stars": 5, "text": '"Wunderschöner Brautstrauß, genau wie gewünscht. Danke!"', "author": "Braut · Google"},
            {"stars": 5, "text": '"Immer frische Blumen, tolle Beratung. Meine Stammfloristin."', "author": "Kundin · Google"},
            {"stars": 5, "text": '"Liebevoll gestaltetes Gesteck zur Beerdigung — sehr einfühlsam."', "author": "Kunde · Google"}
        ],
        "reviewFootnote": "Echte Bewertungen zeigen — Blumen sind Vertrauenssache.",
        "ctaBandEyebrow": "Jetzt bestellen",
        "ctaBandH2": "Sagen Sie es mit Blumen.",
        "ctaBandSub": "Bestellen Sie online oder rufen Sie an — wir liefern frisch in ganz Bielefeld.",
        "contactDl": "<dt>Adresse</dt><dd>Bielefeld</dd><dt>Telefon</dt><dd><a href=\"tel:+495210000000\" style=\"color:var(--accent-d);font-weight:700\">0521 · 00 00 00</a></dd><dt>E-Mail</dt><dd>info@blumen-boutique-bielefeld.de</dd>",
        "footerDesc": "Blumen-Boutique Bielefeld — Floristik mit Herz. Hochzeiten, Feste, Trauerfloristik. Frisch, kreativ, persönlich.",
        "mobileCtaShort": "Bestellen",
        "metaDesc": "Blumen-Boutique Bielefeld — Ihre Floristin für Schnittblumen, Hochzeits- & Trauerfloristik. Liebevoll gestaltet, frisch geliefert. Konzept-Vorschau MZ.9.",
    },
    {
        "id": "mantsos",
        "name": "KFZ Werkstatt Mantsos",
        "nameShort": "Mantsos",
        "industry": "Automotive",
        "category": "automotive",
        "hebel": "mittel",
        "website": "https://mantsos.de/",
        "phone": "+495210000000",
        "email": "info@mantsos.de",
        "heroH1": "Ihr Auto.<br><em>Unsere Leidenschaft.</em>",
        "heroSub": "Professioneller Reparatur- und Wartungsservice für alle Marken und Modelle in Bielefeld. Transparent, fair, zuverlässig.",
        "ctaText": "Werkstatttermin",
        "ctaHref": "#termin",
        "secondaryCta": "Leistungen ansehen",
        "stripItems": ["✦ Alle Marken", "✦ Transparente Preise", "✦ Wartung & Service", "✦ Unfallinstandsetzung"],
        "features": ["Inspektion & Wartung", "Motor & Getriebe", "Klimaservice"],
        "problems": ["WordPress-Template, wenig individuell", "Keine Online-Terminbuchung", "Keine Google-Bewertungen sichtbar", "Wenig Vertrauens-Signale"],
        "opps": ["Individuelles, markantes Design", "Online-Terminbuchung integrieren", "Bewertungen & Referenzprojekte zeigen", "Preisrechner einbauen"],
        "metaDesc": "KFZ Werkstatt Mantsos in Bielefeld — Reparatur & Wartung für alle Marken. Transparent, fair, professionell. Konzept-Vorschau MZ.9.",
    },
    {
        "id": "fredebeul-immobilien",
        "name": "Fredebeul Immobilien",
        "nameShort": "Fredebeul",
        "industry": "Immobilien",
        "category": "immobilien",
        "hebel": "mittel",
        "website": "https://www.fredebeul-immobilien.de/",
        "phone": "+495210000000",
        "email": "info@fredebeul-immobilien.de",
        "heroH1": "Seit 1980.<br><em>Ihr Immobilienmakler in Bielefeld.</em>",
        "heroSub": "Haus oder Wohnung verkaufen, kaufen, mieten oder vermieten — mit über 40 Jahren Markterfahrung in Bielefeld und Umgebung.",
        "ctaText": "Wertermittlung anfordern",
        "ctaHref": "#bewertung",
        "secondaryCta": "Immobilien ansehen",
        "stripItems": ["✦ 40+ Jahre Erfahrung", "✦ Verkauf & Vermietung", "✦ Kostenlose Wertermittlung", "✦ Bielefeld & Umgebung"],
        "features": ["Immobilienverkauf", "Wertermittlung", "Vermietung"],
        "problems": ["WordPress-Template, austauschbar", "Keine Online-Wertermittlung", "Wenige Objektfotos", "Keine Virtual Tours"],
        "opps": ["Individuelles Makler-Branding", "Online-Wertermittlungsrechner", "Hochwertige Objektfotografie", "360° Virtual Tours"],
        "metaDesc": "Fredebeul Immobilien Bielefeld — Ihr Makler seit 1980. Verkauf, Vermietung, Wertermittlung. Über 40 Jahre Erfahrung. Konzept-Vorschau MZ.9.",
    },
]

def color_for(cat):
    return COLORS.get(cat, COLORS['default'])

def esc(s):
    return (s or '').replace('#', '%23')

def build_preview(lead):
    if not os.path.exists(TEMPLATE_FILE):
        print(f'  ERROR: Template missing: {TEMPLATE_FILE}')
        return None
    html = open(TEMPLATE_FILE, 'r', encoding='utf-8').read()
    c = color_for(lead.get('category', ''))
    
    lead.setdefault('reviews', [
        {"stars": 5, "text": '"Super, sehr zu empfehlen."', "author": "Kunde · Google"},
        {"stars": 5, "text": '"Professionell und freundlich."', "author": "Kundin · Google"},
        {"stars": 5, "text": '"Gerne wieder."', "author": "Kunde · Google"}
    ])
    lead.setdefault('reviewFootnote', 'Echte Google-Bewertungen einbinden — der fehlende Trust-Baustein.')
    
    r = {
        '{{NAME}}': lead['name'],
        '{{NAME_SHORT}}': lead.get('nameShort', lead['name']),
        '{{INITIAL}}': (lead['name'] or '?')[0].upper(),
        '{{INDUSTRY}}': lead.get('industry', 'Unternehmen'),
        '{{ACCENT}}': c['accent'],
        '{{ACCENT_DARK}}': c['dark'],
        '{{ACCENT_LIGHT}}': c['light'],
        '{{ACCENT_DARK_ENC}}': esc(c['dark']),
        '{{ACCENT_ENC}}': esc(c['accent']),
        '{{HERO_H1}}': lead.get('heroH1', f'{lead["name"]}<br><em>{lead.get("industry","")} in Bielefeld</em>'),
        '{{HERO_SUB}}': lead.get('heroSub', f'{lead.get("industry","")} mit Qualität und Erfahrung — direkt in Bielefeld.'),
        '{{CTA_TEXT}}': lead.get('ctaText', 'Jetzt anfragen'),
        '{{CTA_HREF}}': lead.get('ctaHref', '#kontakt'),
        '{{SECONDARY_CTA}}': lead.get('secondaryCta', 'Mehr erfahren'),
        '{{STRIP_ITEMS}}': ''.join(f'<span>{s}</span>' for s in lead.get('stripItems', ['✦ Lokal in Bielefeld', '✦ Persönlich', '✦ Modern', f'✦ {lead.get("industry","")}'])),
        '{{LEISTUNGEN_EYEBROW}}': 'Leistungen',
        '{{LEISTUNGEN_H2}}': 'Das bieten wir',
        '{{LEISTUNGEN_SUB}}': 'Ein Auszug unserer Services — persönlich, professionell, für Sie.',
        '{{FEATURE_CARDS}}': ''.join(
            '<div class="fcard rv"' + (' style="transition-delay:.' + str(i*6) + 's"' if i else '') + '><div class="ic">\u2726</div><h3>' + f + '</h3><p>Professionell und zuverl\u00e4ssig \u2014 seit Jahren in Bielefeld.</p></div>'
            for i, f in enumerate(lead.get('features', ['Leistung 1', 'Leistung 2', 'Leistung 3']))
        ),
        '{{REVIEW_CARDS}}': ''.join(
            '<div class="review rv"><div class="s">' + ('\u2605' * rv.get('stars', 5)) + '</div><p>' + rv['text'] + '</p><div class="who">\u2014 ' + rv['author'] + '</div></div>'
            for rv in lead.get('reviews', [])
        ),
        '{{REVIEW_FOOTNOTE}}': lead.get('reviewFootnote', 'Echte Google-Bewertungen einbinden — der fehlende Trust-Baustein.'),
        '{{CTA_BAND_EYEBROW}}': lead.get('ctaBandEyebrow', 'Jetzt Kontakt aufnehmen'),
        '{{CTA_BAND_H2}}': lead.get('ctaBandH2', 'Bereit für den nächsten Schritt?'),
        '{{CTA_BAND_SUB}}': lead.get('ctaBandSub', 'Unverbindlich anfragen — wir melden uns zeitnah.'),
        '{{INFO_H2}}': 'So erreichen Sie uns.',
        '{{CONTACT_DL}}': lead.get('contactDl', f'<dt>Ort</dt><dd>Bielefeld</dd><dt>Telefon</dt><dd><a href="tel:{lead.get("phone","")}" style="color:var(--accent-d);font-weight:700">{lead.get("phone","—")}</a></dd><dt>E-Mail</dt><dd>{lead.get("email","—")}</dd>'),
        '{{PHONE}}': lead.get('phone', ''),
        '{{NAV_LINKS}}': '<a class="lk" href="#leistungen">Leistungen</a><a class="lk" href="#reviews">Bewertungen</a><a class="lk" href="#info">Kontakt</a>',
        '{{FOOTER_DESC}}': lead.get('footerDesc', f'{lead.get("industry","")} in Bielefeld — Qualität, auf die Sie zählen können.'),
        '{{FOOTER_NAV}}': '<a href="#leistungen">Leistungen</a><a href="#reviews">Bewertungen</a><a href="#info">Kontakt</a>',
        '{{MOBILE_CTA_SHORT}}': lead.get('mobileCtaShort', 'Anfragen'),
        '{{META_DESC}}': lead.get('metaDesc', f'{lead["name"]} — {lead.get("industry","")} Bielefeld. Konzept-Vorschau MZ.9.'),
        '{{TRUST_STRIP}}': lead.get('trustStrip', f'<div class="stars"><span class="s">✦✦✦✦✦</span> {lead.get("industry","")} Bielefeld</div>'),
    }
    
    for k, v in r.items():
        html = html.replace(k, str(v))
    
    out_dir = os.path.join(PREVIEW_DIR, lead['id'])
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, 'index.html')
    with open(out_file, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'  Preview: {out_file}')
    return f'https://maikz91.github.io/the-tribe-bot/leads/{lead["id"]}/'

def update_dashboard(lead, preview_url):
    h = open(DASHBOARD_FILE, 'r', encoding='utf-8').read()
    if f'id:"{lead["id"]}"' in h:
        print(f'  Already in dashboard: {lead["id"]}')
        return
    
    seed_start = h.find('var SEED=[')
    seed_end = h.find('];', seed_start)
    
    entry = f'\n    {{id:"{lead["id"]}",name:"{lead["name"]}",industry:"{lead["industry"]}",hebel:"{lead["hebel"]}",score:{lead.get("score",50)},website:"{lead["website"]}",problems:{json.dumps(lead.get("problems",["Veraltetes Design","Schwache CTA"]), ensure_ascii=False)},opps:{json.dumps(lead.get("opps",["Modernes Design","Klare CTAs"]), ensure_ascii=False)},preview:"{preview_url}"}},'
    h = h[:seed_end] + entry + h[seed_end:]
    
    if lead.get('email'):
        mail_start = h.find('var EMAILS={')
        mail_end = h.find('};', mail_start)
        if f'"{lead["id"]}":' not in h:
            h = h[:mail_end] + f'\n    "{lead["id"]}":"{lead["email"]}",' + h[mail_end:]
    
    with open(DASHBOARD_FILE, 'w', encoding='utf-8') as f:
        f.write(h)
    print(f'  Dashboard updated: {lead["id"]}')

# Process all leads
print(f'Building {len(leads)} previews...')
for lead in leads:
    print(f'\n--- {lead["id"]} ---')
    preview_url = build_preview(lead)
    if preview_url:
        update_dashboard(lead, preview_url)
        # Save lead JSON
        os.makedirs(LEADS_DIR, exist_ok=True)
        with open(os.path.join(LEADS_DIR, f'{lead["id"]}.json'), 'w', encoding='utf-8') as f:
            json.dump(lead, f, ensure_ascii=False, indent=2)

print('\nDone!')
