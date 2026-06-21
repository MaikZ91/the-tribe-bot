/**
 * MZ.9 Lead Agent — AUTO.js  (DER EINZIGE LOOP)
 * =====================================================================
 *
 * Start:   node lead_agent_deepseek/scripts/auto.js
 *          (oder: „start lead agent" → dieses Skript im Hintergrund)
 *
 * Fährt im Dauerloop und pro Zyklus die 3 STUFEN. Alle Regeln kommen aus
 * ./rules.js (einzige Wahrheitsquelle). KEINE Subprozesse für Stufe 1/3 —
 * alles inline, damit ein schwaches Modell dem Ablauf folgen kann.
 *
 * ── DIE 3 STUFEN PRO ZYKLUS ────────────────────────────────────────────
 *
 *  STUFE 1  Discovery + Build-Job anlegen  (ehemals daemon.js)
 *           Queue leer? → discover() (Overpass) füllt sie.
 *           1 Lead konsumieren → Bilder ggf. nachholen → gate() prüfen
 *           → bei ok: build-job.json (needs_build) + leads/<id>.json.
 *
 *  STUFE 2  Premium-Seite bauen
 *           Alle offenen Builds parallel via `claude -p` (frontend-design-
 *           Skill, Originalbilder). Verifikation: index.html > 4 KB.
 *
 *  STUFE 3  Publish + Screenshot + Mail
 *           listBuiltNotSent() → markPublished + gitPushBulk (commit-first,
 *           OHNE autostash) → Screenshot-Vergleich (Pages live) → pro Lead
 *           send_mail.js mit 0–EMAIL_DELAY_MAX_MIN Min Staffelung.
 *
 * ── EISERNE REGELN (aus rules.js, an jedem Gate) ───────────────────────
 *  1. Keine Kanzlei/Recht/Steuer/Anwalt
 *  2. Keine Placeholder-Mails (mustermann/beispiel/rotlicht/example/…)
 *  3. sent.json-Dedup — jede Adresse genau einmal
 *  4. sent.json race-sicher (.sent.lock) + autostash-sicher (commit-first)
 *  5. Originalbilder Pflicht — keine bildlose/Stock-Seite
 *  6. E-Mail-Timing UNVERÄNDERT: 0–EMAIL_DELAY_MAX_MIN Min Staffelung
 *  7. Single-Instance-Lock (.auto.lock + PID-Liveness)
 *
 * Steuerung (env):
 *   INTERVAL_MINUTES    Pause zwischen Zyklen (Default 5)
 *   EMAIL_DELAY_MAX_MIN max. E-Mail-Verzögerung in Min (Default 10, 0 = sofort)
 *   BUILD_CMD           eigener Build-Befehl ({ID}/{DIR} ersetzt)
 *   BUILD_TIMEOUT_MIN   Build-Timeout in Min (Default 8)
 *   PAGES_DEPLOY_WAIT_SEC Wartezeit auf GitHub-Pages-Deploy vor Screenshot (Default 75)
 *   ONCE=1              nur ein Zyklus, dann Ende
 */

const { execSync, spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  listPending, listBuiltNotSent, gate, preflight,
  ROOT, PREVIEW_DIR, LOCKFILE, MIN_BUILT_BYTES,
} = require('./rules');
const { discover, fetchSiteImages } = require('./discover');

const SCRIPTS = __dirname;
const REPO = path.join(ROOT, '..');                       // the-tribe/
const QUEUE_FILE = path.join(ROOT, 'queue.json');
const LEADS_DIR = path.join(ROOT, 'leads');

const INTERVAL_MIN = parseInt(process.env.INTERVAL_MINUTES || '5', 10);
const EMAIL_DELAY_MAX_MIN = parseInt(process.env.EMAIL_DELAY_MAX_MIN || '10', 10);
const BUILD_TIMEOUT_MS = parseInt(process.env.BUILD_TIMEOUT_MIN || '8', 10) * 60_000;

function ts() { return new Date().toLocaleTimeString('de-DE'); }
function log(m) { console.log(`[${ts()}] ${m}`); }
function run(cmd) { return execSync(cmd, { cwd: REPO, stdio: 'inherit' }); }
function loadJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function saveJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

// ─── Single-Instance-Lock (Regel 7: kein zweiter Loop) ────────────
function isPidAlive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
function acquireLock() {
  if (fs.existsSync(LOCKFILE)) {
    const pid = parseInt(String(fs.readFileSync(LOCKFILE, 'utf8')).trim(), 10);
    if (pid && isPidAlive(pid)) {
      log(`⏹️  Auto-Loop läuft bereits (PID ${pid}). Kein zweiter Start — Abbruch.`);
      process.exit(0);
    }
  }
  fs.writeFileSync(LOCKFILE, String(process.pid));
}
function releaseLock() { try { fs.unlinkSync(LOCKFILE); } catch {} }

