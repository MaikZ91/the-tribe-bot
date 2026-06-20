/**
 * MZ.9 — E-Mail-Versand via Gmail SMTP
 *
 * Nutzung:
 *   node lead_agent_deepseek/scripts/send_mail.js <lead-id>
 *   node lead_agent_deepseek/scripts/send_mail.js --all          (alle offenen)
 *   node lead_agent_deepseek/scripts/send_mail.js --dry-run      (Vorschau ohne senden)
 *
 * Konfiguration via Umgebungsvariablen:
 *   MZ9_SMTP_USER     = mzschach@googlemail.com
 *   MZ9_SMTP_PASS     = <Gmail App-Passwort>
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { isValidEmail, isEmailAlreadySent } = require('./pending');

// ─── .env-Datei laden (falls vorhanden) ──────────────────────────
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
    console.log('  ℹ️  .env geladen');
  } catch { /* keine .env vorhanden */ }
}
loadEnv();

// ─── Konfiguration ────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const SENT_FILE = path.join(ROOT, 'sent.json');
const PREVIEW_DIR = path.join(ROOT, '..', 'docs', 'leads');

const EMAIL_DELAY_MAX_MIN = parseInt(process.env.EMAIL_DELAY_MAX_MIN || '15', 10);

const SMTP = {
  host: process.env.MZ9_SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MZ9_SMTP_PORT || '587'),
  secure: process.env.MZ9_SMTP_SECURE === 'true', // false = STARTTLS
  auth: {
    user: process.env.MZ9_SMTP_USER || 'mzschach@googlemail.com',
    pass: process.env.MZ9_SMTP_PASS || '',
  },
};

const FROM = {
  name: process.env.MZ9_FROM_NAME || 'Maik Zschach — MZ.9',
  email: process.env.MZ9_FROM_EMAIL || 'mzschach@googlemail.com',
};

// ─── Hilfen ───────────────────────────────────────────────────────
function loadSent() {
  try { return JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')); } catch { return {}; }
}
function saveSent(sent) {
  fs.writeFileSync(SENT_FILE, JSON.stringify(sent, null, 2));
}
function host(u) { return (u || '').replace(/^https?:\/\//, '').replace(/\/$/, ''); }

// ─── Lead-Daten aus build-job.json extrahieren ────────────────────
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
      // Prüfe ob die Seite wirklich gebaut wurde (index.html existiert + hat Inhalt)
      const idxFile = path.join(PREVIEW_DIR, d.name, 'index.html');
      let built = false;
      try {
        const stat = fs.statSync(idxFile);
        built = stat.size > 2000; // echte Seite, kein Platzhalter
      } catch {}

      leads.push({
        id: job.id,
        name: job.name,
        industry: job.industry || 'Dienstleistung',
        website: job.website || '',
        email: (isValidEmail(job.email) ? job.email : ''),
        rawEmail: job.email || '',
        phone: job.phone || '',
        problems: job.problems || [],
        opps: job.opps || [],
        preview: `https://maikz91.github.io/the-tribe-bot/leads/${job.id}/`,
        noweb: !job.website,
        built,
      });

      // Prüfe ob ein Vergleichsbild existiert
      const compareFile = path.join(PREVIEW_DIR, d.name, 'compare.png');
      leads[leads.length - 1].hasCompare = fs.existsSync(compareFile);
    } catch {}
  }
  return leads;
}

