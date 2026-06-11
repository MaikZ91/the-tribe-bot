// Build-Script: projiziert die Deutschland-Outline (GeoJSON) UND die Städte-
// Koordinaten mit DERSELBEN Mercator-Projektion auf ein gemeinsames SVG-Koordinaten-
// system. Ergebnis -> docs/germany/geometry.json (Outline-Path + Städte-x/y).
// Damit liegen die Städte-Punkte exakt auf der Karte. Einmal laufen lassen wenn
// sich die Städte-Liste ändert:  node build-germany-map.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Städte-Tabelle: name -> [lat, lng] -------------------------------------
// Großzügig gewählt, damit jede Stadt, die in der Community als WhatsApp-Gruppe
// auftaucht, automatisch korrekt platziert wird. Bot matcht Gruppennamen gegen
// diese Keys (siehe index.js / GERMANY_CITY_COORDS).
const CITIES = {
  'Bielefeld': [52.0302, 8.5325],
  'Berlin': [52.5200, 13.4050],
  'Hamburg': [53.5511, 9.9937],
  'München': [48.1351, 11.5820],
  'Köln': [50.9375, 6.9603],
  'Frankfurt': [50.1109, 8.6821],
  'Stuttgart': [48.7758, 9.1829],
  'Düsseldorf': [51.2277, 6.7735],
  'Dortmund': [51.5136, 7.4653],
  'Essen': [51.4556, 7.0116],
  'Leipzig': [51.3397, 12.3731],
  'Dresden': [51.0504, 13.7373],
  'Hannover': [52.3759, 9.7320],
  'Nürnberg': [49.4521, 11.0767],
  'Bremen': [53.0793, 8.8017],
  'Münster': [51.9607, 7.6261],
  'Bonn': [50.7374, 7.0982],
  'Mannheim': [49.4875, 8.4660],
  'Karlsruhe': [49.0069, 8.4037],
  'Wiesbaden': [50.0782, 8.2398],
  'Augsburg': [48.3705, 10.8978],
  'Freiburg': [47.9990, 7.8421],
  'Aachen': [50.7753, 6.0839],
  'Kiel': [54.3233, 10.1228],
  'Lübeck': [53.8655, 10.6866],
  'Rostock': [54.0924, 12.0991],
  'Magdeburg': [52.1205, 11.6276],
  'Erfurt': [50.9787, 11.0328],
  'Kassel': [51.3127, 9.4797],
  'Mainz': [49.9929, 8.2473],
  'Saarbrücken': [49.2402, 6.9969],
  'Osnabrück': [52.2799, 8.0472],
  'Paderborn': [51.7189, 8.7575],
  'Bochum': [51.4818, 7.2162],
  'Wuppertal': [51.2562, 7.1508],
  'Braunschweig': [52.2689, 10.5268],
  'Würzburg': [49.7913, 9.9534],
  'Regensburg': [49.0134, 12.1016],
  'Ingolstadt': [48.7665, 11.4258],
  'Heidelberg': [49.3988, 8.6724],
  'Ulm': [48.4011, 9.9876],
  'Oldenburg': [53.1435, 8.2146],
  'Potsdam': [52.3906, 13.0645],
  'Göttingen': [51.5413, 9.9158],
  'Koblenz': [50.3569, 7.5890],
  'Trier': [49.7490, 6.6371],
  'Konstanz': [47.6779, 9.1732],
  'Flensburg': [54.7937, 9.4460],
  'Gütersloh': [51.9069, 8.3786],
  'Herford': [52.1158, 8.6736],
  'Detmold': [51.9380, 8.8736],
  'Minden': [52.2885, 8.9166],
  'Bremerhaven': [53.5396, 8.5810],
  'Wolfsburg': [52.4227, 10.7865],
  'Jena': [50.9271, 11.5892],
  'Chemnitz': [50.8278, 12.9214],
  'Halle': [51.4969, 11.9688],
  'Darmstadt': [49.8728, 8.6512],
  'Oberhausen': [51.4963, 6.8638],
  'Krefeld': [51.3388, 6.5853],
  'Mönchengladbach': [51.1805, 6.4428],
  'Kaiserslautern': [49.4401, 7.7491],
  'Marburg': [50.8021, 8.7665],
  'Tübingen': [48.5216, 9.0576],
  'Lüneburg': [53.2509, 10.4144],
};

// --- Mercator-Projektion ----------------------------------------------------
const D2R = Math.PI / 180;
const mercX = (lng) => lng * D2R;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2));

const OUTLINE_FILE = path.join(__dirname, '.germany-outline.geo.json');
const OUTLINE_URL = 'https://raw.githubusercontent.com/isellsoap/deutschlandGeoJSON/main/1_deutschland/4_niedrig.geo.json';
if (!fs.existsSync(OUTLINE_FILE)) {
  console.log('Lade Deutschland-Outline …');
  const res = await fetch(OUTLINE_URL);
  if (!res.ok) throw new Error(`Outline-Download fehlgeschlagen: HTTP ${res.status}`);
  fs.writeFileSync(OUTLINE_FILE, await res.text());
}
const geo = JSON.parse(fs.readFileSync(OUTLINE_FILE, 'utf8'));
const feature = geo.features ? geo.features[0] : geo;
const geom = feature.geometry;
const polygons = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];

// Bounding-Box über alle Outline-Punkte (in Mercator-Raum)
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const poly of polygons) {
  for (const ring of poly) {
    for (const [lng, lat] of ring) {
      const x = mercX(lng), y = mercY(lat);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
}

const PAD = 26;            // Rand ums Land herum (SVG-Einheiten)
const TARGET_W = 760;      // Innen-Breite des Lands
const scale = TARGET_W / (maxX - minX);
const width = Math.round((maxX - minX) * scale + PAD * 2);
const height = Math.round((maxY - minY) * scale + PAD * 2);

const projX = (lng) => PAD + (mercX(lng) - minX) * scale;
const projY = (lat) => PAD + (maxY - mercY(lat)) * scale;   // y invertiert (Nord oben)
const r2 = (n) => Math.round(n * 10) / 10;

// Outline -> SVG-Path (jedes Polygon-Ring als Subpath, gerundet)
let outlinePath = '';
for (const poly of polygons) {
  for (const ring of poly) {
    ring.forEach(([lng, lat], i) => {
      outlinePath += (i === 0 ? 'M' : 'L') + r2(projX(lng)) + ' ' + r2(projY(lat));
    });
    outlinePath += 'Z';
  }
}

// Städte -> x/y
const cities = {};
for (const [name, [lat, lng]] of Object.entries(CITIES)) {
  cities[name] = [r2(projX(lng)), r2(projY(lat))];
}

const out = {
  viewBox: `0 0 ${width} ${height}`,
  width, height,
  outline: outlinePath,
  cities,
};

const outDir = path.join(__dirname, 'docs', 'germany');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'geometry.json'), JSON.stringify(out, null, 0));
console.log(`geometry.json geschrieben: viewBox ${out.viewBox}, ${Object.keys(cities).length} Städte, outline ${outlinePath.length} chars`);
