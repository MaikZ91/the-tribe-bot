// ============================================================================
// THE TRIBE · Germany-Bot  (eigenständig, getrennt vom Bielefeld-Bot index.js)
// ----------------------------------------------------------------------------
// Liest die WhatsApp-Stadt-Gruppen *dieses* Accounts aus (eine Gruppe pro Stadt),
// matcht den Gruppennamen direkt auf eine Stadt, holt Mitgliederzahl + Invite-Link
// und schreibt/merged docs/germany/cities.json — exakt das Format, das
// docs/germany/index.html (die /germany-Karte) erwartet. Danach commit + push.
//
// WICHTIG:
//  * Eigene WhatsApp-Session über LocalAuth({ clientId: 'germany' })  ->  separater
//    QR-Login = ZWEITE Nummer. Kollidiert NICHT mit der Session des Bielefeld-Bots.
//  * index.js (Bielefeld-Bot) wird NICHT angefasst. Beide schreiben dieselbe
//    cities.json; das Merge unten bewahrt fremde Einträge (inkl. Bielefeld), sodass
//    sich die beiden Bots nicht gegenseitig überschreiben.
//  * Bielefeld bleibt Sache des Bielefeld-Bots (Count kommt dort aus der Analyse);
//    dieser Bot fasst den Bielefeld-Eintrag nicht an.
//
// Start:
//   node germany-bot.js          -> dauerhaft: QR scannen, Export + Refresh alle 30 min
//   node germany-bot.js --once    -> einmalig exportieren und beenden (für Cron)
//   BOT_COMMAND=germany-export node germany-bot.js   -> wie --once
// ============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');

const GERMANY_MAP_FILE = path.join(__dirname, 'docs', 'germany', 'cities.json');
const REFRESH_INTERVAL_MS = Number(process.env.GERMANY_REFRESH_INTERVAL_MS || 30 * 60 * 1000);
const ONE_SHOT =
    process.argv.includes('--once') ||
    (process.env.BOT_COMMAND || '').trim() === 'germany-export';

// Kanonische Städte-Namen — identisch zu den Keys in docs/germany/geometry.json
// und zu GERMANY_CITIES im Bielefeld-Bot. Nur Städte aus dieser Liste haben eine
// Geo-Position auf der Karte. (Bei neuen Städten: hier ergänzen UND
// build-germany-map.mjs neu laufen lassen, damit Koordinaten dazukommen.)
const GERMANY_CITIES = [
    'Bielefeld', 'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart',
    'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Dresden', 'Hannover', 'Nürnberg',
    'Bremen', 'Münster', 'Bonn', 'Mannheim', 'Karlsruhe', 'Wiesbaden', 'Augsburg',
    'Freiburg', 'Aachen', 'Kiel', 'Lübeck', 'Rostock', 'Magdeburg', 'Erfurt', 'Kassel',
    'Mainz', 'Saarbrücken', 'Osnabrück', 'Paderborn', 'Bochum', 'Wuppertal',
    'Braunschweig', 'Würzburg', 'Regensburg', 'Ingolstadt', 'Heidelberg', 'Ulm',
    'Oldenburg', 'Potsdam', 'Göttingen', 'Koblenz', 'Trier', 'Konstanz', 'Flensburg',
    'Gütersloh', 'Herford', 'Detmold', 'Minden', 'Bremerhaven', 'Wolfsburg', 'Jena',
    'Chemnitz', 'Halle', 'Darmstadt', 'Oberhausen', 'Krefeld', 'Mönchengladbach',
    'Kaiserslautern', 'Marburg', 'Tübingen', 'Lüneburg'
];