// ─── Bulk git push (Regel 4: commit-first, OHNE --autostash) ──────
// Erst committen, DANN pull --rebase (ohne autostash). Grund: send_mail-
// Prozesse schreiben konkurrent sent.json; --autostash würde es auf HEAD
// zurücksetzen → Dedup-Verlust. Mit commit-first ist der Baum clean.
function gitPushBulk(ids) {
  try {
    execSync('git add docs/leads/ lead_agent_deepseek/leads/ lead_agent_deepseek/queue.json lead_agent_deepseek/sent.json', { cwd: REPO, stdio: 'pipe' });
    const diff = execSync('git diff --cached --stat', { cwd: REPO, stdio: 'pipe', encoding: 'utf8' });
    if (diff.trim()) {
      const n = ids.length;
      execSync(`git commit -m "lead-agent: ${n} Lead(s) publiziert — ${ids.slice(0, 3).join(', ')}${n > 3 ? ' …' : ''}"`, { cwd: REPO, stdio: 'pipe' });
    }
    try { execSync('git pull --rebase origin main', { cwd: REPO, stdio: 'pipe' }); } catch {}
    execSync('git push', { cwd: REPO, stdio: 'pipe' });
    log(`  🚀 Bulk-Push: ${ids.length} Lead(s) live`);
    return true;
  } catch (err) {
    log(`  ⚠️  Git-Fehler: ${err.message}`);
    return false;
  }
}

// ─── Build-Job als published markieren ────────────────────────────
function markPublished(item) {
  const jobFile = path.join(PREVIEW_DIR, item.id, 'build-job.json');
  try {
    const j = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
    j.status = 'published';
    j.publishedAt = new Date().toISOString();
    fs.writeFileSync(jobFile, JSON.stringify(j, null, 2));
  } catch {}
}

// ═══ STUFE 1: Discovery + Build-Job (ehemals daemon.tick) ═════════
function getNextLead() {
  const queue = loadJson(QUEUE_FILE) || { leads: [], processed: [] };
  if (!queue.leads || !queue.leads.length) return null;
  const lead = queue.leads.shift();
  if (!queue.processed) queue.processed = [];
  queue.processed.push({ id: lead.id, at: new Date().toISOString() });
  saveJson(QUEUE_FILE, queue);
  return lead;
}

async function refillQueue() {
  log('🚩 Queue leer — starte Overpass-Discovery...');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const leads = await discover({ count: 3, log: m => log(m) });
      if (leads.length > 0) {
        const queue = loadJson(QUEUE_FILE) || { leads: [], processed: [] };
        queue.leads = leads;
        saveJson(QUEUE_FILE, queue);
        log(`  ✅ ${leads.length} neue Leads in Queue.`);
        return true;
      }
    } catch (e) { log(`  ⚠️  Discovery-Fehler: ${e.message}`); }
  }
  log('  Keine neuen Leads gefunden. Nächster Zyklus versucht andere Stadt/Branche.');
  return false;
}

// Build-Job anlegen (ehemals daemon.markForCustomBuild).
function createBuildJob(lead) {
  const dir = path.join(PREVIEW_DIR, lead.id);
  ensureDir(dir);
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
    images: lead.images || [],        // Original-Bild-URLs (Regel 5)
    content: lead.scraped || null,    // Titel/Description/H1/H2 als Copy-Basis
    status: 'needs_build',
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'build-job.json'), JSON.stringify(job, null, 2));
  saveJson(path.join(LEADS_DIR, `${lead.id}.json`), lead);
  log(`🎨 Build-Job angelegt: ${lead.id} (${job.images.length} Bilder)`);
}

// Stufe 1 konsumiert bis zu STAGE1_BATCH Leads pro Zyklus und legt für jeden
// (der gate besteht) einen Build-Job an — so hat Stufe 2 mehrere Builds zum
// parallelen Bauen (mehr Durchsatz Richtung 1000). Default 3.
const STAGE1_BATCH = parseInt(process.env.STAGE1_BATCH || '3', 10);

