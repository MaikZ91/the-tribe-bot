/**
 * Ad-hoc: bedarfs-fokussierte Discovery für WIRKLICH schlechte Seiten.
 * Filter: (Kein HTTPS) ODER (nicht mobil-optimiert) UND Domain-Email
 * (kein Freemailer, sonst Bounce-Gefahr) UND genügend Bildmaterial.
 * Schreibt Kandidaten nach lead_agent_deepseek/batch10.json
 */
const path = require('path');
const fs = require('fs');
const { discover } = require('./discover');

const FREEMAIL = /@(gmx|web|t-online|gmail|googlemail|yahoo|hotmail|freenet|aol|outlook|live|icloud|me)\./i;

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
