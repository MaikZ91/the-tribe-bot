/**
 * MZ.9 Lead Agent — Lokaler Daemon (DeepSeek Edition)
 *
 * Läuft kontinuierlich im Hintergrund. Verarbeitet alle N Minuten einen Lead
 * aus der Queue. Queue leer → DISCOVERY_NEEDED.txt → DeepSeek Agent füllt auf.
 *
 * Start:   node lead_agent_deepseek/scripts/daemon.js
 *          oder: run.bat
 *
 * Stop:    Ctrl+C
 *
 * Interval konfigurierbar via INTERVAL_MINUTES (env) oder --interval=<min>
 * Auto-Discovery: DISCOVER=true (env) aktiviert automatische Websuche
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─── Konfiguration ────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const QUEUE_FILE = path.join(ROOT, 'queue.json');
const LEADS_DIR = path.join(ROOT, 'leads');
const TEMPLATE_FILE = path.join(ROOT, 'templates', 'preview.html');
const DASHBOARD_FILE = path.join(ROOT, '..', 'docs', 'leads', 'dashboard', 'index.html');
const PREVIEW_DIR = path.join(ROOT, '..', 'docs', 'leads');
const DONE_FILE = path.join(ROOT, '..', 'docs', 'leads', 'dashboard', 'done.json');
const DISCOVERY_FLAG = path.join(ROOT, 'DISCOVERY_NEEDED.txt');
const DISCOVERIES_DIR = path.join(ROOT, 'discoveries');
const DISCOVERIES_USED = path.join(ROOT, 'discoveries', 'used');

const INTERVAL_MINUTES = parseInt(
  process.env.INTERVAL_MINUTES ||
  process.argv.find(a => a.startsWith('--interval='))?.split('=')[1] ||
  '5',
  10
);


// Suchbegriffe für Auto-Discovery
// Deutschlandweite Städte-Rotation (40+ Großstädte)
const CITIES = [
  'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt am Main', 'Stuttgart',
  'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden',
  'Hannover', 'Nürnberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld',
  'Bonn', 'Münster', 'Karlsruhe', 'Mannheim', 'Augsburg', 'Wiesbaden',
  'Aachen', 'Mönchengladbach', 'Braunschweig', 'Kiel', 'Chemnitz', 'Halle',
  'Magdeburg', 'Freiburg', 'Krefeld', 'Lübeck', 'Erfurt', 'Mainz', 'Rostock',
  'Kassel', 'Saarbrücken', 'Osnabrück', 'Oldenburg', 'Potsdam',
  'Heidelberg', 'Paderborn', 'Darmstadt', 'Würzburg', 'Regensburg',
  'Ingolstadt', 'Göttingen', 'Ulm', 'Trier', 'Cottbus', 'Siegen',
];
const BRANCHES = [
  'Friseur', 'Zahnarzt', 'Steuerberater', 'Maler', 'Dachdecker', 'Elektriker',
  'Tischler', 'Restaurant', 'Fotograf', 'Kosmetikstudio', 'Massage',
  'Physiotherapie', 'Bäcker', 'Goldschmied', 'Hundesalon', 'Rechtsanwalt',
  'Reinigung', 'Sanitär', 'Heizung', 'Gartenbau', 'Immobilienmakler',
  'Optiker', 'Hörakustik', 'Fitnessstudio', 'Blumenladen', 'Fahrschule',
  'Schreiner', 'Fliesenleger', 'Gebäudereinigung', 'Autowerkstatt',
];
function pickSearchTerm() {
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const branch = BRANCHES[Math.floor(Math.random() * BRANCHES.length)];
  return `${branch} ${city}`;
}

const COLORS = {
  gastronomie:   { accent: '#c2410c', dark: '#7c2d12', light: '#fdba74' },
  handwerk:      { accent: '#b45309', dark: '#78350f', light: '#fcd34d' },
  einzelhandel:  { accent: '#0d9488', dark: '#134e4a', light: '#5eead4' },
  dienstleistung:{ accent: '#2563eb', dark: '#1e3a5f', light: '#93c5fd' },
  friseur:       { accent: '#c77e6e', dark: '#a85f4f', light: '#d9a89b' },
  physio:         { accent: '#0d9488', dark: '#0f766e', light: '#5eead4' },
  kanzlei:       { accent: '#b8860b', dark: '#7c5e10', light: '#fde047' },
  zahnarzt:      { accent: '#0891b2', dark: '#155e75', light: '#67e8f9' },
  fitness:        { accent: '#65a30d', dark: '#3f6212', light: '#bef264' },
  optiker:       { accent: '#1d4ed8', dark: '#1e3a5f', light: '#93c5fd' },
  immobilien:    { accent: '#7c3aed', dark: '#4c1d95', light: '#c4b5fd' },
  default:       { accent: '#6366f1', dark: '#3730a3', light: '#a5b4fc' }
};

// ─── Hilfen ───────────────────────────────────────────────────────
function ts() { return new Date().toLocaleTimeString('de-DE'); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }
function loadJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function saveJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function colorsFor(industry) { return COLORS[(industry || '').toLowerCase()] || COLORS.default; }

function loadDoneList() { try { return JSON.parse(fs.readFileSync(DONE_FILE, 'utf8')) || []; } catch { return []; } }

// ─── Phase 1: Queue ───────────────────────────────────────────────
function getNextLead() {
  const queue = loadJson(QUEUE_FILE);
  if (!queue?.leads?.length) return null;
  const lead = queue.leads.shift();
  if (!queue.processed) queue.processed = [];
  queue.processed.push({ id: lead.id, at: new Date().toISOString() });
  saveJson(QUEUE_FILE, queue);
  return lead;
}


// ─── Web Discovery (DuckDuckGo Scraping) ──────────────────────────
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 15000, headers: { 'User-Agent': 'MZ9-LeadAgent/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => { data += c; if (data.length > 200000) { res.destroy(); resolve({ status: res.statusCode, html: data.slice(0, 100000), url }); } });
      res.on('end', () => resolve({ status: res.statusCode, html: data.slice(0, 100000), url }));
    }).on('error', reject).on('timeout', () => { this.destroy(); reject(new Error('timeout')); });
  });
}

function evaluateWebsite(html, url) {
  let score = 100;
  const problems = [], opps = [];
  if (!url.startsWith('https')) { score -= 20; problems.push('Kein HTTPS'); opps.push('SSL/HTTPS einrichten'); }
  if (!html.includes('viewport')) { score -= 15; problems.push('Nicht mobil-optimiert'); opps.push('Responsive Design'); }
  if (!/<form/i.test(html)) { score -= 10; problems.push('Kein Kontaktformular'); opps.push('Kontaktformular integrieren'); }
  if (html.includes('IONOS MyWebsite') || html.includes('website-start.de')) { score -= 10; problems.push('Veralteter Website-Baukasten'); opps.push('Moderne CMS-Plattform'); }
  if ((html.match(/<img/gi) || []).length < 2) { score -= 5; problems.push('Wenig Bilder'); opps.push('Bildergalerie aufbauen'); }
  return { score: Math.max(0, Math.round(score * 0.7 + 30)), problems: problems.slice(0, 4), opps: opps.slice(0, 4) };
}

function extractContact(html) {
  const email = (html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [''])[0];
  const phone = (html.match(/(?:\+49\s?)?(?:05[0-9]{2,3}\s?[\/\-\s]?\s?[0-9]{2,8})/) || [''])[0];
  return { email, phone };
}

function extractMeta(html) {
  const title = (html.match(/<title>([^<]+)<\/title>/i) || ['',''])[1];
  const desc = (html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) || ['',''])[1];
  return { title, desc };
}

function guessIndustry(title, url) {
  const t = (title + ' ' + url).toLowerCase();
  if (/friseur|hair|salon/i.test(t)) return 'Friseur';
  if (/zahnarzt|zahn/i.test(t)) return 'Zahnarzt';
  if (/steuerberat|kanzlei/i.test(t)) return 'Kanzlei';
  if (/physio|therapie/i.test(t)) return 'Physiotherapie';
  if (/maler|dachdeck|elektro|tischler|schreiner/i.test(t)) return 'Handwerk';
  if (/restaurant|café|cafe|imbiss|bäck|bäcker|konditor/i.test(t)) return 'Gastronomie';
  if (/fotograf/i.test(t)) return 'Dienstleistung';
  if (/kosmetik/i.test(t)) return 'Kosmetik';
  if (/massage/i.test(t)) return 'Dienstleistung';
  if (/auto|kfz|werkstatt|reifen/i.test(t)) return 'Automotive';
  if (/blumen|florist/i.test(t)) return 'Florist';
  if (/immobilien/i.test(t)) return 'Immobilien';
  return 'Dienstleistung';
}

async function discoverOnline() {
  const term = pickSearchTerm();
  log(`🔍 Auto-Discovery: "${term}"`);
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(term)}+website`;
  try {
    const { html } = await fetchUrl(url);
    const links = [...html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/gi)];
    const results = [];
    const seen = new Set();
    for (const [, link, text] of links) {
      if (seen.has(link) || link.includes('duckduckgo') || link.includes('google.') || link.includes('facebook') || link.includes('instagram')) continue;
      seen.add(link);
      try { const domain = new URL(link).hostname.replace('www.', ''); if (domain.split('.').length <= 3) results.push({ url: link, name: text.replace(/<\/?[^>]+>/g, '').trim(), domain }); } catch {}
      if (results.length >= 5) break;
    }
    log(`  ${results.length} Websites gefunden.`);
    return results;
  } catch (e) { log(`  Fehler: ${e.message}`); return []; }
}

// ─── Phase 2: Auto-Discovery aus Backlog ─────────────────────────
async function autoFillFromDiscoveries(queue) {
  ensureDir(DISCOVERIES_DIR);
  ensureDir(DISCOVERIES_USED);
  
  const files = fs.readdirSync(DISCOVERIES_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  if (files.length === 0) {
    // Keine Batch-Dateien — versuche Online-Discovery
    log('🚩 Vorrat leer — starte automatische Websuche...');
    try {
      const discovered = await discoverOnline();
      if (discovered.length > 0) {
        const leads = [];
        for (const r of discovered) {
          try {
            const { html } = await fetchUrl(r.url);
            if (!html) continue;
            const ev = evaluateWebsite(html, r.url);
            const contact = extractContact(html);
            const meta = extractMeta(html);
            const name = meta.title?.split(/[–\-\|]/)[0]?.trim() || r.name;
            const industry = guessIndustry(meta.title, r.url);
            leads.push({
              id: r.domain.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 50),
              name, nameShort: name.split(' ').slice(0, 2).join(' '),
              industry, hebel: ev.score < 45 ? 'hoch' : ev.score < 60 ? 'mittel' : 'niedrig',
              website: r.url, phone: contact.phone || '+495210000000',
              email: contact.email || `info@${r.domain}`, score: ev.score,
              problems: ev.problems, opps: ev.opps,
              heroH1: `${name.split(' ').pop()}.<br><em>${industry} — Ihre Region.</em>`,
              heroSub: meta.desc || `${industry} mit Qualität und Erfahrung.`,
              ctaText: 'Jetzt anfragen', features: [ev.opps[0] || 'Professionell', ev.opps[1] || 'Zuverlässig', ev.opps[2] || 'Erfahren'],
            });
          } catch (e) { /* skip */ }
        }
        if (leads.length > 0) {
          leads.sort((a, b) => a.score - b.score);
          queue.leads = leads.slice(0, 3);
          saveJson(QUEUE_FILE, queue);
          log(`  ✅ ${Math.min(3, leads.length)} neue Leads in Queue.`);
          return true;
        }
      }
    } catch (e) { log(`  ⚠️  Discovery-Fehler: ${e.message}`); }
    log('  Keine neuen Leads gefunden. Versuche es beim nächsten Tick erneut.');
    return false;
  }
  
  const batchFile = path.join(DISCOVERIES_DIR, files[0]);
  try {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    if (!Array.isArray(batch) || batch.length === 0) {
      fs.renameSync(batchFile, path.join(DISCOVERIES_USED, files[0]));
      return autoFillFromDiscoveries(queue);
    }
    queue.leads = batch;
    saveJson(QUEUE_FILE, queue);
    fs.renameSync(batchFile, path.join(DISCOVERIES_USED, files[0]));
    log(`📦 Batch geladen: ${files[0]} (${batch.length} Leads). Noch ${files.length - 1} im Vorrat.`);
    return true;
  } catch (err) {
    log(`⚠️  Batch-Fehler: ${err.message}`);
    return false;
  }
}

