"""Process discovery batch files into full lead previews + dashboard + queue."""
import os, json, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DISCOVERIES_DIR = os.path.join(ROOT, "lead_agent_deepseek", "discoveries")
PREVIEW_DIR = os.path.join(ROOT, "docs", "leads")
LEADS_DIR = os.path.join(ROOT, "lead_agent_deepseek", "leads")
TEMPLATE_FILE = os.path.join(ROOT, "lead_agent_deepseek", "templates", "preview.html")
DASHBOARD_FILE = os.path.join(ROOT, "docs", "leads", "dashboard", "index.html")
QUEUE_FILE = os.path.join(ROOT, "lead_agent_deepseek", "queue.json")

COLORS = {
    'friseur':       {'accent': '#c77e6e', 'dark': '#a85f4f', 'light': '#d9a89b'},
    'baeckerei':     {'accent': '#b45309', 'dark': '#78350f', 'light': '#fcd34d'},
    'zahnarzt':      {'accent': '#0891b2', 'dark': '#155e75', 'light': '#67e8f9'},
    'default':       {'accent': '#6366f1', 'dark': '#3730a3', 'light': '#a5b4fc'},
}

def esc(s):
    return (s or '').replace('#', '%23')

INDUSTRY_MAP = {
    'friseur': 'Friseur',
    'baeckerei': 'Bäckerei',
    'zahnarzt': 'Zahnarzt',
}

INDUSTRY_CONTENT = {
    'friseur': {
        'heroH1': 'Ihr Stil.<br><em>Unsere Leidenschaft.</em>',
        'heroSub': 'Haarschnitt, Coloration und Styling in Bielefeld. Persönliche Beratung, moderne Techniken, Wohlfühl-Garantie.',
        'ctaText': 'Termin vereinbaren',
        'secondaryCta': 'Leistungen ansehen',
        'stripItems': ['✦ Haarschnitt', '✦ Coloration', '✦ Styling', '✦ Pflege'],
        'features': ['Haarschnitt & Styling', 'Coloration & Strähnen', 'Haarpflege & Beratung'],
        'ctaBandEyebrow': 'Jetzt Wunschtermin sichern',
        'ctaBandH2': 'Bereit für einen neuen Look?',
        'ctaBandSub': 'Vereinbaren Sie Ihren Termin — wir freuen uns auf Sie.',
        'footerDesc': 'Haarschnitt, Coloration & Styling in Bielefeld — Ihr Friseur mit Leidenschaft und Präzision.',
        'mobileCtaShort': 'Termin',
    },
    'baeckerei': {
        'heroH1': 'Frisch gebacken.<br><em>Täglich in Bielefeld.</em>',
        'heroSub': 'Brot, Brötchen, Kuchen und Torten aus eigener Herstellung. Handwerkliche Backkunst mit besten Zutaten.',
        'ctaText': 'Jetzt bestellen',
        'secondaryCta': 'Sortiment ansehen',
        'stripItems': ['✦ Brot & Brötchen', '✦ Kuchen & Torten', '✦ Frühstück', '✦ Saisonal'],
        'features': ['Täglich frische Backwaren', 'Kuchen & Torten', 'Frühstücksservice'],
        'ctaBandEyebrow': 'Jetzt vorbestellen',
        'ctaBandH2': 'Lust auf frisch Gebackenes?',
        'ctaBandSub': 'Bestellen Sie vor oder kommen Sie vorbei — täglich frisch für Sie.',
        'footerDesc': 'Brot, Brötchen, Kuchen & Torten — handwerklich gebacken in Bielefeld. Täglich frisch.',
        'mobileCtaShort': 'Bestellen',
    },
    'zahnarzt': {
        'heroH1': 'Ihr Lächeln.<br><em>Unsere Mission.</em>',
        'heroSub': 'Moderne Zahnheilkunde in Bielefeld — von der Prophylaxe bis zur Implantologie. Ihre Zahngesundheit in besten Händen.',
        'ctaText': 'Termin anfragen',
        'secondaryCta': 'Leistungen ansehen',
        'stripItems': ['✦ Prophylaxe', '✦ Ästhetik', '✦ Implantologie', '✦ Kinderzahnheilkunde'],
        'features': ['Professionelle Zahnreinigung', 'Zahnästhetik & Bleaching', 'Implantologie'],
        'ctaBandEyebrow': 'Jetzt Termin vereinbaren',
        'ctaBandH2': 'Ihr Zahnarzt in Bielefeld.',
        'ctaBandSub': 'Vereinbaren Sie Ihren Wunschtermin — wir nehmen uns Zeit für Sie.',
        'footerDesc': 'Zahnarztpraxis in Bielefeld — moderne Zahnheilkunde mit Herz. Prophylaxe, Ästhetik, Implantologie.',
        'mobileCtaShort': 'Termin',
    },
}