// ─── Opps aus Problems ableiten (Fallback) ──────────────────────
function oppsFromProblems(problems) {
  if (!problems || problems.length === 0) return ['Moderner, frischer Web-Auftritt', 'Bessere Sichtbarkeit bei Google', 'Mehr Kundenanfragen über die Website'];
  const map = {
    'WordPress': 'Moderne, wartungsarme Website ohne Baukasten-Risiko',
    'Kein HTTPS': 'Sichere HTTPS-Verbindung für Vertrauen & Google-Ranking',
    'Kein Kontaktformular': 'Direktes Kontaktformular für mehr Anfragen',
    'Keine E-Mail-Adresse': 'Klare Kontaktmöglichkeit direkt auf der Seite',
    'Veralteter Website-Baukasten': 'Maßgeschneiderte Seite statt generischem Baukasten',
    'Wenig Bildmaterial': 'Hochwertige Bildsprache, die Ihr Handwerk zeigt',
    'Sehr einfaches Design': 'Professionelles Design mit Wiedererkennungswert',
    'Unprofessionelle E-Mail': 'Seriöse Geschäfts-E-Mail und Kontaktwege',
    'Copyright ohne Jahr': 'Gepflegter, aktueller Online-Auftritt',
    'Keine Produktfotos': 'Ansprechende Produktfotos, die verkaufen',
  };
  const opps = [];
  for (const p of problems) {
    for (const [key, val] of Object.entries(map)) {
      if (p.includes(key)) { opps.push(val); break; }
    }
  }
  return opps.length > 0 ? [...new Set(opps)] : ['Moderner, frischer Web-Auftritt', 'Bessere Sichtbarkeit bei Google'];
}

// ─── E-Mail-Text generieren (wie im Dashboard) ────────────────────
function buildMail(lead) {
  const to = lead.email;
  const subject = lead.noweb
    ? `Ihre eigene Website — Konzept-Vorschau für ${lead.name}`
    : `Konzept-Vorschau für Ihre Website — ${lead.name}`;

  const opps = (lead.opps && lead.opps.length > 0) ? lead.opps : oppsFromProblems(lead.problems);
  let body;
  if (lead.noweb) {
    body = `Hallo liebes ${lead.name}-Team,

ich bin über Ihren Eintrag gestolpert und habe gesehen, dass Sie noch keine eigene Website haben — schade eigentlich, denn was Sie machen, hat definitiv einen guten Auftritt verdient.

Ich habe Ihnen dafür eine unverbindliche Vorschau erstellt, wie eine Website für Sie aussehen könnte:

👉 ${lead.preview}

Im Vergleich zu einem reinen Google-Eintrag sieht man ziemlich schnell, was eine eigene Seite für Wirkung und Professionalität bringt.

Falls es interessant für Sie ist, kann ich Ihnen gern kurz erklären, was ich konkret gemacht habe — wenn nicht, einfach ignorieren.

Viele Grüße
Maik
MZ.9 — Media Engineering.AI`;
  } else {
    body = `Hallo liebes ${lead.name}-Team,

ich bin über Ihre Website gestolpert und habe mir kurz angeschaut, wie Ihr Auftritt online etwas klarer und moderner wirken könnte.

Ich habe Ihnen dafür eine unverbindliche Vorschau erstellt, wie eine alternative Struktur aussehen könnte:

👉 ${lead.preview}

Im direkten Vergleich zur aktuellen Seite sieht man ziemlich schnell, wo man mit kleinen Anpassungen mehr Klarheit und Wirkung erzeugen kann.

Falls es interessant für Sie ist, kann ich Ihnen gern kurz erklären, was ich konkret verändert habe — wenn nicht, einfach ignorieren.

Viele Grüße
Maik
MZ.9 — Media Engineering.AI`;
  }

  return { to, subject, body };
}

// ─── HTML-E-Mail mit Screenshot-Vergleich ────────────────────────
function buildHtmlMail(lead) {
  const { to, subject, body } = buildMail(lead);
  const compareUrl = `https://maikz91.github.io/the-tribe-bot/leads/${lead.id}/compare.png`;
  const previewUrl = `https://maikz91.github.io/the-tribe-bot/leads/${lead.id}/`;

  // Plain-Text-Body in HTML-Zeilen umwandeln
  const bodyLines = body.split('\n');
  let htmlBody = '';
  let inList = false;
  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) { htmlBody += '</ul>\n'; inList = false; }
      htmlBody += '<br>\n';
    } else if (trimmed.startsWith('•')) {
      if (!inList) { htmlBody += '<ul style="margin:8px 0;padding-left:20px">\n'; inList = true; }
      htmlBody += `<li style="margin:4px 0;color:#333">${trimmed.slice(1).trim()}</li>\n`;
    } else if (trimmed.startsWith('http')) {
      htmlBody += `<p style="margin:8px 0"><a href="${trimmed}" style="color:#2563eb">${trimmed}</a></p>\n`;
    } else {
      if (inList) { htmlBody += '</ul>\n'; inList = false; }
      htmlBody += `<p style="margin:8px 0;color:#333">${trimmed}</p>\n`;
    }
  }
  if (inList) htmlBody += '</ul>\n';

  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a2e;line-height:1.6">
