/**
 * MZ.9 Lead Agent — Bounce-Check + automatischer Neuversand
 * =====================================================================
 * Prüft über die AgentMail-API, welche versendeten Mails GEBOUNCT sind,
 * und verschickt sie EINMAL PRO LAUF an eine alternative, plausible
 * Domain-Adresse neu (info@ / kontakt@ / .de↔.com-Variante).
 *
 * Reputationsschutz: pro Lead werden max. MAX_TRIES Adressen probiert
 * (inkl. der ursprünglich gebouncten). Danach wird der Lead als
 * "bounce-final" geflaggt und NICHT weiter angefunkt — lieber manuell klären
 * als die Absender-Reputation mit Bounce-Serien verbrennen.
 *
 * Nutzung:
 *   node lead_agent_deepseek/scripts/check_bounces.js            (prüfen + 1 Retry je Lead)
 *   node lead_agent_deepseek/scripts/check_bounces.js --dry-run  (nur anzeigen, nichts senden)
 *
 * Env: AGENTMAIL_API_KEY (aus .env geerbt), optional AGENTMAIL_INBOX/BASE.
 * Zustand: lead_agent_deepseek/.bounce-state.json (welche Adressen je Lead
 * schon probiert wurden) — überlebt Sessions, verhindert Endlos-Retries.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const SCRIPTS = __dirname;
const ROOT = path.join(SCRIPTS, '..');            // lead_agent_deepseek/
const REPO = path.join(ROOT, '..');
const PREVIEW_DIR = path.join(REPO, 'docs', 'leads');
const SENT_FILE = path.join(ROOT, 'sent.json');
const STATE_FILE = path.join(ROOT, '.bounce-state.json');
const MAX_TRIES = 3;                              // inkl. ursprünglicher Adresse

// ─── .env laden (AGENTMAIL_API_KEY) ───────────────────────────────
(function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
      const t = line.trim(); if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('='); if (eq < 0) continue;
      const k = t.slice(0, eq).trim(); if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
    }
  } catch {}
})();

const AGENTMAIL = {
  apiKey: process.env.AGENTMAIL_API_KEY || '',
  inbox: process.env.AGENTMAIL_INBOX || 'mz9-media-engineering-ai@agentmail.to',
  base: process.env.AGENTMAIL_BASE || 'https://api.agentmail.to/v0',
};

function log(m) { console.log(`[bounce] ${m}`); }
const lc = (s) => String(s || '').toLowerCase();
function loadJson(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } }
function saveJson(f, o) { fs.writeFileSync(f, JSON.stringify(o, null, 2)); }

// ─── AgentMail: GET ───────────────────────────────────────────────
function apiGet(p) {
  return new Promise((resolve, reject) => {
    https.get(AGENTMAIL.base + p, { headers: { Authorization: `Bearer ${AGENTMAIL.apiKey}` } }, (res) => {
      let s = ''; res.on('data', d => s += d);
      res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(new Error('parse: ' + s.slice(0, 120))); } });
    }).on('error', reject);
  });
}

// Alle gebouncten Empfänger-Adressen der Inbox sammeln (mehrere Seiten).
async function bouncedRecipients() {
  const inbox = encodeURIComponent(AGENTMAIL.inbox);
  const out = new Set();
  let token = '';
  for (let page = 0; page < 10; page++) {
    const q = `/inboxes/${inbox}/messages?limit=100${token ? `&page_token=${encodeURIComponent(token)}` : ''}`;
    let data; try { data = await apiGet(q); } catch (e) { log(`API-Fehler: ${e.message}`); break; }
    const msgs = data.messages || data.data;
    if (!Array.isArray(msgs)) { log(`⚠️  Unerwartete API-Antwort (${JSON.stringify(data).slice(0, 120)}) — evtl. Rate-Limit. Abbruch.`); break; }
    for (const m of msgs) {
      const labels = (m.labels || []).map(lc);
      if (!labels.includes('bounced')) continue;
      const to = [].concat(m.to || m.recipients || []).map(x => String(x));
      for (const addr of to) {
        const e = (addr.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [])[0];
        if (e) out.add(lc(e));
      }
    }
    token = data.next_page_token || data.next_cursor || '';
    if (!token || msgs.length === 0) break;
  }
  return [...out];
}

// ─── Lead zu einer (gebouncten) Adresse finden ────────────────────
function allJobs() {
  const jobs = [];
  let dirs = []; try { dirs = fs.readdirSync(PREVIEW_DIR, { withFileTypes: true }); } catch { return jobs; }
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const f = path.join(PREVIEW_DIR, d.name, 'build-job.json');
    const j = loadJson(f, null); if (j && j.id) jobs.push({ file: f, job: j });
  }
  return jobs;
}
function domainOf(url) {
  try { return new URL(String(url).startsWith('http') ? url : 'http://' + url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

// Alternative Adresse wählen, die noch nicht probiert wurde.
function pickCandidate(job, tried) {
  const triedL = (tried || []).map(lc);
  const dom = domainOf(job.website);
  const cands = [];
  if (dom) {
    cands.push(`info@${dom}`, `kontakt@${dom}`);
    const sib = dom.endsWith('.com') ? dom.slice(0, -4) + '.de'
      : dom.endsWith('.de') ? dom.slice(0, -3) + '.com' : '';
    if (sib) cands.push(`info@${sib}`, `kontakt@${sib}`);
  }
  return cands.find(c => !triedL.includes(lc(c))) || null;
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!AGENTMAIL.apiKey) { log('Kein AGENTMAIL_API_KEY — Abbruch.'); process.exit(1); }

  const bounced = await bouncedRecipients();
  log(`${bounced.length} gebouncte Adresse(n) bei AgentMail gefunden.`);
  if (!bounced.length) return;

  const jobs = allJobs();
  const state = loadJson(STATE_FILE, {});   // { leadId: { tried:[...], final:false } }
  let retried = 0;

  for (const addr of bounced) {
    // Lead über build-job.email ODER bereits probierte Adresse zuordnen.
    const match = jobs.find(({ job }) => lc(job.email) === addr)
      || jobs.find(({ job }) => (state[job.id]?.tried || []).map(lc).includes(addr));
    if (!match) { log(`⚠️  ${addr}: kein Lead zugeordnet — übersprungen.`); continue; }
    const { file, job } = match;
    const st = state[job.id] || { tried: [], final: false };
    if (!st.tried.map(lc).includes(addr)) st.tried.push(addr);

    if (st.final) { continue; }
    if (st.tried.length >= MAX_TRIES) {
      st.final = true; state[job.id] = st; log(`⛔ ${job.id}: ${st.tried.length} Adressen erfolglos — als final geflaggt (manuell klären).`);
      continue;
    }

    const cand = pickCandidate(job, st.tried);
    if (!cand) { st.final = true; state[job.id] = st; log(`⛔ ${job.id}: keine plausible Alternativadresse mehr — final.`); continue; }

    log(`↻ ${job.id}: ${addr} gebounct → Neuversuch an ${cand}${dryRun ? ' (dry-run)' : ''}`);
    if (!dryRun) {
      // build-job-Adresse aktualisieren, aus sent.json lösen, neu senden.
      try {
        job.email = cand; saveJson(file, job);
        const sent = loadJson(SENT_FILE, {}); delete sent[job.id]; saveJson(SENT_FILE, sent);
        execFileSync('node', [path.join(SCRIPTS, 'send_mail.js'), job.id], {
          cwd: REPO, stdio: 'inherit',
          env: { ...process.env, PAGES_DEPLOY_WAIT_SEC: '3', MAIL_DELAY_SEC: '0' },
        });
        retried++;
      } catch (e) { log(`  Fehler beim Neuversand ${job.id}: ${e.message}`); }
    }
    st.tried.push(cand);
    state[job.id] = st;
  }

  if (!dryRun) saveJson(STATE_FILE, state);
  log(`Fertig. ${retried} Neuversand/e ausgelöst.`);
}

main().catch(e => { console.error('[bounce] FATAL', e.message); process.exit(1); });
