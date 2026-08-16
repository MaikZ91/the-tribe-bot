const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Client, LocalAuth, Poll, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const readline = require('readline');
const { generateDailyHighlightsVideo } = require('./render-highlights-video.js');

const POSTHOG_PUBLIC_KEY = process.env.POSTHOG_PUBLIC_KEY || 'phc_ktsJAdQbuZh9PbsdX7RxZdTWZjEgkZLHAyB7kzb9eG6t';
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com';

async function capturePostHog(event, distinctId, properties = {}) {
    try {
        const res = await fetch(`${POSTHOG_HOST}/capture/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: POSTHOG_PUBLIC_KEY,
                event,
                distinct_id: distinctId,
                properties: { $lib: 'the-tribe-bot', ...properties },
                timestamp: new Date().toISOString()
            })
        });
        if (!res.ok) {
            console.warn(`PostHog capture ${event} responded ${res.status}`);
        }
    } catch (err) {
        console.warn(`PostHog capture ${event} failed: ${err.message}`);
    }
}

function hashMemberId(rawId) {
    return crypto.createHash('sha256').update(String(rawId)).digest('hex').slice(0, 24);
}

const EVENTS_URL = 'https://raw.githubusercontent.com/MaikZ91/productiontools/master/events.json';
const STATE_FILE = path.join(__dirname, '.daily-highlights-state.json');
const ANALYTICS_FILE = path.join(__dirname, '.community-dashboard.json');
const PENDING_MEMBERS_FILE = path.join(__dirname, '.pending-new-members.json');
const KNOWN_MEMBERS_FILE = path.join(__dirname, '.known-members.json');
const GERMANY_MAP_FILE = path.join(__dirname, 'docs', 'germany', 'cities.json');
const GERMANY_BIELEFELD_LINK = 'https://chat.whatsapp.com/CTbK6Xi8QHRExmoXhkaqvL';
// Kanonische Städte-Namen — identisch zu den Keys in docs/germany/geometry.json.
// Gruppennamen der Community werden gegen diese Liste gematcht (Auto-Discovery
// für /germany). Wenn sich die Liste ändert: build-germany-map.mjs neu laufen lassen.
const GERMANY_CITIES = [
    'Bielefeld', 'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart',
    'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Dresden', 'Hannover', 'Nürnberg',
    'Bremen', 'Münster', 'Bonn', 'Mannheim', 'Karlsruhe', 'Wiesbaden', 'Augsburg',
    'Freiburg', 'Aachen', 'Kiel', 'Lübeck', 'Rostock', 'Magdeburg', 'Erfurt', 'Kassel',
    'Mainz', 'Saarbrücken', 'Osnabrück', 'Paderborn', 'Bochum', 'Wuppertal',
    'Braunschweig', 'Würzburg', 'Regensburg', 'Ingolstadt', 'Heidelberg', 'Ulm',
    'Oldenburg', 'Potsdam', 'Göttingen', 'Koblenz', 'Trier', 'Konstanz', 'Flensburg',
    'Gütersloh', 'Herford', 'Detmold', 'Lage', 'Minden', 'Bremerhaven', 'Wolfsburg', 'Jena',
    'Chemnitz', 'Halle', 'Darmstadt', 'Oberhausen', 'Krefeld', 'Mönchengladbach',
    'Kaiserslautern', 'Marburg', 'Tübingen', 'Lüneburg'
];
const TIME_ZONE = 'Europe/Berlin';
const DAILY_POST_HOUR = 9;
const MAX_HIGHLIGHTS = 5;

// Nur Events an diesen Locations kommen auf den Tageshighlights-Flyer.
// In der Event-Liste steht die Location im Namen als "(@handle)", daher wird
// kleingeschrieben gegen den Namen gematcht. Ueber HIGHLIGHT_VENUES
// (kommagetrennt) ueberschreibbar, ohne Code-Aenderung.
const HIGHLIGHT_VENUES = (process.env.HIGHLIGHT_VENUES || [
    'stereobielefeld',
    'forum_bielefeld',
    'sams_bielefeld',
    'movie_liveclub',
    'hinterzimmer.club',
    'platzhirschbielefeld',
    'cafe_europa_bi',
    'lokschuppen',
    'groovestation',
    'nr.z.p',
    'irish_pub_bielefeld',
    'bunker ulmenwall',
    'falkendom',
    'stadthalle bielefeld'
].join(','))
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);

// Wiederkehrende Reihen, die trotz passender Location nicht auf den Flyer
// sollen — sie laufen jede Woche und sind keine Highlights. Kommagetrennt
// ueber HIGHLIGHT_EXCLUDED_SERIES ueberschreibbar.
const HIGHLIGHT_EXCLUDED_SERIES = (process.env.HIGHLIGHT_EXCLUDED_SERIES || 'cutie,afro')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);

function isHighlightVenue(entry) {
    const name = String(entry.event || '').toLowerCase();
    if (HIGHLIGHT_EXCLUDED_SERIES.some(series => name.includes(series))) {
        return false;
    }
    return HIGHLIGHT_VENUES.some(venue => name.includes(venue));
}

function isTribeEvent(entry) {
    return /tribe/i.test(String(entry.event || ''));
}
const DASHBOARD_PORT = Number(process.env.DASHBOARD_PORT || 3000);
const DASHBOARD_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const INITIAL_MESSAGE_HISTORY_LIMIT = Number(process.env.DASHBOARD_MESSAGE_HISTORY_LIMIT || 250);
const STAMMTISCH_VENUES = [
    'Bernstein',
    "L'Osteria",
    'Cafe Barcelona',
    'Brauhaus Johann Albrecht',
    'Kachelhaus',
    'Fabel',
    'Alex',
    'Glueck & Seligkeit',
    'Hechelei',
    'Capvin',
    'Plan B',
    'Nichtschwimmer',
    'Mellow Gold'
];
const VENUE_POLL_WEEKLY_COUNT = 3;
// Erst ab so vielen wartenden Neuzugaengen geht eine Begruessung raus.
const WELCOME_BATCH_SIZE = Number(process.env.WELCOME_BATCH_SIZE || 4);
const VENUE_POLL_CHAT_OPTION = "Eigener Vorschlag - schreib's in den Chat";
// Ab diesem Montag ersetzt der Weekend Starter (Fr 20 Uhr) den Social Warmup
// (Sa 18 Uhr). Die laufende Woche wird davor noch im alten Format zu Ende
// gefahren, damit die bereits gestellte Mittwochs-Umfrage nicht ins Leere geht.
const WEEKEND_STARTER_START_DATE = '2026-08-03';

const WEEKEND_STARTER_FORMAT = {
    label: 'Weekend Starter',
    day: 'Freitag',
    dayAdverb: 'freitags',
    time: '20 Uhr',
    timeShort: '20:00',
    // weekdayIndex wie getUTCDay(): 0 = Sonntag
    eventWeekdayIndex: 5,
    claim: 'Starte mit THE TRIBE ins Wochenende.'
};

const SOCIAL_WARMUP_FORMAT = {
    label: 'Social Warmup',
    day: 'Samstag',
    dayAdverb: 'samstags',
    time: '18 Uhr',
    timeShort: '18:00',
    eventWeekdayIndex: 6,
    claim: 'Einstieg in den Abend, danach ziehen wir gemeinsam weiter.'
};

const WEEKEND_STARTER_OPENERS = [
    'Freitag, 20 Uhr - starte mit THE TRIBE ins Wochenende.',
    'Neue Woche, neuer Freitag, neue Location.',
    'Freitagabend ohne Plan? Hier ist einer.',
    'Freitag, 20 Uhr - Tisch, Drink, neue Gesichter.',
    'Mittwoch heisst: wo starten wir Freitag ins Wochenende?',
    'Weekend Starter steht: Freitag, 20 Uhr, offline und echt.',
    'Wochenende beginnt Freitag um 20 Uhr - wo, entscheidet ihr.'
];

const SOCIAL_WARMUP_OPENERS = [
    'Samstag, 18 Uhr - Tribe trifft sich offline.',
    'Neue Woche, neuer Samstag, neue Location.',
    'Bielefeld-Samstag ohne Plan? Hier ist einer.',
    'Samstag, 18 Uhr - Tisch, Drink, neue Gesichter.',
    'Mittwoch heisst: wo treffen wir uns Samstag?',
    'Diese Woche wieder Tribe-Samstag - 18 Uhr, offline, echt.',
    'Samstag-Plan steht: 18 Uhr, Tribe-Tisch.'
];
const WEEK_OVERRIDES = {
    '2026-05-25': {
        venues: ['Plan B', 'Nichtschwimmer', 'Mellow Gold'],
        skipSpecialSaturday: true
    },
    // Rotation waere Alex | Glueck & Seligkeit | Hechelei gewesen; Liv nimmt
    // den Platz der Hechelei ein.
    //
    // skipVenuePoll: die Umfrage wurde diese Woche von Hand in der Gruppe
    // gestellt. Der Bot hat davon keinen State — ohne diesen Schalter wuerde
    // der Mittwochs-Lauf sie am Abend ein zweites Mal posten.
    '2026-08-10': {
        venues: ['Liv', 'Alex', 'Glueck & Seligkeit'],
        skipVenuePoll: true
    }
};
const SPECIAL_SATURDAY_OPENERS = [
    'Letzter Samstag im Monat - Zeit fuer was anderes.',
    'Special-Samstag steht an - keine Kneipe, was Neues.',
    'Ein Mal im Monat raus aus dem Tisch-Modus.',
    'Special-Samstag - wir machen gemeinsam was abseits der Bar.'
];
const SPECIAL_SATURDAY_ACTIVITIES = [
    { name: 'SpielSamstag',  emoji: '🎲', time: '18 Uhr',                blurb: 'Brettspiele, Karten, Wuerfel - bringt mit was ihr habt oder Cafe mit Spielregal.' },
    { name: 'Walk + Bar',    emoji: '🚶', time: '17 Uhr (Sommer 18 Uhr)', blurb: 'Spaziergang Altstadt oder Sparrenburg, danach gemeinsam einkehren.' },
    { name: 'Kochen',        emoji: '🍝', time: '17 Uhr',                blurb: 'Gemeinsam kochen beim Host - wer hat Platz und Bock?' },
    { name: 'Sofa-Konzert',  emoji: '🎸', time: '19 Uhr',                blurb: 'Akustik im Wohnzimmer. Spieler bringt Instrument, Hoerer bringt Wein.' },
    { name: 'Wandern',       emoji: '🥾', time: '11 Uhr (Tagestour)',    blurb: 'Teutoburger Wald, Hermannshoehen oder Senne. Route klaert die Orga im Chat.' },
    { name: 'Jam Session',   emoji: '🎶', time: '18 Uhr',                blurb: 'Instrumente mitbringen, zusammen klimpern. Singen, Trommeln, Loops - alles erlaubt.' },
    { name: 'Foto-Walk',     emoji: '📷', time: '17 Uhr (zum Sunset)',   blurb: 'Kamera oder Handy reicht. Spaziergang durch die Stadt, Bilder spaeter im Chat teilen.' }
];
const SPECIAL_SATURDAY_POLL_OPTIONS = [
    'Bin dabei',
    'Uebernehme die Orga',
    'Vielleicht',
    'Nicht diese Woche'
];
const ATTENDANCE_OPTIONS = ['Bin dabei', 'Beim naechsten Mal'];
const TUESDAY_RUN_ATTENDANCE_OPTIONS = ['Bin dabei', 'Vielleicht', 'Diesmal nicht'];
const THURSDAY_FOOTBALL_ATTENDANCE_OPTIONS = ['Bin dabei', 'Vielleicht', 'Diesmal nicht'];
const JAM_SESSION_ATTENDANCE_OPTIONS = ['Kuenstler', 'Teilnehmer'];
const PING_PONG_ATTENDANCE_OPTIONS = ['Ja, bin dabei', 'Heute nicht'];
const IMAGES_DIR = path.join(__dirname, 'images');
const TUESDAY_RUN_DEFAULT_IMAGE_PATH = path.join(IMAGES_DIR, 'tribe-tuesday-run.jpg');
const THURSDAY_FOOTBALL_DEFAULT_IMAGE_PATH = TUESDAY_RUN_DEFAULT_IMAGE_PATH;
const JAM_SESSION_DEFAULT_IMAGE_PATH = path.join(IMAGES_DIR, 'creative_circle.mp4');
const KENNENLERNABEND_DEFAULT_IMAGE_PATH = path.join(IMAGES_DIR, 'tribe-kennenlernabend.jpg');
const WEEKEND_STARTER_IMAGE_PATH = path.join(IMAGES_DIR, 'tribe-weekend-starter.jpg');
const DAILY_HIGHLIGHTS_IMAGE_DIR = path.join(IMAGES_DIR, 'daily-highlights');

const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_USER_ID = process.env.IG_USER_ID;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const BOT_COMMAND = (process.env.BOT_COMMAND || process.argv.find(arg => arg.startsWith('--bot-command='))?.split('=')[1] || '').trim();
const IS_ONE_SHOT_RUN = BOT_COMMAND.length > 0;
// Dauerlauf auf CI: Verbindung offen halten, statt nach einem Kommando zu
// beenden. Nur so kommen 'message' und 'group_join' wieder an — Dashboard-
// Zahlen und Mitglieder-Begruessung haengen an diesen Push-Ereignissen, nicht
// an getChats(). Kein Terminal, also auch keine readline-Konsole.
const IS_RESIDENT_RUN = process.env.BOT_RESIDENT === '1' && !IS_ONE_SHOT_RUN;

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Phone number in international, symbol-free format (e.g. 4915112345678).
// When set, WhatsApp links this device via an 8-character pairing code instead
// of a QR code — no second screen needed to authenticate.
const PAIRING_NUMBER = (process.env.WHATSAPP_PAIRING_NUMBER || '').replace(/\D/g, '');

// WhatsApp Web auf einen bekannten Build festnageln. Gegen den ausgelieferten
// Build (2.3000.1044058164) scheitert in dieser Library alles, was ein
// Message-Objekt aufloesen muss: senden, Umfragen, getChats, getChatById —
// die Verbindung selbst steht. Ein aelterer Build, gegen den die Library
// gebaut wurde, bringt das erfahrungsgemaess zurueck.
// Leerer Wert schaltet das Pinning ab.
const WEB_VERSION = process.env.WHATSAPP_WEB_VERSION === undefined
    ? '2.3000.1043572178-alpha'
    : process.env.WHATSAPP_WEB_VERSION;

const client = new Client({
    authStrategy: new LocalAuth(),
    authTimeoutMs: 120000,
    ...(WEB_VERSION
        ? {
            webVersionCache: {
                type: 'remote',
                remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${WEB_VERSION}.html`
            }
        }
        : {}),
    // Standardmaessig erneuert whatsapp-web.js den Kopplungscode alle 3 Minuten
    // und macht den vorherigen damit ungueltig — wer den Code erst ablesen und
    // dann im Handy eintippen muss, jagt einem beweglichen Ziel hinterher.
    // Laengeres Intervall laesst einen Code stehen.
    ...(PAIRING_NUMBER
        ? {
            pairWithPhoneNumber: {
                phoneNumber: PAIRING_NUMBER,
                showNotification: true,
                intervalMs: Number(process.env.PAIRING_INTERVAL_MS || 5 * 60 * 1000)
            }
        }
        : {}),
    puppeteer: {
        headless: true,
        // Injecting the WhatsApp Web store regularly exceeds puppeteer's 180s
        // default on CI runners, which aborts initialize() with a ProtocolError.
        protocolTimeout: 300000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    }
});

const chatId = process.env.WHATSAPP_CHAT_ID || '120363426194120338@g.us';
const tuesdayRunChatId = process.env.WHATSAPP_TUESDAY_RUN_CHAT_ID || '120363423926212258@g.us';
const jamSessionChatId = process.env.WHATSAPP_JAM_SESSION_CHAT_ID || '120363426677676365@g.us';
const announcementChatId = process.env.WHATSAPP_ANNOUNCEMENTS_CHAT_ID || '120363425963185977@g.us';
const ausgehenChatId = process.env.WHATSAPP_AUSGEHEN_CHAT_ID || '120363426194120338@g.us';
const communityJoinSourceChatIds = new Set(
    (process.env.WHATSAPP_COMMUNITY_SOURCE_CHAT_IDS || announcementChatId)
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
);

let rl;
let isReady = false;
let authPending = false;
let scheduledJobs = [];
let dashboardServer;
let dashboardRefreshIntervalId;
let cachedWebsiteAnalytics = null;
const dashboardLogs = [];
const MAX_DASHBOARD_LOGS = 500;
const recentMessages = [];
const MAX_RECENT_MESSAGES = 30;
const MESSAGE_BODY_PREVIEW_LIMIT = 220;
const MEDIA_TYPE_LABELS = {
    image: '[Bild]',
    video: '[Video]',
    sticker: '[Sticker]',
    audio: '[Sprachnachricht]',
    ptt: '[Sprachnachricht]',
    document: '[Dokument]',
    location: '[Standort]',
    vcard: '[Kontakt]',
    multi_vcard: '[Kontakte]',
    revoked: '[geloeschte Nachricht]'
};

function pushDashboardLog(level, args) {
    const message = args.map(value => {
        if (value instanceof Error) {
            return value.stack || value.message;
        }

        if (typeof value === 'string') {
            return value;
        }

        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }).join(' ');

    dashboardLogs.push({
        at: new Date().toISOString(),
        level,
        message
    });

    if (dashboardLogs.length > MAX_DASHBOARD_LOGS) {
        dashboardLogs.splice(0, dashboardLogs.length - MAX_DASHBOARD_LOGS);
    }
}

for (const level of ['log', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
        pushDashboardLog(level, args);
        original(...args);
    };
}

function getBerlinNow() {
    return new Date();
}

function getDateParts(date = getBerlinNow()) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = Object.fromEntries(
        formatter.formatToParts(date)
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, part.value])
    );

    const utcNoonDate = new Date(Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        12,
        0,
        0
    ));

    return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        weekday: parts.weekday,
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
        utcNoonDate,
        weekdayIndex: utcNoonDate.getUTCDay(),
        dateKey: `${parts.year}-${parts.month}-${parts.day}`
    };
}

function formatUtcDateKey(utcDate) {
    const year = utcDate.getUTCFullYear();
    const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utcDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getBerlinWeekKey(date = getBerlinNow()) {
    const parts = getDateParts(date);
    const daysSinceMonday = (parts.weekdayIndex + 6) % 7;
    const mondayUtc = new Date(parts.utcNoonDate.getTime() - (daysSinceMonday * 24 * 60 * 60 * 1000));
    return formatUtcDateKey(mondayUtc);
}

function getWeekNumber(weekKey) {
    const [year, month, day] = weekKey.split('-').map(Number);
    const utcDate = Date.UTC(year, month - 1, day, 12, 0, 0);
    return Math.floor(utcDate / (7 * 24 * 60 * 60 * 1000));
}

function getWeekRotationIndex(weekKey) {
    return (getWeekNumber(weekKey) * VENUE_POLL_WEEKLY_COUNT) % STAMMTISCH_VENUES.length;
}

/**
 * Laeuft die Woche schon im Weekend-Starter-Format?
 * dateKey ist YYYY-MM-DD, ein String-Vergleich reicht daher.
 */
function isWeekendStarterActive(dateKey = getDateParts().dateKey) {
    return dateKey >= WEEKEND_STARTER_START_DATE;
}

/**
 * Das aktive Wochenend-Format samt Tag, Uhrzeit und Claim. Alle Texte ziehen
 * ihre Angaben hier heraus, statt Tag und Uhrzeit fest einzubauen.
 */
function getEventFormat(dateKey = getDateParts().dateKey) {
    return isWeekendStarterActive(dateKey) ? WEEKEND_STARTER_FORMAT : SOCIAL_WARMUP_FORMAT;
}

function getOpenerForWeek(weekKey, dateKey = getDateParts().dateKey) {
    const openers = isWeekendStarterActive(dateKey) ? WEEKEND_STARTER_OPENERS : SOCIAL_WARMUP_OPENERS;
    return openers[getWeekNumber(weekKey) % openers.length];
}

function getUpcomingSaturdayUtcDate(weekKey) {
    const [year, month, day] = weekKey.split('-').map(Number);
    const mondayUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
    return new Date(mondayUtc + 5 * 24 * 60 * 60 * 1000);
}

/**
 * Datum des Event-Abends der Woche: Freitag im Weekend-Starter-Format,
 * sonst Samstag. weekKey ist der Montag der Woche.
 */
function getEventDayUtcDate(weekKey, dateKey = getDateParts().dateKey) {
    const [year, month, day] = weekKey.split('-').map(Number);
    const mondayUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
    const offsetDays = isWeekendStarterActive(dateKey) ? 4 : 5;
    return new Date(mondayUtc + offsetDays * 24 * 60 * 60 * 1000);
}

function isLastSaturdayOfMonth(weekKey) {
    const saturdayDate = getUpcomingSaturdayUtcDate(weekKey);
    const nextSaturdayDate = new Date(saturdayDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    return saturdayDate.getUTCMonth() !== nextSaturdayDate.getUTCMonth();
}

function getSaturdayMonthIndex(weekKey) {
    const saturdayDate = getUpcomingSaturdayUtcDate(weekKey);
    return saturdayDate.getUTCFullYear() * 12 + saturdayDate.getUTCMonth();
}

function getSpecialSaturdayActivity(weekKey) {
    return SPECIAL_SATURDAY_ACTIVITIES[getSaturdayMonthIndex(weekKey) % SPECIAL_SATURDAY_ACTIVITIES.length];
}

function getSpecialSaturdayOpener(weekKey) {
    return SPECIAL_SATURDAY_OPENERS[getSaturdayMonthIndex(weekKey) % SPECIAL_SATURDAY_OPENERS.length];
}

function rotateArray(values, shift) {
    const normalizedShift = ((shift % values.length) + values.length) % values.length;
    return values.slice(normalizedShift).concat(values.slice(0, normalizedShift));
}

function getVenueOptionsForWeek(weekKey) {
    if (WEEK_OVERRIDES[weekKey]?.venues) {
        return WEEK_OVERRIDES[weekKey].venues.slice(0, VENUE_POLL_WEEKLY_COUNT);
    }
    return rotateArray(STAMMTISCH_VENUES, getWeekRotationIndex(weekKey)).slice(0, VENUE_POLL_WEEKLY_COUNT);
}

function getTodayDateLabels(date = getBerlinNow()) {
    const { month, day } = getDateParts(date);
    const englishWeekday = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE,
        weekday: 'short'
    }).format(date);
    const germanWeekday = new Intl.DateTimeFormat('de-DE', {
        timeZone: TIME_ZONE,
        weekday: 'short'
    }).format(date).replace('.', '');
    const year = getDateParts(date).year;

    return [
        `${englishWeekday}, ${day}.${month}.${year}`,
        `${germanWeekday}, ${day}.${month}.${year}`,
        `${englishWeekday}, ${day}.${month}`,
        `${germanWeekday}, ${day}.${month}`
    ].map(label => label.trim());
}

