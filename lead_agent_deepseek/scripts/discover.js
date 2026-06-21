/**
 * MZ.9 Lead Agent — Discovery (Overpass Edition)
 *
 * Robuste, autonome Lead-Findung über die OpenStreetMap Overpass API.
 * Ersetzt das fragile DuckDuckGo-Scraping. Liefert echte Betriebe pro
 * Stadt + Branche mit Name, Website, Telefon, E-Mail — strukturiert als JSON,
 * ohne API-Key.
 *
 * Pro Lead wird zusätzlich die Website gefetcht und ausgewertet:
 *   - Original-Bild-URLs (og:image + <img>) → Material für den Custom-Build
 *   - Kontaktdaten, Meta-Texte, Überschriften
 *   - Schwächen (kein HTTPS / nicht responsive / kein Formular / Baukasten)
 *   - Score (niedriger = mehr Hebel = lohnenderer Lead)
 *
 * CLI (zum Testen):
 *   node scripts/discover.js                  → zufällige Stadt+Branche, 3 Leads
 *   node scripts/discover.js Bielefeld Friseur 3
 *   node scripts/discover.js --queue          → Ergebnis direkt in queue.json
 *
 * Als Modul:
 *   const { discover } = require('./discover');
 *   const leads = await discover({ city, branch, count, log });
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { isKanzleiSteuer } = require('./rules');

const ROOT = path.join(__dirname, '..');
const QUEUE_FILE = path.join(ROOT, 'queue.json');
const LEADS_DIR = path.join(ROOT, 'leads');
const PREVIEW_DIR = path.join(ROOT, '..', 'docs', 'leads');

// ─── Städte & Branchen (deutschlandweite Rotation) ────────────────
const CITIES = [
  'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt am Main', 'Stuttgart',
  'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden',
  'Hannover', 'Nürnberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld',
  'Bonn', 'Münster', 'Karlsruhe', 'Mannheim', 'Augsburg', 'Wiesbaden',
  'Aachen', 'Mönchengladbach', 'Braunschweig', 'Kiel', 'Chemnitz', 'Halle',
  'Magdeburg', 'Freiburg im Breisgau', 'Krefeld', 'Lübeck', 'Erfurt', 'Mainz',
  'Rostock', 'Kassel', 'Saarbrücken', 'Osnabrück', 'Oldenburg', 'Potsdam',
  'Heidelberg', 'Paderborn', 'Darmstadt', 'Würzburg', 'Regensburg',
  'Ingolstadt', 'Göttingen', 'Ulm', 'Trier', 'Cottbus', 'Siegen',
];

// Branche → OSM-Tag-Filter (Overpass) + Anzeige-Industry + Slug-Prefix
const BRANCH_TAGS = {
  'Friseur':          { q: ['"shop"="hairdresser"'], industry: 'Friseur', prefix: 'friseur' },
  'Zahnarzt':         { q: ['"healthcare"="dentist"', '"amenity"="dentist"'], industry: 'Zahnarzt', prefix: 'zahnarzt' },
  'Maler':            { q: ['"craft"="painter"'], industry: 'Handwerk', prefix: 'maler' },
  'Dachdecker':       { q: ['"craft"="roofer"'], industry: 'Handwerk', prefix: 'dachdecker' },
  'Elektriker':       { q: ['"craft"="electrician"'], industry: 'Handwerk', prefix: 'elektro' },
  'Tischler':         { q: ['"craft"="carpenter"', '"craft"="joiner"'], industry: 'Handwerk', prefix: 'tischler' },
  'Schreiner':        { q: ['"craft"="joiner"', '"craft"="carpenter"'], industry: 'Handwerk', prefix: 'schreiner' },
  'Fliesenleger':     { q: ['"craft"="tiler"'], industry: 'Handwerk', prefix: 'fliesen' },
  'Sanitär':          { q: ['"craft"="plumber"'], industry: 'Handwerk', prefix: 'sanitaer' },
  'Heizung':          { q: ['"craft"="hvac"', '"craft"="plumber"'], industry: 'Handwerk', prefix: 'heizung' },
  'Gartenbau':        { q: ['"craft"="gardener"', '"landuse"="landscape"'], industry: 'Handwerk', prefix: 'garten' },
  'Restaurant':       { q: ['"amenity"="restaurant"'], industry: 'Gastronomie', prefix: 'restaurant' },
  'Fotograf':         { q: ['"craft"="photographer"', '"shop"="photo"'], industry: 'Dienstleistung', prefix: 'fotograf' },
  'Kosmetikstudio':   { q: ['"shop"="beauty"'], industry: 'Kosmetik', prefix: 'kosmetik' },
  'Massage':          { q: ['"shop"="massage"', '"healthcare"="massage"'], industry: 'Dienstleistung', prefix: 'massage' },
  'Physiotherapie':   { q: ['"healthcare"="physiotherapist"'], industry: 'Physiotherapie', prefix: 'physio' },
  'Bäcker':           { q: ['"shop"="bakery"'], industry: 'Gastronomie', prefix: 'baeckerei' },
  'Goldschmied':      { q: ['"craft"="jeweller"', '"shop"="jewelry"'], industry: 'Einzelhandel', prefix: 'goldschmied' },
  'Optiker':          { q: ['"shop"="optician"'], industry: 'Einzelhandel', prefix: 'optiker' },
  'Hörakustik':       { q: ['"shop"="hearing_aids"'], industry: 'Einzelhandel', prefix: 'hoerakustik' },
  'Fitnessstudio':    { q: ['"leisure"="fitness_centre"'], industry: 'Fitness', prefix: 'fitness' },
  'Blumenladen':      { q: ['"shop"="florist"'], industry: 'Einzelhandel', prefix: 'blumen' },
  'Fahrschule':       { q: ['"amenity"="driving_school"'], industry: 'Dienstleistung', prefix: 'fahrschule' },
  'Autowerkstatt':    { q: ['"shop"="car_repair"'], industry: 'Dienstleistung', prefix: 'kfz' },
  'Immobilienmakler': { q: ['"office"="estate_agent"'], industry: 'Immobilien', prefix: 'immobilien' },
  'Hundesalon':       { q: ['"shop"="pet_grooming"'], industry: 'Dienstleistung', prefix: 'hundesalon' },
};
const BRANCH_NAMES = Object.keys(BRANCH_TAGS);

// ─── Hilfen ───────────────────────────────────────────────────────
const noop = () => {};
function slugify(s) {
  return (s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}

function fetchUrl(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 4) return reject(new Error('too many redirects'));
    let mod;
    try { mod = url.startsWith('https') ? https : http; } catch { return reject(new Error('bad url')); }
    const req = mod.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MZ9-LeadAgent/2.0)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.destroy();
        const next = new URL(res.headers.location, url).href;
        return fetchUrl(next, redirects + 1).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => { data += c; if (data.length > 400000) { res.destroy(); resolve({ status: res.statusCode, html: data, finalUrl: url }); } });
      res.on('end', () => resolve({ status: res.statusCode, html: data, finalUrl: url }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function overpass(query) {
  const body = 'data=' + encodeURIComponent(query);
  const hosts = ['overpass-api.de', 'overpass.kumi.systems'];
  let attempt = 0;
  function tryHost() {
    return new Promise((resolve, reject) => {
      const host = hosts[attempt % hosts.length];
      const req = https.request({
        host, path: '/api/interpreter', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'MZ9-LeadAgent/2.0' },
        timeout: 60000,
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error('overpass ' + res.statusCode));
          try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('overpass parse: ' + e.message)); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('overpass timeout')); });
      req.write(body); req.end();
    }).catch(err => {
      if (++attempt < hosts.length) return tryHost();
      throw err;
    });
  }
  return tryHost();
}

// ─── Website-Auswertung ───────────────────────────────────────────
function absoluteUrl(src, base) {
  try { return new URL(src, base).href; } catch { return null; }
}

function evaluateSite(html, url) {
  const reasons = [];
  let score = 0; // höher = schlechtere Seite = mehr Hebel
  const https_ = url.startsWith('https');
  const responsive = /name=["']?viewport/i.test(html);
  const contact_form = /<form[\s>]/i.test(html);
  if (!https_) { score += 3; reasons.push('Kein HTTPS (nur http)'); }
  if (!responsive) { score += 3; reasons.push('Nicht mobil-optimiert (kein viewport)'); }
  if (!contact_form) { score += 2; reasons.push('Kein Kontaktformular'); }
  if (/jimdo|wix\.com|ionos|website-start|npage|1und1|webnode|weebly/i.test(html)) { score += 2; reasons.push('Veralteter Website-Baukasten'); }
  if (/wp-content|wordpress/i.test(html)) { score += 1; reasons.push('WordPress (potenziell veraltbar)'); }
  if ((html.match(/<img/gi) || []).length < 3) { score += 1; reasons.push('Wenig Bildmaterial'); }
  if (/@(gmx|web|t-online|gmail|googlemail|yahoo|hotmail)\./i.test(html)) { score += 1; reasons.push('Unprofessionelle E-Mail-Adresse'); }
  return { score, reasons, https: https_, responsive, contact_form };
}

function extractImages(html, base) {
  const imgs = new Set();
  const add = (raw) => {
    if (imgs.size >= 12) return;
    const u = absoluteUrl(raw, base);
    if (!u) return;
    if (/sprite|icon|logo|pixel|spacer|blank|white[_-]?space|placeholder|loading|\.svg(\?|$)|^data:/i.test(u)) return;
    if (!/\.(jpe?g|png|webp|avif)(\?|$|[#&])/i.test(u)) return; // nur echte Fotos
    imgs.add(u);
  };
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) add(og[1]);
  // <img src> + lazy-load-Varianten
  for (const m of html.matchAll(/<img[^>]+(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["']/gi)) add(m[1]);
  // srcset (<img srcset> / <source srcset>) — erste URL je Eintrag
  for (const m of html.matchAll(/srcset=["']([^"']+)["']/gi)) {
    for (const part of m[1].split(',')) add(part.trim().split(/\s+/)[0]);
  }
  // CSS-Hintergrundbilder: style="background-image:url(...)" + url(...) generell
  for (const m of html.matchAll(/background(?:-image)?\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/gi)) add(m[1]);
  return [...imgs];
}

// Holt Original-Bild-URLs zu einer Website (Fallback, wenn ein Lead keine hat).
async function fetchSiteImages(url) {
  try {
    const { html, finalUrl, status } = await fetchUrl(url);
    if (status >= 400 || !html) return [];
    return extractImages(html, finalUrl);
  } catch { return []; }
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&ndash;|&#8211;/g, '–').replace(/&mdash;|&#8212;/g, '—')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return ''; } })
    .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function extractContent(html) {
  const dec = decodeEntities;
  const title = dec((html.match(/<title>([^<]+)<\/title>/i) || ['', ''])[1]);
  const desc = dec((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || ['', ''])[1]);
  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => dec(m[1])).filter(Boolean).slice(0, 3);
  const h2 = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => dec(m[1])).filter(Boolean).slice(0, 8);
  return { title, desc, h1, h2 };
}

function extractContact(html) {
  const email = (html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [''])[0].toLowerCase();
  // Telefon aus tel:-Links bevorzugen (zuverlässiger als Freitext-Regex)
  let phone = (html.match(/href=["']tel:([+\d\s\/()-]{6,})["']/i) || ['', ''])[1].trim();
  if (!phone) {
    const m = html.match(/(?:\+49|0)[\s\/().-]?\d{2,5}[\s\/().-]?\d{3,4}[\s\/().-]?\d{2,8}/);
    // mind. 7 Ziffern, sonst verwerfen
    if (m && (m[0].replace(/\D/g, '').length >= 7)) phone = m[0].trim();
  }
  return { email, phone };
}

// ─── Dedup ────────────────────────────────────────────────────────
function loadDoneSet() {
  const ids = new Set();
  try { fs.readdirSync(LEADS_DIR).forEach(f => { if (f.endsWith('.json') && !f.startsWith('.')) ids.add(f.replace('.json', '')); }); } catch {}
  try { fs.readdirSync(PREVIEW_DIR, { withFileTypes: true }).forEach(d => { if (d.isDirectory() && d.name !== 'dashboard') ids.add(d.name); }); } catch {}
  return ids;
}

// ─── Hauptfunktion ────────────────────────────────────────────────
async function discover({ city, branch, count = 3, log = noop } = {}) {
  city = city || CITIES[Math.floor(Math.random() * CITIES.length)];
  branch = branch || BRANCH_NAMES[Math.floor(Math.random() * BRANCH_NAMES.length)];
  const cfg = BRANCH_TAGS[branch] || BRANCH_TAGS['Friseur'];
  log(`🔍 Discovery: ${branch} in ${city} (Overpass)`);

  const filters = cfg.q.map(t => `nwr[${t}](area.a);`).join('');
  const query = `[out:json][timeout:50];area["name"="${city}"]["boundary"="administrative"]->.a;(${filters});out tags 120;`;

  let data;
  try { data = await overpass(query); }
  catch (e) { log(`  ⚠️  Overpass-Fehler: ${e.message}`); return []; }

  const done = loadDoneSet();
  const candidates = (data.elements || [])
    .map(e => e.tags || {})
    .filter(t => t.name && (t.website || t['contact:website']))
    .map(t => ({
      name: t.name,
      website: (t.website || t['contact:website']).startsWith('http') ? (t.website || t['contact:website']) : 'http://' + (t.website || t['contact:website']),
      phone: t.phone || t['contact:phone'] || '',
      email: (t.email || t['contact:email'] || '').toLowerCase(),
      address: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ') + (t['addr:postcode'] ? `, ${t['addr:postcode']} ${city}` : `, ${city}`),
    }))
    .filter(c => !done.has(`${cfg.prefix}-${slugify(c.name)}`) && !done.has(slugify(c.name)))
    .filter(c => !isKanzleiSteuer(`${cfg.prefix}-${slugify(c.name)}`, cfg.industry, c.name)); // ⛔ Kanzlei/Recht/Steuer nie entdecken

  log(`  ${candidates.length} Kandidaten mit Website (nach Dedup).`);

  const leads = [];
  for (const c of candidates) {
    if (leads.length >= count) break;
    let html = '', finalUrl = c.website, status = 0;
    try { const r = await fetchUrl(c.website); html = r.html; finalUrl = r.finalUrl; status = r.status; }
    catch (e) { log(`  ⏭️  ${c.name}: Website nicht erreichbar (${e.message})`); continue; }
    if (status >= 400 || !html) { log(`  ⏭️  ${c.name}: HTTP ${status}`); continue; }

    const ev = evaluateSite(html, finalUrl);
    const content = extractContent(html);
    const images = extractImages(html, finalUrl);
    const scraped = extractContact(html);

    const id = `${cfg.prefix}-${slugify(c.name)}`;
    leads.push({
      id,
      name: c.name,
      nameShort: c.name.split(/\s+/).slice(0, 2).join(' '),
      industry: cfg.industry,
      branch: cfg.prefix,
      city,
      website: c.website,
      phone: c.phone || scraped.phone || '',
      email: c.email || scraped.email || '',
      address: c.address,
      score: ev.score,
      hebel: ev.score >= 5 ? 'hoch' : ev.score >= 3 ? 'mittel' : 'niedrig',
      reasons: ev.reasons,
      https: ev.https,
      responsive: ev.responsive,
      contact_form: ev.contact_form,
      // Material für den Custom-Build (Agent):
      images,
      scraped: content,
    });
    log(`  ✅ ${c.name} — Score ${ev.score} (${ev.reasons.length} Schwächen, ${images.length} Bilder)`);
  }

  // Lohnendste Leads zuerst (höchster Score = meiste Schwächen)
  leads.sort((a, b) => b.score - a.score);
  return leads;
}

// ─── CLI ──────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const toQueue = args.includes('--queue');
  const pos = args.filter(a => !a.startsWith('--'));
  const city = pos[0];
  const branch = pos[1];
  const count = parseInt(pos[2] || '3', 10);

  discover({ city, branch, count, log: m => console.log(m) }).then(leads => {
    console.log(`\n📦 ${leads.length} Leads gefunden:`);
    console.log(JSON.stringify(leads.map(l => ({ id: l.id, name: l.name, website: l.website, score: l.score, email: l.email, imgs: l.images.length })), null, 2));
    if (toQueue && leads.length) {
      const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      queue.leads = (queue.leads || []).concat(leads);
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
      console.log(`\n✅ ${leads.length} Leads in Queue geschrieben.`);
    }
  }).catch(e => { console.error('FATAL', e); process.exit(1); });
}

module.exports = { discover, fetchSiteImages, extractImages, CITIES, BRANCH_NAMES, slugify };