'use strict';

const puppeteer = require('puppeteer');
const GIFEncoder = require('gif-encoder-2');
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');
const https = require('https');

const EVENTS_URL = 'https://raw.githubusercontent.com/MaikZ91/productiontools/master/events.json';
const TIME_ZONE = 'Europe/Berlin';
const GIF_WIDTH = 540;
const GIF_HEIGHT = 675;
const FRAMES = 22;
const FRAME_DELAY = 100;
const TOTAL_ANIM_MS = 2600;
const MAX_HIGHLIGHTS = 3;

const EXCLUDED_ACCOUNTS = new Set(['sennefriedhof']);
const EXCLUDED_ORGANIZERS = ['kirchengemeinde oldentrup'];

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function getDateParts(date) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'short', hour12: false
    });
    const parts = Object.fromEntries(
        formatter.formatToParts(date)
            .filter(p => p.type !== 'literal')
            .map(p => [p.type, p.value])
    );
    return { year: parts.year, month: parts.month, day: parts.day, weekday: parts.weekday };
}

function getTodayDateLabels(date) {
    const { month, day, year } = getDateParts(date);
    const en = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' }).format(date);
    const de = new Intl.DateTimeFormat('de-DE', { timeZone: TIME_ZONE, weekday: 'short' }).format(date).replace('.', '');
    const dm = `${day}.${month}`;
    const dmy = `${day}.${month}.${year}`;
    const dmy2 = `${day}.${month}.${year.slice(2)}`;
    return [
        dm, dmy, dmy2, en, de,
        `${en}, ${dm}`, `${de}, ${dm}`,
        `${en}, ${dmy}`, `${de}, ${dmy}`,
        `${en}, ${dmy2}`, `${de}, ${dmy2}`
    ];
}

function isBielefeldEvent(entry) {
    if (!entry || typeof entry !== 'object') return false;
    if (entry.city) return String(entry.city).trim().toLowerCase() === 'bielefeld';
    return true;
}

function toSortableTime(v) {
    return /^\d{2}:\d{2}$/.test(v || '') ? v : '99:99';
}

function getHighlightsForDate(events, date) {
    const acceptedDates = new Set(getTodayDateLabels(date));
    const EXCLUDED_CATS = new Set(['sport', 'sonstiges', 'kino', 'ausgehen']);

    return events
        .filter(isBielefeldEvent)
        .filter(e => acceptedDates.has(String(e.date || '').trim()))
        .filter(e => {
            const name = String(e.event || '').toLowerCase();
            if (Array.from(EXCLUDED_ACCOUNTS).some(acc => name.includes(`@${acc}`))) return false;
            if (EXCLUDED_ORGANIZERS.some(org => name.includes(org))) return false;
            return true;
        })
        .filter(e => !EXCLUDED_CATS.has(String(e.category || '').toLowerCase()))
        .sort((a, b) => toSortableTime(a.time).localeCompare(toSortableTime(b.time)))
        .slice(0, MAX_HIGHLIGHTS);
}

function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getCategoryStyle(categoryValue, index) {
    const category = String(categoryValue || '').trim().toLowerCase();
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
    const fallback = [
        { label: String(categoryValue || 'Event'), accent: '#f97316', background: '#fff3e6' },
        { label: String(categoryValue || 'Event'), accent: '#0ea5e9', background: '#e7f6ff' },
        { label: String(categoryValue || 'Event'), accent: '#16a34a', background: '#e9f8ee' }
    ];
    return styles[category] || fallback[index % fallback.length];
}

