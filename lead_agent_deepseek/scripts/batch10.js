/**
 * Ad-hoc: bedarfs-fokussierte Discovery für WIRKLICH schlechte Seiten.
 * Filter: (Kein HTTPS) ODER (nicht mobil-optimiert) UND Domain-Email
 * (kein Freemailer, sonst Bounce-Gefahr) UND genügend Bildmaterial.
 * Schreibt Kandidaten nach lead_agent_deepseek/batch10.json
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { discover } = require('./discover');

const FREEMAIL = /@(gmx|web|t-online|gmail|googlemail|yahoo|hotmail|freenet|aol|outlook|live|icloud|me)\./i;

// Offensichtliche Nicht-Fotos (Logos, Text-Grafiken, Platzhalter, Sprites …).
const JUNK_IMG = /(logo|icon|sprite|spacer|blank|shapeimage|thumbnail|button|pixel|symbol|arrow|bg[-_]?|hintergrund|play\.png|placeholder|loader|avatar|badge|siegel|banner_)/i;

// Bilddimensionen aus JPEG/PNG-Header lesen (ohne Fremd-Lib).
function dimsFromBuffer(b) {
  if (!b || b.length < 24) return null;
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; // PNG
  if (b[0] === 0xFF && b[1] === 0xD8) { // JPEG
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xC0 && m <= 0xC3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      if (i + 2 >= b.length) break;
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

// Bild laden (max ~600KB, 8s) und Dimensionen zurückgeben.
function measureImage(url) {
  return new Promise((resolve) => {
    let mod, u;
    try { u = new URL(url); mod = u.protocol === 'https:' ? https : http; } catch { return resolve(null); }
    const req = mod.get(u, { headers: { 'User-Agent': 'MZ9-LeadAgent/2.0' }, timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) { res.destroy(); return resolve(null); }
      const chunks = []; let len = 0;
      res.on('data', (c) => { chunks.push(c); len += c.length; if (len > 600000) res.destroy(); });
      res.on('end', () => resolve(dimsFromBuffer(Buffer.concat(chunks))));
      res.on('close', () => resolve(dimsFromBuffer(Buffer.concat(chunks))));
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

// Prüft, ob ein Lead genügend ECHTE, verwendbare Fotos hat (≥ minGood
// Bilder mit langer Kante ≥ 500px, keine Junk-Grafiken). Bricht früh ab.
async function hasUsablePhotos(images, minGood = 2) {
  const cands = (images || []).filter((u) => u && /\.(jpe?g|png)(\?|$)/i.test(u) && !JUNK_IMG.test(u));
  let good = 0, checked = 0;
  for (const u of cands) {
    if (checked >= 10) break;
    checked++;
    const d = await measureImage(u);
    if (d && Math.max(d.w, d.h) >= 500 && Math.min(d.w, d.h) >= 300) { if (++good >= minGood) return true; }
  }
  return good >= minGood;
}

const CITIES = [
  // Ruhrgebiet / OWL
  'Gelsenkirchen', 'Herne', 'Recklinghausen', 'Bottrop', 'Gladbeck', 'Witten',
  'Hamm', 'Hagen', 'Iserlohn', 'Lüdenscheid', 'Gütersloh', 'Herford',
  'Minden', 'Detmold', 'Lippstadt', 'Soest', 'Unna', 'Castrop-Rauxel',
  'Marl', 'Dorsten', 'Datteln', 'Wesel', 'Dinslaken', 'Moers',
  'Solingen', 'Remscheid', 'Velbert', 'Ratingen', 'Neuss', 'Viersen',
  // weiteres NRW / Rheinland / Münsterland / Bergisches / Niederrhein
  'Bergisch Gladbach', 'Troisdorf', 'Siegburg', 'Euskirchen', 'Düren', 'Kerpen',
  'Grevenbroich', 'Dormagen', 'Willich', 'Kempen', 'Krefeld', 'Mönchengladbach',
  'Rheine', 'Ibbenbüren', 'Coesfeld', 'Ahlen', 'Beckum', 'Warendorf',
  'Gronau', 'Bocholt', 'Kleve', 'Goch', 'Emmerich', 'Kamp-Lintfort',
  'Bergkamen', 'Lünen', 'Schwerte', 'Menden', 'Arnsberg', 'Meschede',
  'Gevelsberg', 'Ennepetal', 'Schwelm', 'Wetter', 'Herdecke', 'Sprockhövel',
  'Paderborn', 'Bielefeld', 'Bad Oeynhausen', 'Löhne', 'Bünde', 'Hameln',
  // norddeutsche / hessische / niedersächsische Mittelstädte
  'Osnabrück', 'Oldenburg', 'Delmenhorst', 'Nordhorn', 'Lingen', 'Cloppenburg',
  'Kassel', 'Marburg', 'Gießen', 'Wetzlar', 'Fulda', 'Hanau',
  'Hildesheim', 'Salzgitter', 'Wolfsburg', 'Celle', 'Peine', 'Goslar',
];
const BRANCHES = ['Friseur', 'Dachdecker', 'Maler', 'Tischler', 'Elektriker',
  'Sanitär', 'Restaurant', 'Metzgerei', 'Baeckerei', 'Fliesenleger'];

function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
function domainOf(url) {
  try { return new URL(String(url).startsWith('http') ? url : 'http://' + url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}
// Bereits verarbeitete Betriebe (aus docs/leads/*/build-job.json) — nach
// Website-Domain UND E-Mail — damit Discovery keine schon gebauten Leads
// erneut vorschlägt (wichtig für den Dauerlauf).
function emailDomain(e) { const m = String(e || '').toLowerCase().match(/@([^@\s]+)$/); return m ? m[1].replace(/^www\./, '') : ''; }
function alreadyDone() {
  const domains = new Set(), emails = new Set();
  // Manuelle Skip-Liste (Qualitäts-Gate-Rejects) — sonst tauchen verworfene
  // Leads bei jeder Discovery erneut auf (sie landen nie in docs/leads/).
  try {
    const sk = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'skip.json'), 'utf8'));
    for (const d of (sk.domains || [])) { const x = domainOf(d) || String(d).toLowerCase(); if (x) domains.add(x); }
    for (const e of (sk.emails || [])) { emails.add(String(e).toLowerCase()); const ed = emailDomain(e); if (ed) domains.add(ed); }
  } catch {}
  const dir = path.join(__dirname, '..', '..', 'docs', 'leads');
  let entries = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return { domains, emails }; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, e.name, 'build-job.json'), 'utf8'));
      const d = domainOf(j.website); if (d) domains.add(d);
      const ed = emailDomain(j.email); if (ed) domains.add(ed);   // auch E-Mail-Domain (fängt Redirect-Fälle)
      if (j.email) emails.add(String(j.email).toLowerCase());
    } catch {}
  }
  return { domains, emails };
}

