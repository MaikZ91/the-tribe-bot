/**
 * MZ.9 Lead Agent — Publish (Stufe 3: Git Push → GitHub Pages)
 *
 * Läuft NACHDEM der Build-Agent eine fertige Premium-Seite gebaut hat.
 * Markiert den Build-Job als publiziert und committet + pusht automatisch.
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
const PAGES_BASE = 'https://maikz91.github.io/the-tribe-bot/leads';

function log(m) { console.log(m); }

function gitPush(job) {
  const cwd = REPO;
  try {
    try { execSync('git pull --rebase --autostash origin main', { cwd, stdio: 'pipe' }); } catch {}
    execSync(`git add docs/leads/${job.id}/ lead_agent_deepseek/leads/${job.id}.json lead_agent_deepseek/queue.json`, { cwd, stdio: 'pipe' });
    const diff = execSync('git diff --cached --stat', { cwd, stdio: 'pipe', encoding: 'utf8' });
    if (!diff.trim()) { log('  📭 Keine Änderungen zu pushen.'); return true; }
    execSync(`git commit -m "lead-agent: ${job.id} — ${job.name}"`, { cwd, stdio: 'pipe' });
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