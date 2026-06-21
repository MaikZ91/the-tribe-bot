// ─── Kanzlei/Steuer-Filter (eiserne Regel 2026-06-21) ─────────────
// Rechtsanwalt / Steuerberater / Kanzlei sowie artverwandte Rechts- und
// Steuerberatung werden GRUNDSÄTZLICH übersprungen — kein Discovery,
// kein Build, kein Publish, kein E-Mail-Versand. Bereits gebaute Seiten
// bleiben bestehen, werden aber nicht erneut verarbeitet.
// Zentrale Einzelquelle: publish.js / auto.js / send_mail.js / discover.js
// nutzen alle diese Funktion.
const KANZLEI_KEYWORDS = ['kanzlei', 'recht', 'steuer', 'anwalt'];
function isKanzleiSteuer(id, industry, name) {
  const hay = `${id || ''} ${industry || ''} ${name || ''}`.toLowerCase();
  return KANZLEI_KEYWORDS.some(k => hay.includes(k));
}

// ─── E-Mail-Validierung ──────────────────────────────────────────
// EISERNE REGEL: Nur Leads mit valider E-Mail bauen.
// Keine Bild-URLs, keine leeren Strings, keine kaputten Adressen.
// Placeholder-/Muster-Adressen (mustermann, beispiel, rotlicht, example …)
// werden ebenfalls abgelehnt — keine Mails an Fake-/Fremd-Domains.
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
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const e = email.trim();
  if (!e || e.length > 254) return false;
  // Basis-Regex: user@domain.tld
  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(e)) return false;
  // Bild-/Binary-Endungen als TLD ausschließen (häufiger Scraping-Fehler)
  if (/\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|woff2?|mp4|pdf|xml|json)(\?.*)?$/i.test(e)) return false;
  // Placeholder-/Fremd-Domain blocken
  if (isPlaceholderEmail(e)) return false;
  return true;
}
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
const SENT_FILE = path.join(ROOT, 'sent.json');
const MIN_BUILT_BYTES = 4000; // fertige Seiten sind deutlich größer

// ─── E-Mail-Dubletten-Prüfung ────────────────────────────────────
// Baut aus sent.json + den zugehörigen build-job.json-Dateien ein Set
// aller bereits kontaktierten E-Mail-Adressen auf.
// Cached im Modul-Scope, damit nicht pro listPending()-Aufruf neu gescannt wird.
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

// Caches zurücksetzen (nach Änderungen an sent.json / build-jobs)
function resetEmailCache() { _sentEmailsCache = null; _sentEmailsCacheTs = 0; }

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
    // ⛔ Eiserne Regel: Kanzlei/Recht/Steuer nie in die Worklist aufnehmen
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
  // Sort: mit E-Mail zuerst, dann nach ID
  out.sort((a, b) => (b.hasValidEmail - a.hasValidEmail) || a.id.localeCompare(b.id));
  return out;
}

// ─── Gebaut, aber noch nicht gemailt (Email-Backlog) ──────────────
// WICHTIG: "published" (status) bedeutet nur "Seite gepusht", NICHT
// "gemailt". Diese Funktion liefert alle gebauten Leads mit valider
// E-Mail, die nicht Kanzlei/Steuer/Placeholder sind und deren E-Mail
// noch nie versendet wurde — unabhängig vom publish-Status. Das ist
// die Arbeitliste für den Email-Drain (Stufe 3) im auto-Loop.
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

if (require.main === module) {
  const items = listPending();
  const needsBuild = items.filter(i => !i.built);
  const needsBuildValid = needsBuild.filter(i => i.hasValidEmail);
  const needsBuildNoEmail = needsBuild.filter(i => !i.hasValidEmail);
  const needsBuildAlreadySent = needsBuildValid.filter(i => i.emailAlreadySent);
  const builtNotPublished = items.filter(i => i.built && i.status !== 'published' && i.hasValidEmail && !i.emailAlreadySent);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ needsBuild: needsBuildValid.filter(i => !i.emailAlreadySent), needsBuildAlreadySent, needsBuildNoEmail, builtNotPublished }, null, 2));
  } else {
    console.log(`\n🎨 Zu bauen (Stufe 2): ${needsBuildValid.length}`);
    needsBuildValid.forEach(i => console.log(`   - ${i.id}  (${i.name}, ${i.industry}, ${i.city})`));
    if (needsBuildNoEmail.length) {
      console.log(`\n⏭️  Übersprungen (keine valide E-Mail): ${needsBuildNoEmail.length}`);
      needsBuildNoEmail.forEach(i => console.log(`   - ${i.id}  (${i.name}, ${i.industry}, ${i.city})`));
    }
    if (needsBuildAlreadySent.length) {
      console.log(`\n📬 Bereits per E-Mail kontaktiert: ${needsBuildAlreadySent.length}`);
      needsBuildAlreadySent.forEach(i => console.log(`   - ${i.id}  (${i.name}, ${i.industry}, ${i.city})  → ${i.email}`));
    }
    console.log(`\n📤 Gebaut, noch nicht publiziert (Stufe 3): ${builtNotPublished.length}`);
    builtNotPublished.forEach(i => console.log(`   - ${i.id}  (${i.name})  → node scripts/publish.js ${i.id}`));
    console.log('');
  }
}

module.exports = { listPending, listBuiltNotSent, isValidEmail, isEmailAlreadySent, isKanzleiSteuer, isPlaceholderEmail, getSentEmails, resetEmailCache };