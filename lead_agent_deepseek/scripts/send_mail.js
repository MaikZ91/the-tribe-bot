/**
 * MZ.9 — E-Mail-Versand via Gmail SMTP
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { isValidEmail, isEmailAlreadySent, isKanzleiSteuer } = require('./pending');

function loadEnv() {
  const envFile = path.join(__dirname, '..', '.env');
  try {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {}
}
loadEnv();

const ROOT = path.join(__dirname, '..');
const SENT_FILE = path.join(ROOT, 'sent.json');
const PREVIEW_DIR = path.join(ROOT, '..', 'docs', 'leads');

const EMAIL_DELAY_MAX_MIN = parseInt(process.env.EMAIL_DELAY_MAX_MIN || '10', 10);
const MZ9_URL = 'https://maikz91.github.io/the-tribe-bot/mz9';

const SMTP = {
  host: process.env.MZ9_SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MZ9_SMTP_PORT || '587'),
  secure: process.env.MZ9_SMTP_SECURE === 'true',
  auth: { user: process.env.MZ9_SMTP_USER || 'mzschach@googlemail.com', pass: process.env.MZ9_SMTP_PASS || '' },
};

const FROM = {
  name: process.env.MZ9_FROM_NAME || 'Maik Zschach — MZ.9',
  email: process.env.MZ9_FROM_EMAIL || 'mzschach@googlemail.com',
};

function loadSent() { try { return JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')); } catch { return {}; } }
function saveSent(sent) { fs.writeFileSync(SENT_FILE, JSON.stringify(sent, null, 2)); }

// ─── Mutex um sent.json (keine lost updates bei konkurrenten Versande) ───
const SENT_LOCK = path.join(ROOT, '.sent.lock');
function withSentLock(fn) {
  // Exklusives Lock via 'wx' (Create-new). Spinnt kurz, bis frei.
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try { fs.writeFileSync(SENT_LOCK, String(process.pid), { flag: 'wx' }); break; }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
    const t = Date.now(); while (Date.now() - t < 50) {} // kurzer Backoff
  }
  try { return fn(); } finally { try { fs.unlinkSync(SENT_LOCK); } catch {} }
}
// Frisch laden + schreiben unter Lock — race-sicher.
function recordSent(id) {
  return withSentLock(() => {
    const sent = loadSent();
    if (!sent[id]) { sent[id] = new Date().toISOString(); saveSent(sent); }
  });
}

function loadLeads() {
  const leads = [];
  let dirs = [];
  try { dirs = fs.readdirSync(PREVIEW_DIR, { withFileTypes: true }); } catch { return leads; }
  for (const d of dirs) {
    if (!d.isDirectory() || d.name === 'dashboard') continue;
    const jobFile = path.join(PREVIEW_DIR, d.name, 'build-job.json');
    if (!fs.existsSync(jobFile)) continue;
    try {
      const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
      if (isKanzleiSteuer(job.id, job.industry, job.name)) continue; // ⛔ Kanzleien, Recht, Steuer
      const idxFile = path.join(PREVIEW_DIR, d.name, 'index.html');
      let built = false;
      try { built = fs.statSync(idxFile).size > 2000; } catch {}
      leads.push({
        id: job.id, name: job.name, industry: job.industry || 'Dienstleistung',
        website: job.website || '', email: (isValidEmail(job.email) ? job.email : ''),
        rawEmail: job.email || '', phone: job.phone || '',
        problems: job.problems || [], opps: job.opps || [],
        preview: `https://maikz91.github.io/the-tribe-bot/leads/${job.id}/`,
        noweb: !job.website, built,
      });
      const compareFile = path.join(PREVIEW_DIR, d.name, 'compare.png');
      leads[leads.length - 1].hasCompare = fs.existsSync(compareFile);
    } catch {}
  }
  return leads;
}

function oppsFromProblems(problems) {
  if (!problems || problems.length === 0) return ['Moderner, frischer Web-Auftritt', 'Bessere Sichtbarkeit bei Google'];
  const map = {
    'WordPress': 'Moderne, wartungsarme Website ohne Baukasten-Risiko',
    'Kein HTTPS': 'Sichere HTTPS-Verbindung für Vertrauen & Google-Ranking',
    'Kein Kontaktformular': 'Direktes Kontaktformular für mehr Anfragen',
    'Veralteter Website-Baukasten': 'Maßgeschneiderte Seite statt generischem Baukasten',
    'Wenig Bildmaterial': 'Hochwertige Bildsprache, die Ihr Handwerk zeigt',
    'Sehr einfaches Design': 'Professionelles Design mit Wiedererkennungswert',
  };
  const opps = [];
  for (const p of problems) {
    for (const [key, val] of Object.entries(map)) { if (p.includes(key)) { opps.push(val); break; } }
  }
  return opps.length > 0 ? [...new Set(opps)] : ['Moderner, frischer Web-Auftritt', 'Bessere Sichtbarkeit bei Google'];
}

const SIG = `Viele Grüße\nMaik\nMZ.9 — Media Engineering.AI\n${MZ9_URL}`;

function buildMail(lead) {
  const subject = lead.noweb
    ? `Ihre eigene Website — Konzept-Vorschau für ${lead.name}`
    : `Konzept-Vorschau für Ihre Website — ${lead.name}`;
  let body;
  if (lead.noweb) {
    body = `Hallo liebes ${lead.name}-Team,\n\nich bin über Ihren Eintrag gestolpert und habe gesehen, dass Sie noch keine eigene Website haben — schade eigentlich, denn was Sie machen, hat definitiv einen guten Auftritt verdient.\n\nIch habe Ihnen dafür eine unverbindliche Vorschau erstellt, wie eine Website für Sie aussehen könnte:\n\n👉 Zur Vorschau: ${lead.preview}\n\nIm Vergleich zu einem reinen Google-Eintrag sieht man ziemlich schnell, was eine eigene Seite für Wirkung und Professionalität bringt.\n\nFalls es interessant für Sie ist, kann ich Ihnen gern kurz erklären, was ich konkret gemacht habe — wenn nicht, einfach ignorieren.\n\n${SIG}`;
  } else {
    body = `Hallo liebes ${lead.name}-Team,\n\nich bin über Ihre Website gestolpert und habe mir kurz angeschaut, wie Ihr Auftritt online etwas klarer und moderner wirken könnte.\n\nIch habe Ihnen dafür eine unverbindliche Vorschau erstellt, wie eine alternative Struktur aussehen könnte:\n\n👉 Zur Vorschau: ${lead.preview}\n\nIm direkten Vergleich zur aktuellen Seite sieht man ziemlich schnell, wo man mit kleinen Anpassungen mehr Klarheit und Wirkung erzeugen kann.\n\nFalls es interessant für Sie ist, kann ich Ihnen gern kurz erklären, was ich konkret verändert habe — wenn nicht, einfach ignorieren.\n\n${SIG}`;
  }
  return { to: lead.email, subject, body };
}

function buildHtmlMail(lead) {
  const { subject, body } = buildMail(lead);
  const previewUrl = lead.preview;
  const lines = body.split('\n');
  let h = '';
  for (const line of lines) {
    const t = line.trim();
    if (!t) { h += '<br>\n'; }
    else if (t.startsWith('👉')) { h += `<p style="margin:12px 0"><a href="${previewUrl}" style="color:#2563eb;font-weight:600;font-size:16px;text-decoration:none">👉 Zur unverbindlichen Vorschau</a></p>\n`; }
    else if (t === 'Viele Grüße') { h += `<p style="margin:18px 0 4px;color:#333">${t}</p>\n`; }
    else if (t === 'Maik') { h += `<p style="margin:0;color:#333">${t}</p>\n`; }
    else if (t.startsWith('MZ.9')) { h += `<p style="margin:0"><a href="${MZ9_URL}" style="color:#2563eb;text-decoration:none;font-weight:600">MZ.9 — Media Engineering.AI</a></p>\n`; }
    else if (t.startsWith('https://')) { continue; }
    else { h += `<p style="margin:8px 0;color:#333">${t}</p>\n`; }
  }
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a2e;line-height:1.6">${lead.hasCompare ? `<div style="margin:0 0 24px;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)"><img src="cid:compare@mz9" alt="Vorher/Nachher Vergleich" style="width:100%;display:block"></div><p style="font-size:12px;color:#888;margin:-16px 0 20px;text-align:center">Links: Aktuelle Website · Rechts: MZ.9 Konzept-Vorschau</p>` : ''}${h}</body></html>`;
  return { to: lead.email, subject, body, html };
}

async function sendHtmlMail(lead, dryRun = false) {
  const { to, subject, body, html } = buildHtmlMail(lead);
  if (!to) { console.log(`  ⚠️  Keine E-Mail für ${lead.id}`); return { success: false }; }
  if (dryRun) { console.log(`\n📧 DRY RUN → ${to}\n   ${subject}`); return { success: true }; }
  if (!SMTP.auth.pass) { console.log('  ❌ Kein SMTP-Passwort'); return { success: false }; }
  const attachments = [];
  const cf = path.join(PREVIEW_DIR, lead.id, 'compare.png');
  if (fs.existsSync(cf)) attachments.push({ filename: 'compare.png', path: cf, cid: 'compare@mz9' });
  const t = nodemailer.createTransport(SMTP);
  try {
    const info = await t.sendMail({ from: `"${FROM.name}" <${FROM.email}>`, to, subject, text: body, html, attachments });
    console.log(`  ✅ HTML-Mail → ${to}`);
    return { success: true };
  } catch (err) { console.log(`  ❌ ${err.message}`); return { success: false }; }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sendAll = args.includes('--all');
  const targetId = args.find(a => !a.startsWith('--'));
  const leads = loadLeads().filter(l => l.email);
  const sent = loadSent();
  console.log(`📧 ${leads.length} Leads | ${Object.keys(sent).length} gesendet`);
  if (sendAll) {
    const pending = leads.filter(l => !sent[l.id] && !isEmailAlreadySent(l.email));
    for (const lead of pending) {
      console.log(`→ ${lead.name}`);
      const r = await sendHtmlMail(lead, dryRun);
      if (r.success && !dryRun) recordSent(lead.id);
      // Keine Batch-Pause — E-Mails werden einzeln via auto.js mit 0–10 Min Staffelung versendet.
    }
  } else if (targetId) {
    const lead = leads.find(l => l.id === targetId);
    if (!lead) { console.log(`❌ "${targetId}" nicht gefunden`); return; }
    if (isKanzleiSteuer(lead.id, lead.industry, lead.name)) { console.log('⛔  Kanzlei/Recht/Steuer — blockiert'); return; }
    if (sent[targetId] && !dryRun) { console.log('⚠️  Bereits gesendet'); return; }
    console.log(`→ ${lead.name} ${lead.hasCompare?'🖼️':''}`);
    if (!dryRun && EMAIL_DELAY_MAX_MIN > 0) {
      const ds = Math.floor(Math.random() * EMAIL_DELAY_MAX_MIN * 60);
      console.log(`  ⏳ ${(ds/60).toFixed(1)} Min...`);
      await new Promise(r => setTimeout(r, ds * 1000));
    }
    const r = await sendHtmlMail(lead, dryRun);
    if (r.success && !dryRun) recordSent(lead.id);
  } else {
    const open = leads.filter(l => !sent[l.id] && l.built).length;
    console.log(`\nStatus: ${open} sendbar · ${Object.keys(sent).length} gesendet`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