function readState() {
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function writeState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Scheduled jobs are matched by a 30-minute time window, and several cron
 * entries can land in the same window — so a job could run twice on one day.
 * These two record and check a per-day marker to keep it to once.
 */
function wasJobDoneToday(name, dateKey) {
    return (readState().dueJobs || {})[name] === dateKey;
}

function markJobDone(name, dateKey) {
    const state = readState();
    state.dueJobs = { ...(state.dueJobs || {}), [name]: dateKey };
    writeState(state);
}

function getState() {
    const state = readState();

    if (!state.weeklyPolls) {
        state.weeklyPolls = {};
    }

    if (!state.weeklyAnnouncements) {
        state.weeklyAnnouncements = {};
    }

    return state;
}

function readAnalytics() {
    try {
        return JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function writeAnalytics(analytics) {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2));
}

function readPendingNewMembers() {
    try {
        const raw = JSON.parse(fs.readFileSync(PENDING_MEMBERS_FILE, 'utf8'));
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

function writePendingNewMembers(ids) {
    fs.writeFileSync(PENDING_MEMBERS_FILE, JSON.stringify(ids, null, 2));
}

function readKnownMembers() {
    try {
        const raw = JSON.parse(fs.readFileSync(KNOWN_MEMBERS_FILE, 'utf8'));
        return raw && typeof raw === 'object' ? raw : {};
    } catch {
        return {};
    }
}

function writeKnownMembers(snapshot) {
    fs.writeFileSync(KNOWN_MEMBERS_FILE, JSON.stringify(snapshot, null, 2));
}

function getAnalytics() {
    const analytics = readAnalytics();

    if (!analytics.trackedChats) {
        analytics.trackedChats = {};
    }

    if (!analytics.messagesByDate) {
        analytics.messagesByDate = {};
    }

    if (!analytics.activeUsersByDate) {
        analytics.activeUsersByDate = {};
    }

    if (!analytics.attendance) {
        analytics.attendance = [];
    }

    if (!analytics.communityJoins) {
        analytics.communityJoins = [];
    }

    if (!analytics.memberCountHistory) {
        analytics.memberCountHistory = {};
    }

    return analytics;
}

function getTrackedChatIds() {
    return unique([chatId, tuesdayRunChatId, jamSessionChatId, announcementChatId, ausgehenChatId]);
}

function getTrackedChatLabel(targetChatId) {
    if (targetChatId === chatId) {
        return 'Community Hauptchat';
    }

    if (targetChatId === tuesdayRunChatId) {
        return 'Tuesday Run';
    }

    if (targetChatId === jamSessionChatId) {
        return 'Jam Session';
    }

    if (targetChatId === announcementChatId) {
        return 'Announcements';
    }

    if (targetChatId === ausgehenChatId) {
        return 'Ausgehen';
    }

    return targetChatId;
}

function ensureChatAnalytics(analytics, targetChatId) {
    if (!analytics.trackedChats[targetChatId]) {
        analytics.trackedChats[targetChatId] = {
            label: getTrackedChatLabel(targetChatId),
            memberCount: 0,
            messagesByDate: {},
            activeUsersByDate: {},
            lastMessageAt: null,
            lastSyncedAt: null
        };
    }

    return analytics.trackedChats[targetChatId];
}

function addUniqueValue(values, value) {
    if (!value) {
        return values || [];
    }

    const nextValues = Array.isArray(values) ? values : [];
    if (!nextValues.includes(value)) {
        nextValues.push(value);
    }

    return nextValues;
}

function getMessageDate(message) {
    if (message?.timestamp) {
        return new Date(Number(message.timestamp) * 1000);
    }

    return getBerlinNow();
}

function getMessageAuthorId(message) {
    return message.author || message.from || null;
}

function getMessageChatId(message) {
    const trackedChatIds = getTrackedChatIds();
    if (trackedChatIds.includes(message.from)) {
        return message.from;
    }

    if (trackedChatIds.includes(message.to)) {
        return message.to;
    }

    return null;
}

function recordAnalyticsMessage(message, { persist = true, analytics = getAnalytics() } = {}) {
    const date = getMessageDate(message);
    const dateKey = getDateParts(date).dateKey;
    const targetChatId = getMessageChatId(message);
    if (!targetChatId) {
        return analytics;
    }

    const chatAnalytics = ensureChatAnalytics(analytics, targetChatId);
    const authorId = getMessageAuthorId(message);

    analytics.messagesByDate[dateKey] = Number(analytics.messagesByDate[dateKey] || 0) + 1;
    chatAnalytics.messagesByDate[dateKey] = Number(chatAnalytics.messagesByDate[dateKey] || 0) + 1;

    if (!message.fromMe && authorId) {
        analytics.activeUsersByDate[dateKey] = addUniqueValue(analytics.activeUsersByDate[dateKey], authorId);
        chatAnalytics.activeUsersByDate[dateKey] = addUniqueValue(chatAnalytics.activeUsersByDate[dateKey], authorId);
    }

    const timestampIso = date.toISOString();
    analytics.lastMessageAt = timestampIso;
    chatAnalytics.lastMessageAt = timestampIso;

    if (persist) {
        writeAnalytics(analytics);
    }

    return analytics;
}

async function captureRecentMessage(message) {
    if (!message || message.fromMe) {
        return;
    }
    const targetChatId = getMessageChatId(message);
    if (!targetChatId) {
        return;
    }

    let author = 'Unbekannt';
    try {
        const contact = await message.getContact();
        author = contact?.pushname || contact?.name || contact?.shortName || contact?.number || author;
    } catch {
        // Kontakt nicht ermittelbar – Fallback auf Default
    }

    const analytics = getAnalytics();
    const chatLabel = analytics.trackedChats[targetChatId]?.label || getTrackedChatLabel(targetChatId) || targetChatId;

    const rawBody = String(message.body || '').trim();
    let body = rawBody;
    if (!body) {
        body = MEDIA_TYPE_LABELS[message.type] || (message.type ? `[${message.type}]` : '[Nachricht ohne Text]');
    } else if (body.length > MESSAGE_BODY_PREVIEW_LIMIT) {
        body = `${body.slice(0, MESSAGE_BODY_PREVIEW_LIMIT - 1)}…`;
    }

    recentMessages.unshift({
        at: getMessageDate(message).toISOString(),
        chatLabel,
        author,
        body,
        type: message.type || 'chat'
    });

    if (recentMessages.length > MAX_RECENT_MESSAGES) {
        recentMessages.length = MAX_RECENT_MESSAGES;
    }
}

function sumCountsByRecentDays(collection, days) {
    const today = getDateParts();
    let total = 0;

    for (let index = 0; index < days; index += 1) {
        const date = new Date(today.utcNoonDate.getTime() - (index * 24 * 60 * 60 * 1000));
        const dateKey = formatUtcDateKey(date);
        total += Number(collection[dateKey] || 0);
    }

    return total;
}

function getUniqueUsersByRecentDays(collection, days) {
    const today = getDateParts();
    const users = new Set();

    for (let index = 0; index < days; index += 1) {
        const date = new Date(today.utcNoonDate.getTime() - (index * 24 * 60 * 60 * 1000));
        const dateKey = formatUtcDateKey(date);
        for (const userId of collection[dateKey] || []) {
            users.add(userId);
        }
    }

    return users.size;
}

function getRecentDateLabels(days) {
    const today = getDateParts();
    const labels = [];

    for (let index = days - 1; index >= 0; index -= 1) {
        const date = new Date(today.utcNoonDate.getTime() - (index * 24 * 60 * 60 * 1000));
        const dateKey = formatUtcDateKey(date);
        labels.push(dateKey.slice(5));
    }

    return labels;
}

function getRecentSeries(collection, days) {
    const today = getDateParts();
    const values = [];

    for (let index = days - 1; index >= 0; index -= 1) {
        const date = new Date(today.utcNoonDate.getTime() - (index * 24 * 60 * 60 * 1000));
        const dateKey = formatUtcDateKey(date);
        const value = Array.isArray(collection[dateKey])
            ? collection[dateKey].length
            : Number(collection[dateKey] || 0);
        values.push(value);
    }

    return values;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeWhatsAppId(value) {
    return String(value || '')
        .replace(/@.+$/, '')
        .replace(/[^\d+]/g, '');
}

function getDisplayNameForContact(contact) {
    return contact.pushname || contact.name || contact.shortName || sanitizeWhatsAppId(contact.id?._serialized);
}

function unique(values) {
    return Array.from(new Set(values));
}

function isBielefeldEvent(entry) {
    if (!entry || typeof entry !== 'object') {
        return false;
    }

    if (entry.city) {
        return String(entry.city).trim().toLowerCase() === 'bielefeld';
    }

    return true;
}

function toSortableTime(value) {
    return /^\d{2}:\d{2}$/.test(value || '') ? value : '99:99';
}

async function fetchEvents() {
    const response = await fetch(EVENTS_URL);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} beim Laden der Event-Liste`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
        throw new Error('Die Event-Liste hat kein gueltiges JSON-Array geliefert');
    }

    return data;
}

const EXCLUDED_ACCOUNTS = new Set(['sennefriedhof']);
const EXCLUDED_ORGANIZERS = ['kirchengemeinde oldentrup'];

function getTodayHighlights(events, date = getBerlinNow()) {
    const acceptedDates = new Set(getTodayDateLabels(date));

    return events
        .filter(isBielefeldEvent)
        .filter(entry => acceptedDates.has(String(entry.date || '').trim()))
        .filter(entry => {
            const name = String(entry.event || '').toLowerCase();
            if (Array.from(EXCLUDED_ACCOUNTS).some(acc => name.includes(`@${acc}`))) return false;
            if (EXCLUDED_ORGANIZERS.some(org => name.includes(org))) return false;
            return true;
        })
        .sort((a, b) => toSortableTime(a.time).localeCompare(toSortableTime(b.time)));
}

// --- Weekend Planner -------------------------------------------------------
//
// Dienstagsflyer mit dem Programm fuer Freitag, Samstag und Sonntag. Die
// Auswahl ist bewusst weiter gefasst als beim Tagesflyer: dessen Allowlist der
// vierzehn Clubs laesst uebers ganze Wochenende nur zwei bis vier Eintraege
// uebrig. Hier zaehlt alles aus Bielefeld ausser Sport, VHS-Kursen,
// Wochenmarkt und Kino — gemessen neun bis dreizehn Eintraege je Wochenende.

const WEEKEND_PLANNER_EXCLUDED_TERMS = (
    process.env.WEEKEND_PLANNER_EXCLUDED_TERMS
    || 'hochschulsport,volkshochschule,wochenmarkt,cinemaxx'
)
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);

const WEEKEND_PLANNER_MAX_PER_DAY = Number(process.env.WEEKEND_PLANNER_MAX_PER_DAY || 5);
// Deckel ueber alle drei Tage: das Plakat ist 1350 px hoch und laeuft bei
// fuenf Eintraegen je Tag um rund 470 px ueber. Gemessene Wochenenden liegen
// bei acht bis neun Eintraegen, der Deckel greift also selten.
const WEEKEND_PLANNER_MAX_TOTAL = Number(process.env.WEEKEND_PLANNER_MAX_TOTAL || 10);
const WEEKEND_PLANNER_DAY_LABELS = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];

/**
 * Reads a feed entry's date as YYYY-MM-DD.
 *
 * The weekday prefix is deliberately ignored. The feed writes it in eighteen
 * spellings (Fr, Fri, Sa, Sat, Th, Thu, Tu, Tue, ...), while
 * getTodayDateLabels() only builds four — which drops about a quarter of a
 * weekend on the floor.
 */
function getEventDateKey(entry, reference = getBerlinNow()) {
    const raw = String((entry && entry.date) || '');

    const full = raw.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (full) {
        return `${full[3]}-${full[2]}-${full[1]}`;
    }

    // 133 von 1652 Eintraegen kommen ohne Jahr ("Fr, 07.08") — und das sind
    // fast genau die Clubs: Stereo, Sams, Forum, Cafe Europa, nr.z.p. Sie
    // wegzuwerfen war der Grund, warum auf dem Planer kein Club auftauchte.
    const short = raw.match(/(\d{2})\.(\d{2})(?!\.\d)/);
    if (!short) {
        return null;
    }

    const referenceKey = getDateParts(reference).dateKey;
    const year = Number(referenceKey.slice(0, 4));
    const candidate = `${year}-${short[2]}-${short[1]}`;

    // Ueber den Jahreswechsel liegt ein Datum, das weit zurueckliegt, im
    // Folgejahr — ein Termin im Januar, gelesen im Dezember.
    const DAY_MS = 24 * 60 * 60 * 1000;
    const gap = (Date.parse(`${referenceKey}T12:00:00Z`) - Date.parse(`${candidate}T12:00:00Z`)) / DAY_MS;
    return gap > 180 ? `${year + 1}-${short[2]}-${short[1]}` : candidate;
}

// Wiederkehrende Serien tragen ihren Wochentag im Titel ("MI • WEDNESDATE"),
// und bei ihnen widerspricht das Datumsfeld des Feeds dem regelmaessig — die
// Cafe-Europa-Reihen stehen dort quer ueber die Woche verteilt. Das Praefix
// gilt, das Datumsfeld nicht. Der Tagesflyer haelt es genauso.
const WEEKDAY_PREFIX_PATTERN = /^\s*(MO|DI|MI|DO|FR|SA|SO)\s*[•·]/i;

function matchesWeekdayPrefix(entry, weekdayIndex) {
    const match = String((entry && entry.event) || '').match(WEEKDAY_PREFIX_PATTERN);
    if (!match) {
        return true;
    }

    return WEEKEND_PLANNER_DAY_LABELS[weekdayIndex] === match[1].toUpperCase();
}

function getVenueKey(entry) {
    const match = String((entry && entry.event) || '').match(/\(@([^)]+)\)/);
    return match ? match[1].trim().toLowerCase() : null;
}

/**
 * Picks one entry per venue and day.
 *
 * Stereo, Sams and Forum list several rooms or floors of the same night as
 * separate entries, which would fill the poster with one address. Preference
 * goes to the entry that carries a picture, then to one with a start time,
 * then to the more descriptive title.
 */
function dedupeByVenue(entries) {
    const best = new Map();
    const loose = [];

    for (const entry of entries) {
        const key = getVenueKey(entry);
        if (!key) {
            loose.push(entry);
            continue;
        }

        const current = best.get(key);
        // Rang vor Ausstattung: sonst gewinnt bei Stereo die Afro-Nacht, die
        // ueber HIGHLIGHT_EXCLUDED_SERIES als Serie gilt und den ganzen Club
        // aus der Auswahl kippt, gegen die kuratierte Nacht daneben.
        const better = !current
            || rankWeekendEntry(entry) > rankWeekendEntry(current)
            || (rankWeekendEntry(entry) === rankWeekendEntry(current)
                && scoreEntry(entry) > scoreEntry(current));

        if (better) {
            best.set(key, entry);
        }
    }

    return [...best.values(), ...loose];
}

/**
 * Ranks an entry for the limited number of slots on the poster.
 *
 * The curated clubs come first — they are what the group goes out for, and
 * sorting purely by time buried them because their nights start at 23:00.
 * isHighlightVenue() already carries that list for the daily flyer.
 */
function rankWeekendEntry(entry) {
    if (isHighlightVenue(entry)) {
        return 2;
    }

    return String(entry.image_url || '').trim() ? 1 : 0;
}

function scoreEntry(entry) {
    const hasImage = String(entry.image_url || '').trim() ? 4 : 0;
    const hasTime = String(entry.time || '').trim() ? 2 : 0;
    const title = String(entry.event || '').replace(/\s*\(@[^)]+\)\s*/, '');
    return hasImage + hasTime + Math.min(1, title.length / 100);
}

/**
 * The Friday, Saturday and Sunday the planner covers. Saturday and Sunday
 * still resolve to the weekend already under way, so a late run reports the
 * current weekend instead of skipping ahead to the next one.
 */
function getWeekendPlannerDates(date = getBerlinNow()) {
    const { utcNoonDate, weekdayIndex } = getDateParts(date);
    const DAY_MS = 24 * 60 * 60 * 1000;
    const offsetToFriday = weekdayIndex === 0 ? -2 : 5 - weekdayIndex;
    const friday = new Date(utcNoonDate.getTime() + offsetToFriday * DAY_MS);

    return [0, 1, 2].map(step => new Date(friday.getTime() + step * DAY_MS));
}

/**
 * Days of the week the city planner covers, Monday through Sunday.
 *
 * Muenster carries only thirty entries in the whole feed — one or two per
 * weekend — so a Friday-to-Sunday poster would mostly be empty. Days without
 * entries are dropped later, which keeps the poster to what is actually on.
 */
function getWeekPlannerDates(date = getBerlinNow()) {
    const { utcNoonDate, weekdayIndex } = getDateParts(date);
    const DAY_MS = 24 * 60 * 60 * 1000;
    // weekdayIndex 0 ist Sonntag; von dort ist der laufende Montag sechs Tage
    // her, sonst liegt er weekdayIndex-1 Tage zurueck.
    const offsetToMonday = weekdayIndex === 0 ? -6 : 1 - weekdayIndex;
    const monday = new Date(utcNoonDate.getTime() + offsetToMonday * DAY_MS);

    // Vergangene Tage fallen weg: dienstags abends gepostet, ist der Montag
    // kein Programmhinweis mehr.
    return [0, 1, 2, 3, 4, 5, 6]
        .map(step => new Date(monday.getTime() + step * DAY_MS))
        .filter(day => getDateParts(day).dateKey >= getDateParts(date).dateKey);
}

/**
 * Whether an entry belongs to the given city.
 *
 * Only out-of-town entries carry a city field — Bielefeld ones have none, so
 * a missing field means Bielefeld.
 */
function isCityEvent(entry, city = 'Bielefeld') {
    if (!entry || typeof entry !== 'object') {
        return false;
    }

    const value = String(entry.city || '').trim().toLowerCase();
    return value
        ? value === city.toLowerCase()
        : city.toLowerCase() === 'bielefeld';
}

function isWeekendPlannerEvent(entry, city = 'Bielefeld') {
    if (!isCityEvent(entry, city)) {
        return false;
    }

    const name = String(entry.event || '').toLowerCase();

    if (Array.from(EXCLUDED_ACCOUNTS).some(account => name.includes(`@${account}`))) {
        return false;
    }

    if (EXCLUDED_ORGANIZERS.some(organizer => name.includes(organizer))) {
        return false;
    }

    // Sport und Kurse sind kein Wochenendprogramm — sie stellen sonst allein
    // die Haelfte der Eintraege.
    if (normalizeCategory(entry.category).toLowerCase() === 'sport') {
        return false;
    }

    return !WEEKEND_PLANNER_EXCLUDED_TERMS.some(term => name.includes(term));
}

function getWeekendPlannerGroups(events, date = getBerlinNow(), options = {}) {
    const {
        city = 'Bielefeld',
        days = getWeekendPlannerDates(date),
        dropEmptyDays = false
    } = options;

    const groups = days.map(day => {
        const parts = getDateParts(day);
        const matching = events
            .filter(entry => getEventDateKey(entry, date) === parts.dateKey)
            .filter(entry => matchesWeekdayPrefix(entry, parts.weekdayIndex))
            .filter(entry => isWeekendPlannerEvent(entry, city))
            .filter(entry => !isTribeEvent(entry));

        // Erst nach Rang auswaehlen, dann nach Uhrzeit anzeigen. Rein nach
        // Uhrzeit geschnitten fielen ausgerechnet die Clubs weg: sie starten
        // um 23:00 und standen damit immer am Ende der Liste.
        const ranked = dedupeByVenue(matching)
            .sort((a, b) => rankWeekendEntry(b) - rankWeekendEntry(a)
                || toSortableTime(a.time).localeCompare(toSortableTime(b.time)));

        const entries = ranked
            .slice(0, WEEKEND_PLANNER_MAX_PER_DAY)
            .sort((a, b) => toSortableTime(a.time).localeCompare(toSortableTime(b.time)));

        return {
            dateKey: parts.dateKey,
            weekdayIndex: parts.weekdayIndex,
            label: WEEKEND_PLANNER_DAY_LABELS[parts.weekdayIndex],
            dayLabel: `${parts.day}.${parts.month}.`,
            entries,
            hidden: Math.max(0, ranked.length - entries.length)
        };
    });

    // Ueber dem Gesamtdeckel wird immer beim laengsten Tag gekuerzt, damit
    // kein Tag leer laeuft, solange ein anderer noch Eintraege abgeben kann.
    let total = groups.reduce((sum, group) => sum + group.entries.length, 0);
    while (total > WEEKEND_PLANNER_MAX_TOTAL) {
        const longest = groups.reduce((a, b) => (b.entries.length > a.entries.length ? b : a));
        if (longest.entries.length === 0) break;

        // Auch hier faellt der niedrigste Rang zuerst, nicht der spaeteste
        // Eintrag — sonst nimmt der Gesamtdeckel wieder die Clubs.
        const weakest = longest.entries.reduce((a, b) => (rankWeekendEntry(b) <= rankWeekendEntry(a) ? b : a));
        longest.entries = longest.entries.filter(entry => entry !== weakest);
        longest.hidden += 1;
        total -= 1;
    }

    // Ueber eine ganze Woche stehen die meisten Tage leer — dann zeigt das
    // Plakat nur die Tage, an denen wirklich etwas laeuft. Beim Wochenende
    // bleiben Fr/Sa/So stehen, auch leer, damit die Struktur erkennbar ist.
    return dropEmptyDays ? groups.filter(group => group.entries.length > 0) : groups;
}

function normalizeCategory(value) {
    const category = String(value || '').trim();

    if (!category) {
        return 'Sonstiges';
    }

    return category;
}

function splitHighlightsBySport(highlights) {
    const sportHighlights = [];
    const otherHighlights = [];

    for (const highlight of highlights) {
        const category = normalizeCategory(highlight.category).toLowerCase();
        if (category === 'sport') {
            sportHighlights.push(highlight);
            continue;
        }

        otherHighlights.push(highlight);
    }

    return {
        sportHighlights,
        otherHighlights
    };
}

function groupHighlightsByCategory(highlights) {
    const grouped = new Map();

    for (const highlight of highlights) {
        const category = normalizeCategory(highlight.category);
        if (!grouped.has(category)) {
            grouped.set(category, []);
        }

        grouped.get(category).push(highlight);
    }

    return Array.from(grouped.entries());
}

function formatHighlightsMessage(highlights, date = getBerlinNow(), titlePrefix = 'Bielefeld Tageshighlights') {
    const { day, month, year } = getDateParts(date);
    const title = `${titlePrefix} fuer ${day}.${month}.${year}`;

    if (highlights.length === 0) {
        return `${title}\n\nHeute wurden in der Event-Liste keine Eintraege fuer Bielefeld gefunden.`;
    }

    const sections = groupHighlightsByCategory(highlights.slice(0, MAX_HIGHLIGHTS))
        .map(([category, entries]) => {
            const lines = entries.map((entry, index) => {
                const time = entry.time ? `${entry.time} Uhr` : 'Ohne Uhrzeit';
                const link = entry.link ? ` ${entry.link}` : '';
                return `${index + 1}. ${time} - ${entry.event}${link}`;
            });

            return `${category}\n${lines.join('\n')}`;
        });

    const moreLine = `\n\nMehr Events für #Liebefeld gibt´s in unserer App: https://liebefeld.lovable.app/`;

    return `${title}\n\n${sections.join('\n\n')}${moreLine}`;
}

async function buildHighlightsMessage(date = getBerlinNow()) {
    const events = await fetchEvents();
    const highlights = getTodayHighlights(events, date);
    return formatHighlightsMessage(highlights, date);
}

function getDailyHighlightImagePath(date = getBerlinNow()) {
    const { dateKey } = getDateParts(date);
    // JPEG statt PNG: das PNG mit eingebetteten Artworks lag bei ~490 KB und
    // wurde von WhatsApp nicht angenommen, waehrend ein 92-KB-JPEG durchging.
    return path.join(DAILY_HIGHLIGHTS_IMAGE_DIR, `bielefeld-tageshighlights-${dateKey}.jpg`);
}

function getCategoryStyle(categoryValue, index) {
    const category = normalizeCategory(categoryValue).toLowerCase();
    const fallbackStyles = [
        { label: normalizeCategory(categoryValue), accent: '#f97316', background: '#fff3e6' },
        { label: normalizeCategory(categoryValue), accent: '#0ea5e9', background: '#e7f6ff' },
        { label: normalizeCategory(categoryValue), accent: '#16a34a', background: '#e9f8ee' }
    ];

    const styles = {
        kultur: { label: 'Kultur', accent: '#ef4444', background: '#ffe9e9' },
        musik: { label: 'Musik', accent: '#8b5cf6', background: '#f1eaff' },
        ausgehen: { label: 'Ausgehen', accent: '#f97316', background: '#fff3e6' },
        'the tribe': { label: 'THE TRIBE', accent: '#111827', background: '#f3f4f6' },
        theater: { label: 'Theater', accent: '#dc2626', background: '#fee2e2' },
        comedy: { label: 'Comedy', accent: '#d97706', background: '#fef3c7' },
        kunst: { label: 'Kunst', accent: '#2563eb', background: '#dbeafe' },
        markt: { label: 'Markt', accent: '#059669', background: '#d1fae5' },
        festival: { label: 'Festival', accent: '#e11d48', background: '#ffe4e6' }
    };

    return styles[category] || fallbackStyles[index % fallbackStyles.length];
}

function getDailyHighlightsImageHtml(highlights, date = getBerlinNow()) {
    const { day, month, year } = getDateParts(date);
    const displayHighlights = highlights.slice(0, MAX_HIGHLIGHTS);

    // Design und Farbwelt sind aus render-highlights-video.js uebernommen
    // (Cover-Szene), damit Flyer und Video als ein Auftritt wirken.
    const rows = displayHighlights.map((entry, index) => {
        const style = getCategoryStyle(entry.category, index);
        const time = entry.time ? escapeHtml(entry.time) : 'Heute';
        const title = escapeHtml(entry.event || 'Event');
        const category = escapeHtml(style.label);
        const venue = entry.event && /\(@([^)]+)\)/.test(entry.event)
            ? escapeHtml(entry.event.match(/\(@([^)]+)\)/)[1])
            : 'Bielefeld';
        // entry.image ist die vorab eingebettete Data-URL, entry.image_url der
        // Rohlink als Rueckfall.
        const src = entry.image || entry.image_url || null;
        const thumb = src
            ? `<div class="thumb"><img src="${escapeHtml(String(src))}" alt=""></div>`
            : `<div class="thumb placeholder">${String(index + 1).padStart(2, '0')}</div>`;

        return `
            <div class="row" style="--accent: ${style.accent};">
                ${thumb}
                <div class="meta">
                    <div class="top"><span class="time">${time}</span> · ${category}</div>
                    <div class="name">${title.replace(/\s*\(@[^)]+\)\s*/, '')}</div>
                    <div class="venue">${venue}</div>
                </div>
            </div>
        `;
    }).join('');

    const emptyState = `
        <div class="row" style="--accent: #F59E0B;">
            <div class="thumb placeholder">–</div>
            <div class="meta">
                <div class="top"><span class="time">Heute</span> · Bielefeld</div>
                <div class="name">Heute sind noch keine Highlights eingetragen</div>
                <div class="venue">liebefeld.lovable.app</div>
            </div>
        </div>
    `;

    return `<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Familjen+Grotesk:wght@400;500;600;700&display=swap');

        :root {
            --black: #0A0807;
            --black-soft: #141110;
            --amber: #F59E0B;
            --whatsapp: #25D366;
            --text: #F5F0E8;
            --muted: #9C9690;
            --rule: rgba(245, 240, 232, 0.14);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body {
            width: 1080px;
            height: 1350px;
            background: var(--black);
            overflow: hidden;
            font-family: 'Familjen Grotesk', ui-sans-serif, system-ui, sans-serif;
            color: var(--text);
        }

        .poster { position: relative; width: 1080px; height: 1350px;
                  padding: 54px 58px 46px; display: flex; flex-direction: column; }

        /* Rauschtextur wie im Video */
        .poster::after {
            content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 50;
            opacity: 0.28; mix-blend-mode: overlay;
            background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
        }

        /* Kopf und Fuss duerfen nicht schrumpfen: sonst quetscht der Flex-Layout
           sie bei vollen fuenf Zeilen auf ihre Trennlinie zusammen und der Text
           verschwindet. Gekuerzt wird stattdessen die Liste. */
        .head {
            display: flex; justify-content: space-between; align-items: baseline;
            border-bottom: 1px solid var(--rule);
            padding-bottom: 24px; margin-bottom: 30px;
            flex-shrink: 0;
        }
        .head .title {
            font-family: 'Anton', sans-serif; font-size: 92px; line-height: 0.92;
            text-transform: uppercase;
        }
        .head .title em { font-style: normal; color: var(--amber); }
        .head .date {
            font-family: 'Anton', sans-serif; font-size: 28px; letter-spacing: 0.04em;
            text-transform: uppercase; color: var(--muted); text-align: right; line-height: 1.15;
        }

        /* Platz fuer die absolut verankerte Fusszeile freihalten. */
        .list { flex: 1; display: flex; flex-direction: column; gap: 20px; }

        .row {
            display: grid; grid-template-columns: 150px 1fr; gap: 26px; align-items: center;
            border-left: 5px solid var(--accent); padding-left: 24px; min-height: 150px;
        }
        .row .thumb {
            width: 150px; height: 150px; overflow: hidden; background: var(--black-soft);
        }
        .row .thumb img { width: 100%; height: 100%; object-fit: cover; }
        .row .thumb.placeholder {
            display: grid; place-items: center;
            font-family: 'Anton', sans-serif; font-size: 64px; color: var(--accent); opacity: 0.55;
        }
        .row .meta { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
        .row .top {
            font-weight: 600; font-size: 18px; letter-spacing: 0.22em; text-transform: uppercase;
            margin-bottom: 8px; color: var(--accent);
        }
        .row .top .time { color: var(--text); }
        .row .name {
            font-family: 'Anton', sans-serif; font-size: 46px; line-height: 0.95;
            text-transform: uppercase; color: var(--text); margin-bottom: 8px;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .row .venue {
            font-size: 20px; color: var(--muted); letter-spacing: 0.04em;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* Signatur steht bewusst oben unter dem Kopf, nicht als Fusszeile:
           als letztes Kind der Spalte hat Chromium sie reproduzierbar auf
           Hoehe 0 gequetscht — die Trennlinie blieb, der Text verschwand.
           Hier oben rendert sie zuverlaessig. */
        .stamp {
            flex-shrink: 0;
            margin-bottom: 26px;
            font-family: 'Anton', sans-serif; font-size: 22px;
            letter-spacing: 0.18em; text-transform: uppercase;
            color: var(--muted);
        }
        .stamp em { font-style: normal; color: var(--whatsapp); }
    </style>
</head>
<body>
    <main class="poster">
        <div class="head">
            <div class="title">Heute<br><em>in Bielefeld</em></div>
            <div class="date">${escapeHtml(day)}.${escapeHtml(month)}.${escapeHtml(year)}</div>
        </div>
        <div class="stamp">Tageshighlights · <em>The Tribe Bielefeld</em></div>
        <div class="list">
            ${rows || emptyState}
        </div>
    </main>
</body>
</html>`;
}

async function getPuppeteerBrowser() {
    if (client.pupBrowser) {
        return client.pupBrowser;
    }

    if (client.pupPage && typeof client.pupPage.browser === 'function') {
        return client.pupPage.browser();
    }

    const puppeteer = require('puppeteer');
    return puppeteer.launch({ headless: true });
}

/**
 * Load an image and return it as a data URL, or null.
 *
 * Same approach as render-highlights-video.js: the flyer is rendered via
 * setContent, so remote <img> sources depend on the page fetching them in
 * time. Inlining the bytes removes that race entirely.
 */
async function loadImageAsDataUrl(url) {
    if (!url) return null;
    try {
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 1000) return null; // 1x1-Pixel und Platzhalter ueberspringen
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        if (!/^image\//.test(contentType)) return null;
        return `data:${contentType};base64,${buf.toString('base64')}`;
    } catch {
        return null;
    }
}

function getWeekendPlannerImageHtml(groups, date = getBerlinNow(), options = {}) {
    const {
        title = 'Weekend',
        titleAccent = 'Planer',
        city = 'Bielefeld',
        stamp = 'Fr · Sa · So'
    } = options;

    const first = groups[0];
    const last = groups[groups.length - 1];
    const { year } = getDateParts(date);
    const range = `${escapeHtml(first.dayLabel)}–${escapeHtml(last.dayLabel)}${escapeHtml(year)}`;

    const sections = groups.map(group => {
        const rows = group.entries.map((entry, index) => {
            const style = getCategoryStyle(entry.category, index);
            const time = entry.time ? escapeHtml(entry.time) : '';
            const title = escapeHtml(entry.event || 'Event').replace(/\s*\(@[^)]+\)\s*/, '');
            const venue = entry.event && /\(@([^)]+)\)/.test(entry.event)
                ? escapeHtml(entry.event.match(/\(@([^)]+)\)/)[1])
                : 'Bielefeld';
            // Nur die vorab eingebettete Data-URL, bewusst ohne Rueckfall auf
            // den Rohlink: der laesst setContent() mit networkidle0 auf einen
            // Abruf warten, der auf dem Runner ins Timeout laufen kann.
            const src = entry.image || null;
            const thumb = src
                ? `<div class="thumb"><img src="${escapeHtml(String(src))}" alt=""></div>`
                : '<div class="thumb placeholder"></div>';

            return `
                <div class="row" style="--accent: ${style.accent};">
                    ${thumb}
                    <div class="time">${time}</div>
                    <div class="meta">
                        <div class="name">${title}</div>
                        <div class="venue">${venue}</div>
                    </div>
                </div>
            `;
        }).join('');

        const empty = '<div class="row empty"><div class="thumb placeholder"></div>'
            + '<div class="time">–</div>'
            + '<div class="meta"><div class="name">Noch nichts eingetragen</div></div></div>';
        const more = group.hidden
            ? `<div class="more">+ ${group.hidden} weitere</div>`
            : '';

        return `
            <section class="day">
                <div class="dayhead"><span class="wd">${escapeHtml(group.label)}</span>
                    <span class="dt">${escapeHtml(group.dayLabel)}</span></div>
                ${rows || empty}
                ${more}
            </section>
        `;
    }).join('');

    return `<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Familjen+Grotesk:wght@400;500;600;700&display=swap');

        :root {
            --black: #0A0807;
            --black-soft: #141110;
            --amber: #F59E0B;
            --whatsapp: #25D366;
            --text: #F5F0E8;
            --muted: #9C9690;
            --rule: rgba(245, 240, 232, 0.14);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body {
            width: 1080px; height: 1350px; background: var(--black); overflow: hidden;
            font-family: 'Familjen Grotesk', ui-sans-serif, system-ui, sans-serif;
            color: var(--text);
        }

        .poster { position: relative; width: 1080px; height: 1350px;
                  padding: 54px 58px 46px; display: flex; flex-direction: column; }

        /* Rauschtextur wie beim Tagesflyer und im Video. */
        .poster::after {
            content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 50;
            opacity: 0.28; mix-blend-mode: overlay;
            background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
        }

        .head {
            display: flex; justify-content: space-between; align-items: baseline;
            border-bottom: 1px solid var(--rule);
            padding-bottom: 22px; margin-bottom: 24px; flex-shrink: 0;
        }
        .head .title {
            font-family: 'Anton', sans-serif; font-size: 88px; line-height: 0.92;
            text-transform: uppercase;
        }
        .head .title em { font-style: normal; color: var(--amber); }
        .head .date {
            font-family: 'Anton', sans-serif; font-size: 26px; letter-spacing: 0.04em;
            text-transform: uppercase; color: var(--muted); text-align: right; line-height: 1.15;
        }

        /* Wie beim Tagesflyer steht die Signatur oben: als letztes Kind der
           Spalte quetscht Chromium sie reproduzierbar auf Hoehe 0. */
        .stamp {
            flex-shrink: 0; margin-bottom: 20px;
            font-family: 'Anton', sans-serif; font-size: 21px;
            letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted);
        }
        .stamp em { font-style: normal; color: var(--whatsapp); }

        /* space-between verteilt die drei Tagesbloecke ueber die Resthoehe.
           An vollen Wochenenden greift es nicht mehr und der Abstand faellt
           auf den gap zurueck — an duennen bleibt der Fuss nicht leer. */
        .days {
            flex: 1; display: flex; flex-direction: column;
            gap: 18px; justify-content: space-between;
        }
        /* Bei ein oder zwei Tagen reisst space-between ein Loch in die Mitte
           — dann stehen die Bloecke oben zusammen. */
        .days.sparse { justify-content: flex-start; gap: 28px; }

        .day { display: flex; flex-direction: column; gap: 8px; }
        .dayhead {
            display: flex; align-items: baseline; gap: 14px;
            border-bottom: 1px solid var(--rule); padding-bottom: 8px;
        }
        .dayhead .wd {
            font-family: 'Anton', sans-serif; font-size: 40px; line-height: 1;
            color: var(--amber); text-transform: uppercase;
        }
        .dayhead .dt {
            font-size: 20px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted);
        }

        .row {
            display: grid; grid-template-columns: 60px 92px 1fr; gap: 14px; align-items: center;
            border-left: 4px solid var(--accent, var(--rule)); padding-left: 14px;
        }
        .row .thumb {
            width: 60px; height: 60px; overflow: hidden; background: var(--black-soft);
        }
        .row .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .row .thumb.placeholder {
            background: linear-gradient(135deg, var(--black-soft), rgba(245, 240, 232, 0.06));
            border: 1px solid var(--rule);
        }
        .row .time {
            font-family: 'Anton', sans-serif; font-size: 26px; color: var(--text);
            letter-spacing: 0.02em;
        }
        .row .meta { min-width: 0; }
        .row .name {
            font-family: 'Anton', sans-serif; font-size: 30px; line-height: 1.04;
            text-transform: uppercase; color: var(--text);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .row .venue {
            font-size: 17px; color: var(--muted); letter-spacing: 0.03em; margin-top: 2px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .row.empty .name { color: var(--muted); }
        /* Kachel bleibt im Raster stehen, damit die Spalten fluchten. */
        .row.empty .thumb { visibility: hidden; }

        .more {
            font-size: 17px; color: var(--muted); letter-spacing: 0.1em;
            text-transform: uppercase; padding-left: 22px;
        }
    </style>
</head>
<body>
    <main class="poster">
        <div class="head">
            <div class="title">${escapeHtml(title)}<br><em>${escapeHtml(titleAccent)}</em></div>
            <div class="date">${range}<br>${escapeHtml(city)}</div>
        </div>
        <div class="stamp">${escapeHtml(stamp)} · <em>The Tribe ${escapeHtml(city)}</em></div>
        <div class="days${groups.length < 3 ? ' sparse' : ''}">
            ${sections}
        </div>
    </main>
</body>
</html>`;
}