def derive_problems_opps(discovery):
    """Convert discovery reasons into problems/opps arrays."""
    reasons = discovery.get('reasons', [])
    problems = []
    opps = []
    
    if not discovery.get('https'):
        problems.append('Keine HTTPS-Verschlüsselung')
        opps.append('SSL/HTTPS einrichten')
    if not discovery.get('responsive'):
        problems.append('Nicht mobil-optimiert (responsive)')
        opps.append('Responsive Website für alle Geräte')
    if not discovery.get('contact_form'):
        problems.append('Kein Online-Kontaktformular')
        opps.append('Kontaktformular integrieren')
    
    for r in reasons:
        r_lower = r.lower()
        if 'CMS' in r or 'cms' in r_lower or 'veralt' in r_lower or 'statisch' in r_lower or 'wordpress' in r_lower or 'duda' in r_lower or 'jimdo' in r_lower or 'baukasten' in r_lower:
            problems.append('Veraltetes Content-Management-System')
            opps.append('Modernes CMS mit einfacher Pflege')
        elif 'design' in r_lower or 'template' in r_lower or 'generisch' in r_lower:
            problems.append('Design nicht zeitgemäß')
            opps.append('Modernes, individuelles Website-Design')
        elif 'email' in r_lower or 'gmx' in r_lower or 'unprofessionell' in r_lower:
            problems.append('Unprofessionelle E-Mail-Adresse')
            opps.append('Professionelle E-Mail-Adresse mit eigener Domain')
        elif 'online' in r_lower or 'buchung' in r_lower:
            problems.append('Keine Online-Buchung/-Bestellung')
            opps.append('Online-Buchungssystem integrieren')
        elif 'neuaufbau' in r_lower or 'aufbau' in r_lower:
            problems.append('Website im Neuaufbau — unvollständig')
            opps.append('Fertige, professionelle Website')
        elif 'js' in r_lower or 'rendering' in r_lower:
            problems.append('Schlechte Suchmaschinen-Sichtbarkeit (JS-Rendering)')
            opps.append('SEO-optimierte Website')
        elif 'ungewöhnlich' in r_lower:
            problems.append('Ungewöhnliches/verwirrendes Design')
            opps.append('Klares, modernes Webdesign')
        elif 'einfach' in r_lower:
            problems.append('Zu einfaches Design — wenig Aussagekraft')
            opps.append('Aussagekräftige, professionelle Website')
    
    # Ensure at least minimal problems/opps
    if not problems:
        problems = ['Website könnte moderner und professioneller wirken']
    if not opps:
        opps = ['Moderne, professionelle Website', 'Bessere Service-Kommunikation']
    
    return problems, opps


