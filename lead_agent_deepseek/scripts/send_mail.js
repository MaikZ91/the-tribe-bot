/**
 * MZ.9 — E-Mail-Versand via AgentMail (E-Mail-API für Agenten)
 *
 * sent.json-Schutz (Mutex + recordSent) kommt aus ./rules.js — NICHT hier.
 * Dieses Skript prüft gate-äquivalent vor Versand und ruft recordSent(id)
 * nach erfolgreicher Mail. Aufgerufen von auto.js Stufe 3 (gestaffelt).
 */

// Versand läuft ausschließlich über AgentMail (E-Mail-API für Agenten) —
// kein nodemailer/SMTP mehr. Damit läuft der Versand auch ohne installiertes
// node_modules (z. B. Cloud-Container) und ohne Gmail-App-Passwort.
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { isValidEmail, isEmailAlreadySent, isKanzleiSteuer, loadSent, recordSent, resetEmailCache, PREVIEW_DIR } = require('./rules');

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

// ─── AgentMail (E-Mail-API für Agenten) — einziger Versandweg ─────
// Absender = Display-Name + Adresse der Inbox (in AgentMail konfiguriert,
// aktuell „Maik Zschach <mz9-media-engineering-ai@agentmail.to>").
const AGENTMAIL = {
  apiKey: process.env.AGENTMAIL_API_KEY || '',
  inbox: process.env.AGENTMAIL_INBOX || 'mz9-media-engineering-ai@agentmail.to',
  base: process.env.AGENTMAIL_BASE || 'https://api.agentmail.to/v0',
};

// Nodemailer-Attachments ({filename, path, cid}) → AgentMail SendAttachment
// ({filename, content_type, content_disposition, content_id, content:base64}).
// cid → Inline-Bild (content_disposition "inline" + content_id), damit der
// Vorher/Nachher-Vergleich im HTML (cid:orig@mz9 / cid:prev@mz9) gerendert wird.
function toAgentMailAttachments(attachments) {
  const guessType = (f) => /\.png$/i.test(f) ? 'image/png'
    : /\.jpe?g$/i.test(f) ? 'image/jpeg' : 'application/octet-stream';
  return (attachments || []).map(a => {
    const out = {
      filename: a.filename,
      content_type: a.contentType || guessType(a.filename || ''),
      content: fs.readFileSync(a.path).toString('base64'),
    };
    if (a.cid) { out.content_disposition = 'inline'; out.content_id = a.cid; }
    return out;
  });
}

// Versand über AgentMail. Liefert {success: bool} an die Aufrufer zurück.
async function sendViaAgentMail({ to, subject, text, html, attachments }) {
  const url = `${AGENTMAIL.base}/inboxes/${encodeURIComponent(AGENTMAIL.inbox)}/messages/send`;
  const payload = { to, subject, text, html };
  const am = toAgentMailAttachments(attachments);
  if (am.length) payload.attachments = am;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AGENTMAIL.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.log(`  ❌ AgentMail ${res.status}: ${detail.slice(0, 180)}`);
      return { success: false };
    }
    const data = await res.json().catch(() => ({}));
    console.log(`  ✅ AgentMail → ${to}${data.message_id ? ` (${data.message_id})` : ''}`);
    return { success: true };
  } catch (err) {
    console.log(`  ❌ AgentMail-Fehler: ${err.message}`);
    return { success: false };
  }
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

// ─── Rechtskonformer Footer (Impressum §5 DDG + Datenschutz + Widerspruch) ──
const IMPRESSUM_URL = MZ9_URL.replace(/mz9$/, 'impressum.html');
const DATENSCHUTZ_URL = MZ9_URL.replace(/mz9$/, 'datenschutz.html');
const DEMO_NOTICE = 'Diese Website dient ausschließlich der Demonstration eines Konzeptes und wird nicht als dauerhaftes geschäftliches Angebot betrieben.';
const LEGAL_TEXT = `\n— Impressum —\nMaik Zschach · Merianstr. 8 · 33615 Bielefeld · Deutschland\nTelefon: +49 176 45961547 · E-Mail: mzschach@googlemail.com\nImpressum: ${IMPRESSUM_URL}\nDatenschutzerklärung: ${DATENSCHUTZ_URL}\n\nHinweis: Diese Nachricht ist eine unverbindliche, einmalige Konzept-Vorschau (Erprobung eines Konzeptes), keine Rechnung und kein Vertragsangebot. ${DEMO_NOTICE} Wenn Sie keine weiteren Vorschläge wünschen, antworten Sie bitte kurz auf diese E-Mail oder schreiben Sie an mzschach@googlemail.com — ich nehme Sie umgehend aus dem Verteiler.`;

