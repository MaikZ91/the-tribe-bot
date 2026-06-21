/**
 * MZ.9 — E-Mail-Versand via Gmail SMTP
 *
 * sent.json-Schutz (Mutex + recordSent) kommt aus ./rules.js — NICHT hier.
 * Dieses Skript prüft gate-äquivalent vor Versand und ruft recordSent(id)
 * nach erfolgreicher Mail. Aufgerufen von auto.js Stufe 3 (gestaffelt).
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { isValidEmail, isEmailAlreadySent, isKanzleiSteuer, loadSent, recordSent, PREVIEW_DIR } = require('./rules');

const SCREENSHOT_SCRIPT = path.join(__dirname, 'screenshot-compare.js');
const REPO = path.join(PREVIEW_DIR, '..', '..');
const PAGES_DEPLOY_WAIT_SEC = parseInt(process.env.PAGES_DEPLOY_WAIT_SEC || '75', 10);

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
  // Zeilen, die als eigener Block (CTA/Footer) gerendert werden, im Body überspringen.
  const skip = (t) => !t || t.startsWith('👉') || t === 'Viele Grüße' || t === 'Maik'
    || t.startsWith('MZ.9') || t.startsWith('https://');
  const paras = body.split('\n').map(l => l.trim()).filter(t => !skip(t))
    .map(t => `      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2a2a35">${t}</p>`).join('\n');
  const compareBlock = lead.hasCompare
    ? `      <tr><td style="padding:22px 22px 4px">
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #ECE9E3;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.07)">
          <tr>
            <td width="50%" style="padding:0;vertical-align:top;border-right:1px solid #ECE9E3">
              <img src="cid:orig@mz9" alt="Aktuelle Website" style="width:100%;display:block">
              <div style="background:#0A0A0B;color:#F0EEE9;font-size:9px;font-weight:700;letter-spacing:.2em;text-align:center;padding:8px 4px;text-transform:uppercase">Aktuell</div>
            </td>
            <td width="50%" style="padding:0;vertical-align:top">
              <img src="cid:prev@mz9" alt="MZ.9 Konzept-Vorschau" style="width:100%;display:block">
              <div style="background:#10B981;color:#04130d;font-size:9px;font-weight:700;letter-spacing:.2em;text-align:center;padding:8px 4px;text-transform:uppercase">MZ.9 Konzept</div>
            </td>
          </tr>
        </table>
        <p style="margin:9px 0 0;font-size:11px;color:#8a8a8a;text-align:center">Vorher · Nachher — Ihre Website, neu gedacht.</p>
      </td></tr>\n`
    : '';
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#ECEAE4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a2e">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ECEAE4;padding:28px 12px">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FBFAF8;border-radius:14px;overflow:hidden;box-shadow:0 6px 28px rgba(0,0,0,.10)">
<tr><td style="background:#0A0A0B;padding:20px 28px">
  <span style="font-size:18px;font-weight:600;letter-spacing:.14em;color:#F0EEE9">MZ.<span style="color:#10B981">9</span></span>
  <span style="float:right;font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:#7C7A75;padding-top:7px">Konzept-Vorschau</span>
</td></tr>
${compareBlock}<tr><td style="padding:22px 28px 6px">
${paras}
</td></tr>
<tr><td align="center" style="padding:14px 28px 26px">
  <a href="${previewUrl}" style="display:inline-block;background:#10B981;color:#04130d;font-weight:700;font-size:15px;letter-spacing:.03em;text-decoration:none;padding:14px 30px;border-radius:10px">Zur unverbindlichen Vorschau &rarr;</a>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #ECE9E3;background:#F4F2EC">
  <p style="margin:0 0 3px;font-weight:600;color:#1a1a2e">Viele Grüße</p>
  <p style="margin:0 0 2px;color:#2a2a35">Maik</p>
  <p style="margin:0"><a href="${MZ9_URL}" style="color:#0E9C75;text-decoration:none;font-weight:600">MZ.9 — Media Engineering.AI</a></p>
  <p style="margin:10px 0 0;font-size:11px;color:#9a9a9a;line-height:1.5">Unverbindliche Konzept-Vorschau · keine Rechnung · MZ.9, Bielefeld</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { to: lead.email, subject, body, html };
}

// Vergleichsbild (Original vs. MZ.9-Preview) erzeugen, NACHDEM die Seite auf
// GitHub Pages live ist. noweb-Leads → überspringen. Fehler → Mail ohne Anhang.
async function runScreenshot(id) {
  const jobFile = path.join(PREVIEW_DIR, id, 'build-job.json');
  let website = '';
  try { website = JSON.parse(fs.readFileSync(jobFile, 'utf8')).website || ''; } catch {}
  if (!website) { console.log(`  🖼️  ${id}: kein Vergleich (noweb) — Mail ohne Anhang.`); return; }
  await new Promise(r => setTimeout(r, PAGES_DEPLOY_WAIT_SEC * 1000));
  for (let attempt = 0; attempt < 3; attempt++) {
    const ok = await new Promise(resolve => {
      exec(`node "${SCREENSHOT_SCRIPT}" ${id}`, { cwd: REPO, timeout: 120000, maxBuffer: 8 * 1024 * 1024 }, (err) => resolve(!err));
    });
    if (ok) { console.log(`  🖼️  ${id}: Vergleichsbild erstellt.`); return; }
    if (attempt < 2) { console.log(`  🖼️  ${id}: Screenshot-Versuch ${attempt + 1} fehlgeschlagen, Retry in 30s…`); await new Promise(r => setTimeout(r, 30000)); }
  }
  console.log(`  ⚠️  ${id}: Vergleichsbild nicht erstellt — Mail ohne Anhang.`);
}

async function sendHtmlMail(lead, dryRun = false) {
  // Vor dem Versand: Vergleichsbild erzeugen (Pages muss live sein). noweb → ohne.
  // Fehler blockiert den Versand nicht (Mail geht ggf. ohne Anhang raus).
  if (!dryRun) await runScreenshot(lead.id);
  // hasCompare FRISCH prüfen (nach Screenshot) — loadLeads() liefert einen
  // veralteten Wert (vor dem Screenshot war compare.png oft noch nicht da).
  const d = path.join(PREVIEW_DIR, lead.id);
  lead.hasCompare = fs.existsSync(path.join(d, 'original.png')) && fs.existsSync(path.join(d, 'preview.png'));
  const { to, subject, body, html } = buildHtmlMail(lead);
  if (!to) { console.log(`  ⚠️  Keine E-Mail für ${lead.id}`); return { success: false }; }
  if (dryRun) { console.log(`\n📧 DRY RUN → ${to}\n   ${subject}`); return { success: true }; }
  if (!SMTP.auth.pass) { console.log('  ❌ Kein SMTP-Passwort'); return { success: false }; }
  const attachments = [];
  if (lead.hasCompare) {
    const d = path.join(PREVIEW_DIR, lead.id);
    if (fs.existsSync(path.join(d, 'original.png'))) attachments.push({ filename: 'original.png', path: path.join(d, 'original.png'), cid: 'orig@mz9' });
    if (fs.existsSync(path.join(d, 'preview.png'))) attachments.push({ filename: 'preview.png', path: path.join(d, 'preview.png'), cid: 'prev@mz9' });
  }
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
    console.log(`→ ${lead.name}`);
    // Deterministische Staffelung: MAIL_DELAY_SEC (vom Loop vorgegeben, z. B.
    // 0/90/180s) → gleichmäßiger Abstand, kein Clustern. Fallback: Zufall 0–EMAIL_DELAY_MAX_MIN.
    if (!dryRun) {
      let ds = -1;
      if (process.env.MAIL_DELAY_SEC !== undefined && process.env.MAIL_DELAY_SEC !== '') {
        ds = parseInt(process.env.MAIL_DELAY_SEC, 10); if (isNaN(ds)) ds = -1;
      }
      if (ds < 0 && EMAIL_DELAY_MAX_MIN > 0) ds = Math.floor(Math.random() * EMAIL_DELAY_MAX_MIN * 60);
      if (ds > 0) { console.log(`  ⏳ ${(ds/60).toFixed(1)} Min...`); await new Promise(r => setTimeout(r, ds * 1000)); }
    }
    const r = await sendHtmlMail(lead, dryRun);
    if (r.success && !dryRun) recordSent(lead.id);
  } else {
    const open = leads.filter(l => !sent[l.id] && l.built).length;
    console.log(`\nStatus: ${open} sendbar · ${Object.keys(sent).length} gesendet`);
  }
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { buildMail, buildHtmlMail };
