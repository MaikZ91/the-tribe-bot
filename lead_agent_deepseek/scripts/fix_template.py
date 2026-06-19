"""Fix remaining hardcoded values in template."""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(ROOT, 'templates', 'preview.html')

with open(TEMPLATE, 'r', encoding='utf-8') as f:
    html = f.read()

fixes = [
    # Line 1: leftover comment fragment
    (' durch reale Werte ersetzt. }}\n',
     '{{! MZ.9 Lead Agent \u2014 Preview Template (DeepSeek Edition) }}\n'
     '{{! Vor Deployment werden alle {{PLATZHALTER}} durch reale Werte ersetzt. }}\n\n'),

    # Theme color
    ('content="#7c2d12"', 'content="{{ACCENT_DARK}}"'),

    # Favicon - accent dark encoded
    ("fill='%237c2d12'/", "fill='%23{{ACCENT_DARK_ENC}}'/"),
    # Favicon - accent encoded + initial
    ("fill='%23c2410c' text-anchor='middle'>R</text>",
     "fill='%23{{ACCENT_ENC}}' text-anchor='middle'>{{INITIAL}}</text>"),

    # Ribbon
    ('f\u00fcr Rancho Steakhouse</div>', 'f\u00fcr {{NAME}}</div>'),

    # Info H2
    ('<h2 style="margin-top:10px">So erreichen Sie uns.</h2>',
     '<h2 style="margin-top:10px">{{INFO_H2}}</h2>'),

    # Footer desc
    ('<p>Gastronomie in Bielefeld \u2014 Qualit\u00e4t, auf die Sie z\u00e4hlen k\u00f6nnen.</p>',
     '<p>{{FOOTER_DESC}}</p>'),

    # Actionbar CTA href
    ('href="#reservieren"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>{{MOBILE_CTA_SHORT}}',
     'href="{{CTA_HREF}}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>{{MOBILE_CTA_SHORT}}'),
]

for old, new in fixes:
    if old in html:
        html = html.replace(old, new)
        print(f'OK: {old[:40]}...')
    else:
        print(f'MISS: {old[:40]}...')

with open(TEMPLATE, 'w', encoding='utf-8') as f:
    f.write(html)

print(f'\nTemplate fixed: {TEMPLATE}')
