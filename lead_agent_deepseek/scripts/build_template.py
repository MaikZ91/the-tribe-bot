"""Reconstruct preview.html template from rancho-steakhouse output."""
import re, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(BASE)

src = os.path.join(ROOT, 'docs', 'leads', 'rancho-steakhouse', 'index.html')
dst = os.path.join(BASE, 'templates', 'preview.html')

with open(src, 'r', encoding='utf-8') as f:
    html = f.read()

# Strip template comments
html = re.sub(r'\{\{!.*?\}\}\n?', '', html)

# Ordered replacements - most specific first
reps = [
    # Meta / head
    ('<title>Rancho Steakhouse \u2014 Gastronomie in Bielefeld | Tisch reservieren</title>',
     '<title>{{NAME}} \u2014 {{INDUSTRY}} in Bielefeld | {{CTA_TEXT}}</title>'),
    ('<meta name="description" content="Rancho Steakhouse in Bielefeld \u2014 Dry-Aged Steaks, regionale Produkte, Familienbetrieb. Tisch reservieren online. Konzept-Vorschau von MZ.9." />',
     '<meta name="description" content="{{META_DESC}}" />'),

    # CSS variables
    ('--accent:#c2410c', '--accent:{{ACCENT}}'),
    ('--accent-d:#7c2d12', '--accent-d:{{ACCENT_DARK}}'),
    ('--accent-light:#fdba74', '--accent-light:{{ACCENT_LIGHT}}'),

    # Ribbon
    ('f\u00fcr Rancho Steakhouse</b>', 'f\u00fcr {{NAME}}</b>'),

    # Header brand
    ('<span class="mk">R</span>', '<span class="mk">{{INITIAL}}</span>'),
    ('Rancho</a>', '{{NAME_SHORT}}</a>'),

    # Nav
    ('<a class="lk" href="#leistungen">Leistungen</a><a class="lk" href="#reviews">Bewertungen</a><a class="lk" href="#info">Kontakt</a>',
     '{{NAV_LINKS}}'),

    # Nav CTA button
    ('<a class="btn btn-accent" href="#reservieren">Tisch reservieren</a>',
     '<a class="btn btn-accent" href="{{CTA_HREF}}">{{CTA_TEXT}}</a>'),

    # Hero
    ('<div class="eyebrow rv">Gastronomie \u00b7 Bielefeld</div>',
     '<div class="eyebrow rv">{{INDUSTRY}} \u00b7 Bielefeld</div>'),
    ('<h1 class="rv" style="transition-delay:.05s">Fleischkultur.<br><em>Ehrlich. Nachhaltig. Regional.</em></h1>',
     '<h1 class="rv" style="transition-delay:.05s">{{HERO_H1}}</h1>'),
    ('<p class="lede rv" style="transition-delay:.1s">Steaks aus aller Welt, regionale Produkte und echte Leidenschaft f\u00fcr Qualit\u00e4t \u2014 mitten in Bielefeld. Familiengef\u00fchrt, t\u00e4glich ge\u00f6ffnet, mit Steak-Know-how seit Jahren.</p>',
     '<p class="lede rv" style="transition-delay:.1s">{{HERO_SUB}}</p>'),

    # Hero CTAs
    ('<a class="btn btn-accent" href="#reservieren">Tisch reservieren <svg',
     '<a class="btn btn-accent" href="{{CTA_HREF}}">{{CTA_TEXT}} <svg'),
    ('<a class="btn btn-ol" href="#leistungen">Speisekarte ansehen</a>',
     '<a class="btn btn-ol" href="#leistungen">{{SECONDARY_CTA}}</a>'),

    # Trust strip
    ('<div class="stars"><span class="s">\u2605\u2605\u2605\u2605\u2605</span> 4,6 \u2605 auf Google</div><div class="sep"></div><div class="ti">Familiengef\u00fchrt</div><div class="sep"></div><div class="ti">Kein Ruhetag</div>',
     '{{TRUST_STRIP}}'),

    # Strip
    ('<span>\u2726 Steaks aus aller Welt</span><span>\u2726 Regionale Erzeuger</span><span>\u2726 T\u00e4glich ge\u00f6ffnet</span><span>\u2726 Familienunternehmen</span>',
     '{{STRIP_ITEMS}}'),

    # Section header (Leistungen)
    ('<div class="eyebrow rv">Leistungen</div>',
     '<div class="eyebrow rv">{{LEISTUNGEN_EYEBROW}}</div>'),
    ('<h2 class="rv" style="transition-delay:.05s">Das bieten wir</h2>',
     '<h2 class="rv" style="transition-delay:.05s">{{LEISTUNGEN_H2}}</h2>'),
    ('<p class="rv" style="transition-delay:.1s">Ein Auszug unserer Services \u2014 pers\u00f6nlich, professionell, f\u00fcr Sie.</p>',
     '<p class="rv" style="transition-delay:.1s">{{LEISTUNGEN_SUB}}</p>'),

    # Review footnote
    ('Echte Google-Bewertungen einbinden \u2014 der fehlende Trust-Baustein.',
     '{{REVIEW_FOOTNOTE}}'),

    # CTA band
    ('<div class="eyebrow" style="color:var(--accent-light)">Heute noch reservieren</div>',
     '<div class="eyebrow" style="color:var(--accent-light)">{{CTA_BAND_EYEBROW}}</div>'),
    ('<h2 style="margin-top:10px">Lust auf ein perfektes Steak?</h2>',
     '<h2 style="margin-top:10px">{{CTA_BAND_H2}}</h2>'),
    ('<p>Reservieren Sie jetzt online \u2014 oder rufen Sie an. Kein Ruhetag, immer f\u00fcr Sie da.</p>',
     '<p>{{CTA_BAND_SUB}}</p>'),

    # Info section
    ('<h2 style="margin-top:10px">Mitten in Bielefeld \u2014 t\u00e4glich f\u00fcr Sie da.</h2>',
     '<h2 style="margin-top:10px">{{INFO_H2}}</h2>'),

    # Phone
    ('href="tel:+4952196797979"', 'href="tel:{{PHONE}}"'),
    ('0521 \u00b7 96 79 79 79', '{{PHONE_FORMATTED}}'),

    # Footer
    ('<a class="brand" href="#top" style="font-size:23px"><span class="mk">R</span>Rancho</a>',
     '<a class="brand" href="#top" style="font-size:23px"><span class="mk">{{INITIAL}}</span>{{NAME_SHORT}}</a>'),
    ('<p>Steakhouse &amp; Familienbetrieb in Bielefeld Mitte \u2014 ehrliche Fleischkultur, regionale Produkte, Steaks aus aller Welt.</p>',
     '<p>{{FOOTER_DESC}}</p>'),
    ('<nav class="fnav"><a href="#leistungen">Leistungen</a><a href="#reviews">Bewertungen</a><a href="#info">Kontakt</a></nav>',
     '<nav class="fnav">{{FOOTER_NAV}}</nav>'),
    ('\u00a9 <span id="yr">2026</span> Rancho Steakhouse',
     '\u00a9 <span id="yr">2026</span> {{NAME}}'),
    ('>Reservieren<', '>{{MOBILE_CTA_SHORT}}<'),

    # Meta desc (second occurrence - in case first missed)
    ('content="Rancho Steakhouse in Bielefeld', 'content="{{META_DESC_PREFIX}}'),
]

