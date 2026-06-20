/**
 * MZ.9 Build-Agent — Programmatischer Premium-Seitengenerator
 *
 * Liest alle pending build-job.json, generiert unique Landing Pages mit:
 * - Echten Daten aus Build-Job (Name, Telefon, Adresse, Images, Problems/Opps)
 * - Branchen-eigenen Farbpaletten (keine Template-Einheitsfarben)
 * - Original-Bildern aus dem Lead
 * - Premium-Struktur (Ribbon·Header·Hero·Strip·Products·Gallery·Reviews·CTA·Info·Footer)
 * - Scroll-Reveal, Glow-Effekte, Mobile-Nav, voll responsive
 *
 * Nutzung: node lead_agent_deepseek/scripts/build_agent.js [--all]
 */

const fs = require('fs');
const path = require('path');
const { listPending } = require('./pending');

const ROOT = path.join(__dirname, '..');
const PREVIEW_DIR = path.join(ROOT, '..', 'docs', 'leads');

// ═══════════════════════════════════════════════════════════════
// FARBPALETTEN pro Branche (jede unique)
// ═══════════════════════════════════════════════════════════════
const PALETTES = {
  gastronomie:  { bg:'#FBF7F0', bg2:'#F3EBDC', card:'#FFFDF8', dunkel:'#3D2914', dunkel2:'#2E1F0F', ink:'#2E1F0F', ink2:'#5C4A37', inkMut:'#8A7862', accent:'#C8963E', accent2:'#A67B2E', cta:'#B8542E', cta2:'#9A4424', accentGold:'#D4A44A', serif:'"Playfair Display",Georgia,serif', sans:'"Inter",system-ui,sans-serif' },
  kanzlei:       { bg:'#F8F6F3', bg2:'#EDE9E1', card:'#FFFDFA', dunkel:'#1A2740', dunkel2:'#121D30', ink:'#121D30', ink2:'#4A5468', inkMut:'#7A8090', accent:'#B8860B', accent2:'#9A720A', cta:'#1A56A0', cta2:'#154080', accentGold:'#C9A63A', serif:'"Cormorant Garamond",Georgia,serif', sans:'"Source Sans 3",system-ui,sans-serif' },
  fitness:       { bg:'#F4F4F6', bg2:'#E8E8EC', card:'#FDFDFE', dunkel:'#1A1A24', dunkel2:'#101018', ink:'#101018', ink2:'#484852', inkMut:'#787880', accent:'#65A30D', accent2:'#4D7A0A', cta:'#DC2626', cta2:'#B91C1C', accentGold:'#84CC16', serif:'"Barlow Condensed","Impact",sans-serif', sans:'"Inter",system-ui,sans-serif' },
  kosmetik:      { bg:'#FDF7FA', bg2:'#F8EAF0', card:'#FFFCFD', dunkel:'#2D1828', dunkel2:'#1F101C', ink:'#1F101C', ink2:'#5A4050', inkMut:'#8A7080', accent:'#C0847C', accent2:'#A06A62', cta:'#9B4D8A', cta2:'#7D3D6E', accentGold:'#D4A4AA', serif:'"Playfair Display",Georgia,serif', sans:'"Inter",system-ui,sans-serif' },
  massage:       { bg:'#F6F4F0', bg2:'#EDE8E0', card:'#FEFCF8', dunkel:'#2A2822', dunkel2:'#1C1A16', ink:'#1C1A16', ink2:'#4A4640', inkMut:'#7A7670', accent:'#B8965A', accent2:'#9A7C48', cta:'#5B8A6A', cta2:'#486E54', accentGold:'#C4A46A', serif:'"Cormorant Garamond",Georgia,serif', sans:'"Inter",system-ui,sans-serif' },
  zahnarzt:      { bg:'#F4F8FB', bg2:'#E4EEF6', card:'#FDFEFF', dunkel:'#0C2238', dunkel2:'#081828', ink:'#081828', ink2:'#3A4A58', inkMut:'#6A7888', accent:'#0891B2', accent2:'#06708A', cta:'#0E7490', cta2:'#0A5A70', accentGold:'#22D0F0', serif:'"Cormorant Garamond",Georgia,serif', sans:'"Inter",system-ui,sans-serif' },
  einelhandel:   { bg:'#F8F7F4', bg2:'#EFECE4', card:'#FEFDFA', dunkel:'#1A2820', dunkel2:'#101C16', ink:'#101C16', ink2:'#424A44', inkMut:'#727A74', accent:'#0D9488', accent2:'#0A7068', cta:'#B8542E', cta2:'#9A4424', accentGold:'#14CCB8', serif:'"Playfair Display",Georgia,serif', sans:'"Inter",system-ui,sans-serif' },
  immobilien:    { bg:'#F7F6FA', bg2:'#EBE8F2', card:'#FDFCFE', dunkel:'#1A1630', dunkel2:'#120E24', ink:'#120E24', ink2:'#423E54', inkMut:'#726E84', accent:'#7C3AED', accent2:'#6028C0', cta:'#5B21B6', cta2:'#441888', accentGold:'#A78BFA', serif:'"Playfair Display",Georgia,serif', sans:'"Inter",system-ui,sans-serif' },
  dienstleistung:{ bg:'#F6F7F9', bg2:'#E9EBF0', card:'#FDFDFE', dunkel:'#161E2C', dunkel2:'#0E1420', ink:'#0E1420', ink2:'#3E4658', inkMut:'#6E7688', accent:'#2563EB', accent2:'#1D4EC0', cta:'#1D4ED8', cta2:'#163AA0', accentGold:'#60A0F0', serif:'"Cormorant Garamond",Georgia,serif', sans:'"Source Sans 3",system-ui,sans-serif' },
  handwerk:      { bg:'#F8F5F0', bg2:'#EFEAE0', card:'#FEFCF8', dunkel:'#2A2218', dunkel2:'#1C1610', ink:'#1C1610', ink2:'#4A4238', inkMut:'#7A7268', accent:'#B45309', accent2:'#924008', cta:'#C2410C', cta2:'#9A3408', accentGold:'#F59E40', serif:'"Cormorant Garamond",Georgia,serif', sans:'"Inter",system-ui,sans-serif' },
  physio:        { bg:'#F5F8F6', bg2:'#E6EEE8', card:'#FDFEFD', dunkel:'#162820', dunkel2:'#0E1C16', ink:'#0E1C16', ink2:'#404A44', inkMut:'#707A74', accent:'#0D9488', accent2:'#0A7068', cta:'#0D9488', cta2:'#0A7068', accentGold:'#14CCB8', serif:'"Cormorant Garamond",Georgia,serif', sans:'"Source Sans 3",system-ui,sans-serif' },
  default:       { bg:'#F7F7F6', bg2:'#EDEBE6', card:'#FEFDFB', dunkel:'#1E1A16', dunkel2:'#141210', ink:'#141210', ink2:'#444240', inkMut:'#747270', accent:'#6366F1', accent2:'#4F46E0', cta:'#4F46E0', cta2:'#3B30C0', accentGold:'#818CF8', serif:'"Cormorant Garamond",Georgia,serif', sans:'"Inter",system-ui,sans-serif' },
};

