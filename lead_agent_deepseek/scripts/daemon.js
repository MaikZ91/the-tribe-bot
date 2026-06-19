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
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Konfiguration ────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const QUEUE_FILE = path.join(ROOT, 'queue.json');
const LEADS_DIR = path.join(ROOT, 'leads');
const TEMPLATE_FILE = path.join(ROOT, 'templates', 'preview.html');
const DASHBOARD_FILE = path.join(ROOT, '..', 'docs', 'leads', 'dashboard', 'index.html');
const PREVIEW_DIR = path.join(ROOT, '..', 'docs', 'leads');
const DISCOVERY_FLAG = path.join(ROOT, 'DISCOVERY_NEEDED.txt');
const DISCOVERIES_DIR = path.join(ROOT, 'discoveries');
const DISCOVERIES_USED = path.join(ROOT, 'discoveries', 'used');

const INTERVAL_MINUTES = parseInt(
  process.env.INTERVAL_MINUTES ||
  process.argv.find(a => a.startsWith('--interval='))?.split('=')[1] ||
  '5',
  10
);

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

// ─── Phase 2: Auto-Discovery aus Backlog ─────────────────────────
function autoFillFromDiscoveries(queue) {
  ensureDir(DISCOVERIES_DIR);
  ensureDir(DISCOVERIES_USED);
  
  const files = fs.readdirSync(DISCOVERIES_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  if (files.length === 0) {
    const branches = queue?.settings?.discover_branches || ['Gastronomie', 'Handwerk'];
    fs.writeFileSync(DISCOVERY_FLAG,
      `Discovery needed at ${new Date().toISOString()}\n` +
      `Branchen: ${branches.join(', ')}\n` +
      `Region: ${queue?.settings?.discover_region || 'Bielefeld'}\n`
    );
    log(`🚩 Vorrat leer. DISCOVERY_NEEDED.txt — DeepSeek muss auffüllen.`);
    log(`   Branchen: ${branches.join(', ')}`);
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

// ─── Phase 4: HTML-Preview ────────────────────────────────────────
function buildPreview(lead) {
  if (!fs.existsSync(TEMPLATE_FILE)) {
    log(`❌ Template fehlt: ${TEMPLATE_FILE}`);
    return null;
  }
  let html = fs.readFileSync(TEMPLATE_FILE, 'utf8');
  const c = colorsFor(lead.industry);
  const esc = (s) => (s || '').replace(/#/g, '%23');

  const r = {
    '{{NAME}}': lead.name, '{{NAME_SHORT}}': lead.nameShort || lead.name,
    '{{INITIAL}}': (lead.name || '?')[0].toUpperCase(),
    '{{INDUSTRY}}': lead.industry || 'Unternehmen',
    '{{ACCENT}}': c.accent, '{{ACCENT_DARK}}': c.dark, '{{ACCENT_LIGHT}}': c.light,
    '{{ACCENT_DARK_ENC}}': esc(c.dark), '{{ACCENT_ENC}}': esc(c.accent),
    '{{HERO_H1}}': lead.heroH1 || `${lead.name}<br><em>${lead.industry} in Bielefeld</em>`,
    '{{HERO_SUB}}': lead.heroSub || `${lead.industry} mit Qualität und Erfahrung — direkt in Bielefeld.`,
    '{{CTA_TEXT}}': lead.ctaText || 'Jetzt anfragen',
    '{{CTA_HREF}}': lead.ctaHref || '#kontakt',
    '{{SECONDARY_CTA}}': lead.secondaryCta || 'Mehr erfahren',
    '{{STRIP_ITEMS}}': (lead.stripItems || ['✦ Lokal in Bielefeld', '✦ Persönlich', '✦ Modern', `✦ ${lead.industry}`]).map(s => `<span>${s}</span>`).join(''),
    '{{LEISTUNGEN_EYEBROW}}': 'Leistungen',
    '{{LEISTUNGEN_H2}}': 'Das bieten wir',
    '{{LEISTUNGEN_SUB}}': 'Ein Auszug unserer Services — persönlich, professionell, für Sie.',
    '{{FEATURE_CARDS}}': (lead.features || ['Leistung 1', 'Leistung 2', 'Leistung 3']).map((f, i) =>
      `<div class="fcard rv"${i ? ` style="transition-delay:.${i*6}s"` : ''}><div class="ic">✦</div><h3>${f}</h3><p>Professionell und zuverlässig — seit Jahren in Bielefeld.</p></div>`).join(''),
    '{{REVIEW_CARDS}}': (lead.reviews || [
      { stars: 5, text: '"Super, sehr zu empfehlen."', author: 'Kunde · Google' },
      { stars: 5, text: '"Professionell und freundlich."', author: 'Kundin · Google' },
      { stars: 5, text: '"Gerne wieder."', author: 'Kunde · Google' }
    ]).map(r => `<div class="review rv"><div class="s">${'★'.repeat(r.stars)}</div><p>${r.text}</p><div class="who">— ${r.author}</div></div>`).join(''),
    '{{REVIEW_FOOTNOTE}}': 'Echte Google-Bewertungen einbinden — der fehlende Trust-Baustein.',
    '{{CTA_BAND_EYEBROW}}': lead.ctaBandEyebrow || 'Jetzt Kontakt aufnehmen',
    '{{CTA_BAND_H2}}': lead.ctaBandH2 || 'Bereit für den nächsten Schritt?',
    '{{CTA_BAND_SUB}}': lead.ctaBandSub || 'Unverbindlich anfragen — wir melden uns zeitnah.',
    '{{INFO_H2}}': 'So erreichen Sie uns.',
    '{{CONTACT_DL}}': lead.contactDl || `<dt>Ort</dt><dd>Bielefeld</dd><dt>Telefon</dt><dd><a href="tel:${lead.phone||''}" style="color:var(--accent-d);font-weight:700">${lead.phone||'—'}</a></dd><dt>E-Mail</dt><dd>${lead.email||'—'}</dd>`,
    '{{PHONE}}': lead.phone || '',
    '{{NAV_LINKS}}': '<a class="lk" href="#leistungen">Leistungen</a><a class="lk" href="#reviews">Bewertungen</a><a class="lk" href="#info">Kontakt</a>',
    '{{FOOTER_DESC}}': `${lead.industry} in Bielefeld — Qualität, auf die Sie zählen können.`,
    '{{FOOTER_NAV}}': '<a href="#leistungen">Leistungen</a><a href="#reviews">Bewertungen</a><a href="#info">Kontakt</a>',
    '{{MOBILE_CTA_SHORT}}': lead.mobileCtaShort || 'Anfragen',
    '{{META_DESC}}': lead.metaDesc || `${lead.name} — ${lead.industry} Bielefeld. Konzept-Vorschau MZ.9.`,
    '{{TRUST_STRIP}}': lead.trustStrip || `<div class="stars"><span class="s">✦✦✦✦✦</span> ${lead.industry} Bielefeld</div>`
  };
  for (const [k, v] of Object.entries(r)) {
    html = html.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v);
  }
  const dir = path.join(PREVIEW_DIR, lead.id);
  ensureDir(dir);
  const out = path.join(dir, 'index.html');
  fs.writeFileSync(out, html);
  log(`📄 Preview: ${out}`);
  return `https://maikz91.github.io/the-tribe-bot/leads/${lead.id}/`;
}

// ─── Phase 5: Dashboard ───────────────────────────────────────────
function updateDashboard(lead, previewUrl) {
  if (!fs.existsSync(DASHBOARD_FILE)) return false;
  let h = fs.readFileSync(DASHBOARD_FILE, 'utf8');
  if (h.includes(`id:"${lead.id}"`)) { log('  ℹ️  Bereits im Dashboard.'); return true; }
  const entry = `\n    {id:"${lead.id}",name:"${lead.name}",industry:"${lead.industry}",hebel:"${lead.hebel||'mittel'}",score:${lead.score||50},website:"${lead.website}",problems:${JSON.stringify(lead.problems||['Veraltetes Design','Schwache CTA'])},opps:${JSON.stringify(lead.opps||['Modernes Design','Klare CTAs'])},preview:"${previewUrl}"},`;
  const pos = h.lastIndexOf('];');
  if (pos > 0) h = h.slice(0, pos) + entry + h.slice(pos);
  if (lead.email) {
    const ep = h.lastIndexOf('};');
    if (ep > 0 && !h.includes(`"${lead.id}":`)) {
      h = h.slice(0, ep) + `\n    "${lead.id}":"${lead.email}",` + h.slice(ep);
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
    execSync('git pull --rebase origin main', { cwd, stdio: 'pipe' });
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
    const filled = autoFillFromDiscoveries(queue);
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
