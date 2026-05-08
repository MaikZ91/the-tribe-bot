// Exploration step: open the Cafe Barcelona reservation iframe, dump DOM and
// take screenshots. Once we see the actual form structure, we wire up the
// real fill+submit logic in this same file.

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const RESERVATION_URL = 'https://interna.celona.de/reservations/make/564ef967-3aef-4377-bbb3-cb5875943469';
const OUT_DIR = path.join(__dirname, 'reservation-debug');

const RESERVATION_DATE = process.env.RESERVATION_DATE || '2026-05-10'; // YYYY-MM-DD
const RESERVATION_TIME = process.env.RESERVATION_TIME || '18:00';
const RESERVATION_GUESTS = parseInt(process.env.RESERVATION_GUESTS || '5', 10);
const RESERVATION_NAME = process.env.RESERVATION_NAME || 'The Tribe Bielefeld';
const RESERVATION_EMAIL = process.env.RESERVATION_EMAIL || '';
const RESERVATION_PHONE = process.env.RESERVATION_PHONE || '';
const RESERVATION_DRY_RUN = (process.env.RESERVATION_DRY_RUN || 'true').toLowerCase() !== 'false';

async function shot(page, name) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const file = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`[screenshot] ${file}`);
}

async function dumpHtml(page, name) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const file = path.join(OUT_DIR, `${name}.html`);
    const html = await page.content();
    fs.writeFileSync(file, html);
    console.log(`[html] ${file} (${html.length} chars)`);
}

async function dumpFormFields(page, name) {
    const fields = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('input, select, textarea, button').forEach(el => {
            items.push({
                tag: el.tagName,
                type: el.type || null,
                name: el.name || null,
                id: el.id || null,
                placeholder: el.placeholder || null,
                ariaLabel: el.getAttribute('aria-label'),
                text: (el.innerText || '').slice(0, 80),
                visible: !!(el.offsetParent || el.tagName === 'OPTION'),
                value: typeof el.value === 'string' ? el.value.slice(0, 60) : null,
            });
        });
        return items;
    });
    console.log(`[fields:${name}]`, JSON.stringify(fields, null, 2));
}

async function main() {
    console.log('Konfiguration:');
    console.log('  URL          :', RESERVATION_URL);
    console.log('  Datum        :', RESERVATION_DATE);
    console.log('  Uhrzeit      :', RESERVATION_TIME);
    console.log('  Personen     :', RESERVATION_GUESTS);
    console.log('  Name         :', RESERVATION_NAME);
    console.log('  E-Mail       :', RESERVATION_EMAIL ? '***set***' : '(leer)');
    console.log('  Telefon      :', RESERVATION_PHONE ? '***set***' : '(leer)');
    console.log('  Dry-Run      :', RESERVATION_DRY_RUN);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1600 });
        await page.goto(RESERVATION_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));
        await shot(page, '01-loaded');
        await dumpHtml(page, '01-loaded');
        await dumpFormFields(page, '01-loaded');

        console.log('Exploration abgeschlossen. Schau dir die Artifacts an, dann bauen wir Schritt 2.');
    } finally {
        await browser.close();
    }
}

main().catch(err => {
    console.error('Reservierung fehlgeschlagen:', err && err.stack ? err.stack : err);
    process.exit(1);
});
