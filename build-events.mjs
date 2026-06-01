/* ============================================================
   build-events.mjs — generates all Tribe event subpages into docs/
   Look: "After Dark" black theme (docs/assets/club.css + club.js).
   Bespoke copy lives in events.content.json (one source of truth);
   page metadata (dates, photos, glyphs, relations) lives in BASE below.
   Run: node build-events.mjs
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WA = 'https://chat.whatsapp.com/CTbK6Xi8QHRExmoXhkaqvL';
const OG = 'https://maikz91.github.io/the-tribe-bot/assets/gruppe.webp';

const I = {
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.6 6.31a7.94 7.94 0 0 0-5.6-2.31C7.58 4 4 7.58 4 12c0 1.42.37 2.81 1.07 4.03L4 20l4.07-1.05A7.94 7.94 0 0 0 12 19.94c4.42 0 8-3.58 8-8 0-2.13-.84-4.16-2.4-5.63ZM12 18.5c-1.27 0-2.51-.34-3.6-.99l-.26-.15-2.42.63.65-2.36-.17-.27A6.5 6.5 0 1 1 12 18.5Z"/></svg>'
};

const POSTHOG = (variant) => `<script>
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init me ws ys ps bs capture je Di ks register register_once register_for_session unregister unregister_for_session Ps getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Es $s createPersonProfile Is opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing Ss debug L qs getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  try{posthog.init('phc_ktsJAdQbuZh9PbsdX7RxZdTWZjEgkZLHAyB7kzb9eG6t',{
    api_host:'https://eu.i.posthog.com',person_profiles:'always',capture_pageview:true,capture_pageleave:true,
    autocapture:true,session_recording:{maskAllInputs:true},enable_heatmaps:true});
  posthog.register({landing_variant:'${variant}'});}catch(e){}
</script>`;

/* page metadata (not copy) */
const BASE = {
  'social-warm-up':{titleHtml:'Social <em>Warm&nbsp;Up</em>', kind:'entry', price:0, photo:'assets/hero-bg.jpg',
    kicker:'Kostenlos · jeden Samstag', when:'Samstag · 18:00', where:'Bernstein, Altstadt', duration:'offenes Ende', priceLabel:'Kostenlos',
    bookSub:'Kostenloses Event · Entry Point', related:['laufgruppe','wine-walk','pub-crawl']},
  'laufgruppe':{titleHtml:'Lauf<em>gruppe</em>', kind:'free', price:0, glyph:'L',
    kicker:'Kostenlos · jeden Mittwoch', when:'Mittwoch · 19:00', where:'Treffpunkt in der Gruppe', duration:'45–60 Min', priceLabel:'Kostenlos',
    bookSub:'Kostenloses Event', related:['boulder-beer','sauna','social-warm-up']},
  'stadion-kick':{titleHtml:'Stadion-<em>Kick</em>', kind:'free', price:0, glyph:'K',
    kicker:'Kostenlos · an Spieltagen', when:'Sonntag · Spieltags', where:'Bürgerpark & SchücoArena', duration:'der Nachmittag', priceLabel:'Kostenlos',
    bookSub:'Kostenloses Event', related:['pub-crawl','social-warm-up','laufgruppe']},
  'wine-walk':{titleHtml:'Wine <em>Walk</em>', kind:'prem', price:25, photo:'assets/wine/cheers.jpg',
    kicker:'Premium-Event', when:'Freitag · 18:30', where:'Bürgerpark → Obersee', duration:'ca. 2,5 Std', priceLabel:'25 € / Person',
    bookSub:'Premium-Event · Einzelticket', related:['supper-club','buchclub','pub-crawl']},
  'buchclub':{titleHtml:'Book <em>Club</em>', kind:'prem', price:12, glyph:'B',
    kicker:'Premium-Event · monatlich', when:'Mittwoch · 19:30', where:'wechselndes Café', duration:'ca. 2,5 Std', priceLabel:'12 € / Person',
    bookSub:'Premium-Event · Einzelticket', related:['wine-walk','supper-club','sauna']},
  'pub-crawl':{titleHtml:'Pub <em>Crawl</em>', kind:'prem', price:15, photo:'assets/ad/bar.jpg',
    kicker:'Premium-Event · monatlich', when:'Freitag · 20:00', where:'Altstadt Bielefeld', duration:'ca. 4 Std', priceLabel:'15 € / Person',
    bookSub:'Premium-Event · Einzelticket', related:['tribe-concert','social-warm-up','wine-walk']},
  'techno-paint':{titleHtml:'Techno <em>&amp; Paint</em>', kind:'prem', price:29, glyph:'&amp;',
    kicker:'Premium-Special · monatlich', when:'Sonntag · 16:00', where:'Studio / Atelier', duration:'ca. 3 Std', priceLabel:'29 € · Material inkl.',
    bookSub:'Premium-Special · Einzelticket', related:['tribe-concert','pub-crawl','supper-club']},
  'supper-club':{titleHtml:'Supper <em>Club</em>', kind:'prem', price:34, glyph:'S',
    kicker:'Premium-Special · monatlich', when:'Freitag · 19:00', where:'wechselnde Location', duration:'ca. 3 Std', priceLabel:'34 € · 3 Gänge',
    bookSub:'Premium-Special · Einzelticket', related:['wine-walk','buchclub','sauna']},
  'boulder-beer':{titleHtml:'Boulder <em>&amp; Beer</em>', kind:'prem', price:18, glyph:'&amp;',
    kicker:'Premium-Special · monatlich', when:'Samstag · 17:00', where:'Boulderhalle Bielefeld', duration:'ca. 2,5 Std', priceLabel:'18 € · Eintritt inkl.',
    bookSub:'Premium-Special · Einzelticket', related:['laufgruppe','sauna','social-warm-up']},
  'sauna':{titleHtml:'Sauna <em>&amp; Cold&nbsp;Plunge</em>', kind:'prem', price:24, glyph:'≈',
    kicker:'Premium-Special · Sonntags', when:'Sonntag · 09:00', where:'Sauna / Therme', duration:'ca. 2,5 Std', priceLabel:'24 € / Person',
    bookSub:'Premium-Special · Einzelticket', related:['laufgruppe','boulder-beer','buchclub']},
  'tribe-concert':{titleHtml:'Tribe <em>Concert</em>', kind:'flag', price:22, photo:'assets/ad/concert.jpg',
    kicker:'Flagship · streng limitiert', when:'Samstag · 19:30', where:'Live-Venue Bielefeld', duration:'der ganze Abend', priceLabel:'22 € · Members-Preis',
    bookSub:'Flagship · Members-Preis', related:['pub-crawl','techno-paint','wine-walk']},
  'foto-walk':{titleHtml:'Foto <em>Walk</em>', kind:'prem', price:15, glyph:'◉',
    kicker:'Premium-Event · monatlich', when:'Samstag · 17:00', where:'Altstadt → Sparrenburg', duration:'ca. 2,5 Std', priceLabel:'15 € / Person',
    bookSub:'Premium-Event · Einzelticket', related:['wine-walk','techno-paint','social-warm-up']},
  'dj-workshop':{titleHtml:'DJ <em>Workshop</em>', kind:'prem', price:39, glyph:'♫',
    kicker:'Premium-Special · monatlich', when:'Samstag · 15:00', where:'Studio / Proberaum', duration:'ca. 3 Std', priceLabel:'39 € · Equipment inkl.',
    bookSub:'Premium-Special · Einzelticket', related:['techno-paint','tribe-concert','pub-crawl']},
};
const TITLE = {'social-warm-up':'Social Warm Up','laufgruppe':'Laufgruppe','stadion-kick':'Stadion-Kick','wine-walk':'Wine Walk','buchclub':'Book Club','pub-crawl':'Pub Crawl','techno-paint':'Techno & Paint','supper-club':'Supper Club','boulder-beer':'Boulder & Beer','sauna':'Sauna & Cold Plunge','tribe-concert':'Tribe Concert','foto-walk':'Foto Walk','dj-workshop':'DJ Workshop'};
const SIG_LABEL = {route:'Die Route',tour:'Die Tour',menu:'Das Menü',lineup:'Der Abend',ablauf:'Der Ablauf','aufguss-ablauf':'Der Ablauf',matchday:'Der Spieltag',pick:'Das Buch',timeline:'So läuft’s',levels:'Für jedes Level',dresscode:'Dresscode',runde:'Die Runde',firstnight:'Dein erster Abend'};
const TAG = {entry:{c:'tagp--entry',t:'Entry Point'},free:{c:'tagp--free',t:'Free'},prem:{c:'tagp--prem',t:'Premium'},flag:{c:'tagp--flag',t:'Flagship'}};