async function stage1() {
  let created = 0;
  for (let i = 0; i < STAGE1_BATCH; i++) {
    let lead = getNextLead();
    if (!lead) {
      // Nur beim ersten Versuch refill; danach reicht's für diesen Zyklus.
      if (i === 0) { const filled = await refillQueue(); if (!filled) break; lead = getNextLead(); }
      if (!lead) break;
    }
    log(`📋 ${lead.id} — ${lead.name} (${lead.industry})`);

    // Regel 5: Originalbilder Pflicht — nachholen falls fehlend.
    if ((!lead.images || lead.images.length === 0) && lead.website) {
      log(`🖼️  Keine Bilder im Lead — hole von ${lead.website} nach...`);
      lead.images = await fetchSiteImages(lead.website);
      log(`   ${lead.images.length} Originalbilder gefunden.`);
    }

    // gate() bündelt ALLE Regeln (Regel 1–3 + 5). Bei !ok überspringen.
    const g = gate(lead);
    if (!g.ok) { log(`⏭️  ${lead.id} übersprungen (gate: ${g.reason}).`); continue; }

    createBuildJob(lead);
    log(`📥 Build-Job bereit für Stufe 2: ${lead.id}`);
    created++;
  }
  if (created === 0) log('Stufe 1: keine neuen Build-Jobs (Queue leer oder alle gefiltert).');
  return;
}

// ═══ STUFE 2: Premium-Seite bauen (parallel, kein Limit) ═════════
// Token-lean: Design-DNA + Eisen Regeln leben im Skill mz9-lead-build (kondensiert),
// NICHT im Prompt und NICHT in einer 117 KB-Referenz, die jeder Build neu lädt.
function buildPrompt(id, dir) {
  const job = path.join(dir, 'build-job.json');
  const out = path.join(dir, 'index.html');
  return `Nutze den Skill „mz9-lead-build", um aus dem Build-Job ${job} eine eigenständige Premium-Konzeptseite (MZ.9-Akquise-Lead) zu bauen. Schreibe die fertige self-contained index.html nach: ${out}. WICHTIG: branchenspezifisches Design (NICHT pauschal dunkel), branchenspezifische Premium-Features (z. B. Terminbuchung, Speisekarte, Chatbot) — orientiert an der Analyse der Ursprungsseite (content/problems/opps). Halte die Eisen-Regeln aus dem Skill (Originalbilder aus images[] prominent, nur echte Daten, noindex, lang=de, >4 KB). Antworte danach nur knapp.`;
}

// claude-CLI auflösen. Windows: npm legt claude.cmd im globalen npm-Verz.;
// exec läuft über cmd.exe, dessen geerbter PATH das npm-Verz. oft NICHT
// enthält → „Datei nicht gefunden". Voller Pfad macht den Build pfadrobust.
function claudeBin() {
  if (process.platform === 'win32') {
    const cand = path.join(process.env.APPDATA || '', 'npm', 'claude.cmd');
    if (fs.existsSync(cand)) return cand;
  }
  return 'claude';
}

function buildLeadAsync(item) {
  return new Promise((resolve) => {
    const dir = path.join(PREVIEW_DIR, item.id);
    log(`🎨 Stufe 2 — baue ${item.id} (${item.name})`);
    const custom = process.env.BUILD_CMD;
    let cmd;
    if (custom && custom.trim().toLowerCase() !== 'claude') {
      cmd = custom.replace(/\{ID\}/g, item.id).replace(/\{DIR\}/g, dir);
    } else {
      const prompt = buildPrompt(item.id, dir).replace(/"/g, '\\"');
      cmd = `"${claudeBin()}" -p "${prompt}" --dangerously-skip-permissions`;
    }
    exec(cmd, { cwd: REPO, timeout: BUILD_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }, (err) => {
      // Datei-Check auch bei err — claude kann non-zero exiten (z. B. wegen
      // stdin-Warning) aber trotzdem die Datei geschrieben haben.
      try {
        const out = path.join(dir, 'index.html');
        if (fs.existsSync(out) && fs.statSync(out).size >= MIN_BUILT_BYTES) {
          log(`  ✅ Build ok: ${item.id}${err ? ' (mit non-zero exit, Datei ok)' : ''}`);
          resolve(true);
          return;
        }
      } catch (e) { /* unten als Fehler behandeln */ }
      const why = err ? (err.killed ? 'Timeout' : (err.code ? `exit ${err.code}` : err.message).slice(0, 90)) : 'keine Datei';
      log(`  ⚠️  Build fehlgeschlagen für ${item.id}: ${why}`);
      resolve(false);
    });
  });
}

// Build mit sofortigem Retry (claude -p ist gelegentlich flaky — API-Overload,
// non-zero exit ohne Datei). Retry innerhalb des Zyklus statt erst im nächsten.
async function buildWithRetry(item, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (await buildLeadAsync(item)) return true;
    if (attempt < retries) log(`  🔁 Retry ${attempt + 1}/${retries} für ${item.id}…`);
  }
  return false;
}

