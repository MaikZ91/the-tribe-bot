/**
 * MZ.9 Lead Agent — Autonomer 3-Stufen-Orchestrator
 *
 * Fährt im Dauerloop:
 *   STUFE 1  node daemon.js --once         → Discovery + Build-Job
 *   STUFE 2  Build-Agent pro offenem Lead  → echte Premium-Seite
 *   STUFE 3  Pro Lead: git push + E-Mail   → GitHub Pages + Akquise-Mail
 *   KEIN Dashboard-Publishing — E-Mail geht direkt nach Build raus.
 *
 * Der Build-Agent (Stufe 2) ist konfigurierbar — tool-agnostisch:
 *   - Default: Claude Code headless (`claude -p ... --dangerously-skip-permissions`)
 *   - Eigener Befehl via Umgebungsvariable BUILD_CMD, in der {ID} und {DIR}
 *     ersetzt werden. Beispiel (DeepSeek):
 *       set BUILD_CMD=deepseek run build-lead --id {ID}
 *
 * Steuerung:
 *   INTERVAL_MINUTES   Pause zwischen Zyklen (Default 5)
 *   MAX_BUILDS         max. Builds pro Zyklus (Default 3)
 *   BUILD_CMD          eigener Build-Befehl (s.o.)
 *   BUILD_TIMEOUT_MIN  Timeout pro Build in Minuten (Default 12)
 *   ONCE=1             nur ein Zyklus, dann Ende
 */

const { execSync } = require('child_process');
const path = require('path');
const { listPending } = require('./pending');

const SCRIPTS = __dirname;
const ROOT = path.join(SCRIPTS, '..');
const REPO = path.join(ROOT, '..');
const PREVIEW_DIR = path.join(REPO, 'docs', 'leads');
const REFERENCE = path.join(PREVIEW_DIR, 'alt-bielefeld', 'index.html');
const WORKFLOW = path.join(ROOT, 'WORKFLOW.md');

const INTERVAL_MIN = parseInt(process.env.INTERVAL_MINUTES || '5', 10);
const MAX_BUILDS = parseInt(process.env.MAX_BUILDS || '3', 10);
const BUILD_TIMEOUT = parseInt(process.env.BUILD_TIMEOUT_MIN || '12', 10) * 60_000;

function ts() { return new Date().toLocaleTimeString('de-DE'); }
function log(m) { console.log(`[${ts()}] ${m}`); }

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: REPO, stdio: 'inherit', ...opts });
}

// ─── Git Push für einen einzelnen Lead ────────────────────────────
function gitPushOne(id, name) {
  try {
    try { execSync('git pull --rebase --autostash origin main', { cwd: REPO, stdio: 'pipe' }); } catch {}
    execSync(`git add docs/leads/${id}/ lead_agent_deepseek/leads/${id}.json lead_agent_deepseek/queue.json`, { cwd: REPO, stdio: 'pipe' });
    const diff = execSync('git diff --cached --stat', { cwd: REPO, stdio: 'pipe', encoding: 'utf8' });
    if (!diff.trim()) { log('  📭 Keine Änderungen zu pushen.'); return true; }
    execSync(`git commit -m "lead-agent: ${id} — ${name}"`, { cwd: REPO, stdio: 'pipe' });
    execSync('git push', { cwd: REPO, stdio: 'pipe' });
    log(`  🚀 Gepusht → https://maikz91.github.io/the-tribe-bot/leads/${id}/`);
    return true;
  } catch (err) {
    log(`  ⚠️  Git-Fehler: ${err.message}`);
    return false;
  }
}

// ─── Build-Job als published markieren ────────────────────────────
function markPublished(item) {
  const jobFile = path.join(PREVIEW_DIR, item.id, 'build-job.json');
  try { const j = JSON.parse(fs.readFileSync(jobFile, 'utf8')); j.status = 'published'; j.publishedAt = new Date().toISOString(); fs.writeFileSync(jobFile, JSON.stringify(j, null, 2)); } catch {}
}