// ─── Phase 3: Lighthouse-Audit ────────────────────────────────────
function auditLead(lead) {
  const lhFile = path.join(LEADS_DIR, `.lh-${lead.id}.json`);
  ensureDir(LEADS_DIR);
  log(`🔍 Lighthouse: ${lead.website}`);
  try {
    execSync(
      `npx lighthouse "${lead.website}" --output=json --output-path="${lhFile}" ` +
      `--only-categories=performance,accessibility,seo ` +
      `--form-factor=mobile --throttling-method=simulate ` +
      `--chrome-flags="--headless=new --no-sandbox" --quiet`,
      { stdio: 'pipe', timeout: 120_000, env: { ...process.env, TMP: 'C:\\temp', TEMP: 'C:\\temp', TMPDIR: 'C:\\temp' } }
    );
    const lh = JSON.parse(fs.readFileSync(lhFile, 'utf8'));
    const scores = {
      performance: Math.round((lh.categories?.performance?.score || 0) * 100),
      accessibility: Math.round((lh.categories?.accessibility?.score || 0) * 100),
      seo: Math.round((lh.categories?.seo?.score || 0) * 100),
    };
    log(`  ✅ Perf:${scores.performance} A11y:${scores.accessibility} SEO:${scores.seo}`);
    return scores;
  } catch (err) {
    log(`⚠️  Lighthouse fehlgeschlagen: ${err.message}`);
    return null;
  }
}