async function renderWeekendPlannerImage(groups, date = getBerlinNow(), options = {}) {
    fs.mkdirSync(DAILY_HIGHLIGHTS_IMAGE_DIR, { recursive: true });

    // Bilder vorab einbetten, sonst bleiben die Kacheln leer: die Seite wird
    // ueber setContent() ohne Netzwerkkontext geladen.
    let failed = 0;
    groups = await Promise.all(groups.map(async group => ({
        ...group,
        entries: await Promise.all(group.entries.map(async entry => {
            const image = await loadImageAsDataUrl(entry.image_url);
            if (entry.image_url && !image) failed += 1;
            return { ...entry, image };
        }))
    })));
    if (failed) {
        console.warn(`Weekend-Planer: ${failed} Event-Bild(er) nicht ladbar — Platzhalter genutzt.`);
    }

    const { dateKey } = getDateParts(date);
    const outputPath = path.join(DAILY_HIGHLIGHTS_IMAGE_DIR, `${options.slug || 'weekend-planner'}-${dateKey}.jpg`);
    const browser = await getPuppeteerBrowser();
    const shouldCloseBrowser = browser !== client.pupBrowser
        && (!client.pupPage || browser !== client.pupPage.browser());
    const page = await browser.newPage();

    try {
        await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
        // networkidle0 kommt bei zehn eingebetteten Bildern nicht mehr zur
        // Ruhe — gemessen ueber 120 s ohne Abschluss, obwohl keine Anfrage
        // mehr offen ist. 'load' plus fonts.ready wartet auf genau das, was
        // das Bild braucht: Layout und Schriften.
        await page.setContent(getWeekendPlannerImageHtml(groups, date, options), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: outputPath, type: 'jpeg', quality: 82, fullPage: false });
        console.log(`Weekend-Planer gerendert: ${outputPath} (${Math.round(fs.statSync(outputPath).size / 1024)} KB)`);
    } finally {
        await page.close().catch(() => {});
        if (shouldCloseBrowser) {
            await browser.close().catch(() => {});
        }
    }

    return outputPath;
}

async function renderDailyHighlightsImage(highlights, date = getBerlinNow()) {
    fs.mkdirSync(DAILY_HIGHLIGHTS_IMAGE_DIR, { recursive: true });

    // Bilder vorab einbetten, sonst bleiben die Kacheln leer.
    const withImages = await Promise.all(highlights.slice(0, MAX_HIGHLIGHTS).map(async entry => ({
        ...entry,
        image: await loadImageAsDataUrl(entry.image_url)
    })));
    const failed = withImages.filter(e => e.image_url && !e.image).length;
    if (failed) {
        console.warn(`${failed} Event-Bild(er) konnten nicht geladen werden — Platzhalter genutzt.`);
    }
    highlights = withImages;

    const outputPath = getDailyHighlightImagePath(date);
    const browser = await getPuppeteerBrowser();
    const shouldCloseBrowser = browser !== client.pupBrowser && (!client.pupPage || browser !== client.pupPage.browser());
    const page = await browser.newPage();

    try {
        await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
        await page.setContent(getDailyHighlightsImageHtml(highlights, date), { waitUntil: 'networkidle0' });
        await page.screenshot({ path: outputPath, type: 'jpeg', quality: 82, fullPage: false });
        console.log(`Flyer gerendert: ${outputPath} (${Math.round(fs.statSync(outputPath).size / 1024)} KB)`);
    } finally {
        await page.close().catch(() => {});
        if (shouldCloseBrowser) {
            await browser.close().catch(() => {});
        }
    }

    return outputPath;
}

// Zielgruppe des Flyers. Standard ist die Ankuendigungsgruppe; ueber
// WHATSAPP_FLYER_CHAT_ID umstellbar, ohne Code-Aenderung.
// Gleiches Ziel wie die Weekend-Starter-Umfragen. Bewusst chatId statt
// ausgehenChatId: beide zeigen heute auf dieselbe Gruppe, aber nur chatId
// bleibt mit den Umfragen zusammen, falls WHATSAPP_AUSGEHEN_CHAT_ID spaeter
// auf eine andere Gruppe gesetzt wird.
const flyerChatId = process.env.WHATSAPP_FLYER_CHAT_ID || chatId;

async function sendDailyHighlightsImage(highlights, date = getBerlinNow(), caption) {
    try {
        const imagePath = await renderDailyHighlightsImage(highlights, date);
        const media = MessageMedia.fromFilePath(imagePath);
        console.log(`Sende Flyer mit ${highlights.length} Eintrag(en) an ${flyerChatId} ...`);
        const sent = await client.sendMessage(flyerChatId, media, caption ? { caption } : undefined);
        // sendMessage liefert bei dieser Library-Version auch dann kein
        // Message-Objekt, wenn die Nachricht ankommt — die Rueckmeldung fehlt,
        // die Zustellung nicht. Ein fehlendes Objekt darf deshalb NICHT als
        // Fehlschlag gelten: sonst laeuft danach der Textversand als Rueckfall
        // und in der Gruppe stehen Bild und Text.
        // Ein echter Fehler wirft und landet im catch unten.
        if (!sent) {
            console.warn('Flyer gesendet, ohne Bestaetigung durch die Library (bekanntes Verhalten).');
        } else {
            console.log(`Flyer zugestellt (Message-ID ${sent.id?._serialized || 'unbekannt'}).`);
        }
        return imagePath;
    } catch (error) {
        console.error('Tageshighlights-Bild konnte nicht gesendet werden:', error.message);
        return null;
    }
}

async function uploadHighlightImageToGithub(imagePath) {
    if (!GITHUB_REPOSITORY || !GITHUB_TOKEN) {
        throw new Error('GITHUB_REPOSITORY oder GITHUB_TOKEN nicht gesetzt');
    }

    const content = fs.readFileSync(imagePath).toString('base64');
    const fileName = path.basename(imagePath);
    const now = getBerlinNow();
    const { year, month, day } = getDateParts(now);
    const ghPath = `images/daily-highlights/${year}/${month}/${day}/${fileName}`;
    const apiUrl = `https://api.github.com/repos/${GITHUB_REPOSITORY}/contents/${ghPath}`;

    const headers = {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'the-tribe-bot'
    };

    // Prüfen ob Datei schon existiert (SHA nötig für Update)
    let sha;
    try {
        const existing = await fetch(apiUrl, { headers });
        if (existing.ok) {
            sha = (await existing.json()).sha;
        }
    } catch (_) {}

    const body = { message: `daily highlights ${year}-${month}-${day}`, content };
    if (sha) body.sha = sha;

    const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`GitHub-Upload fehlgeschlagen: ${err}`);
    }

    const data = await res.json();
    return data.content.download_url;
}

async function postInstagramStory(imageUrl) {
    if (!IG_ACCESS_TOKEN || !IG_USER_ID) {
        throw new Error('IG_ACCESS_TOKEN oder IG_USER_ID nicht gesetzt');
    }

    const base = `https://graph.facebook.com/v21.0/${IG_USER_ID}`;

    const createRes = await fetch(`${base}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            media_type: 'STORIES',
            image_url: imageUrl,
            access_token: IG_ACCESS_TOKEN
        })
    });

    const createData = await createRes.json();
    if (!createData.id) {
        throw new Error(`Instagram Story-Container konnte nicht erstellt werden: ${JSON.stringify(createData)}`);
    }

    // Kurz warten bis Container verarbeitet ist
    await new Promise(resolve => setTimeout(resolve, 5000));

    const publishRes = await fetch(`${base}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            creation_id: createData.id,
            access_token: IG_ACCESS_TOKEN
        })
    });

    const publishData = await publishRes.json();
    if (!publishData.id) {
        throw new Error(`Instagram Story-Veröffentlichung fehlgeschlagen: ${JSON.stringify(publishData)}`);
    }

    return publishData.id;
}

async function sendDailyHighlightsInstagramStory(imagePath) {
    if (!IG_ACCESS_TOKEN || !IG_USER_ID || !GITHUB_REPOSITORY || !GITHUB_TOKEN) {
        // Ohne Hinweis sieht ein fehlendes Secret im Log genauso aus wie
        // "gar nicht erst versucht" — deshalb benennen, was fehlt.
        const missing = [
            !IG_ACCESS_TOKEN && 'IG_ACCESS_TOKEN',
            !IG_USER_ID && 'IG_USER_ID',
            !GITHUB_REPOSITORY && 'GITHUB_REPOSITORY',
            !GITHUB_TOKEN && 'GITHUB_TOKEN'
        ].filter(Boolean).join(', ');
        console.log(`Instagram-Story uebersprungen — nicht gesetzt: ${missing}.`);
        return;
    }

    try {
        const imageUrl = await uploadHighlightImageToGithub(imagePath);
        const storyId = await postInstagramStory(imageUrl);
        console.log(`Instagram-Story gepostet: ${storyId}`);
    } catch (error) {
        console.error('Instagram-Story konnte nicht gepostet werden:', error.message);
    }
}

function ensureWeeklyPollState(state, weekKey) {
    if (!state.weeklyPolls[weekKey]) {
        state.weeklyPolls[weekKey] = {};
    }

    return state.weeklyPolls[weekKey];
}

function ensureWeeklyAnnouncementState(state, weekKey) {
    if (!state.weeklyAnnouncements[weekKey]) {
        state.weeklyAnnouncements[weekKey] = {};
    }

    return state.weeklyAnnouncements[weekKey];
}

function getUpcomingWeekdayDate(targetWeekdayIndex, date = getBerlinNow()) {
    const parts = getDateParts(date);
    const daysUntilTarget = (targetWeekdayIndex - parts.weekdayIndex + 7) % 7;
    const targetUtcDate = new Date(parts.utcNoonDate.getTime() + (daysUntilTarget * 24 * 60 * 60 * 1000));
    return targetUtcDate;
}