for old, new in reps:
    if old in html:
        html = html.replace(old, new)
    else:
        print(f"WARNING: not found: {old[:60]}...")

# Feature cards block
feat_pat = re.compile(r'(<div class="feat">\s*).*?(\s*</div>\s*</div>\s*</section>\s*<section class="section rev-sec")', re.DOTALL)
m = feat_pat.search(html)
if m:
    html = html[:m.start(1)] + m.group(1) + '{{FEATURE_CARDS}}' + html[m.start(2):]
    print("FEATURE_CARDS replaced")
else:
    print("FEATURE_CARDS: pattern not found")

# Review cards block
rev_pat = re.compile(r'(<div class="reviews">\s*).*?(\s*</div>\s*<div class="rev-foot rv">)', re.DOTALL)
m = rev_pat.search(html)
if m:
    html = html[:m.start(1)] + m.group(1) + '{{REVIEW_CARDS}}' + html[m.start(2):]
    print("REVIEW_CARDS replaced")
else:
    print("REVIEW_CARDS: pattern not found")

# Contact DL block
dl_pat = re.compile(r'(<dl>\s*).*?(\s*</dl>)', re.DOTALL)
m = dl_pat.search(html)
if m:
    html = html[:m.start(1)] + m.group(1) + '{{CONTACT_DL}}' + html[m.start(2):]
    print("CONTACT_DL replaced")
else:
    print("CONTACT_DL: pattern not found")

os.makedirs(os.path.dirname(dst), exist_ok=True)
with open(dst, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Template written: {dst}")
print(f"Size: {len(html)} chars, {html.count(chr(10))} lines")
