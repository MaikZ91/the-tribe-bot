/**
 * MZ.9 — Batch Daemon: Verarbeitet ALLE Queue-Leads in Build-Jobs
 *
 * Einmal-Ausführung statt Tick-by-Tick. Nutzt die gleiche Logik wie daemon.js,
 * verarbeitet aber alle offenen Queue-Leads in einem Durchlauf.
 *
 * Nutzung:
 *   node lead_agent_deepseek/scripts/batch_daemon.js
 */

const { discover, fetchSiteImages } = require('./discover');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const QUEUE_FILE = path.join(ROOT, 'queue.json');
const LEADS_DIR = path.join(ROOT, 'leads');
const PREVIEW_DIR = path.join(ROOT, '..', 'docs', 'leads');
const SENT_FILE = path.join(ROOT, 'sent.json');

function ts() { return new Date().toLocaleTimeString('de-DE'); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }

// ─── E-Mail-Validierung (identisch zu daemon.js) ────────────────
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const e = email.trim();
  if (!e || e.length > 254) return false;
  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(e)) return false;
  if (/\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|woff2?|mp4|pdf|xml|json)(\?.*)?$/i.test(e)) return false;
  return true;
}

function isEmailAlreadySent(email) {
  if (!email) return false;
  try {
    const sent = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'));
    const needle = email.trim().toLowerCase();
    for (const id of Object.keys(sent)) {
      try {
        const jf = path.join(PREVIEW_DIR, id, 'build-job.json');
        if (fs.existsSync(jf)) {
          const job = JSON.parse(fs.readFileSync(jf, 'utf8'));
          if ((job.email || '').trim().toLowerCase() === needle) return true;
        }
      } catch {}
    }
  } catch {}
  return false;
}

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function markForCustomBuild(lead) {
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
    images: lead.images || [],
    content: lead.scraped || null,
    status: 'needs_build',
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'build-job.json'), JSON.stringify(job, null, 2));
  return `https://maikz91.github.io/the-tribe-bot/leads/${lead.id}/`;
}

async function main() {
  log('═══ Batch Daemon: Verarbeite ALLE Queue-Leads ═══');
  
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const leads = queue.leads || [];
  
  log(`${leads.length} Leads in Queue.`);
  
  let built = 0;
  let skippedNoEmail = 0;
  let skippedNoImages = 0;
  let skippedAlreadySent = 0;
  let processed = [];
  
  for (const lead of leads) {
    // Überspringe bereits verarbeitete IDs
    const jobFile = path.join(PREVIEW_DIR, lead.id, 'build-job.json');
    if (fs.existsSync(jobFile)) {
      processed.push(lead.id);
      continue;
    }
    
    // Originalbilder holen falls nötig
    if ((!lead.images || lead.images.length === 0) && lead.website) {
      try {
        lead.images = await fetchSiteImages(lead.website);
      } catch (e) {
        log(`  ⚠️  ${lead.id}: Bilder-Fetch fehlgeschlagen`);
      }
    }
    
    if (!lead.images || lead.images.length === 0) {
      skippedNoImages++;
      continue;
    }
    
    if (!isValidEmail(lead.email)) {
      skippedNoEmail++;
      continue;
    }
    
    if (isEmailAlreadySent(lead.email)) {
      skippedAlreadySent++;
      continue;
    }
    
    // Build-Job anlegen
    markForCustomBuild(lead);
    try {
      ensureDir(LEADS_DIR);
      fs.writeFileSync(path.join(LEADS_DIR, `${lead.id}.json`), JSON.stringify(lead, null, 2));
    } catch {}
    
    built++;
    processed.push(lead.id);
  }
  
  // Queue aufräumen: verarbeitete Leads entfernen
  queue.leads = leads.filter(l => !processed.includes(l.id));
  if (!queue.processed) queue.processed = [];
  for (const id of processed) {
    queue.processed.push({ id, at: new Date().toISOString() });
  }
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  
  log(`\n═══ Fertig ═══`);
  log(`Build-Jobs angelegt: ${built}`);
  log(`Übersprungen (keine E-Mail): ${skippedNoEmail}`);
  log(`Übersprungen (keine Bilder): ${skippedNoImages}`);
  log(`Übersprungen (bereits gesendet): ${skippedAlreadySent}`);
  log(`Verbleibend in Queue: ${queue.leads.length}`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
