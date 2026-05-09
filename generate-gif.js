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
const MAX_HIGHLIGHTS = 3;
const HOLD_FRAMES = 9;
const HOLD_DELAY = 160;
const TRANS_FRAMES = 5;
const TRANS_DELAY = 65;

const EXCLUDED_CATS = new Set(['sport', 'sonstiges', 'kino', 'ausgehen']);
const EXCLUDED_ACCOUNTS = ['sennefriedhof'];
const EXCLUDED_ORGANIZERS = ['kirchengemeinde oldentrup'];

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

function fetchImageAsBase64(url, redirects = 0) {
    if (!url || redirects > 4) return Promise.resolve(null);
    return new Promise((resolve) => {
        const mod = url.startsWith('https') ? https : require('http');
        const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } }, res => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return fetchImageAsBase64(res.headers.location, redirects + 1).then(resolve);
            }
            if (res.statusCode !== 200) { res.resume(); return resolve(null); }
            const mime = (res.headers['content-type'] || '').split(';')[0].trim();
            if (!mime.startsWith('image/')) { res.resume(); return resolve(null); }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const buf = Buffer.concat(chunks);
                resolve(`data:${mime};base64,${buf.toString('base64')}`);
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    });
}

function getDateParts(date) {
    const f = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE, year: 'numeric', month: '2-digit',
        day: '2-digit', weekday: 'short', hour12: false
    });
    const p = Object.fromEntries(f.formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    return { year: p.year, month: p.month, day: p.day, weekday: p.weekday };
}

function getGermanWeekday(date) {
    return new Intl.DateTimeFormat('de-DE', { timeZone: TIME_ZONE, weekday: 'long' }).format(date);
}

function getLabels(date) {
    const { month, day, year } = getDateParts(date);
    const en = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' }).format(date);
    const de = new Intl.DateTimeFormat('de-DE', { timeZone: TIME_ZONE, weekday: 'short' }).format(date).replace('.', '');
    const dm = `${day}.${month}`, dmy = `${day}.${month}.${year}`, dmy2 = `${day}.${month}.${year.slice(2)}`;
    return [dm, dmy, dmy2, en, de,
        `${en}, ${dm}`, `${de}, ${dm}`, `${en}, ${dmy}`, `${de}, ${dmy}`, `${en}, ${dmy2}`, `${de}, ${dmy2}`];
}

function getHighlightsForDate(events, date) {
    const labels = new Set(getLabels(date));
    return events
        .filter(e => !e.city || String(e.city).trim().toLowerCase() === 'bielefeld')
        .filter(e => labels.has(String(e.date || '').trim()))
        .filter(e => {
            const n = String(e.event || '').toLowerCase();
            return !EXCLUDED_ACCOUNTS.some(a => n.includes(`@${a}`)) &&
                   !EXCLUDED_ORGANIZERS.some(o => n.includes(o));
        })
        .filter(e => !EXCLUDED_CATS.has(String(e.category || '').toLowerCase()))
        .sort((a, b) => (/^\d{2}:\d{2}$/.test(a.time || '') ? a.time : '99:99')
            .localeCompare(/^\d{2}:\d{2}$/.test(b.time || '') ? b.time : '99:99'))
        .slice(0, MAX_HIGHLIGHTS);
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getCategoryStyle(v, i) {
    const c = String(v || '').trim().toLowerCase();
    const map = {
        kultur: { label: 'Kultur', accent: '#ef4444', background: '#ffe9e9' },
        musik: { label: 'Musik', accent: '#8b5cf6', background: '#f1eaff' },
        party: { label: 'Party', accent: '#ec4899', background: '#fce7f3' },
        ausgehen: { label: 'Ausgehen', accent: '#f97316', background: '#fff3e6' },
        'the tribe': { label: 'THE TRIBE', accent: '#111827', background: '#f3f4f6' },
        theater: { label: 'Theater', accent: '#dc2626', background: '#fee2e2' },
        comedy: { label: 'Comedy', accent: '#d97706', background: '#fef3c7' },
        kunst: { label: 'Kunst', accent: '#2563eb', background: '#dbeafe' },
        markt: { label: 'Markt', accent: '#059669', background: '#d1fae5' },
        festival: { label: 'Festival', accent: '#e11d48', background: '#ffe4e6' }
    };
    const fb = [
        { label: String(v || 'Event'), accent: '#f97316', background: '#fff3e6' },
        { label: String(v || 'Event'), accent: '#0ea5e9', background: '#e7f6ff' },
        { label: String(v || 'Event'), accent: '#16a34a', background: '#e9f8ee' }
    ];
    return map[c] || fb[i % fb.length];
}

function extractTitle(name) {
    return String(name || '').replace(/\s*\(@[^)]*\)\s*$/, '').replace(/\s*@\w+\s*$/, '').trim();
}

