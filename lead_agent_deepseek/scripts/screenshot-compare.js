/**
 * MZ.9 — Screenshot-Vergleich: Original-Website vs. MZ.9 Preview
 *
 * Nutzung:
 *   node lead_agent_deepseek/scripts/screenshot-compare.js <lead-id>
 *
 * Erzeugt:
 *   docs/leads/<lead-id>/compare.png  — Side-by-Side-Vergleich (ein Bild)
 *   docs/leads/<lead-id>/original.png  — Original-Website Screenshot
 *   docs/leads/<lead-id>/preview.png   — MZ.9 Preview Screenshot
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PREVIEW_DIR = path.join(ROOT, '..', 'docs', 'leads');

async function screenshotCompare(leadId) {
  const leadDir = path.join(PREVIEW_DIR, leadId);
  const jobFile = path.join(leadDir, 'build-job.json');
  const idxFile = path.join(leadDir, 'index.html');

  if (!fs.existsSync(jobFile)) {
    console.error(`❌ Kein build-job.json für Lead "${leadId}"`);
    process.exit(1);
  }
  if (!fs.existsSync(idxFile)) {
    console.error(`❌ Keine index.html für Lead "${leadId}"`);
    process.exit(1);
  }

  const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  const origUrl = job.website;
  if (!origUrl) {
    console.error(`❌ Keine Website-URL für Lead "${leadId}"`);
    process.exit(1);
  }

  // GitHub Pages URL der Preview
  const previewUrl = `https://maikz91.github.io/the-tribe-bot/leads/${leadId}/`;

  console.log(`📸 Screenshot-Vergleich für: ${job.name}`);
  console.log(`   Original:  ${origUrl}`);
  console.log(`   Preview:   ${previewUrl}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // ─── Screenshot 1: Original-Website ─────────────────────────
    console.log('   1/3 Original-Website...');
    await page.goto(origUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000)); // Extra Wartezeit für Bilder/Animationen
    const origScreenshot = await page.screenshot({ fullPage: false, type: 'png' });
    fs.writeFileSync(path.join(leadDir, 'original.png'), origScreenshot);
    console.log('   ✅ Original gespeichert');

    // ─── Screenshot 2: MZ.9 Preview ─────────────────────────────
    console.log('   2/3 MZ.9 Preview...');
    await page.goto(previewUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    const previewScreenshot = await page.screenshot({ fullPage: false, type: 'png' });
    fs.writeFileSync(path.join(leadDir, 'preview.png'), previewScreenshot);
    console.log('   ✅ Preview gespeichert');

    // ─── Screenshot 3: Side-by-Side Vergleich ──────────────────
    console.log('   3/3 Vergleichsbild erstellen...');
    const origBase64 = origScreenshot.toString('base64');
    const previewBase64 = previewScreenshot.toString('base64');

    // HTML-Seite die beide Screenshots nebeneinander zeigt
    const compareHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;display:flex;width:2880px;height:900px;gap:0;font-family:Inter,system-ui,sans-serif}
.panel{flex:1;position:relative;overflow:hidden}
.panel img{width:100%;height:100%;object-fit:cover;object-position:top}
.badge{position:absolute;top:20px;left:20px;background:rgba(0,0,0,.75);color:#fff;padding:8px 18px;border-radius:8px;font-size:18px;font-weight:700;letter-spacing:.04em;z-index:2;backdrop-filter:blur(6px)}
.badge.old{border-left:4px solid #e74c3c}
.badge.new{border-left:4px solid #2ecc71}
.label{position:absolute;bottom:20px;left:20px;right:20px;color:rgba(255,255,255,.6);font-size:13px;z-index:2}
.divider{width:3px;background:linear-gradient(180deg,#2ecc71 0%,#3498db 50%,#e74c3c 100%);flex:none;z-index:3}
.arrow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.15);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;z-index:3;font-size:28px;color:#fff}
</style></head><body>
<div class="panel"><img src="data:image/png;base64,${origBase64}" alt="Original"><div class="badge old">VORHER — ${host(origUrl)}</div></div>
<div class="panel"><img src="data:image/png;base64,${previewBase64}" alt="MZ.9 Preview"><div class="badge new">NACHHER — MZ.9 Konzept</div></div>
</body></html>`;

    await page.setViewport({ width: 2880, height: 900 });
    await page.setContent(compareHtml, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const compareScreenshot = await page.screenshot({ type: 'png' });
    const comparePath = path.join(leadDir, 'compare.png');
    fs.writeFileSync(comparePath, compareScreenshot);
    console.log(`   ✅ Vergleichsbild gespeichert: ${comparePath}`);

    const stats = fs.statSync(comparePath);
    console.log(`\n📊 Fertig: ${(stats.size / 1024).toFixed(1)} KB — ${comparePath}`);
    console.log(`   Live: ${previewUrl}compare.png`);

    return {
      comparePath,
      compareUrl: `${previewUrl}compare.png`,
      name: job.name,
      origUrl,
      previewUrl,
    };
  } finally {
    await browser.close();
  }
}

function host(u) {
  return (u || '').replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '');
}

// ─── Main ─────────────────────────────────────────────────────────
const leadId = process.argv[2];
if (!leadId) {
  console.error('Nutzung: node screenshot-compare.js <lead-id>');
  process.exit(1);
}

screenshotCompare(leadId).catch(err => {
  console.error('❌ Fehler:', err.message);
  process.exit(1);
});