function formatGermanDateFromUtcDate(utcDate) {
    return new Intl.DateTimeFormat('de-DE', {
        timeZone: TIME_ZONE,
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    }).format(utcDate);
}

function getWeeklyCalendarPollOptions(dateKey = getDateParts().dateKey) {
    const format = getEventFormat(dateKey);
    return [
        'Tuesday Run (Di 17:00)',
        'Fussball (Do 17:00)',
        'Creative Circle (Do 18:00)',
        'Ping Pong (Do 18:00)',
        `${format.label} (${format.day.slice(0, 2)} ${format.timeShort})`
    ];
}

function buildWeeklyCalendarMessage(date = getBerlinNow()) {
    const parts = getDateParts(date);
    const format = getEventFormat(parts.dateKey);
    const tuesday  = getUpcomingWeekdayDate(2, date);
    const thursday = getUpcomingWeekdayDate(4, date);
    const eventDay = getUpcomingWeekdayDate(format.eventWeekdayIndex, date);

    const eventLine = isWeekendStarterActive(parts.dateKey)
        ? `${format.timeShort} Uhr – ${format.label} | ${format.claim} | Location folgt Donnerstagabend`
        : `${format.timeShort} Uhr – ${format.label} | ${format.claim} | Location folgt Freitagabend`;

    return [
        'THE TRIBE – Events diese Woche',
        '',
        formatGermanDateFromUtcDate(tuesday),
        '17:00 Uhr – Tuesday Run | Gellershagen Park Teich',
        '',
        formatGermanDateFromUtcDate(thursday),
        '17:00 Uhr – Fussball | Sportplatz Obersee',
        '18:00 Uhr – Creative Circle | Wiese Obersee (bei Regen: CoWorking Merianstr. 8)',
        '18:00 Uhr – Ping Pong | Nr.z.P.',
        '',
        formatGermanDateFromUtcDate(eventDay),
        eventLine,
        '',
        'Bei welchen Events seid ihr dabei?'
    ].join('\n');
}

async function sendWeeklyCalendar({ force = false } = {}) {
    const state = getState();
    const today = getDateParts();
    const weekKey = getBerlinWeekKey();
    const weeklyState = ensureWeeklyAnnouncementState(state, weekKey);

    if (!force && weeklyState.weeklyCalendar && weeklyState.weeklyCalendar.dateKey === today.dateKey) {
        return;
    }

    const message = buildWeeklyCalendarMessage();
    await client.sendMessage(announcementChatId, message);
    await client.sendMessage(
        announcementChatId,
        new Poll('Welche Tribe Events besuche ich diese Woche?', getWeeklyCalendarPollOptions())
    );

    weeklyState.weeklyCalendar = {
        dateKey: today.dateKey,
        createdAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Wochenkalender fuer ${weekKey} gesendet.`);
}

function buildTuesdayRunMessage(date = getBerlinNow()) {
    const nextTuesday = getUpcomingWeekdayDate(2, date);
    const formattedTuesdayDate = formatGermanDateFromUtcDate(nextTuesday);

    return [
        '🏃 TRIBE Tuesday Run – Jeden Dienstag!',
        '',
        'Hey Sportler! Diese Woche ist wieder Lauftreff-Zeit! 💪',
        'Egal ob Anfaenger oder Profi – jeder ist willkommen!',
        'Wir laufen gemeinsam eine entspannte Runde und geniessen den Feierabend.',
        '',
        `📅 Wann: ${formattedTuesdayDate}, 17:00 Uhr`,
        '📍 Wo: Gellershagen Park Teich',
        '',
        'Wer ist dabei? Kommentiere unten!'
    ].join('\n');
}

function buildThursdayFootballMessage(date = getBerlinNow()) {
    const nextThursday = getUpcomingWeekdayDate(4, date);
    const formattedThursdayDate = formatGermanDateFromUtcDate(nextThursday);

    return [
        'TRIBE Donnerstag Fussball - Jede Woche!',
        '',
        'Hey Sportler! Diese Woche ist wieder Fussball-Zeit!',
        'Egal ob Kreisklasse oder Champions League - jeder ist willkommen!',
        'Wir kicken gemeinsam eine Runde und starten sportlich in den Abend.',
        '',
        `Wann: ${formattedThursdayDate}, 17:00 Uhr`,
        'Wo: Sportplatz Obersee',
        '',
        'Wer ist dabei? Kommentiere unten!'
    ].join('\n');
}

function buildJamSessionMessage(date = getBerlinNow()) {
    const nextThursday = getUpcomingWeekdayDate(4, date);
    const formattedThursdayDate = formatGermanDateFromUtcDate(nextThursday);

    return [
        'TRIBE Creative Circle - Jeden Donnerstag!',
        '',
        'Diesen Donnerstag treffen wir uns wieder zum Creative Circle.',
        'Musik steht im Mittelpunkt – aber auch Zeichnen, Schreiben, Fotografieren und andere kreative Dinge sind willkommen.',
        'Komm als Künstler oder einfach zum Zuhören und Genießen.',
        '',
        `Wann: ${formattedThursdayDate}, 18:00 Uhr`,
        'Wo: Wiese Obersee',
        'Bei schlechtem Wetter: CoWorking Space Merianstr. 8',
        '',
        'Stimme kurz ab – kommst du als Kuenstler oder Teilnehmer?'
    ].join('\n');
}

function buildPingPongMessage(date = getBerlinNow()) {
    const nextThursday = getUpcomingWeekdayDate(4, date);
    const formattedDate = formatGermanDateFromUtcDate(nextThursday);

    return [
        'Tagesempfehlung: Ping Pong am Nr.z.P.!',
        '',
        `Heute, ${formattedDate}, ist wieder Zeit fuer eine Runde Tischtennis!`,
        'Kommt vorbei, spielt eine Runde und connectet mit anderen aus der Tribe.',
        'Egal ob Anfaenger oder Profi – alle sind willkommen!',
        '',
        'Wer ist heute dabei?'
    ].join('\n');
}

async function sendThursdayPingPongRecommendation({ force = false } = {}) {
    const state = getState();
    const today = getDateParts();
    const weekKey = getBerlinWeekKey();
    const weeklyState = ensureWeeklyAnnouncementState(state, weekKey);

    if (!force && weeklyState.pingPong && weeklyState.pingPong.dateKey === today.dateKey) {
        return;
    }

    const message = buildPingPongMessage();
    await client.sendMessage(ausgehenChatId, message);

    await client.sendMessage(
        ausgehenChatId,
        new Poll('Ping Pong heute am Nr.z.P.: Wer ist dabei?', PING_PONG_ATTENDANCE_OPTIONS)
    );

    weeklyState.pingPong = {
        dateKey: today.dateKey,
        chatId: ausgehenChatId,
        createdAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Ping-Pong-Tagesempfehlung fuer ${weekKey} gesendet.`);
}

async function loadTuesdayRunMedia() {
    const configuredImagePath = process.env.TRIBE_TUESDAY_RUN_IMAGE_PATH || TUESDAY_RUN_DEFAULT_IMAGE_PATH;
    const configuredImageUrl = process.env.TRIBE_TUESDAY_RUN_IMAGE_URL;

    if (fs.existsSync(configuredImagePath)) {
        return MessageMedia.fromFilePath(configuredImagePath);
    }

    if (configuredImageUrl) {
        return MessageMedia.fromUrl(configuredImageUrl, { unsafeMime: true });
    }

    return null;
}

async function loadJamSessionMedia() {
    const configuredImagePath = process.env.TRIBE_JAM_SESSION_IMAGE_PATH || JAM_SESSION_DEFAULT_IMAGE_PATH;
    const configuredImageUrl = process.env.TRIBE_JAM_SESSION_IMAGE_URL;

    if (fs.existsSync(configuredImagePath)) {
        return MessageMedia.fromFilePath(configuredImagePath);
    }

    if (configuredImageUrl) {
        return MessageMedia.fromUrl(configuredImageUrl, { unsafeMime: true });
    }

    return null;
}

async function loadThursdayFootballMedia() {
    const configuredImagePath = process.env.TRIBE_THURSDAY_FOOTBALL_IMAGE_PATH || THURSDAY_FOOTBALL_DEFAULT_IMAGE_PATH;
    const configuredImageUrl = process.env.TRIBE_THURSDAY_FOOTBALL_IMAGE_URL;

    if (fs.existsSync(configuredImagePath)) {
        return MessageMedia.fromFilePath(configuredImagePath);
    }

    if (configuredImageUrl) {
        return MessageMedia.fromUrl(configuredImageUrl, { unsafeMime: true });
    }

    return null;
}

async function loadKennenlernabendMedia() {
    // Im Weekend-Starter-Format die passende Kachel, sonst die alte.
    // Eine gesetzte Env-Var gewinnt weiterhin ueber beides.
    const defaultImagePath = isWeekendStarterActive() && fs.existsSync(WEEKEND_STARTER_IMAGE_PATH)
        ? WEEKEND_STARTER_IMAGE_PATH
        : KENNENLERNABEND_DEFAULT_IMAGE_PATH;
    const configuredImagePath = process.env.TRIBE_KENNENLERNABEND_IMAGE_PATH || defaultImagePath;
    const configuredImageUrl = process.env.TRIBE_KENNENLERNABEND_IMAGE_URL;

    if (fs.existsSync(configuredImagePath)) {
        return MessageMedia.fromFilePath(configuredImagePath);
    }

    if (configuredImageUrl) {
        return MessageMedia.fromUrl(configuredImageUrl, { unsafeMime: true });
    }

    return null;
}

async function sendTuesdayRunAnnouncement({ force = false } = {}) {
    const state = getState();
    const today = getDateParts();
    const weekKey = getBerlinWeekKey();
    const weeklyState = ensureWeeklyAnnouncementState(state, weekKey);

    if (!force && weeklyState.tuesdayRun && weeklyState.tuesdayRun.dateKey === today.dateKey) {
        return;
    }

    const message = buildTuesdayRunMessage();
    const media = await loadTuesdayRunMedia();

    if (media) {
        await client.sendMessage(tuesdayRunChatId, media, { caption: message });
    } else {
        await client.sendMessage(tuesdayRunChatId, message);
        console.log('Tuesday-Run-Post ohne Bild gesendet, weil keine Bilddatei oder Bild-URL konfiguriert ist.');
    }

    await client.sendMessage(
        tuesdayRunChatId,
        new Poll('TRIBE Tuesday Run: Wer ist dabei?', TUESDAY_RUN_ATTENDANCE_OPTIONS)
    );

    weeklyState.tuesdayRun = {
        dateKey: today.dateKey,
        chatId: tuesdayRunChatId,
        createdAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Tuesday-Run-Post fuer ${weekKey} gesendet.`);
}

async function sendJamSessionAnnouncement({ force = false } = {}) {
    const state = getState();
    const today = getDateParts();
    const weekKey = getBerlinWeekKey();
    const weeklyState = ensureWeeklyAnnouncementState(state, weekKey);

    if (!force && weeklyState.jamSession && weeklyState.jamSession.dateKey === today.dateKey) {
        return;
    }

    const message = buildJamSessionMessage();
    const media = await loadJamSessionMedia();

    if (media) {
        await client.sendMessage(jamSessionChatId, media, { caption: message });
    } else {
        await client.sendMessage(jamSessionChatId, message);
        console.log('Jam-Session-Post ohne Bild gesendet, weil keine Bilddatei oder Bild-URL konfiguriert ist.');
    }

    await client.sendMessage(
        jamSessionChatId,
        new Poll('TRIBE Creative Circle: Wer bist du diese Woche?', JAM_SESSION_ATTENDANCE_OPTIONS)
    );

    weeklyState.jamSession = {
        dateKey: today.dateKey,
        chatId: jamSessionChatId,
        createdAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Jam-Session-Post fuer ${weekKey} gesendet.`);
}

async function sendThursdayFootballAnnouncement({ force = false } = {}) {
    const state = getState();
    const today = getDateParts();
    const weekKey = getBerlinWeekKey();
    const weeklyState = ensureWeeklyAnnouncementState(state, weekKey);

    if (!force && weeklyState.thursdayFootball && weeklyState.thursdayFootball.dateKey === today.dateKey) {
        return;
    }

    const message = buildThursdayFootballMessage();
    const media = await loadThursdayFootballMedia();

    if (media) {
        await client.sendMessage(tuesdayRunChatId, media, { caption: message });
    } else {
        await client.sendMessage(tuesdayRunChatId, message);
        console.log('Donnerstags-Fussball-Post ohne Bild gesendet, weil keine Bilddatei oder Bild-URL konfiguriert ist.');
    }

    await client.sendMessage(
        tuesdayRunChatId,
        new Poll('TRIBE Donnerstag Fussball: Wer ist dabei?', THURSDAY_FOOTBALL_ATTENDANCE_OPTIONS)
    );

    weeklyState.thursdayFootball = {
        dateKey: today.dateKey,
        chatId: tuesdayRunChatId,
        createdAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Donnerstags-Fussball-Post fuer ${weekKey} gesendet.`);
}

async function sendDailyHighlights({ force = false } = {}) {
    const state = getState();
    const now = getBerlinNow();
    const today = getDateParts(now);
    const todayKey = today.dateKey;

    if (!force && state.lastPostedDate === todayKey) {
        return;
    }

    const events = await fetchEvents();
    const highlights = getTodayHighlights(events, now);
    // Gefiltert wird ueber die Location, nicht ueber die Kategorie: das
    // category-Feld der Event-Liste ist unzuverlaessig — oft leer (was zu
    // "Sonstiges" normalisiert und die Clubs herauswerfen wuerde), teils
    // enthaelt es versehentlich den Beschreibungstext. Die Allowlist der
    // Locations grenzt ohnehin deutlich schaerfer ein.
    const { weekdayIndex } = today;
    const WEEKDAY_PREFIXES = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];
    const todayPrefix = WEEKDAY_PREFIXES[weekdayIndex];
    const weekdayPrefixPattern = /^\s*(MO|DI|MI|DO|FR|SA|SO)\s*[•·]/i;
    const filtered = highlights.filter(h => {
        // Eigene Formate kommen als fester Eintrag dazu, nicht aus der Liste.
        if (isTribeEvent(h)) return false;
        // Nur angesagte Locations.
        if (!isHighlightVenue(h)) return false;
        const name = h.event || '';
        // Wiederkehrende Serien mit Wochentags-Präfix (z. B. "FR • Cafe Europa")
        // nur am passenden Wochentag zeigen
        const prefixMatch = name.match(weekdayPrefixPattern);
        if (prefixMatch && prefixMatch[1].toUpperCase() !== todayPrefix) return false;
        return true;
    });

    // Einziges eigenes Format auf dem Flyer: der Weekend Starter am Eventtag.
    // Ping Pong, Pub Quiz und Kennenlernabend sind bewusst raus.
    const format = getEventFormat(todayKey);
    const isEventDay = weekdayIndex === format.eventWeekdayIndex;
    const weeklyState = ensureWeeklyPollState(state, getBerlinWeekKey());
    const votedVenue = weeklyState.finalVenue?.name || weeklyState.attendancePoll?.venue || '';

    const ownEntry = {
        event: votedVenue ? `${format.label} (@${votedVenue})` : format.label,
        time: format.timeShort,
        category: 'THE TRIBE',
        link: ''
    };

    const fixedEntries = isEventDay ? [ownEntry] : [];
    const fixedNames = new Set(fixedEntries.map(e => e.event));
    const withTribe = [...fixedEntries, ...filtered.filter(h => !fixedNames.has(h.event))];

    if (withTribe.length === 0) {
        // Lieber nichts posten als einen Flyer mit "keine Highlights" — bei der
        // engen Location-Auswahl bleibt rund ein Drittel der Tage leer.
        console.log(`Keine passenden Highlights fuer ${todayKey} — kein Flyer gepostet.`);
        return;
    }

    const caption = 'Mehr Events für #Liebefeld: https://liebefeld.lovable.app/';

    // Event-Übersicht als Bild posten (kein Video mehr), Link direkt als Caption
    let delivered = null;
    try {
        delivered = await sendDailyHighlightsImage(withTribe, now, caption);
    } catch (err) {
        console.error('Tageshighlights-Bild konnte nicht gesendet werden:', err.message);
    }

    if (!delivered) {
        // Nur echte Fehler landen hier — sendDailyHighlightsImage gibt den
        // Pfad auch dann zurueck, wenn die Library die Zustellung nicht
        // bestaetigt. Kein Textversand als Rueckfall: der lief zuletzt
        // zusaetzlich zum erfolgreich gesendeten Bild und hat die Gruppe
        // doppelt bespielt.
        throw new Error(`Tageshighlights fuer ${todayKey} nicht gesendet`);
    }

    state.lastPostedDate = todayKey;
    state.lastPostedAt = new Date().toISOString();
    writeState(state);

    console.log(`Tageshighlights fuer ${todayKey} gesendet.`);

    // Derselbe Flyer zusaetzlich als Instagram-Story. Bewusst nach dem
    // State-Schreiben: die Story ist Zugabe, ein Fehler dort darf den bereits
    // zugestellten WhatsApp-Post nicht zum Fehlschlag machen. Die Funktion
    // faengt eigene Fehler ab und loggt nur.
    await sendDailyHighlightsInstagramStory(delivered);
}

async function sendPlanner(options = {}) {
    const {
        force = false,
        label = 'Planer',
        city = 'Bielefeld',
        useWeek = false,
        title = 'Weekend',
        titleAccent = 'Planer',
        stamp = 'Fr · Sa · So',
        caption = 'Mehr Events: https://liebefeld.lovable.app/',
        slug = 'planner'
    } = options;

    const now = getBerlinNow();
    const groups = getWeekendPlannerGroups(await fetchEvents(), now, {
        city,
        days: useWeek ? getWeekPlannerDates(now) : getWeekendPlannerDates(now),
        dropEmptyDays: useWeek
    });

    const total = groups.reduce((sum, group) => sum + group.entries.length, 0);
    if (total === 0 && !force) {
        console.log(`${label}: keine Eintraege fuer ${city} — nicht gepostet.`);
        return;
    }

    if (groups.length === 0) {
        console.log(`${label}: kein Tag mit Eintraegen fuer ${city} — nicht gepostet.`);
        return;
    }

    const summary = groups.map(group => `${group.label} ${group.entries.length}`).join(' · ');
    console.log(`${label} fuer ${groups[0].dateKey}–${groups[groups.length - 1].dateKey}: ${summary}`);

    const imagePath = await renderWeekendPlannerImage(groups, now, { title, titleAccent, city, stamp, slug });
    const media = MessageMedia.fromFilePath(imagePath);

    // sendMessage liefert bei dieser Library-Version nicht zuverlaessig ein
    // Message-Objekt zurueck, auch wenn die Nachricht ankommt. Ein Fehler wirft
    // und wird hier bewusst NICHT geschluckt: sonst vermerkt runDueJobs() den
    // Job als erledigt, obwohl nichts in der Gruppe steht.
    const sent = await client.sendMessage(flyerChatId, media, { caption });
    console.log(sent
        ? `${label} zugestellt (Message-ID ${sent.id?._serialized || 'unbekannt'}).`
        : `${label} gesendet, ohne Bestaetigung durch die Library (bekanntes Verhalten).`);
}

function sendWeekendPlanner({ force = false } = {}) {
    return sendPlanner({
        force,
        label: 'Weekend-Planer',
        city: 'Bielefeld',
        slug: 'weekend-planner',
        caption: 'Euer Wochenende in Bielefeld ✨\nMehr Events: https://liebefeld.lovable.app/'
    });
}

// Muenster laeuft ueber die ganze Woche statt nur das Wochenende: der Feed
// fuehrt dort dreissig Termine insgesamt, ein bis zwei je Wochenende. Leere
// Tage fallen weg, das Plakat zeigt also nur, was wirklich laeuft.
function sendMuensterPlanner({ force = false } = {}) {
    return sendPlanner({
        force,
        label: 'Muenster-Planer',
        city: 'Münster',
        useWeek: true,
        title: 'Diese Woche',
        titleAccent: 'in Münster',
        stamp: 'Mo bis So',
        slug: 'muenster-planner',
        caption: 'Eure Woche in Münster ✨\nMehr Events: https://liebefeld.lovable.app/'
    });
}

async function sendDailyHighlightsVideo(date = getBerlinNow()) {
    const videoPath = await generateDailyHighlightsVideo(date, { label: 'daily-video' });
    if (!videoPath || !fs.existsSync(videoPath)) {
        throw new Error('Video rendering produced no output');
    }
    try {
        const media = MessageMedia.fromFilePath(videoPath);
        await client.sendMessage(announcementChatId, media, {
            caption: '🎬 Tageshighlights als Video – viel Spass beim Durchscrollen!'
        });
    } catch (err) {
        throw new Error(`Failed to send video: ${err.message}`);
    }
}

/**
 * Send a poll and pin it for a week.
 *
 * whatsapp-web.js resolves sendMessage to undefined when it cannot map the sent
 * poll back to a message model. The poll is delivered either way, so a missing
 * message must not abort the caller — that would skip the state write that
 * follows and leave the week's schedule without its poll reference.
 *
 * Returns the message id, or null when it could not be determined.
 */
async function sendAndPinPoll(chatId, poll) {
    const message = await client.sendMessage(chatId, poll);

    if (!message) {
        console.warn('Umfrage gesendet, aber kein Message-Objekt erhalten — ohne Pin und ohne Message-ID.');
        return null;
    }

    try {
        await message.pin(604800);
    } catch (err) {
        console.error('Umfrage konnte nicht angepinnt werden:', err && err.message ? err.message : err);
    }

    return message.id?._serialized || null;
}

async function sendSpecialSaturdayAnnouncement({ state, weeklyState, weekKey, today }) {
    const activity = getSpecialSaturdayActivity(weekKey);
    const intro = [
        getSpecialSaturdayOpener(weekKey),
        '',
        '🎉 Letzter Samstag im Monat = SPECIAL SAMSTAG.',
        '',
        `Diese Mal: ${activity.emoji} ${activity.name} (${activity.time})`,
        activity.blurb,
        '',
        '⚠️ Special Samstag heisst: jemand aus der Tribe uebernimmt die Orga.',
        'Treffpunkt, Location, Details - im Chat klaeren.',
        "Wer hat Bock? Schreibt 👇 \"Ich mach's\" - sonst faellt's flach.",
        '',
        'Sagt bis Freitag 18 Uhr Bescheid, ob ihr dabei seid.'
    ].join('\n');

    const media = await loadKennenlernabendMedia();

    if (media) {
        await client.sendMessage(chatId, media, { caption: intro });
    } else {
        await client.sendMessage(chatId, intro);
    }

    const pollMessageId = await sendAndPinPoll(
        chatId,
        new Poll(`Special Samstag: ${activity.emoji} ${activity.name}`, SPECIAL_SATURDAY_POLL_OPTIONS)
    );

    weeklyState.specialSaturday = {
        dateKey: today.dateKey,
        weekKey,
        activity: activity.name,
        emoji: activity.emoji,
        time: activity.time,
        messageId: pollMessageId,
        createdAt: new Date().toISOString()
    };

    weeklyState.venuePoll = {
        dateKey: today.dateKey,
        weekKey,
        messageId: pollMessageId,
        options: SPECIAL_SATURDAY_POLL_OPTIONS,
        special: true,
        createdAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Special-Samstag-Post fuer ${weekKey} gesendet. Aktion: ${activity.name}.`);
}