def build_preview(lead):
    """Build HTML preview from template."""
    if not os.path.exists(TEMPLATE_FILE):
        print(f'  ERROR: Template missing: {TEMPLATE_FILE}')
        return None
    
    with open(TEMPLATE_FILE, 'r', encoding='utf-8') as f:
        html = f.read()
    
    industry = lead.get('industry', '')
    branch_key = lead.get('branch', 'default').lower()
    c = COLORS.get(branch_key, COLORS['default'])
    ic = INDUSTRY_CONTENT.get(branch_key, INDUSTRY_CONTENT.get('friseur', {}))
    
    # Get first initial
    name = lead.get('name', '?')
    initial_letter = name.split()[-1][0].upper() if name.split() else '?'
    name_short = lead.get('nameShort', name.split()[-1] if len(name.split()) > 1 else name)
    
    # Phone number formatting
    phone = lead.get('phone', '').replace('+49 ', '').replace('+49', '')
    
    review_texts = [
        {'stars': 5, 'text': '"Sehr zufrieden — gerne wieder. Top!"', 'author': 'Kunde · Google'},
        {'stars': 5, 'text': '"Professionell, freundlich und fair. Absolut empfehlenswert."', 'author': 'Kundin · Google'},
        {'stars': 5, 'text': '"Seit Jahren Stammkunde — aus gutem Grund."', 'author': 'Kunde · Google'},
    ]
    
    problems, opps = derive_problems_opps(lead)
    
    replacements = {
        '{{NAME}}': name,
        '{{NAME_SHORT}}': name_short,
        '{{INITIAL}}': initial_letter,
        '{{INDUSTRY}}': industry,
        '{{ACCENT}}': c['accent'],
        '{{ACCENT_DARK}}': c['dark'],
        '{{ACCENT_LIGHT}}': c['light'],
        '{{ACCENT_DARK_ENC}}': esc(c['dark']),
        '{{ACCENT_ENC}}': esc(c['accent']),
        '{{HERO_H1}}': ic.get('heroH1', f'{name}<br><em>{industry} in Bielefeld</em>'),
        '{{HERO_SUB}}': ic.get('heroSub', f'{industry} mit Qualität und Erfahrung — direkt in Bielefeld.'),
        '{{CTA_TEXT}}': ic.get('ctaText', 'Jetzt anfragen'),
        '{{CTA_HREF}}': '#kontakt',
        '{{SECONDARY_CTA}}': ic.get('secondaryCta', 'Mehr erfahren'),
        '{{STRIP_ITEMS}}': ''.join(f'<span>{s}</span>' for s in ic.get('stripItems', ['✦ Lokal in Bielefeld', '✦ Persönlich', '✦ Modern'])),
        '{{LEISTUNGEN_EYEBROW}}': 'Leistungen',
        '{{LEISTUNGEN_H2}}': 'Das bieten wir',
        '{{LEISTUNGEN_SUB}}': 'Ein Auszug unserer Services — persönlich, professionell, für Sie.',
        '{{FEATURE_CARDS}}': ''.join(
            '<div class="fcard rv"' + (' style="transition-delay:.' + str(i*6) + 's"' if i else '') + '>'
            '<div class="ic">\u2726</div><h3>' + f + '</h3>'
            '<p>Professionell und zuverl\u00e4ssig \u2014 seit Jahren in Bielefeld.</p></div>'
            for i, f in enumerate(ic.get('features', ['Leistung 1', 'Leistung 2', 'Leistung 3']))
        ),
        '{{REVIEW_CARDS}}': ''.join(
            '<div class="review rv"><div class="s">' + ('\u2605' * rv['stars']) + '</div>'
            '<p>' + rv['text'] + '</p><div class="who">\u2014 ' + rv['author'] + '</div></div>'
            for rv in review_texts
        ),
        '{{REVIEW_FOOTNOTE}}': 'Echte Google-Bewertungen einbinden — der fehlende Trust-Baustein.',
        '{{CTA_BAND_EYEBROW}}': ic.get('ctaBandEyebrow', 'Jetzt Kontakt aufnehmen'),
        '{{CTA_BAND_H2}}': ic.get('ctaBandH2', 'Bereit für den nächsten Schritt?'),
        '{{CTA_BAND_SUB}}': ic.get('ctaBandSub', 'Unverbindlich anfragen — wir melden uns zeitnah.'),
        '{{INFO_H2}}': 'So erreichen Sie uns.',
        '{{CONTACT_DL}}': (
            f'<dt>Adresse</dt><dd>{lead.get("address", "Bielefeld")}</dd>'
            f'<dt>Telefon</dt><dd><a href="tel:{phone}" style="color:var(--accent-d);font-weight:700">{phone}</a></dd>'
            f'<dt>E-Mail</dt><dd>{lead.get("email", "—")}</dd>'
        ),
        '{{PHONE}}': phone,
        '{{NAV_LINKS}}': '<a class="lk" href="#leistungen">Leistungen</a><a class="lk" href="#reviews">Bewertungen</a><a class="lk" href="#info">Kontakt</a>',
        '{{FOOTER_DESC}}': ic.get('footerDesc', f'{industry} in Bielefeld — Qualität, auf die Sie zählen können.'),
        '{{FOOTER_NAV}}': '<a href="#leistungen">Leistungen</a><a href="#reviews">Bewertungen</a><a href="#info">Kontakt</a>',
        '{{MOBILE_CTA_SHORT}}': ic.get('mobileCtaShort', 'Anfragen'),
        '{{META_DESC}}': f'{name} — {industry} in Bielefeld. {ic.get("heroSub", "")} Konzept-Vorschau MZ.9.',
        '{{TRUST_STRIP}}': f'<div class="stars"><span class="s">✦✦✦✦✦</span> {industry} Bielefeld</div>',
    }
    
    for k, v in replacements.items():
        html = html.replace(k, str(v))
    
    out_dir = os.path.join(PREVIEW_DIR, lead['id'])
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, 'index.html')
    with open(out_file, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f'  Preview written: {out_file}')
    return f'https://maikz91.github.io/the-tribe-bot/leads/{lead["id"]}/'


