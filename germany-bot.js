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
// Im Dauerbetrieb: (1) begrüßt neue Mitglieder in jeder Stadtgruppe (group_join,
// öffentlich, stadt-spezifisch) und (2) fährt die volle Social-Warmup-Struktur wie
// der Bielefeld-Bot — Mi 20:00 Venue-Umfrage, Fr 18:00 Zusage-Umfrage am Gewinner,
// Sa 12:00 Reminder, mit DEMSELBEN Bild (images/tribe-kennenlernabend.jpg), pro Stadt.
// KEINE anderen Bielefeld-Features (Tuesday-Run, Jam, Fussball, Dashboard, Highlights …).
//
// Start:
//   node germany-bot.js          -> dauerhaft: Karte-Refresh + Begrüßung + Mi/Fr/Sa-Warmup-Schedule
//   node germany-bot.js --once    -> einmalig Karte exportieren und beenden (für Cron)
//   node germany-bot.js --poll    -> JETZT Venue-Umfrage (Mi-Schritt) in alle Stadtgruppen
//   node germany-bot.js --friday  -> JETZT Zusage-Umfrage (Fr-Schritt) am Gewinner-Venue
//   node germany-bot.js --reminder-> JETZT Samstags-Reminder posten
//   BOT_COMMAND=germany-export|germany-poll|germany-friday|germany-reminder node germany-bot.js
// ============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client, LocalAuth, Poll, MessageMedia } = require('whatsapp-web.js');
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
const FRIDAY_MODE =
    process.argv.includes('--friday') ||
    (process.env.BOT_COMMAND || '').trim() === 'germany-friday';
const REMINDER_MODE =
    process.argv.includes('--reminder') ||
    (process.env.BOT_COMMAND || '').trim() === 'germany-reminder';

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
const ATTENDANCE_OPTIONS = ['Bin dabei', 'Beim nächsten Mal'];
// Dasselbe Bild wie der Bielefeld-Bot (loadKennenlernabendMedia).
const WARMUP_IMAGE_FILE = process.env.TRIBE_KENNENLERNABEND_IMAGE_PATH
    || path.join(__dirname, 'images', 'tribe-kennenlernabend.jpg');
const WARMUP_STATE_FILE = path.join(__dirname, '.germany-warmup-state.json');
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

