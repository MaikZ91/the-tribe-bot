/**
 * The Tribe — E-Mail-Einladung via Gmail SMTP
 *
 * Sendet die WhatsApp-Community-Einladung an kreative Leads in Bielefeld.
 * Nutzt dieselben SMTP-Credentials wie MZ.9 (lead_agent_deepseek/.env).
 *
 * Nutzung:
 *   node lead_agent_tribe/scripts/send_invite.js <lead-id>
 *   node lead_agent_tribe/scripts/send_invite.js --all          (alle offenen mit E-Mail)
 *   node lead_agent_tribe/scripts/send_invite.js --dry-run      (Vorschau ohne senden)
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// ─── .env-Datei laden (shared mit MZ.9) ──────────────────────────
function loadEnv() {
  const envFile = path.join(__dirname, '..', '..', 'lead_agent_deepseek', '.env');
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
    console.log('  .env geladen (MZ.9 SMTP)');
  } catch { console.log('  Kein .env gefunden — SMTP-Passwort manuell setzen.'); }
}
loadEnv();

// ─── Konfiguration ────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const QUEUE_FILE = path.join(ROOT, 'queue.json');
const SENT_FILE = path.join(ROOT, 'sent.json');
const INVITE_FILE = path.join(ROOT, 'templates', 'invitation.txt');

const SMTP = {
  host: process.env.MZ9_SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MZ9_SMTP_PORT || '587'),
  secure: false, // STARTTLS
  auth: {
    user: process.env.MZ9_SMTP_USER || 'mzschach@googlemail.com',
    pass: process.env.MZ9_SMTP_PASS || '',
  },
};

const FROM = {
  name: 'The Tribe Bielefeld',
  email: process.env.MZ9_SMTP_USER || 'mzschach@googlemail.com',
};

// ─── Einladungstext (fix, aus template) ───────────────────────────
function loadInviteText() {
  try {
    return fs.readFileSync(INVITE_FILE, 'utf8').trim();
  } catch {
    // Fallback — exakt der Text aus der Spec
    return [
      'Hey, wir sind über dein Profil gestolpert und fanden deinen kreativen Output interessant.',
      'Wir bauen gerade The Tribe – eine kreative Community aus Bielefeld, in der Leute sich austauschen, Projekte teilen und gemeinsam kreativ werden.',
      '',
      'Wenn du Lust hast, kannst du hier einfach dazukommen:',
      'https://chat.whatsapp.com/Eoy446bdsfdJrvW4VJ5Q5O?mode=gi_t',
      '',
      'Alles entspannt – einfach ein offener Raum für kreative Leute.',
    ].join('\n');
  }
}

// ─── Queue & Sent ─────────────────────────────────────────────────
function loadQueue() {
  try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); } catch { return { leads: [] }; }
}
function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}
function loadSent() {
  try { return JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')); } catch { return {}; }
}
function saveSent(sent) {
  fs.writeFileSync(SENT_FILE, JSON.stringify(sent, null, 2));
}

// ─── E-Mail bauen ─────────────────────────────────────────────────
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) return false;
  const tld = email.split('.').pop().toLowerCase();
  const banned = ['jpg', 'png', 'gif', 'webp', 'svg', 'ico', 'css', 'js', 'woff', 'woff2', 'mp4', 'pdf', 'xml', 'json'];
  if (banned.includes(tld)) return false;
  return true;
}

function buildMail(lead) {
  const invite = loadInviteText();
  const subject = 'The Tribe Bielefeld – Einladung in unsere kreative Community';

  // Name extrahieren (für persönliche Anrede)
  const firstName = lead.name.split(/\s+/)[0] || '';

  const body = [
    invite,
    '',
    '—',
    'The Tribe Bielefeld',
  ].join('\n');

  return {
    to: lead.email,
    subject,
    body,
  };
}

// ─── Senden ───────────────────────────────────────────────────────
async function sendInvite(lead, dryRun = false) {
  const { to, subject, body } = buildMail(lead);

  if (!to || !isValidEmail(to)) {
    console.log(`  ⚠️  Keine valide E-Mail-Adresse für ${lead.id}`);
    return { success: false, reason: 'no-email' };
  }

  if (dryRun) {
    console.log(`\n📧 DRY RUN — würde senden an: ${to}`);
    console.log(`   Betreff: ${subject}`);
    console.log(`   Text:\n---\n${body}\n---`);
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
  const force = args.includes('--force');
  const targetId = args.find(a => !a.startsWith('--'));

  const queue = loadQueue();
  const leads = queue.leads || [];
  const sent = loadSent();

  // Nur Leads mit E-Mail und delivery=email
  const emailable = leads.filter(l => l.email && isValidEmail(l.email) && l.delivery === 'email');

  console.log(`📧 The Tribe Mailer | ${leads.length} Leads total | ${emailable.length} mit E-Mail | ${Object.keys(sent).length} bereits gesendet`);
  if (dryRun) console.log('🔍 DRY RUN — keine echten E-Mails\n');

  if (sendAll) {
    const pending = emailable.filter(l => !sent[l.id] && !l.invited);
    console.log(`📬 Sende an ${pending.length} offene Leads...\n`);
    for (const lead of pending) {
      console.log(`→ ${lead.name} (${lead.email}) [${lead.category}]`);
      const result = await sendInvite(lead, dryRun);
      if (result.success && !dryRun) {
        // In sent.json vermerken
        sent[lead.id] = new Date().toISOString();
        saveSent(sent);
        // In queue.json als invited markieren
        const qLead = queue.leads.find(l => l.id === lead.id);
        if (qLead) qLead.invited = true;
        saveQueue(queue);
      }
      // Kurze Pause zwischen E-Mails (Gmail-Limit: ~100/Tag für App-Passwörter)
      if (!dryRun) await new Promise(r => setTimeout(r, 2000));
    }
    console.log(`\n✅ Fertig. ${dryRun ? 'Dry run beendet.' : `${Object.keys(sent).length} Einladungen gesendet.`}`);
  } else if (targetId) {
    const lead = leads.find(l => l.id === targetId);
    if (!lead) { console.log(`❌ Lead "${targetId}" nicht in queue.json gefunden.`); return; }
    if (!lead.email || !isValidEmail(lead.email)) {
      console.log(`⚠️  Lead "${targetId}" hat keine valide E-Mail (${lead.email || '–'}).`);
      return;
    }
    if (sent[targetId] && !force) {
      console.log(`⚠️  Lead "${targetId}" wurde bereits eingeladen (${sent[targetId]}).`);
      console.log('   --force zum erneuten Senden.');
      return;
    }
    console.log(`→ ${lead.name} (${lead.email}) [${lead.category}]`);
    const result = await sendInvite(lead, dryRun);
    if (result.success && !dryRun) {
      sent[lead.id] = new Date().toISOString();
      saveSent(sent);
      const qLead = queue.leads.find(l => l.id === lead.id);
      if (qLead) qLead.invited = true;
      saveQueue(queue);
    }
  } else {
    // Status anzeigen
    const sentCount = emailable.filter(l => sent[l.id]).length;
    const openCount = emailable.filter(l => !sent[l.id]).length;

    console.log(`\nStatus: ${openCount} offen · ${sentCount} gesendet`);
    console.log(`\nOffene E-Mail-Leads:`);
    for (const l of emailable.filter(l => !sent[l.id])) {
      console.log(`  ${l.id}`);
      console.log(`    → ${l.name} (${l.email}) [${l.category}]`);
    }
    console.log('\nNutzung:');
    console.log('  node send_invite.js <lead-id>       Einzelnen Lead einladen');
    console.log('  node send_invite.js --all           Alle offenen senden');
    console.log('  node send_invite.js --dry-run       Vorschau ohne Senden');
    console.log('  node send_invite.js --dry-run --all Vorschau aller');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