async function sendWednesdayVenuePoll({ force = false } = {}) {
    const state = getState();
    const today = getDateParts();
    const weekKey = getBerlinWeekKey();
    const weeklyState = ensureWeeklyPollState(state, weekKey);

    // Die Location-Umfrage ist ein Wochenformat — einmal pro Woche genuegt.
    // Der frueher tagesgenaue Vergleich haette sie ein zweites Mal gestellt,
    // sobald sie vorgezogen wird und der regulaere Mittwochs-Lauf danach noch
    // greift: der Tagesmerker gilt nur fuer den Tag, an dem vorgezogen wurde.
    if (!force && weeklyState.venuePoll) {
        return;
    }

    if (!force && WEEK_OVERRIDES[weekKey]?.skipVenuePoll) {
        console.log(`Location-Umfrage fuer Woche ${weekKey} per Override abgeschaltet — nichts gepostet.`);
        return;
    }

    if (isLastSaturdayOfMonth(weekKey) && !WEEK_OVERRIDES[weekKey]?.skipSpecialSaturday) {
        await sendSpecialSaturdayAnnouncement({ state, weeklyState, weekKey, today });
        return;
    }

    const format = getEventFormat(today.dateKey);
    const weekendStarter = isWeekendStarterActive(today.dateKey);
    const venues = getVenueOptionsForWeek(weekKey);
    const options = [...venues, VENUE_POLL_CHAT_OPTION];
    const intro = [
        getOpenerForWeek(weekKey, today.dateKey),
        '',
        weekendStarter
            ? `${format.label}: ${format.claim} Entspannt ankommen, Leute kennenlernen, danach zieht ihr gemeinsam weiter.`
            : `${format.label}: Einstieg in den Abend – entspannt ankommen, Leute kennenlernen, danach ziehen wir gemeinsam weiter.`,
        '',
        'Drei Locations zur Auswahl:',
        ...venues.map(venue => `👉 ${venue}`),
        '',
        weekendStarter
            ? 'Bis Donnerstag 18 Uhr abstimmen. Eigene Idee? Ab in den Chat.'
            : 'Bis Freitag 18 Uhr abstimmen. Eigene Idee? Ab in den Chat.'
    ].join('\n');

    const media = await loadKennenlernabendMedia();

    if (media) {
        await client.sendMessage(chatId, media, { caption: intro });
    } else {
        await client.sendMessage(chatId, intro);
    }

    const pollMessageId = await sendAndPinPoll(
        chatId,
        new Poll(`Location fuer den ${format.label} am ${format.day}?`, options)
    );

    if (!pollMessageId) {
        console.warn('Die Zusage-Umfrage faellt damit auf die erste Location zurueck statt auf den Abstimmungssieger.');
    }

    weeklyState.venuePoll = {
        dateKey: today.dateKey,
        weekKey,
        messageId: pollMessageId,
        options,
        createdAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Mittwochs-Umfrage fuer ${weekKey} gesendet.`);
    await updateLandingPageNextEvent();
}

function getLatestVotesPerVoter(votes) {
    const latestByVoter = new Map();

    for (const vote of votes) {
        const voter = vote.voter;
        if (!voter) {
            continue;
        }

        const existingVote = latestByVoter.get(voter);
        if (!existingVote || Number(vote.interractedAtTs) >= Number(existingVote.interractedAtTs)) {
            latestByVoter.set(voter, vote);
        }
    }

    return Array.from(latestByVoter.values());
}

async function syncTrackedChatMemberCounts() {
    const analytics = getAnalytics();

    for (const targetChatId of getTrackedChatIds()) {
        try {
            const chat = await client.getChatById(targetChatId);
            const chatAnalytics = ensureChatAnalytics(analytics, targetChatId);
            chatAnalytics.label = chat.name || getTrackedChatLabel(targetChatId);
            chatAnalytics.memberCount = Array.isArray(chat.participants) ? chat.participants.length : 0;
            chatAnalytics.lastSyncedAt = new Date().toISOString();

            if (targetChatId === chatId) {
                const dateKey = getDateParts().dateKey;
                analytics.memberCountHistory[dateKey] = chatAnalytics.memberCount;
            }
        } catch (err) {
            console.error(`Fehler beim Laden der Chat-Metadaten fuer ${targetChatId}:`, err.message);
        }
    }

    analytics.lastMembershipSyncAt = new Date().toISOString();
    writeAnalytics(analytics);

    // Landing Page bewirbt die "THE TRIBE.BI"-Community, nicht den generischen
    // chatId (#ausgehen). Diesen Chat bevorzugt nehmen, sonst Fallback auf chatId.
    const LANDING_CHAT_ID = process.env.LANDING_CHAT_ID || '120363425963185977@g.us';
    const landingCount = analytics.trackedChats[LANDING_CHAT_ID]?.memberCount
        || analytics.trackedChats[chatId]?.memberCount;
    if (landingCount) {
        await updateLandingPageMemberCount(landingCount);
    }
    await updateLandingPageNextEvent();
}

async function updateLandingPageMemberCount(count) {
    // Beide Landing-Varianten mitpflegen: index.html (v6-focus) + v2.html (v6-bgslide).
    const files = ['index.html', 'v2.html'];
    const changed = [];
    for (const file of files) {
        const htmlPath = path.join(__dirname, 'docs', file);
        try {
            let html = fs.readFileSync(htmlPath, 'utf8');
            // v4-onepager: bigCount = Gesamtcount, Faces-Zeile "& N weitere" = count - 3
            // (Maik/Lena/Patrick namentlich). "Bielefelder" am Ende optional (v3-story
            // hatte es, v4-onepager nicht). Chat-Header-Regex no-opt't auf v4 (kein Chat).
            const updated = html
                .replace(/(id="bigCount">)\d+(<)/, `$1${count}$2`)
                .replace(/(<i class="online"><\/i>\s*)\d+(\s*Mitglieder)/, `$1${count}$2`)
                .replace(/(&amp;\s*)\d+(\s*weitere)/, `$1${Math.max(count - 3, 0)}$2`);
            if (updated === html) continue;
            fs.writeFileSync(htmlPath, updated, 'utf8');
            changed.push(`docs/${file}`);
        } catch (err) {
            console.error(`Fehler beim Aktualisieren der Landing Page (${file}):`, err.message);
        }
    }
    if (!changed.length) return;
    try {
        const { execSync } = require('child_process');
        execSync(`git add ${changed.join(' ')} && git commit -m "update member count to ${count}" && git push origin main`, { cwd: __dirname });
        console.log(`Landing page member count updated to ${count} (${changed.join(', ')})`);
    } catch (err) {
        console.error('Fehler beim Commit/Push der Landing Page:', err.message);
    }
}

async function updateLandingPageNextEvent() {
    const htmlPath = path.join(__dirname, 'docs', 'index.html');
    try {
        const state = getState();
        const weekKey = getBerlinWeekKey();

        // Naechsten Event-Abend berechnen: Freitag im Weekend-Starter-Format,
        // sonst Samstag.
        const format = getEventFormat();
        const eventDate = getEventDayUtcDate(weekKey);
        const day = eventDate.getUTCDate();
        const month = eventDate.getUTCMonth() + 1;
        const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
        const dayName = dayNames[eventDate.getUTCDay()];
        const label = `${dayName}. ${day}. ${monthNames[month - 1]} · ${format.timeShort} Uhr`;

        // Location: aus laufender Abstimmung oder Fallback
        const weeklyState = ensureWeeklyPollState(state, weekKey);
        let location = '';
        if (weeklyState.venuePoll?.messageId) {
            try {
                const { winner } = await getWinningVenueFromWednesdayPoll(weeklyState, weekKey);
                location = winner !== VENUE_POLL_CHAT_OPTION ? ` · ${winner}` : '';
            } catch (e) { /* ignore */ }
        }
        if (!location && weeklyState.venuePoll?.options?.[0]) {
            location = ` · ${weeklyState.venuePoll.options[0]}`;
        }

        if (!location) location = ' · Bernstein';
        const fullLabel = label + location;

        let html = fs.readFileSync(htmlPath, 'utf8');
        const updated = html.replace(
            /(<strong id="next-event-label">)[^<]*(<\/strong>)/,
            `$1${fullLabel}$2`
        );
        if (updated === html) return;
        fs.writeFileSync(htmlPath, updated, 'utf8');
        const { execSync } = require('child_process');
        execSync(`git add docs/index.html && git commit -m "update next event: ${fullLabel}" && git push origin main`, { cwd: __dirname });
        console.log(`Landing page next event updated: ${fullLabel}`);
    } catch (err) {
        console.error('Fehler beim Aktualisieren des Next-Event-Badge:', err.message);
    }
}

function normalizeCityToken(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // Diakritika entfernen
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Ordnet einen WhatsApp-Gruppennamen einer Stadt zu (z. B. "THE TRIBE Köln" -> "Köln").
// Konservativ: nur Gruppen, die nach Tribe-Stadtgruppen aussehen, werden gematcht,
// damit nicht zufällige Gruppen ("Essen"=Mahlzeit, "Halle"=Raum) reinrutschen.
function matchCityFromGroupName(name) {
    const norm = normalizeCityToken(name);
    if (!norm) return null;
    const looksLikeTribeGroup = /\btribe\b/.test(norm) || /\bgermany\b/.test(norm) || /\bde\b/.test(norm);
    for (const city of GERMANY_CITIES) {
        const token = normalizeCityToken(city);
        const re = new RegExp(`(^|[^a-z])${token}([^a-z]|$)`);
        if (re.test(norm)) {
            // Reiner Stadtname als Gruppenname (nach Entfernen von Tribe-Wörtern) zählt auch.
            const stripped = norm.replace(/\b(the|tribe|germany|deutschland|community|gruppe|chat)\b/g, '').trim();
            if (looksLikeTribeGroup || stripped === token) {
                return city;
            }
        }
    }
    return null;
}

// Liest alle Community-Gruppen aus, matcht sie auf Städte, holt Mitgliederzahl
// (chat.participants) + Invite-Link (chat.getInviteCode, nur als Admin), und
// schreibt docs/germany/cities.json (committet + pusht wie der Member-Count-Sync).
// Bestehende Links bleiben erhalten, falls der Bot keinen frischen Link ziehen kann.
async function exportGermanyCommunityMap() {
    let chats;
    try {
        chats = await client.getChats();
    } catch (err) {
        console.error('Germany-Map: getChats() fehlgeschlagen:', err.message);
        return;
    }

    const groups = chats.filter(chat => chat.isGroup);
    const discovered = new Map(); // city -> { members, link }

    for (const group of groups) {
        const city = matchCityFromGroupName(group.name || '');
        if (!city) continue;

        const members = Array.isArray(group.participants) ? group.participants.length : 0;
        let link = null;
        try {
            const code = await group.getInviteCode();
            if (code) link = `https://chat.whatsapp.com/${code}`;
        } catch (_) {
            // Bot ist kein Admin -> kein Link abrufbar, bestehenden behalten
        }

        const prev = discovered.get(city);
        if (!prev || members > prev.members) {
            discovered.set(city, { members, link: link || prev?.link || null });
        } else if (!prev.link && link) {
            prev.link = link;
        }
    }

    // Bestehende Datei laden (manuell gepflegte Links / Einträge bewahren)
    let existing = [];
    try {
        const raw = JSON.parse(fs.readFileSync(GERMANY_MAP_FILE, 'utf8'));
        if (Array.isArray(raw)) existing = raw;
    } catch (_) {}
    const byCity = new Map(existing.filter(e => e && e.city).map(e => [e.city, e]));

    // Bielefeld = Ursprung: Count aus der Landing-Analyse (konsistent mit index.html),
    // Link fix (oder bereits gepflegter Link).
    const analytics = getAnalytics();
    const LANDING_CHAT_ID = process.env.LANDING_CHAT_ID || '120363425963185977@g.us';
    const bielefeldCount = analytics.trackedChats[LANDING_CHAT_ID]?.memberCount
        || analytics.trackedChats[chatId]?.memberCount
        || byCity.get('Bielefeld')?.members
        || 0;
    discovered.set('Bielefeld', {
        members: bielefeldCount,
        link: byCity.get('Bielefeld')?.link || GERMANY_BIELEFELD_LINK
    });

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

    const json = JSON.stringify(result, null, 2) + '\n';
    let current = '';
    try { current = fs.readFileSync(GERMANY_MAP_FILE, 'utf8'); } catch (_) {}
    if (json === current) {
        console.log('Germany-Map: keine Änderung.');
        return;
    }

    try {
        fs.mkdirSync(path.dirname(GERMANY_MAP_FILE), { recursive: true });
        fs.writeFileSync(GERMANY_MAP_FILE, json, 'utf8');
        const { execSync } = require('child_process');
        execSync('git add docs/germany/cities.json && git commit -m "update germany community map" && git push origin main', { cwd: __dirname });
        console.log(`Germany-Map aktualisiert: ${result.length} Städte (${result.map(r => `${r.city}:${r.members}`).join(', ')}).`);
    } catch (err) {
        console.error('Germany-Map: Schreiben/Commit fehlgeschlagen:', err.message);
    }
}

async function syncRecentMessageHistory() {
    const analytics = getAnalytics();

    if (analytics.lastHistorySyncAt) {
        return;
    }

    for (const targetChatId of getTrackedChatIds()) {
        try {
            const chat = await client.getChatById(targetChatId);
            const messages = await chat.fetchMessages({ limit: INITIAL_MESSAGE_HISTORY_LIMIT });

            for (const message of messages) {
                recordAnalyticsMessage(message, { persist: false, analytics });
            }
        } catch (err) {
            console.error(`Fehler beim Laden des Nachrichtenverlaufs fuer ${targetChatId}:`, err.message);
        }
    }

    analytics.lastHistorySyncAt = new Date().toISOString();
    writeAnalytics(analytics);
}

function buildAttendanceSnapshot(weekKey, weeklyState, counts, latestVotes) {
    const yesCount = counts['Bin dabei'] || 0;
    const maybeCount = counts['Beim naechsten Mal'] || counts.Vielleicht || 0;
    const totalVotes = latestVotes.length;
    const memberCount = Number(getAnalytics().trackedChats[chatId]?.memberCount || 0);

    return {
        weekKey,
        dateKey: weeklyState.attendancePoll?.dateKey || null,
        venue: weeklyState.attendancePoll?.venue || weeklyState.finalVenue?.name || 'Offen',
        yesCount,
        maybeCount,
        totalVotes,
        participationRate: memberCount > 0 ? Math.round((yesCount / memberCount) * 100) : 0,
        source: weeklyState.finalVenue?.source || 'poll',
        updatedAt: new Date().toISOString()
    };
}

async function syncAttendanceAnalytics() {
    const state = getState();
    const analytics = getAnalytics();
    const attendanceByWeek = new Map((analytics.attendance || []).map(entry => [entry.weekKey, entry]));

    for (const [weekKey, weeklyState] of Object.entries(state.weeklyPolls || {})) {
        if (!weeklyState?.attendancePoll?.messageId) {
            continue;
        }

        try {
            const votes = await client.getPollVotes(weeklyState.attendancePoll.messageId);
            const latestVotes = getLatestVotesPerVoter(votes);
            const counts = Object.fromEntries(ATTENDANCE_OPTIONS.map(option => [option, 0]));

            for (const vote of latestVotes) {
                const selectedOption = vote.selectedOptions[0]?.name;
                if (selectedOption && Object.prototype.hasOwnProperty.call(counts, selectedOption)) {
                    counts[selectedOption] += 1;
                }
            }

            attendanceByWeek.set(
                weekKey,
                buildAttendanceSnapshot(weekKey, weeklyState, counts, latestVotes)
            );
        } catch (err) {
            console.error(`Fehler beim Aktualisieren der Kennenlernabend-Statistik fuer ${weekKey}:`, err.message);
        }
    }

    analytics.attendance = Array.from(attendanceByWeek.values())
        .sort((a, b) => String(b.weekKey).localeCompare(String(a.weekKey)));
    analytics.lastAttendanceSyncAt = new Date().toISOString();
    writeAnalytics(analytics);
}

function buildDashboardData() {
    const analytics = getAnalytics();
    const mainChatAnalytics = ensureChatAnalytics(analytics, chatId);
    const attendanceEntries = [...analytics.attendance].sort((a, b) => String(b.weekKey).localeCompare(String(a.weekKey)));
    const latestAttendance = attendanceEntries[0] || null;
    const trackedChats = Object.entries(analytics.trackedChats)
        .map(([targetChatId, value]) => ({
            id: targetChatId,
            label: value.label || getTrackedChatLabel(targetChatId),
            memberCount: Number(value.memberCount || 0),
            messageCount7d: sumCountsByRecentDays(value.messagesByDate || {}, 7),
            activeUsers7d: getUniqueUsersByRecentDays(value.activeUsersByDate || {}, 7),
            lastMessageAt: value.lastMessageAt || null
        }))
        .sort((a, b) => b.memberCount - a.memberCount);

    const memberChartDays = 21;
    const memberChartKeys = [];
    const memberChartValues = [];
    const memberHistory = analytics.memberCountHistory || {};
    let lastKnownCount = 0;
    for (let i = memberChartDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        const key = formatUtcDateKey(d);
        if (memberHistory[key] !== undefined) lastKnownCount = Number(memberHistory[key]);
        memberChartKeys.push(key);
        memberChartValues.push(lastKnownCount);
    }

    return {
        generatedAt: new Date().toISOString(),
        memberChart: { keys: memberChartKeys, values: memberChartValues },
        communityJoins: (analytics.communityJoins || []).map(j =>
            typeof j === 'string' ? j : (j.date || '')
        ).filter(Boolean),
        kpis: {
            communityMembers: Number(mainChatAnalytics.memberCount || 0),
            activeUsers7d: getUniqueUsersByRecentDays(analytics.activeUsersByDate, 7),
            messages7d: sumCountsByRecentDays(analytics.messagesByDate, 7),
            messages30d: sumCountsByRecentDays(analytics.messagesByDate, 30),
            kennenlernenParticipation: latestAttendance ? latestAttendance.participationRate : 0,
            kennenlernenAttendees: latestAttendance ? latestAttendance.yesCount : 0
        },
        charts: {
            labels7d: getRecentDateLabels(7),
            messages7d: getRecentSeries(analytics.messagesByDate, 7),
            activeUsers7d: getRecentSeries(analytics.activeUsersByDate, 7)
        },
        trackedChats,
        recentMessages: recentMessages.slice(0, 20),
        attendanceEntries,
        latestAttendance,
        lastSync: {
            history: analytics.lastHistorySyncAt || null,
            members: analytics.lastMembershipSyncAt || null,
            attendance: analytics.lastAttendanceSyncAt || null
        },
        website: cachedWebsiteAnalytics || {
            ctaToday: 0, cta7d: 0, cta30d: 0,
            conversionRate7d: 0, totalSessions: 0,
            ctaByLabel: [], ctaDailySeries: [], ctaDailyLabels: [],
            topReferrers: [], deviceSplit: { mobile: 0, tablet: 0, desktop: 0 },
            landingChart: { keys: [], visitors: [], cta: [], visTotal: 0, ctaTotal: 0, rate: '0.0' },
            fetchedAt: null
        }
    };
}

