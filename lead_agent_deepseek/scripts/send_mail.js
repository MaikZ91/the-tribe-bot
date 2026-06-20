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
const DASHBOARD_FILE = path.join(ROOT, '..', 'docs', 'leads', 'dashboard', 'index.html');

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

// ─── Lead-Daten aus dem Dashboard extrahieren ─────────────────────
function loadLeads() {
  const h = fs.readFileSync(DASHBOARD_FILE, 'utf8');
  const seedMatch = h.match(/var SEED=\[([\s\S]*?)\];/);
  if (!seedMatch) return [];
  // Parse das SEED-Array als JSON-ähnlichen String
  const raw = seedMatch[1];
  const leads = [];
  const re = /{id:"([^"]+)",name:"([^"]+)",industry:"([^"]+)",hebel:"([^"]+)",score:(\d+),website:"([^"]*)",(?:noweb:(\w+),)?problems:\[([^\]]*)\],opps:\[([^\]]*)\],preview:"([^"]+)"}/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const noweb = m[7] === 'true';
    leads.push({
      id: m[1], name: m[2], industry: m[3], hebel: m[4], score: parseInt(m[5]),
      website: m[6], noweb,
      problems: m[8].split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean),
      opps: m[9].split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean),
      preview: m[10],
    });
  }

  // Parse EMAILS object
  const emailsMatch = h.match(/var EMAILS=\{([\s\S]*?)\};/);
  const emails = {};
  if (emailsMatch) {
    const ere = /"([^"]+)":"([^"]+)"/g;
    let em;
    while ((em = ere.exec(emailsMatch[1])) !== null) {
      emails[em[1]] = em[2];
    }
  }

  return leads.map(l => {
    const dom = host(l.website).replace(/^www\./, '').split('/')[0];
    l.email = emails[l.id] || (l.website ? `info@${dom}` : '');
    return l;
  });
}

// ─── E-Mail-Text generieren (wie im Dashboard) ────────────────────
function buildMail(lead) {
  const to = lead.email;
  const subject = lead.noweb
    ? `Ihre eigene Website — Konzept-Vorschau für ${lead.name}`
    : `Konzept-Vorschau für Ihre Website — ${lead.name}`;

  let body;
  if (lead.noweb) {
    body = `Hallo liebes ${lead.name}-Team,

mein Name ist Maik, ich komme aus Berlin. Ich habe euch online gefunden (z. B. bei Google/Facebook) — aber eine eigene Website habt ihr noch nicht. Schade, denn ihr macht etwas, das eine richtig gute Seite verdient.

Ich habe mir unverbindlich die Freiheit genommen, schon mal eine komplette Website für euch zu gestalten — schaut gern rein:

${lead.preview}

Was eine eigene Seite euch bringt:
${lead.opps.map(o => '• ' + o).join('\n')}

Das Ganze ist kostenlos und ohne Hintergedanken — wenn es euch gefällt, setze ich es gern mit euch live. Wenn nicht, behaltet einfach die Idee. :)

Über eine kurze Rückmeldung würde ich mich sehr freuen.

Herzliche Grüße
Maik
MZ.9 — Media Engineering.AI`;
  } else {
    body = `Hallo liebes ${lead.name}-Team,

mein Name ist Maik, ich komme aus Berlin — und ehrlich gesagt mag ich, was Sie machen. Genau deshalb ist mir Ihre Website aufgefallen: Sie hat richtig Potenzial, kommt online aber noch nicht so rüber, wie Sie es vor Ort tun.

Ich habe mir völlig unverbindlich die Freiheit genommen und eine moderne Vorschau gestaltet, wie Ihr Auftritt aussehen könnte — schauen Sie gern rein:

${lead.preview}

Im Vergleich zur aktuellen Seite (${host(lead.website)}) fällt mir vor allem auf, was sich mit wenig Aufwand spürbar verbessern lässt:
${lead.opps.map(o => '• ' + o).join('\n')}

Das Ganze ist kostenlos und ohne Hintergedanken — wenn es Ihnen gefällt, setze ich es gern für Sie um. Wenn nicht, behalten Sie einfach die Idee. :)

Über eine kurze Rückmeldung würde ich mich sehr freuen.

Herzliche Grüße
Maik
MZ.9 — Media Engineering.AI`;
  }

  return { to, subject, body };
}

// ─── Senden ───────────────────────────────────────────────────────
async function sendMail(lead, dryRun = false) {
  const { to, subject, body } = buildMail(lead);

  if (!to || !to.includes('@')) {
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
      subject,
      text: body,
    });
    console.log(`  ✅ Gesendet an ${to} (ID: ${info.messageId})`);
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

  const leads = loadLeads();
  const sent = loadSent();

  console.log(`📧 MZ.9 Mailer | ${leads.length} Leads | ${Object.keys(sent).length} bereits gesendet`);
  if (dryRun) console.log('🔍 DRY RUN — keine echten E-Mails\n');

  if (sendAll) {
    const pending = leads.filter(l => !sent[l.id] && l.email);
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
    console.log(`→ ${lead.name} (${lead.email})`);
    const result = await sendMail(lead, dryRun);
    if (result.success && !dryRun) {
      sent[lead.id] = new Date().toISOString();
      saveSent(sent);
    }
  } else {
    // Zeige Status
    const berlin = leads.filter(l => l.id.startsWith('berlin-'));
    const berlinSent = berlin.filter(l => sent[l.id]);
    const berlinOpen = berlin.filter(l => !sent[l.id] && l.email);
    const berlinNoEmail = berlin.filter(l => !sent[l.id] && !l.email);

    console.log(`\nStatus Berlin: ${berlinOpen.length} offen · ${berlinSent.length} gesendet · ${berlinNoEmail.length} ohne E-Mail`);
    console.log('\nNutzung:');
    console.log('  node send_mail.js <lead-id>     Einzelnen Lead senden');
    console.log('  node send_mail.js --all         Alle offenen senden');
    console.log('  node send_mail.js --dry-run     Vorschau ohne Senden');
    console.log('  node send_mail.js --dry-run --all   Vorschau aller');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
