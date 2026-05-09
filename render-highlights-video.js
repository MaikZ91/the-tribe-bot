// Tribe-style daily-highlights video module.
// Generates an 8.5s 1080x1080 MP4 in the v2-cinematic landing-page aesthetic.
// Export: generateDailyHighlightsVideo(dateOrKey) → outputPath
//
// The COVER frame stands on its own — it's a readable magazine-style
// list of today's events, so the WhatsApp preview already delivers value
// without the user pressing play. Each event slide adds a real
// description so links are no longer needed for context.
//
// Run:  node render-highlights-video.js
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

const EVENTS_URL = 'https://raw.githubusercontent.com/MaikZ91/productiontools/master/events.json';
const OUT_DIR = path.join(__dirname, '.video-test');
const FRAMES_DIR = path.join(OUT_DIR, 'frames');
const SIZE = 1080;
const FPS = 30;
const NUM_EVENTS = 5;
const COVER_MS = 1800;
const PER_EVENT_MS = 2000;
const OUTRO_MS = 700;

// ── Curation ──
// Lower-cased substrings checked against the @venue tag in the title.
// Any match adds +100 to the vibe score.
const VENUE_WHITELIST = [
  'forum', 'nrzp', 'nr_zp', 'nr-zp', 'nrzpark', 'numberzp',
  'stereo', 'stereobielefeld',
  'sams', 'sams_bielefeld',
  'hinterzimmer', 'cutie', 'cafe_europa', 'cafeeuropa',
  'movie', 'movie_bielefeld',
  'lokschuppen', 'ringlokschuppen',
  'kamp', 'plan_b', 'planb',
  'falkendom', 'jugendzentrum',
  'bunker_ulmenwall', 'bunker',
  'liv', 'liv_bielefeld',
  'sparrenburg',
];

const COOL_CATEGORIES = ['party', 'konzert', 'festival', 'comedy'];

// Substring match against title + description. Any match disqualifies the event.
const BLACKLIST_KEYWORDS = [
  'chor', 'kirche', 'pfarr', 'gottesdienst', 'oratorium', 'gemeinde', 'pastor',
  'posaune', 'blockflöte', 'blockfloete', 'shanty', 'volksmusik',
  'senior', 'silberlocken',
  'wochenmarkt', 'flohmarkt', 'trödel', 'troedel',
  'kindergottesdienst', 'kinderkonzert',
  'kino', 'cinemaxx', 'lichtwerk',
];

const CATEGORY_STYLE = {
  party:       { label: 'PARTY',     accent: '#EF4444' },
  musik:       { label: 'MUSIK',     accent: '#A78BFA' },
  konzert:     { label: 'KONZERT',   accent: '#A78BFA' },
  sport:       { label: 'SPORT',     accent: '#10B981' },
  kino:        { label: 'KINO',      accent: '#3B82F6' },
  ausgehen:    { label: 'AUSGEHEN',  accent: '#F59E0B' },
  kultur:      { label: 'KULTUR',    accent: '#EF4444' },
  theater:     { label: 'THEATER',   accent: '#DC2626' },
  comedy:      { label: 'COMEDY',    accent: '#D97706' },
  kunst:       { label: 'KUNST',     accent: '#3B82F6' },
  markt:       { label: 'MARKT',     accent: '#10B981' },
  festival:    { label: 'FESTIVAL',  accent: '#E11D48' },
  'the tribe': { label: 'THE TRIBE', accent: '#25D366' },
  default:     { label: 'EVENT',     accent: '#F59E0B' },
};

function styleFor(cat) {
  const k = (cat || '').toLowerCase().trim();
  return CATEGORY_STYLE[k] || CATEGORY_STYLE.default;
}

function todayKey(d = new Date()) {
  const tz = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  return tz.toISOString().slice(0, 10);
}

function germanDate(d = new Date()) {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin',
  }).format(d);
}

// Today is anything matching today's day-of-month + month in the date string.
function isToday(rawDate, now = new Date()) {
  if (!rawDate) return false;
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return rawDate.includes(`${dd}.${mm}`);
}

