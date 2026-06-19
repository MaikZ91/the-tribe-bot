/**
 * MZ.9 Lead Agent — Continuous Loop (DeepSeek Edition)
 *
 * Kontinuierlicher Loop für GitHub Actions. Jeder Run verarbeitet einen Lead
 * aus der Queue. Wenn die Queue leer ist, löst er Auto-Discovery aus.
 *
 * Phasen pro Run:
 *   1. Queue prüfen → nächsten Lead nehmen
 *   2. ODER: Auto-Discovery (Web-Suche → Queue füllen)
 *   3. Audit (Lighthouse)
 *   4. Build (HTML-Preview aus Template)
 *   5. Deliver (Dashboard-Eintrag + Commit + Push)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Konfiguration ────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const QUEUE_FILE = path.join(ROOT, 'queue.json');
const LEADS_DIR = path.join(ROOT, 'leads');
const TEMPLATE_FILE = path.join(ROOT, 'templates', 'preview.html');
const DASHBOARD_FILE = path.join(ROOT, '..', 'docs', 'leads', 'dashboard', 'index.html');
const PREVIEW_DIR = path.join(ROOT, '..', 'docs', 'leads');
const GITHUB_PAGES_BASE = 'https://maikz91.github.io/the-tribe-bot/leads';

const COLORS = {
  gastronomie:   { accent: '#c2410c', dark: '#7c2d12', light: '#fdba74' },
  handwerk:      { accent: '#b45309', dark: '#78350f', light: '#fcd34d' },
  einzelhandel:  { accent: '#0d9488', dark: '#134e4a', light: '#5eead4' },
  dienstleistung:{ accent: '#2563eb', dark: '#1e3a5f', light: '#93c5fd' },
  friseur:       { accent: '#c77e6e', dark: '#a85f4f', light: '#d9a89b' },
  physio:         { accent: '#0d9488', dark: '#0f766e', light: '#5eead4' },
  kanzlei:       { accent: '#b8860b', dark: '#7c5e10', light: '#fde047' },
  zahnarzt:      { accent: '#0891b2', dark: '#155e75', light: '#67e8f9' },
  fitness:        { accent: '#65a30d', dark: '#3f6212', light: '#bef264' },
  optiker:       { accent: '#1d4ed8', dark: '#1e3a5f', light: '#93c5fd' },
  immobilien:    { accent: '#7c3aed', dark: '#4c1d95', light: '#c4b5fd' },
  default:       { accent: '#6366f1', dark: '#3730a3', light: '#a5b4fc' }
};

// ─── Hilfsfunktionen ───────────────────────────────────────────────
function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function loadJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function saveJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function getColors(industry) {
  const key = (industry || '').toLowerCase().trim();
  return COLORS[key] || COLORS.default;
}

// ─── Phase 1: Queue prüfen ────────────────────────────────────────
function getNextLead() {
  const queue = loadJson(QUEUE_FILE);
  if (!queue || !queue.leads || queue.leads.length === 0) return null;
  
  const lead = queue.leads.shift();
  if (!queue.processed) queue.processed = [];
  queue.processed.push({ id: lead.id, processedAt: new Date().toISOString() });
  saveJson(QUEUE_FILE, queue);
  return lead;
}

// ─── Phase 2: Auto-Discovery (Platzhalter — braucht LLM) ──────────
function autoDiscover() {
  const queue = loadJson(QUEUE_FILE);
  log(`⚠️  Queue leer. Auto-Discovery benötigt LLM (DeepSeek Agent).`);
  log(`   Branchen: ${(queue.settings.discover_branches || []).join(', ')}`);
  log(`   Bitte fülle die Queue manuell oder via DeepSeek Agent.`);
  
  // Schreibe eine Discovery-Aufforderung als Artefakt
  const discoFile = path.join(ROOT, 'DISCOVERY_NEEDED.txt');
  fs.writeFileSync(discoFile, 
    `Discovery needed at ${new Date().toISOString()}\n` +
    `Branches: ${(queue.settings.discover_branches || []).join(', ')}\n` +
    `Region: ${queue.settings.discover_region || 'Bielefeld'}\n`
  );
  
  return false;
}

// ─── Phase 3: Audit (Lighthouse) ──────────────────────────────────
async function auditLead(lead) {
  const lhFile = path.join(LEADS_DIR, `.lh-${lead.id}.json`);
  ensureDir(LEADS_DIR);
  
  log(`🔍 Lighthouse: ${lead.website}`);
  try {
    execSync(
      `npx lighthouse "${lead.website}" --output=json --output-path="${lhFile}" ` +
      `--only-categories=performance,accessibility,seo ` +
      `--form-factor=mobile --throttling-method=simulate ` +
      `--chrome-flags="--headless=new --no-sandbox" --quiet`,
      { stdio: 'pipe', timeout: 120_000 }
    );
  } catch (err) {
    log(`⚠️  Lighthouse fehlgeschlagen: ${err.message}`);
    return null;
  }
  
  try {
    const lh = JSON.parse(fs.readFileSync(lhFile, 'utf8'));
    const scores = {
      performance: Math.round((lh.categories?.performance?.score || 0) * 100),
      accessibility: Math.round((lh.categories?.accessibility?.score || 0) * 100),
      seo: Math.round((lh.categories?.seo?.score || 0) * 100),
    };
    log(`  ✅ Perf:${scores.performance} A11y:${scores.accessibility} SEO:${scores.seo}`);
    return scores;
  } catch {
    log('⚠️  Konnte Lighthouse-JSON nicht auswerten');
    return null;
  }
}

// ─── Phase 4: Build (HTML-Preview) ────────────────────────────────
function buildPreview(lead, scores) {
  if (!fs.existsSync(TEMPLATE_FILE)) {
    log(`⚠️  Template nicht gefunden: ${TEMPLATE_FILE}`);
    return null;
  }
  
  let html = fs.readFileSync(TEMPLATE_FILE, 'utf8');
  const colors = getColors(lead.industry);
  
  // Platzhalter ersetzen
  const vars = {
    '{{NAME}}': lead.name,
    '{{NAME_SHORT}}': lead.nameShort || lead.name,
    '{{INITIAL}}': (lead.name || '?')[0].toUpperCase(),
    '{{INDUSTRY}}': lead.industry || 'Unternehmen',
    '{{ACCENT}}': colors.accent,
    '{{ACCENT_DARK}}': colors.dark,
    '{{ACCENT_LIGHT}}': colors.light,
    '{{ACCENT_DARK_ENC}}': colors.dark.replace('#', '%23'),
    '{{ACCENT_ENC}}': colors.accent.replace('#', '%23'),
    '{{HERO_H1}}': lead.heroH1 || `${lead.name} — ${lead.industry} in Bielefeld`,
    '{{HERO_SUB}}': lead.heroSub || `Moderne ${lead.industry} — mit Herz, Handwerk und einem klaren Online-Auftritt.`,
    '{{CTA_TEXT}}': lead.ctaText || 'Jetzt anfragen',
    '{{CTA_HREF}}': lead.ctaHref || '#kontakt',
    '{{SECONDARY_CTA}}': lead.secondaryCta || 'Leistungen ansehen',
    '{{STRIP_ITEMS}}': (lead.stripItems || ['✦ Lokal in Bielefeld', '✦ Persönliche Beratung', '✦ Moderne Ausstattung', `✦ ${lead.industry} mit Erfahrung`])
      .map(s => `<span>${s}</span>`).join(''),
    '{{LEISTUNGEN_EYEBROW}}': lead.leistungenEyebrow || 'Leistungen',
    '{{LEISTUNGEN_H2}}': lead.leistungenH2 || `Das bieten wir Ihnen`,
    '{{LEISTUNGEN_SUB}}': lead.leistungenSub || 'Ein Auszug unserer Services.',
    '{{FEATURE_CARDS}}': (lead.features || ['Service 1', 'Service 2', 'Service 3']).map((f, i) => 
      `<div class="fcard rv"${i > 0 ? ` style="transition-delay:.${i*6}s"` : ''}><div class="ic">✦</div><h3>${f}</h3><p>Professionell, persönlich, zuverlässig.</p></div>`
    ).join(''),
    '{{REVIEW_CARDS}}': (lead.reviews || [
      { stars: 5, text: '"Super Service, sehr zu empfehlen."', author: 'Kunde · Google' },
      { stars: 5, text: '"Professionell und freundlich. Gerne wieder."', author: 'Kundin · Google' },
      { stars: 5, text: '"Endlich jemand, der sein Handwerk versteht."', author: 'Kunde · Google' }
    ]).map(r => `<div class="review rv"><div class="s">${'★'.repeat(r.stars)}</div><p>${r.text}</p><div class="who">— ${r.author}</div></div>`).join(''),
    '{{REVIEW_FOOTNOTE}}': lead.reviewFootnote || 'Echte Google-Bewertungen prominent einbinden — der bisher fehlende Trust-Baustein.',
    '{{CTA_BAND_EYEBROW}}': lead.ctaBandEyebrow || 'Jetzt Kontakt aufnehmen',
    '{{CTA_BAND_H2}}': lead.ctaBandH2 || `Bereit für den nächsten Schritt?`,
    '{{CTA_BAND_SUB}}': lead.ctaBandSub || `Nehmen Sie unverbindlich Kontakt auf — wir freuen uns auf Sie.`,
    '{{INFO_H2}}': lead.infoH2 || 'So erreichen Sie uns.',
    '{{CONTACT_DL}}': lead.contactDl || `<dt>Ort</dt><dd>Bielefeld</dd><dt>Telefon</dt><dd><a href="tel:${lead.phone || ''}" style="color:var(--accent-d);font-weight:700">${lead.phone || '—'}</a></dd><dt>E-Mail</dt><dd>${lead.email || '—'}</dd>`,
    '{{PHONE}}': lead.phone || '',
    '{{NAV_LINKS}}': `<a class="lk" href="#leistungen">Leistungen</a><a class="lk" href="#reviews">Bewertungen</a><a class="lk" href="#info">Kontakt</a>`,
    '{{FOOTER_DESC}}': lead.footerDesc || `${lead.industry} in Bielefeld — professionell, persönlich, zuverlässig.`,
    '{{FOOTER_NAV}}': `<a href="#leistungen">Leistungen</a><a href="#reviews">Bewertungen</a><a href="#info">Kontakt</a>`,
    '{{MOBILE_CTA_SHORT}}': lead.mobileCtaShort || 'Anfragen',
    '{{META_DESC}}': lead.metaDesc || `${lead.name} — ${lead.industry} in Bielefeld. ${lead.ctaText || 'Jetzt anfragen'}. Konzept-Vorschau von MZ.9.`,
    '{{TRUST_STRIP}}': lead.trustStrip || `<div class="stars"><span class="s">✦✦✦✦✦</span> ${lead.industry} in Bielefeld</div>`
  };
  
  for (const [key, value] of Object.entries(vars)) {
    html = html.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  
  // Speichern
  const leadPreviewDir = path.join(PREVIEW_DIR, lead.id);
  ensureDir(leadPreviewDir);
  const outFile = path.join(leadPreviewDir, 'index.html');
  fs.writeFileSync(outFile, html);
  
  log(`📄 Preview erstellt: ${outFile}`);
  return `https://maikz91.github.io/the-tribe-bot/leads/${lead.id}/`;
}

// ─── Phase 5: Deliver (Dashboard) ─────────────────────────────────
function updateDashboard(lead, previewUrl) {
  if (!fs.existsSync(DASHBOARD_FILE)) {
    log(`⚠️  Dashboard nicht gefunden: ${DASHBOARD_FILE}`);
    return false;
  }
  
  let dashHtml = fs.readFileSync(DASHBOARD_FILE, 'utf8');
  
  // Prüfen, ob Lead bereits existiert
  if (dashHtml.includes(`id:"${lead.id}"`)) {
    log(`  ℹ️  Lead ${lead.id} existiert bereits im Dashboard.`);
    return true;
  }
  
  // Leads-Array finden und neuen Eintrag einfügen
  const leadEntry = `\n    {id:"${lead.id}",name:"${lead.name}",industry:"${lead.industry}",hebel:"${lead.hebel || 'mittel'}",score:${lead.score || 50},website:"${lead.website}",problems:${JSON.stringify(lead.problems || ['Keine Bewertungen', 'Veraltetes Design', 'Schwache CTA'])},opps:${JSON.stringify(lead.opps || ['Google-Reviews einbinden', 'Modernes Design', 'Klare CTAs'])},preview:"${previewUrl}"},`;
  
  // Einfügen nach dem letzten Lead-Eintrag (vor dem schließenden ];)
  const insertPos = dashHtml.lastIndexOf('];');
  if (insertPos > 0) {
    dashHtml = dashHtml.slice(0, insertPos) + leadEntry + dashHtml.slice(insertPos);
  }
  
  // E-Mail eintragen
  if (lead.email) {
    const emailPos = dashHtml.lastIndexOf('};');
    const emailEntry = `\n    "${lead.id}":"${lead.email}",`;
    if (emailPos > 0 && !dashHtml.includes(`"${lead.id}":`)) {
      dashHtml = dashHtml.slice(0, emailPos) + emailEntry + dashHtml.slice(emailPos);
    }
  }
  
  fs.writeFileSync(DASHBOARD_FILE, dashHtml);
  log(`📊 Dashboard aktualisiert: ${lead.id}`);
  return true;
}

// ─── Phase 6: Git Commit + Push ───────────────────────────────────
function gitPush(lead) {
  try {
    const msg = `lead-agent: ${lead.id} — ${lead.name} (${lead.industry})`;
    execSync('git config user.name "MZ.9 Lead Agent"', { cwd: path.join(ROOT, '..') });
    execSync('git config user.email "agent@mz9.ai"', { cwd: path.join(ROOT, '..') });
    execSync(`git add docs/leads/${lead.id}/ docs/leads/dashboard/ lead_agent_deepseek/queue.json lead_agent_deepseek/leads/`, { cwd: path.join(ROOT, '..') });
    execSync(`git commit -m "${msg}"`, { cwd: path.join(ROOT, '..'), stdio: 'pipe' });
    execSync('git push', { cwd: path.join(ROOT, '..'), stdio: 'pipe' });
    log(`🚀 Push: ${msg}`);
    return true;
  } catch (err) {
    log(`⚠️  Git Push fehlgeschlagen: ${err.message}`);
    return false;
  }
}

// ─── Main Loop ────────────────────────────────────────────────────
async function main() {
  log('═══ MZ.9 Lead Agent — Loop Start ═══');
  
  // 1. Nächsten Lead aus Queue holen
  let lead = getNextLead();
  
  if (!lead) {
    log('📭 Queue leer.');
    const discovered = autoDiscover();
    if (!discovered) {
      log('⏸️  Keine Leads zum Verarbeiten. Warte auf nächsten Run.');
      return;
    }
    lead = getNextLead();
    if (!lead) return;
  }
  
  log(`📋 Verarbeite: ${lead.id} — ${lead.name} (${lead.industry})`);
  
  // 2. Audit
  const scores = await auditLead(lead);
  if (scores) {
    lead.score = lead.score || Math.round(scores.performance * 0.5 + scores.accessibility * 0.2 + scores.seo * 0.1);
    lead.lighthouseScores = scores;
  }
  
  // 3. Build
  const previewUrl = buildPreview(lead, scores);
  if (!previewUrl) {
    log('❌ Build fehlgeschlagen.');
    return;
  }
  
  // 4. Deliver
  updateDashboard(lead, previewUrl);
  
  // 5. Push (nur im CI, nicht lokal)
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    gitPush(lead);
  } else {
    log('💻 Lokaler Lauf — kein Auto-Push.');
  }
  
  // Audit-Ergebnis speichern
  saveJson(path.join(LEADS_DIR, `${lead.id}.json`), lead);
  
  log('═══ Loop Ende ═══');
}

main().catch(err => {
  log(`❌ Fatal: ${err.message}`);
  process.exit(1);
});
