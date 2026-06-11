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
// Im Dauerbetrieb begrüßt der Bot ausserdem neue Mitglieder in jeder Stadtgruppe
// (group_join, öffentlich, stadt-spezifisch) — analog Bielefeld-Bot. KEINE der
// anderen Bielefeld-Features (Tuesday-Run, Jam, Fussball, Dashboard, Highlights …).
//
// Start:
//   node germany-bot.js          -> dauerhaft: Export+Refresh alle 30 min + Begrüßung neuer Mitglieder
//   node germany-bot.js --once    -> einmalig Karte exportieren und beenden (für Cron)
//   node germany-bot.js --poll    -> Social-Warmup-Umfrage in alle Stadtgruppen posten und beenden
//   BOT_COMMAND=germany-export|germany-poll node germany-bot.js   -> wie --once / --poll
// ============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client, LocalAuth, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');

const GERMANY_MAP_FILE = path.join(__dirname, 'docs', 'germany', 'cities.json');
const REFRESH_INTERVAL_MS = Number(process.env.GERMANY_REFRESH_INTERVAL_MS || 30 * 60 * 1000);
const ONE_SHOT =
    process.argv.includes('--once') ||
    (process.env.BOT_COMMAND || '').trim() === 'germany-export';
// Social-Warmup-Umfrage in alle Stadtgruppen posten und beenden (manuell ausgelöst,
// genau wie der Bielefeld-Bot seine Mittwochs-Umfrage triggert).
const POLL_MODE =
    process.argv.includes('--poll') ||
    (process.env.BOT_COMMAND || '').trim() === 'germany-poll';

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
    'Chemnitz', 'Halle', 'Darmstadt', 'Duisburg', 'Oberhausen', 'Krefeld', 'Mönchengladbach',
    'Kaiserslautern', 'Marburg', 'Tübingen', 'Lüneburg'
];

// ---------------------------------------------------------------------------
// Social-Warmup-Umfrage (analog Bielefeld-Bot) — pro Stadt eigene "coolste"
// Locations. Frei editierbar: hier ergänzen/ändern. Städte ohne Eintrag
// bekommen keine Location-Umfrage (werden geloggt, damit du sie nachträgst).
// ---------------------------------------------------------------------------
const VENUE_POLL_COUNT = 3;
const VENUE_POLL_CHAT_OPTION = "Eigener Vorschlag — schreib's in den Chat";
const CITY_VENUES = {
    'Bielefeld': ['Bernstein', 'Cafe Barcelona', 'Nichtschwimmer', 'Mellow Gold', 'Plan B'],
    'Berlin': ['Klunkerkranich', 'Hopfenreich', 'Prince Charles', 'Monkey Bar', 'Hofbräu Wirtshaus'],
    'Hamburg': ['Aurel', 'Katze', 'Komet Musikbar', 'Lunacy', 'Familieneck'],
    'München': ['Trachtenvogl', 'Goldene Bar', 'Holy Home', 'Zephyr Bar', 'Eat the Rich'],
    'Köln': ['Hallmackenreuther', 'Lotta', 'Heising & Adelmann', 'Low Budget', 'Zum Scheuen Reh'],
    'Frankfurt': ['Plank', 'Walden', 'Maxie Eisen', 'The Parlour', 'Yok Yok'],
    'Stuttgart': ['Paul & George', 'Misch Misch', 'Weiße Villa', 'Schräglage', '0711 Club'],
    'Düsseldorf': ['Pitcher', 'Salon des Amateurs', 'Sausalitos', 'Et Kabüffke', 'Knoten'],
    'Dortmund': ['subrosa', 'Tortuga', 'Nepomuk', 'Hövels Hausbrauerei', 'Pferdestall'],
    'Essen': ['Café Central', 'Hotto', 'Eulenspiegel', 'Cocoon', 'Grend'],
    'Leipzig': ['Noch Besser Leben', 'Killiwilly', 'Flowerpower', 'Sixtina', 'Telegraph'],
    'Dresden': ['Kollektiv', 'Combo', 'Louisengarten', 'Katys Garage', 'Hebeda’s'],
    'Hannover': ['Lux', 'Café Mezzo', 'Hausbar', 'Holländische Kakaostube', 'Stuttgarter Klause'],
    'Nürnberg': ['Kantine', 'Treibhaus', 'Gostner Hoftheater', 'Mr. Kennedy', 'Bar Modern'],
    'Bremen': ['Lila Eule', 'Karton', 'Tower', 'Spedition', 'Litfass'],
    'Münster': ['Cuba Nova', 'Pension Schmidt', 'Blaues Haus', 'Gleis 22', 'Cavete'],
    'Bonn': ['Pawlow', 'Bla', 'Nyam', 'Sunset', 'Café Spitz'],
    'Mannheim': ['Zwischenbau', 'Hagestolz', 'Murphy’s Law', 'Café Vienna', 'Tante Emma'],
    'Karlsruhe': ['Café Palaver', 'Stövchen', 'Kohi', 'Alte Hackerei', 'Vogelbräu'],
    'Augsburg': ['City Club', 'Mahagoni Bar', 'Yum Yum', 'Peaches', 'Ballonfabrik'],
    'Freiburg': ['Schmitz Katze', 'White Rabbit', 'Karma', 'Slow Club', 'Hausbar'],
    'Heidelberg': ['Café Gegendruck', 'Destille', 'Nachtschicht', 'Untere Strasse', 'Cave 54'],
    'Duisburg': ['Hundertmeister', 'Djäzz', 'Goldsaal', 'Pulp', 'Webster Brauhaus'],
    'Jena': ['Kassablanca', 'Café Wagner', 'Rosenkeller', 'Stilbruch', 'Grünowski'],
    'Lübeck': ['Hüxstrasse', 'Brauberger', 'Finnegan', 'Parkhaus', 'Café Affenbrot'],
    'Wiesbaden': ['Park Café', 'Wagner’s', 'Robert Johnson Nähe', 'Sherry & Port', 'Irish Pub'],
    'Mainz': ['Bagatelle', 'Eisgrub', '50grad', 'Q-Bar', 'Schon Schön'],
    'Aachen': ['B9', 'Domkeller', 'Pontstrasse', 'Café Kittel', 'Apollo']
};