// Domain aus der Website-URL (für einen konkreten, nicht-werblichen Betreff).
function domainOf(url) {
  try { return new URL(url.startsWith('http') ? url : 'http://' + url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

// Konkrete, website-spezifische Punkte aus problems[] — jeweils als Paar
// {issue, fix}: WAS auf der Seite auffällt UND WIE die Skizze es löst. So wird
// der Mehrwert sichtbar und individuell (nicht wie eine Massen-Mail). Bewusst
// sachlich-freundlich, nichts Abwertendes. Max. 3 Punkte, dedupliziert.
function problemFixes(problems) {
  const map = [
    [/Kontaktformular/i,            'Kontakt bislang nur per Telefon — kein direkter Online-Weg',        'Online-Terminanfrage & Kontaktformular direkt auf der Seite'],
    [/HTTPS/i,                      'noch ohne sichere HTTPS-Verbindung',                                'sichere Verbindung — mehr Vertrauen bei Besuchern und bei Google'],
    [/responsive|mobil/i,          'am Smartphone noch nicht optimal dargestellt',                      'voll mobil-optimiert — die meisten Besucher kommen übers Handy'],
    [/Baukasten/i,                 'Auftritt wirkt aktuell etwas im Baukasten-Look',                    'individuelles, hochwertiges Design mit Wiedererkennung'],
    [/WordPress/i,                 'Seite technisch in die Jahre gekommen',                             'schlanke, schnelle und wartungsarme Umsetzung'],
    [/Bildmaterial/i,              'wenig Bildmaterial — der gute Eindruck vor Ort fehlt online',       'großzügige Bildsprache mit Ihren echten Fotos'],
    [/einfaches Design/i,          'Design recht schlicht gehalten',                                    'modernes, edles Design passend zu Ihrer Branche'],
  ];
  const out = [];
  for (const [re, issue, fix] of map) {
    if ((problems || []).some(p => re.test(p))) out.push({ issue, fix });
    if (out.length >= 3) break;
  }
  if (!out.length) out.push({ issue: 'der Auftritt schöpft Ihr Potenzial online noch nicht ganz aus', fix: 'klarere Struktur, modernes Design und ein direkter Kontaktweg' });
  return out;
}

function buildMail(lead) {
  const dom = domainOf(lead.website);
  const subject = lead.noweb
    ? `Kurze Idee für ${lead.name}`
    : `Kurze Beobachtung zu ${dom || 'Ihrer Website'}`;
  // Kein Pitch im ersten Satz. Dann eine konkrete, website-spezifische
  // „Aufgefallen → in der Skizze gelöst"-Liste (sichtbarer Mehrwert), die
  // fertige Skizze als Beleg, dann EINE weiche Frage. Kein Preis, kein
  // "Angebot", keine Dringlichkeit. Impressum/Opt-out folgen via LEGAL_TEXT.
  let body;
  if (lead.noweb) {
    const points = [
      '• Online auffindbar — Kunden finden Sie künftig auch über Google',
      '• Direkter Kontakt & Terminanfrage statt nur Telefon',
      '• Mobil-optimiert, mit Ihren echten Bildern',
    ].join('\n');
    body = `Hallo liebes ${lead.name}-Team,\n\nich beschäftige mich viel mit der Online-Wirkung kleiner, inhabergeführter Betriebe und habe gesehen, dass Sie aktuell noch keine eigene Website haben. Statt nur darauf hinzuweisen, habe ich kurzerhand eine unverbindliche Skizze gebaut — so könnte ein eigener Auftritt für Sie aussehen:\n\nWas er konkret bringen würde:\n${points}\n\n👉 Zur Skizze: ${lead.preview}\n\nDas ist kein Angebot und kostet nichts. Wäre so etwas grundsätzlich interessant für Sie? Über eine kurze Rückmeldung freue ich mich; falls nicht, ignorieren Sie die Nachricht gern.\n\n${SIG}`;
  } else {
    const points = problemFixes(lead.problems).map(p => `• ${p.issue} → ✓ ${p.fix}`).join('\n');
    body = `Hallo liebes ${lead.name}-Team,\n\nich bin auf Ihre Website (${dom}) gestoßen und habe sie mir kurz angesehen. Ein paar konkrete Punkte sind mir aufgefallen — und statt nur Tipps zu schreiben, habe ich gleich eine unverbindliche Skizze gebaut, die zeigt, wie sich das lösen ließe (mit Ihren eigenen Bildern, nichts Erfundenes):\n\nWas mir aufgefallen ist — und wie die Skizze es angeht:\n${points}\n\n👉 Zur Skizze: ${lead.preview}\n\nDas ist kein Angebot und kostet nichts. Wäre so eine Richtung grundsätzlich interessant für Sie? Über eine kurze Rückmeldung freue ich mich; falls nicht, ignorieren Sie die Nachricht gern.\n\n${SIG}`;
  }
  return { to: lead.email, subject, body };
}

function buildHtmlMail(lead) {
  const { subject, body } = buildMail(lead);
  const previewUrl = lead.preview;
  // Zeilen, die als eigener Block (CTA/Footer) gerendert werden, im Body überspringen.
  const skip = (t) => !t || t.startsWith('👉') || t === 'Viele Grüße' || t === 'Maik'
    || t.startsWith('MZ.9') || t.startsWith('https://');
  // Lösungs-fokussierte Karten: das Problem klein & durchgestrichen (zeigt nur
  // den Status quo), die LÖSUNG groß, fett, in MZ.9-Grün mit Akzentbalken — sie
  // ist das Erste, was ins Auge fällt. Reine Vorteils-Zeilen (ohne „→") werden
  // ebenso als prominenter grüner Haken gerendert. Normale Zeilen = Absätze.
  const card = (inner) => `      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 10px;background:#F1FAF5;border-radius:10px"><tr><td style="padding:13px 16px;border-left:3px solid #10B981;border-top-left-radius:10px;border-bottom-left-radius:10px">${inner}</td></tr></table>`;
  const renderLine = (t) => {
    if (t.startsWith('•')) {
      const raw = t.replace(/^•\s*/, '');
      const arrow = raw.indexOf('→');
      if (arrow > -1) {
        const issue = raw.slice(0, arrow).trim();
        const fix = raw.slice(arrow + 1).replace(/^\s*✓\s*/, '').trim();
        return card(
          `<div style="font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#b3b3b3;margin-bottom:1px">Aktuell</div>`
          + `<div style="font-size:12.5px;color:#9a9a9a;text-decoration:line-through;margin-bottom:8px">${issue}</div>`
          + `<div style="font-size:16px;line-height:1.45;color:#0B7A53;font-weight:700">✓ ${fix}</div>`
        );
      }
      const benefit = raw.replace(/^\s*✓\s*/, '').trim();
      return card(`<div style="font-size:16px;line-height:1.45;color:#0B7A53;font-weight:700">✓ ${benefit}</div>`);
    }
    return `      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2a2a35">${t}</p>`;
  };
  const paras = body.split('\n').map(l => l.trim()).filter(t => !skip(t)).map(renderLine).join('\n');
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
  <span style="float:right;font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:#7C7A75;padding-top:7px">Konzept-Skizze</span>
</td></tr>
${compareBlock}<tr><td style="padding:22px 28px 6px">
${paras}
</td></tr>
<tr><td align="center" style="padding:14px 28px 26px">
  <a href="${previewUrl}" style="display:inline-block;background:#10B981;color:#04130d;font-weight:700;font-size:15px;letter-spacing:.03em;text-decoration:none;padding:14px 30px;border-radius:10px">Zur Konzept-Skizze &rarr;</a>
</td></tr>
<tr><td style="padding:18px 28px 16px;border-top:1px solid #ECE9E3;background:#F4F2EC">
  <p style="margin:0 0 3px;font-weight:600;color:#1a1a2e">Viele Grüße</p>
  <p style="margin:0 0 2px;color:#2a2a35">Maik Zschach</p>
  <p style="margin:0 0 14px"><a href="${MZ9_URL}" style="color:#0E9C75;text-decoration:none;font-weight:600">MZ.9 — Media Engineering.AI</a></p>
  <p style="margin:0 0 2px;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7C7A75">Impressum · §5 DDG</p>
  <p style="margin:0 0 10px;font-size:11px;color:#6a6a6a;line-height:1.55">Maik Zschach · Merianstr. 8 · 33615 Bielefeld · Deutschland<br>Telefon: <a href="tel:+4917645961547" style="color:#6a6a6a;text-decoration:none">+49 176 45961547</a> · E-Mail: <a href="mailto:mzschach@googlemail.com" style="color:#6a6a6a;text-decoration:none">mzschach@googlemail.com</a></p>
  <p style="margin:0 0 10px;font-size:11px;color:#6a6a6a;line-height:1.55"><a href="${IMPRESSUM_URL}" style="color:#0E9C75;text-decoration:none">Impressum</a> · <a href="${DATENSCHUTZ_URL}" style="color:#0E9C75;text-decoration:none">Datenschutzerklärung</a></p>
  <p style="margin:0 0 8px;font-size:11px;color:#9a9a9a;line-height:1.55">Unverbindliche, einmalige Konzept-Vorschau (Erprobung eines Konzeptes) · keine Rechnung · kein Vertragsangebot. Keine weiteren Vorschläge gewünscht? Kurze Antwort auf diese E-Mail — wir tragen Sie sofort aus dem Verteiler.</p>
  <p style="margin:0;padding:8px 10px;border:1px solid #ECE9E3;border-radius:6px;background:#FBFAF8;font-size:10.5px;color:#7C7A75;line-height:1.5">${DEMO_NOTICE}</p>
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
  let { to, subject, body, html } = buildHtmlMail(lead);
  // Test-Override: MAIL_TO_OVERRIDE lenkt JEDE Mail an eine feste Adresse um
  // (Self-Send/Test, ohne echte Leads anzuschreiben). Im Normalbetrieb leer.
  if (process.env.MAIL_TO_OVERRIDE) {
    console.log(`  ↪️  MAIL_TO_OVERRIDE aktiv: ${to} → ${process.env.MAIL_TO_OVERRIDE}`);
    to = process.env.MAIL_TO_OVERRIDE;
  }
  if (!to) { console.log(`  ⚠️  Keine E-Mail für ${lead.id}`); return { success: false }; }
  if (dryRun) { console.log(`\n📧 DRY RUN (AgentMail) → ${to}\n   ${subject}`); return { success: true }; }
  if (!AGENTMAIL.apiKey) { console.log('  ❌ Kein AGENTMAIL_API_KEY gesetzt — Versand nicht möglich.'); return { success: false }; }
  // LETZTER Check direkt vor Versand (nach Screenshot-Wartezeit): Cache fresh
  // lesen und prüfen, ob die Adresse in der Zwischenzeit bereits versendet
  // wurde — verhindert Doppel-Mails absolut.
  resetEmailCache();
  if (isEmailAlreadySent(to)) { console.log(`  ⚠️  Kurz vor Versand blockiert — bereits gesendet: ${to}`); return { success: false }; }
  const attachments = [];
  if (lead.hasCompare) {
    const d = path.join(PREVIEW_DIR, lead.id);
    if (fs.existsSync(path.join(d, 'original.png'))) attachments.push({ filename: 'original.png', path: path.join(d, 'original.png'), cid: 'orig@mz9' });
    if (fs.existsSync(path.join(d, 'preview.png'))) attachments.push({ filename: 'preview.png', path: path.join(d, 'preview.png'), cid: 'prev@mz9' });
  }
  const text = body + LEGAL_TEXT;
  return await sendViaAgentMail({ to, subject, text, html, attachments });
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
    if (sent[targetId] && !dryRun) { console.log('⚠️  Bereits gesendet (id)'); return; }
    // Defense-in-Depth: auch prüfen, ob die E-Mail-Adresse bereits unter einer
    // anderen ID versendet wurde — verhindert Doppel-Mails bei gleicher Adresse.
    if (!dryRun && lead.email && isEmailAlreadySent(lead.email)) { console.log(`⚠️  Bereits gesendet (email) — ${lead.email}`); return; }
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