// ─── Phase 4: Custom Build Marker ─────────────────────────────────
// KEINE TEMPLATE-PREVIEWS! Custom Builds werden vom DeepSeek Agent
// mit Frontend-Design-Skills, Originalbildern & Premium-Layout erstellt.
// Siehe WORKFLOW.md.
function markForCustomBuild(lead) {
  const dir = path.join(PREVIEW_DIR, lead.id);
  ensureDir(dir);
  const marker = path.join(dir, 'CUSTOM_BUILD_NEEDED.txt');
  fs.writeFileSync(marker, `Custom build needed for: ${lead.name} (${lead.id})\nIndustry: ${lead.industry}\nWebsite: ${lead.website}\nAt: ${new Date().toISOString()}`);
  log(`🎨 Custom Build benötigt: ${lead.id}`);
  return `https://maikz91.github.io/the-tribe-bot/leads/${lead.id}/`;
}

// Alias für Abwärtskompatibilität
function buildPreview(lead) { return markForCustomBuild(lead); }

// ─── Phase 5: Dashboard ───────────────────────────────────────────
function updateDashboard(lead, previewUrl) {
  if (!fs.existsSync(DASHBOARD_FILE)) return false;
  let h = fs.readFileSync(DASHBOARD_FILE, 'utf8');
  if (h.includes(`id:"${lead.id}"`)) { log('  ℹ️  Bereits im Dashboard.'); return true; }

  // Insert into SEED array — find 'var SEED=[' then first '];' after it
  const seedStart = h.indexOf('var SEED=[');
  if (seedStart < 0) { log('  ⚠️  SEED-Marker nicht gefunden.'); return false; }
  const seedEnd = h.indexOf('];', seedStart);
  if (seedEnd < 0) { log('  ⚠️  SEED-Ende nicht gefunden.'); return false; }

  const entry = `\n    {id:"${lead.id}",name:"${lead.name}",industry:"${lead.industry}",hebel:"${lead.hebel||'mittel'}",score:${lead.score||50},website:"${lead.website}",problems:${JSON.stringify(lead.problems||['Veraltetes Design','Schwache CTA'])},opps:${JSON.stringify(lead.opps||['Modernes Design','Klare CTAs'])},preview:"${previewUrl}"},`;
  h = h.slice(0, seedEnd) + entry + h.slice(seedEnd);

  // Insert into EMAILS object — find 'var EMAILS={' then first '};' after it
  if (lead.email) {
    const mailStart = h.indexOf('var EMAILS={');
    if (mailStart > 0) {
      const mailEnd = h.indexOf('};', mailStart);
      if (mailEnd > 0 && !h.includes(`"${lead.id}":`)) {
        h = h.slice(0, mailEnd) + `\n    "${lead.id}":"${lead.email}",` + h.slice(mailEnd);
      }
    }
  }

  fs.writeFileSync(DASHBOARD_FILE, h);
  log('📊 Dashboard aktualisiert.');
  return true;
}