${lead.hasCompare ? `
<div style="margin:0 0 24px;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)">
  <img src="cid:compare@mz9" alt="Vorher/Nachher Vergleich" style="width:100%;display:block">
</div>
<p style="font-size:12px;color:#888;margin:-16px 0 20px;text-align:center">Links: Aktuelle Website · Rechts: MZ.9 Konzept-Vorschau</p>
` : ''}
${htmlBody}
</body></html>`;

  return { to, subject, body, html };
}

// ─── Senden ───────────────────────────────────────────────────────
async function sendMail(lead, dryRun = false) {
  const { to, subject, body } = buildMail(lead);

  if (!to) {
    console.log(`  ⚠️  Keine E-Mail-Adresse für ${lead.id}`);
    return { success: false, reason: 'no-email' };
  }

  if (dryRun) {
    console.log(`\n📧 DRY RUN — würde senden an: ${to}`);
    console.log(`   Betreff: ${subject}`);
    console.log(`   Länge: ${body.length} Zeichen`);
    return { success: true, dryRun: true };
  }

  if (!SMTP.auth.pass) {
    console.log('  ❌ Kein SMTP-Passwort gesetzt. Setze MZ9_SMTP_PASS.');
    return { success: false, reason: 'no-auth' };
  }

  const transporter = nodemailer.createTransport(SMTP);

  try {
    const info = await transporter.sendMail({
      from: `"${FROM.name}" <${FROM.email}>`,
      to,
      subject: `Konzept-Vorschau für Ihre Website — ${lead.name}`,
      text: body,
    });
    console.log(`  ✅ Plain-Text gesendet an ${to} (ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.log(`  ❌ Fehler: ${err.message}`);
    return { success: false, reason: err.message };
  }
}