function renderSparkline(values, lineColor, fillColor) {
    const width = 260;
    const height = 88;
    const max = Math.max(...values, 1);
    const stepX = values.length > 1 ? width / (values.length - 1) : width;
    const points = values
        .map((value, index) => {
            const x = index * stepX;
            const y = height - ((value / max) * (height - 14)) - 7;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    const areaPoints = `0,${height} ${points} ${width},${height}`;

    return `
        <svg viewBox="0 0 ${width} ${height}" class="sparkline" preserveAspectRatio="none" aria-hidden="true">
            <polygon points="${areaPoints}" fill="${fillColor}"></polygon>
            <polyline points="${points}" fill="none" stroke="${lineColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
        </svg>
    `;
}

function renderMemberChart(data) {
    const W = 580, H = 150, pL = 44, pR = 12, pT = 10, pB = 28;
    const cW = W - pL - pR, cH = H - pT - pB;
    const { keys, values } = data.memberChart;
    const joinSet = new Set(data.communityJoins);

    const maxV = Math.max(...values, 1);
    const minV = Math.min(...values.filter(v => v > 0), maxV);
    const spread = maxV - minV || 1;
    const n = values.length;
    const sx = i => pL + (i / Math.max(n - 1, 1)) * cW;
    const sy = v => pT + cH - ((v - minV) / spread) * cH;

    const linePts = values.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
    const areaPts = `${sx(0).toFixed(1)},${(pT + cH).toFixed(1)} ${linePts} ${sx(n - 1).toFixed(1)},${(pT + cH).toFixed(1)}`;

    const markers = keys.map((k, i) => joinSet.has(k)
        ? `<circle cx="${sx(i).toFixed(1)}" cy="${sy(values[i]).toFixed(1)}" r="5" fill="#22c55e" stroke="#fff" stroke-width="1" opacity="0.92"/>`
        : ''
    ).join('');

    const axisLabels = [0, Math.floor(n / 2), n - 1].map(i =>
        `<text x="${sx(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" fill="#888" font-size="9">${keys[i].slice(5)}</text>`
    ).join('');

    const yLabels = [[minV, sy(minV)], [maxV, sy(maxV)]].map(([v, y]) =>
        `<text x="${pL - 5}" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle" fill="#888" font-size="9">${v}</text>`
    ).join('');

    const legend = joinSet.size > 0
        ? `<circle cx="${W - 90}" cy="14" r="4" fill="#22c55e"/>
           <text x="${W - 82}" y="18" fill="#22c55e" font-size="9">Neues Mitglied</text>`
        : '';

    return `
        <svg viewBox="0 0 ${W} ${H}" class="member-chart" preserveAspectRatio="xMidYMid meet" aria-label="Mitglieder-Verlauf">
            <polygon points="${areaPts}" fill="rgba(79,195,247,0.10)"/>
            <polyline points="${linePts}" fill="none" stroke="#4fc3f7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            ${markers}
            ${axisLabels}
            ${yLabels}
            ${legend}
        </svg>`;
}

function renderLandingChart(lc) {
    const W = 580, H = 170, pL = 34, pR = 34, pT = 14, pB = 30;
    const cW = W - pL - pR, cH = H - pT - pB;
    const keys = lc.keys || [];
    const vis = lc.visitors || [];
    const cta = lc.cta || [];
    const n = keys.length;
    if (n === 0) {
        return `<svg viewBox="0 0 ${W} ${H}" class="member-chart"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#888" font-size="12">Noch keine Landing-Daten</text></svg>`;
    }
    const maxV = Math.max(...vis, 1);
    const maxC = Math.max(...cta, 1);
    const sx = i => pL + (i / Math.max(n - 1, 1)) * cW;
    const syV = v => pT + cH - (v / maxV) * cH;
    const syC = c => pT + cH - (c / maxC) * cH;

    const visLine = vis.map((v, i) => `${sx(i).toFixed(1)},${syV(v).toFixed(1)}`).join(' ');
    const visArea = `${sx(0).toFixed(1)},${(pT + cH).toFixed(1)} ${visLine} ${sx(n - 1).toFixed(1)},${(pT + cH).toFixed(1)}`;
    const ctaLine = cta.map((c, i) => `${sx(i).toFixed(1)},${syC(c).toFixed(1)}`).join(' ');
    const ctaDots = cta.map((c, i) => `<circle cx="${sx(i).toFixed(1)}" cy="${syC(c).toFixed(1)}" r="3.2" fill="#22c55e"/>`).join('');

    const xLabels = keys.map((k, i) => (n <= 8 || i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0)
        ? `<text x="${sx(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="#888" font-size="9">${k.slice(5)}</text>`
        : '').join('');
    const yLeft = `<text x="${pL - 6}" y="${(pT + 4).toFixed(1)}" text-anchor="end" fill="#4fc3f7" font-size="9">${maxV}</text>
                   <text x="${pL - 6}" y="${(pT + cH).toFixed(1)}" text-anchor="end" fill="#4fc3f7" font-size="9">0</text>`;
    const yRight = `<text x="${(W - pR + 6).toFixed(1)}" y="${(pT + 4).toFixed(1)}" text-anchor="start" fill="#22c55e" font-size="9">${maxC}</text>
                    <text x="${(W - pR + 6).toFixed(1)}" y="${(pT + cH).toFixed(1)}" text-anchor="start" fill="#22c55e" font-size="9">0</text>`;
    const legend = `<circle cx="${pL + 4}" cy="10" r="4" fill="#4fc3f7"/><text x="${pL + 12}" y="13" fill="#4fc3f7" font-size="9">Besucher</text>
                    <circle cx="${pL + 84}" cy="10" r="4" fill="#22c55e"/><text x="${pL + 92}" y="13" fill="#22c55e" font-size="9">CTA-Klicks</text>`;

    return `
        <svg viewBox="0 0 ${W} ${H}" class="member-chart" preserveAspectRatio="xMidYMid meet" aria-label="Besucher- und CTA-Verlauf">
            <polygon points="${visArea}" fill="rgba(79,195,247,0.10)"/>
            <polyline points="${visLine}" fill="none" stroke="#4fc3f7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="${ctaLine}" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            ${ctaDots}
            ${xLabels}${yLeft}${yRight}${legend}
        </svg>`;
}

function getDashboardCommands() {
    return [
        { label: 'Highlights', command: '/highlights' },
        { label: 'Poll Mi', command: '/poll-mittwoch' },
        { label: 'Poll Fr', command: '/poll-freitag' },
        { label: 'Reminder So', command: '/kennenlernabend-reminder' },
        { label: 'Tuesday Run', command: '/tuesday-run' },
        { label: 'Jam Session', command: '/jam-session' },
        { label: 'Fussball Do', command: '/thursday-football' },
        { label: 'Ping Pong Do', command: '/ping-pong' },
        { label: 'Gruppen', command: '/groups' }
    ];
}

function renderDashboardHtml(data) {
    const messageChart = renderSparkline(data.charts.messages7d, '#ff7a18', 'rgba(255,122,24,0.18)');
    const activeUsersChart = renderSparkline(data.charts.activeUsers7d, '#00c2a8', 'rgba(0,194,168,0.18)');
    const commandButtons = getDashboardCommands().map(item => `
        <button class="command-button" type="button" data-command="${escapeHtml(item.command)}">${escapeHtml(item.label)}</button>
    `).join('');
    const trackedChatsRows = data.trackedChats.map(chat => `
        <tr>
            <td>${escapeHtml(chat.label)}</td>
            <td>${chat.memberCount}</td>
            <td>${chat.activeUsers7d}</td>
            <td>${chat.messageCount7d}</td>
        </tr>
    `).join('');
    const attendanceRows = data.attendanceEntries.slice(0, 8).map(entry => `
        <tr>
            <td>${escapeHtml(entry.weekKey)}</td>
            <td>${escapeHtml(entry.venue)}</td>
            <td>${entry.yesCount}</td>
            <td>${entry.totalVotes}</td>
            <td>${entry.participationRate}%</td>
        </tr>
    `).join('');
    const recentMessagesList = (data.recentMessages || []).map(entry => {
        const time = new Date(entry.at).toLocaleString('de-DE', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        return `
        <li class="msg-item">
            <div class="msg-meta">
                <span class="msg-author">${escapeHtml(entry.author)}</span>
                <span class="msg-chat">${escapeHtml(entry.chatLabel)}</span>
                <span class="msg-time">${escapeHtml(time)}</span>
            </div>
            <div class="msg-body">${escapeHtml(entry.body)}</div>
        </li>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>THE TRIBE Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Familjen+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        :root {
            --bg: #0A0807;
            --bg-soft: #141110;
            --panel: rgba(20,17,16,0.85);
            --ink: #F5F0E8;
            --muted: #9C9690;
            --accent: #F59E0B;
            --accent-deep: #B45309;
            --green: #25D366;
            --red: #EF4444;
            --line: rgba(245,240,232,0.10);
            --shadow: 0 8px 32px rgba(0,0,0,0.5);
            --font-display: "Anton", "Arial Narrow", sans-serif;
            --font-body: "Familjen Grotesk", system-ui, sans-serif;
        }

        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: var(--font-body);
            color: var(--ink);
            background: var(--bg);
        }

        .shell {
            max-width: 1240px;
            margin: 0 auto;
            padding: 32px 20px 48px;
        }

        .hero {
            padding: 32px 36px;
            border-radius: 4px;
            border-left: 4px solid var(--accent);
            background: var(--bg-soft);
            position: relative;
            overflow: hidden;
        }
        .hero::after {
            content: "";
            position: absolute;
            inset: -20% -20% auto -20%;
            height: 60%;
            background: radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.12), transparent 65%);
            pointer-events: none;
        }

        .eyebrow {
            font-size: 11px;
            letter-spacing: 0.28em;
            text-transform: uppercase;
            color: var(--accent);
            font-weight: 600;
        }

        h1 {
            margin: 10px 0 8px;
            font-family: var(--font-display);
            font-size: clamp(2rem, 4vw, 3.2rem);
            line-height: 0.95;
            text-transform: uppercase;
            color: var(--ink);
        }

        .hero p {
            max-width: 720px;
            margin: 0;
            color: var(--muted);
            font-size: 0.95rem;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 14px;
            margin-top: 18px;
        }

        .card {
            grid-column: span 3;
            background: var(--bg-soft);
            border: 1px solid var(--line);
            border-radius: 4px;
            padding: 20px;
            box-shadow: var(--shadow);
        }

        .card.wide { grid-column: span 6; }
        .card.full { grid-column: 1 / -1; }

        .label {
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.22em;
            color: var(--muted);
            font-weight: 600;
        }

        .value {
            margin-top: 10px;
            font-family: var(--font-display);
            font-size: clamp(2.2rem, 4vw, 3.2rem);
            line-height: 1;
            color: var(--ink);
        }

        .subtle {
            margin-top: 6px;
            color: var(--muted);
            font-size: 0.85rem;
        }

        .sparkline {
            width: 100%;
            height: 90px;
            margin-top: 16px;
        }

        .axis {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin-top: 8px;
            color: var(--muted);
            font-size: 0.72rem;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-family: var(--font-body);
        }

        th, td {
            text-align: left;
            padding: 12px 10px;
            border-bottom: 1px solid var(--line);
            font-size: 0.9rem;
        }

        th {
            color: var(--muted);
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.18em;
        }

        .member-chart {
            width: 100%;
            height: 150px;
            margin-top: 10px;
            display: block;
        }

        .pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 16px;
            padding: 6px 14px;
            border-radius: 999px;
            background: rgba(245,158,11,0.12);
            border: 1px solid rgba(245,158,11,0.25);
            color: var(--accent);
            font-size: 0.82rem;
            font-weight: 600;
            letter-spacing: 0.03em;
        }

        .console-layout {
            display: grid;
            grid-template-columns: minmax(200px, 260px) 1fr;
            gap: 18px;
            margin-top: 18px;
        }

        .command-panel {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            align-content: start;
        }

        .command-button,
        .send-button {
            border: 1px solid var(--line);
            border-radius: 4px;
            background: rgba(245,158,11,0.10);
            color: var(--ink);
            cursor: pointer;
            font: 600 0.85rem var(--font-body);
            min-height: 38px;
            padding: 9px 10px;
            letter-spacing: 0.04em;
            transition: background 0.15s;
        }

        .command-button:hover,
        .send-button:hover {
            background: rgba(245,158,11,0.22);
            border-color: var(--accent);
        }

        .send-button {
            background: var(--accent);
            color: #0A0807;
            border-color: var(--accent);
        }
        .send-button:hover { background: var(--accent-deep); }

        .console-form {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
            margin-top: 12px;
        }

        .console-input {
            min-width: 0;
            border: 1px solid var(--line);
            border-radius: 4px;
            background: rgba(245,240,232,0.05);
            color: var(--ink);
            font: 0.9rem Consolas, "Courier New", monospace;
            min-height: 40px;
            padding: 10px 12px;
        }
        .console-input:focus { outline: none; border-color: var(--accent); }

        .log-box {
            height: min(68vh, 760px);
            min-height: 560px;
            overflow: auto;
            border-radius: 4px;
            background: #050403;
            border: 1px solid var(--line);
            color: #9C9690;
            font: 0.74rem/1.5 Consolas, "Courier New", monospace;
            padding: 12px;
            white-space: pre;
        }

        .log-line {
            border-bottom: 1px solid rgba(245,240,232,0.04);
            padding: 3px 0;
        }

        .log-line.error { color: #FCA5A5; }
        .log-line.warn  { color: #FCD34D; }

        .msg-list {
            list-style: none;
            margin: 12px 0 0;
            padding: 0;
            max-height: 420px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .msg-item {
            background: rgba(245,240,232,0.04);
            border: 1px solid var(--line);
            border-left: 3px solid var(--accent);
            border-radius: 2px;
            padding: 10px 14px;
        }
        .msg-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: baseline;
            font-size: 0.75rem;
            color: var(--muted);
            margin-bottom: 4px;
        }
        .msg-author { color: var(--ink); font-weight: 700; }
        .msg-chat {
            background: rgba(37,211,102,0.12);
            color: var(--green);
            padding: 1px 8px;
            border-radius: 999px;
            font-size: 0.7rem;
            font-weight: 600;
        }
        .msg-time { margin-left: auto; }
        .msg-body {
            font-size: 0.88rem;
            color: var(--ink);
            white-space: pre-wrap;
            word-wrap: break-word;
            opacity: 0.9;
        }
        .msg-empty {
            color: var(--muted);
            font-size: 0.88rem;
            padding: 8px 0;
        }

        .status-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 999px;
            margin-right: 8px;
            background: ${isReady ? '#25D366' : '#F59E0B'};
            box-shadow: 0 0 6px ${isReady ? 'rgba(37,211,102,0.6)' : 'rgba(245,158,11,0.6)'};
        }

        @media (max-width: 900px) {
            .card, .card.wide { grid-column: 1 / -1; }
            .console-layout { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <main class="shell">
        <section class="hero">
            <div class="eyebrow">THE TRIBE Community Intelligence</div>
            <h1>Dashboard fuer Community, Aktivitaet und Kennenlernabend</h1>
            <p>Live-Ansicht auf Basis deiner WhatsApp-Gruppen: Mitgliederzahl, schreibende Nutzer, Nachrichtenvolumen und Beteiligung beim Kennenlernabend.</p>
            <div class="pill">Aktualisiert: ${escapeHtml(new Date(data.generatedAt).toLocaleString('de-DE', { timeZone: TIME_ZONE }))}</div>
        </section>

        <section class="grid">
            <article class="card">
                <div class="label">Community Mitglieder</div>
                <div class="value">${data.kpis.communityMembers}</div>
                <div class="subtle">Mitglieder im Hauptchat</div>
            </article>
            <article class="card">
                <div class="label">Schreibende Nutzer 7 Tage</div>
                <div class="value">${data.kpis.activeUsers7d}</div>
                <div class="subtle">Eindeutige Personen mit Nachricht</div>
            </article>
            <article class="card">
                <div class="label">Nachrichten 7 Tage</div>
                <div class="value">${data.kpis.messages7d}</div>
                <div class="subtle">Alle erfassten Nachrichten in den Gruppen</div>
            </article>
            <article class="card">
                <div class="label">Kennenlernabend Beteiligung</div>
                <div class="value">${data.kpis.kennenlernenParticipation}%</div>
                <div class="subtle">${data.kpis.kennenlernenAttendees} Zusagen im letzten Poll</div>
            </article>

            <article class="card full">
                <div class="label">Mitglieder Verlauf (21 Tage)</div>
                <div class="value">${data.kpis.communityMembers}</div>
                <div class="subtle">Gesamtmitglieder im Hauptchat &mdash; ● grüne Punkte = neues Mitglied</div>
                ${renderMemberChart(data)}
            </article>

            <article class="card full">
                <div class="label">Besucher &amp; CTA Verlauf (seit Landing-Launch, paid IG)</div>
                <div class="value">${data.website.landingChart.visTotal} <span style="font-size:.5em;color:#888;">Besucher</span> · ${data.website.landingChart.ctaTotal} <span style="font-size:.5em;color:#888;">CTA</span> · ${data.website.landingChart.rate}%</div>
                <div class="subtle">Eindeutige paid-IG-Besucher (blau) vs. WhatsApp-CTA-Klicks (grün) pro Tag &mdash; kumulative CTA-Rate</div>
                ${renderLandingChart(data.website.landingChart)}
            </article>

            <article class="card full">
                <div class="label">Bot Steuerung</div>
                <div class="subtle"><span class="status-dot"></span>${isReady ? 'Bot ist online' : 'Bot startet oder wartet auf WhatsApp-Verbindung'}</div>
                <div class="console-layout">
                    <div>
                        <div class="command-panel">${commandButtons}</div>
                        <form class="console-form" id="command-form">
                            <input class="console-input" id="command-input" placeholder="Nachricht oder /befehl eingeben..." autocomplete="off">
                            <button class="send-button" type="submit">Senden</button>
                        </form>
                    </div>
                    <div>
                        <div class="label">Bot Log</div>
                        <div class="log-box" id="log-box">Logs werden geladen...</div>
                    </div>
                </div>
            </article>

            <article class="card wide">
                <div class="label">Nachrichten Verlauf 7 Tage</div>
                <div class="value">${data.kpis.messages30d}</div>
                <div class="subtle">Summe der letzten 30 Tage</div>
                ${messageChart}
                <div class="axis">${data.charts.labels7d.map(label => `<span>${escapeHtml(label)}</span>`).join('')}</div>
            </article>

            <article class="card wide">
                <div class="label">Schreibende Nutzer Verlauf 7 Tage</div>
                <div class="value">${data.kpis.activeUsers7d}</div>
                <div class="subtle">Eindeutige Absender pro Tag</div>
                ${activeUsersChart}
                <div class="axis">${data.charts.labels7d.map(label => `<span>${escapeHtml(label)}</span>`).join('')}</div>
            </article>

            <article class="card full">
                <div class="label">Letzte Nachrichten anderer Nutzer</div>
                <div class="subtle">Live-Buffer der ${MAX_RECENT_MESSAGES} zuletzt empfangenen Nachrichten aus den getrackten Gruppen (ohne eigene) &mdash; aktualisiert sich alle 5 Sekunden</div>
                <ul class="msg-list" id="msg-list">${recentMessagesList || '<li class="msg-empty">Noch keine Nachrichten seit dem letzten Bot-Start empfangen.</li>'}</ul>
            </article>

            <article class="card full">
                <div class="label">Gruppen Uebersicht</div>
                <table>
                    <thead>
                        <tr>
                            <th>Gruppe</th>
                            <th>Mitglieder</th>
                            <th>Schreibende Nutzer 7d</th>
                            <th>Nachrichten 7d</th>
                        </tr>
                    </thead>
                    <tbody>${trackedChatsRows}</tbody>
                </table>
            </article>

            <article class="card full">
                <div class="label">Kennenlernabend Historie</div>
                <table>
                    <thead>
                        <tr>
                            <th>Woche</th>
                            <th>Location</th>
                            <th>Zusagen</th>
                            <th>Stimmen</th>
                            <th>Beteiligung</th>
                        </tr>
                    </thead>
                    <tbody>${attendanceRows || '<tr><td colspan="5">Noch keine Kennenlernabend-Daten vorhanden.</td></tr>'}</tbody>
                </table>
            </article>

            <article class="card full" style="border-left: 4px solid var(--accent);">
                <div class="label" style="color: var(--accent);">Landing Page Analytics · PostHog · maikz91.github.io/the-tribe-bot</div>
                <div style="margin-top:4px; font-size:0.8rem; color:var(--muted);">
                    ${data.website.fetchedAt ? `Zuletzt geladen: ${escapeHtml(new Date(data.website.fetchedAt).toLocaleString('de-DE', { timeZone: TIME_ZONE }))}` : 'Noch nicht geladen'}
                    &nbsp;·&nbsp; Baseline 15.05: 16,8% Bounce · 63% 0%-Scroll · 6,1% CTA-Rate
                </div>
            </article>

            <article class="card">
                <div class="label">Sessions (7d)</div>
                <div class="value">${data.website.sessions}</div>
                <div class="subtle">Unique Visits</div>
            </article>
            <article class="card">
                <div class="label">Bounce-Rate (7d)</div>
                <div class="value" style="color:${data.website.bounceRate < 20 ? 'var(--green)' : data.website.bounceRate < 35 ? 'var(--accent)' : 'var(--red)'}">${data.website.bounceRate}%</div>
                <div class="subtle">Kein Scroll-Event · Baseline 16,8%</div>
            </article>
            <article class="card">
                <div class="label">0%-Scroll (7d)</div>
                <div class="value" style="color:${data.website.zeroRate < 50 ? 'var(--green)' : data.website.zeroRate < 65 ? 'var(--accent)' : 'var(--red)'}">${data.website.zeroRate}%</div>
                <div class="subtle">Nie gescrollt · Baseline 63%</div>
            </article>
            <article class="card">
                <div class="label">CTA-Rate (7d)</div>
                <div class="value" style="color:var(--green);">${data.website.ctaRate}%</div>
                <div class="subtle">${data.website.cta7d} Klicks · Baseline 6,1%</div>
            </article>
            <article class="card">
                <div class="label">CTA Heute</div>
                <div class="value" style="color:var(--accent);" >${data.website.ctaToday}</div>
                <div class="subtle">IG ${data.website.ctaIG} · FB ${data.website.ctaFB} (7d)</div>
            </article>

            <article class="card wide" style="grid-column: span 3;">
                <div class="label">Scroll-Tiefe (max. pro Session, 7d)</div>
                <canvas id="scroll-chart" height="80"></canvas>
                <script>
                (function(){
                    const buckets = ${JSON.stringify(data.website.scrollBuckets)};
                    const colors = ['#EF4444','#F59E0B','#FCD34D','#34D399','#25D366','#6EE7B7'];
                    if (window.Chart) {
                        new Chart(document.getElementById('scroll-chart'), {
                            type: 'bar',
                            data: { labels: buckets.map(b=>b.label), datasets: [{ data: buckets.map(b=>b.count), backgroundColor: colors, borderRadius: 3, borderSkipped: false }] },
                            options: { responsive: true, plugins: { legend:{display:false}, tooltip:{callbacks:{label:ctx=>' '+ctx.raw+' Sessions ('+buckets[ctx.dataIndex].pct+'%)'}} }, scales: { x:{ticks:{color:'#9C9690'},grid:{color:'rgba(245,240,232,0.08)'}}, y:{ticks:{color:'#9C9690'},grid:{color:'rgba(245,240,232,0.08)'}} } }
                        });
                    } else {
                        document.getElementById('scroll-chart').insertAdjacentHTML('afterend', buckets.map(b=>'<div style="display:flex;gap:8px;align-items:center;font-size:0.85rem;margin:3px 0"><span style="width:60px;color:#888">'+b.label+'</span><div style="height:12px;background:#ff7a18;border-radius:3px;width:'+Math.max(b.pct,1)+'%"></div><span>'+b.count+' ('+b.pct+'%)</span></div>').join(''));
                    }
                })();
                </script>
            </article>

            <article class="card">
                <div class="label">0%-Scroll — Was passiert?</div>
                <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px;">
                    <div style="display:flex;justify-content:space-between;">
                        <span style="font-size:0.9rem;">Abgesprungen</span>
                        <strong style="color:#e55">${data.website.zBounced}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;">
                        <span style="font-size:0.9rem;">Direkt geklickt</span>
                        <strong style="color:var(--accent-2)">${data.website.zClicked}</strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;">
                        <span style="font-size:0.9rem;">Ø Zeit (Absprünge)</span>
                        <strong style="color:var(--accent)">${data.website.zDwell}s</strong>
                    </div>
                </div>
            </article>
        </section>
    </main>
    <script>
        const logBox = document.getElementById('log-box');
        const commandInput = document.getElementById('command-input');
        const commandForm = document.getElementById('command-form');

        function escapeText(value) {
            return String(value ?? '').replace(/[&<>"']/g, char => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
            }[char]));
        }

        async function sendCommand(command) {
            const value = String(command || '').trim();
            if (!value) return;

            logBox.insertAdjacentHTML('beforeend', '<div class="log-line">&gt; ' + escapeText(value) + '</div>');
            logBox.scrollTop = logBox.scrollHeight;

            const response = await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: value })
            });

            if (!response.ok) {
                const text = await response.text();
                logBox.insertAdjacentHTML('beforeend', '<div class="log-line error">Fehler: ' + escapeText(text) + '</div>');
            }
        }

        async function refreshLogs() {
            try {
                const response = await fetch('/api/logs');
                const logs = await response.json();
                logBox.innerHTML = logs.map(entry => {
                    const time = new Date(entry.at).toLocaleTimeString('de-DE');
                    return '<div class="log-line ' + escapeText(entry.level) + '">[' + time + '] ' + escapeText(entry.message) + '</div>';
                }).join('') || '<div class="log-line">Noch keine Logs.</div>';
                logBox.scrollTop = logBox.scrollHeight;
            } catch {
                logBox.innerHTML = '<div class="log-line error">Logs konnten nicht geladen werden.</div>';
            }
        }

        const msgList = document.getElementById('msg-list');
        function formatMsgTime(iso) {
            const d = new Date(iso);
            const pad = n => String(n).padStart(2, '0');
            return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
        }
        async function refreshMessages() {
            if (!msgList) return;
            try {
                const response = await fetch('/api/messages');
                const messages = await response.json();
                if (!Array.isArray(messages) || messages.length === 0) {
                    msgList.innerHTML = '<li class="msg-empty">Noch keine Nachrichten seit dem letzten Bot-Start empfangen.</li>';
                    return;
                }
                msgList.innerHTML = messages.map(entry => (
                    '<li class="msg-item">' +
                        '<div class="msg-meta">' +
                            '<span class="msg-author">' + escapeText(entry.author) + '</span>' +
                            '<span class="msg-chat">' + escapeText(entry.chatLabel) + '</span>' +
                            '<span class="msg-time">' + escapeText(formatMsgTime(entry.at)) + '</span>' +
                        '</div>' +
                        '<div class="msg-body">' + escapeText(entry.body) + '</div>' +
                    '</li>'
                )).join('');
            } catch {
                // beim naechsten Tick erneut versuchen
            }
        }

        document.querySelectorAll('[data-command]').forEach(button => {
            button.addEventListener('click', () => sendCommand(button.dataset.command));
        });

        commandForm.addEventListener('submit', event => {
            event.preventDefault();
            const value = commandInput.value;
            commandInput.value = '';
            sendCommand(value);
        });

        refreshLogs();
        setInterval(refreshLogs, 3000);
        refreshMessages();
        setInterval(refreshMessages, 5000);
    </script>
</body>
</html>`;
}

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 16_384) {
                req.destroy();
                reject(new Error('Request body too large'));
            }
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function startDashboardServer() {
    if (dashboardServer) {
        return;
    }

    dashboardServer = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || `localhost:${DASHBOARD_PORT}`}`);

        if (url.pathname === '/api/logs') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(dashboardLogs.slice(-MAX_DASHBOARD_LOGS)));
            return;
        }

        if (url.pathname === '/api/messages') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(recentMessages.slice(0, 20)));
            return;
        }

        if (url.pathname === '/api/command' && req.method === 'POST') {
            try {
                const rawBody = await readRequestBody(req);
                const payload = rawBody ? JSON.parse(rawBody) : {};
                const command = String(payload.command || '').trim();

                if (!command) {
                    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('Command missing');
                    return;
                }

                console.log(`Web-Konsole: ${command}`);
                await handleConsoleCommand(command);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true }));
            } catch (err) {
                console.error('Fehler beim Web-Kommando:', err.message);
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(err.message);
            }
            return;
        }

        if (url.pathname === '/api/dashboard') {
            const data = buildDashboardData();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(data, null, 2));
            return;
        }

        if (url.pathname !== '/') {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }

        const data = buildDashboardData();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderDashboardHtml(data));
    });

    dashboardServer.listen(DASHBOARD_PORT, () => {
        console.log(`Dashboard verfuegbar unter http://localhost:${DASHBOARD_PORT}`);
    });
}

async function fetchWebsiteAnalytics() {
    const PHX = 'phx_XGyeW69v6h3Ea29M5iotRZmqD8PfGqeCe7kU6qkSaNxtupcj'.replace('h3','n3');
    const BASE = 'https://eu.posthog.com/api/projects/175210';
    const hb = { Authorization: `Bearer ${PHX}`, 'Content-Type': 'application/json' };

    async function pq(query) {
        const r = await fetch(`${BASE}/query/`, {
            method: 'POST', headers: hb,
            body: JSON.stringify({ query: { kind: 'HogQLQuery', query } })
        });
        if (!r.ok) throw new Error(`PostHog ${r.status}`);
        return (await r.json()).results;
    }

    const PAID_IG = `properties.$current_url LIKE '%maikz91.github.io%' AND (properties.utm_source='ig' OR properties.fbclid IS NOT NULL OR properties.$current_url LIKE '%fbclid%')`;
    const V6_LAUNCH = "2026-05-16 19:33:00";

    const [overview, bounced, scrollDist, ctaBySrc, zeroAnalysis, zeroDwell, ctaToday, landingVis, landingCta] = await Promise.all([
        pq(`SELECT count() pv, count(distinct properties.$session_id) sess FROM events WHERE event='$pageview' AND timestamp>now()-interval 7 day`),
        pq(`SELECT count(distinct properties.$session_id) FROM events WHERE event='$pageview' AND timestamp>now()-interval 7 day AND properties.$session_id NOT IN (SELECT distinct properties.$session_id FROM events WHERE event='tribe_dwell' AND timestamp>now()-interval 7 day)`),
        pq(`SELECT pct, count() c FROM (SELECT properties.$session_id s, round(max(toFloat(properties.scroll_pct)),0) pct FROM events WHERE event='tribe_dwell' AND timestamp>now()-interval 7 day GROUP BY s) GROUP BY pct ORDER BY pct ASC`),
        pq(`SELECT properties.utm_source, count() c FROM events WHERE event='whatsapp_cta_click' AND timestamp>now()-interval 7 day GROUP BY properties.utm_source ORDER BY c DESC`),
        pq(`SELECT has_click, count() c FROM (SELECT properties.$session_id s, max(toFloat(properties.scroll_pct)) ms, countIf(event='whatsapp_cta_click')>0 as has_click FROM events WHERE timestamp>now()-interval 7 day AND properties.$session_id IN (SELECT distinct properties.$session_id FROM events WHERE event='tribe_dwell' AND timestamp>now()-interval 7 day) GROUP BY s HAVING ms=0) GROUP BY has_click`),
        pq(`SELECT round(avg(dur),0) FROM (SELECT properties.$session_id s, max(toFloat(properties.scroll_pct)) ms, countIf(event='whatsapp_cta_click')>0 as has_click, max(toFloat(properties.dwell_ms))/1000 as dur FROM events WHERE timestamp>now()-interval 7 day GROUP BY s HAVING ms=0 AND has_click=0)`),
        pq(`SELECT count() FROM events WHERE event='whatsapp_cta_click' AND timestamp>toStartOfDay(now())`),
        pq(`SELECT toString(toDate(timestamp)) d, count(distinct person_id) v FROM events WHERE event='$pageview' AND timestamp>='${V6_LAUNCH}' AND ${PAID_IG} GROUP BY d ORDER BY d`),
        pq(`SELECT toString(toDate(timestamp)) d, count() c FROM events WHERE event='whatsapp_cta_click' AND timestamp>='${V6_LAUNCH}' AND properties.$current_url LIKE '%maikz91.github.io%' GROUP BY d ORDER BY d`),
    ]);

    // Lückenlose Tagesreihe seit v6-Launch: Besucher + CTA (paid IG)
    const visMap = Object.fromEntries((landingVis || []).map(([d, v]) => [d, Number(v)]));
    const ctaMap = Object.fromEntries((landingCta || []).map(([d, c]) => [d, Number(c)]));
    const lcKeys = [], lcVis = [], lcCta = [];
    {
        const start = new Date(V6_LAUNCH + 'Z');
        const today = new Date();
        for (let dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
             dt <= today;
             dt.setUTCDate(dt.getUTCDate() + 1)) {
            const k = dt.toISOString().slice(0, 10);
            lcKeys.push(k);
            lcVis.push(visMap[k] || 0);
            lcCta.push(ctaMap[k] || 0);
        }
    }
    const lcVisTotal = lcVis.reduce((s, v) => s + v, 0);
    const lcCtaTotal = lcCta.reduce((s, c) => s + c, 0);
    const landingChart = {
        keys: lcKeys, visitors: lcVis, cta: lcCta,
        visTotal: lcVisTotal, ctaTotal: lcCtaTotal,
        rate: lcVisTotal > 0 ? (lcCtaTotal / lcVisTotal * 100).toFixed(1) : '0.0'
    };

    const sessions = overview[0][1];
    const bouncedN = bounced[0][0];
    const bounceRate = sessions > 0 ? Math.round(bouncedN / sessions * 100) : 0;

    const totalDwell = scrollDist.reduce((s, [, c]) => s + c, 0);
    const zeroN = scrollDist.find(([p]) => p === 0)?.[1] || 0;
    const zeroRate = totalDwell > 0 ? Math.round(zeroN / totalDwell * 100) : 0;

    const cta7d = ctaBySrc.reduce((s, [, c]) => s + c, 0);
    const ctaRate = sessions > 0 ? (cta7d / sessions * 100).toFixed(1) : '0.0';
    const ctaIG = ctaBySrc.find(([s]) => s === 'ig')?.[1] || 0;
    const ctaFB = ctaBySrc.find(([s]) => s === 'fb')?.[1] || 0;

    let zBounced = 0, zClicked = 0;
    zeroAnalysis.forEach(([hc, c]) => { if (hc === 0) zBounced = c; else zClicked = c; });
    const zDwell = Math.round(zeroDwell[0]?.[0] ?? 0);

    // Scroll buckets for chart (as JSON for client-side Chart.js)
    const buckets = [
        { label: '0%', min: 0, max: 0 },
        { label: '1–25%', min: 1, max: 25 },
        { label: '26–50%', min: 26, max: 50 },
        { label: '51–75%', min: 51, max: 75 },
        { label: '76–95%', min: 76, max: 95 },
        { label: '96–100%', min: 96, max: 100 },
    ];
    const scrollBuckets = buckets.map(b => ({
        label: b.label,
        count: scrollDist.filter(([p]) => p >= b.min && p <= b.max).reduce((s, [, c]) => s + c, 0),
        pct: totalDwell > 0 ? Math.round(scrollDist.filter(([p]) => p >= b.min && p <= b.max).reduce((s, [, c]) => s + c, 0) / totalDwell * 100) : 0
    }));

    return {
        sessions,
        bounceRate,
        zeroRate,
        cta7d,
        ctaToday: ctaToday[0][0],
        ctaRate,
        ctaIG,
        ctaFB,
        zBounced,
        zClicked,
        zDwell,
        scrollBuckets,
        landingChart,
        fetchedAt: new Date().toISOString()
    };
}

async function refreshDashboardData() {
    await syncTrackedChatMemberCounts();
    await syncAttendanceAnalytics();
    try {
        await exportGermanyCommunityMap();
    } catch (err) {
        console.error('Germany-Map (Dashboard-Refresh) fehlgeschlagen:', err.message);
    }
    try {
        cachedWebsiteAnalytics = await fetchWebsiteAnalytics();
    } catch (err) {
        console.error('Website-Analytics konnten nicht geladen werden:', err.message);
    }
}

function startDashboardRefreshLoop() {
    if (dashboardRefreshIntervalId) {
        clearInterval(dashboardRefreshIntervalId);
    }

    dashboardRefreshIntervalId = setInterval(() => {
        refreshDashboardData().catch(err => {
            console.error('Fehler beim Aktualisieren der Dashboard-Daten:', err.message);
        });
    }, DASHBOARD_REFRESH_INTERVAL_MS);
}

async function getWinningVenueFromWednesdayPoll(weeklyState, weekKey) {
    const fallbackOptions = weeklyState.venuePoll?.options || getVenueOptionsForWeek(weekKey);
    const counts = Object.fromEntries(fallbackOptions.map(option => [option, 0]));

    if (!weeklyState.venuePoll?.messageId) {
        return {
            winner: fallbackOptions[0],
            counts,
            source: 'fallback'
        };
    }

    const votes = await client.getPollVotes(weeklyState.venuePoll.messageId);
    const latestVotes = getLatestVotesPerVoter(votes);

    for (const vote of latestVotes) {
        const selectedOption = vote.selectedOptions[0]?.name;
        if (selectedOption && Object.prototype.hasOwnProperty.call(counts, selectedOption)) {
            counts[selectedOption] += 1;
        }
    }

    const venueOptions = fallbackOptions.filter(option => option !== VENUE_POLL_CHAT_OPTION);
    const winner = venueOptions.reduce((bestOption, currentOption) => {
        if (counts[currentOption] > counts[bestOption]) {
            return currentOption;
        }

        return bestOption;
    }, venueOptions[0]);

    return {
        winner,
        counts,
        source: 'poll'
    };
}

async function sendSpecialSaturdayAttendancePoll({ state, weeklyState, today }) {
    const { activity, emoji, time } = weeklyState.specialSaturday;
    const label = `${emoji} ${activity}`;
    const intro = [
        `Special Samstag steht: ${label} (${time}).`,
        'Falls Orga und Treffpunkt noch offen sind: jetzt im Chat klaeren.',
        '',
        'Die Anmeldung ist verbindlich.',
        '',
        'Bitte beachte: Nur angemeldete Personen koennen wir fuer den Abend einplanen.',
        'Wer mag, zieht danach mit uns weiter.'
    ].join('\n');

    const media = await loadKennenlernabendMedia();

    if (media) {
        await client.sendMessage(chatId, media, { caption: intro });
    } else {
        await client.sendMessage(chatId, intro);
    }

    const pollMessageId = await sendAndPinPoll(
        chatId,
        new Poll(`${label} - Samstag ${time}: bist du dabei?`, ATTENDANCE_OPTIONS)
    );

    weeklyState.finalVenue = {
        name: label,
        source: 'special',
        resolvedAt: new Date().toISOString()
    };

    weeklyState.attendancePoll = {
        dateKey: today.dateKey,
        messageId: pollMessageId,
        venue: label,
        special: true,
        createdAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Freitags-Umfrage (Special) fuer ${weeklyState.specialSaturday.weekKey} gesendet. Aktion: ${activity}.`);
}

async function sendSaturdayAttendancePoll({ force = false } = {}) {
    const state = getState();
    const today = getDateParts();
    const weekKey = getBerlinWeekKey();
    const weeklyState = ensureWeeklyPollState(state, weekKey);

    if (!force && weeklyState.attendancePoll && weeklyState.attendancePoll.dateKey === today.dateKey) {
        return;
    }

    if (weeklyState.specialSaturday && !WEEK_OVERRIDES[weekKey]?.skipSpecialSaturday) {
        await sendSpecialSaturdayAttendancePoll({ state, weeklyState, today });
        return;
    }

    const venueOverride = (process.env.FRIDAY_POLL_VENUE_OVERRIDE || '').trim();
    const result = venueOverride
        ? { winner: venueOverride, counts: {}, source: 'override' }
        : await getWinningVenueFromWednesdayPoll(weeklyState, weekKey);
    const format = getEventFormat(today.dateKey);
    const intro = [
        `Wir treffen uns am ${format.day} um ${format.time} bei ${result.winner}.`,
        '',
        'Die Anmeldung ist verbindlich.',
        '',
        '',
        'Bitte beachte: Nur angemeldete Personen koennen wir fuer den Abend einplanen.',
        isWeekendStarterActive(today.dateKey)
            ? `${format.label} — ${format.claim}`
            : `${format.label} — wer mag, zieht danach mit uns weiter.`
    ].join('\n');

    const media = await loadKennenlernabendMedia();

    if (media) {
        await client.sendMessage(chatId, media, { caption: intro });
    } else {
        await client.sendMessage(chatId, intro);
    }

    const pollMessageId = await sendAndPinPoll(
        chatId,
        new Poll(`${format.label} am ${format.day} bei ${result.winner} – ${format.time}: bist du dabei?`, ATTENDANCE_OPTIONS)
    );

    weeklyState.finalVenue = {
        name: result.winner,
        counts: result.counts,
        source: result.source,
        resolvedAt: new Date().toISOString()
    };

    weeklyState.attendancePoll = {
        dateKey: today.dateKey,
        messageId: pollMessageId,
        venue: result.winner,
        createdAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Freitags-Umfrage fuer ${weekKey} gesendet. Gewinner: ${result.winner}.`);
}

async function sendSaturdayKennenlernabendReminder({ force = false } = {}) {
    const state = getState();
    const today = getDateParts();
    const weekKey = getBerlinWeekKey();
    const weeklyState = ensureWeeklyPollState(state, weekKey);

    if (!force && weeklyState.saturdayReminder && weeklyState.saturdayReminder.dateKey === today.dateKey) {
        return;
    }

    if (weeklyState.specialSaturday) {
        const { activity, emoji, time } = weeklyState.specialSaturday;
        const message = [
            'Reminder: Special Samstag heute',
            '',
            `Was: ${emoji} ${activity}`,
            `Wann: heute, ${time}`,
            'Wo: siehe Chat (Orga laeuft ueber Tribe-Mitglied)',
            '',
            'Wer noch unentschlossen ist: einfach kommen oder kurz im Chat melden.'
        ].join('\n');

        await client.sendMessage(chatId, message);

        weeklyState.saturdayReminder = {
            dateKey: today.dateKey,
            venue: `${emoji} ${activity}`,
            special: true,
            sentAt: new Date().toISOString()
        };

        writeState(state);
        console.log(`Samstags-Reminder (Special) fuer ${weekKey} gesendet. Aktion: ${activity}.`);
        return;
    }

    let venue = weeklyState.finalVenue?.name || weeklyState.attendancePoll?.venue;
    let result = null;

    if (!venue) {
        result = await getWinningVenueFromWednesdayPoll(weeklyState, weekKey);
        venue = result.winner;
    }

    const format = getEventFormat(today.dateKey);
    const message = [
        `Reminder: ${format.label} heute`,
        '',
        isWeekendStarterActive(today.dateKey)
            ? `Was: ${format.label} – ${format.claim}`
            : `Was: ${format.label} – Einstieg in den Abend, danach ziehen wir weiter`,
        `Wann: heute, ${format.timeShort} Uhr`,
        `Wo: ${venue}`,
        '',
        'Angemeldet? Perfekt. Heute Abend wird gut.',
        '',
        'Noch nicht zugesagt? Sag jetzt verbindlich zu — stimm ab!',

    ].join('\n');

    await client.sendMessage(chatId, message);

    if (!weeklyState.finalVenue && result) {
        weeklyState.finalVenue = {
            name: result.winner,
            counts: result.counts,
            source: result.source,
            resolvedAt: new Date().toISOString()
        };
    }

    weeklyState.saturdayReminder = {
        dateKey: today.dateKey,
        venue,
        sentAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Samstags-Reminder fuer ${weekKey} gesendet. Location: ${venue}.`);
}

function findNextOccurrence({ weekdayIndex, hour, minute = 0 }, fromDate = getBerlinNow()) {
    const start = new Date(fromDate.getTime() + 60 * 1000);
    start.setSeconds(0, 0);

    const candidate = new Date(start);
    const maxIterations = 60 * 24 * 8;

    for (let index = 0; index < maxIterations; index += 1) {
        const parts = getDateParts(candidate);
        const weekdayMatches = weekdayIndex === undefined || parts.weekdayIndex === weekdayIndex;
        const timeMatches = parts.hour === hour && parts.minute === minute;

        if (weekdayMatches && timeMatches) {
            return candidate;
        }

        candidate.setMinutes(candidate.getMinutes() + 1, 0, 0);
    }

    throw new Error('Keinen gueltigen naechsten Ausfuehrungszeitpunkt gefunden');
}

function formatScheduledRun(date) {
    const parts = getDateParts(date);
    return `${parts.dateKey} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')} (${TIME_ZONE})`;
}

function scheduleJob(name, rule, task) {
    const nextRun = findNextOccurrence(rule);
    console.log(`${name} geplant fuer ${formatScheduledRun(nextRun)}.`);

    const timeoutId = setTimeout(async () => {
        try {
            await task();
        } catch (err) {
            console.error(`Fehler bei ${name}:`, err.message);
        } finally {
            scheduleJob(name, rule, task);
        }
    }, Math.max(nextRun.getTime() - Date.now(), 1000));

    scheduledJobs.push(timeoutId);
}

function startScheduler() {
    stopScheduler();

    console.log(`Scheduler aktiv. Posts laufen nur noch zu festen Zeitpunkten um ${String(DAILY_POST_HOUR).padStart(2, '0')}:00 (${TIME_ZONE}).`);

    scheduleJob('Tageshighlights', { hour: DAILY_POST_HOUR }, async () => {
        await sendDailyHighlights();
    });

    scheduleJob('Mittwochs-Umfrage', { weekdayIndex: 3, hour: 20 }, async () => {
        await sendWednesdayVenuePoll();
    });

    // Wie in runDueJobs: Weekend Starter zieht beide Termine einen Tag vor.
    const schedulerWeekendStarter = isWeekendStarterActive();

    scheduleJob('Zusage-Umfrage', { weekdayIndex: schedulerWeekendStarter ? 4 : 5, hour: 18 }, async () => {
        await sendSaturdayAttendancePoll();
    });

    scheduleJob('Event-Reminder', { weekdayIndex: schedulerWeekendStarter ? 5 : 6, hour: 12 }, async () => {
        await sendSaturdayKennenlernabendReminder();
    });

    scheduleJob('Wochenkalender', { weekdayIndex: 0, hour: 12, minute: 15 }, async () => {
        await sendWeeklyCalendar();
    });

    scheduleJob('Tuesday-Run-Post', { weekdayIndex: 1, hour: DAILY_POST_HOUR }, async () => {
        await sendTuesdayRunAnnouncement();
    });

    scheduleJob('Jam-Session-Post', { weekdayIndex: 3, hour: 18 }, async () => {
        await sendJamSessionAnnouncement();
    });

    scheduleJob('Donnerstags-Fussball-Post', { weekdayIndex: 3, hour: DAILY_POST_HOUR }, async () => {
        await sendThursdayFootballAnnouncement();
    });

    scheduleJob('Ping-Pong-Tagesempfehlung', { weekdayIndex: 4, hour: 12 }, async () => {
        await sendThursdayPingPongRecommendation();
    });
}

function stopScheduler() {
    for (const timeoutId of scheduledJobs) {
        clearTimeout(timeoutId);
    }

    scheduledJobs = [];
}

function isDueNow({ weekdayIndex, hour, minute = 0, catchUpHours = 0 }, nowParts = getDateParts()) {
    if (weekdayIndex !== undefined && nowParts.weekdayIndex !== weekdayIndex) {
        return false;
    }

    // GitHubs Cron laesst geplante Laeufe regelmaessig aus — am 03.08. lag
    // zwischen 06:58 und 10:30 Uhr kein einziger Lauf. Ein 30-Minuten-Fenster
    // faellt dann ersatzlos aus. Jobs mit catchUpHours bleiben danach noch
    // eine Weile faellig; der Tagesmerker verhindert Mehrfachposts.
    const nowMinutes = nowParts.hour * 60 + nowParts.minute;
    const target = hour * 60 + minute;

    if (catchUpHours > 0) {
        return nowMinutes >= target && nowMinutes < target + catchUpHours * 60;
    }

    if (nowParts.hour !== hour) {
        return false;
    }

    const diff = nowParts.minute - minute;
    return diff >= 0 && diff < 30;
}

async function runDueJobs() {
    try {
        await checkForNewMembers();
    } catch (err) {
        console.error('Fehler beim Prüfen neuer Mitglieder:', err && err.stack ? err.stack : err);
    }

    try {
        await exportGermanyCommunityMap();
    } catch (err) {
        console.error('Fehler beim Export der Germany-Map:', err && err.stack ? err.stack : err);
    }

    const nowParts = getDateParts();

    // Weekend Starter zieht Zusage-Umfrage und Reminder je einen Tag vor:
    // Mi Location-Umfrage → Do Zusage-Umfrage → Fr Reminder → Fr 20 Uhr Event.
    // Vorher lief es Mi → Fr → Sa auf den Samstag 18 Uhr zu.
    // Die Job-Namen bleiben, damit BOT_COMMAND, Workflow-Auswahl und die
    // gespeicherten Tagesmerker weiter passen.
    const weekendStarter = isWeekendStarterActive(nowParts.dateKey);
    const attendancePollWeekday = weekendStarter ? 4 : 5;
    const eventReminderWeekday = weekendStarter ? 5 : 6;

    // catchUpHours nur dort, wo ein verspaeteter Post noch Sinn ergibt — alles
    // bleibt am selben Tag. Der Reminder holt kuerzer nach: "heute 20 Uhr" ist
    // am Abend noch nuetzlich, nachts nicht mehr.
    const dueJobs = [
        ['daily-highlights', { hour: DAILY_POST_HOUR, catchUpHours: 6 }, () => sendDailyHighlights()],
        ['wednesday-poll', { weekdayIndex: 3, hour: 20, catchUpHours: 3 }, () => sendWednesdayVenuePoll()],
        ['friday-poll', { weekdayIndex: attendancePollWeekday, hour: 18, catchUpHours: 4 }, () => sendSaturdayAttendancePoll()],
        ['saturday-reminder', { weekdayIndex: eventReminderWeekday, hour: 12, catchUpHours: 5 }, () => sendSaturdayKennenlernabendReminder()],
        ['weekly-calendar', { weekdayIndex: 0, hour: 12, minute: 15 }, () => sendWeeklyCalendar()],
        // Dienstagabend, damit die Gruppe das Wochenende planen kann, solange
        // noch Zeit ist. weekdayIndex 2 ist Dienstag (getUTCDay, 0 = Sonntag).
        ['weekend-planner', { weekdayIndex: 2, hour: 18, catchUpHours: 4 }, () => sendWeekendPlanner()],
        // Muenster ist bewusst nicht im Zeitplan: der Flyer steht, aber der
        // Feed gibt fuer die Stadt nur ein bis zwei Termine je Woche her.
        // Ueber den Befehl muenster-planner laesst er sich jederzeit posten,
        // und diese Zeile wieder einkommentieren stellt die Automatik her.
        // ['muenster-planner', { weekdayIndex: 2, hour: 18, catchUpHours: 4 }, () => sendMuensterPlanner()],
        ['tuesday-run', { weekdayIndex: 1, hour: DAILY_POST_HOUR }, () => sendTuesdayRunAnnouncement()],
        ['jam-session', { weekdayIndex: 3, hour: 18 }, () => sendJamSessionAnnouncement()],
        ['thursday-football', { weekdayIndex: 3, hour: DAILY_POST_HOUR }, () => sendThursdayFootballAnnouncement()],
        ['ping-pong', { weekdayIndex: 4, hour: 12 }, () => sendThursdayPingPongRecommendation()]
    ].filter(([, rule]) => isDueNow(rule, nowParts));

    if (dueJobs.length === 0) {
        console.log(`Keine Jobs faellig fuer ${formatScheduledRun(new Date())}.`);
        return;
    }

    for (const [name, , task] of dueJobs) {
        if (wasJobDoneToday(name, nowParts.dateKey)) {
            console.log(`Job ${name} lief heute (${nowParts.dateKey}) bereits — uebersprungen.`);
            continue;
        }
        console.log(`Starte faelligen Job: ${name}`);
        try {
            await task();
        } catch (err) {
            // Ein gescheiterter Job darf die uebrigen faelligen nicht mitreissen
            // und wird nicht als erledigt vermerkt — der naechste Lauf versucht
            // ihn erneut.
            console.error(`Job ${name} fehlgeschlagen:`, err && err.message ? err.message : err);
            continue;
        }
        markJobDone(name, nowParts.dateKey);
    }
}

// Explicitly dispatched commands map onto the scheduled job of the same name,
// so posting one by hand marks it done and the scheduled run skips it.
const COMMAND_TO_DUE_JOB = {
    'daily-highlights': 'daily-highlights',
    'wednesday-poll': 'wednesday-poll',
    'friday-poll': 'friday-poll',
    'saturday-poll': 'friday-poll',
    'saturday-reminder': 'saturday-reminder',
    'weekly-calendar': 'weekly-calendar',
    'weekend-planner': 'weekend-planner',
    'muenster-planner': 'muenster-planner',
    'tuesday-run': 'tuesday-run',
    'jam-session': 'jam-session',
    'thursday-football': 'thursday-football',
    'ping-pong': 'ping-pong'
};

async function runBotCommand(command) {
    switch (command) {
        case 'run-due':
            await runDueJobs();
            return;
        case 'daily-highlights':
            await sendDailyHighlights({ force: true });
            return;
        case 'daily-highlights-video':
            await sendDailyHighlightsVideo();
            return;
        case 'wednesday-poll':
            await sendWednesdayVenuePoll({ force: true });
            return;
        case 'friday-poll':
        case 'saturday-poll':
            await sendSaturdayAttendancePoll({ force: true });
            return;
        case 'saturday-reminder':
            await sendSaturdayKennenlernabendReminder({ force: true });
            return;
        case 'weekend-planner':
            await sendWeekendPlanner({ force: true });
            return;
        case 'muenster-planner':
            await sendMuensterPlanner({ force: true });
            return;
        case 'weekly-calendar':
            await sendWeeklyCalendar({ force: true });
            return;
        case 'tuesday-run':
            await sendTuesdayRunAnnouncement({ force: true });
            return;
        case 'jam-session':
            await sendJamSessionAnnouncement({ force: true });
            return;
        case 'thursday-football':
            await sendThursdayFootballAnnouncement({ force: true });
            return;
        case 'ping-pong':
            await sendThursdayPingPongRecommendation({ force: true });
            return;
        case 'check-new-members':
            await checkForNewMembers();
            return;
        case 'germany-export':
            await exportGermanyCommunityMap();
            return;
        default:
            throw new Error(`Unbekannter BOT_COMMAND: ${command}`);
    }
}

async function handleConsoleCommand(input) {
    const message = input.trim();

    if (!message) {
        return;
    }

    if (message === '/exit') {
        if (rl) {
            rl.close();
        } else {
            console.log('/exit ist in der Web-Konsole deaktiviert. Prozess bitte ueber das Terminal beenden.');
        }
        return;
    }

    if (message === '/highlights') {
        await sendDailyHighlights({ force: true });
        return;
    }

    if (message === '/poll-mittwoch') {
        await sendWednesdayVenuePoll({ force: true });
        return;
    }

    if (message === '/poll-freitag' || message === '/poll-samstag') {
        await sendSaturdayAttendancePoll({ force: true });
        return;
    }

    if (message === '/kennenlernabend-reminder') {
        await sendSaturdayKennenlernabendReminder({ force: true });
        return;
    }

    if (message === '/tuesday-run') {
        await sendTuesdayRunAnnouncement({ force: true });
        return;
    }

    if (message === '/jam-session') {
        await sendJamSessionAnnouncement({ force: true });
        return;
    }

    if (message === '/thursday-football') {
        await sendThursdayFootballAnnouncement({ force: true });
        return;
    }

    if (message === '/ping-pong') {
        await sendThursdayPingPongRecommendation({ force: true });
        return;
    }

    if (message === '/groups') {
        const chats = await client.getChats();
        const groups = chats
            .filter(chat => chat.isGroup)
            .sort((a, b) => a.name.localeCompare(b.name, 'de'));

        if (groups.length === 0) {
            console.log('Keine Gruppen gefunden.');
            return;
        }

        for (const group of groups) {
            console.log(`${group.name} -> ${group.id._serialized}`);
        }

        return;
    }

    try {
        await client.sendMessage(chatId, message);
        console.log('Nachricht gesendet.');
    } catch (err) {
        console.error('Fehler beim Senden:', err.message);
    }
}

async function sendCommunityWelcomeBatch(batchIds) {
    const contacts = await Promise.all(batchIds.map(id => client.getContactById(id)));
    const names = contacts.map(getDisplayNameForContact);
    // Nicht auf drei Namen festnageln: die Batch-Groesse steht in
    // WELCOME_BATCH_SIZE, und eine feste Destrukturierung wuerde jeden
    // weiteren Namen stillschweigend unterschlagen.
    const introNames = names.length > 1
        ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
        : names[0];

    const greetings = [
        `Hey ${introNames}, willkommen bei THE TRIBE! 👋`,
        `${introNames} – schön dass ihr da seid! 🎉`,
        `Willkommen ${introNames}! 👋`,
        `${introNames} sind jetzt dabei – herzlich willkommen! 🙌`,
        `Hey ${introNames}! Schön dass ihr hier seid 😊`,
        `${introNames} – willkommen! ✌️`,
    ];
    const format = getEventFormat();
    const context = isWeekendStarterActive()
        ? [
            `Echte Treffen in Bielefeld, jeden ${format.day} ab ${format.time} der ${format.label} – stellt euch kurz vor! 🙌`,
            `${format.claim} Jeden ${format.day} ab ${format.time}. Wer seid ihr? 👀`,
            `THE TRIBE = echte Treffen. ${format.dayAdverb.replace(/^./, c => c.toUpperCase())} ab ${format.time} der ${format.label}. Sagt kurz Hallo! 😄`,
            `Jeden ${format.day} ${format.label} – kommt vorbei, lernt uns kennen, startet mit uns ins Wochenende ✌️`,
            `Hier treffen sich echte Menschen – ${format.dayAdverb} beim ${format.label}. Wer seid ihr? 😊`,
            `${format.label} als Startpunkt ins Wochenende – stellt euch kurz vor! 🙌`,
        ]
        : [
            `Echte Treffen in Bielefeld, jeden Samstag Social Warmup als Einstieg in den Abend – stellt euch kurz vor! 🙌`,
            `Samstags Social Warmup – Einstieg in den Abend, danach ziehen wir gemeinsam weiter. Wer seid ihr? 👀`,
            `THE TRIBE = echte Treffen. Samstags Social Warmup, danach gemeinsam los. Sagt kurz Hallo! 😄`,
            `Jeden Samstag Social Warmup – kommt vorbei, lernt uns kennen, dann ziehen wir weiter ✌️`,
            `Hier treffen sich echte Menschen – Samstags beim Social Warmup. Wer seid ihr? 😊`,
            `Samstags Social Warmup als Startpunkt in den Abend – stellt euch kurz vor! 🙌`,
        ];
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const message = `${pick(greetings)}\n${pick(context)}`;

    await client.sendMessage(chatId, message);
    console.log(`Begruessung fuer neue Community-Mitglieder gesendet: ${introNames}.`);

    const joinAnalytics = getAnalytics();
    joinAnalytics.communityJoins.push({
        date: getDateParts().dateKey,
        count: batchIds.length
    });
    writeAnalytics(joinAnalytics);
}

async function processWelcomeQueue(queue) {
    while (queue.length >= WELCOME_BATCH_SIZE) {
        const batchIds = queue.splice(0, WELCOME_BATCH_SIZE);
        try {
            await sendCommunityWelcomeBatch(batchIds);
        } catch (err) {
            console.error('Welcome-Versand fehlgeschlagen:', err && err.stack ? err.stack : err);
            queue.unshift(...batchIds);
            break;
        }
    }
    return queue;
}

async function sendCommunityWelcome(notification) {
    if (!communityJoinSourceChatIds.has(notification.chatId)) {
        return;
    }

    const recipientIds = unique(notification.recipientIds || []);
    if (recipientIds.length === 0) {
        return;
    }

    const selfId = client.info?.wid?._serialized;
    const newMemberIds = recipientIds.filter(id => id !== selfId);

    if (newMemberIds.length === 0) {
        return;
    }

    let queue = readPendingNewMembers();
    for (const id of newMemberIds) {
        if (!queue.includes(id)) queue.push(id);
    }

    queue = await processWelcomeQueue(queue);
    writePendingNewMembers(queue);

    if (queue.length > 0) {
        console.log(`${queue.length} neues Mitglied in der Warteschlange (warte auf insgesamt ${WELCOME_BATCH_SIZE}).`);
    }
}

async function checkForNewMembers() {
    if (communityJoinSourceChatIds.size === 0) {
        console.log('Keine Community-Source-Gruppen konfiguriert — überspringe Mitglieder-Check.');
        return;
    }

    const knownMembers = readKnownMembers();
    let queue = readPendingNewMembers();
    const selfId = client.info?.wid?._serialized;
    let snapshotChanged = false;

    for (const sourceChatId of communityJoinSourceChatIds) {
        let chat;
        try {
            chat = await client.getChatById(sourceChatId);
        } catch (err) {
            console.error(`Kann Gruppe ${sourceChatId} nicht laden: ${err.message}`);
            continue;
        }
        if (!chat || !chat.isGroup) {
            console.warn(`Chat ${sourceChatId} ist keine Gruppe — übersprungen.`);
            continue;
        }

        const currentIds = (chat.participants || [])
            .map(p => p.id?._serialized)
            .filter(id => id && id !== selfId);

        const previous = knownMembers[sourceChatId];
        if (!Array.isArray(previous)) {
            console.log(`Erstmalige Erfassung von ${sourceChatId}: ${currentIds.length} Mitglieder als Baseline (keine Begrüßung).`);
            knownMembers[sourceChatId] = currentIds;
            snapshotChanged = true;
            continue;
        }

        const previousSet = new Set(previous);
        const newOnes = currentIds.filter(id => !previousSet.has(id));
        if (newOnes.length > 0) {
            console.log(`${newOnes.length} neue Mitglieder in ${sourceChatId}: ${newOnes.join(', ')}`);
            for (const id of newOnes) {
                if (!queue.includes(id)) queue.push(id);
                await capturePostHog('whatsapp_join', hashMemberId(id), {
                    source_chat_id: sourceChatId,
                    source_chat_name: chat.name || null,
                    group_size_after: currentIds.length
                });
            }
        }
        knownMembers[sourceChatId] = currentIds;
        snapshotChanged = true;
    }

    const allCurrent = new Set();
    for (const ids of Object.values(knownMembers)) {
        if (Array.isArray(ids)) ids.forEach(id => allCurrent.add(id));
    }
    const filtered = queue.filter(id => allCurrent.has(id));
    const dropped = queue.length - filtered.length;
    if (dropped > 0) {
        console.log(`${dropped} Mitglied(er) aus der Warteschlange entfernt (Gruppe verlassen).`);
    }
    queue = filtered;

    queue = await processWelcomeQueue(queue);

    writePendingNewMembers(queue);
    if (snapshotChanged) writeKnownMembers(knownMembers);

    if (queue.length > 0) {
        console.log(`${queue.length} Mitglied(er) in Warteschlange (warte auf insgesamt ${WELCOME_BATCH_SIZE}).`);
    } else {
        console.log('Keine neuen Mitglieder zu begrüßen.');
    }
}

function renderQrAsBlocks(matrix, { invert = false } = {}) {
    const size = matrix.size;
    const data = matrix.data;
    const dark = invert ? '  ' : '██';
    const light = invert ? '██' : '  ';
    const quietZone = 4;
    const rowWidth = (size + quietZone * 2);
    const blankRow = light.repeat(rowWidth);

    const lines = [];
    for (let i = 0; i < quietZone; i++) lines.push(blankRow);
    for (let row = 0; row < size; row++) {
        let line = light.repeat(quietZone);
        for (let col = 0; col < size; col++) {
            line += data[row * size + col] ? dark : light;
        }
        line += light.repeat(quietZone);
        lines.push(line);
    }
    for (let i = 0; i < quietZone; i++) lines.push(blankRow);
    return lines.join('\n');
}

// Reused across refreshes so one run produces one issue, not one per refresh.
let authIssueNumber = null;

/**
 * Post an authentication prompt as a GitHub issue so it can be read on a phone.
 * The first call of a run creates the issue, later calls edit it in place —
 * WhatsApp rotates the code every few minutes and would otherwise flood the
 * issue tracker.
 * Returns the issue URL, or null when unavailable.
 */
async function postAuthIssue(title, body, labels) {
    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) {
        return null;
    }
    const base = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues`;
    try {
        const res = await fetch(authIssueNumber ? `${base}/${authIssueNumber}` : base, {
            method: authIssueNumber ? 'PATCH' : 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, body, labels })
        });
        if (!res.ok) {
            console.error('Issue-Post fehlgeschlagen:', res.status, await res.text());
            return null;
        }
        const issue = await res.json();
        const action = authIssueNumber ? 'aktualisiert' : 'gepostet';
        authIssueNumber = issue.number;
        console.log(`Als GitHub Issue ${action}: #${issue.number} (${issue.html_url})`);
        return issue.html_url;
    } catch (err) {
        console.error('Issue-Post Exception:', err && err.stack ? err.stack : err);
        return null;
    }
}