(async () => {
  const found = [];
  const seen = new Set();
  const done = alreadyDone();
  const N_TRIES = 40;
  const OUT = path.join(__dirname, '..', 'batch10.json');
  for (let i = 0; i < N_TRIES && found.length < 6; i++) {
    const city = rnd(CITIES), branch = rnd(BRANCHES);
    let leads = [];
    try { leads = await discover({ city, branch, count: 4, log: () => {} }); }
    catch (e) { process.stderr.write(`[batch10] ${city}/${branch} err\n`); continue; }
    for (const l of leads) {
      if (!l.email || FREEMAIL.test(l.email)) continue;        // Domain-Mail Pflicht
      const bad = (l.reasons || []).some(r => /Kein HTTPS|Nicht mobil/i.test(r));
      if (!bad) continue;                                       // muss wirklich schlecht sein
      if ((l.images || []).length < 3) continue;                // genug Rohmaterial
      if (seen.has(l.id)) continue; seen.add(l.id);
      const dom = domainOf(l.website), edom = emailDomain(l.email);   // schon verarbeitet? -> skip
      if ((dom && done.domains.has(dom)) || (edom && done.domains.has(edom)) || (l.email && done.emails.has(String(l.email).toLowerCase()))) continue;
      // Bildqualität VORAB prüfen: mind. 2 echte Fotos (lange Kante ≥500px,
      // keine Junk-Grafiken) — sonst nicht baubar, gar nicht erst vorschlagen.
      const usable = await hasUsablePhotos(l.images, 2);
      if (!usable) { process.stderr.write(`[batch10]   ⨯ ${l.id}: zu wenig verwendbare Fotos — übersprungen\n`); continue; }
      found.push({ id: l.id, name: l.name, city: l.city, branch: l.branch,
        website: l.website, email: l.email, phone: l.phone, score: l.score,
        reasons: l.reasons, imgs: (l.images || []).length });
    }
    fs.writeFileSync(OUT, JSON.stringify(found, null, 2));   // inkrementell sichern
    process.stderr.write(`[batch10] ${city}/${branch}: ${found.length} Kandidaten gesamt\n`);
  }
  found.sort((a, b) => b.score - a.score);
  fs.writeFileSync(path.join(__dirname, '..', 'batch10.json'), JSON.stringify(found, null, 2));
  console.log(JSON.stringify(found, null, 2));
})();