// ─── Phase 6: Git Push ────────────────────────────────────────────
function gitPush(lead) {
  try {
    const cwd = path.join(ROOT, '..');
    try { execSync('git stash', { cwd, stdio: 'pipe' }); } catch {}
    try { execSync('git pull --rebase origin main', { cwd, stdio: 'pipe' }); } catch {}
    try { execSync('git stash pop', { cwd, stdio: 'pipe' }); } catch {}
    try { execSync('git add docs/leads/ lead_agent_deepseek/queue.json lead_agent_deepseek/leads/', { cwd, stdio: 'pipe' }); } catch {}
    try { execSync('git add lead_agent_deepseek/discoveries/used/ lead_agent_deepseek/DISCOVERY_NEEDED.txt', { cwd, stdio: 'pipe' }); } catch {}
    const diff = execSync('git diff --cached --stat', { cwd, stdio: 'pipe', encoding: 'utf8' });
    if (!diff.trim()) { log('  📭 Keine Änderungen.'); return; }
    execSync(`git commit -m "lead-agent: ${lead.id} — ${lead.name}"`, { cwd, stdio: 'pipe' });
    execSync('git push', { cwd, stdio: 'pipe' });
    log(`🚀 Gepusht: ${lead.name}`);
  } catch (err) {
    log(`⚠️  Git: ${err.message}`);
  }
}

