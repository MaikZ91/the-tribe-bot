/**
 * MZ.9 Lead Agent — Vollautonome Pipeline
 *
 * Macht ALLES: Discovery → Evaluation → Preview-Build → Dashboard → Deploy
 * Läuft via GitHub Actions oder lokal. Kein manueller Eingriff nötig.
 *
 * Nutzung:
 *   node lead_agent_deepseek/scripts/pipeline.js
 *
 * Umgebung:
 *   DISCOVER=true        — Neue Leads suchen (DuckDuckGo Scraping)
 *   MAX_LEADS=3          — Max Leads pro Run (default: 3)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─── Konfiguration ────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(ROOT, '..');
const QUEUE_FILE = path.join(ROOT, 'queue.json');
const TEMPLATE_FILE = path.join(ROOT, 'templates', 'preview.html');
const DASHBOARD_FILE = path.join(REPO_ROOT, 'docs', 'leads', 'dashboard', 'index.html');
const PREVIEW_DIR = path.join(REPO_ROOT, 'docs', 'leads');
const LEADS_DIR = path.join(ROOT, 'leads');
const DISCOVERIES_DIR = path.join(ROOT, 'discoveries');

const MAX_LEADS = parseInt(process.env.MAX_LEADS || '3', 10);
const DO_DISCOVER = process.env.DISCOVER === 'true';

// Branchen + Suchbegriffe für Bielefeld
const SEARCH_TERMS = [
  'Friseur Bielefeld',
  'Zahnarzt Bielefeld',  
  'Steuerberater Bielefeld',
  'Rechtsanwalt Bielefeld',
  'Physiotherapie Bielefeld',
  'Maler Bielefeld',
  'Dachdecker Bielefeld',
  'Elektriker Bielefeld',
  'Tischler Bielefeld',
  'Bäcker Bielefeld',
  'Fotograf Bielefeld',
  'Goldschmied Bielefeld',
  'Kosmetikstudio Bielefeld',
  'Massage Bielefeld',
  'Hundesalon Bielefeld',
];

const COLORS = {
  gastronomie:  { accent: '#c2410c', dark: '#7c2d12', light: '#fdba74' },
  handwerk:     { accent: '#b45309', dark: '#78350f', light: '#fcd34d' },
  einzelhandel: { accent: '#0d9488', dark: '#134e4a', light: '#5eead4' },
  dienstleistung:{ accent: '#2563eb', dark: '#1e3a5f', light: '#93c5fd' },
  friseur:      { accent: '#c77e6e', dark: '#a85f4f', light: '#d9a89b' },
  physio:       { accent: '#0d9488', dark: '#0f766e', light: '#5eead4' },
  kanzlei:      { accent: '#b8860b', dark: '#7c5e10', light: '#fde047' },
  zahnarzt:     { accent: '#0891b2', dark: '#155e75', light: '#67e8f9' },
  fitness:      { accent: '#65a30d', dark: '#3f6212', light: '#bef264' },
  optiker:      { accent: '#1d4ed8', dark: '#1e3a5f', light: '#93c5fd' },
  immobilien:   { accent: '#7c3aed', dark: '#4c1d95', light: '#c4b5fd' },
  automotive:   { accent: '#dc2626', dark: '#991b1b', light: '#fca5a5' },
  florist:      { accent: '#db2777', dark: '#9d174d', light: '#f9a8d4' },
  kosmetik:     { accent: '#e11d48', dark: '#9f1239', light: '#fda4af' },
  fotografie:   { accent: '#4f46e5', dark: '#3730a3', light: '#a5b4fc' },
  default:      { accent: '#6366f1', dark: '#3730a3', light: '#a5b4fc' },
};

// ─── Hilfen ───────────────────────────────────────────────────────
function ts() { return new Date().toISOString().slice(11, 19); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }
function loadJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function saveJson(f, d) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(d, null, 2)); }
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

// ─── Phase 1: Discovery ───────────────────────────────────────────
async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 15000, headers: { 'User-Agent': 'MZ9-LeadAgent/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => { data += c; if (data.length > 200000) res.destroy(); });
      res.on('end', () => resolve({ status: res.statusCode, html: data.slice(0, 100000), url }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function evaluateWebsite(html, url) {
  let score = 100;
  const problems = [];
  const opps = [];

  if (!url.startsWith('https')) { score -= 20; problems.push('Kein HTTPS'); opps.push('SSL/HTTPS einrichten'); }
  if (!html.includes('viewport')) { score -= 15; problems.push('Nicht mobil-optimiert'); opps.push('Responsive Design'); }
  if (!/<form/i.test(html)) { score -= 10; problems.push('Kein Kontaktformular'); opps.push('Kontaktformular integrieren'); }
  if (!/schema\.org|json-ld|application\/ld\+json/i.test(html)) { score -= 5; problems.push('Keine strukturierten Daten'); opps.push('Schema.org Markup'); }
  if ((html.match(/<img/gi) || []).length < 2) { score -= 5; problems.push('Wenig Bilder'); opps.push('Bildergalerie aufbauen'); }
  if (html.includes('IONOS MyWebsite') || html.includes('website-start.de')) { score -= 10; problems.push('Veralteter Website-Baukasten'); opps.push('Moderne Website-Plattform'); }
  if ((html.match(/style="[^"]*font-size:[^"]*px/gi) || []).length > 3) { score -= 5; problems.push('Inline-Styles (schlecht wartbar)'); opps.push('CSS-basiertes Styling'); }
  if (/copyright.*(?:20[0-1]\d|20[0-2][0-9])/i.test(html) && !/202[3-9]/i.test(html)) { score -= 5; problems.push('Copyright-Jahr veraltet'); opps.push('Aktualisieren'); }

  return { score: Math.max(0, Math.round(score * 0.7 + 30)), problems: problems.slice(0, 4), opps: opps.slice(0, 4) };
}

function extractContact(html) {
  const email = (html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [])[0] || '';
  const phone = (html.match(/(?:\+49\s?)?(?:05[0-9]{2,3}\s?[\/\-\s]?\s?[0-9]{2,8})/) || [])[0] || '';
  const street = (html.match(/(?:Straße|str\.|Str\.|strasse)\s+\d+/i) || [])[0] || '';
  return { email, phone, street };
}

function extractMeta(html) {
  const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '';
  const desc = (html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) || [])[1] || '';
  return { title, desc };
}

function guessIndustry(title, url) {
  const t = (title + ' ' + url).toLowerCase();
  if (/friseur|hair|salon/i.test(t)) return 'Friseur';
  if (/zahnarzt|zahn/i.test(t)) return 'Zahnarzt';
  if (/steuerberat|lohnbuch|kanzlei/i.test(t)) return 'Kanzlei';
  if (/recht/i.test(t)) return 'Kanzlei';
  if (/physio|therapie/i.test(t)) return 'Physiotherapie';
  if (/maler|lackier/i.test(t)) return 'Handwerk';
  if (/dachdeck/i.test(t)) return 'Handwerk';
  if (/elektro/i.test(t)) return 'Handwerk';
  if (/tischler|schreiner/i.test(t)) return 'Handwerk';
  if (/bäck|bäcker|konditor/i.test(t)) return 'Gastronomie';
  if (/fotograf/i.test(t)) return 'Dienstleistung';
  if (/goldschmied|juwel/i.test(t)) return 'Einzelhandel';
  if (/kosmetik/i.test(t)) return 'Kosmetik';
  if (/massage/i.test(t)) return 'Dienstleistung';
  if (/hund/i.test(t)) return 'Dienstleistung';
  if (/restaurant|café|cafe|imbiss/i.test(t)) return 'Gastronomie';
  if (/auto|kfz|werkstatt|reifen/i.test(t)) return 'Automotive';
  if (/blumen|florist/i.test(t)) return 'Florist';
  if (/immobilien/i.test(t)) return 'Immobilien';
  if (/bau|bauunternehmen/i.test(t)) return 'Handwerk';
  if (/sanitär|heizung|installateur/i.test(t)) return 'Handwerk';
  return 'Dienstleistung';
}

async function discoverBatch(term) {
  log(`🔍 Suche: "${term}"`);
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(term)}+website`;
  try {
    const { html } = await fetchUrl(url);
    const links = [...html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi)];
    const results = [];
    const seen = new Set();
    for (const [, link, text] of links) {
      if (seen.has(link) || link.includes('duckduckgo') || link.includes('google.') || link.includes('facebook') || link.includes('instagram')) continue;
      seen.add(link);
      const domain = new URL(link).hostname.replace('www.', '');
      if (domain.split('.').length > 3) continue; // Skip subdomains
      results.push({ url: link, name: text.replace(/<\/?[^>]+>/g, '').trim(), domain });
      if (results.length >= 5) break;
    }
    return results;
  } catch (e) {
    log(`  ⚠️  Suche fehlgeschlagen: ${e.message}`);
    return [];
  }
}

// ─── Phase 2: Evaluate & Build ────────────────────────────────────
function buildLeadData(result, evalResult, contact, meta) {
  const name = meta.title?.split(/[–\-\|]/)[0]?.trim() || result.name || result.domain;
  const industry = guessIndustry(meta.title, result.url);
  const id = result.domain.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 50);

  return {
    id,
    name,
    nameShort: name.split(' ').slice(0, 2).join(' '),
    industry,
    hebel: evalResult.score < 45 ? 'hoch' : evalResult.score < 60 ? 'mittel' : 'niedrig',
    website: result.url,
    phone: contact.phone || `+495210000000`,
    email: contact.email || `info@${result.domain}`,
    score: evalResult.score,
    problems: evalResult.problems,
    opps: evalResult.opps,
    heroH1: `${name.split(' ').pop()}.<br><em>${industry} in Bielefeld.</em>`,
    heroSub: meta.desc || `${industry} mit Qualität und Erfahrung — direkt in Bielefeld.`,
    ctaText: 'Jetzt anfragen',
    ctaHref: '#kontakt',
    features: [evalResult.opps[0] || 'Professionell', evalResult.opps[1] || 'Zuverlässig', evalResult.opps[2] || 'Erfahren'],
  };
}

function buildPreview(lead) {
  if (!fs.existsSync(TEMPLATE_FILE)) {
    log('❌ Template fehlt. Verwende Fallback.');
    return buildFallbackPreview(lead);
  }
  let html = fs.readFileSync(TEMPLATE_FILE, 'utf8');
  const c = COLORS[(lead.industry || 'default').toLowerCase()] || COLORS.default;
  const esc = s => (s || '').replace(/#/g, '%23');

  const r = {
    '{{NAME}}': lead.name,
    '{{NAME_SHORT}}': lead.nameShort || lead.name,
    '{{INITIAL}}': (lead.name || '?')[0].toUpperCase(),
    '{{INDUSTRY}}': lead.industry || 'Unternehmen',
    '{{ACCENT}}': c.accent, '{{ACCENT_DARK}}': c.dark, '{{ACCENT_LIGHT}}': c.light,
    '{{ACCENT_DARK_ENC}}': esc(c.dark), '{{ACCENT_ENC}}': esc(c.accent),
    '{{HERO_H1}}': lead.heroH1 || `${lead.name}<br><em>${lead.industry} Bielefeld</em>`,
    '{{HERO_SUB}}': lead.heroSub || `${lead.industry} — Qualität und Erfahrung in Bielefeld.`,
    '{{CTA_TEXT}}': lead.ctaText || 'Jetzt anfragen',
    '{{CTA_HREF}}': lead.ctaHref || '#kontakt',
    '{{SECONDARY_CTA}}': 'Mehr erfahren',
    '{{STRIP_ITEMS}}': `<span>✦ ${lead.industry}</span><span>✦ Bielefeld</span><span>✦ Persönlich</span><span>✦ Qualität</span>`,
    '{{LEISTUNGEN_EYEBROW}}': 'Leistungen',
    '{{LEISTUNGEN_H2}}': 'Das bieten wir',
    '{{LEISTUNGEN_SUB}}': 'Professionell, persönlich, für Sie in Bielefeld.',
    '{{FEATURE_CARDS}}': (lead.features || ['Leistung 1', 'Leistung 2', 'Leistung 3']).map((f, i) => `<div class="fcard rv"${i ? ` style="transition-delay:.${i*6}s"` : ''}><div class="ic">✦</div><h3>${f}</h3><p>Professionell und zuverlässig — seit Jahren in Bielefeld.</p></div>`).join(''),
    '{{REVIEW_CARDS}}': ['"Super, sehr zu empfehlen."', '"Professionell und freundlich."', '"Gerne wieder."'].map(t => `<div class="review rv"><div class="s">★★★★★</div><p>${t}</p><div class="who">— Google Bewertung</div></div>`).join(''),
    '{{REVIEW_FOOTNOTE}}': 'Echte Google-Bewertungen einbinden — Vertrauen schaffen.',
    '{{CTA_BAND_EYEBROW}}': 'Jetzt Kontakt aufnehmen',
    '{{CTA_BAND_H2}}': 'Bereit für den nächsten Schritt?',
    '{{CTA_BAND_SUB}}': 'Unverbindlich anfragen — wir melden uns zeitnah.',
    '{{INFO_H2}}': 'So erreichen Sie uns.',
    '{{CONTACT_DL}}': `<dt>Ort</dt><dd>Bielefeld</dd><dt>Telefon</dt><dd>${lead.phone || '—'}</dd><dt>E-Mail</dt><dd>${lead.email || '—'}</dd>`,
    '{{PHONE}}': lead.phone || '',
    '{{NAV_LINKS}}': '<a class="lk" href="#leistungen">Leistungen</a><a class="lk" href="#reviews">Bewertungen</a><a class="lk" href="#info">Kontakt</a>',
    '{{FOOTER_DESC}}': `${lead.industry} in Bielefeld — Qualität, auf die Sie zählen können.`,
    '{{FOOTER_NAV}}': '<a href="#leistungen">Leistungen</a><a href="#reviews">Bewertungen</a><a href="#info">Kontakt</a>',
    '{{MOBILE_CTA_SHORT}}': 'Anfragen',
    '{{META_DESC}}': `${lead.name} — ${lead.industry} Bielefeld. Konzept-Vorschau MZ.9.`,
    '{{TRUST_STRIP}}': `<div class="stars"><span class="s">✦✦✦✦✦</span> ${lead.industry} Bielefeld</div>`,
  };

  for (const [k, v] of Object.entries(r)) html = html.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), String(v));

  const dir = path.join(PREVIEW_DIR, lead.id);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  log(`  📄 Preview: ${lead.id}`);
  return `https://maikz91.github.io/the-tribe-bot/leads/${lead.id}/`;
}

function buildFallbackPreview(lead) {
  // Minimal preview wenn Template fehlt
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${lead.name} | ${lead.industry} Bielefeld</title><meta name="robots" content="noindex"><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#222;background:#f9f9f9}h1{font-size:2rem}em{color:#2563eb}.btn{display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:700}</style></head><body><h1>${lead.name}<br><em>${lead.industry} in Bielefeld</em></h1><p>${lead.heroSub}</p><a class="btn" href="tel:${lead.phone}">Jetzt anrufen</a><p style="margin-top:40px;color:#999;font-size:.85rem">Konzept-Vorschau von MZ.9 · Media Engineering.AI</p></body></html>`;
  const dir = path.join(PREVIEW_DIR, lead.id);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  return `https://maikz91.github.io/the-tribe-bot/leads/${lead.id}/`;
}

function updateDashboard(lead, previewUrl) {
  if (!fs.existsSync(DASHBOARD_FILE)) return false;
  let h = fs.readFileSync(DASHBOARD_FILE, 'utf8');
  if (h.includes(`id:"${lead.id}"`)) { log('  ℹ️  Bereits im Dashboard.'); return true; }

  const seedStart = h.indexOf('var SEED=[');
  const seedEnd = h.indexOf('];', seedStart);
  const entry = `\n    {id:"${lead.id}",name:"${lead.name}",industry:"${lead.industry}",hebel:"${lead.hebel}",score:${lead.score},website:"${lead.website}",problems:${JSON.stringify(lead.problems || [])},opps:${JSON.stringify(lead.opps || [])},preview:"${previewUrl}"},`;
  h = h.slice(0, seedEnd) + entry + h.slice(seedEnd);

  if (lead.email) {
    const mailStart = h.indexOf('var EMAILS={');
    const mailEnd = h.indexOf('};', mailStart);
    if (!h.includes(`"${lead.id}":`)) {
      h = h.slice(0, mailEnd) + `\n    "${lead.id}":"${lead.email}",` + h.slice(mailEnd);
    }
  }

  fs.writeFileSync(DASHBOARD_FILE, h);
  log('  📊 Dashboard aktualisiert.');
  return true;
}

function gitPush(lead) {
  try {
    const cwd = REPO_ROOT;
    execSync('git config user.name "MZ.9 Lead Agent"', { cwd, stdio: 'pipe' });
    execSync('git config user.email "lead-agent@mz9.dev"', { cwd, stdio: 'pipe' });
    execSync('git add docs/leads/ lead_agent_deepseek/', { cwd, stdio: 'pipe' });
    const diff = execSync('git diff --cached --stat', { cwd, stdio: 'pipe', encoding: 'utf8' });
    if (!diff.trim()) { log('  📭 Keine Änderungen.'); return; }
    execSync(`git commit -m "lead-agent: ${lead.id} — ${lead.name}"`, { cwd, stdio: 'pipe' });
    execSync('git push', { cwd, stdio: 'pipe' });
    log(`  🚀 Gepusht: ${lead.name}`);
  } catch (err) {
    log(`  ⚠️  Git: ${err.message}`);
  }
}

// ─── Main Pipeline ────────────────────────────────────────────────
async function run() {
  log('═══ MZ.9 Lead Agent — Autonome Pipeline ═══');
  log(`Konfiguration: MAX_LEADS=${MAX_LEADS} DISCOVER=${DO_DISCOVER}`);

  let leads = [];

  if (DO_DISCOVER) {
    // Discovery: Suche nach neuen Leads
    log('\n📡 Phase 1: Discovery');
    const term = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
    const results = await discoverBatch(term);
    log(`  ${results.length} Ergebnisse gefunden.`);

    // Evaluate
    log('\n🔍 Phase 2: Evaluation');
    for (const r of results) {
      try {
        log(`  Prüfe: ${r.url}`);
        const { html } = await fetchUrl(r.url);
        if (!html) continue;
        const evalResult = evaluateWebsite(html, r.url);
        const contact = extractContact(html);
        const meta = extractMeta(html);
        const lead = buildLeadData(r, evalResult, contact, meta);
        log(`    Score: ${lead.score} | ${lead.industry} | ${lead.hebel}`);
        leads.push(lead);
      } catch (e) {
        log(`    ⚠️  ${e.message}`);
      }
    }

    // Sort by score ascending (worst first)
    leads.sort((a, b) => a.score - b.score);
    leads = leads.slice(0, MAX_LEADS);

    // Save discovery batch
    if (leads.length > 0) {
      const batchFile = path.join(DISCOVERIES_DIR, `batch-${Date.now()}.json`);
      saveJson(batchFile, leads);
      log(`\n💾 Batch gespeichert: ${batchFile}`);
    }
  } else {
    // Load from queue or existing discoveries
    log('\n📋 Lade aus Queue/Discoveries...');
    const queue = loadJson(QUEUE_FILE);
    if (queue?.leads?.length) {
      leads = queue.leads.splice(0, MAX_LEADS);
      if (!queue.processed) queue.processed = [];
      queue.processed.push(...leads.map(l => ({ id: l.id, at: new Date().toISOString() })));
      saveJson(QUEUE_FILE, queue);
    } else {
      // Try discovery files
      ensureDir(DISCOVERIES_DIR);
      const files = fs.readdirSync(DISCOVERIES_DIR).filter(f => f.endsWith('.json')).sort();
      if (files.length > 0) {
        const batch = loadJson(path.join(DISCOVERIES_DIR, files[0]));
        if (Array.isArray(batch) && batch.length > 0) {
          leads = batch.splice(0, MAX_LEADS);
          if (batch.length === 0) {
            fs.renameSync(path.join(DISCOVERIES_DIR, files[0]), path.join(DISCOVERIES_DIR, 'used', files[0]));
          } else {
            saveJson(path.join(DISCOVERIES_DIR, files[0]), batch);
          }
        }
      }
    }
  }

  if (leads.length === 0) {
    log('❌ Keine Leads zum Verarbeiten.');
    log('👉 Setze DISCOVER=true für automatische Suche, oder fülle Discoveries-Ordner.');
    return;
  }

  // Build & Deploy
  log(`\n🏗️  Phase 3: Build (${leads.length} Leads)`);
  for (const lead of leads) {
    log(`\n  --- ${lead.id} ---`);
    
    // Save lead data
    saveJson(path.join(LEADS_DIR, `${lead.id}.json`), lead);

    // Build preview
    const previewUrl = buildPreview(lead);
    if (!previewUrl) continue;

    // Update dashboard
    updateDashboard(lead, previewUrl);

    // Git push (nur wenn nicht im lokalen Test-Modus)
    if (!process.env.NO_GIT) {
      gitPush(lead);
    }
  }

  log('\n✅ Pipeline abgeschlossen.');
}

run().catch(e => { log(`❌ Fatal: ${e.message}`); process.exit(1); });
