/**
 * MZ.9 Lead Agent — Autonomer 3-Stufen-Orchestrator
 *
 * Fährt im Dauerloop:
 *   STUFE 1  node daemon.js --once         → Discovery + Build-Job
 *   STUFE 2  Build-Agent pro offenem Lead  → echte Premium-Seite
 *   STUFE 3  node publish.js --all         → Dashboard + Auto-Push
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
    `Nutze AUSSCHLIESSLICH die echten Daten + Original-Bild-URLs aus dem Build-Job (keine Fakten/Preise erfinden).`,
    `Eigene branchenpassende Farbpalette. Deutsch. <meta name="robots" content="noindex">. Voll responsive.`,
    `Antworte am Ende nur knapp; die geschriebene Datei ${out} ist das Ergebnis.`,
  ].join(' ');
}

function buildLead(item) {
  const dir = path.join(PREVIEW_DIR, item.id);
  log(`🎨 Stufe 2 — baue ${item.id} (${item.name})`);
  const custom = process.env.BUILD_CMD;
  let cmd;
  if (custom) {
    cmd = custom.replace(/\{ID\}/g, item.id).replace(/\{DIR\}/g, dir);
  } else {
    // Claude Code headless. Prompt via Datei-arg vermeiden — direkt inline.
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

  // STUFE 2: offene Builds
  const pending = listPending().filter(i => !i.built).slice(0, MAX_BUILDS);
  if (pending.length === 0) {
    log('Keine offenen Builds.');
  } else {
    log(`${pending.length} offene Build(s).`);
    for (const item of pending) buildLead(item);
  }

  // STUFE 3: publizieren + Auto-Push
  try { run('node lead_agent_deepseek/scripts/publish.js --all'); }
  catch (e) { log(`Stufe 3 Fehler: ${e.message}`); }

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