const content = JSON.parse(readFileSync(join(process.cwd(),'events.content.json'),'utf8'));
const bySlug = {};
for(const c of content){ bySlug[c.slug] = { ...BASE[c.slug], ...c, title: TITLE[c.slug] }; }

const split = s => { const i = s.split(/\s*::\s*/); return {h:i[0], p:i.slice(1).join(' :: ')}; };

function relatedCard(slug){
  const e = bySlug[slug]; if(!e) return '';
  const priceBit = e.price>0 ? ` <span class="hideable-price">· ${e.price} €</span>` : ' · Frei';
  return `<a class="rel" href="${e.slug}.html" data-cta="rel-${e.slug}" style="--ev:${e.accent};--ev2:${e.accent2}">
        <p class="rk">${TAG[e.kind].t}${priceBit}</p>
        <h3>${e.title} <span class="arr">→</span></h3>
        <p>${e.heroTagline}</p>
      </a>`;
}

function page(e){
  const free = e.price<=0;
  const variant = 'event-'+e.slug;
  const og = e.photo ? `https://maikz91.github.io/the-tribe-bot/${e.photo}` : OG;

  const cover = e.photo
    ? `<section class="feature feature--photo">
    <div class="fbg"><img src="${e.photo}" alt="" fetchpriority="high" decoding="async"></div>
    <div class="wrap">
      <a class="back" href="premium.html#programme" data-cta="back">${I.back} Programm</a>
      <p class="ek">${e.kicker}</p>
      <h1>${e.titleHtml}</h1>
      <p class="ftag">${e.heroTagline}</p>
      <p class="fsub">${e.heroDeck}</p>
    </div>
  </section>`
    : `<section class="feature feature--type">
    <span class="glyph" aria-hidden="true">${e.glyph||'✦'}</span>
    <div class="wrap">
      <a class="back" href="premium.html#programme" data-cta="back">${I.back} Programm</a>
      <p class="ek">${e.kicker}</p>
      <h1>${e.titleHtml}</h1>
      <p class="ftag">${e.heroTagline}</p>
      <p class="fsub">${e.heroDeck}</p>
    </div>
  </section>`;

  const sigItems = e.signatureItems.map(s=>{const {h,p}=split(s);
    return `<div class="sig-item rise"><span class="sig-n">·</span><div class="sig-b"><h3>${h}</h3><p>${p}</p></div></div>`;}).join('\n      ');
  const expectRows = e.expect.map((s,i)=>{const {h,p}=split(s);
    return `<div class="xrow rise"><span class="xn">0${i+1}</span><div><h3>${h}</h3><p>${p}</p></div></div>`;}).join('\n      ');
  const inclLis = e.includes.map(t=>`<li>${I.check}${t}</li>`).join('');
  const sigLabel = SIG_LABEL[e.signatureKind] || 'Das Besondere';

  /* booking */
  const qtyBlock = free ? '' : `<div class="qty">
          <span class="qlbl">Anzahl</span>
          <div class="qctrl"><button class="qbtn" data-q="-" aria-label="weniger" disabled>−</button><span class="qval">1</span><button class="qbtn" data-q="+" aria-label="mehr">+</button></div>
        </div>`;
  const payLabel = free ? 'Kostenlos dabei sein' : `Platz sichern · ${e.price} €`;
  const payIcon = free ? I.wa+' ' : '';
  const secure = free
    ? `<div class="bk-secure">${I.wa} Öffnet WhatsApp · einfach vorbeikommen</div>`
    : `<div class="bk-secure">${I.lock} Sichere Zahlung · begrenzte Plätze</div>`;
  const premNote = free
    ? `<div class="bk-prem" style="border-color:rgba(39,211,103,.4)"><b style="color:var(--wa)">Immer kostenlos.</b> Teil der Basis-Mitgliedschaft — einfach dabei sein.</div>`
    : `<div class="bk-prem"><b>Premium-Mitglied?</b> Dann ist dieses Event <a href="premium.html#models">bereits inklusive</a> — kein Einzelkauf nötig.</div>`;
  const priceHead = free
    ? `<div class="bk-price"><span data-total>Frei</span></div>`
    : `<div class="bk-price"><span data-total>${e.price}&nbsp;€</span><span class="per"> / Person</span></div>`;

  const booking = `<div class="booking rise d1" data-booking data-book="${e.title}" data-amount="${e.price}" data-max="10">
      <div class="bk-top">
        <div class="bk-name">${e.title}<small>${e.bookSub}</small></div>
        ${priceHead}
      </div>
      <div class="bk-body">
        <ul class="incl">${inclLis}</ul>
        ${qtyBlock}
        <button class="btn btn--gold btn--block" data-pay data-cta="book-${e.slug}"><span data-paylabel>${payIcon}${payLabel}</span></button>
        ${secure}
        ${premNote}
      </div>
    </div>`;

  const stickyLabel = free ? 'Kostenlos dabei' : `Buchen · ${e.price} €`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0B0A09">
<meta name="description" content="The Tribe — ${e.title}: ${e.heroDeck}">
<title>${e.title} — The Tribe Bielefeld</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%230B0A09'/><text x='16' y='23' font-family='Georgia,serif' font-size='21' fill='%23D7B24C' text-anchor='middle' font-style='italic'>T</text></svg>">
<meta property="og:type" content="website">
<meta property="og:title" content="${e.title} — The Tribe Bielefeld">
<meta property="og:description" content="${e.heroTagline} ${e.heroDeck}">
<meta property="og:image" content="${og}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="assets/fonts/familjen-grotesk-latin.woff2" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=DM+Mono:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
${e.photo?`<link rel="preload" as="image" href="${e.photo}" fetchpriority="high">`:''}
<link rel="stylesheet" href="assets/club.css">
</head>
<body data-variant="${variant}" style="--ev:${e.accent};--ev2:${e.accent2}">

${POSTHOG(variant)}

<header class="masthead" id="masthead">
  <div class="mh-in">
    <a class="wordmark" href="premium.html">The&nbsp;Tribe <small>Journal</small></a>
    <nav class="mh-nav" aria-label="Seiten">
      <a class="hide-sm" href="premium.html#programme">Programm</a>
      <a class="hide-sm" href="premium.html#models">Mitgliedschaft</a>
      <a href="#book" data-cta="nav-book">${free?'Mitmachen →':'Buchen →'}</a>
    </nav>
  </div>
</header>

<main>

${cover}

<!-- INTRO + LEDGER -->
<section class="band">
  <div class="wrap">
    <div class="idx rise"><span class="no">01</span> Worum es geht <span class="ln"></span></div>
    <div class="body-copy rise d1">
      <p class="dropcap">${e.intro1}</p>
      <p>${e.intro2}</p>
    </div>
    <p class="pullq rise d1">${stripQuotes(e.pullQuote)}</p>

    <div class="idx rise" style="margin-top:clamp(44px,6vw,76px)"><span class="no">·</span> Die Eckdaten <span class="ln"></span></div>
    <div class="ledger rise d1">
      <div class="row"><span class="k">Wann</span><span class="v">${e.when}</span></div>
      <div class="row"><span class="k">Wo</span><span class="v">${e.where}</span></div>
      <div class="row"><span class="k">Dauer</span><span class="v">${e.duration}</span></div>
      <div class="row${free?'':' row--price'}"><span class="k">Preis</span><span class="v">${free?'<span class="free">Kostenlos</span>':e.priceLabel}</span></div>
    </div>
  </div>
</section>

<!-- SIGNATURE -->
<section class="band band--paper2">
  <div class="wrap">
    <div class="idx rise"><span class="no">02</span> ${sigLabel} <span class="ln"></span></div>
    <h2 class="head rise">${e.signatureTitle}</h2>
    <p class="deck rise d1">${e.signatureIntro}</p>
    <div class="sig">
      ${sigItems}
    </div>
  </div>
</section>

<!-- EXPECT -->
<section class="band">
  <div class="wrap">
    <div class="idx rise"><span class="no">03</span> Was dich erwartet <span class="ln"></span></div>
    <h2 class="head rise">Mehr als ein <em>Termin.</em></h2>
    <div class="expect" style="margin-top:34px">
      ${expectRows}
    </div>
  </div>
</section>

<!-- BOOKING -->
<section class="band band--paper2 band--glow" id="book" data-sticky-until>
  <div class="wrap">
    <div class="idx rise"><span class="no">04</span> ${free?'Dabei sein':'Platz sichern'} <span class="ln"></span></div>
    <h2 class="head rise">${free?'Einfach <em>kommen.</em>':'Sei <em>dabei.</em>'}</h2>
    <p class="deck rise d1">${free?'Dieses Event ist kostenlos — Teil der Basis-Mitgliedschaft. Tritt der Gruppe bei und sei beim nächsten Mal dabei.':'Einzeln buchen — oder mit <a href="premium.html#models" style="color:var(--ev);text-decoration:underline;text-underline-offset:2px">Premium</a> ohne Aufpreis bei allem dabei sein.'}</p>
    <div style="margin-top:34px;max-width:540px">
      ${booking}
    </div>
  </div>
</section>

<!-- RELATED -->
<section class="band band--ink">
  <div class="wrap">
    <div class="idx rise"><span class="no">·</span> Auch interessant <span class="ln"></span></div>
    <h2 class="head rise">Mehr aus dem <em>Programm.</em></h2>
    <div class="related rise d1">
      ${e.related.map(relatedCard).join('\n      ')}
    </div>
    <div class="final-cta rise d1" style="justify-content:flex-start;margin-top:38px">
      <a class="btn btn--gold btn--lg" href="premium.html#models" data-cta="related-premium">Alle Events mit Premium →</a>
      <a class="btn btn--ghost btn--lg" href="premium.html#programme" data-cta="related-programme">Ganzes Programm</a>
    </div>
  </div>
</section>

</main>

<footer class="foot">
  <div class="wrap">
    <div class="foot-top">
      <div class="fmark">The&nbsp;<em>Tribe</em></div>
      <p class="ftag">Komm an. Bleib.<br>Werde Teil.</p>
    </div>
    <nav class="foot-links" aria-label="Footer">
      <a href="premium.html">Tribe Premium</a>
      <a href="premium.html#programme">Programm</a>
      <a href="premium.html#creator">Creator werden</a>
      <a href="${WA}">WhatsApp-Community</a>
    </nav>
    <p class="copy">The Tribe · Bielefeld · ${e.title} · Members' Journal</p>
  </div>
</footer>

<div class="sticky" id="sticky">
  <div class="si"><b>${e.title}</b><span${free?'':' class="hideable-price"'}>${free?'Kostenlos · jederzeit dabei':e.priceLabel}</span></div>
  <a class="btn btn--gold" href="#book" data-cta="sticky-book">${stickyLabel}</a>
</div>

<script src="assets/club.js" defer></script>
</body>
</html>
`;
}

/* pull-quotes from the data sometimes already include „ … " — keep as-is but avoid double opening quote from CSS ::before */
function stripQuotes(q){ return q.replace(/^[„"“]\s*/,'').replace(/\s*["”"]$/,''); }

let n=0;
for(const slug of Object.keys(BASE)){
  const e = bySlug[slug];
  if(!e){ console.warn('  ! no content for', slug); continue; }
  writeFileSync(join(process.cwd(),'docs',slug+'.html'), page(e), 'utf8');
  console.log('  ✓ docs/'+slug+'.html');
  n++;
}
console.log(`\nGenerated ${n} event pages.`);