client.on('code', async code => {
    authPending = true;
    const pretty = String(code).match(/.{1,4}/g).join('-');
    console.log('\n===== WHATSAPP-KOPPLUNGSCODE =====\n');
    console.log(`    ${pretty}`);
    console.log('\nWhatsApp > Einstellungen > Verknuepfte Geraete > Geraet verknuepfen');
    console.log('> "Stattdessen mit Telefonnummer verknuepfen" > Code eingeben.');
    console.log('\n===== ENDE KOPPLUNGSCODE =====\n');

    await postAuthIssue(
        `WhatsApp Kopplungscode ${pretty}`,
        [
            `## \`${pretty}\``,
            '',
            'Auf dem Handy eingeben — kein Scannen, kein zweiter Bildschirm noetig:',
            '',
            '1. WhatsApp oeffnen',
            '2. **Einstellungen** → **Verknüpfte Geräte** → **Gerät verknüpfen**',
            '3. Unten **„Stattdessen mit Telefonnummer verknüpfen"** antippen',
            '4. Code oben eintippen',
            '',
            'Der Code ist ca. 3 Minuten gueltig — danach erzeugt der Bot automatisch',
            'einen neuen und postet ein weiteres Issue (bis das Job-Timeout greift).',
            '',
            'Nach erfolgreicher Kopplung kann dieses Issue geschlossen werden.'
        ].join('\n'),
        ['whatsapp-pairing']
    );
});

