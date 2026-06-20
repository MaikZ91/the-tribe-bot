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
const { discover } = require('./discover');

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


// Städte/Branchen-Rotation lebt jetzt in discover.js (Overpass-Discovery).

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


// ─── Phase 2: Auto-Discovery aus Backlog ─────────────────────────
async function autoFillFromDiscoveries(queue) {
  ensureDir(DISCOVERIES_DIR);
  ensureDir(DISCOVERIES_USED);
  
  const files = fs.readdirSync(DISCOVERIES_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  if (files.length === 0) {
    // Keine Batch-Dateien — robuste Overpass-Discovery (deutschlandweit).
    // Bis zu 3 Versuche mit unterschiedlichen Stadt/Branche-Kombis pro Tick.
    log('🚩 Vorrat leer — starte Overpass-Discovery...');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const leads = await discover({ count: 3, log: m => log(m) });
        if (leads.length > 0) {
          queue.leads = leads;
          saveJson(QUEUE_FILE, queue);
          log(`  ✅ ${leads.length} neue Leads in Queue.`);
          return true;
        }
      } catch (e) { log(`  ⚠️  Discovery-Fehler: ${e.message}`); }
    }
    log('  Keine neuen Leads gefunden. Nächster Tick versucht andere Stadt/Branche.');
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

// Lighthouse-Audit entfernt: discover.js liefert die Schwächen (reasons/score)
// bereits beim Scrapen — ein separater Audit ist überflüssig.

// ─── Phase 4: Custom Build Marker ─────────────────────────────────
// KEINE TEMPLATE-PREVIEWS! Custom Builds werden vom DeepSeek Agent
// mit Frontend-Design-Skills, Originalbildern & Premium-Layout erstellt.
// Siehe WORKFLOW.md.
function markForCustomBuild(lead) {
  const dir = path.join(PREVIEW_DIR, lead.id);
  ensureDir(dir);
  // Strukturierter Build-Job: alles, was ein Agent (DeepSeek/Claude) braucht,
  // um eine echte Premium-Seite mit Originalbildern zu bauen.
  const job = {
    id: lead.id,
    name: lead.name,
    industry: lead.industry,
    website: lead.website,
    phone: lead.phone || '',
    email: lead.email || '',
    address: lead.address || '',
    city: lead.city || '',
    problems: lead.problems || lead.reasons || [],
    opps: lead.opps || [],
    lighthouse: lead.lighthouseScores || null,
    images: lead.images || [],        // Original-Bild-URLs von der Website
    content: lead.scraped || null,    // Titel, Description, H1/H2 als Copy-Basis
    status: 'needs_build',
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'build-job.json'), JSON.stringify(job, null, 2));
  log(`🎨 Build-Job angelegt: ${lead.id} (${job.images.length} Bilder, Hebel ${lead.hebel || '?'})`);
  return `https://maikz91.github.io/the-tribe-bot/leads/${lead.id}/`;
}

// Alias für Abwärtskompatibilität
function buildPreview(lead) { return markForCustomBuild(lead); }

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

  // Daemon baut KEINE Seite und pusht NICHT — er legt nur den Build-Job an.
  // Den Custom-Seitenbau + Dashboard-Eintrag + Auto-Push erledigt Stufe 2/3
  // (Build-Agent → scripts/publish.js). Siehe WORKFLOW.md.
  buildPreview(lead); // schreibt docs/leads/<id>/build-job.json (status: needs_build)
  saveJson(path.join(LEADS_DIR, `${lead.id}.json`), lead);
  log(`📥 Build-Job bereit für Stufe 2 (Agent): ${lead.id}`);
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

// --once: genau ein Tick (Discovery → Build-Job), dann Ende.
// Für den Agenten-Loop (Stufe 1), der danach Stufe 2/3 fährt.
if (process.argv.includes('--once')) {
  tick().then(() => log('✅ Ein Tick fertig (--once).')).catch(err => { log(`❌ ${err.message}`); process.exit(1); });
} else {
  loop();
}