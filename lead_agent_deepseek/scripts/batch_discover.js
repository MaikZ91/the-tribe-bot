/**
 * MZ.9 — Batch Discovery für 1000 Leads
 *
 * Iteriert durch alle Stadt×Branche-Kombos, sammelt Leads mit Website-Scraping,
 * schreibt sie in queue.json. Läuft bis Zielanzahl erreicht oder alle Kombos
 * erschöpft sind.
 *
 * Nutzung:
 *   node lead_agent_deepseek/scripts/batch_discover.js [target=1000] [concurrency=3]
 */

const { discover } = require('./discover');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const QUEUE_FILE = path.join(ROOT, 'queue.json');

const TARGET = parseInt(process.argv[2] || '1000', 10);
const CONCURRENCY = parseInt(process.argv[3] || '3', 10);

function ts() { return new Date().toLocaleTimeString('de-DE'); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }

// ─── Alle Stadt×Branche-Kombos ──────────────────────────────────
const { CITIES, BRANCH_NAMES } = require('./discover');

function allCombos() {
  const combos = [];
  for (const city of CITIES) {
    for (const branch of BRANCH_NAMES) {
      combos.push({ city, branch });
    }
  }
  // Shuffle für Abwechslung
  for (let i = combos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combos[i], combos[j]] = [combos[j], combos[i]];
  }
  return combos;
}

// ─── Bestehende Lead-IDs ────────────────────────────────────────
function existingIds() {
  const ids = new Set();
  // Aus queue.json
  try {
    const q = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    (q.leads || []).forEach(l => ids.add(l.id));
    (q.processed || []).forEach(p => ids.add(p.id));
  } catch {}
  // Aus docs/leads/
  const previewDir = path.join(ROOT, '..', 'docs', 'leads');
  try {
    fs.readdirSync(previewDir, { withFileTypes: true }).forEach(d => {
      if (d.isDirectory() && d.name !== 'dashboard') ids.add(d.name);
    });
  } catch {}
  // Aus lead_agent_deepseek/leads/
  const leadsDir = path.join(ROOT, 'leads');
  try {
    fs.readdirSync(leadsDir).forEach(f => {
      if (f.endsWith('.json')) ids.add(f.replace('.json', ''));
    });
  } catch {}
  return ids;
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  log(`═══ Batch Discovery: Ziel ${TARGET} Leads, ${CONCURRENCY} parallel ═══`);
  
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const existing = existingIds();
  const startCount = queue.leads ? queue.leads.length : 0;
  let total = queue.leads ? queue.leads.length : 0;
  
  log(`Start: ${total} Leads in Queue, ${existing.size} existierende IDs bekannt.`);
  
  const combos = allCombos();
  log(`${combos.length} Stadt×Branche-Kombos verfügbar.\n`);
  
  let comboIdx = 0;
  let rounds = 0;
  let totalFound = 0;
  
  while (total < TARGET && comboIdx < combos.length) {
    // Batch von CONCURRENCY parallelen Discovery-Calls
    const batch = [];
    for (let i = 0; i < CONCURRENCY && comboIdx < combos.length; i++, comboIdx++) {
      batch.push(combos[comboIdx]);
    }
    
    const results = await Promise.allSettled(
      batch.map(({ city, branch }) => 
        discover({ city, branch, count: 6, log: () => {} })
      )
    );
    
    for (let i = 0; i < results.length; i++) {
      rounds++;
      const { city, branch } = batch[i];
      const result = results[i];
      
      if (result.status === 'rejected') {
        if (rounds % 10 === 0) log(`  ⚠️  ${city} × ${branch}: Fehler — ${result.reason?.message || result.reason}`);
        continue;
      }
      
      const leads = result.value || [];
      const newLeads = leads.filter(l => !existing.has(l.id));
      
      if (newLeads.length > 0) {
        // Nur Leads mit E-Mail UND Bildern aufnehmen
        const valid = newLeads.filter(l => l.email && l.images && l.images.length > 0);
        
        for (const lead of valid) {
          if (total >= TARGET) break;
          existing.add(lead.id);
          queue.leads.push(lead);
          total++;
          totalFound++;
        }
      }
      
      if (rounds % 5 === 0 && totalFound > 0) {
        log(`  Runde ${rounds}: ${totalFound} neue Leads gesamt (Queue: ${total}, Ziel: ${TARGET}) — zuletzt ${city} × ${branch}: ${newLeads.length} gefunden, ${leads.filter(l => l.email && l.images?.length).length} valide`);
      }
    }
    
    // Zwischenspeichern alle 50 Leads
    if (totalFound > 0 && totalFound % 50 === 0) {
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
      log(`💾 Gespeichert: ${total} Leads in Queue (Runde ${rounds}/${combos.length})`);
    }
    
    // Overpass-Rate-Limit: kurze Pause zwischen Batches
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Finales Speichern
  queue.settings = queue.settings || {};
  queue.settings.lastBatchDiscovery = new Date().toISOString();
  queue.settings.batchTarget = TARGET;
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  
  log(`\n═══ Fertig ═══`);
  log(`Runden: ${rounds} | Neue Leads: ${totalFound} | Queue gesamt: ${total} | Ziel: ${TARGET}`);
  log(`Nächster Schritt: node lead_agent_deepseek/scripts/daemon.js --once (Build-Jobs anlegen)`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
