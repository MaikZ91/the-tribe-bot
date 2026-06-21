/**
 * MZ.9 Lead Agent — Autonomer 3-Stufen-Orchestrator (skalierbar)
 *
 * Fährt im Dauerloop und draint JEDEN Zyklus den kompletten Backlog:
 *   STUFE 1  node daemon.js --once            → Discovery + Build-Job
 *   STUFE 2  Build-Agent pro offenem Lead     → echte Premium-Seite (PARALLEL)
 *   STUFE 3  Alle builtNotPublished publishen  → Bulk-Push + gestaffelte E-Mail
 *
 * Skalierung (Stand 2026-06-21):
 *   - Stufe 3 draint den GESAMTEN Backlog (nicht nur aktuelle Zyklus-Builds),
 *     damit "start lead agent" den Funnel monoton Richtung Ziel treibt.
 *   - Ein Bulk-Commit+Push pro Zyklus statt Per-Lead-Push (GitHub-Schonung).
 *   - Email-Timing UNVERÄNDERT: 0–EMAIL_DELAY_MAX_MIN Min Staffelung.
 *
 * Build-Agent (Stufe 2) tool-agnostisch:
 *   - Default: Claude Code headless (`claude -p ... --dangerously-skip-permissions`)
 *   - Eigener Befehl via BUILD_CMD, {ID}/{DIR} wird ersetzt.
 *
 * Steuerung:
 *   INTERVAL_MINUTES   Pause zwischen Zyklen (Default 5)
 *   BUILD_CMD          eigener Build-Befehl
 *   ONCE=1             nur ein Zyklus, dann Ende
 *   EMAIL_DELAY_MAX_MIN max. E-Mail-Verzögerung in Min (Default 10, 0 = sofort)
 *
 * ⚡ UNBEGRENZT: Alle offenen Builds parallel, kein MAX_BUILDS, kein Timeout.
 */

const { execSync, spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { listPending, isKanzleiSteuer } = require('./pending');

const SCRIPTS = __dirname;
const ROOT = path.join(SCRIPTS, '..');
const REPO = path.join(ROOT, '..');
const PREVIEW_DIR = path.join(REPO, 'docs', 'leads');
const REFERENCE = path.join(REPO, 'docs', 'mz9.html');

const INTERVAL_MIN = parseInt(process.env.INTERVAL_MINUTES || '5', 10);
const EMAIL_DELAY_MAX_MIN = parseInt(process.env.EMAIL_DELAY_MAX_MIN || '10', 10);

function ts() { return new Date().toLocaleTimeString('de-DE'); }
function log(m) { console.log(`[${ts()}] ${m}`); }
function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: REPO, stdio: 'inherit', ...opts });
}

// ─── Single-Instance-Lock (verhindert konkurrente Loops) ──────────
const LOCKFILE = path.join(ROOT, '.auto.lock');
function isPidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
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

// ─── Bulk git push für alle publizierten Leads eines Zyklus ───────
function gitPushBulk(ids) {
  try {
    try { execSync('git pull --rebase --autostash origin main', { cwd: REPO, stdio: 'pipe' }); } catch {}
    execSync('git add docs/leads/ lead_agent_deepseek/leads/ lead_agent_deepseek/queue.json lead_agent_deepseek/sent.json', { cwd: REPO, stdio: 'pipe' });
    const diff = execSync('git diff --cached --stat', { cwd: REPO, stdio: 'pipe', encoding: 'utf8' });
    if (!diff.trim()) { log('  📭 Keine Änderungen zu pushen.'); return true; }
    const n = ids.length;
    execSync(`git commit -m "lead-agent: ${n} Lead(s) publiziert — ${ids.slice(0, 3).join(', ')}${n > 3 ? ' …' : ''}"`, { cwd: REPO, stdio: 'pipe' });
    execSync('git push', { cwd: REPO, stdio: 'pipe' });
    log(`  🚀 Bulk-Push: ${n} Lead(s) live`);
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

// ─── Build-Befehl für einen Lead (token-lean: Briefing inline) ─────
function buildPrompt(id, dir) {
  const job = path.join(dir, 'build-job.json');
  const out = path.join(dir, 'index.html');
  return [
    `Baue eine hochwertige, conversion-orientierte Premium-Landingpage als KONZEPT-VORSCHAU (MZ.9 Akquise-Lead).`,
    `1) Lies den Build-Job: ${job} (Name, Branche, Telefon, Adresse, problems, images[], content).`,
    `2) Lies die Stilreferenz komplett und übernimm Aufbau/Niveau/Klassen/Animationen: ${REFERENCE}.`,
    `3) Nutze den frontend-design-Skill für ein unverkennbares, eigenständiges Premium-Design (kein generischer AI-Look).`,
    `4) Schreibe EINE self-contained Datei nach: ${out}.`,
    `PFLICHT-REGELN:`,
    `- Original-Bild-URLs aus images[] prominent einbauen (Hero, Galerie, CTA-Band, Leistungsbilder) — KEINE bildlose Seite, KEINE Stock-/Fantasiebilder. Hero OHNE loading=lazy, Rest mit.`,
    `- AUSSCHLIESSLICH echte Daten aus dem Build-Job — keine Fakten/Preise erfinden.`,
    `- Eigene branchenpassende Farbpalette (nicht 1:1 die Referenz).`,
    `- Sektionen: Ribbon · fixer Header · Vollbild-Hero · Info-Strip · Leistungen-Grid · Galerie · 3× Google-Reviews + Trust-Fußnote · CTA-Band · Kontakt (tel:-Link) · Footer „Konzept-Vorschau · MZ.9" · Mobile-CTA-Bar.`,
    `- inline <style>, minimal inline JS (Scroll-Reveal .rv/.in, Header-scrolled, Mobile-Nav).`,
    `- <html lang="de">, viewport, <meta name="robots" content="noindex">, Titel+Description aus echten Inhalten, sinnvolle alt-Texte.`,
    `- Voll responsive, valide, deutsch.`,
    `Antworte am Ende nur knapp; die geschriebene Datei ${out} ist das Ergebnis.`,
  ].join(' ');
}

// ⚡ Parallel-Build: Promise-basiert, mit Timeout + Ergebnis-Verifikation.
const BUILD_TIMEOUT_MS = parseInt(process.env.BUILD_TIMEOUT_MIN || '8', 10) * 60_000;
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
      cmd = `claude -p "${prompt}" --dangerously-skip-permissions`;
    }
    exec(cmd, { cwd: REPO, timeout: BUILD_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }, (err) => {
      if (err) { log(`  ⚠️  Build fehlgeschlagen für ${item.id}: ${err.killed ? 'Timeout' : err.message}`); resolve(false); return; }
      // Ergebnis-Verifikation: index.html muss echt sein (>4 KB), sonst als gescheitert werten
      try {
        const out = path.join(dir, 'index.html');
        if (!fs.existsSync(out) || fs.statSync(out).size < 4000) { log(`  ⚠️  Build ohne Ergebnis für ${item.id} (index.html fehlt/zu klein)`); resolve(false); return; }
      } catch (e) { log(`  ⚠️  Build-Verifikation fehlgeschlagen für ${item.id}: ${e.message}`); resolve(false); return; }
      log(`  ✅ Build ok: ${item.id}`);
      resolve(true);
    });
  });
}

