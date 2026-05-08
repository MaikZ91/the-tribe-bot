// Automatische Tisch-Reservierung bei Finca Bar Celona Bielefeld.
// Multi-Step React-Formular (interna.celona.de): Personen -> Datum -> Uhrzeit
// -> Kontaktdaten -> Submit. Screenshots werden in reservation-debug/ abgelegt
// und als Workflow-Artifact hochgeladen.

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const RESERVATION_URL = 'https://interna.celona.de/reservations/make/564ef967-3aef-4377-bbb3-cb5875943469';
const OUT_DIR = path.join(__dirname, 'reservation-debug');

const RESERVATION_DATE = process.env.RESERVATION_DATE || '2026-05-10';
const RESERVATION_TIME = process.env.RESERVATION_TIME || '18:00';
const RESERVATION_GUESTS = parseInt(process.env.RESERVATION_GUESTS || '5', 10);
const RESERVATION_NAME = process.env.RESERVATION_NAME || 'The Tribe Bielefeld';
const RESERVATION_EMAIL = process.env.RESERVATION_EMAIL || '';
const RESERVATION_PHONE = process.env.RESERVATION_PHONE || '';
const RESERVATION_NOTES = process.env.RESERVATION_NOTES || '';
const RESERVATION_DRY_RUN = (process.env.RESERVATION_DRY_RUN || 'true').toLowerCase() !== 'false';

function ensureOutDir() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function shot(page, name) {
    ensureOutDir();
    const file = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`[screenshot] ${file}`);
}

async function dumpHtml(page, name) {
    ensureOutDir();
    const file = path.join(OUT_DIR, `${name}.html`);
    const html = await page.content();
    fs.writeFileSync(file, html);
    console.log(`[html] ${file} (${html.length} chars)`);
}

async function dumpFormFields(page, name) {
    const fields = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('input, select, textarea, button').forEach(el => {
            const rect = el.getBoundingClientRect();
            items.push({
                tag: el.tagName,
                type: el.type || null,
                name: el.name || null,
                id: el.id || null,
                placeholder: el.placeholder || null,
                ariaLabel: el.getAttribute('aria-label'),
                text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
                visible: rect.width > 0 && rect.height > 0,
                value: typeof el.value === 'string' ? el.value.slice(0, 80) : null,
                options: el.tagName === 'SELECT'
                    ? Array.from(el.options).map(o => ({ value: o.value, label: o.textContent.trim().slice(0, 40) }))
                    : undefined,
            });
        });
        return items;
    });
    console.log(`[fields:${name}] ${JSON.stringify(fields)}`);
    return fields;
}

async function selectByAriaLabel(page, ariaLabel, value) {
    const handle = await page.$(`select[aria-label="${ariaLabel}"]`);
    if (!handle) {
        throw new Error(`Select mit aria-label="${ariaLabel}" nicht gefunden`);
    }
    await page.evaluate((el, v) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, handle, value);
    return handle;
}

async function setDateInput(page, dateValue) {
    const handle = await page.$('input[name="date"]');
    if (!handle) {
        throw new Error('Datum-Input nicht gefunden');
    }
    await page.evaluate((el, v) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, handle, dateValue);
}

async function findGuestsValue(page, guests) {
    const opts = await page.evaluate(() => {
        const sel = document.querySelector('select[aria-label="Personenanzahl"]');
        if (!sel) return [];
        return Array.from(sel.options).map(o => ({ value: o.value, label: o.textContent.trim() }));
    });
    if (!opts.length) throw new Error('Personenanzahl-Select nicht gefunden');
    const exact = opts.find(o => o.value === String(guests))
        || opts.find(o => /^\s*\d+/.test(o.label) && parseInt(o.label, 10) === guests);
    if (!exact) {
        console.warn(`Exakte Personenanzahl ${guests} nicht in Optionen. Optionen:`, opts);
        throw new Error(`Personenanzahl ${guests} nicht verfügbar`);
    }
    return exact.value;
}