function normalizeCityToken(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // Diakritika entfernen
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Direkte Zuordnung: der Gruppenname IST der Stadtname. Tolerant gegenüber einem
// optionalen "THE TRIBE …"-Präfix/-Suffix, aber KEIN Fuzzy-Matching — der Name
// muss (nach Entfernen der Tribe-Wörter) exakt einer Stadt entsprechen.
const TRIBE_WORDS = /\b(the|tribe|germany|deutschland|community|gruppe|group|chat|de|e\.?v\.?)\b/g;
function matchCityDirect(name) {
    const norm = normalizeCityToken(name);
    if (!norm) return null;
    const stripped = norm.replace(TRIBE_WORDS, '').replace(/\s+/g, ' ').trim();
    for (const city of GERMANY_CITIES) {
        const token = normalizeCityToken(city);
        if (norm === token || stripped === token) return city;
    }
    return null;
}

function memberCount(group) {
    if (Array.isArray(group.participants)) return group.participants.length;
    if (group.groupMetadata && Array.isArray(group.groupMetadata.participants)) {
        return group.groupMetadata.participants.length;
    }
    return 0;
}

function readExistingCities() {
    try {
        const raw = JSON.parse(fs.readFileSync(GERMANY_MAP_FILE, 'utf8'));
        if (Array.isArray(raw)) return raw;
    } catch (_) { /* Datei fehlt/leer/kaputt -> leer starten */ }
    return [];
}

function git(cmd) {
    return execSync(`git ${cmd}`, { cwd: __dirname }).toString().trim();
}

// Schreibt cities.json und committet/pusht nur diese eine Datei. Zieht vorher den
// neuesten Stand (damit der frische Bielefeld-Count erhalten bleibt und der Push
// als Fast-Forward durchgeht). Bei seltener Push-Kollision EIN Retry.
function writeAndPush(result) {
    const json = JSON.stringify(result, null, 2) + '\n';
    let current = '';
    try { current = fs.readFileSync(GERMANY_MAP_FILE, 'utf8'); } catch (_) {}
    if (json === current) {
        console.log('Germany-Map: keine Änderung.');
        return;
    }

    fs.mkdirSync(path.dirname(GERMANY_MAP_FILE), { recursive: true });
    fs.writeFileSync(GERMANY_MAP_FILE, json, 'utf8');

    const doCommitPush = () => {
        git('add docs/germany/cities.json');
        git('commit -m "update germany community map"');
        git('push origin main');
    };

    try {
        doCommitPush();
        console.log(`Germany-Map aktualisiert: ${result.length} Städte (${result.map(r => `${r.city}:${r.members}`).join(', ')}).`);
        return;
    } catch (err) {
        console.warn('Germany-Map: Push abgelehnt, versuche pull --rebase und erneut:', err.message);
    }

    // Retry: neuesten Stand holen, dann erneut pushen. Rebase scheitert -> abbrechen,
    // nächster Lauf holt es nach (kein Datenverlust, working tree bleibt unberührt).
    try {
        git('pull --rebase --autostash origin main');
        git('push origin main');
        console.log('Germany-Map: Push nach Rebase erfolgreich.');
    } catch (err) {
        try { git('rebase --abort'); } catch (_) {}
        console.error('Germany-Map: Commit/Push endgültig fehlgeschlagen:', err.message);
    }
}

async function exportGermanyMap() {
    // Frischen Stand ziehen, BEVOR wir mergen — so überschreiben wir keine
    // zwischenzeitlichen Bielefeld-/Fremd-Updates.
    try { git('pull --rebase --autostash origin main'); } catch (err) {
        console.warn('Germany-Map: git pull vorab fehlgeschlagen (fahre fort):', err.message);
    }

    let chats;
    try {
        chats = await client.getChats();
    } catch (err) {
        console.error('Germany-Map: getChats() fehlgeschlagen:', err.message);
        return;
    }

    const groups = chats.filter(chat => chat.isGroup);
    const discovered = new Map(); // city -> { members, link }
    const skipped = [];

    for (const group of groups) {
        const city = matchCityDirect(group.name || '');
        if (!city) { if (group.name) skipped.push(group.name); continue; }
        // Bielefeld gehört dem Bielefeld-Bot (Count aus der Landing-Analyse) -> nie überschreiben.
        if (city === 'Bielefeld') continue;

        const members = memberCount(group);
        let link = null;
        try {
            const code = await group.getInviteCode(); // nur als Admin verfügbar
            if (code) link = `https://chat.whatsapp.com/${code}`;
        } catch (_) {
            // kein Admin -> kein frischer Link, bestehenden behalten
        }

        const prev = discovered.get(city);
        if (!prev || members > prev.members) {
            discovered.set(city, { members, link: link || prev?.link || null });
        } else if (!prev.link && link) {
            prev.link = link;
        }
    }

    // Mit bestehender Datei mergen: fremde Einträge (Bielefeld, manuell gepflegte,
    // Städte die dieser Account nicht sieht) bleiben erhalten.
    const existing = readExistingCities();
    const byCity = new Map(existing.filter(e => e && e.city).map(e => [e.city, e]));
    for (const [city, info] of discovered) {
        const prev = byCity.get(city) || { city };
        byCity.set(city, {
            city,
            members: Number(info.members || prev.members || 0),
            link: info.link || prev.link || null
        });
    }

    const result = Array.from(byCity.values())
        .filter(entry => Number(entry.members || 0) > 0 || entry.link)
        .sort((a, b) => Number(b.members || 0) - Number(a.members || 0));

    const matched = Array.from(discovered.keys());
    console.log(`Germany-Map: ${matched.length} Stadt-Gruppen erkannt${matched.length ? ` (${matched.join(', ')})` : ''}.`);
    const unknown = skipped.filter(n => !/bielefeld/i.test(n));
    if (unknown.length) {
        console.log(`Germany-Map: ${unknown.length} Gruppe(n) ohne Städte-Match übersprungen: ${unknown.join(' | ')}`);
        console.log('  -> Falls eine davon eine Stadt ist: Gruppe exakt nach der Stadt benennen ODER die Stadt zu GERMANY_CITIES + geometry.json hinzufügen.');
    }

    try {
        writeAndPush(result);
    } catch (err) {
        console.error('Germany-Map: Schreiben fehlgeschlagen:', err.message);
    }
}

// ---------------------------------------------------------------------------
// WhatsApp-Client (eigene Session 'germany' — getrennt vom Bielefeld-Bot)
// ---------------------------------------------------------------------------
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'germany' }),
    authTimeoutMs: 0, // kein Timeout beim ersten QR-Login (Zeit zum Scannen mit der 2. Nummer)
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