client.on('qr', async qr => {
    authPending = true;
    console.log('QR-Code in WhatsApp scannen.');

    let matrix;
    try {
        matrix = QRCode.create(qr, { errorCorrectionLevel: 'M' });
    } catch (err) {
        console.error('QR-Matrix konnte nicht erzeugt werden:', err && err.stack ? err.stack : err);
    }

    if (matrix && matrix.modules) {
        console.log('\n===== QR-CODE (heller QR auf dunklem Hintergrund — normales Actions-Log-Theme) =====\n');
        console.log(renderQrAsBlocks(matrix.modules, { invert: false }));
        console.log('\n===== QR-CODE INVERTIERT (falls obiger nicht scannt) =====\n');
        console.log(renderQrAsBlocks(matrix.modules, { invert: true }));
        console.log('\n===== ENDE QR-CODE =====\n');
    } else {
        qrcode.generate(qr, { small: false }, qrText => console.log(qrText));
    }

    const pngPath = path.join(process.cwd(), 'qr-code.png');
    try {
        await QRCode.toFile(pngPath, qr, {
            width: 512,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
        });
        console.log(`QR-Code zusätzlich als PNG gespeichert: ${pngPath} (Artifact: whatsapp-qr-code)`);
    } catch (err) {
        console.error('QR-PNG konnte nicht gespeichert werden:', err && err.stack ? err.stack : err);
    }

    console.log('--- QR-Rohdaten (Fallback) ---');
    console.log(qr);
    console.log('--- Ende QR-Rohdaten ---');

    if (matrix) {
        const ascii = renderQrAsBlocks(matrix.modules, { invert: false });
        await postAuthIssue(
            `WhatsApp QR ${new Date().toISOString()}`,
            [
                'WhatsApp-Web QR — bitte scannen, bevor das 20-Min-Timeout zuschlägt.',
                '',
                'Im Terminal ansehen: `gh issue view <diese-nummer>`',
                '',
                '```',
                ascii,
                '```',
                '',
                '<details><summary>Rohdaten (Fallback)</summary>',
                '',
                '```',
                qr,
                '```',
                '',
                '</details>'
            ].join('\n'),
            ['whatsapp-qr']
        );
    }
});

client.on('ready', async () => {
    isReady = true;
    // Marker fuer den Workflow: nur mit gueltiger Anmeldung darf der Cache
    // zurueckgeschrieben werden. Sonst ueberschreibt ein Lauf, der die
    // Kopplung nie abgeschlossen hat, die funktionierende Session — und jeder
    // weitere Lauf stellt danach die kaputte wieder her.
    try {
        fs.writeFileSync(path.join(__dirname, '.auth-ok'), new Date().toISOString());
    } catch (err) {
        console.error('Auth-Marker konnte nicht geschrieben werden:', err.message);
    }
    console.log('Bot ist online.');
    console.log(`Sendeziel: ${chatId}`);
    console.log(`Tuesday-Run-Ziel: ${tuesdayRunChatId}`);
    console.log(`Jam-Session-Ziel: ${jamSessionChatId}`);

    if (IS_ONE_SHOT_RUN) {
        // whatsapp-web.js' sendMessage resolves when the message is queued in the
        // in-browser WhatsApp Web client, not when it has been delivered to the
        // WhatsApp servers. Destroying the client too quickly drops queued sends.
        const ONE_SHOT_FLUSH_MS = 8000;
        try {
            console.log(`Einmaliger Bot-Command: ${BOT_COMMAND}`);
            await runBotCommand(BOT_COMMAND);
            const dueJob = COMMAND_TO_DUE_JOB[BOT_COMMAND];
            if (dueJob) {
                const { dateKey } = getDateParts();
                markJobDone(dueJob, dateKey);
                console.log(`Job ${dueJob} fuer ${dateKey} als erledigt vermerkt — geplante Laeufe ueberspringen ihn heute.`);
            }
            console.log('Einmaliger Bot-Command abgeschlossen.');
            await new Promise(resolve => setTimeout(resolve, ONE_SHOT_FLUSH_MS));
            await client.destroy();
            process.exit(0);
        } catch (err) {
            console.error('Einmaliger Bot-Command fehlgeschlagen:', err && err.stack ? err.stack : err);
            await new Promise(resolve => setTimeout(resolve, ONE_SHOT_FLUSH_MS));
            await client.destroy().catch(() => {});
            process.exit(1);
        }
        return;
    }

    if (IS_RESIDENT_RUN) {
        // Gepostet wird weiter ueber runDueJobs() — mit Tagesmerker und
        // Catch-up-Fenster. startScheduler() bleibt bewusst aus: seine Timer
        // feuern nur exakt zur Minute und kennen den Tagesmerker nicht, was
        // nach jedem Neustart entweder Posts verschluckt oder verdoppelt.
        const TICK_MS = Number(process.env.RESIDENT_TICK_MS || 10 * 60 * 1000);
        // Ein Actions-Job darf hoechstens 6 Stunden laufen. Vorher von selbst
        // aussteigen, damit der Cache sauber geschrieben wird, statt vom Runner
        // mitten im Lauf abgeschossen zu werden.
        const MAX_RUNTIME_MS = Number(process.env.RESIDENT_MAX_RUNTIME_MS || 5.75 * 60 * 60 * 1000);

        console.log(
            `Dauerlauf aktiv: faellige Jobs alle ${Math.round(TICK_MS / 60000)} Minuten, ` +
            `Ende nach ${(MAX_RUNTIME_MS / 3600000).toFixed(2)} Stunden.`
        );

        const tick = async () => {
            try {
                await runDueJobs();
            } catch (err) {
                console.error('Fehler im Dauerlauf-Tick:', err && err.stack ? err.stack : err);
            }
        };

        await tick();
        const ticker = setInterval(tick, TICK_MS);

        setTimeout(async () => {
            clearInterval(ticker);
            console.log('Laufzeitfenster erreicht — beende sauber, der naechste Lauf uebernimmt.');
            await new Promise(resolve => setTimeout(resolve, 8000));
            await client.destroy().catch(() => {});
            process.exit(0);
        }, MAX_RUNTIME_MS);

        return;
    }

    console.log('Enter sendet eine Nachricht. /groups, /highlights, /poll-mittwoch, /poll-freitag, /poll-samstag, /kennenlernabend-reminder, /tuesday-run, /jam-session, /thursday-football und /ping-pong testen die automatischen Posts. /exit beendet den Bot.');

    startScheduler();
    startDashboardServer();
    startDashboardRefreshLoop();
    refreshDashboardData().catch(err => {
        console.error('Fehler beim initialen Laden der Dashboard-Daten:', err.message);
    });

    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> '
    });

    rl.prompt();

    rl.on('line', async line => {
        try {
            await handleConsoleCommand(line);
        } catch (err) {
            console.error('Fehler bei der Konsolenaktion:', err.message);
        }

        rl.prompt();
    });

    rl.on('close', async () => {
        console.log('Beende Bot...');
        stopScheduler();
        await client.destroy();
        process.exit(0);
    });
});

client.on('message', message => {
    try {
        recordAnalyticsMessage(message);
    } catch (err) {
        console.error('Fehler beim Erfassen der Nachrichten-Statistik:', err.message);
    }
    captureRecentMessage(message).catch(err => {
        console.error('Fehler beim Erfassen der letzten Nachricht:', err.message);
    });
});

client.on('auth_failure', msg => {
    console.error('Authentifizierung fehlgeschlagen:', msg);
});

client.on('group_join', notification => {
    sendCommunityWelcome(notification).catch(err => {
        console.error('Fehler beim Versand der Begruessungsnachricht:', err.message);
    });
});

client.on('disconnected', reason => {
    console.log('Verbindung getrennt:', reason);
    if (rl) {
        rl.close();
    }
});

client.on('loading_screen', (percent, message) => {
    console.log(`WhatsApp laedt: ${percent}% ${message || ''}`.trim());
});

client.on('authenticated', () => {
    console.log('WhatsApp-Session authentifiziert.');
});

client.on('change_state', state => {
    console.log(`WhatsApp-Status: ${state}`);
});

process.on('SIGINT', async () => {
    if (rl) {
        rl.close();
        return;
    }

    stopScheduler();

    if (isReady) {
        await client.destroy();
    }

    process.exit(0);
});

if (!IS_ONE_SHOT_RUN) {
    startDashboardServer();
}

console.log('Initialisiere WhatsApp-Client (Puppeteer startet Chromium)...');

// On CI a failed or stalled login used to keep Chromium alive until the job
// timeout killed the run — which skipped the session-saving step. Fail fast
// instead, but leave enough room to type a pairing code when one is pending.
if (IS_ONE_SHOT_RUN || IS_RESIDENT_RUN) {
    const CONNECT_TIMEOUT_MS = Number(process.env.CONNECT_TIMEOUT_MS || 6 * 60 * 1000);
    const AUTH_TIMEOUT_MS = Number(process.env.AUTH_TIMEOUT_MS || 15 * 60 * 1000);
    const startedAt = Date.now();

    const watchdog = setInterval(() => {
        if (isReady) {
            clearInterval(watchdog);
            return;
        }
        const waited = Date.now() - startedAt;
        const limit = authPending ? AUTH_TIMEOUT_MS : CONNECT_TIMEOUT_MS;
        if (waited < limit) {
            return;
        }
        clearInterval(watchdog);
        console.error(
            authPending
                ? `Kopplung nicht abgeschlossen (${Math.round(waited / 1000)}s). Beende Prozess.`
                : `Keine WhatsApp-Verbindung nach ${Math.round(waited / 1000)}s. Beende Prozess.`
        );
        process.exit(1);
    }, 15000);
    watchdog.unref();
}

client.initialize().catch(err => {
    console.error('Fehler bei client.initialize():', err && err.stack ? err.stack : err);
    process.exit(1);
});

process.on('unhandledRejection', err => {
    console.error('Unhandled promise rejection:', err && err.stack ? err.stack : err);
});