// ─── Backlog holen (built, unpubliziert, gefiltert, dedup) ────────
function backlogToPublish() {
  return listPending().filter(i =>
    i.built &&
    i.status !== 'published' &&
    i.hasValidEmail &&
    i.images > 0 &&
    !i.emailAlreadySent &&
    !isKanzleiSteuer(i.id, i.industry, i.name)
  );
}

// ─── Ein Zyklus ───────────────────────────────────────────────────
async function cycle() {
  log('─── Zyklus Start ───');

  // STUFE 1: Discovery
  try { run('node lead_agent_deepseek/scripts/daemon.js --once'); }
  catch (e) { log(`Stufe 1 Fehler: ${e.message}`); }

  // STUFE 2: offene Builds — alle parallel, kein Limit
  const open = listPending().filter(i => !i.built);
  const buildable = open.filter(i => i.hasValidEmail && i.images > 0 && !i.emailAlreadySent && !isKanzleiSteuer(i.id, i.industry, i.name));
  if (open.length - buildable.length > 0) log(`⏭️  ${open.length - buildable.length} Lead(s) ohne valide E-Mail/Bilder oder Kanzlei/Steuer übersprungen.`);
  if (buildable.length === 0) {
    log('Keine offenen Builds mit Bildern.');
  } else {
    log(`${buildable.length} offene Build(s) — paralleler Build.`);
    await Promise.allSettled(buildable.map(item => buildLeadAsync(item)));
  }

  // STUFE 3: Backlog drainen — ALLE builtNotPublished publishen + mailen
  const toPublish = backlogToPublish();
  if (toPublish.length === 0) {
    log('Nichts zu publizieren.');
  } else {
    log(`📤 Stufe 3 — publiziere ${toPublish.length} Lead(s) (Bulk-Push + gestaffelte E-Mail).`);
    for (const item of toPublish) markPublished(item);
    gitPushBulk(toPublish.map(i => i.id));
    // E-Mail mit zufälliger Verzögerung (Timing UNVERÄNDERT: 0–EMAIL_DELAY_MAX_MIN Min)
    for (const item of toPublish) {
      const delaySec = EMAIL_DELAY_MAX_MIN > 0
        ? Math.floor(Math.random() * EMAIL_DELAY_MAX_MIN * 60)
        : 0;
      log(`  📧 ${item.name} → E-Mail in ${(delaySec / 60).toFixed(1)} Min`);
      setTimeout(() => {
        const child = spawn('node', ['lead_agent_deepseek/scripts/send_mail.js', item.id], {
          cwd: REPO, detached: true, stdio: 'ignore',
        });
        child.unref();
      }, delaySec * 1000);
    }
  }

  log('─── Zyklus Ende ───\n');
}

// ─── Loop ─────────────────────────────────────────────────────────
let running = true;
process.on('SIGINT', () => { log('⏹️  Beende...'); running = false; releaseLock(); });
process.on('SIGTERM', () => { running = false; releaseLock(); process.exit(0); });

(async () => {
  acquireLock();
  log('═══ MZ.9 Lead Agent — Auto-Loop (skalierbar) ═══');
  log(`Intervall: ${INTERVAL_MIN} min | Builds parallel | Backlog-Drain pro Zyklus | E-Mail-Staffelung: 0–${EMAIL_DELAY_MAX_MIN} Min | Build: ${process.env.BUILD_CMD ? 'BUILD_CMD' : 'claude -p'}`);
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