client.on('qr', async qr => {
    console.log('\n=== Germany-Bot: QR-Code mit der TRIBE-GERMANY-Nummer scannen ===\n');
    qrcode.generate(qr, { small: false }, qrText => console.log(qrText));
    const pngPath = path.join(process.cwd(), 'germany-qr.png');
    try {
        await QRCode.toFile(pngPath, qr, { width: 512, margin: 2 });
        console.log(`QR-Code auch als Bild gespeichert: ${pngPath}`);
    } catch (err) {
        console.error('QR-PNG konnte nicht geschrieben werden:', err.message);
    }
});

client.on('authenticated', () => console.log('Germany-Bot: Session authentifiziert.'));
client.on('auth_failure', msg => console.error('Germany-Bot: Authentifizierung fehlgeschlagen:', msg));
client.on('loading_screen', (p, m) => console.log(`Germany-Bot lädt: ${p}% ${m || ''}`.trim()));
client.on('disconnected', reason => console.log('Germany-Bot: Verbindung getrennt:', reason));

let refreshTimer = null;

client.on('ready', async () => {
    console.log('Germany-Bot ist online.');

    if (ONE_SHOT) {
        try {
            await exportGermanyMap();
        } catch (err) {
            console.error('Germany-Export fehlgeschlagen:', err && err.stack ? err.stack : err);
        }
        // sendMessage/Web-Queue braucht kurz; hier nur Lesen+Git, 2s reichen.
        await new Promise(r => setTimeout(r, 2000));
        await client.destroy().catch(() => {});
        process.exit(0);
        return;
    }

    // Dauerbetrieb: sofort exportieren, dann periodisch.
    await exportGermanyMap().catch(err => console.error('Germany-Export fehlgeschlagen:', err.message));
    refreshTimer = setInterval(() => {
        exportGermanyMap().catch(err => console.error('Germany-Export (Refresh) fehlgeschlagen:', err.message));
    }, REFRESH_INTERVAL_MS);
    console.log(`Germany-Bot: Auto-Refresh alle ${Math.round(REFRESH_INTERVAL_MS / 60000)} min. Strg+C zum Beenden.`);
});

process.on('SIGINT', async () => {
    console.log('\nGermany-Bot wird beendet…');
    if (refreshTimer) clearInterval(refreshTimer);
    try { await client.destroy(); } catch (_) {}
    process.exit(0);
});

process.on('unhandledRejection', err => {
    console.error('Germany-Bot: unhandledRejection:', err && err.stack ? err.stack : err);
});

console.log('Germany-Bot: initialisiere WhatsApp-Client (Puppeteer startet Chromium)…');
client.initialize().catch(err => {
    console.error('Germany-Bot: client.initialize() fehlgeschlagen:', err && err.stack ? err.stack : err);
    process.exit(1);
});