async function findTimeValue(page, desiredTime) {
    const opts = await page.evaluate(() => {
        const sel = document.querySelector('select[aria-label="Uhrzeit"]');
        if (!sel) return [];
        return Array.from(sel.options)
            .filter(o => o.value)
            .map(o => ({ value: o.value, label: o.textContent.trim() }));
    });
    if (!opts.length) throw new Error('Keine Uhrzeit-Optionen verfügbar (vielleicht ausgebucht?)');
    console.log('Uhrzeit-Optionen:', opts.map(o => o.label).join(', '));
    const exact = opts.find(o => o.label === desiredTime || o.value === desiredTime);
    if (exact) return exact.value;
    const [hh, mm] = desiredTime.split(':').map(n => parseInt(n, 10));
    const target = hh * 60 + mm;
    const parsed = opts
        .map(o => {
            const m = (o.label || o.value).match(/(\d{1,2}):(\d{2})/);
            if (!m) return null;
            const minutes = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
            return { ...o, minutes, diff: Math.abs(minutes - target) };
        })
        .filter(Boolean)
        .sort((a, b) => a.diff - b.diff);
    if (!parsed.length) throw new Error(`Uhrzeit ${desiredTime} nicht in Optionen`);
    console.log(`Nächstgelegene Uhrzeit zu ${desiredTime}: ${parsed[0].label} (${parsed[0].diff} min Abweichung)`);
    return parsed[0].value;
}

async function clickByText(page, regex, opts = {}) {
    const { tag = 'button' } = opts;
    const handle = await page.evaluateHandle((tagSel, source) => {
        const re = new RegExp(source, 'i');
        const els = Array.from(document.querySelectorAll(tagSel));
        return els.find(el => re.test(el.innerText || ''));
    }, tag, regex.source);
    const exists = await handle.evaluate(el => !!el);
    if (!exists) {
        await handle.dispose();
        return false;
    }
    await handle.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await handle.click();
    await handle.dispose();
    return true;
}

async function fillContactForm(page) {
    const labelMap = [
        { keys: ['name', 'vorname'], value: RESERVATION_NAME },
        { keys: ['mail', 'email'], value: RESERVATION_EMAIL },
        { keys: ['telefon', 'phone', 'mobil'], value: RESERVATION_PHONE },
        { keys: ['nachricht', 'anmerkung', 'kommentar', 'message', 'notes'], value: RESERVATION_NOTES },
    ];

    for (const { keys, value } of labelMap) {
        if (!value) continue;
        const filled = await page.evaluate((searchKeys, val) => {
            const inputs = Array.from(document.querySelectorAll('input, textarea'));
            for (const input of inputs) {
                if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') continue;
                if (input.name === 'address' || input.name === 'date_of_birth') continue; // honeypot
                const rect = input.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) continue;
                const haystack = [
                    input.name, input.id, input.placeholder,
                    input.getAttribute('aria-label'),
                    input.getAttribute('autocomplete'),
                    (document.querySelector(`label[for="${input.id}"]`) || {}).textContent || '',
                ].join(' ').toLowerCase();
                if (searchKeys.some(k => haystack.includes(k))) {
                    const setter = Object.getOwnPropertyDescriptor(
                        input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
                        'value'
                    ).set;
                    setter.call(input, val);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('blur', { bubbles: true }));
                    return { name: input.name || input.id || input.getAttribute('aria-label'), tag: input.tagName };
                }
            }
            return null;
        }, keys, value);
        if (filled) {
            console.log(`[contact] ${keys[0]} -> ${filled.tag} (${filled.name})`);
        } else {
            console.warn(`[contact] kein Feld für ${keys.join('/')} gefunden`);
        }
    }

    // Datenschutz-Checkbox
    const privacyChecked = await page.evaluate(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        for (const cb of checkboxes) {
            if (cb.id === 'barrierFree') continue;
            const rect = cb.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            if (cb.checked) return cb.id || cb.name;
            cb.click();
            return cb.id || cb.name || '(unnamed)';
        }
        return null;
    });
    if (privacyChecked) {
        console.log(`[contact] Checkbox aktiviert: ${privacyChecked}`);
    }
}