// --- Bild + Wochenstatus + Zeit/Vote-Helfer (analog Bielefeld-Bot) ---
function loadWarmupImage() {
    try { if (fs.existsSync(WARMUP_IMAGE_FILE)) return MessageMedia.fromFilePath(WARMUP_IMAGE_FILE); } catch (_) {}
    return null;
}
function readWarmupState() {
    try { const s = JSON.parse(fs.readFileSync(WARMUP_STATE_FILE, 'utf8')); return s && typeof s === 'object' ? s : {}; } catch (_) { return {}; }
}
function writeWarmupState(s) {
    try { fs.writeFileSync(WARMUP_STATE_FILE, JSON.stringify(s, null, 2) + '\n', 'utf8'); }
    catch (e) { console.error('Germany-Bot: Warmup-State schreiben fehlgeschlagen:', e.message); }
}
function berlinParts(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    const p = Object.fromEntries(fmt.formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    const noonUtc = new Date(Date.UTC(+p.year, +p.month - 1, +p.day, 12));
    return { hour: +p.hour, minute: +p.minute, weekdayIndex: noonUtc.getUTCDay(), dateKey: `${p.year}-${p.month}-${p.day}`, noonUtc };
}
function berlinWeekKey(date = new Date()) {
    const p = berlinParts(date);
    const mon = new Date(p.noonUtc.getTime() - ((p.weekdayIndex + 6) % 7) * 86400000);
    return `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, '0')}-${String(mon.getUTCDate()).padStart(2, '0')}`;
}
function findNextOccurrence({ weekdayIndex, hour, minute = 0 }, from = new Date()) {
    const c = new Date(from.getTime() + 60000); c.setSeconds(0, 0);
    for (let i = 0; i < 60 * 24 * 8; i++) {
        const p = berlinParts(c);
        if ((weekdayIndex === undefined || p.weekdayIndex === weekdayIndex) && p.hour === hour && p.minute === minute) return new Date(c);
        c.setMinutes(c.getMinutes() + 1, 0, 0);
    }
    throw new Error('kein gültiger nächster Zeitpunkt gefunden');
}
function getLatestVotesPerVoter(votes) {
    const m = new Map();
    for (const v of votes) { if (!v.voter) continue; const e = m.get(v.voter); if (!e || Number(v.interractedAtTs) >= Number(e.interractedAtTs)) m.set(v.voter, v); }
    return Array.from(m.values());
}
function venuesForWeek(all) {
    const off = isoWeek() % all.length;
    return all.slice(off).concat(all.slice(0, off)).slice(0, VENUE_POLL_COUNT);
}

// MITTWOCH: Venue-Umfrage „Location für den Social Warmup am Samstag?" + Bild, pro Stadt.
async function sendCityVenuePolls() {
    const groups = await getMatchedCityGroups();
    if (!groups.length) { console.log('Germany-Bot: keine Stadtgruppen gefunden.'); return; }
    const weekKey = berlinWeekKey();
    const state = readWarmupState();
    if (!state[weekKey]) state[weekKey] = {};
    const img = loadWarmupImage();
    let sent = 0; const noVenues = [];
    for (const { city, chat } of groups) {
        const all = CITY_VENUES[city];
        if (!all || !all.length) { noVenues.push(city); continue; }
        const venues = venuesForWeek(all);
        const options = [...venues, VENUE_POLL_CHAT_OPTION];
        const intro = [
            `Social Warmup ${city} — Samstag, 18 Uhr.`, '',
            'Einstieg in den Abend: entspannt ankommen, Leute kennenlernen, danach ziehen wir gemeinsam weiter.', '',
            'Drei Locations zur Auswahl:', ...venues.map(v => `👉 ${v}`), '',
            'Bis Freitag 18 Uhr abstimmen. Eigene Idee? Ab in den Chat.'
        ].join('\n');
        try {
            if (img) await chat.sendMessage(img, { caption: intro }); else await chat.sendMessage(intro);
            const pollMsg = await chat.sendMessage(new Poll('Location für den Social Warmup am Samstag?', options));
            try { await pollMsg.pin(604800); } catch (_) {}
            state[weekKey][city] = { ...(state[weekKey][city] || {}), venuePollId: pollMsg.id._serialized, options };
            sent++;
            console.log(`Germany-Bot: Venue-Umfrage in ${city} gepostet (${venues.join(', ')}).`);
        } catch (err) { console.error(`Germany-Bot: Venue-Umfrage in ${city} fehlgeschlagen:`, err.message); }
    }
    writeWarmupState(state);
    console.log(`Germany-Bot: ${sent} Venue-Umfrage(n) gesendet.`);
    if (noVenues.length) console.log(`Germany-Bot: keine Locations für ${noVenues.join(', ')} — CITY_VENUES ergänzen.`);
}

async function getCityWinner(cityState) {
    const opts = cityState?.options || [];
    const venueOpts = opts.filter(o => o !== VENUE_POLL_CHAT_OPTION);
    if (!cityState?.venuePollId) return venueOpts[0] || null;
    try {
        const votes = await client.getPollVotes(cityState.venuePollId);
        const counts = Object.fromEntries(opts.map(o => [o, 0]));
        for (const v of getLatestVotesPerVoter(votes)) {
            const o = v.selectedOptions?.[0]?.name;
            if (o && o in counts) counts[o] += 1;
        }
        return venueOpts.reduce((best, o) => (counts[o] > counts[best] ? o : best), venueOpts[0]) || null;
    } catch (_) { return venueOpts[0] || null; }
}

// FREITAG: Zusage-Umfrage am Gewinner-Venue „… bist du dabei?" + Bild, pro Stadt.
async function sendCityAttendancePolls() {
    const groups = await getMatchedCityGroups();
    if (!groups.length) { console.log('Germany-Bot: keine Stadtgruppen gefunden.'); return; }
    const weekKey = berlinWeekKey();
    const state = readWarmupState();
    if (!state[weekKey]) state[weekKey] = {};
    const img = loadWarmupImage();
    let sent = 0;
    for (const { city, chat } of groups) {
        const all = CITY_VENUES[city];
        if (!all || !all.length) continue;
        // Falls Mittwoch nichts lief (Bot war aus): Fallback-Rotation als Optionen.
        const cs = state[weekKey][city] || { options: [...venuesForWeek(all), VENUE_POLL_CHAT_OPTION] };
        const winner = (await getCityWinner(cs)) || all[0];
        const intro = [
            `Wir treffen uns am Samstag um 18 Uhr bei ${winner}.`, '',
            'Die Anmeldung ist verbindlich.', '',
            'Bitte beachte: Nur angemeldete Personen können wir für den Abend einplanen.',
            'Social Warm-Up — wer mag, zieht danach mit uns weiter.'
        ].join('\n');
        try {
            if (img) await chat.sendMessage(img, { caption: intro }); else await chat.sendMessage(intro);
            const pollMsg = await chat.sendMessage(new Poll(`Social Warmup am Samstag bei ${winner} – 18 Uhr (danach ziehen wir gemeinsam weiter): bist du dabei?`, ATTENDANCE_OPTIONS));
            try { await pollMsg.pin(604800); } catch (_) {}
            state[weekKey][city] = { ...cs, winner, attendancePollId: pollMsg.id._serialized };
            sent++;
            console.log(`Germany-Bot: Zusage-Umfrage in ${city} gepostet (Venue: ${winner}).`);
        } catch (err) { console.error(`Germany-Bot: Zusage-Umfrage in ${city} fehlgeschlagen:`, err.message); }
    }
    writeWarmupState(state);
    console.log(`Germany-Bot: ${sent} Zusage-Umfrage(n) gesendet.`);
}

// SAMSTAG: Reminder (am Gewinner-Venue, falls bekannt), pro Stadt.
async function sendCityReminders() {
    const groups = await getMatchedCityGroups();
    if (!groups.length) return;
    const weekKey = berlinWeekKey();
    const state = readWarmupState();
    let sent = 0;
    for (const { city, chat } of groups) {
        if (!CITY_VENUES[city]) continue;
        const winner = state[weekKey]?.[city]?.winner;
        const msg = winner
            ? `Reminder: Heute 18 Uhr Social Warmup in ${city} bei ${winner}. Kommt vorbei — danach ziehen wir gemeinsam weiter! 🎉`
            : `Reminder: Heute 18 Uhr Social Warmup in ${city}. Kommt vorbei — danach ziehen wir gemeinsam weiter! 🎉`;
        try { await chat.sendMessage(msg); sent++; } catch (err) { console.error(`Germany-Bot: Reminder in ${city} fehlgeschlagen:`, err.message); }
    }
    console.log(`Germany-Bot: ${sent} Reminder gesendet.`);
}

// Scheduler (Dauerbetrieb): Mi 20:00 Venue, Fr 18:00 Zusage, Sa 12:00 Reminder (Europe/Berlin).
let warmupJobs = [];
function scheduleWarmupJob(name, rule, task) {
    let next; try { next = findNextOccurrence(rule); } catch (e) { console.error(`Germany-Bot: ${name} nicht geplant: ${e.message}`); return; }
    console.log(`Germany-Bot: ${name} geplant für ${berlinParts(next).dateKey} ${String(rule.hour).padStart(2, '0')}:${String(rule.minute || 0).padStart(2, '0')} (Europe/Berlin).`);
    const id = setTimeout(async () => {
        try { await task(); } catch (err) { console.error(`Germany-Bot: ${name} Fehler:`, err.message); }
        finally { scheduleWarmupJob(name, rule, task); }
    }, Math.max(next.getTime() - Date.now(), 1000));
    warmupJobs.push(id);
}
function startWarmupScheduler() {
    scheduleWarmupJob('Mittwochs-Venue-Umfrage', { weekdayIndex: 3, hour: 20 }, () => sendCityVenuePolls());
    scheduleWarmupJob('Freitags-Zusage-Umfrage', { weekdayIndex: 5, hour: 18 }, () => sendCityAttendancePolls());
    scheduleWarmupJob('Samstags-Reminder', { weekdayIndex: 6, hour: 12 }, () => sendCityReminders());
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

    if (POLL_MODE || FRIDAY_MODE || REMINDER_MODE) {
        try {
            if (POLL_MODE) await sendCityVenuePolls();
            else if (FRIDAY_MODE) await sendCityAttendancePolls();
            else await sendCityReminders();
        } catch (err) { console.error('Germany-Poll fehlgeschlagen:', err && err.stack ? err.stack : err); }
        await new Promise(r => setTimeout(r, 4000)); // Medien/Polls in WhatsApp-Web-Queue flushen
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
    startWarmupScheduler();
    console.log(`Germany-Bot: Auto-Refresh alle ${Math.round(REFRESH_INTERVAL_MS / 60000)} min + Begrüßung + Social-Warmup-Schedule (Mi/Fr/Sa) aktiv. Strg+C zum Beenden.`);
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