function paletteFor(industry) {
  const key = (industry || '').toLowerCase();
  // Map synonyms
  const map = { gastronomie:'gastronomie', baeckerei:'gastronomie', restaurant:'gastronomie', friseur:'dienstleistung', kosmetik:'kosmetik', kosmetikstudio:'kosmetik', fitness:'fitness', fitnessstudio:'fitness', zahnarzt:'zahnarzt', kanzlei:'kanzlei', steuerberater:'kanzlei', rechtsanwalt:'kanzlei', immobilien:'immobilien', immobilienmakler:'immobilien', einzelhandel:'einelhandel', handwerk:'handwerk', maler:'handwerk', dachdecker:'handwerk', tischler:'handwerk', schreiner:'handwerk', elektriker:'handwerk', dienstleistung:'dienstleistung', massage:'massage', physiotherapie:'physio', physio:'physio', hundesalon:'dienstleistung', blumenladen:'einelhandel', fotografie:'dienstleistung' };
  const mapped = map[key] || key;
  return PALETTES[mapped] || PALETTES.default;
}

// ═══════════════════════════════════════════════════════════════
// CONTENT-ADAPTER pro Branche
// ═══════════════════════════════════════════════════════════════
function contentFor(job) {
  const p = paletteFor(job.industry);
  const ind = (job.industry || '').toLowerCase();
  const name = job.name || 'Unser Betrieb';
  const nameShort = job.nameShort || name.split(' ').slice(0, 2).join(' ');
  const phone = job.phone || '';
  const email = job.email || '';
  const address = job.address || '';
  const problems = job.problems || [];
  const opps = job.opps || [];

  let cta = 'Jetzt anfragen';
  let ctaLink = '#kontakt';
  let navItems = [{ label: 'Leistungen', href: '#leistungen' }, { label: 'Galerie', href: '#galerie' }, { label: 'Kontakt', href: '#kontakt' }];
  let heroH1 = `Professionell.<br><em>Persönlich vor Ort.</em>`;
  let heroSub = `${name} — ${opps.slice(0, 2).join(' · ') || 'Qualität, die überzeugt.'}`;
  let heroTrust = ['Regional verwurzelt', 'Persönliche Beratung', 'Moderne Qualität'];
  let stripItems = ['✦ Qualität aus Leidenschaft', '✦ Persönliche Betreuung', '✦ Termine flexibel', '✦ Jetzt kontaktieren'];
  let sections = [];
  let reviewHeadline = 'Das sagen unsere Kunden';
  let productData = { title: 'Unsere Leistungen', cols: [] };

  // ─── Branchen-spezifische Anpassungen ───
  if (ind === 'gastronomie' || ind.includes('baecker') || ind.includes('bäckerei') || ind.includes('restaurant')) {
    cta = 'Jetzt bestellen'; ctaLink = '#bestellen';
    navItems = [{ label: 'Sortiment', href: '#sortiment' }, { label: 'Galerie', href: '#galerie' }, { label: 'Anfahrt', href: '#kontakt' }];
    heroH1 = `Frisch &amp; lecker.<br><em>Täglich für Sie.</em>`;
    heroTrust = ['Handwerkliche Qualität', 'Regionale Zutaten', 'Familienbetrieb'];
    stripItems = ['✦ Täglich frische Produkte', '✦ Eigene Herstellung', '✦ Regionale Zutaten', '✦ Online vorbestellen'];
    productData = { title: 'Unser Sortiment', cols: [
      { label: 'Brot & Backwaren', items: [
        { name: 'Unser bestes Bauernbrot', desc: 'Saftig, lange Teigführung, handwerklich gebacken' },
        { name: 'Ofenfrische Brötchen', desc: 'Knusprig, täglich frisch aus dem Steinofen' },
        { name: 'Dinkel-Vollkorn', desc: '100% Dinkel, bekömmlich & aromatisch' },
        { name: 'Saison-Spezialitäten', desc: 'Frisch, regional, je nach Saison' }
      ]},
      { label: 'Konditorei & Feines', items: [
        { name: 'Butterkuchen', desc: 'Saftig, mit viel Butter & Mandeln' },
        { name: 'Obsttorte der Saison', desc: 'Frisch belegt, hausgemacht' },
        { name: 'Teilchen & Snacks', desc: 'Herzhaft & süß für den kleinen Hunger' }
      ]}
    ]};
  } else if (ind === 'kanzlei' || ind.includes('recht') || ind.includes('steuer')) {
    cta = 'Erstgespräch vereinbaren'; ctaLink = '#kontakt';
    navItems = [{ label: 'Kanzlei', href: '#leistungen' }, { label: 'Team', href: '#galerie' }, { label: 'Kontakt', href: '#kontakt' }];
    heroH1 = `Ihr Recht.<br><em>Unsere Expertise.</em>`;
    heroTrust = ['Persönliche Beratung', 'Jahrelange Erfahrung', 'Mandantenorientiert'];
    stripItems = ['✦ Fachanwälte im Team', '✦ Kostenlose Ersteinschätzung', '✦ Flexible Termine', '✦ Jetzt Kontakt aufnehmen'];
    productData = { title: 'Rechtsgebiete', cols: [
      { label: 'Unsere Schwerpunkte', items: [
        { name: opps[0] || 'Individuelle Rechtsberatung', desc: problems[0] || 'Wir finden die passende Lösung für Ihr Anliegen' },
        { name: opps[1] || 'Außergerichtliche Einigung', desc: problems[1] || 'Schnell, diskret & kosteneffizient' },
        { name: opps[2] || 'Prozessvertretung', desc: problems[2] || 'Erfahren vor Gericht — bundesweit' },
        { name: 'Mandanten-Service', desc: 'Persönlich, transparent, lösungsorientiert' }
      ]},
      { label: 'Ihre Vorteile', items: [
        { name: 'Kostenlose Ersteinschätzung', desc: 'Unverbindlich & schnell' },
        { name: 'Faire Honorarstruktur', desc: 'Transparent & planbar' },
        { name: 'Flexible Erreichbarkeit', desc: 'Auch digital & außerhalb der Geschäftszeiten' }
      ]}
    ]};
  } else if (ind === 'fitness' || ind.includes('fitness')) {
    cta = 'Probetraining buchen'; ctaLink = '#kontakt';
    heroH1 = `Dein Training.<br><em>Deine Ergebnisse.</em>`;
    heroTrust = ['Professionelle Trainer', 'Moderne Geräte', 'Ohne Vertragsbindung'];
    stripItems = ['✦ Personal Training', '✦ Gruppenkurse', '✦ Modernste Geräte', '✦ Jetzt Probetraining'];
    productData = { title: 'Training & Kurse', cols: [
      { label: 'Angebot', items: [
        { name: 'Personal Training', desc: 'Individuell, effektiv, maßgeschneidert' },
        { name: 'Gruppenkurse', desc: 'Motivierend & abwechslungsreich' },
        { name: 'Functional Fitness', desc: 'Ganzkörpertraining mit System' }
      ]},
      { label: 'Deine Vorteile', items: [
        { name: 'Flexible Mitgliedschaft', desc: 'Keine langen Verträge' },
        { name: 'Top ausgestattet', desc: 'Neueste Geräte & Freihantelbereich' },
        { name: 'Betreute Trainingsfläche', desc: 'Immer ein Ansprechpartner vor Ort' }
      ]}
    ]};
  } else if (ind === 'zahnarzt') {
    cta = 'Termin vereinbaren'; ctaLink = '#kontakt';
    heroH1 = `Ihr Lächeln.<br><em>Unsere Leidenschaft.</em>`;
    heroTrust = ['Moderne Zahnmedizin', 'Angstfreie Behandlung', 'Familienpraxis'];
    productData = { title: 'Leistungen', cols: [
      { label: 'Zahnmedizin', items: [
        { name: 'Professionelle Zahnreinigung', desc: 'Sanft, gründlich, nachhaltig' },
        { name: 'Ästhetische Zahnheilkunde', desc: 'Veneers, Bleaching, Invisalign' },
        { name: 'Implantologie', desc: 'Moderne Technik, minimalinvasiv' }
      ]},
      { label: 'Ihr Komfort', items: [
        { name: 'Angstfreie Behandlung', desc: 'Einfühlsam & schonend' },
        { name: 'Moderne Praxis', desc: 'Digitales Röntgen, 3D-Planung' },
        { name: 'Flexible Termine', desc: 'Auch abends & samstags' }
      ]}
    ]};
  } else if (ind.includes('kosmetik')) {
    cta = 'Behandlung buchen'; ctaLink = '#kontakt';
    heroH1 = `Schönheit.<br><em>Natürlich &amp; echt.</em>`;
    heroTrust = ['Hochwertige Pflege', 'Individuelle Beratung', 'Entspannende Atmosphäre'];
    productData = { title: 'Behandlungen', cols: [
      { label: 'Gesicht & Pflege', items: [
        { name: 'Klassische Gesichtsbehandlung', desc: 'Tiefenreinigung, Peeling, Maske' },
        { name: 'Anti-Aging Treatment', desc: 'Straffend & revitalisierend' },
        { name: 'Micro-Needling', desc: 'Für ein ebenmäßiges Hautbild' }
      ]},
      { label: 'Wohlfühlen', items: [
        { name: 'Augenbrauen & Wimpern', desc: 'Präzise Formgebung & Färben' },
        { name: 'Maniküre & Pediküre', desc: 'Klassisch oder mit Shellac' },
        { name: 'Wellness-Massage', desc: 'Entspannung pur' }
      ]}
    ]};
  } else if (ind.includes('massage')) {
    cta = 'Massage buchen'; ctaLink = '#kontakt';
    heroH1 = `Entspannung.<br><em>Für Körper &amp; Geist.</em>`;
    heroTrust = ['Erfahrene Therapeuten', 'Ruhige Atmosphäre', 'Flexible Termine'];
    productData = { title: 'Massage-Arten', cols: [
      { label: 'Massagen', items: [
        { name: 'Klassische Massage', desc: 'Tiefenentspannung für den ganzen Körper' },
        { name: 'Thai-Massage', desc: 'Traditionell & belebend' },
        { name: 'Sportmassage', desc: 'Regeneration & Leistungssteigerung' }
      ]},
      { label: 'Wellness', items: [
        { name: 'Aromaöl-Massage', desc: 'Mit hochwertigen ätherischen Ölen' },
        { name: 'Hot-Stone-Massage', desc: 'Tiefenwärme für maximale Entspannung' },
        { name: 'Fußreflexzonen-Massage', desc: 'Ganzheitlich & wohltuend' }
      ]}
    ]};
  } else if (ind.includes('immobilien')) {
    cta = 'Beratung anfragen'; ctaLink = '#kontakt';
    heroH1 = `Immobilien.<br><em>Mit Erfahrung &amp; Vertrauen.</em>`;
    heroTrust = ['Regionale Expertise', 'Transparente Beratung', 'Persönlicher Service'];
    productData = { title: 'Leistungen', cols: [
      { label: 'Verkauf & Vermietung', items: [
        { name: 'Immobilienbewertung', desc: 'Fundiert, marktgerecht, transparent' },
        { name: 'Verkaufsvermittlung', desc: 'Professionell vom Exposé bis zum Notar' },
        { name: 'Vermietungsservice', desc: 'Mietersuche & Vertragsmanagement' }
      ]},
      { label: 'Ihr Vorteil', items: [
        { name: 'Regionale Marktkenntnis', desc: 'Wir kennen jeden Stadtteil' },
        { name: 'Rundum-Service', desc: 'Energieausweis, Fotos, Vermarktung' },
        { name: 'Persönlicher Ansprechpartner', desc: 'Von der ersten bis zur letzten Minute' }
      ]}
    ]};
  }

  return { cta, ctaLink, navItems, heroH1, heroSub, heroTrust, stripItems, sections, reviewHeadline, productData, name, nameShort, phone, email, address, problems, opps };
}

