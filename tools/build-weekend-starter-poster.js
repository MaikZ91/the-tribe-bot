// Weekend-Starter-Kachel im 4:5-Feedformat (1080x1350).
//
// Instagram beschneidet die Profil-Vorschau. Headline, Subline und Foto liegen
// deshalb vollstaendig im zentralen Quadrat (y 135..1215) — damit bleiben sie
// sowohl im 4:5-Feed als auch in einem 1:1-Zuschnitt sichtbar. Nur der
// Claim-Balken unten darf wegfallen, der steht ohnehin in der Caption.
//
// Einmal-Werkzeug, nicht Teil der Bot-Laufzeit. Voraussetzungen, die bewusst
// NICHT in package.json stehen (sharp ist eine schwere native Abhaengigkeit,
// die der Bot selbst nicht braucht):
//
//   npm install sharp
//   Schrift Anton (SIL OFL) nach /usr/share/fonts/truetype/anton/ + fc-cache -f
//   https://github.com/google/fonts/tree/main/ofl/anton
//
// Aufruf:
//   node tools/build-weekend-starter-poster.js images/tribe-weekend-starter.jpg
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = process.argv[2] || 'weekend-starter-45.jpg';
const PHOTO = process.argv[3] || path.join(__dirname, '..', 'images', 'tribe-kennenlernabend.jpg');

const W = 1080;
const H = 1350;

const SAFE_TOP = (H - W) / 2;        // 135 — obere Kante des 1:1-Zuschnitts
const SAFE_BOTTOM = SAFE_TOP + W;    // 1215

const HEADER_END = 610;              // Ende des schwarzen Kopfbereichs
const PHOTO_TOP = HEADER_END;
const PHOTO_H = SAFE_BOTTOM - PHOTO_TOP;  // Foto endet exakt am Quadratrand

const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style type="text/css">
      .head  { font-family: 'Anton'; fill: #ffffff; font-size: 176px; letter-spacing: -2px; }
      .sub   { font-family: 'Anton'; fill: #ffffff; font-size: 66px; }
      .claim { font-family: 'Anton'; fill: #ffffff; font-size: 50px; }
    </style>
  </defs>

  <text class="head" x="50" y="330">WEEKEND</text>
  <text class="head" x="50" y="497">STARTER</text>
  <text class="sub"  x="54" y="580">Jeden Freitag ab 20 Uhr</text>

  <text class="claim" x="50" y="${SAFE_BOTTOM + 88}">Starte mit THE TRIBE ins Wochenende</text>
</svg>`;

(async () => {
    // Im Quellfoto steht die alte "#Tribe Stammtisch"-Headline eingebrannt.
    const src = sharp(PHOTO);
    const { width, height } = await src.metadata();
    const cropTop = Math.round(height * 0.24);

    const photo = await src
        .extract({ left: 0, top: cropTop, width, height: height - cropTop })
        .resize(W, PHOTO_H, { fit: 'cover', position: 'centre' })
        .toBuffer();

    await sharp({
        create: { width: W, height: H, channels: 3, background: { r: 0, g: 0, b: 0 } }
    })
        .composite([
            { input: photo, top: PHOTO_TOP, left: 0 },
            { input: Buffer.from(svg), top: 0, left: 0 }
        ])
        .jpeg({ quality: 90 })
        .toFile(OUT);

    // Gegenprobe: so sieht die Profil-Vorschau bei einem 1:1-Zuschnitt aus.
    await sharp(OUT)
        .extract({ left: 0, top: SAFE_TOP, width: W, height: W })
        .jpeg({ quality: 90 })
        .toFile(OUT.replace(/\.jpg$/, '-1zu1-vorschau.jpg'));

    const meta = await sharp(OUT).metadata();
    console.log(`${OUT}: ${meta.width}x${meta.height}, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
    console.log(`Vorschau 1:1 zusaetzlich geschrieben.`);
})();