// ─── Main Loop ────────────────────────────────────────────────────
let running = true;
process.on('SIGINT', () => { log('\n⏹️  Beende Daemon...'); running = false; });

async function tick() {
  const queue = loadJson(QUEUE_FILE);
  let lead = getNextLead();

  if (!lead) {
    const filled = await autoFillFromDiscoveries(queue);
    if (!filled) return;
    lead = getNextLead();
    if (!lead) return;
  }

  log(`📋 ${lead.id} — ${lead.name} (${lead.industry})`);

  const scores = auditLead(lead);
  if (scores) {
    lead.score = lead.score || Math.round(scores.performance * 0.5 + scores.accessibility * 0.2 + scores.seo * 0.1);
    lead.lighthouseScores = scores;
  }

  const previewUrl = buildPreview(lead);
  if (previewUrl) {
    updateDashboard(lead, previewUrl);
    gitPush(lead);
  }

  saveJson(path.join(LEADS_DIR, `${lead.id}.json`), lead);
}

async function loop() {
  log('═══ MZ.9 Lead Agent — Lokaler Daemon ═══');
  log(`⏱️  Intervall: ${INTERVAL_MINUTES} min | Queue: ${QUEUE_FILE}`);
  log('🟢 Läuft. Ctrl+C zum Beenden.\n');

  while (running) {
    try {
      await tick();
    } catch (err) {
      log(`❌ Fehler: ${err.message}`);
    }
    if (!running) break;
    await new Promise(r => setTimeout(r, INTERVAL_MINUTES * 60_000));
  }

  log('👋 Daemon beendet.');
}

loop();