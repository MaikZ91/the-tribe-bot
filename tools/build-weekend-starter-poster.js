// Baut die Weekend-Starter-Kachel im Stil der Social-Warm-Up-Vorlage:
// schwarzer Kopf mit grosser Headline, Foto in der Mitte, Claim unten.
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

const OUT = process.argv[2] || 'weekend-starter.jpg';
const PHOTO = process.argv[3] || path.join(__dirname, '..', 'images', 'tribe-kennenlernabend.jpg');

const W = 1080;
const H = 1920;

// Vertikale Aufteilung, an der Vorlage abgemessen.
const HEAD_H = 560;   // schwarzer Kopfbereich
const PHOTO_H = 900;  // Foto
const FOOT_Y = HEAD_H + PHOTO_H;

const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style type="text/css">
      .head { font-family: 'Anton'; fill: #ffffff; font-size: 200px; letter-spacing: -2px; }
      .sub  { font-family: 'Anton'; fill: #ffffff; font-size: 74px; }
      .claim{ font-family: 'Anton'; fill: #ffffff; font-size: 78px; }
    </style>
  </defs>

  <text class="head"  x="52" y="205">WEEKEND</text>
  <text class="head"  x="52" y="395">STARTER</text>
  <text class="sub"   x="56" y="495">Jeden Freitag ab 20 Uhr</text>

  <text class="claim" x="52" y="${FOOT_Y + 120}">Starte mit THE TRIBE</text>
  <text class="claim" x="52" y="${FOOT_Y + 205}">ins Wochenende</text>
  <text class="claim" x="52" y="${FOOT_Y + 290}">– Location-Vorschläge</text>
  <text class="claim" x="52" y="${FOOT_Y + 375}">willkommen!</text>
</svg>`;

(async () => {
    // Im Quellfoto steht die alte "#Tribe Stammtisch"-Headline eingebrannt.
    // Der obere Streifen faellt weg, sonst stehen zwei Headlines auf der Kachel.
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
            { input: photo, top: HEAD_H, left: 0 },
            { input: Buffer.from(svg), top: 0, left: 0 }
        ])
        .jpeg({ quality: 90 })
        .toFile(OUT);

    const meta = await sharp(OUT).metadata();
    console.log(`${OUT}: ${meta.width}x${meta.height}, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
})();
