/**
 * MZ.9 Lead Agent — Audit Script (DeepSeek Edition)
 *
 * Führt Lighthouse-Audit für eine URL aus und speichert das Ergebnis.
 * Aufruf: node lead_agent_deepseek/scripts/audit.js <url> <lead-id>
 *
 * Ersetzt den Playwright MCP DOM-Snapshot durch Lighthouse JSON + fetch_url Heuristik.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const url = process.argv[2];
const leadId = process.argv[3];

if (!url || !leadId) {
  console.error('Usage: node audit.js <url> <lead-id>');
  process.exit(1);
}

const outDir = path.join(__dirname, '..', 'leads');
const outFile = path.join(outDir, `${leadId}.json`);

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log(`🔍 Auditing ${url} → ${leadId}...`);

// 1. Lighthouse JSON (mobile, performance only für Geschwindigkeit)
const lhFile = path.join(outDir, `.lh-${leadId}.json`);
try {
  console.log('  📊 Lighthouse...');
  execSync(
    `npx lighthouse ${url} --output=json --output-path="${lhFile}" ` +
    `--only-categories=performance,accessibility,seo ` +
    `--form-factor=mobile --throttling-method=simulate ` +
    `--chrome-flags="--headless=new --no-sandbox" --quiet`,
    { stdio: 'inherit', timeout: 120_000 }
  );
} catch (err) {
  console.warn(`  ⚠️ Lighthouse fehlgeschlagen: ${err.message}`);
}

// 2. Lighthouse JSON auswerten
let scores = { performance: 0, accessibility: 0, seo: 0, bestPractices: 0 };
try {
  const lh = JSON.parse(fs.readFileSync(lhFile, 'utf8'));
  scores = {
    performance: Math.round((lh.categories?.performance?.score || 0) * 100),
    accessibility: Math.round((lh.categories?.accessibility?.score || 0) * 100),
    seo: Math.round((lh.categories?.seo?.score || 0) * 100),
    bestPractices: Math.round((lh.categories?.['best-practices']?.score || 0) * 100),
    lhUrl: lh.finalDisplayedUrl || url,
    lhFetchTime: lh.fetchTime || new Date().toISOString()
  };
  console.log(`  ✅ Perf:${scores.performance} A11y:${scores.accessibility} SEO:${scores.seo}`);
} catch {
  console.warn('  ⚠️ Konnte Lighthouse-JSON nicht auswerten');
}

// 3. Combined Score (vorläufig — Heuristik wird manuell vom Agent ergänzt)
const rawScore = Math.round(
  scores.performance * 0.4 +
  scores.accessibility * 0.1 +
  scores.seo * 0.1 +
  scores.bestPractices * 0.1
);
// Restliche 30% kommen aus manueller Heuristik (CTA, Trust, Mobile)

const result = {
  id: leadId,
  url,
  auditedAt: new Date().toISOString(),
  scores,
  rawScore,
  heuristicScore: null,   // Wird vom Agent manuell gesetzt
  finalScore: rawScore,    // rawScore + heuristicScore
  hebel: null,             // "hoch" / "mittel" / "niedrig"
  problems: [],            // Vom Agent zu füllen
  opps: [],                // Vom Agent zu füllen
  contactEmail: null       // Vom Agent aus Impressum zu recherchieren
};

fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(`  📁 Audit gespeichert: ${outFile}`);
console.log(JSON.stringify(result, null, 2));