// Begrüßung (analog Bielefeld) — öffentlich in der jeweiligen Stadtgruppe.
const WELCOME_GREETINGS = [
    'Hey {names}, willkommen bei THE TRIBE {city}! 👋',
    '{names} – schön dass ihr da seid! 🎉',
    'Willkommen {names}! 👋',
    '{names} sind jetzt dabei – herzlich willkommen! 🙌',
    'Hey {names}! Schön dass ihr hier seid 😊',
    '{names} – willkommen in {city}! ✌️'
];
const WELCOME_CONTEXT = [
    'Echte Treffen in {city}, jeden Samstag Social Warmup als Einstieg in den Abend – stellt euch kurz vor! 🙌',
    'Samstags Social Warmup – Einstieg in den Abend, danach ziehen wir gemeinsam weiter. Wer seid ihr? 👀',
    'THE TRIBE = echte Treffen. Samstags Social Warmup, danach gemeinsam los. Sagt kurz Hallo! 😄',
    'Jeden Samstag Social Warmup – kommt vorbei, lernt {city} kennen, dann ziehen wir weiter ✌️',
    'Hier treffen sich echte Menschen in {city} – samstags beim Social Warmup. Wer seid ihr? 😊'
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
// Begrüßung + Social-Warmup-Umfrage (analog Bielefeld-Bot, pro Stadtgruppe)
// ---------------------------------------------------------------------------
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function fillTemplate(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}
function isoWeek() {
    const d = new Date();
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

// Alle Gruppen-Chats dieses Accounts, die auf eine Stadt matchen.
async function getMatchedCityGroups() {
    const chats = await client.getChats();
    const out = [];
    for (const chat of chats) {
        if (!chat.isGroup) continue;
        const city = matchCityDirect(chat.name || '');
        if (city) out.push({ city, chat });
    }
    return out;
}

// Öffentliche Begrüßung neuer Mitglieder in der jeweiligen Stadtgruppe.
async function sendCityWelcome(chat, city, recipientIds) {
    const selfId = client.info?.wid?._serialized;
    const ids = (recipientIds || []).filter(id => id && id !== selfId);
    if (!ids.length) return;
    let names = [];
    try {
        const contacts = await Promise.all(ids.map(id => client.getContactById(id)));
        names = contacts.map(c => c.pushname || c.name || (c.number ? `+${c.number}` : null)).filter(Boolean);
    } catch (_) { /* Namen optional */ }
    const introNames = names.length
        ? (names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1])
        : 'ihr Neuen';
    const msg = fillTemplate(pick(WELCOME_GREETINGS), { names: introNames, city })
        + '\n' + fillTemplate(pick(WELCOME_CONTEXT), { names: introNames, city });
    try {
        await chat.sendMessage(msg);
        console.log(`Germany-Bot: Begrüßung in ${city} gesendet (${introNames}).`);
    } catch (err) {
        console.error(`Germany-Bot: Begrüßung in ${city} fehlgeschlagen:`, err.message);
    }
}

async function handleGroupJoin(notification) {
    if (ONE_SHOT || POLL_MODE) return; // nur im Dauerbetrieb begrüßen
    let chat;
    try { chat = await notification.getChat(); } catch (_) { return; }
    if (!chat || !chat.isGroup) return;
    const city = matchCityDirect(chat.name || '');
    if (!city) return;
    await sendCityWelcome(chat, city, notification.recipientIds || []);
}

// Social-Warmup-Location-Umfrage in jede Stadtgruppe posten (manuell via --poll).
async function sendSocialWarmupPolls() {
    const groups = await getMatchedCityGroups();
    if (!groups.length) { console.log('Germany-Bot: keine Stadtgruppen gefunden.'); return; }
    const week = isoWeek();
    let sent = 0;
    const noVenues = [];
    for (const { city, chat } of groups) {
        const all = CITY_VENUES[city];
        if (!all || !all.length) { noVenues.push(city); continue; }
        const off = week % all.length;
        const venues = all.slice(off).concat(all.slice(0, off)).slice(0, VENUE_POLL_COUNT);
        const options = [...venues, VENUE_POLL_CHAT_OPTION];
        const intro = [
            `Social Warmup ${city} — Samstag, 18 Uhr.`,
            '',
            'Einstieg in den Abend: entspannt ankommen, Leute kennenlernen, danach ziehen wir gemeinsam weiter.',
            '',
            'Drei Locations zur Auswahl:',
            ...venues.map(v => `👉 ${v}`),
            '',
            'Bis Freitag abstimmen. Eigene Idee? Ab in den Chat.'
        ].join('\n');
        try {
            await chat.sendMessage(intro);
            const pollMsg = await chat.sendMessage(new Poll('Location für den Social Warmup am Samstag?', options));
            try { await pollMsg.pin(604800); } catch (_) {}
            sent++;
            console.log(`Germany-Bot: Umfrage in ${city} gepostet (${venues.join(', ')}).`);
        } catch (err) {
            console.error(`Germany-Bot: Umfrage in ${city} fehlgeschlagen:`, err.message);
        }
    }
    console.log(`Germany-Bot: ${sent} Umfrage(n) gesendet.`);
    if (noVenues.length) console.log(`Germany-Bot: keine Locations hinterlegt für ${noVenues.join(', ')} — in CITY_VENUES ergänzen.`);
}

// ---------------------------------------------------------------------------
// WhatsApp-Client (eigene Session 'germany' — getrennt vom Bielefeld-Bot)
// ---------------------------------------------------------------------------
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'germany' }),
    authTimeoutMs: 120000, // wie der Bielefeld-Bot (index.js) — bekannt funktionierend
    takeoverOnConflict: true,
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

client.on('group_join', notification => {
    handleGroupJoin(notification).catch(err => console.error('Germany-Bot: group_join Fehler:', err.message));
});

client.on('ready', async () => {
    console.log('Germany-Bot ist online.');

    if (POLL_MODE) {
        try { await sendSocialWarmupPolls(); }
        catch (err) { console.error('Germany-Poll fehlgeschlagen:', err && err.stack ? err.stack : err); }
        await new Promise(r => setTimeout(r, 3000));
        await client.destroy().catch(() => {});
        process.exit(0);
        return;
    }

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
    console.log(`Germany-Bot: Auto-Refresh alle ${Math.round(REFRESH_INTERVAL_MS / 60000)} min + Begrüßung neuer Mitglieder aktiv. Strg+C zum Beenden.`);
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