function extractVenue(name) {
    const m = String(name || '').match(/\(@([^)]+)\)/);
    if (!m) return 'Bielefeld';
    return m[1].replace(/_/g, ' ').replace(/\./g, ' ').split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function buildOverviewHtml(highlights, date) {
    const { day, month, year } = getDateParts(date);
    const germanDay = getGermanWeekday(date);

    const rows = highlights.map((e, i) => {
        const st = getCategoryStyle(e.category, i);
        const time = e.time || '–';
        const title = escapeHtml(extractTitle(e.event));
        const venue = escapeHtml(extractVenue(e.event));
        return `
        <div class="row">
            <div class="row-time">
                <span class="t">${escapeHtml(time)}</span>
                <span class="uhr">Uhr</span>
            </div>
            <div class="row-accent" style="background:${st.accent}"></div>
            <div class="row-info">
                <div class="row-title">${title}</div>
                <div class="row-venue">${venue}</div>
            </div>
            <span class="badge" style="background:${st.background};color:${st.accent}">${escapeHtml(st.label)}</span>
        </div>`;
    }).join('');

    return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:${GIF_WIDTH}px;height:${GIF_HEIGHT}px;overflow:hidden;
    font-family:Inter,ui-sans-serif,system-ui,sans-serif;
    background:radial-gradient(ellipse at 15% 10%,#fff7ed 0%,transparent 50%),
               radial-gradient(ellipse at 85% 90%,#ecfeff 0%,transparent 50%),
               #fafafa;
    color:#111827}
.poster{width:100%;height:100%;padding:38px 34px 30px;display:flex;flex-direction:column;gap:0}
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px}
.brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:16px;letter-spacing:-.2px}
.mark{width:26px;height:26px;border-radius:5px;background:#111827;color:#fff;display:grid;place-items:center;font-size:14px;font-weight:900}
.date-chip{font-size:12px;color:#6b7280;font-weight:600;background:#f3f4f6;padding:5px 10px;border-radius:20px}
.hero{margin-bottom:32px}
.weekday{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:6px}
h1{font-size:50px;line-height:.94;font-weight:900;letter-spacing:-1.5px;color:#111827}
h1 span{color:#6b7280}
.sub{font-size:14px;color:#6b7280;margin-top:10px;font-weight:500}
.events{display:flex;flex-direction:column;gap:13px;flex:1}
.row{display:flex;align-items:center;gap:12px;background:#fff;border-radius:10px;
    padding:14px 16px;box-shadow:0 2px 12px rgba(0,0,0,.06);border:1px solid rgba(0,0,0,.05)}
.row-time{display:flex;flex-direction:column;align-items:center;min-width:38px}
.t{font-size:17px;font-weight:900;line-height:1;color:#111827}
.uhr{font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-top:1px}
.row-accent{width:3px;height:38px;border-radius:2px;flex-shrink:0}
.row-info{flex:1;min-width:0}
.row-title{font-size:15px;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row-venue{font-size:11.5px;color:#9ca3af;font-weight:500;margin-top:2px}
.badge{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;
    padding:4px 8px;border-radius:20px;white-space:nowrap;flex-shrink:0}
footer{margin-top:20px;display:flex;justify-content:space-between;align-items:center}
.footer-text{font-size:11.5px;color:#9ca3af;font-weight:500}
.footer-link{font-size:11px;font-weight:700;color:#111827;background:#f3f4f6;padding:6px 12px;border-radius:20px}
</style></head><body><main class="poster">
<header>
    <div class="brand"><div class="mark">L</div>Liebefeld</div>
    <div class="date-chip">${escapeHtml(germanDay)}, ${escapeHtml(day)}.${escapeHtml(month)}.</div>
</header>
<div class="hero">
    <div class="weekday">Heute in Bielefeld</div>
    <h1>Tages<br><span>highlights</span></h1>
    <p class="sub">Unsere Top-3 Empfehlungen</p>
</div>
<div class="events">${rows}</div>
<footer>
    <span class="footer-text">Mehr unter</span>
    <span class="footer-link">liebefeld.lovable.app</span>
</footer>
</main></body></html>`;
}

function buildDetailHtml(event, index, total) {
    const st = getCategoryStyle(event.category, index);
    const time = event.time ? `${escapeHtml(event.time)} Uhr` : 'Heute';
    const title = escapeHtml(extractTitle(event.event));
    const venue = escapeHtml(extractVenue(event.event));
    const url = event.link
        ? escapeHtml(String(event.link).replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 38))
        : 'liebefeld.lovable.app';
    const imgUrl = event.image_url ? escapeHtml(String(event.image_url)) : null;

    const imageBg = imgUrl
        ? `background:url('${imgUrl}') center/cover no-repeat`
        : `background:linear-gradient(135deg,${st.accent} 0%,${st.accent}bb 100%)`;

    const progressDots = Array.from({ length: total }, (_, i) =>
        `<div class="dot${i === index ? ' active' : ''}" style="${i === index ? `background:${st.accent}` : ''}"></div>`
    ).join('');

    return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:${GIF_WIDTH}px;height:${GIF_HEIGHT}px;overflow:hidden;
    font-family:Inter,ui-sans-serif,system-ui,sans-serif;
    background:#111827;color:#111827}
.card{width:100%;height:100%;display:flex;flex-direction:column}
.img-area{height:310px;flex-shrink:0;position:relative;${imageBg}}
.img-overlay{position:absolute;inset:0;
    background:linear-gradient(to bottom,rgba(0,0,0,.1) 0%,rgba(0,0,0,.55) 100%)}
.img-top{position:absolute;top:18px;left:20px;right:20px;
    display:flex;justify-content:space-between;align-items:center}
.brand-pill{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.18);
    backdrop-filter:blur(8px);border-radius:20px;padding:6px 12px 6px 8px}
.mark-sm{width:20px;height:20px;border-radius:4px;background:#fff;color:#111827;
    display:grid;place-items:center;font-size:11px;font-weight:900}
.brand-name{font-size:12px;font-weight:700;color:#fff}
.counter{font-size:12px;font-weight:700;color:rgba(255,255,255,.8);
    background:rgba(0,0,0,.25);border-radius:20px;padding:5px 12px;backdrop-filter:blur(8px)}
.img-bottom{position:absolute;bottom:18px;left:20px;right:20px;
    display:flex;align-items:center;gap:6px}
.dots{display:flex;gap:5px;align-items:center}
.dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.35)}
.dot.active{width:18px;border-radius:3px}
.badge-img{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;
    padding:5px 10px;border-radius:20px;background:${st.background};color:${st.accent};margin-left:auto}

.content{flex:1;background:#fff;padding:24px 26px 22px;
    display:flex;flex-direction:column;gap:14px;overflow:hidden}
h2{font-size:28px;line-height:1.05;font-weight:900;letter-spacing:-.5px;color:#111827;
    display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.meta{display:flex;flex-direction:column;gap:7px}
.meta-row{display:flex;align-items:center;gap:10px}
.meta-icon{width:28px;height:28px;border-radius:7px;background:#f3f4f6;
    display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
.meta-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;width:40px;flex-shrink:0}
.meta-value{font-size:14px;font-weight:700;color:#374151}
.link-row{margin-top:auto;padding:10px 14px;background:#f8f9fa;border-radius:8px;
    border-left:3px solid ${st.accent}}
.link-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;margin-bottom:3px}
.link-val{font-size:12px;font-weight:600;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style></head><body><div class="card">
<div class="img-area">
    <div class="img-overlay"></div>
    <div class="img-top">
        <div class="brand-pill">
            <div class="mark-sm">L</div>
            <span class="brand-name">Liebefeld</span>
        </div>
        <div class="counter">${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</div>
    </div>
    <div class="img-bottom">
        <div class="dots">${progressDots}</div>
        <span class="badge-img">${escapeHtml(st.label)}</span>
    </div>
</div>
<div class="content">
    <h2>${title}</h2>
    <div class="meta">
        <div class="meta-row">
            <div class="meta-icon">&#128336;</div>
            <span class="meta-label">Zeit</span>
            <span class="meta-value">${time}</span>
        </div>
        <div class="meta-row">
            <div class="meta-icon">&#128205;</div>
            <span class="meta-label">Ort</span>
            <span class="meta-value">${venue}</span>
        </div>
    </div>
    <div class="link-row">
        <div class="link-label">Mehr Infos</div>
        <div class="link-val">${url}</div>
    </div>
</div>
</div></body></html>`;
}

async function renderSlide(page, html) {
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));
    const buf = await page.screenshot({ type: 'png' });
    return new Promise((resolve, reject) => {
        const png = new PNG();
        png.parse(buf, (err, data) => err ? reject(err) : resolve(data.data));
    });
}

function slideLeftFrame(rgbaA, rgbaB, progress) {
    const W = GIF_WIDTH, H = GIF_HEIGHT;
    const result = Buffer.alloc(W * H * 4);
    const offset = Math.round(W * progress);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const dst = (y * W + x) * 4;
            let srcX, src;
            if (x < W - offset) {
                srcX = x + offset;
                src = (y * W + srcX) * 4;
                rgbaA.copy(result, dst, src, src + 4);
            } else {
                srcX = x - (W - offset);
                src = (y * W + srcX) * 4;
                rgbaB.copy(result, dst, src, src + 4);
            }
        }
    }
    return result;
}

async function generateGif(highlights, date, outputPath) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: GIF_WIDTH, height: GIF_HEIGHT, deviceScaleFactor: 1 });

        console.log('  Pre-fetching images...');
        const imageCache = {};
        for (const h of highlights) {
            if (h.image_url && !imageCache[h.image_url]) {
                process.stdout.write(`  Fetching image...`);
                imageCache[h.image_url] = await fetchImageAsBase64(h.image_url);
                process.stdout.write(imageCache[h.image_url] ? ' ok\n' : ' failed\n');
            }
        }

        console.log('  Rendering slides...');

        const slides = [];
        slides.push(await renderSlide(page, buildOverviewHtml(highlights, date)));
        for (let i = 0; i < highlights.length; i++) {
            const h = { ...highlights[i], image_url: imageCache[highlights[i].image_url] || null };
            slides.push(await renderSlide(page, buildDetailHtml(h, i, highlights.length)));
            process.stdout.write(`  Slide ${i + 2} done\n`);
        }

        const encoder = new GIFEncoder(GIF_WIDTH, GIF_HEIGHT, 'neuquant', true);
        encoder.start();
        encoder.setRepeat(0);
        encoder.setQuality(15);

        process.stdout.write('  Encoding');

        for (let s = 0; s < slides.length; s++) {
            const current = slides[s];
            const next = slides[(s + 1) % slides.length];

            encoder.setDelay(HOLD_DELAY);
            for (let f = 0; f < HOLD_FRAMES; f++) {
                encoder.addFrame(current);
                process.stdout.write('.');
            }

            for (let t = 1; t <= TRANS_FRAMES; t++) {
                const progress = t / TRANS_FRAMES;
                const frame = slideLeftFrame(current, next, progress);
                encoder.setDelay(TRANS_DELAY);
                encoder.addFrame(frame);
                process.stdout.write('>');
            }
        }

        encoder.finish();
        process.stdout.write('\n');

        const buf = encoder.out.getData();
        fs.writeFileSync(outputPath, buf);
        console.log(`  Saved: ${outputPath} (${(buf.length / 1024).toFixed(0)} KB)`);

        await page.close();
    } finally {
        await browser.close();
    }
}

async function savePreviews(highlights, date) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: GIF_WIDTH, height: GIF_HEIGHT, deviceScaleFactor: 1.5 });
    fs.mkdirSync('output-gifs', { recursive: true });

    await page.setContent(buildOverviewHtml(highlights, date), { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'output-gifs/preview-overview.png', type: 'png' });

    const imgCache = {};
    for (const h of highlights) {
        if (h.image_url && !imgCache[h.image_url]) {
            imgCache[h.image_url] = await fetchImageAsBase64(h.image_url);
        }
    }
    for (let i = 0; i < highlights.length; i++) {
        const h = { ...highlights[i], image_url: imgCache[highlights[i].image_url] || null };
        await page.setContent(buildDetailHtml(h, i, highlights.length), { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 500));
        await page.screenshot({ path: `output-gifs/preview-detail-${i + 1}.png`, type: 'png' });
    }
    await browser.close();
}

async function main() {
    console.log('Fetching events...');
    const events = await fetchJson(EVENTS_URL);
    console.log(`Loaded ${events.length} events\n`);

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dates = [{ label: 'heute', date: now }, { label: 'morgen', date: tomorrow }];

    fs.mkdirSync('output-gifs', { recursive: true });

    let first = true;
    for (const { label, date } of dates) {
        const { day, month, year } = getDateParts(date);
        const highlights = getHighlightsForDate(events, date);
        console.log(`${label} (${day}.${month}.${year}): ${highlights.length} highlights`);
        highlights.forEach((h, i) => console.log(`  ${i + 1}. ${h.time || '?'} - ${extractTitle(h.event)} | img: ${h.image_url ? 'ja' : 'nein'}`));

        if (highlights.length === 0) {
            console.log('  Keine Events – GIF wird trotzdem generiert\n');
        }

        if (first) { await savePreviews(highlights, date); first = false; }

        const filename = `tageshighlights-${label}-${year}-${month}-${day}.gif`;
        await generateGif(highlights, date, path.join('output-gifs', filename));
        console.log();
    }

    console.log('Fertig! GIFs in ./output-gifs/');
}

main().catch(e => { console.error(e); process.exit(1); });