// ─── HTML-Mail senden ────────────────────────────────────────────
async function sendHtmlMail(lead, dryRun = false) {
  const { to, subject, body, html } = buildHtmlMail(lead);

  if (!to) {
    console.log(`  ⚠️  Keine E-Mail-Adresse für ${lead.id}`);
    return { success: false, reason: 'no-email' };
  }

  if (dryRun) {
    console.log(`\n📧 DRY RUN (HTML) — würde senden an: ${to}`);
    console.log(`   Betreff: ${subject}`);
    console.log(`   Text: ${body.length} Zeichen | HTML: ${html.length} Zeichen`);
    if (lead.hasCompare) console.log('   🖼️  Vergleichsbild: eingebettet');
    else console.log('   ⚠️  Kein Vergleichsbild vorhanden');
    return { success: true, dryRun: true };
  }

  if (!SMTP.auth.pass) {
    console.log('  ❌ Kein SMTP-Passwort gesetzt. Setze MZ9_SMTP_PASS.');
    return { success: false, reason: 'no-auth' };
  }

  const transporter = nodemailer.createTransport(SMTP);

  // Vergleichsbild als Inline-Attachment einbetten
  const attachments = [];
  const leadDir = path.join(PREVIEW_DIR, lead.id);
  const compareFile = path.join(leadDir, 'compare.png');
  if (fs.existsSync(compareFile)) {
    attachments.push({
      filename: 'compare.png',
      path: compareFile,
      cid: 'compare@mz9',
    });
  }

  try {
    const info = await transporter.sendMail({
      from: `"${FROM.name}" <${FROM.email}>`,
      to,
      subject,
      text: body,
      html: html,
      attachments,
    });
    console.log(`  ✅ HTML-Mail gesendet an ${to} (ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.log(`  ❌ Fehler: ${err.message}`);
    return { success: false, reason: err.message };
  }
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sendAll = args.includes('--all');
  const targetId = args.find(a => !a.startsWith('--'));

  const leads = loadLeads().filter(l => l.email); // nur valide E-Mails
  const sent = loadSent();

  console.log(`📧 MZ.9 Mailer | ${leads.length} Leads | ${Object.keys(sent).length} bereits gesendet`);
  if (dryRun) console.log('🔍 DRY RUN — keine echten E-Mails\n');

  if (sendAll) {
    const pending = leads.filter(l => !sent[l.id] && l.email && !isEmailAlreadySent(l.email));
    console.log(`📬 Sende an ${pending.length} offene Leads...\n`);
    for (const lead of pending) {
      console.log(`→ ${lead.name} (${lead.email})`);
      const result = await sendMail(lead, dryRun);
      if (result.success && !dryRun) {
        sent[lead.id] = new Date().toISOString();
        saveSent(sent);
      }
      // Kurze Pause zwischen E-Mails (Gmail-Limit: ~100/Tag für App-Passwörter)
      if (!dryRun) await new Promise(r => setTimeout(r, 2000));
    }
    console.log(`\n✅ Fertig. ${dryRun ? 'Dry run beendet.' : `${Object.keys(sent).length} gesendet.`}`);
  } else if (targetId) {
    const lead = leads.find(l => l.id === targetId);
    if (!lead) { console.log(`❌ Lead "${targetId}" nicht gefunden.`); return; }
    if (sent[targetId] && !dryRun) {
      console.log(`⚠️  Lead "${targetId}" wurde bereits gesendet (${sent[targetId]}).`);
      console.log('   --force zum erneuten Senden.');
      return;
    }
    if (isEmailAlreadySent(lead.email) && !dryRun) {
      console.log('⚠️  E-Mail wurde bereits unter anderer Lead-ID kontaktiert.');
      console.log('   --force zum erneuten Senden.');
      return;
    }
    console.log(`→ ${lead.name} (${lead.email})${lead.hasCompare ? ' 🖼️' : ''}`);
    if (!dryRun && EMAIL_DELAY_MAX_MIN > 0) {
      const delaySec = Math.floor(Math.random() * EMAIL_DELAY_MAX_MIN * 60);
      console.log(`  ⏳ Warte ${(delaySec / 60).toFixed(1)} Min vor Versand...`);
      await new Promise(r => setTimeout(r, delaySec * 1000));
    }
    const result = await sendHtmlMail(lead, dryRun);
    if (result.success && !dryRun) {
      const ts = new Date().toISOString();
      if (!sent[lead.id]) sent[lead.id] = ts;
      saveSent(sent);
    }
  } else {
    // Zeige Status
    const withEmail = leads.filter(l => l.email);
    const sentCount = leads.filter(l => sent[l.id]).length;
    const openCount = withEmail.filter(l => !sent[l.id] && l.built).length;
    const unbuiltCount = withEmail.filter(l => !sent[l.id] && !l.built).length;
    const noEmail = leads.filter(l => !l.email).length;

    console.log(`\nStatus: ${openCount} sendbar · ${unbuiltCount} ungebaut · ${sentCount} gesendet · ${noEmail} ohne E-Mail`);
    console.log('\nNutzung:');
    console.log('  node send_mail.js <lead-id>     Einzelnen Lead senden');
    console.log('  node send_mail.js --all         Alle offenen senden');
    console.log('  node send_mail.js --dry-run     Vorschau ohne Senden');
    console.log('  node send_mail.js --dry-run --all   Vorschau aller');
  }
}

main().catch(err => { console.error(err); process.exit(1); });