function buildAnimatedHtml(highlights, date) {
    const { day, month, year } = getDateParts(date);

    const cards = highlights.length > 0 ? highlights.map((entry, i) => {
        const style = getCategoryStyle(entry.category, i);
        const time = entry.time ? `${escapeHtml(entry.time)} Uhr` : 'Heute';
        const title = escapeHtml(entry.event || 'Event');
        const category = escapeHtml(style.label);
        const url = entry.link
            ? escapeHtml(String(entry.link).replace(/^https?:\/\//, '').replace(/\/$/, ''))
            : 'liebefeld.lovable.app';
        const imageUrl = entry.image_url ? escapeHtml(String(entry.image_url)) : null;
        const bgStyle = imageUrl ? `background-image:url('${imageUrl}');` : '';
        const overlay = imageUrl ? '<div class="event-date-overlay"></div>' : '';

        return `
        <article class="event-card" style="--accent:${style.accent};--badge-bg:${style.background};animation-delay:${0.35 + i * 0.35}s">
            <div class="event-date" style="${bgStyle}background-color:${style.accent}">
                ${overlay}<span>${time}</span>
            </div>
            <div class="event-body">
                <div class="event-topline">
                    <span class="badge">${category}</span>
                    <span class="count">0${i + 1}</span>
                </div>
                <h2>${title}</h2>
                <div class="event-meta">
                    <span>Bielefeld</span>
                    <span>${url}</span>
                </div>
            </div>
        </article>`;
    }).join('') : `
        <article class="event-card empty">
            <div class="event-body">
                <div class="event-topline"><span class="badge">Heute</span><span class="count">01</span></div>
                <h2>Keine Highlights fuer heute eingetragen.</h2>
                <div class="event-meta"><span>Bielefeld</span><span>liebefeld.lovable.app</span></div>
            </div>
        </article>`;

    return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:${GIF_WIDTH}px;height:${GIF_HEIGHT}px;overflow:hidden;
    font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;
    background:radial-gradient(circle at 20% 0%,rgba(255,255,255,.95),transparent 28%),
               linear-gradient(145deg,#fff7ed 0%,#ffffff 45%,#ecfeff 100%);
    color:#111827}
.poster{width:${GIF_WIDTH}px;height:${GIF_HEIGHT}px;padding:33px 29px 27px;
    display:flex;flex-direction:column;gap:17px}

header{display:flex;justify-content:space-between;align-items:flex-start;
    opacity:0;animation:fadeUp .45s ease forwards}
.brand{display:flex;align-items:center;gap:7px;font-weight:850;font-size:17px}
.brand-mark{width:24px;height:24px;border-radius:4px;background:#111827;color:#fff;
    display:grid;place-items:center;font-size:13px}
.date{text-align:right;font-size:12px;color:#4b5563;font-weight:750}

.hero{opacity:0;animation:fadeUp .45s ease .18s forwards}
h1{font-size:42px;line-height:.98;font-weight:900;letter-spacing:-.5px}
.subtitle{color:#4b5563;font-size:15px;line-height:1.28;font-weight:620;margin-top:3px}

.events{display:flex;flex-direction:column;gap:11px;margin-top:3px}
.event-card{min-height:109px;display:grid;grid-template-columns:110px 1fr;
    overflow:hidden;border:1.5px solid rgba(17,24,39,.08);border-radius:6px;
    background:rgba(255,255,255,.92);box-shadow:0 12px 27px rgba(15,23,42,.12);
    opacity:0;transform:translateX(110%);
    animation:slideIn .55s cubic-bezier(.22,.68,0,1.35) forwards}
.event-card.empty{grid-template-columns:1fr}

.event-date{position:relative;background:var(--accent);background-size:cover;
    background-position:center;color:#fff;display:flex;align-items:flex-end;
    justify-content:center;padding:14px 9px;font-size:17px;line-height:1.05;
    font-weight:900;text-align:center;overflow:hidden}
.event-date-overlay{position:absolute;inset:0;
    background:linear-gradient(to bottom,rgba(0,0,0,.08) 0%,var(--accent) 85%);opacity:.82}
.event-date span{position:relative;z-index:1;text-shadow:0 1px 6px rgba(0,0,0,.5)}

.event-body{padding:14px 15px 15px;display:flex;flex-direction:column;
    justify-content:space-between;gap:9px}
.event-topline,.event-meta{display:flex;align-items:center;justify-content:space-between;gap:11px}
.badge{max-width:235px;padding:4.5px 7px;border-radius:4px;
    background:var(--badge-bg,#f3f4f6);color:var(--accent,#111827);
    font-size:10px;line-height:1;font-weight:850;text-transform:uppercase;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.count{color:#d1d5db;font-size:12px;font-weight:900}
h2{font-size:21.5px;line-height:1.08;font-weight:900;letter-spacing:-.3px}
.event-meta{color:#6b7280;font-size:11px;line-height:1.2;font-weight:700}
.event-meta span:last-child{max-width:215px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}

footer{margin-top:auto;padding-top:5px;display:flex;justify-content:space-between;
    align-items:center;gap:15px;color:#374151;font-size:12.5px;font-weight:760;
    opacity:0;animation:fadeUp .4s ease 1.45s forwards}
.app-link{padding:7px 9px;border-radius:4px;background:#111827;color:#fff;font-weight:850;white-space:nowrap}

@keyframes fadeUp{
    0%{opacity:0;transform:translateY(16px)}
    100%{opacity:1;transform:translateY(0)}
}
@keyframes slideIn{
    0%{opacity:0;transform:translateX(110%)}
    60%{opacity:1;transform:translateX(-3%)}
    80%{transform:translateX(1%)}
    100%{opacity:1;transform:translateX(0)}
}
</style></head><body>
<main class="poster">
    <header>
        <div class="brand"><div class="brand-mark">L</div><span>Liebefeld</span></div>
        <div class="date">${escapeHtml(day)}.${escapeHtml(month)}.${escapeHtml(year)}</div>
    </header>
    <section class="hero">
        <h1>Bielefeld<br>Tageshighlights</h1>
        <p class="subtitle">Unsere Auswahl fuer heute.</p>
    </section>
    <section class="events">${cards}</section>
    <footer>
        <span>Mehr Events fuer #Liebefeld</span>
        <span class="app-link">liebefeld.lovable.app</span>
    </footer>
</main>
</body></html>`;
}

async function screenshotToRgba(buffer) {
    return new Promise((resolve, reject) => {
        const png = new PNG();
        png.parse(buffer, (err, data) => {
            if (err) return reject(err);
            resolve(data.data);
        });
    });
}

async function generateGif(highlights, date, outputPath) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: GIF_WIDTH, height: GIF_HEIGHT, deviceScaleFactor: 1 });

        const html = buildAnimatedHtml(highlights, date);
        await page.setContent(html, { waitUntil: 'networkidle0' });

        await page.evaluate(() => {
            document.getAnimations().forEach(a => a.pause());
        });

        const encoder = new GIFEncoder(GIF_WIDTH, GIF_HEIGHT, 'neuquant', true);
        encoder.start();
        encoder.setRepeat(0);
        encoder.setDelay(FRAME_DELAY);
        encoder.setQuality(20);

        process.stdout.write('Capturing frames');

        for (let i = 0; i < FRAMES; i++) {
            const t = (i / (FRAMES - 1)) * TOTAL_ANIM_MS;
            await page.evaluate((time) => {
                document.getAnimations().forEach(a => { a.currentTime = time; });
            }, t);

            await new Promise(r => setTimeout(r, 10));

            const buf = await page.screenshot({ type: 'png' });
            const rgba = await screenshotToRgba(buf);
            encoder.addFrame(rgba);
            process.stdout.write('.');
        }

        // Hold last frame longer (600ms)
        encoder.setDelay(600);
        const lastBuf = await page.screenshot({ type: 'png' });
        encoder.addFrame(await screenshotToRgba(lastBuf));

        encoder.finish();
        process.stdout.write('\n');

        const gifBuffer = encoder.out.getData();
        fs.writeFileSync(outputPath, gifBuffer);
        console.log(`GIF saved: ${outputPath} (${(gifBuffer.length / 1024).toFixed(1)} KB)`);

        await page.close();
    } finally {
        await browser.close();
    }
}

async function main() {
    console.log('Fetching events...');
    const events = await fetchJson(EVENTS_URL);
    console.log(`Loaded ${events.length} events`);

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const dates = [
        { label: 'heute', date: now },
        { label: 'morgen', date: tomorrow }
    ];

    fs.mkdirSync('output-gifs', { recursive: true });

    for (const { label, date } of dates) {
        const { day, month, year } = getDateParts(date);
        const highlights = getHighlightsForDate(events, date);
        console.log(`\n${label} (${day}.${month}.${year}): ${highlights.length} highlights`);
        highlights.forEach((h, i) => console.log(`  ${i+1}. ${h.time || '?'} - ${h.event}`));

        const filename = `tageshighlights-${label}-${year}-${month}-${day}.gif`;
        const outputPath = path.join('output-gifs', filename);
        await generateGif(highlights, date, outputPath);
    }

    console.log('\nDone! GIFs are in ./output-gifs/');
}

main().catch(err => { console.error(err); process.exit(1); });