// Strip the trailing "(@venue)" tag from event titles so they read clean.
function cleanTitle(raw) {
  return String(raw || '').replace(/\s*\(@[^)]+\)\s*$/, '').trim();
}

function venueFrom(raw) {
  const m = /\(@([^)]+)\)\s*$/.exec(String(raw || ''));
  if (!m) return '';
  return m[1].replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}

function shorten(s, max) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/[\s.,;:!?-]+\S*$/, '') + '…';
}

async function downloadAsDataUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) return null; // skip 1x1 / placeholder
    const ct = res.headers.get('content-type') || 'image/jpeg';
    if (!/^image\//.test(ct)) return null;
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch (e) {
    return null;
  }
}

function venueTag(raw) {
  // Extract everything inside (@...) lower-cased, no punctuation
  const m = /\(@([^)]+)\)\s*$/.exec(String(raw || ''));
  if (!m) return '';
  return m[1].toLowerCase().replace(/[\s.,'"-]/g, '');
}

function vibeScore(e) {
  const title = String(e.event || '').toLowerCase();
  const desc  = String(e.description || '').toLowerCase();
  const cat   = String(e.category || '').toLowerCase();
  const t     = (e.time || '00:00');
  const tag   = venueTag(e.event);

  // Hard kill on any blacklist keyword anywhere
  for (const k of BLACKLIST_KEYWORDS) {
    if (title.includes(k) || desc.includes(k)) return -1000;
  }

  let s = 0;
  if (VENUE_WHITELIST.some(v => tag.includes(v))) s += 100;
  if (COOL_CATEGORIES.some(c => cat.includes(c))) s += 50;

  // Time gates (later = more nightlife = cooler for our audience)
  if (t >= '18:00') s += 30;
  if (t >= '22:00') s += 20;

  if (e.image_url) s += 5;
  if (e.description && e.description.length > 40) s += 5;

  return s;
}

// Cleaner description: take the first sentence. If it's just a repeat of the title
// or too short, take the second too. Aim for 80–110 chars.
function trimDescription(rawDesc, title) {
  const desc = String(rawDesc || '').replace(/\s+/g, ' ').trim();
  if (!desc) return '';
  const sentences = desc.split(/(?<=[.!?])\s+/).filter(s => s.length > 0);
  const titleLow = title.toLowerCase().slice(0, 25);
  let pick = '';
  for (const s of sentences) {
    if (s.toLowerCase().slice(0, 25) === titleLow) continue; // skip "EventName ..." repeats
    pick = s.trim();
    if (pick.length >= 40) break;
    if (pick.length < 40 && sentences.indexOf(s) < sentences.length - 1) continue;
  }
  if (!pick) pick = sentences[0];
  // If still too short, append next sentence
  if (pick.length < 50 && sentences.length > 1) {
    const next = sentences.find(s => s !== pick && s.toLowerCase().slice(0, 25) !== titleLow);
    if (next) pick = pick + ' ' + next;
  }
  return shorten(pick, 110);
}

async function pickHighlights(date = new Date()) {
  const res = await fetch(EVENTS_URL);
  const all = await res.json();
  const events = Array.isArray(all) ? all : (all.events || []);
  // Bielefeld events have no `city` field (default); other cities are tagged explicitly.
  const today = events.filter(e => isToday(e.date, date) && (!e.city || e.city === 'Bielefeld'));

  // Score everything, drop blacklisted (-1000), keep things scoring ≥ 50.
  const scored = today
    .filter(e => e.event)
    .map(e => ({ raw: e, score: vibeScore(e) }))
    .filter(x => x.score >= 50)
    .sort((a, b) => b.score - a.score || (a.raw.time || '').localeCompare(b.raw.time || ''));

  // Take top N, then resort by time-of-day so the video reads chronologically.
  const top = scored.slice(0, NUM_EVENTS).map(x => x.raw);
  top.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  return top.map(e => ({
    time:        e.time || '00:00',
    titleClean:  cleanTitle(e.event),
    venue:       venueFrom(e.event),
    style:       styleFor(e.category),
    description: trimDescription(e.description, cleanTitle(e.event)),
    image_url:   e.image_url,
    link:        e.link,
    score:       vibeScore(e),
  }));
}

function buildHtml(items, dateLabel) {
  // items already have base64 image data in `image`.
  const data = JSON.stringify({
    items,
    timing: { COVER_MS, PER_EVENT_MS, OUTRO_MS },
    dateLabel,
  });

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=Familjen+Grotesk:wght@400;500;600;700&display=swap');
  :root {
    --black: #0A0807; --black-soft: #141110;
    --amber: #F59E0B; --concert: #DC2626;
    --whatsapp: #25D366; --text: #F5F0E8; --muted: #9C9690;
    --rule: rgba(245,240,232,0.14);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${SIZE}px; height: ${SIZE}px; background: var(--black); overflow: hidden;
               font-family: 'Familjen Grotesk', sans-serif; color: var(--text); }
  .stage { position: relative; width: 100%; height: 100%; }
  .scene { position: absolute; inset: 0; opacity: 0; visibility: hidden; }
  .scene.on { opacity: 1; visibility: visible; }
  .stage::after { content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 50;
    opacity: 0.28; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"); }

  /* ── COVER — magazine sheet, fully readable as a static preview ── */
  .cover { background: var(--black); padding: 32px 40px; display: flex; flex-direction: column; }
  .cover-head { display: flex; justify-content: space-between; align-items: baseline;
                border-bottom: 1px solid var(--rule); padding-bottom: 16px; margin-bottom: 18px; }
  .cover-head .title { font-family: 'Anton', sans-serif; font-size: 54px; line-height: 0.92;
                       text-transform: uppercase; }
  .cover-head .title em { font-style: normal; color: var(--amber); }
  .cover-head .date  { font-family: 'Anton', sans-serif; font-size: 18px; letter-spacing: 0.04em;
                       text-transform: uppercase; color: var(--muted); text-align: right; line-height: 1.05; }
  .cover-list { flex: 1; display: flex; flex-direction: column; gap: 14px; }
  .cover-row { display: grid; grid-template-columns: 130px 1fr; gap: 18px; align-items: center;
               border-left: 4px solid var(--accent); padding-left: 16px; min-height: 130px; }
  .cover-row .thumb { width: 130px; height: 130px; overflow: hidden; background: var(--black-soft); }
  .cover-row .thumb img { width: 100%; height: 100%; object-fit: cover; }
  .cover-row .meta { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
  .cover-row .top  { font-family: 'Familjen Grotesk', sans-serif; font-weight: 600;
                     font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase;
                     margin-bottom: 4px; color: var(--accent); }
  .cover-row .top .time { color: var(--text); }
  .cover-row .name { font-family: 'Anton', sans-serif; font-size: 30px; line-height: 0.95;
                     text-transform: uppercase; color: var(--text); margin-bottom: 4px;
                     display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .cover-row .venue { font-size: 13px; color: var(--muted); letter-spacing: 0.04em;
                      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cover-foot { margin-top: 12px; padding-top: 14px; border-top: 1px solid var(--rule);
                display: flex; justify-content: space-between; align-items: center; }
  .cover-foot .stamp { font-family: 'Anton', sans-serif; font-size: 14px;
                       letter-spacing: 0.18em; text-transform: uppercase; }
  .cover-foot .stamp em { font-style: normal; color: var(--whatsapp); }
  .cover-foot .arrow { font-family: 'Anton', sans-serif; font-size: 24px; color: var(--amber); }

  /* ── EVENT scene ── */
  .event { background: var(--black); }
  .event .photo { position: absolute; inset: 0; overflow: hidden; }
  .event .photo img { width: 100%; height: 100%; object-fit: cover; transform-origin: center; }
  .event .photo::after { content: ""; position: absolute; inset: 0;
    background: linear-gradient(to top,
      rgba(10,8,7,0.97) 0%, rgba(10,8,7,0.85) 22%, rgba(10,8,7,0.30) 50%,
      rgba(10,8,7,0)    65%, rgba(10,8,7,0.65) 100%); }
  .event .top { position: absolute; top: 30px; left: 36px; right: 36px;
    display: flex; justify-content: space-between; align-items: baseline; z-index: 2; }
  .event .num { font-family: 'Anton', sans-serif; font-size: 84px; line-height: 0.85; color: var(--accent); }
  .event .cat { font-family: 'Familjen Grotesk', sans-serif; font-weight: 600;
    font-size: 13px; letter-spacing: 0.28em; text-transform: uppercase; padding: 8px 14px;
    background: rgba(0,0,0,0.55); color: var(--text); backdrop-filter: blur(4px); }
  .event .body { position: absolute; left: 36px; right: 36px; bottom: 40px; z-index: 2; }
  .event .title { font-family: 'Anton', sans-serif; font-size: 76px; line-height: 0.92;
                  text-transform: uppercase; color: var(--text); margin-bottom: 14px;
                  /* clamp to 3 lines max */
                  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .event .meta { display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
                 font-family: 'Anton', sans-serif; font-size: 22px; text-transform: uppercase;
                 letter-spacing: 0.04em; }
  .event .meta .time  { color: var(--accent); }
  .event .meta .dot   { width: 5px; height: 5px; background: var(--text); opacity: 0.5; border-radius: 50%; }
  .event .meta .venue { color: var(--text); opacity: 0.9; }
  .event .desc { font-size: 19px; line-height: 1.42; color: var(--text); opacity: 0.92;
                 max-width: 820px;
                 /* clamp to 4 lines */
                 display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }

  /* ── OUTRO ── */
  .outro { background: var(--black); display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; padding: 60px; }
  .outro::before { content: ""; position: absolute; inset: -20% -20% auto -20%; height: 70%;
    background: radial-gradient(ellipse at 50% 30%, rgba(37,211,102,0.22), transparent 60%); }
  .outro .stamp { position: relative; z-index: 2; font-family: 'Familjen Grotesk', sans-serif;
    font-weight: 600; font-size: 14px; letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--whatsapp); margin-bottom: 24px; }
  .outro h1 { position: relative; z-index: 2; font-family: 'Anton', sans-serif; font-size: 96px;
    line-height: 0.9; text-transform: uppercase; color: var(--text); margin-bottom: 18px; }
  .outro h1 em { font-style: normal; color: var(--amber); }
  .outro .sub { position: relative; z-index: 2; font-size: 22px; opacity: 0.85; max-width: 760px;
    line-height: 1.4; }
  .outro .brand { position: absolute; bottom: 40px; left: 0; right: 0; text-align: center; z-index: 2;
    font-family: 'Anton', sans-serif; font-size: 18px; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.7; }
</style></head>
<body>
<div class="stage">

  <!-- COVER -->
  <section class="scene cover" id="scene-cover">
    <div class="cover-head">
      <div class="title">Heute<br><em>in Bielefeld</em></div>
      <div class="date" id="cover-date"></div>
    </div>
    <div class="cover-list" id="cover-list"></div>
    <div class="cover-foot">
      <div class="stamp">Tageshighlights · <em>The Tribe Bielefeld</em></div>
      <div class="arrow">▶</div>
    </div>
  </section>

  <div id="event-scenes-mount"></div>

  <!-- OUTRO -->
  <section class="scene outro" id="scene-outro">
    <div class="stamp">— mehr in der Tribe —</div>
    <h1>Komm <em>vorbei.</em></h1>
    <div class="sub">Tageshighlights jeden Morgen direkt in der WhatsApp-Gruppe. Diskussion + spontane Pläne inklusive.</div>
    <div class="brand">The Tribe · Bielefeld</div>
  </section>

</div>

<script>
const DATA = ${data};

(function init(){
  const items = DATA.items;
  document.getElementById('cover-date').textContent = DATA.dateLabel;

  // Build cover rows (one per event)
  const coverList = document.getElementById('cover-list');
  items.forEach((it, i) => {
    const row = document.createElement('div');
    row.className = 'cover-row';
    row.id = 'cover-row-' + i;
    row.style.setProperty('--accent', it.style.accent);
    row.innerHTML =
      '<div class="thumb"><img src="' + it.image + '"></div>' +
      '<div class="meta">' +
        '<div class="top"><span class="time">' + it.time + ' Uhr</span> · <span class="cat">' + it.style.label + '</span></div>' +
        '<div class="name">' + it.titleClean.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>' +
        '<div class="venue">' + (it.venue || '') + '</div>' +
      '</div>';
    coverList.appendChild(row);
  });

  // Build event scenes (one per item)
  const mount = document.getElementById('event-scenes-mount');
  items.forEach((it, i) => {
    const sec = document.createElement('section');
    sec.className = 'scene event';
    sec.id = 'scene-ev-' + i;
    sec.style.setProperty('--accent', it.style.accent);
    sec.innerHTML =
      '<div class="photo"><img src="' + it.image + '"></div>' +
      '<div class="top">' +
        '<span class="num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="cat">' + it.style.label + '</span>' +
      '</div>' +
      '<div class="body">' +
        '<div class="title">' + it.titleClean.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>' +
        '<div class="meta">' +
          '<span class="time">' + it.time + ' UHR</span>' +
          '<span class="dot"></span>' +
          '<span class="venue">' + (it.venue || 'BIELEFELD') + '</span>' +
        '</div>' +
        '<div class="desc">' + (it.description || '').replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>' +
      '</div>';
    mount.appendChild(sec);
  });
})();

const T = DATA.timing;
const NUM = DATA.items.length;
const SCENES = [];
SCENES.push({ id: 'scene-cover', start: 0, end: T.COVER_MS });
for (let i = 0; i < NUM; i++) {
  SCENES.push({
    id: 'scene-ev-' + i,
    start: T.COVER_MS + i * T.PER_EVENT_MS,
    end:   T.COVER_MS + (i + 1) * T.PER_EVENT_MS,
  });
}
SCENES.push({
  id: 'scene-outro',
  start: T.COVER_MS + NUM * T.PER_EVENT_MS,
  end:   T.COVER_MS + NUM * T.PER_EVENT_MS + T.OUTRO_MS,
});
const TOTAL = T.COVER_MS + NUM * T.PER_EVENT_MS + T.OUTRO_MS;
function ease(p){ return p<0.5 ? 2*p*p : 1 - Math.pow(-2*p+2, 2)/2; }

window.__totalMs = TOTAL;
window.__renderAt = function(t){
  const active = SCENES.find(s => t >= s.start && t < s.end) || SCENES[SCENES.length-1];
  document.querySelectorAll('.scene').forEach(el => el.classList.toggle('on', el.id === active.id));
  const local = t - active.start;
  const dur = active.end - active.start;
  const p = Math.min(1, local / dur);

  if (active.id === 'scene-cover') {
    // The cover stays mostly static so it works as a still preview, but we
    // do a very subtle 0→0.5 fade-up on the rows so the eye lands on them.
    document.querySelectorAll('.cover-row').forEach((row, i) => {
      const tStart = i * 80;
      const inP = Math.min(1, Math.max(0, (local - tStart) / 350));
      row.style.opacity = ease(inP);
      row.style.transform = 'translateY(' + (10 * (1 - ease(inP))) + 'px)';
    });
  } else if (active.id.startsWith('scene-ev-')) {
    const sc = document.getElementById(active.id);
    const img = sc.querySelector('.photo img');
    const body = sc.querySelector('.body');
    const top = sc.querySelector('.top');

    const zoom = 1.04 + 0.10 * p;
    const dx = -20 * p, dy = -10 * p;
    img.style.transform = 'scale(' + zoom + ') translate(' + dx + 'px, ' + dy + 'px)';

    const inP  = Math.min(1, local / 380);
    const outP = Math.min(1, Math.max(0, (dur - local) / 280));
    const showP = Math.min(inP, outP);

    body.style.transform = 'translateY(' + (28 * (1 - ease(showP))) + 'px)';
    body.style.opacity   = ease(showP);
    top.style.opacity    = ease(inP);
  } else if (active.id === 'scene-outro') {
    const inP = Math.min(1, local / 350);
    document.querySelectorAll('.outro h1, .outro .sub, .outro .stamp').forEach(el => {
      el.style.opacity = ease(inP);
      el.style.transform = 'translateY(' + (16 * (1 - ease(inP))) + 'px)';
    });
  }
};
window.__renderAt(0);
</script></body></html>`;
}

async function ensureCleanDir(dir) {
  await fs.promises.rm(dir, { recursive: true, force: true });
  await fs.promises.mkdir(dir, { recursive: true });
}

async function captureFrames(html, totalMs) {
  await ensureCleanDir(FRAMES_DIR);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });
  // 'load' instead of 'networkidle0' so we don't hang on long-poll connections
  // that stay open after fonts/images are already in the DOM.
  await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 500));

  const frameMs = 1000 / FPS;
  const totalFrames = Math.round(totalMs / frameMs);
  console.log(`Capturing ${totalFrames} frames at ${FPS}fps over ${totalMs}ms ...`);

  for (let i = 0; i < totalFrames; i++) {
    const t = Math.round(i * frameMs);
    await page.evaluate(t => window.__renderAt(t), t);
    await page.screenshot({
      path: path.join(FRAMES_DIR, `frame-${String(i).padStart(4, '0')}.png`),
      omitBackground: false,
    });
    if ((i + 1) % 30 === 0) process.stdout.write(`  ${i + 1}/${totalFrames}\n`);
  }
  await browser.close();
  return totalFrames;
}

function stitch(outFile) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y', '-framerate', String(FPS),
      '-i', path.join(FRAMES_DIR, 'frame-%04d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-preset', 'medium', '-crf', '20',
      '-movflags', '+faststart',
      outFile,
    ];
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('exit', code => code === 0 ? resolve() : reject(new Error('ffmpeg exit ' + code)));
  });
}

async function generateDailyHighlightsVideo(date = new Date(), { label } = {}) {
  await fs.promises.mkdir(OUT_DIR, { recursive: true });

  const log = label ? (msg) => console.log(`[${label}] ${msg}`) : console.log;

  log('Picking today highlights from events.json ...');
  let picked;
  try {
    picked = await pickHighlights(date);
  } catch (e) {
    throw new Error(`Failed to pick highlights: ${e.message}`);
  }
  if (picked.length < 1) throw new Error('no highlights for today');
  log(`Picked ${picked.length} events:`);
  for (const e of picked) log(`  - ${e.time} ${e.style.label.padEnd(10)} ${e.titleClean}`);

  log('Downloading event images ...');
  for (const e of picked) {
    e.image = await downloadAsDataUrl(e.image_url);
    if (!e.image) {
      log(`  ! image failed: ${e.titleClean}`);
      // fallback: solid color block
      e.image = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="%23141110"/></svg>';
    }
  }

  const html = buildHtml(picked, germanDate(date));
  await fs.promises.writeFile(path.join(OUT_DIR, 'preview.html'), html);

  const totalMs = COVER_MS + PER_EVENT_MS * picked.length + OUTRO_MS;
  await captureFrames(html, totalMs);
  const out = path.join(OUT_DIR, `highlights-${todayKey(date)}.mp4`);
  await stitch(out);
  log(`✓ Wrote ${out}`);
  return out;
}

// Standalone mode (node render-highlights-video.js)
if (require.main === module) {
  (async () => {
    try {
      const out = await generateDailyHighlightsVideo();
      console.log(`Done: ${out}`);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  })();
}

module.exports = { generateDailyHighlightsVideo };