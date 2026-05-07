const fs = require('fs');
const http = require('http');
const path = require('path');
const { Client, LocalAuth, Poll, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const readline = require('readline');

const EVENTS_URL = 'https://raw.githubusercontent.com/MaikZ91/productiontools/master/events.json';
const STATE_FILE = path.join(__dirname, '.daily-highlights-state.json');
const ANALYTICS_FILE = path.join(__dirname, '.community-dashboard.json');
const TIME_ZONE = 'Europe/Berlin';
const DAILY_POST_HOUR = 9;
const MAX_HIGHLIGHTS = 3;
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
    'Capvin'
];
const VENUE_POLL_WEEKLY_COUNT = 3;
const VENUE_POLL_CHAT_OPTION = "Eigener Vorschlag - schreib's in den Chat";
const VENUE_POLL_OPENERS = [
    'Sonntag, 18 Uhr - Tribe trifft sich offline.',
    'Neue Woche, neuer Sonntag, neue Location.',
    'Bielefeld-Sonntag ohne Plan? Hier ist einer.',
    'Sonntag, 18 Uhr - Tisch, Drink, neue Gesichter.',
    'Mittwoch heisst: wo treffen wir uns Sonntag?',
    'Diese Woche wieder Tribe-Sonntag - 18 Uhr, offline, echt.',
    'Sonntag-Plan steht: 18 Uhr, Tribe-Tisch.'
];
const SPECIAL_SUNDAY_OPENERS = [
    'Letzter Sonntag im Monat - Zeit fuer was anderes.',
    'Special-Sonntag steht an - keine Kneipe, was Neues.',
    'Ein Mal im Monat raus aus dem Tisch-Modus.',
    'Special-Sonntag - wir machen gemeinsam was abseits der Bar.'
];
const SPECIAL_SUNDAY_ACTIVITIES = [
    { name: 'Spielsonntag',  emoji: '🎲', time: '18 Uhr',                blurb: 'Brettspiele, Karten, Wuerfel - bringt mit was ihr habt oder Cafe mit Spielregal.' },
    { name: 'Walk + Bar',    emoji: '🚶', time: '17 Uhr (Sommer 18 Uhr)', blurb: 'Spaziergang Altstadt oder Sparrenburg, danach gemeinsam einkehren.' },
    { name: 'Kochen',        emoji: '🍝', time: '17 Uhr',                blurb: 'Gemeinsam kochen beim Host - wer hat Platz und Bock?' },
    { name: 'Sofa-Konzert',  emoji: '🎸', time: '19 Uhr',                blurb: 'Akustik im Wohnzimmer. Spieler bringt Instrument, Hoerer bringt Wein.' },
    { name: 'Wandern',       emoji: '🥾', time: '11 Uhr (Tagestour)',    blurb: 'Teutoburger Wald, Hermannshoehen oder Senne. Route klaert die Orga im Chat.' },
    { name: 'Jam Session',   emoji: '🎶', time: '18 Uhr',                blurb: 'Instrumente mitbringen, zusammen klimpern. Singen, Trommeln, Loops - alles erlaubt.' },
    { name: 'Foto-Walk',     emoji: '📷', time: '17 Uhr (zum Sunset)',   blurb: 'Kamera oder Handy reicht. Spaziergang durch die Stadt, Bilder spaeter im Chat teilen.' }
];
const SPECIAL_SUNDAY_POLL_OPTIONS = [
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
const DAILY_HIGHLIGHTS_IMAGE_DIR = path.join(IMAGES_DIR, 'daily-highlights');

const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_USER_ID = process.env.IG_USER_ID;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const BOT_COMMAND = (process.env.BOT_COMMAND || process.argv.find(arg => arg.startsWith('--bot-command='))?.split('=')[1] || '').trim();
const IS_ONE_SHOT_RUN = BOT_COMMAND.length > 0;

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const client = new Client({
    authStrategy: new LocalAuth(),
    authTimeoutMs: 120000,
    puppeteer: {
        headless: true,
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
let scheduledJobs = [];
let dashboardServer;
let dashboardRefreshIntervalId;
let cachedWebsiteAnalytics = null;
let pendingNewMembers = [];
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

function getOpenerForWeek(weekKey) {
    return VENUE_POLL_OPENERS[getWeekNumber(weekKey) % VENUE_POLL_OPENERS.length];
}

function getUpcomingSundayUtcDate(weekKey) {
    const [year, month, day] = weekKey.split('-').map(Number);
    const mondayUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
    return new Date(mondayUtc + 6 * 24 * 60 * 60 * 1000);
}

function isLastSundayOfMonth(weekKey) {
    const sundayDate = getUpcomingSundayUtcDate(weekKey);
    const nextSundayDate = new Date(sundayDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    return sundayDate.getUTCMonth() !== nextSundayDate.getUTCMonth();
}

function getSundayMonthIndex(weekKey) {
    const sundayDate = getUpcomingSundayUtcDate(weekKey);
    return sundayDate.getUTCFullYear() * 12 + sundayDate.getUTCMonth();
}

function getSpecialSundayActivity(weekKey) {
    return SPECIAL_SUNDAY_ACTIVITIES[getSundayMonthIndex(weekKey) % SPECIAL_SUNDAY_ACTIVITIES.length];
}

function getSpecialSundayOpener(weekKey) {
    return SPECIAL_SUNDAY_OPENERS[getSundayMonthIndex(weekKey) % SPECIAL_SUNDAY_OPENERS.length];
}

function rotateArray(values, shift) {
    const normalizedShift = ((shift % values.length) + values.length) % values.length;
    return values.slice(normalizedShift).concat(values.slice(0, normalizedShift));
}

function getVenueOptionsForWeek(weekKey) {
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
    return path.join(DAILY_HIGHLIGHTS_IMAGE_DIR, `bielefeld-tageshighlights-${dateKey}.png`);
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

    const cards = displayHighlights.map((entry, index) => {
        const style = getCategoryStyle(entry.category, index);
        const time = entry.time ? `${escapeHtml(entry.time)} Uhr` : 'Heute';
        const title = escapeHtml(entry.event || 'Event');
        const category = escapeHtml(style.label);
        const url = entry.link
            ? escapeHtml(String(entry.link).replace(/^https?:\/\//, '').replace(/\/$/, ''))
            : 'liebefeld.lovable.app';
        const imageUrl = entry.image_url ? escapeHtml(String(entry.image_url)) : null;
        const eventDateStyle = imageUrl
            ? ` style="background-image: url('${imageUrl}');"`
            : '';
        const overlayDiv = imageUrl ? '<div class="event-date-overlay"></div>' : '';

        return `
            <article class="event-card" style="--accent: ${style.accent}; --badge-bg: ${style.background};">
                <div class="event-date"${eventDateStyle}>
                    ${overlayDiv}
                    <span>${time}</span>
                </div>
                <div class="event-body">
                    <div class="event-topline">
                        <span class="badge">${category}</span>
                        <span class="count">0${index + 1}</span>
                    </div>
                    <h2>${title}</h2>
                    <div class="event-meta">
                        <span>Bielefeld</span>
                        <span>${url}</span>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    const emptyState = `
        <article class="event-card empty">
            <div class="event-body">
                <div class="event-topline">
                    <span class="badge">Heute</span>
                    <span class="count">01</span>
                </div>
                <h2>Heute sind noch keine Highlights eingetragen.</h2>
                <div class="event-meta">
                    <span>Bielefeld</span>
                    <span>liebefeld.lovable.app</span>
                </div>
            </div>
        </article>
    `;

    return `<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            width: 1080px;
            min-height: 1350px;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background:
                radial-gradient(circle at 20% 0%, rgba(255, 255, 255, 0.95), transparent 28%),
                linear-gradient(145deg, #fff7ed 0%, #ffffff 45%, #ecfeff 100%);
            color: #111827;
        }

        .poster {
            width: 1080px;
            min-height: 1350px;
            padding: 66px 58px 54px;
            display: flex;
            flex-direction: column;
            gap: 34px;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 30px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 14px;
            font-weight: 850;
            font-size: 34px;
            letter-spacing: 0;
        }

        .brand-mark {
            width: 48px;
            height: 48px;
            border-radius: 8px;
            background: #111827;
            color: #ffffff;
            display: grid;
            place-items: center;
            font-size: 26px;
            line-height: 1;
        }

        .date {
            text-align: right;
            font-size: 24px;
            line-height: 1.2;
            color: #4b5563;
            font-weight: 750;
        }

        h1 {
            margin: 6px 0 2px;
            max-width: 800px;
            font-size: 84px;
            line-height: 0.98;
            letter-spacing: 0;
            font-weight: 900;
        }

        .subtitle {
            margin: 0;
            max-width: 790px;
            color: #4b5563;
            font-size: 30px;
            line-height: 1.28;
            font-weight: 620;
        }

        .events {
            display: flex;
            flex-direction: column;
            gap: 22px;
            margin-top: 6px;
        }

        .event-card {
            min-height: 218px;
            display: grid;
            grid-template-columns: 220px 1fr;
            overflow: hidden;
            border: 2px solid rgba(17, 24, 39, 0.08);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.92);
            box-shadow: 0 24px 54px rgba(15, 23, 42, 0.12);
        }

        .event-card.empty {
            grid-template-columns: 1fr;
        }

        .event-date {
            position: relative;
            background: var(--accent);
            background-size: cover;
            background-position: center;
            color: #ffffff;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 28px 18px;
            font-size: 34px;
            line-height: 1.05;
            font-weight: 900;
            text-align: center;
            overflow: hidden;
        }

        .event-date-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(
                to bottom,
                rgba(0, 0, 0, 0.08) 0%,
                var(--accent) 85%
            );
            opacity: 0.82;
        }

        .event-date span {
            position: relative;
            z-index: 1;
            text-shadow: 0 1px 6px rgba(0,0,0,0.5);
        }

        .event-body {
            padding: 28px 30px 30px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 18px;
        }

        .event-topline,
        .event-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 22px;
        }

        .badge {
            max-width: 470px;
            padding: 9px 14px;
            border-radius: 8px;
            background: var(--badge-bg, #f3f4f6);
            color: var(--accent, #111827);
            font-size: 20px;
            line-height: 1;
            font-weight: 850;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .count {
            color: #d1d5db;
            font-size: 24px;
            font-weight: 900;
        }

        h2 {
            margin: 0;
            font-size: 43px;
            line-height: 1.08;
            letter-spacing: 0;
            font-weight: 900;
        }

        .event-meta {
            color: #6b7280;
            font-size: 22px;
            line-height: 1.2;
            font-weight: 700;
        }

        .event-meta span:last-child {
            max-width: 430px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: right;
        }

        footer {
            margin-top: auto;
            padding-top: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 30px;
            color: #374151;
            font-size: 25px;
            line-height: 1.25;
            font-weight: 760;
        }

        .app-link {
            padding: 14px 18px;
            border-radius: 8px;
            background: #111827;
            color: #ffffff;
            font-weight: 850;
            white-space: nowrap;
        }
    </style>
</head>
<body>
    <main class="poster">
        <header>
            <div class="brand">
                <div class="brand-mark">L</div>
                <span>Liebefeld</span>
            </div>
            <div class="date">${escapeHtml(day)}.${escapeHtml(month)}.${escapeHtml(year)}</div>
        </header>

        <section>
            <h1>Bielefeld Tageshighlights</h1>
            <p class="subtitle">Unsere Auswahl fuer heute. Stimme gleich in der Umfrage ab, wo du dabei bist.</p>
        </section>

        <section class="events">
            ${cards || emptyState}
        </section>

        <footer>
            <span>Mehr Events fuer #Liebefeld</span>
            <span class="app-link">liebefeld.lovable.app</span>
        </footer>
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

async function renderDailyHighlightsImage(highlights, date = getBerlinNow()) {
    fs.mkdirSync(DAILY_HIGHLIGHTS_IMAGE_DIR, { recursive: true });

    const outputPath = getDailyHighlightImagePath(date);
    const browser = await getPuppeteerBrowser();
    const shouldCloseBrowser = browser !== client.pupBrowser && (!client.pupPage || browser !== client.pupPage.browser());
    const page = await browser.newPage();

    try {
        await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
        await page.setContent(getDailyHighlightsImageHtml(highlights, date), { waitUntil: 'networkidle0' });
        await page.screenshot({ path: outputPath, type: 'png', fullPage: false });
    } finally {
        await page.close().catch(() => {});
        if (shouldCloseBrowser) {
            await browser.close().catch(() => {});
        }
    }

    return outputPath;
}

async function sendDailyHighlightsImage(highlights, date = getBerlinNow()) {
    try {
        const imagePath = await renderDailyHighlightsImage(highlights, date);
        const media = MessageMedia.fromFilePath(imagePath);
        await client.sendMessage(announcementChatId, media);
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

const WEEKLY_CALENDAR_POLL_OPTIONS = [
    'Tuesday Run (Di 17:00)',
    'Fussball (Do 17:00)',
    'Creative Circle (Do 18:00)',
    'Ping Pong (Do 18:00)',
    'Kennenlernabend (So 18:00)',
];

function buildWeeklyCalendarMessage(date = getBerlinNow()) {
    const tuesday  = getUpcomingWeekdayDate(2, date);
    const thursday = getUpcomingWeekdayDate(4, date);
    const sunday   = getUpcomingWeekdayDate(0, date);

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
        formatGermanDateFromUtcDate(sunday),
        '18:00 Uhr – Kennenlernabend | Location folgt Freitagabend',
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
        new Poll('Welche Tribe Events besuche ich diese Woche?', WEEKLY_CALENDAR_POLL_OPTIONS)
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
    const configuredImagePath = process.env.TRIBE_KENNENLERNABEND_IMAGE_PATH || KENNENLERNABEND_DEFAULT_IMAGE_PATH;
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
    const EXCLUDED_CATEGORIES = new Set(['sport', 'sonstiges', 'kino', 'ausgehen']);
    const { weekdayIndex } = today;
    const isSaturday = weekdayIndex === 6;
    const WEEKDAY_PREFIXES = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];
    const todayPrefix = WEEKDAY_PREFIXES[weekdayIndex];
    const weekdayPrefixPattern = /^\s*(MO|DI|MI|DO|FR|SA|SO)\s*[•·]/i;
    const filtered = highlights.filter(h => {
        const cat = normalizeCategory(h.category).toLowerCase();
        if (EXCLUDED_CATEGORIES.has(cat)) return false;
        const name = h.event || '';
        // Wiederkehrende Serien mit Wochentags-Präfix (z. B. "FR • Cafe Europa")
        // nur am passenden Wochentag zeigen
        const prefixMatch = name.match(weekdayPrefixPattern);
        if (prefixMatch && prefixMatch[1].toUpperCase() !== todayPrefix) return false;
        if (isSaturday) {
            // Wiederkehrende Club-Events samstags nicht zeigen
            if (/cutie/i.test(name)) return false;
            if (/liv\/hinterzimmer/i.test(name)) return false;
        }
        return true;
    });

    const tribeEntry = {
        event: 'THE TRIBE Kennenlernabend',
        time: '18:00',
        category: 'THE TRIBE',
        link: ''
    };
    const pingPongEntry = {
        event: 'Ping Pong im Nr.z.P.',
        time: '18:00',
        category: 'THE TRIBE',
        link: ''
    };
    const pubQuizEntry = {
        event: 'Pub Quiz (@irish_pub_bielefeld)',
        time: '20:00',
        category: 'Ausgehen',
        link: 'https://www.irishpub-bielefeld.de/'
    };
    const isMonday = weekdayIndex === 1;
    const isThursday = weekdayIndex === 4;
    const isSunday = weekdayIndex === 0;
    const fixedEntries = [
        ...(isMonday ? [pubQuizEntry] : []),
        ...(isThursday ? [pingPongEntry] : []),
        ...(isSunday ? [tribeEntry] : [])
    ];
    const fixedNames = new Set(fixedEntries.map(e => e.event));
    const withTribe = [...fixedEntries, ...filtered.filter(h => !fixedNames.has(h.event))];

    const { day, month, year } = today;
    const pollQuestion = `Bielefeld Tageshighlights fuer ${day}.${month}.${year} – Wer ist heute dabei?`;

    const pollOptions = [
        ...withTribe.slice(0, MAX_HIGHLIGHTS).map(h => {
            const time = h.time ? `${h.time} Uhr` : 'Ohne Uhrzeit';
            const link = h.link ? ` ${h.link}` : '';
            return `${time} - ${h.event}${link}`.slice(0, 100);
        }),
        'Mehr Events für #Liebefeld: https://liebefeld.lovable.app/'
    ];

    const imagePath = await sendDailyHighlightsImage(withTribe.slice(0, MAX_HIGHLIGHTS), now);

    if (imagePath) {
        sendDailyHighlightsInstagramStory(imagePath);
    }

    await client.sendMessage(
        announcementChatId,
        new Poll(pollQuestion, pollOptions)
    );

    state.lastPostedDate = todayKey;
    state.lastPostedAt = new Date().toISOString();
    writeState(state);

    console.log(`Tageshighlights fuer ${todayKey} gesendet.`);
}

async function sendSpecialSundayAnnouncement({ state, weeklyState, weekKey, today }) {
    const activity = getSpecialSundayActivity(weekKey);
    const intro = [
        getSpecialSundayOpener(weekKey),
        '',
        '🎉 Letzter Sonntag im Monat = SPECIAL SONNTAG.',
        '',
        `Diese Mal: ${activity.emoji} ${activity.name} (${activity.time})`,
        activity.blurb,
        '',
        '⚠️ Special Sonntag heisst: jemand aus der Tribe uebernimmt die Orga.',
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

    const pollMessage = await client.sendMessage(
        chatId,
        new Poll(`Special Sonntag: ${activity.emoji} ${activity.name}`, SPECIAL_SUNDAY_POLL_OPTIONS)
    );
    await pollMessage.pin(604800);

    weeklyState.specialSunday = {
        dateKey: today.dateKey,
        weekKey,
        activity: activity.name,
        emoji: activity.emoji,
        time: activity.time,
        messageId: pollMessage.id._serialized,
        createdAt: new Date().toISOString()
    };

    weeklyState.venuePoll = {
        dateKey: today.dateKey,
        weekKey,
        messageId: pollMessage.id._serialized,
        options: SPECIAL_SUNDAY_POLL_OPTIONS,
        special: true,
        createdAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Special-Sonntag-Post fuer ${weekKey} gesendet. Aktion: ${activity.name}.`);
}

async function sendWednesdayVenuePoll({ force = false } = {}) {
    const state = getState();
    const today = getDateParts();
    const weekKey = getBerlinWeekKey();
    const weeklyState = ensureWeeklyPollState(state, weekKey);

    if (!force && weeklyState.venuePoll && weeklyState.venuePoll.dateKey === today.dateKey) {
        return;
    }

    if (isLastSundayOfMonth(weekKey)) {
        await sendSpecialSundayAnnouncement({ state, weeklyState, weekKey, today });
        return;
    }

    const venues = getVenueOptionsForWeek(weekKey);
    const options = [...venues, VENUE_POLL_CHAT_OPTION];
    const intro = [
        getOpenerForWeek(weekKey),
        '',
        'Egal ob neu hier oder Tribe-Stammgast: einfach kommen, hinsetzen, mitreden – oder zuhoeren. Kein Programm, kein Ablauf.',
        '',
        'Drei Locations zur Auswahl:',
        ...venues.map(venue => `👉 ${venue}`),
        '',
        'Bis Freitag 18 Uhr abstimmen. Eigene Idee? Ab in den Chat.'
    ].join('\n');

    const media = await loadKennenlernabendMedia();

    if (media) {
        await client.sendMessage(chatId, media, { caption: intro });
    } else {
        await client.sendMessage(chatId, intro);
    }

    const pollMessage = await client.sendMessage(
        chatId,
        new Poll('Location fuer den Kennenlernabend am Sonntag?', options)
    );
    await pollMessage.pin(604800);

    weeklyState.venuePoll = {
        dateKey: today.dateKey,
        weekKey,
        messageId: pollMessage.id._serialized,
        options,
        createdAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Mittwochs-Umfrage fuer ${weekKey} gesendet.`);
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
    <style>
        :root {
            --bg: #f4efe7;
            --panel: rgba(255, 252, 247, 0.78);
            --panel-strong: #fffaf2;
            --ink: #11212d;
            --muted: #5f6b73;
            --accent: #ff7a18;
            --accent-2: #00c2a8;
            --accent-3: #1e3a5f;
            --line: rgba(17, 33, 45, 0.08);
            --shadow: 0 20px 60px rgba(17, 33, 45, 0.12);
        }

        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: Georgia, "Times New Roman", serif;
            color: var(--ink);
            background:
                radial-gradient(circle at top left, rgba(255, 122, 24, 0.25), transparent 28%),
                radial-gradient(circle at top right, rgba(0, 194, 168, 0.16), transparent 24%),
                linear-gradient(135deg, #f4efe7 0%, #ece4d7 100%);
        }

        .shell {
            max-width: 1240px;
            margin: 0 auto;
            padding: 32px 20px 48px;
        }

        .hero {
            padding: 28px;
            border-radius: 28px;
            background: linear-gradient(140deg, rgba(17, 33, 45, 0.96), rgba(30, 58, 95, 0.92));
            color: #fff7ed;
            box-shadow: var(--shadow);
        }

        .eyebrow {
            font-size: 12px;
            letter-spacing: 0.24em;
            text-transform: uppercase;
            color: rgba(255, 247, 237, 0.7);
        }

        h1 {
            margin: 12px 0 8px;
            font-size: clamp(2rem, 5vw, 4rem);
            line-height: 0.95;
        }

        .hero p {
            max-width: 720px;
            margin: 0;
            color: rgba(255, 247, 237, 0.82);
            font-size: 1.05rem;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 18px;
            margin-top: 22px;
        }

        .card {
            grid-column: span 3;
            background: var(--panel);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255,255,255,0.5);
            border-radius: 24px;
            padding: 20px;
            box-shadow: var(--shadow);
        }

        .card.wide { grid-column: span 6; }
        .card.full { grid-column: 1 / -1; }

        .label {
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            color: var(--muted);
        }

        .value {
            margin-top: 10px;
            font-size: clamp(2rem, 4vw, 3rem);
            font-weight: 700;
        }

        .subtle {
            margin-top: 6px;
            color: var(--muted);
            font-size: 0.95rem;
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
            font-size: 0.78rem;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-family: "Segoe UI", sans-serif;
        }

        th, td {
            text-align: left;
            padding: 12px 10px;
            border-bottom: 1px solid var(--line);
        }

        th {
            color: var(--muted);
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
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
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(255,255,255,0.12);
            color: #fff7ed;
            font-family: "Segoe UI", sans-serif;
            font-size: 0.9rem;
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
            border: 0;
            border-radius: 8px;
            background: #11212d;
            color: #fff7ed;
            cursor: pointer;
            font: 600 0.9rem "Segoe UI", sans-serif;
            min-height: 38px;
            padding: 9px 10px;
        }

        .command-button:hover,
        .send-button:hover {
            background: #1e3a5f;
        }

        .console-form {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
            margin-top: 12px;
        }

        .console-input {
            min-width: 0;
            border: 1px solid var(--line);
            border-radius: 8px;
            background: rgba(255,255,255,0.75);
            color: var(--ink);
            font: 0.95rem Consolas, "Courier New", monospace;
            min-height: 40px;
            padding: 10px 12px;
        }

        .log-box {
            height: min(68vh, 760px);
            min-height: 560px;
            overflow: auto;
            border-radius: 8px;
            background: #101820;
            color: #dbe7ef;
            font: 0.74rem/1.05 Consolas, "Courier New", monospace;
            padding: 12px;
            white-space: pre;
        }

        .log-line {
            border-bottom: 1px solid rgba(255,255,255,0.06);
            padding: 4px 0;
        }

        .log-line.error { color: #ffb4a8; }
        .log-line.warn { color: #ffe1a8; }

        .msg-list {
            list-style: none;
            margin: 12px 0 0;
            padding: 0;
            max-height: 420px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .msg-item {
            background: rgba(17, 33, 45, 0.04);
            border: 1px solid rgba(17, 33, 45, 0.08);
            border-radius: 12px;
            padding: 10px 14px;
        }
        .msg-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: baseline;
            font-size: 0.78rem;
            color: var(--muted);
            margin-bottom: 4px;
        }
        .msg-author { color: var(--ink); font-weight: 600; }
        .msg-chat {
            background: rgba(255, 122, 24, 0.12);
            color: var(--accent);
            padding: 1px 8px;
            border-radius: 999px;
            font-size: 0.72rem;
        }
        .msg-time { margin-left: auto; }
        .msg-body {
            font-size: 0.92rem;
            color: var(--ink);
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .msg-empty {
            color: var(--muted);
            font-size: 0.88rem;
            padding: 8px 0;
        }

        .status-dot {
            display: inline-block;
            width: 9px;
            height: 9px;
            border-radius: 999px;
            margin-right: 8px;
            background: ${isReady ? '#22c55e' : '#f59e0b'};
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

            <article class="card full" style="background: linear-gradient(140deg,rgba(17,33,45,0.05),rgba(255,122,24,0.04)); border-top: 3px solid var(--accent);">
                <div class="label" style="color: var(--accent); font-size:0.85rem;">🌐 Website Analytics · the-tribe.lovable.app</div>
                <div style="margin-top:4px; font-size:0.8rem; color:var(--muted);">
                    ${data.website.fetchedAt ? `Zuletzt geladen: ${escapeHtml(new Date(data.website.fetchedAt).toLocaleString('de-DE', { timeZone: TIME_ZONE }))}` : 'Noch nicht geladen'}
                </div>
            </article>

            <article class="card">
                <div class="label">CTA-Klicks Heute</div>
                <div class="value" style="color:var(--accent);">${data.website.ctaToday}</div>
                <div class="subtle">Klicks auf Call-to-Action</div>
            </article>
            <article class="card">
                <div class="label">CTA-Klicks 7 Tage</div>
                <div class="value" style="color:var(--accent);">${data.website.cta7d}</div>
                <div class="subtle">Letzte 7 Tage</div>
            </article>
            <article class="card">
                <div class="label">CTA-Klicks 30 Tage</div>
                <div class="value">${data.website.cta30d}</div>
                <div class="subtle">Letzte 30 Tage</div>
            </article>
            <article class="card">
                <div class="label">Conversion Rate 7d</div>
                <div class="value" style="color:var(--accent-2);">${data.website.conversionRate7d}%</div>
                <div class="subtle">${data.website.totalSessions} Sessions gesamt</div>
            </article>

            <article class="card wide">
                <div class="label">CTA-Klicks Verlauf 7 Tage</div>
                <div class="value">${data.website.cta7d}</div>
                ${renderSparkline(data.website.ctaDailySeries, '#ff7a18', 'rgba(255,122,24,0.18)')}
                <div class="axis">${data.website.ctaDailyLabels.map(l => `<span>${escapeHtml(l)}</span>`).join('')}</div>
            </article>

            <article class="card wide">
                <div class="label">CTA-Klicks nach Label</div>
                <table>
                    <thead><tr><th>Label</th><th>Klicks (7d)</th></tr></thead>
                    <tbody>
                        ${data.website.ctaByLabel.length
                            ? data.website.ctaByLabel.map(r => `<tr><td>${escapeHtml(r.label)}</td><td>${r.count}</td></tr>`).join('')
                            : '<tr><td colspan="2">Keine Daten</td></tr>'
                        }
                    </tbody>
                </table>
            </article>

            <article class="card">
                <div class="label">Geräte (7d)</div>
                <div style="margin-top:14px; display:flex; flex-direction:column; gap:10px;">
                    ${['mobile','tablet','desktop'].map(d => `
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="font-size:0.9rem;text-transform:capitalize;">${d}</span>
                            <strong>${data.website.deviceSplit[d]}</strong>
                        </div>
                    `).join('')}
                </div>
            </article>

            <article class="card" style="grid-column: span 3;">
                <div class="label">Top Referrer (7d)</div>
                <table>
                    <thead><tr><th>Quelle</th><th>Sessions</th></tr></thead>
                    <tbody>
                        ${data.website.topReferrers.length
                            ? data.website.topReferrers.map(r => `<tr><td>${escapeHtml(r.referrer)}</td><td>${r.count}</td></tr>`).join('')
                            : '<tr><td colspan="2">Keine Daten</td></tr>'
                        }
                    </tbody>
                </table>
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
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('SUPABASE_URL oder SUPABASE_ANON_KEY nicht gesetzt');
    }

    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    };
    const sb = (path) => fetch(`${SUPABASE_URL}${path}`, { headers });
    const now = getBerlinNow();
    const { dateKey } = getDateParts(now);
    const todayStartMs = new Date(dateKey + 'T00:00:00Z').getTime();
    const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [ctaRes, sessRes] = await Promise.all([
        sb(`/analytics_events?type=eq.cta_click&created_at=gte.${ago30d}&select=value_text,created_at&limit=1000`),
        sb(`/analytics_sessions?started_at=gte.${ago7d}&select=cta_clicks,referrer,device&limit=1000`)
    ]);

    const ctaEvents = await ctaRes.json();
    const sessions = await sessRes.json();

    const ago7dMs = new Date(ago7d).getTime();
    let ctaToday = 0, cta7d = 0, cta30d = 0;
    const ctaByLabel = {};
    const ctaByDay = {};

    for (const ev of Array.isArray(ctaEvents) ? ctaEvents : []) {
        const ts = new Date(ev.created_at).getTime();
        cta30d++;
        if (ts >= ago7dMs) {
            cta7d++;
            if (ts >= todayStartMs) ctaToday++;
            const label = ev.value_text || 'unknown';
            ctaByLabel[label] = (ctaByLabel[label] || 0) + 1;
            const dayKey = formatUtcDateKey(new Date(ev.created_at));
            ctaByDay[dayKey] = (ctaByDay[dayKey] || 0) + 1;
        }
    }

    const ctaDailyLabels = [];
    const ctaDailySeries = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = formatUtcDateKey(d);
        ctaDailyLabels.push(key.slice(5));
        ctaDailySeries.push(ctaByDay[key] || 0);
    }

    const totalSessions = Array.isArray(sessions) ? sessions.length : 0;
    const convertedSessions = Array.isArray(sessions) ? sessions.filter(s => (s.cta_clicks || 0) > 0).length : 0;
    const conversionRate7d = totalSessions > 0 ? Math.round((convertedSessions / totalSessions) * 100) : 0;

    const deviceSplit = { mobile: 0, tablet: 0, desktop: 0 };
    const referrerCount = {};
    for (const s of Array.isArray(sessions) ? sessions : []) {
        const d = s.device || 'desktop';
        if (d in deviceSplit) deviceSplit[d]++;
        const ref = (s.referrer || '').replace(/^https?:\/\//, '').split('/')[0] || 'Direkt';
        referrerCount[ref] = (referrerCount[ref] || 0) + 1;
    }

    return {
        ctaToday,
        cta7d,
        cta30d,
        conversionRate7d,
        totalSessions,
        ctaByLabel: Object.entries(ctaByLabel).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
        ctaDailySeries,
        ctaDailyLabels,
        topReferrers: Object.entries(referrerCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([referrer, count]) => ({ referrer, count })),
        deviceSplit,
        fetchedAt: new Date().toISOString()
    };
}

async function refreshDashboardData() {
    await syncTrackedChatMemberCounts();
    await syncAttendanceAnalytics();
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

async function sendSpecialSundayAttendancePoll({ state, weeklyState, today }) {
    const { activity, emoji, time } = weeklyState.specialSunday;
    const label = `${emoji} ${activity}`;
    const intro = [
        `Special Sonntag steht: ${label} (${time}).`,
        'Falls Orga und Treffpunkt noch offen sind: jetzt im Chat klaeren.',
        'Wer ist dabei?'
    ].join('\n');

    const media = await loadKennenlernabendMedia();

    if (media) {
        await client.sendMessage(chatId, media, { caption: intro });
    } else {
        await client.sendMessage(chatId, intro);
    }

    const pollMessage = await client.sendMessage(
        chatId,
        new Poll(`${label} - Sonntag ${time}: bist du dabei?`, ATTENDANCE_OPTIONS)
    );
    await pollMessage.pin(604800);

    weeklyState.finalVenue = {
        name: label,
        source: 'special',
        resolvedAt: new Date().toISOString()
    };

    weeklyState.attendancePoll = {
        dateKey: today.dateKey,
        messageId: pollMessage.id._serialized,
        venue: label,
        special: true,
        createdAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Freitags-Umfrage (Special) fuer ${weeklyState.specialSunday.weekKey} gesendet. Aktion: ${activity}.`);
}

async function sendSundayAttendancePoll({ force = false } = {}) {
    const state = getState();
    const today = getDateParts();
    const weekKey = getBerlinWeekKey();
    const weeklyState = ensureWeeklyPollState(state, weekKey);

    if (!force && weeklyState.attendancePoll && weeklyState.attendancePoll.dateKey === today.dateKey) {
        return;
    }

    if (weeklyState.specialSunday) {
        await sendSpecialSundayAttendancePoll({ state, weeklyState, today });
        return;
    }

    const result = await getWinningVenueFromWednesdayPoll(weeklyState, weekKey);
    const intro = `Wir treffen uns am Sonntag um 18 Uhr bei ${result.winner}. Wer ist dabei?`;

    const media = await loadKennenlernabendMedia();

    if (media) {
        await client.sendMessage(chatId, media, { caption: intro });
    } else {
        await client.sendMessage(chatId, intro);
    }

    const pollMessage = await client.sendMessage(
        chatId,
        new Poll(`Kennenlernabend am Sonntag bei ${result.winner} – 18 Uhr: bist du dabei?`, ATTENDANCE_OPTIONS)
    );
    await pollMessage.pin(604800);

    weeklyState.finalVenue = {
        name: result.winner,
        counts: result.counts,
        source: result.source,
        resolvedAt: new Date().toISOString()
    };

    weeklyState.attendancePoll = {
        dateKey: today.dateKey,
        messageId: pollMessage.id._serialized,
        venue: result.winner,
        createdAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Freitags-Umfrage fuer ${weekKey} gesendet. Gewinner: ${result.winner}.`);
}

async function sendSundayKennenlernabendReminder({ force = false } = {}) {
    const state = getState();
    const today = getDateParts();
    const weekKey = getBerlinWeekKey();
    const weeklyState = ensureWeeklyPollState(state, weekKey);

    if (!force && weeklyState.sundayReminder && weeklyState.sundayReminder.dateKey === today.dateKey) {
        return;
    }

    if (weeklyState.specialSunday) {
        const { activity, emoji, time } = weeklyState.specialSunday;
        const message = [
            'Reminder: Special Sonntag heute',
            '',
            `Was: ${emoji} ${activity}`,
            `Wann: heute, ${time}`,
            'Wo: siehe Chat (Orga laeuft ueber Tribe-Mitglied)',
            '',
            'Wer noch unentschlossen ist: einfach kommen oder kurz im Chat melden.'
        ].join('\n');

        await client.sendMessage(chatId, message);

        weeklyState.sundayReminder = {
            dateKey: today.dateKey,
            venue: `${emoji} ${activity}`,
            special: true,
            sentAt: new Date().toISOString()
        };

        writeState(state);
        console.log(`Sonntags-Reminder (Special) fuer ${weekKey} gesendet. Aktion: ${activity}.`);
        return;
    }

    let venue = weeklyState.finalVenue?.name || weeklyState.attendancePoll?.venue;
    let result = null;

    if (!venue) {
        result = await getWinningVenueFromWednesdayPoll(weeklyState, weekKey);
        venue = result.winner;
    }

    const message = [
        'Reminder: Kennenlernabend heute',
        '',
        'Was: Kennenlernabend',
        'Wann: heute, 18:00 Uhr',
        `Wo: ${venue}`,
        '',
        'Kommt einfach vorbei, auch wenn ihr noch nicht abgestimmt habt.',
        '',
        'Die Zusagen laufen ueber die Umfrage vom Freitag.'
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

    weeklyState.sundayReminder = {
        dateKey: today.dateKey,
        venue,
        sentAt: new Date().toISOString()
    };

    writeState(state);
    console.log(`Sonntags-Reminder fuer ${weekKey} gesendet. Location: ${venue}.`);
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

    scheduleJob('Freitags-Umfrage', { weekdayIndex: 5, hour: 18 }, async () => {
        await sendSundayAttendancePoll();
    });

    scheduleJob('Kennenlernabend-Reminder', { weekdayIndex: 0, hour: 12 }, async () => {
        await sendSundayKennenlernabendReminder();
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

function isDueNow({ weekdayIndex, hour, minute = 0 }, nowParts = getDateParts()) {
    if (weekdayIndex !== undefined && nowParts.weekdayIndex !== weekdayIndex) {
        return false;
    }

    if (nowParts.hour !== hour) {
        return false;
    }

    const diff = nowParts.minute - minute;
    return diff >= 0 && diff < 30;
}

async function runDueJobs() {
    const nowParts = getDateParts();
    const dueJobs = [
        ['daily-highlights', { hour: DAILY_POST_HOUR }, () => sendDailyHighlights()],
        ['wednesday-poll', { weekdayIndex: 3, hour: 20 }, () => sendWednesdayVenuePoll()],
        ['friday-poll', { weekdayIndex: 5, hour: 18 }, () => sendSundayAttendancePoll()],
        ['sunday-reminder', { weekdayIndex: 0, hour: 12 }, () => sendSundayKennenlernabendReminder()],
        ['weekly-calendar', { weekdayIndex: 0, hour: 12, minute: 15 }, () => sendWeeklyCalendar()],
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
        console.log(`Starte faelligen Job: ${name}`);
        await task();
    }
}

async function runBotCommand(command) {
    switch (command) {
        case 'run-due':
            await runDueJobs();
            return;
        case 'daily-highlights':
            await sendDailyHighlights({ force: true });
            return;
        case 'wednesday-poll':
            await sendWednesdayVenuePoll({ force: true });
            return;
        case 'friday-poll':
        case 'sunday-poll':
            await sendSundayAttendancePoll({ force: true });
            return;
        case 'sunday-reminder':
            await sendSundayKennenlernabendReminder({ force: true });
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

    if (message === '/poll-freitag' || message === '/poll-sonntag') {
        await sendSundayAttendancePoll({ force: true });
        return;
    }

    if (message === '/kennenlernabend-reminder') {
        await sendSundayKennenlernabendReminder({ force: true });
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

    pendingNewMembers.push(...newMemberIds);

    while (pendingNewMembers.length >= 3) {
        const batchIds = pendingNewMembers.splice(0, 3);

        const contacts = await Promise.all(batchIds.map(id => client.getContactById(id)));
        const names = contacts.map(getDisplayNameForContact);
        const [name1, name2, name3] = names;
        const introNames = `${name1}, ${name2} & ${name3}`;

        const greetings = [
            `Hey ${introNames}, willkommen bei THE TRIBE! 👋`,
            `${introNames} – schön dass ihr da seid! 🎉`,
            `Willkommen ${introNames}! 👋`,
            `${introNames} sind jetzt dabei – herzlich willkommen! 🙌`,
            `Hey ${introNames}! Schön dass ihr hier seid 😊`,
            `${introNames} – willkommen! ✌️`,
        ];
        const context = [
            `Echte Treffen in Bielefeld, jeden Sonntag Kennenlernabend – stellt euch kurz vor! 🙌`,
            `Sonntags Kennenlernabend – einfach vorbeikommen. Wer seid ihr? 👀`,
            `THE TRIBE = echte Treffen, kein Social Media. Sonntags Kennenlernabend. Sagt kurz Hallo! 😄`,
            `Jeden Sonntag Kennenlernabend – kommt vorbei & stellt euch kurz vor ✌️`,
            `Hier treffen sich echte Menschen – Sonntags beim Kennenlernabend. Wer seid ihr? 😊`,
            `Sonntags Kennenlernabend, echte Verbindungen in Bielefeld – stellt euch kurz vor! 🙌`,
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

    if (pendingNewMembers.length > 0) {
        console.log(`${pendingNewMembers.length} neues Mitglied in der Warteschlange (warte auf insgesamt 3).`);
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

client.on('qr', async qr => {
    console.log('QR-Code in WhatsApp scannen.');

    let matrix;
    try {
        matrix = QRCode.create(qr, { errorCorrectionLevel: 'M' });
    } catch (err) {
        console.error('QR-Matrix konnte nicht erzeugt werden:', err && err.stack ? err.stack : err);
    }

    if (matrix) {
        console.log('\n===== QR-CODE (heller QR auf dunklem Hintergrund — normales Actions-Log-Theme) =====\n');
        console.log(renderQrAsBlocks(matrix, { invert: false }));
        console.log('\n===== QR-CODE INVERTIERT (falls obiger nicht scannt) =====\n');
        console.log(renderQrAsBlocks(matrix, { invert: true }));
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
});

client.on('ready', async () => {
    isReady = true;
    console.log('Bot ist online.');
    console.log(`Sendeziel: ${chatId}`);
    console.log(`Tuesday-Run-Ziel: ${tuesdayRunChatId}`);
    console.log(`Jam-Session-Ziel: ${jamSessionChatId}`);

    if (IS_ONE_SHOT_RUN) {
        try {
            console.log(`Einmaliger Bot-Command: ${BOT_COMMAND}`);
            await runBotCommand(BOT_COMMAND);
            console.log('Einmaliger Bot-Command abgeschlossen.');
            await client.destroy();
            process.exit(0);
        } catch (err) {
            console.error('Einmaliger Bot-Command fehlgeschlagen:', err && err.stack ? err.stack : err);
            await client.destroy().catch(() => {});
            process.exit(1);
        }
        return;
    }

    console.log('Enter sendet eine Nachricht. /groups, /highlights, /poll-mittwoch, /poll-freitag, /poll-sonntag, /kennenlernabend-reminder, /tuesday-run, /jam-session, /thursday-football und /ping-pong testen die automatischen Posts. /exit beendet den Bot.');

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
client.initialize().catch(err => {
    console.error('Fehler bei client.initialize():', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', err => {
    console.error('Unhandled promise rejection:', err && err.stack ? err.stack : err);
});