// ─── Build-Befehl für einen Lead ──────────────────────────────────
function buildPrompt(id, dir) {
  const job = path.join(dir, 'build-job.json');
  const out = path.join(dir, 'index.html');
  return [
    `Baue eine hochwertige, conversion-orientierte Premium-Landingpage als KONZEPT-VORSCHAU (MZ.9 Akquise-Lead).`,
    `1) Lies den Build-Job: ${job} (Name, Branche, Telefon, Adresse, problems, images[], content).`,
    `2) Lies die PFLICHT-Stilreferenz komplett und übernimm Aufbau/Niveau/Klassen/Animationen: ${REFERENCE}.`,
    `3) Lies das Build-Briefing in ${WORKFLOW} (Abschnitt "Build-Briefing für Stufe 2") und halte ALLE Punkte ein.`,
    `4) Schreibe EINE self-contained Datei nach: ${out}.`,
    `PFLICHT: Baue die Original-Bild-URLs aus images[] prominent ein (Hero, Galerie, CTA-Band, Leistungsbilder) — KEINE bildlose Seite, KEINE Stock-/Fantasiebilder.`,
    `Nutze AUSSCHLIESSLICH die echten Daten aus dem Build-Job (keine Fakten/Preise erfinden).`,
    `Eigene branchenpassende Farbpalette. Deutsch. <meta name="robots" content="noindex">. Voll responsive.`,
    `Antworte am Ende nur knapp; die geschriebene Datei ${out} ist das Ergebnis.`,
  ].join(' ');
}

function buildLead(item) {
  const dir = path.join(PREVIEW_DIR, item.id);
  log(`🎨 Stufe 2 — baue ${item.id} (${item.name})`);
  const custom = process.env.BUILD_CMD;
  let cmd;
  // BUILD_CMD leer ODER "claude" → eingebauter Claude-Build mit vollem Prompt.
  // Sonst: eigener Befehl als Template ({ID}/{DIR} werden ersetzt).
  if (custom && custom.trim().toLowerCase() !== 'claude') {
    cmd = custom.replace(/\{ID\}/g, item.id).replace(/\{DIR\}/g, dir);
  } else {
    // Claude Code headless. Prompt inline.
    const prompt = buildPrompt(item.id, dir).replace(/"/g, '\\"');
    cmd = `claude -p "${prompt}" --dangerously-skip-permissions`;
  }
  try {
    run(cmd, { timeout: BUILD_TIMEOUT });
    return true;
  } catch (e) {
    log(`  ⚠️  Build fehlgeschlagen für ${item.id}: ${e.message}`);
    return false;
  }
}

// ─── Ein Zyklus ───────────────────────────────────────────────────
async function cycle() {
  log('─── Zyklus Start ───');

  // STUFE 1: Discovery
  try { run('node lead_agent_deepseek/scripts/daemon.js --once'); }
  catch (e) { log(`Stufe 1 Fehler: ${e.message}`); }

  // STUFE 2: offene Builds — nur Leads MIT Originalbildern.
  const fs = require('fs');
  const hasImages = (jobFile) => {
    try { return (JSON.parse(fs.readFileSync(jobFile, 'utf8')).images || []).length > 0; } catch { return false; }
  };
  const open = listPending().filter(i => !i.built);
  const buildable = open.filter(i => hasImages(i.jobFile));
  const skipped = open.length - buildable.length;
  if (skipped > 0) log(`⏭️  ${skipped} Lead(s) ohne Originalbilder übersprungen (keine bildlose Seite).`);
  const pending = buildable.slice(0, MAX_BUILDS);
  const builtIds = [];
  if (pending.length === 0) {
    log('Keine offenen Builds mit Bildern.');
  } else {
    log(`${pending.length} offene Build(s) mit Bildern.`);
    for (const item of pending) {
      if (buildLead(item)) builtIds.push(item.id);
    }
  }


  // STUFE 3: Push + E-Mail direkt pro frisch gebautem Lead
  for (const id of builtIds) {
    const item = pending.find(i => i.id === id);
    if (!item) continue;
    // 3a: Git Push (Seite live stellen)
    if (gitPushOne(item.id, item.name)) {
      markPublished(item);
    }
    // 3b: E-Mail direkt versenden
    try { run(`node lead_agent_deepseek/scripts/send_mail.js ${id}`); }
    catch (e) { log(`  ⚠️  E-Mail-Fehler (${id}): ${e.message}`); }
  }
  // Dashboard-Publishing wurde entfernt — E-Mail geht direkt raus.

  log('─── Zyklus Ende ───\n');
}

// ─── Loop ─────────────────────────────────────────────────────────
let running = true;
process.on('SIGINT', () => { log('⏹️  Beende...'); running = false; });

(async () => {
  log('═══ MZ.9 Lead Agent — Auto-Loop ═══');
  log(`Intervall: ${INTERVAL_MIN} min | Max-Builds/Zyklus: ${MAX_BUILDS} | Build: ${process.env.BUILD_CMD ? 'BUILD_CMD' : 'claude -p'}`);
  do {
    try { await cycle(); } catch (e) { log(`❌ Zyklus-Fehler: ${e.message}`); }
    if (process.env.ONCE === '1') break;
    if (!running) break;
    await new Promise(r => setTimeout(r, INTERVAL_MIN * 60_000));
  } while (running);
  log('👋 Auto-Loop beendet.');
})();