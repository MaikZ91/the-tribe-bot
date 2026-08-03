// Diagnose: klaert, ob die Lesefunktionen von whatsapp-web.js gegen die
// aktuelle WhatsApp-Web-Version noch funktionieren, oder ob eine konfigurierte
// Gruppen-ID nicht mehr stimmt.
//
// Hintergrund: getChatById() und getChats() scheitern beide mit einem
// minifizierten "r", waehrend sendMessage() funktioniert. Beides zusammen
// deutet auf die Library hin — dieses Skript belegt oder widerlegt das.
//
// Sendet NICHTS. Nutzt dieselbe LocalAuth-Session wie der Bot.
//
// Achtung: Actions-Logs oeffentlicher Repos sind oeffentlich lesbar. Dieses
// Skript gibt daher keine Chat-Namen aus. Mit DIAGNOSE_LIST_CHATS=1 wird
// zusaetzlich die Gruppenliste ausgegeben — nur bewusst einsetzen.

const { Client, LocalAuth } = require('whatsapp-web.js');

const LIST_CHATS = process.env.DIAGNOSE_LIST_CHATS === '1';

const CONFIGURED_CHATS = [
    ['WHATSAPP_CHAT_ID', process.env.WHATSAPP_CHAT_ID || '120363426194120338@g.us'],
    ['WHATSAPP_TUESDAY_RUN_CHAT_ID', process.env.WHATSAPP_TUESDAY_RUN_CHAT_ID || '120363423926212258@g.us'],
    ['WHATSAPP_JAM_SESSION_CHAT_ID', process.env.WHATSAPP_JAM_SESSION_CHAT_ID || '120363426677676365@g.us'],
    ['WHATSAPP_ANNOUNCEMENTS_CHAT_ID', process.env.WHATSAPP_ANNOUNCEMENTS_CHAT_ID || '120363425963185977@g.us'],
    ['WHATSAPP_AUSGEHEN_CHAT_ID', process.env.WHATSAPP_AUSGEHEN_CHAT_ID || '120363426194120338@g.us']
];

// Denselben WhatsApp-Web-Build festnageln wie der Bot. Der erste Diagnoselauf
// am 29.07. lief noch ohne Pinning und scheiterte — seitdem hat das Pinning das
// Senden zurueckgebracht. Ob es auch das Lesen zurueckbringt, ist offen, und
// genau das misst dieser Lauf. Leerer Wert schaltet das Pinning ab.
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
    puppeteer: {
        headless: true,
        protocolTimeout: 300000,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

function describeError(err) {
    if (!err) return 'unbekannt';
    // Die Fehler aus der Seite sind minifiziert ("r") — Name und Stack helfen mehr.
    const parts = [err.name, err.message].filter(Boolean).join(': ');
    return parts || String(err);
}

client.on('qr', () => {
    console.error('FEHLER: Session ist nicht mehr gueltig (QR angefordert). Diagnose abgebrochen.');
    process.exit(1);
});

client.on('code', () => {
    console.error('FEHLER: Session ist nicht mehr gueltig (Kopplungscode angefordert). Diagnose abgebrochen.');
    process.exit(1);
});

client.on('ready', async () => {
    console.log('=== WhatsApp-Diagnose ===\n');

    try {
        console.log(`WhatsApp-Web-Version: ${await client.getWWebVersion()}`);
    } catch (err) {
        console.log(`WhatsApp-Web-Version: nicht ermittelbar (${describeError(err)})`);
    }
    console.log(`whatsapp-web.js:      ${require('whatsapp-web.js/package.json').version}`);
    console.log(`Eigene Wid:           ${client.info?.wid?._serialized || 'unbekannt'}\n`);

    console.log('--- getChats() ---');
    let chats = null;
    try {
        chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);
        console.log(`OK — ${chats.length} Chats insgesamt, davon ${groups.length} Gruppen`);
    } catch (err) {
        console.log(`FEHLER — ${describeError(err)}`);
        if (err && err.stack) console.log(err.stack.split('\n').slice(0, 5).join('\n'));
    }

    console.log('\n--- getChatById() je konfigurierter ID ---');
    for (const [label, id] of CONFIGURED_CHATS) {
        try {
            const chat = await client.getChatById(id);
            if (!chat) {
                console.log(`${label}\n  ${id}\n  LEER — kein Chat zurueckgegeben`);
                continue;
            }
            const participants = Array.isArray(chat.participants) ? chat.participants.length : 'n/a';
            console.log(`${label}\n  ${id}\n  OK — isGroup=${chat.isGroup} Teilnehmer=${participants}`);
        } catch (err) {
            console.log(`${label}\n  ${id}\n  FEHLER — ${describeError(err)}`);
        }
    }

    // Gegenprobe: findet sich die ID in der Chat-Liste wieder? Trennt
    // "Library kaputt" von "ID stimmt nicht mehr".
    if (chats) {
        console.log('\n--- Gegenprobe: konfigurierte IDs in der Chat-Liste ---');
        const known = new Set(chats.map(chat => chat.id?._serialized).filter(Boolean));
        for (const [label, id] of CONFIGURED_CHATS) {
            console.log(`${label}: ${known.has(id) ? 'in der Liste vorhanden' : 'NICHT in der Liste'}`);
        }

        if (LIST_CHATS) {
            console.log('\n--- Gruppenliste (DIAGNOSE_LIST_CHATS=1) ---');
            for (const chat of chats.filter(c => c.isGroup)) {
                console.log(`${chat.id?._serialized}  ${chat.name || '(ohne Namen)'}`);
            }
        } else {
            console.log('\n(Gruppenliste ausgelassen — mit DIAGNOSE_LIST_CHATS=1 aktivieren.');
            console.log(' Actions-Logs oeffentlicher Repos sind oeffentlich lesbar.)');
        }
    }

    console.log('\n=== Ende Diagnose ===');
    await client.destroy();
    process.exit(0);
});

const TIMEOUT_MS = Number(process.env.DIAGNOSE_TIMEOUT_MS || 6 * 60 * 1000);
setTimeout(() => {
    console.error(`Diagnose nach ${Math.round(TIMEOUT_MS / 1000)}s ohne Verbindung abgebrochen.`);
    process.exit(1);
}, TIMEOUT_MS).unref();

console.log('Verbinde mit WhatsApp (Puppeteer startet Chromium)...');
client.initialize().catch(err => {
    console.error('Fehler bei client.initialize():', err && err.stack ? err.stack : err);
    process.exit(1);
});