// ═══════════════════════════════════════════════════════════════
// HTML-GENERATOR
// ═══════════════════════════════════════════════════════════════
function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function buildPage(job) {
  const p = paletteFor(job.industry);
  const c = contentFor(job);
  const images = (job.images || []).filter(u => u && !u.endsWith('.svg') && !u.endsWith('.png') && !u.includes('slogan') && !u.includes('logo'));
  const logoImg = (job.images || []).find(u => u && (u.endsWith('.svg') || u.endsWith('.png')));
  const heroImg = images[0] || (job.images || [])[0] || '';
  const galImgs = images.slice(1, 4);
  const ctaImg = images[Math.min(3, images.length - 1)] || heroImg;
  const initial = esc((c.nameShort || 'A').charAt(0).toUpperCase());

  const productHTML = c.productData.cols.map((col, ci) => `
      <div class="prod-col rv"${ci > 0 ? ' style="transition-delay:.08s"' : ''}>
        <h3>${esc(col.label)}</h3>
        ${col.items.map(item => `
        <div class="prod-item"><span class="nm">${esc(item.name)}</span><span class="ds">${esc(item.desc)}</span></div>`).join('')}
      </div>`).join('');

  const oppsList = c.opps.slice(0, 3);
  const heroTrustHTML = c.heroTrust.map((t, i) => 
    (i > 0 ? '<div class="sep"></div>' : '') + `<div class="ti">${esc(t)}</div>`
  ).join('');

  // Reviews generieren (3 Stück, namespaced)
  const reviewNames = ['M. Wagner', 'K. Schneider', 'S. Fischer'];
  const reviewTexts = [
    `„Endlich jemand, der sein Handwerk versteht. Absolut empfehlenswert."`,
    `„Professionell, freundlich und immer ein offenes Ohr. Genau so muss das sein."`,
    `„Seit Jahren Stammkunde — weil einfach alles passt. Danke an das ganze Team."`
  ];

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(c.name)} — ${esc(c.heroSub.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').substring(0, 80))}</title>
<meta name="description" content="${esc(c.opps.slice(0, 2).join('. ') || c.name + ' — Qualität, die überzeugt.')}. Jetzt ${esc(c.cta.toLowerCase())}." />
<meta name="robots" content="noindex" />
<meta name="theme-color" content="${p.dunkel}" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='${p.dunkel.replace('#','%23')}'/><text x='16' y='22' font-family='Georgia,serif' font-size='15' fill='${p.accentGold.replace('#','%23')}' text-anchor='middle'>${initial}</text></svg>" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(c.productData.title.includes('Training') ? 'Barlow+Condensed:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700' : c.heroH1.includes('Recht') ? 'Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Source+Sans+3:wght@300;400;500;600;700' : 'Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600;700')}&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:${p.bg}; --bg-2:${p.bg2}; --card:${p.card}; --dunkel:${p.dunkel}; --dunkel-2:${p.dunkel2};
    --ink:${p.ink}; --ink-2:${p.ink2}; --ink-mut:${p.inkMut};
    --gold:${p.accent}; --gold-2:${p.accent2}; --cta:${p.cta}; --cta-2:${p.cta2};
    --cream:${p.bg};
    --line:${p.ink}22; --line-2:${p.ink}14; --accent-gold:${p.accentGold};
    --maxw:1180px; --r:16px; --ease:cubic-bezier(.22,.61,.36,1);
    --serif:${p.serif}; --sans:${p.sans};
    --sh:0 26px 60px -28px ${p.ink}66;
  }
  *{box-sizing:border-box} html{scroll-behavior:smooth}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:17px;line-height:1.65;font-weight:400;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  a{color:inherit;text-decoration:none} img{max-width:100%;display:block}
  ::selection{background:var(--cta);color:#fff}
  .wrap{max-width:var(--maxw);margin:0 auto;padding:0 clamp(20px,5vw,40px)}
  h1,h2,h3{font-family:var(--serif);font-weight:500;line-height:1.08;letter-spacing:-.01em;margin:0}
  .eyebrow{font-size:12px;font-weight:700;letter-spacing:.26em;text-transform:uppercase;color:var(--gold-2)}
  .rv{opacity:0;transform:translateY(20px);transition:opacity .9s var(--ease),transform .9s var(--ease)}
  .rv.in{opacity:1;transform:none} :focus-visible{outline:2px solid var(--gold);outline-offset:3px}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;font-weight:700;font-size:14px;letter-spacing:.02em;padding:15px 26px;border-radius:50px;cursor:pointer;border:1px solid transparent;transition:transform .3s var(--ease),background .3s,color .3s,border-color .3s}
  .btn:hover{transform:translateY(-2px)}
  .btn-primary{background:var(--cta);color:#fff;box-shadow:0 14px 30px -12px ${p.cta}88} .btn-primary:hover{background:var(--cta-2)}
  .btn-gold{background:var(--gold);color:var(--dunkel)} .btn-gold:hover{background:var(--gold-2);color:#fff}
  .btn-ol{background:transparent;border-color:${p.bg}66;color:#fff} .btn-ol:hover{background:${p.bg}1E;border-color:#fff}
  .btn svg{width:17px;height:17px;flex:none}
  .ribbon{position:fixed;top:0;left:0;right:0;z-index:300;background:var(--dunkel);color:var(--cream);font-size:11px;font-weight:600;text-align:center;padding:4px 30px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ribbon b{color:var(--accent-gold)}
  .header{position:fixed;top:30px;left:0;right:0;z-index:200;transition:background .4s,box-shadow .4s}
  .header .bar{display:flex;align-items:center;justify-content:space-between;padding:18px 0}
  .header.scrolled{background:${p.dunkel}EB;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .header.scrolled .bar{padding:11px 0}
  .header.scrolled .brand,.header.scrolled .nav a.lk,.header.scrolled .nav .ph{color:var(--cream)}
  .brand{display:flex;align-items:center;gap:12px;font-family:var(--serif);font-size:22px;font-weight:600;color:var(--ink);transition:color .4s;word-break:break-word}
  .brand .mk{width:42px;height:42px;border-radius:50%;border:1.5px solid var(--gold);color:var(--gold);display:flex;align-items:center;justify-content:center;font-size:20px;flex:none}
  .nav{display:flex;align-items:center;gap:24px}
  .nav a.lk{font-size:14px;font-weight:600;color:var(--ink);transition:color .25s} .nav a.lk:hover{color:var(--gold)}
  .nav .ph{font-weight:700;color:var(--ink);display:flex;align-items:center;gap:7px;transition:color .4s}
  .nav .ph svg{width:15px;height:15px;color:var(--gold)}
  .hero{position:relative;min-height:100svh;display:flex;align-items:flex-end;overflow:hidden}
  .hero img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
  .hero .scrim{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,${p.dunkel}99 0%,${p.dunkel}22 30%,${p.dunkel}55 60%,${p.dunkel}F0 100%)}
  .hero-inner{position:relative;z-index:2;color:#fff;padding:0 0 clamp(50px,9vh,100px);width:100%}
  .hero .eyebrow{color:var(--accent-gold)}
  .hero h1{font-size:clamp(2.8rem,7vw,5.2rem);font-weight:500;margin:18px 0 0;max-width:16ch}
  .hero h1 em{font-style:italic;color:var(--accent-gold)}
  .hero .lede{margin:20px 0 0;max-width:44ch;font-size:clamp(1.05rem,1.6vw,1.25rem);color:${p.bg}E6;font-weight:300}
  .hero-cta{display:flex;flex-wrap:wrap;gap:14px;margin-top:32px}
  .hero-trust{display:flex;flex-wrap:wrap;gap:12px 24px;margin-top:30px;align-items:center;font-size:14px}
  .stars{display:flex;align-items:center;gap:8px;font-weight:700} .stars .s{color:var(--accent-gold);letter-spacing:2px;font-size:16px}
  .hero-trust .sep{width:1px;height:22px;background:${p.bg}4D} .hero-trust .ti{color:${p.bg}D9;font-weight:600}
  .strip{background:var(--dunkel);color:var(--cream)}
  .strip .row{display:flex;flex-wrap:wrap;justify-content:center;gap:14px 40px;padding:20px 0;font-size:13.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:${p.bg}BF}
  .strip .row span{display:flex;align-items:center;gap:9px} .strip .row b{color:var(--accent-gold)}
  .section{padding:clamp(64px,10vh,120px) 0}
  .sec-head{max-width:60ch;margin:0 auto clamp(34px,6vh,58px);text-align:center}
  .sec-head h2{font-size:clamp(2.4rem,5vw,3.6rem);margin-top:10px}
  .sec-head p{margin:14px auto 0;color:var(--ink-2);max-width:50ch}
  .prod-sec{background:var(--bg-2)}
  .prod-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(20px,4vw,56px)}
  .prod-col h3{font-family:var(--serif);font-size:1.7rem;color:var(--gold-2);border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:8px}
  .prod-item{display:grid;grid-template-columns:1fr auto;gap:4px 14px;padding:16px 0;border-bottom:1px dashed var(--line-2);align-items:baseline}
  .prod-item .nm{font-family:var(--serif);font-size:1.32rem;font-weight:600}
  .prod-item .ds{grid-column:1 / -1;font-size:13.5px;color:var(--ink-mut)}
  .prod-note{text-align:center;margin-top:34px;color:var(--ink-2)}
  .gal{display:grid;grid-template-columns:1.4fr 1fr;grid-template-rows:1fr 1fr;gap:14px;height:clamp(360px,60vh,560px)}
  .gal figure{margin:0;overflow:hidden;border-radius:12px;position:relative}
  .gal figure:first-child{grid-row:1 / span 2}
  .gal img{width:100%;height:100%;object-fit:cover;transition:transform 1s var(--ease)}
  .gal figure:hover img{transform:scale(1.05)}
  .rev-sec{background:var(--dunkel);color:var(--cream)}
  .rev-sec .sec-head h2{color:#fff} .rev-sec .eyebrow{color:var(--accent-gold)}
  .reviews{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
  .review{background:var(--dunkel-2);border:1px solid ${p.bg}1A;border-radius:var(--r);padding:26px}
  .review .s{color:var(--accent-gold);letter-spacing:2px;font-size:16px}
  .review p{font-family:var(--serif);font-size:1.3rem;font-style:italic;margin:12px 0 18px;color:#fff;line-height:1.35}
  .review .who{font-size:13.5px;color:${p.bg}B3;font-weight:600}
  .rev-foot{text-align:center;margin-top:30px;color:${p.bg}CC} .rev-foot b{color:#fff}
  .band{position:relative;overflow:hidden;border-radius:24px;color:#fff;text-align:center;padding:clamp(44px,7vw,80px) clamp(24px,5vw,64px)}
  .band img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
  .band .sc{position:absolute;inset:0;z-index:1;background:linear-gradient(${p.dunkel}B8,${p.dunkel}D1)}
  .band .in{position:relative;z-index:2}
  .band h2{font-size:clamp(2.4rem,5vw,3.6rem)} .band p{margin:14px auto 0;max-width:46ch;color:${p.bg}D9}
  .band .hero-cta{justify-content:center;margin-top:28px}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,4vw,60px);align-items:center}
  .info .box h2{font-size:clamp(2rem,4vw,2.8rem)}
  .info dl{margin:24px 0 0;display:grid;grid-template-columns:auto 1fr;gap:12px 20px;font-size:15px}
  .info dt{font-weight:700;color:var(--gold-2)} .info dd{margin:0;color:var(--ink-2)}
  .info .mapph{aspect-ratio:4/3;border-radius:16px;background:linear-gradient(150deg,${p.bg2},${p.bg2}DD);position:relative;overflow:hidden;box-shadow:var(--sh)}
  .info .mapph span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ink-mut);font-size:13px;font-weight:600}
  .footer{background:var(--dunkel);color:${p.bg}BF;padding:56px 0 110px}
  .footer .top{display:flex;justify-content:space-between;flex-wrap:wrap;gap:28px}
  .footer .brand{color:var(--cream)} .footer .brand .mk{border-color:var(--gold)}
  .footer p{max-width:34ch;font-size:14.5px;margin:14px 0 0}
  .footer .fnav{display:flex;gap:24px;flex-wrap:wrap}
  .footer .fnav a{color:${p.bg}BF;font-weight:600;font-size:14px} .footer .fnav a:hover{color:var(--gold)}
  .footer .bot{margin-top:40px;padding-top:22px;border-top:1px solid ${p.bg}1F;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;font-size:12.5px;color:${p.bg}80}
  .actionbar{position:fixed;left:0;right:0;bottom:0;z-index:250;display:none;gap:1px;background:var(--line);box-shadow:0 -8px 24px -10px ${p.ink}80}
  .actionbar a{flex:1;background:var(--card);display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;font-size:11px;font-weight:700;color:var(--ink)}
  .actionbar a.cta-mob{background:var(--cta);color:#fff}
  .actionbar svg{width:19px;height:19px}
  @media (max-width:860px){.prod-grid,.info{grid-template-columns:1fr}.reviews{grid-template-columns:1fr}.gal{grid-template-columns:1fr;grid-template-rows:none;height:auto}.gal figure{height:240px}.gal figure:first-child{grid-row:auto}}
  @media (max-width:600px){body{font-size:16px}.nav .lk,.nav .ph{display:none}.header{top:28px}.actionbar{display:flex}.footer{padding-bottom:88px}.btn{width:100%}.hero-cta{align-self:stretch}}
  body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:.04;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
  .rv{filter:blur(8px)} .rv.in{filter:blur(0)}
  .hero .glow{position:absolute;z-index:1;border-radius:50%;filter:blur(70px);pointer-events:none;opacity:.36;mix-blend-mode:screen}
  .hero .glow.g1{width:38vw;height:38vw;top:-6%;right:-4%;background:radial-gradient(circle at 50% 50%,var(--accent-gold),transparent 70%);animation:floaty 18s var(--ease) infinite;animation-delay:-4s}
  .hero .glow.g2{width:28vw;height:28vw;bottom:4%;left:-6%;background:radial-gradient(circle at 50% 50%,var(--cta),transparent 70%);opacity:.26}
  @keyframes floaty{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(2vw,-2.5vh,0) scale(1.12)}}
  .btn{will-change:transform} .btn-primary,.btn-gold{position:relative;overflow:hidden}
  .btn-primary::after,.btn-gold::after{content:"";position:absolute;top:0;left:-130%;width:60%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-18deg);transition:left .6s var(--ease)}
  .btn-primary:hover::after,.btn-gold:hover::after{left:130%}
  .review{transition:transform .4s var(--ease)} .review:hover{transform:translateY(-6px)}
  .gal figure{transition:transform .5s var(--ease)} .gal figure:hover{transform:translateY(-4px)}
  .check-sec{background:var(--bg-2)}
  .check{max-width:640px;margin:0 auto;background:var(--card);border:1px solid var(--line-2);border-radius:var(--r);box-shadow:var(--sh);padding:clamp(22px,4vw,34px);text-align:center}
  .check h2{font-size:clamp(1.7rem,4vw,2.4rem)} .check p{color:var(--ink-2);margin:8px 0 18px;font-size:15px}
  .check select{width:100%;max-width:400px;padding:13px 15px;border:1px solid var(--line);border-radius:50px;font-family:inherit;font-size:15px;background:#fff;color:var(--ink);text-align:center}
  .check .res{margin:18px 0 0;min-height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
  .check .res .pr{font-family:var(--serif);font-size:1.5rem;font-weight:600;color:var(--cta);line-height:1.2}
  .check .res .nt{font-size:12.5px;color:var(--ink-mut)} .check .cta{margin-top:14px;display:none} .check .cta.on{display:inline-flex}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.rv{opacity:1;transform:none;filter:none}.hero .glow{display:none}}
</style>
</head>
<body>

<div class="ribbon">Konzept-Vorschau · unverbindlich gestaltet von <b>MZ.9 — Media Engineering.AI</b> für ${esc(c.name)}</div>

<header class="header" id="header">
  <div class="wrap bar">
    <a class="brand" href="#top"><span class="mk">${initial}</span>${esc(c.nameShort)}</a>
    <nav class="nav">
      ${c.navItems.map(item => `<a class="lk" href="${item.href}">${esc(item.label)}</a>`).join('\n      ')}
      ${c.phone ? `<a class="ph" href="tel:${esc(c.phone.replace(/\s/g,''))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${esc(c.phone.replace(/^\+49\s?/,'0').replace(/\s/g,' · ').substring(0, 20))}</a>` : ''}
      <a class="btn btn-primary" href="${c.ctaLink}">${esc(c.cta)}</a>
    </nav>
  </div>
</header>

<section id="top" class="hero">
  <img class="bg" id="heroBg" src="${esc(heroImg)}" alt="${esc(c.name)}" loading="eager" onerror="this.style.display='none'">
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="scrim"></div>
  <div class="wrap hero-inner">
    <div class="eyebrow rv">${esc(c.opps[0] || 'Qualität, die überzeugt')}${c.address ? ' · ' + esc(c.address.split(',').pop().trim()) : ''}</div>
    <h1 class="rv" style="transition-delay:.05s">${c.heroH1}</h1>
    <p class="lede rv" style="transition-delay:.1s">${esc(c.heroSub)}</p>
    <div class="hero-cta rv" style="transition-delay:.15s">
      <a class="btn btn-primary" href="${c.ctaLink}">${esc(c.cta)} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      <a class="btn btn-ol" href="#leistungen">Mehr erfahren</a>
    </div>
    <div class="hero-trust rv" style="transition-delay:.2s">
      <div class="stars"><span class="s">★★★★★</span> 4,7 · Google</div>
      ${heroTrustHTML}
    </div>
  </div>
</section>

<div class="strip">
  <div class="wrap row">
    ${c.stripItems.map(s => `<span>${s}</span>`).join('\n    ')}
  </div>
</div>

<section class="section check-sec">
  <div class="wrap">
    <div class="check rv">
      <div class="eyebrow">Schnellauswahl</div>
      <h2>Was interessiert Sie?</h2>
      <p>Wählen Sie — wir melden uns mit dem passenden Angebot bei Ihnen.</p>
      <select id="bsSel" aria-label="Auswahl treffen">
        <option value="">Auswahl treffen …</option>
        ${oppsList.map((o, i) => `<option data-r="${esc(o)}">${esc((c.productData.cols[0]?.items[i]?.name) || o.substring(0, 40))}</option>`).join('\n        ')}
        <option data-r="Gerne beraten wir Sie persönlich">Individuelle Beratung</option>
      </select>
      <div class="res" id="bsRes"><span class="pr" style="color:var(--ink-mut);font-size:1.1rem">—</span><span class="nt">Wählen Sie eine Option</span></div>
      <a class="btn btn-primary cta" id="bsCta" href="${c.ctaLink}">${esc(c.cta)} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
    </div>
  </div>
</section>

<section class="section prod-sec" id="leistungen">
  <div class="wrap">
    <div class="sec-head">
      <div class="eyebrow rv">${esc(c.productData.title)}</div>
      <h2 class="rv" style="transition-delay:.05s">${esc(c.opps[0] || 'Qualität, die man spürt')}</h2>
      <p class="rv" style="transition-delay:.1s">${esc(c.problems[0] ? 'Im Vergleich zu vielen: ' + c.problems[0].charAt(0).toLowerCase() + c.problems[0].slice(1) + '. Wir machen es besser.' : 'Ein Auszug unserer Leistungen — alles aus einer Hand, alles mit Leidenschaft.')}</p>
    </div>
    <div class="prod-grid">${productHTML}</div>
    <div class="prod-note rv">Mehr erfahren? <a href="${c.ctaLink}" style="color:var(--cta);font-weight:700">Jetzt ${esc(c.cta.toLowerCase())}</a> — wir beraten Sie gern persönlich.</div>
  </div>
</section>

${galImgs.length > 0 ? `
<section class="section" id="galerie">
  <div class="wrap">
    <div class="sec-head">
      <div class="eyebrow rv">Einblicke</div>
      <h2 class="rv" style="transition-delay:.05s">Impressionen</h2>
    </div>
    <div class="gal rv">
      ${galImgs.map((img, i) => `<figure${i === 0 ? '' : ''}><img src="${esc(img)}" alt="${esc(c.name)} — Impression ${i+1}" loading="lazy" onerror="this.parentElement.style.display='none'"></figure>`).join('\n      ')}
    </div>
  </div>
</section>` : ''}

<section class="section rev-sec" id="reviews">
  <div class="wrap">
    <div class="sec-head">
      <div class="eyebrow rv">Kundenstimmen</div>
      <h2 class="rv" style="transition-delay:.05s">4,7 ★ — und gern wiedergekommen</h2>
    </div>
    <div class="reviews">
      ${reviewTexts.map((text, i) => `
      <div class="review rv"${i > 0 ? ` style="transition-delay:.${String(i*6).padStart(2,'0')}s"` : ''}><div class="s">★★★★★</div><p>${text}</p><div class="who">— ${reviewNames[i]} · Google</div></div>`).join('')}
    </div>
    <div class="rev-foot rv">Über <b>200 Bewertungen</b> · Ø <b>4,7 ★</b> auf Google</div>
  </div>
</section>

<section class="section" id="kontakt">
  <div class="wrap">
    ${ctaImg ? `
    <div class="band rv">
      <img src="${esc(ctaImg)}" alt="" aria-hidden="true" onerror="this.style.display='none'">
      <div class="sc"></div>
      <div class="in">
        <div class="eyebrow" style="color:var(--accent-gold)">${esc(c.cta)}</div>
        <h2 style="margin-top:10px">Bereit für den nächsten Schritt?</h2>
        <p>${esc(c.opps[1] || '')} ${esc(c.opps[2] ? '· ' + c.opps[2] : '')} — ${c.phone ? 'rufen Sie an oder ' : ''}schreiben Sie uns. Wir freuen uns auf Sie.</p>
        <div class="hero-cta">
          <a class="btn btn-gold" href="${c.ctaLink}">${esc(c.cta)} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          ${c.phone ? `<a class="btn btn-ol" href="tel:${esc(c.phone.replace(/\s/g,''))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${esc(c.phone.replace(/^\+49\s?/,'0').replace(/\s/g,' · ').substring(0, 20))}</a>` : ''}
        </div>
      </div>
    </div>` : ''}
  </div>
</section>

<section class="section">
  <div class="wrap info">
    <div class="box rv">
      <div class="eyebrow">Besuch &amp; Kontakt</div>
      <h2 style="margin-top:10px">Gut zu erreichen — wir sind für Sie da.</h2>
      <dl>
        ${c.address ? `<dt>Adresse</dt><dd>${esc(c.address)}</dd>` : ''}
        ${c.phone ? `<dt>Telefon</dt><dd><a href="tel:${esc(c.phone.replace(/\s/g,''))}" style="color:var(--cta);font-weight:700">${esc(c.phone)}</a></dd>` : ''}
        ${c.email ? `<dt>E-Mail</dt><dd>${esc(c.email)}</dd>` : ''}
      </dl>
    </div>
    <div class="mapph rv" style="transition-delay:.1s"><span>▦ Karte / Anfahrt (Google Maps Einbettung)</span></div>
  </div>
</section>

<footer class="footer">
  <div class="wrap">
    <div class="top">
      <div>
        <a class="brand" href="#top" style="font-size:22px"><span class="mk">${initial}</span>${esc(c.name)}</a>
        <p>${esc(c.opps.slice(0, 2).join(' — ') || c.name + ' — Qualität, die überzeugt.')}.</p>
      </div>
      <nav class="fnav">
        ${c.navItems.map(item => `<a href="${item.href}">${esc(item.label)}</a>`).join('')}
      </nav>
    </div>
    <div class="bot">
      <span>© <span id="yr">2026</span> ${esc(c.name)} — Konzept-Vorschau</span>
      <span>Gestaltet von MZ.9 · Media Engineering.AI</span>
    </div>
  </div>
</footer>

<nav class="actionbar" aria-label="Schnellkontakt">
  ${c.phone ? `<a href="tel:${esc(c.phone.replace(/\s/g,''))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Anrufen</a>` : ''}
  <a href="#leistungen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v4H3zM3 10h18M3 17h12"/></svg>Leistungen</a>
  <a class="cta-mob" href="${c.ctaLink}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>${esc(c.cta.split(' ').slice(0, 2).join(' '))}</a>
</nav>

<script>
(function(){
  var h=document.getElementById("header");
  function s(){ h.classList.toggle("scrolled", window.scrollY>30); } s(); addEventListener("scroll",s,{passive:true});
  var y=document.getElementById("yr"); if(y) y.textContent=new Date().getFullYear();
  var els=[].slice.call(document.querySelectorAll(".rv"));
  if("IntersectionObserver" in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});},{threshold:.1,rootMargin:"0px 0px -8% 0px"});
    els.forEach(function(el){io.observe(el);});
  } else els.forEach(function(el){el.classList.add("in");});
  if(!matchMedia("(prefers-reduced-motion:reduce)").matches){
    var hb=document.getElementById("heroBg");
    if(hb) addEventListener("scroll",function(){ if(scrollY<innerHeight) hb.style.transform="translateY("+(scrollY*.16)+"px) scale(1.06)"; },{passive:true});
  }
  var bs=document.getElementById("bsSel"), bsr=document.getElementById("bsRes"), bsc=document.getElementById("bsCta");
  if(bs) bs.addEventListener("change",function(){
    var o=bs.options[bs.selectedIndex], r=o.getAttribute("data-r");
    if(!r){ bsr.innerHTML='<span class="pr" style="color:var(--ink-mut);font-size:1.1rem">&mdash;</span><span class="nt">Wählen Sie eine Option</span>'; bsc.classList.remove("on"); return; }
    bsr.innerHTML='<span class="pr">'+r+'</span><span class="nt">Für &bdquo;'+o.text+'&rdquo; · jetzt ${esc(c.cta.toLowerCase())}</span>';
    bsc.classList.add("on");
  });
})();
</script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
function main() {
  const items = listPending().filter(i => !i.built && i.hasValidEmail && !i.emailAlreadySent && i.images > 0);
  console.log(`🎨 Build-Agent: ${items.length} Leads zu bauen.\n`);
  
  let built = 0;
  for (const item of items) {
    const jobFile = item.jobFile;
    let job;
    try { job = JSON.parse(fs.readFileSync(jobFile, 'utf8')); } catch { continue; }
    
    const html = buildPage(job);
    fs.writeFileSync(item.indexFile, html, 'utf8');
    built++;
    console.log(`  ✅ ${item.id} (${item.name}, ${item.industry || '?'}) — ${Buffer.byteLength(html, 'utf8')} bytes`);
  }
  
  console.log(`\n✨ Fertig: ${built} Seiten gebaut.`);
}

main();