async function main() {
    console.log('Konfiguration:');
    console.log('  URL          :', RESERVATION_URL);
    console.log('  Datum        :', RESERVATION_DATE);
    console.log('  Uhrzeit      :', RESERVATION_TIME);
    console.log('  Personen     :', RESERVATION_GUESTS);
    console.log('  Name         :', RESERVATION_NAME);
    console.log('  E-Mail gesetzt:', !!RESERVATION_EMAIL);
    console.log('  Telefon gesetzt:', !!RESERVATION_PHONE);
    console.log('  Dry-Run      :', RESERVATION_DRY_RUN);

    if (!RESERVATION_DRY_RUN && (!RESERVATION_EMAIL || !RESERVATION_PHONE)) {
        throw new Error('RESERVATION_EMAIL und RESERVATION_PHONE müssen für echte Reservierungen gesetzt sein.');
    }

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1600 });
        page.on('console', msg => {
            const t = msg.type();
            if (t === 'error' || t === 'warning') {
                console.log(`[browser:${t}]`, msg.text());
            }
        });
        page.on('pageerror', err => console.log('[pageerror]', err.message));

        await page.goto(RESERVATION_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 2000));
        await shot(page, '01-loaded');

        const guestValue = await findGuestsValue(page, RESERVATION_GUESTS);
        console.log(`Personen-Wert: ${guestValue}`);
        await selectByAriaLabel(page, 'Personenanzahl', guestValue);
        await new Promise(r => setTimeout(r, 1500));
        await shot(page, '02-guests');

        await setDateInput(page, RESERVATION_DATE);
        await new Promise(r => setTimeout(r, 2500));
        await shot(page, '03-date');

        const timeValue = await findTimeValue(page, RESERVATION_TIME);
        console.log(`Uhrzeit-Filter-Wert: ${timeValue}`);
        await selectByAriaLabel(page, 'Uhrzeit', timeValue);
        await new Promise(r => setTimeout(r, 2500));
        await shot(page, '04-time');

        // Step 2: nach dem Filter erscheinen Slot-Buttons (z. B. 17:30, 18:00, 18:15).
        // Den exakten Slot anklicken.
        const slotClicked = await page.evaluate((desired) => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const candidates = buttons.filter(btn => /^\d{1,2}:\d{2}$/.test((btn.innerText || '').trim()));
            if (!candidates.length) return { clicked: null, available: [] };
            const exact = candidates.find(btn => btn.innerText.trim() === desired);
            const target = exact || candidates[0];
            target.scrollIntoView({ block: 'center' });
            target.click();
            return {
                clicked: target.innerText.trim(),
                available: candidates.map(b => b.innerText.trim()),
                wasExact: !!exact,
            };
        }, RESERVATION_TIME);

        if (!slotClicked.clicked) {
            console.warn('Kein Uhrzeit-Slot-Button gefunden — möglicherweise nichts verfügbar.');
        } else {
            console.log(`Slot geklickt: ${slotClicked.clicked} (verfügbar: ${slotClicked.available.join(', ')}, exakter Treffer: ${slotClicked.wasExact})`);
        }

        await new Promise(r => setTimeout(r, 3000));
        await shot(page, '05-step2');
        await dumpHtml(page, '05-step2');
        await dumpFormFields(page, '05-step2');

        await fillContactForm(page);
        await new Promise(r => setTimeout(r, 1000));
        await shot(page, '06-filled');

        if (RESERVATION_DRY_RUN) {
            console.log('DRY RUN — kein Submit. Schau dir 06-filled.png an.');
            return;
        }

        const submitted = await clickByText(page, /reservieren|absenden|anfrage|submit|jetzt buchen/i);
        if (!submitted) {
            // Try a generic submit input
            const altSubmit = await page.$('button[type="submit"], input[type="submit"]');
            if (altSubmit) {
                await altSubmit.click();
                console.log('Generischer Submit-Button geklickt.');
            } else {
                throw new Error('Kein Submit-Button gefunden.');
            }
        } else {
            console.log('Reservierungs-Button geklickt.');
        }

        await new Promise(r => setTimeout(r, 6000));
        await shot(page, '07-after-submit');
        await dumpHtml(page, '07-after-submit');

        const confirmation = await page.evaluate(() => document.body.innerText.slice(0, 1500));
        console.log('=== Seite nach Submit ===');
        console.log(confirmation);
        console.log('=== Ende ===');
    } finally {
        await browser.close();
    }
}

main().catch(err => {
    console.error('Reservierung fehlgeschlagen:', err && err.stack ? err.stack : err);
    process.exit(1);
});
