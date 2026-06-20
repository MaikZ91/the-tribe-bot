/**
 * MZ.9 Lead Agent — Pending Builds (Worklist für den Build-Agenten)
 *
 * Listet alle Leads, deren Build-Job vorliegt, aber noch KEINE fertige
 * Premium-Seite hat. Das ist die Arbeitsliste für Stufe 2 (DeepSeek/Claude).
 *
 * Ein Lead gilt als "fertig gebaut", wenn docs/leads/<id>/index.html existiert
 * und größer als ein Schwellwert ist (echte Seite, kein Platzhalter).
 *
 * CLI:
 *   node scripts/pending.js          → menschenlesbar
 *   node scripts/pending.js --json   → JSON (für Agenten/Skripte)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PREVIEW_DIR = path.join(ROOT, '..', 'docs', 'leads');
const MIN_BUILT_BYTES = 4000; // fertige Seiten sind deutlich größer

function listPending() {
  const out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(PREVIEW_DIR, { withFileTypes: true }); } catch { return out; }
  for (const d of dirs) {
    if (!d.isDirectory() || d.name === 'dashboard') continue;
    const dir = path.join(PREVIEW_DIR, d.name);
    const jobFile = path.join(dir, 'build-job.json');
    if (!fs.existsSync(jobFile)) continue;
    let job;
    try { job = JSON.parse(fs.readFileSync(jobFile, 'utf8')); } catch { continue; }
    if (job.status === 'published') continue;
    const indexFile = path.join(dir, 'index.html');
    let built = false;
    try { built = fs.existsSync(indexFile) && fs.statSync(indexFile).size >= MIN_BUILT_BYTES; } catch {}
    out.push({ id: d.name, name: job.name, industry: job.industry, city: job.city, status: job.status, built, jobFile, indexFile });
  }
  return out;
}

if (require.main === module) {
  const items = listPending();
  const needsBuild = items.filter(i => !i.built);
  const builtNotPublished = items.filter(i => i.built && i.status !== 'published');
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ needsBuild, builtNotPublished }, null, 2));
  } else {
    console.log(`\n🎨 Zu bauen (Stufe 2): ${needsBuild.length}`);
    needsBuild.forEach(i => console.log(`   - ${i.id}  (${i.name}, ${i.industry}, ${i.city})`));
    console.log(`\n📤 Gebaut, noch nicht publiziert (Stufe 3): ${builtNotPublished.length}`);
    builtNotPublished.forEach(i => console.log(`   - ${i.id}  (${i.name})  → node scripts/publish.js ${i.id}`));
    console.log('');
  }
}

module.exports = { listPending };