async function stage2() {
  // listPending filtert Kanzlei/Steuer + published bereits raus. Hier nur
  // die build-fähigen (valide E-Mail, Bilder, noch nicht gemailt) nehmen.
  const open = listPending().filter(i => !i.built);
  const buildable = open.filter(i => i.hasValidEmail && i.images > 0 && !i.emailAlreadySent);
  const skipped = open.length - buildable.length;
  if (skipped > 0) log(`⏭️  ${skipped} Lead(s) ohne valide E-Mail/Bilder oder bereits gemailt übersprungen.`);
  if (!buildable.length) { log('Keine offenen Builds mit Bildern.'); return; }
  // SERIELL: claude.exe (kompiliert) lässt sich nicht parallel starten
  // (Windows Sharing-Violation, auch mit CLAUDE_CONFIG_DIR-Isolation).
  // Seriell ist zuverlässig; batch-stage1 sorgt trotzdem für 3 Leads/Zyklus.
  log(`${buildable.length} offene Build(s) — serieller Build (mit Retry).`);
  for (const item of buildable) { await buildWithRetry(item); }
}

// ═══ STUFE 3: Publish + Mail ════════════════════════════════════
// Screenshot + gestaffelter Versand laufen JEDE einzeln in send_mail.js als
// eigener, detached Prozess — sie überleben den Loop-Tod (früher gingen
// per setTimeout geplante Mails verloren, wenn der Loop endete).
async function stage3() {
  const built = listBuiltNotSent();
  if (!built.length) { log('Nichts zu publizieren/mailen.'); return; }
  const toPublish = built.filter(i => i.status !== 'published');
  const toEmail = built;
  log(`📤 Stufe 3 — ${toPublish.length} publishen, ${toEmail.length} mailen (gestaffelt via send_mail).`);
  for (const item of toPublish) markPublished(item);
  if (toPublish.length) gitPushBulk(toPublish.map(i => i.id));

  // Pro Lead: send_mail.js detached starten. Deterministische Staffelung
  // (MAIL_DELAY_SEC = i × MAIL_STAGGER_SEC) → gleichmäßiger Abstand, kein
  // Clustern. Jede Mail ist ein eigener Prozess (überlebt Loop-Ende).
  const MAIL_STAGGER_SEC = parseInt(process.env.MAIL_STAGGER_SEC || '90', 10);
  for (let i = 0; i < toEmail.length; i++) {
    const item = toEmail[i];
    const delay = i * MAIL_STAGGER_SEC;
    log(`  📧 ${item.name} → Versand in ${(delay / 60).toFixed(1)} Min`);
    const child = spawn('node', ['lead_agent_deepseek/scripts/send_mail.js', item.id], {
      cwd: REPO, detached: true, stdio: 'ignore',
      env: { ...process.env, MAIL_DELAY_SEC: String(delay) },
    });
    child.unref();
  }
}

// ─── Ein Zyklus ───────────────────────────────────────────────────
async function cycle() {
  log('─── Zyklus Start ───');
  try { await stage1(); } catch (e) { log(`Stufe 1 Fehler: ${e.message}`); }
  try { await stage2(); } catch (e) { log(`Stufe 2 Fehler: ${e.message}`); }
  try { await stage3(); } catch (e) { log(`Stufe 3 Fehler: ${e.message}`); }
  log('─── Zyklus Ende ───\n');
}

// ─── Loop ─────────────────────────────────────────────────────────
let running = true;
process.on('SIGINT', () => { log('⏹️  Beende...'); running = false; releaseLock(); });
process.on('SIGTERM', () => { running = false; releaseLock(); process.exit(0); });

(async () => {
  log('═══ MZ.9 Lead Agent — Auto-Loop ═══');
  log(`Intervall: ${INTERVAL_MIN} min | Stufen inline | Backlog-Drain pro Zyklus | E-Mail-Staffelung: 0–${EMAIL_DELAY_MAX_MIN} Min | Build: ${process.env.BUILD_CMD ? 'BUILD_CMD' : 'claude -p'}`);
  preflight(log);   // VOR acquireLock: erkennt verwaiste Locks einer Vorgänger-Instanz.
  acquireLock();
  try {
    do {
      try { await cycle(); } catch (e) { log(`❌ Zyklus-Fehler: ${e.message}`); }
      if (process.env.ONCE === '1') break;
      if (!running) break;
      await new Promise(r => setTimeout(r, INTERVAL_MIN * 60_000));
    } while (running);
  } finally {
    releaseLock();
  }
  log('👋 Auto-Loop beendet.');
})();