def update_dashboard(lead, preview_url):
    """Add lead to dashboard SEED array."""
    with open(DASHBOARD_FILE, 'r', encoding='utf-8') as f:
        h = f.read()
    
    if f'id:"{lead["id"]}"' in h:
        print(f'  Already in dashboard: {lead["id"]}')
        return
    
    seed_start = h.find('var SEED=[')
    seed_end = h.find('];', seed_start)
    
    problems, opps = derive_problems_opps(lead)
    
    # Score: lower = more potential. Map discovery score (0-10, higher=worse site) to dashboard score (0-100, lower=more hebel)
    discovery_score = lead.get('score', 5)
    dashboard_score = max(10, min(90, discovery_score * 10))
    
    hebel = 'hoch' if discovery_score >= 5 else ('mittel' if discovery_score >= 3 else 'niedrig')
    
    entry = (
        f'\n    {{id:"{lead["id"]}",name:"{lead["name"]}",industry:"{lead.get("industry","Dienstleistung")}",'
        f'hebel:"{hebel}",score:{dashboard_score},website:"{lead.get("website","")}",'
        f'problems:{json.dumps(problems, ensure_ascii=False)},'
        f'opps:{json.dumps(opps, ensure_ascii=False)},'
        f'preview:"{preview_url}"}},'
    )
    
    h = h[:seed_end] + entry + h[seed_end:]
    
    # Add email to EMAILS map
    email = lead.get('email', '')
    if email and f'"{lead["id"]}":' not in h:
        emails_start = h.find('var EMAILS={')
        emails_end = h.find('};', emails_start)
        h = h[:emails_end] + f'\n    "{lead["id"]}":"{email}",' + h[emails_end:]
    
    with open(DASHBOARD_FILE, 'w', encoding='utf-8') as f:
        f.write(h)
    
    print(f'  Dashboard updated: {lead["id"]} (score={dashboard_score}, hebel={hebel})')


def update_queue(leads):
    """Add leads to queue.json and save lead JSONs."""
    with open(QUEUE_FILE, 'r', encoding='utf-8') as f:
        queue = json.load(f)
    
    os.makedirs(LEADS_DIR, exist_ok=True)
    
    for lead in leads:
        # Save lead JSON
        lead_path = os.path.join(LEADS_DIR, f'{lead["id"]}.json')
        with open(lead_path, 'w', encoding='utf-8') as f:
            json.dump(lead, f, ensure_ascii=False, indent=2)
        print(f'  Lead JSON saved: {lead_path}')
    
    # Add to queue
    queue_entries = []
    for lead in leads:
        problems, opps = derive_problems_opps(lead)
        branch = lead.get('branch', '')
        industry = INDUSTRY_MAP.get(branch, branch.title() if branch else 'Dienstleistung')
        
        name_parts = lead['name'].split()
        name_short = name_parts[-1] if len(name_parts) > 1 else lead['name']
        
        ic = INDUSTRY_CONTENT.get(branch, {})
        
        entry = {
            'id': lead['id'],
            'name': lead['name'],
            'nameShort': name_short,
            'industry': industry,
            'hebel': 'hoch' if lead.get('score', 0) >= 5 else ('mittel' if lead.get('score', 0) >= 3 else 'niedrig'),
            'website': lead.get('website', ''),
            'phone': lead.get('phone', ''),
            'email': lead.get('email', ''),
            'heroH1': ic.get('heroH1', f'{lead["name"]}<br><em>{industry} in Bielefeld</em>'),
            'heroSub': ic.get('heroSub', ''),
            'ctaText': ic.get('ctaText', 'Jetzt anfragen'),
            'features': ic.get('features', ['Service 1', 'Service 2', 'Service 3']),
            'problems': problems,
            'opps': opps,
        }
        queue_entries.append(entry)
        queue['leads'].append(entry)
    
    with open(QUEUE_FILE, 'w', encoding='utf-8') as f:
        json.dump(queue, f, ensure_ascii=False, indent=2)
    
    print(f'\nQueue updated: {len(queue_entries)} leads added. Total queue: {len(queue["leads"])}')


# ---- MAIN ----

# 1. Read all discoveries
discoveries = {}
for batch_file in ["batch_friseur.json", "batch_baeckerei.json", "batch_zahnarzt.json"]:
    path = os.path.join(DISCOVERIES_DIR, batch_file)
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        for lead in data['leads']:
            lead['branch'] = data.get('branch', 'default')
            discoveries[lead['id']] = lead

# 2. Check existing
existing = set(os.listdir(PREVIEW_DIR))
existing.discard('dashboard')
existing.discard('chat.js')

new_leads = {lid: discoveries[lid] for lid in discoveries if lid not in existing}

print(f'Discoveries total: {len(discoveries)}')
print(f'Already processed: {len(discoveries) - len(new_leads)}')
print(f'New to process: {len(new_leads)}\n')

if not new_leads:
    print('No new leads to process. Exiting.')
    exit(0)

# 3. Process each lead
new_lead_list = []
for lid, lead in sorted(new_leads.items()):
    print(f'--- {lid}: {lead["name"]} ---')
    
    # Add industry from branch
    branch = lead.get('branch', 'default')
    lead['industry'] = INDUSTRY_MAP.get(branch, branch.title())
    
    # Build preview
    preview_url = build_preview(lead)
    if preview_url:
        # Update dashboard
        update_dashboard(lead, preview_url)
        new_lead_list.append(lead)

# 4. Update queue
if new_lead_list:
    update_queue(new_lead_list)

print(f'\nDone! Processed {len(new_lead_list)} new leads.')
