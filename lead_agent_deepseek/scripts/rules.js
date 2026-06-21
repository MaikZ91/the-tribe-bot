/**
 * MZ.9 Lead Agent — RULES.js  (EINZIGE WAHRHEITSQUELLE FÜR ALLE REGELN)
 * =====================================================================
 *
 * Jedes andere Skript (auto.js, discover.js, send_mail.js) importiert seine
 * Regeln HIER. Es gibt KEINE zweite Kopie von isValidEmail / isEmailAlreadySent /
 * sent.json-Schutz irgendwo sonst. Wer eine Regel ändert, ändert sie NUR hier.
 *
 * ── DIE EISENERNEN REGELN (gelten an JEDEM Gate: Discover → Build-Job →
 *    Build → Publish → Mail) ──────────────────────────────────────────────
 *
 *  1. KANZLEI/RECHT/STEUER/ANWALT  → niemals verarbeiten
 *     (isKanzleiSteuer: prüft id + industry + name auf Keywords)
 *  2. PLACEHOLDER-MAILS            → niemals bauen/mailen
 *     (isPlaceholderEmail: mustermann, beispiel, rotlicht, example, …)
 *  3. SENT.JSON-DEDUP              → jede Adresse genau einmal
 *     (isEmailAlreadySent + recordSent; geprüft an jedem Gate)
 *  4. SENT.JSON SCHUTZ             → race-sicher (.sent.lock-Mutex)
 *                                  + autostash-sicher (auto.js committet
 *                                    zuerst, dann pull --rebase OHNE autostash)
 *  5. ORIGINALBILDER PFLICHT       → kein Bild → kein Build-Job, keine
 *                                    bildlose/Stock-Seite
 *
 * gate(lead) ist die EINE Sendefähigkeits-Prüfung, die alle Regeln bündelt.
 *
 * CLI:
 *   node scripts/rules.js          → menschenlesbare Pending-Liste
 *   node scripts/rules.js --json   → JSON
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');                 // lead_agent_deepseek/
const PREVIEW_DIR = path.join(ROOT, '..', 'docs', 'leads'); // docs/leads/
const SENT_FILE = path.join(ROOT, 'sent.json');
const SENT_LOCK = path.join(ROOT, '.sent.lock');
const ENV_FILE = path.join(ROOT, '.env');
const LOCKFILE = path.join(ROOT, '.auto.lock');
const MIN_BUILT_BYTES = 4000; // fertige Seiten sind deutlich größer

// ─── Regel 1: Kanzlei/Recht/Steuer/Anwalt ──────────────────────────
const KANZLEI_KEYWORDS = ['kanzlei', 'recht', 'steuer', 'anwalt'];
function isKanzleiSteuer(id, industry, name) {
  const hay = `${id || ''} ${industry || ''} ${name || ''}`.toLowerCase();
  return KANZLEI_KEYWORDS.some(k => hay.includes(k));
}

// ─── Regel 2: Placeholder-/Muster-Adressen ────────────────────────
const PLACEHOLDER_LOCAL = /mustermann|musterfirma|beispiel|placeholder|dummy|testuser|testaccount|john\.?doe|max\.mustermann/i;
const PLACEHOLDER_DOMAINS = new Set(['beispiel.de', 'example.com', 'example.de', 'example.org', 'test.de', 'rotlicht.de', 'domain.tld', 'domain.de', 'email.com']);
function isPlaceholderEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 0) return false;
  if (PLACEHOLDER_LOCAL.test(e.slice(0, at))) return true;
  if (PLACEHOLDER_DOMAINS.has(e.slice(at + 1))) return true;
  return false;
}

// ─── Kanonische E-Mail-Validierung ────────────────────────────────
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const e = email.trim();
  if (!e || e.length > 254) return false;
  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(e)) return false;
  // Bild-/Binary-Endungen als TLD ausschließen (häufiger Scraping-Fehler)
  if (/\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|woff2?|mp4|pdf|xml|json)(\?.*)?$/i.test(e)) return false;
  if (isPlaceholderEmail(e)) return false;
  return true;
}

// ─── sent.json laden/schreiben (Regel 3+4) ────────────────────────
function loadSent() { try { return JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')); } catch { return {}; } }
function saveSent(sent) { fs.writeFileSync(SENT_FILE, JSON.stringify(sent, null, 2)); }

// Mutex um sent.json — keine lost updates bei konkurrenten Versende-Prozessen.
// Exklusives Lock via 'wx' (Create-new). Kurz spinnden, bis frei.
function withSentLock(fn) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try { fs.writeFileSync(SENT_LOCK, String(process.pid), { flag: 'wx' }); break; }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
    const t = Date.now(); while (Date.now() - t < 50) {} // kurzer Backoff
  }
  try { return fn(); } finally { try { fs.unlinkSync(SENT_LOCK); } catch {} }
}

// Frisch laden + schreiben UNTER LOCK — race-sicher. Einzige Stelle, die
// sent.json verändert. Wird von send_mail.js nach erfolgreicher Mail gerufen.
function recordSent(id) {
  return withSentLock(() => {
    const sent = loadSent();
    if (!sent[id]) { sent[id] = new Date().toISOString(); saveSent(sent); }
    resetEmailCache();
  });
}

// ─── Regel 3: E-Mail-Dubletten-Prüfung (gecached) ─────────────────
// Baut aus sent.json + den zugehörigen build-job.json-Dateien ein Set aller
// bereits kontaktierten E-Mail-Adressen auf. 30 s gecached.
let _sentEmailsCache = null;
let _sentEmailsCacheTs = 0;
const SENT_EMAILS_CACHE_MS = 30_000;

function getSentEmails() {
  const now = Date.now();
  if (_sentEmailsCache && (now - _sentEmailsCacheTs) < SENT_EMAILS_CACHE_MS) return _sentEmailsCache;
  const emails = new Set();
  try {
    const sent = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'));
    for (const id of Object.keys(sent)) {
      try {
        const jf = path.join(PREVIEW_DIR, id, 'build-job.json');
        if (fs.existsSync(jf)) {
          const job = JSON.parse(fs.readFileSync(jf, 'utf8'));
          const email = (job.email || '').trim().toLowerCase();
          if (email && email.includes('@')) emails.add(email);
        }
      } catch {}
    }
  } catch {}
  _sentEmailsCache = emails;
  _sentEmailsCacheTs = now;
  return emails;
}

function isEmailAlreadySent(email) {
  if (!email) return false;
  return getSentEmails().has(email.trim().toLowerCase());
}

function resetEmailCache() { _sentEmailsCache = null; _sentEmailsCacheTs = 0; }

// ─── gate(lead): DIE Sendefähigkeits-Prüfung (bündelt alle Regeln) ─
// lead braucht: { id, industry, name, email, images[] }
// returns { ok: boolean, reason: string }
function gate(lead) {
  const no = (reason) => ({ ok: false, reason });
  if (isKanzleiSteuer(lead.id, lead.industry, lead.name)) return no('kanzlei');
  if (!isValidEmail(lead.email))                       return no('email');
  if (isPlaceholderEmail(lead.email))                  return no('placeholder');
  if (isEmailAlreadySent(lead.email))                  return no('already-sent');
  if (!lead.images || lead.images.length === 0)        return no('no-images');
  return { ok: true, reason: 'ok' };
}

// ─── Preflight (Startup-Check: „immer abgeglichen") ───────────────
// Loggt sent.json-Stand, SMTP-Passwort, Lock-Status. Gibt Zusammenfassung zurück.
function preflight(log = console.log) {
  const sum = { sent: 0, smtp: false, lockFree: true };
  try {
    const sent = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'));
    sum.sent = Object.keys(sent).length;
  } catch (e) { log(`⚠️  sent.json nicht lesbar: ${e.message}`); }
  try {
    const env = fs.readFileSync(ENV_FILE, 'utf8');
    sum.smtp = /MZ9_SMTP_PASS\s*=\s*\S+/.test(env);
  } catch {}
  try { if (fs.existsSync(LOCKFILE)) sum.lockFree = false; } catch {}
  log(`🧪 Preflight — sent.json: ${sum.sent} · SMTP-Passwort: ${sum.smtp ? 'ok' : 'FEHLT'} · Lock: ${sum.lockFree ? 'frei' : 'belegt'}`);
  return sum;
}

// ─── Lead-Listen für den Loop ─────────────────────────────────────
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
    // ⛔ Regel 1: Kanzlei/Recht/Steuer nie in die Worklist
    if (isKanzleiSteuer(d.name, job.industry, job.name)) continue;
    const indexFile = path.join(dir, 'index.html');
    let built = false;
    try { built = fs.existsSync(indexFile) && fs.statSync(indexFile).size >= MIN_BUILT_BYTES; } catch {}
    const email = job.email || '';
    const hasValidEmail = isValidEmail(email);
    const emailAlreadySent = hasValidEmail && isEmailAlreadySent(email);
    const images = (job.images || []).length;
    out.push({ id: d.name, name: job.name, industry: job.industry, city: job.city, status: job.status, built, jobFile, indexFile, email, hasValidEmail, emailAlreadySent, images });
  }
  out.sort((a, b) => (b.hasValidEmail - a.hasValidEmail) || a.id.localeCompare(b.id));
  return out;
}

// Gebaut, aber noch nicht gemailt (Email-Backlog). „published" heißt nur
// „Seite gepusht", NICHT „gemailt" — diese Liste ist die Arbeitliste für
// Stufe 3, unabhängig vom publish-Status.
function listBuiltNotSent() {
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
    if (isKanzleiSteuer(d.name, job.industry, job.name)) continue;
    const email = job.email || '';
    if (!isValidEmail(email)) continue;
    const indexFile = path.join(dir, 'index.html');
    let built = false;
    try { built = fs.existsSync(indexFile) && fs.statSync(indexFile).size >= MIN_BUILT_BYTES; } catch {}
    if (!built) continue;
    if (isEmailAlreadySent(email)) continue;
    out.push({ id: d.name, name: job.name, industry: job.industry, city: job.city, status: job.status, email, images: (job.images || []).length });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

// ─── CLI ──────────────────────────────────────────────────────────
if (require.main === module) {
  const items = listPending();
  const needsBuild = items.filter(i => !i.built);
  const needsBuildValid = needsBuild.filter(i => i.hasValidEmail && !i.emailAlreadySent);
  const needsBuildNoEmail = needsBuild.filter(i => !i.hasValidEmail);
  const needsBuildAlreadySent = needsBuild.filter(i => i.emailAlreadySent);
  const builtNotPublished = items.filter(i => i.built && i.status !== 'published' && i.hasValidEmail && !i.emailAlreadySent);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ needsBuild: needsBuildValid, needsBuildAlreadySent, needsBuildNoEmail, builtNotPublished }, null, 2));
  } else {
    console.log(`\n🎨 Zu bauen (Stufe 2): ${needsBuildValid.length}`);
    needsBuildValid.forEach(i => console.log(`   - ${i.id}  (${i.name}, ${i.industry}, ${i.city})`));
    if (needsBuildNoEmail.length) {
      console.log(`\n⏭️  Übersprungen (keine valide E-Mail): ${needsBuildNoEmail.length}`);
      needsBuildNoEmail.forEach(i => console.log(`   - ${i.id}  (${i.name}, ${i.industry}, ${i.city})`));
    }
    if (needsBuildAlreadySent.length) {
      console.log(`\n📬 Bereits per E-Mail kontaktiert: ${needsBuildAlreadySent.length}`);
      needsBuildAlreadySent.forEach(i => console.log(`   - ${i.id}  (${i.name})  → ${i.email}`));
    }
    console.log(`\n📤 Gebaut, noch nicht publiziert (Stufe 3): ${builtNotPublished.length}`);
    builtNotPublished.forEach(i => console.log(`   - ${i.id}  (${i.name})`));
    console.log('');
  }
}

module.exports = {
  // Pfade (für auto.js)
  ROOT, PREVIEW_DIR, SENT_FILE, LOCKFILE, MIN_BUILT_BYTES,
  // Regeln
  isKanzleiSteuer, isPlaceholderEmail, isValidEmail,
  // sent.json
  loadSent, saveSent, withSentLock, recordSent,
  getSentEmails, isEmailAlreadySent, resetEmailCache,
  // gate + preflight
  gate, preflight,
  // Listen
  listPending, listBuiltNotSent,
};
