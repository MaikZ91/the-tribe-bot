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
  'Gelsenkirchen', 'Herne', 'Recklinghausen', 'Bottrop', 'Gladbeck', 'Witten',
  'Hamm', 'Hagen', 'Iserlohn', 'Lüdenscheid', 'Gütersloh', 'Herford',
  'Minden', 'Detmold', 'Lippstadt', 'Soest', 'Unna', 'Castrop-Rauxel',
  'Marl', 'Dorsten', 'Datteln', 'Wesel', 'Dinslaken', 'Moers',
  'Solingen', 'Remscheid', 'Velbert', 'Ratingen', 'Neuss', 'Viersen',
];
const BRANCHES = ['Friseur', 'Dachdecker', 'Maler', 'Tischler', 'Elektriker',
  'Sanitär', 'Restaurant', 'Metzgerei', 'Baeckerei', 'Fliesenleger'];

function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }

(async () => {
  const found = [];
  const seen = new Set();
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
