/**
 * The Tribe — Auto-Loop für E-Mail-Einladungen
 *
 * Läuft im Dauerloop und sendet automatisch Einladungen an neue
 * E-Mail-Leads aus der Queue. Kein LLM nötig — nur Node.js + SMTP.
 *
 * Steuerung:
 *   INTERVAL_MINUTES   Pause zwischen Zyklen (Default 10)
 *   ONCE=1             Nur ein Zyklus, dann Ende
 *
 * Nutzung:
 *   node lead_agent_tribe/scripts/auto.js
 *   lead_agent_tribe\run_auto.bat        (Doppelklick)
 */

const { execSync } = require('child_process');
const path = require('path');

const SCRIPTS = __dirname;
const ROOT = path.join(SCRIPTS, '..');
const REPO = path.join(ROOT, '..');
const SEND_SCRIPT = path.join(SCRIPTS, 'send_invite.js');

const INTERVAL_MIN = parseInt(process.env.INTERVAL_MINUTES || '10', 10);

function ts() { return new Date().toLocaleTimeString('de-DE'); }
function log(m) { console.log(`[${ts()}] ${m}`); }

// ─── Zyklus: Neue E-Mail-Leads senden ────────────────────────────
function cycle() {
  log('─── The Tribe Auto-Loop Zyklus ───');

  try {
    // send_invite.js --all sendet nur uninvited E-Mail-Leads
    // und skipped bereits gesendete automatisch via sent.json
    execSync(`node "${SEND_SCRIPT}" --all`, {
      cwd: REPO,
      stdio: 'inherit',
      timeout: 5 * 60_000,
    });
  } catch (e) {
    log(`Zyklus-Fehler: ${e.message}`);
  }

  // Git commit + push (optional)
  if (process.env.AUTO_PUSH === '1') {
    try {
      execSync('git pull --rebase --autostash origin main', { cwd: REPO, stdio: 'pipe' });
      execSync('git add lead_agent_tribe/queue.json lead_agent_tribe/sent.json', { cwd: REPO, stdio: 'pipe' });
      const diff = execSync('git diff --cached --stat', { cwd: REPO, stdio: 'pipe', encoding: 'utf8' });
      if (diff.trim()) {
        execSync('git commit -m "tribe-agent: auto-send cycle"', { cwd: REPO, stdio: 'pipe' });
        execSync('git push', { cwd: REPO, stdio: 'pipe' });
        log('  Git: Änderungen gepusht.');
      }
    } catch (e) {
      log(`  Git-Fehler (nicht kritisch): ${e.message}`);
    }
  }

  log('─── Zyklus Ende ───\n');
}

// ─── Loop ─────────────────────────────────────────────────────────
let running = true;
process.on('SIGINT', () => { log('Beende...'); running = false; });

(async () => {
  log('═══ The Tribe — E-Mail Auto-Loop ═══');
  log(`Intervall: ${INTERVAL_MIN} min | Auto-Push: ${process.env.AUTO_PUSH === '1' ? 'an' : 'aus'}`);
  log('Strg+C zum Beenden.\n');

  if (process.env.ONCE === '1') {
    cycle();
    log('ONCE-Modus — beendet.');
    return;
  }

  do {
    try { cycle(); } catch (e) { log(`Loop-Fehler: ${e.message}`); }
    if (!running) break;
    log(`Warte ${INTERVAL_MIN} min...`);
    await new Promise(r => setTimeout(r, INTERVAL_MIN * 60_000));
  } while (running);

  log('Auto-Loop beendet.');
})();
