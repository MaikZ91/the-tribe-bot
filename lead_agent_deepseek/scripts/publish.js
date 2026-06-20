/**
 * MZ.9 Lead Agent — Publish (Stufe 3: Dashboard + Auto-Push)
 *
 * Läuft NACHDEM der Build-Agent eine fertige Premium-Seite gebaut hat.
 * Trägt den Lead ins Dashboard ein (SEED + EMAILS), markiert den Build-Job
 * als publiziert und committet + pusht IMMER automatisch (→ GitHub Pages).
 *
 * CLI:
 *   node scripts/publish.js <id>     → einen Lead publizieren
 *   node scripts/publish.js --all    → alle gebauten, noch nicht publizierten
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { listPending } = require('./pending');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const PREVIEW_DIR = path.join(REPO, 'docs', 'leads');
const DASHBOARD_FILE = path.join(PREVIEW_DIR, 'dashboard', 'index.html');
const PAGES_BASE = 'https://maikz91.github.io/the-tribe-bot/leads';

function log(m) { console.log(m); }

function updateDashboard(job) {
  if (!fs.existsSync(DASHBOARD_FILE)) { log('  ⚠️  Dashboard nicht gefunden.'); return false; }
  let h = fs.readFileSync(DASHBOARD_FILE, 'utf8');
  if (h.includes(`id:"${job.id}"`)) { log('  ℹ️  Bereits im Dashboard.'); return true; }

  const seedStart = h.indexOf('var SEED=[');
  if (seedStart < 0) { log('  ⚠️  SEED-Marker fehlt.'); return false; }
  const seedEnd = h.indexOf('];', seedStart);

  const problems = (job.problems && job.problems.length) ? job.problems : ['Veraltetes Design', 'Schwache CTA'];
  const opps = (job.opps && job.opps.length) ? job.opps : ['Modernes Design', 'Klare CTAs'];
  const hebel = job.hebel || 'mittel';
  const score = job.score != null ? job.score : 30;
  const preview = `${PAGES_BASE}/${job.id}/`;

  const entry = `\n    {id:"${job.id}",name:"${job.name}",industry:"${job.industry}",hebel:"${hebel}",score:${score},website:"${job.website || ''}",problems:${JSON.stringify(problems)},opps:${JSON.stringify(opps)},preview:"${preview}"},`;
  h = h.slice(0, seedEnd) + entry + h.slice(seedEnd);

  if (job.email) {
    const mailStart = h.indexOf('var EMAILS={');
    if (mailStart > 0) {
      const mailEnd = h.indexOf('};', mailStart);
      if (mailEnd > 0 && !h.includes(`"${job.id}":`)) {
        h = h.slice(0, mailEnd) + `\n    "${job.id}":"${job.email}",` + h.slice(mailEnd);
      }
    }
  }

  fs.writeFileSync(DASHBOARD_FILE, h);
  log('  📊 Dashboard aktualisiert.');
  return true;
}

// Sicherheitsnetz: prüft, dass das Dashboard-<script> valide JS ist.
// Verhindert, dass ein fehlendes Komma o.ä. das ganze Dashboard lahmlegt.
function dashboardIsValid() {
  try {
    const h = fs.readFileSync(DASHBOARD_FILE, 'utf8');
    const m = h.match(/<script>([\s\S]*?)<\/script>/);
    if (!m) return true;
    new Function(m[1]); // wirft bei Syntaxfehler
    return true;
  } catch (e) {
    log(`  ⛔ Dashboard-Syntaxfehler: ${e.message} — Push abgebrochen, bitte prüfen.`);
    return false;
  }
}

function gitPush(job) {
  if (!dashboardIsValid()) return false;
  const cwd = REPO;
  try {
    try { execSync('git pull --rebase --autostash origin main', { cwd, stdio: 'pipe' }); } catch {}
    execSync(`git add docs/leads/${job.id}/ docs/leads/dashboard/index.html lead_agent_deepseek/leads/${job.id}.json lead_agent_deepseek/queue.json`, { cwd, stdio: 'pipe' });
    const diff = execSync('git diff --cached --stat', { cwd, stdio: 'pipe', encoding: 'utf8' });
    if (!diff.trim()) { log('  📭 Keine Änderungen zu pushen.'); return true; }
    execSync(`git commit -m "lead-agent: ${job.id} — ${job.name} (publish)"`, { cwd, stdio: 'pipe' });
    execSync('git push', { cwd, stdio: 'pipe' });
    log(`  🚀 Gepusht → ${PAGES_BASE}/${job.id}/`);
    return true;
  } catch (err) {
    log(`  ⚠️  Git-Fehler: ${err.message}`);
    return false;
  }
}

function publishOne(id) {
  const dir = path.join(PREVIEW_DIR, id);
  const jobFile = path.join(dir, 'build-job.json');
  const indexFile = path.join(dir, 'index.html');
  if (!fs.existsSync(jobFile)) { log(`❌ ${id}: kein build-job.json`); return false; }
  if (!fs.existsSync(indexFile) || fs.statSync(indexFile).size < 4000) {
    log(`❌ ${id}: Seite noch nicht gebaut (index.html fehlt/zu klein). Erst Stufe 2 (Agent).`);
    return false;
  }
  const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  log(`📤 Publiziere ${id} — ${job.name}`);
  updateDashboard(job);
  job.status = 'published';
  job.publishedAt = new Date().toISOString();
  fs.writeFileSync(jobFile, JSON.stringify(job, null, 2));
  gitPush(job);
  return true;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--all')) {
    const { builtNotPublished } = { builtNotPublished: listPending().filter(i => i.built && i.status !== 'published') };
    if (!builtNotPublished.length) { log('Nichts zu publizieren.'); process.exit(0); }
    builtNotPublished.forEach(i => publishOne(i.id));
  } else if (args[0]) {
    publishOne(args[0]);
  } else {
    log('Nutzung: node scripts/publish.js <id>  |  --all');
    process.exit(1);
  }
}

module.exports = { publishOne };
