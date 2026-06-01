/* ============================================================
   build-events.mjs — generates all Tribe event subpages into docs/
   Single source of truth: edit EVENTS, run `node build-events.mjs`.
   Shared look comes from docs/assets/club.css + club.js.
   ============================================================ */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WA = 'https://chat.whatsapp.com/CTbK6Xi8QHRExmoXhkaqvL';
const OG = 'https://maikz91.github.io/the-tribe-bot/assets/gruppe.webp';

/* --- inline SVG icons --- */
const I = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  back:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  lock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
  wa:    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.6 6.31a7.94 7.94 0 0 0-5.6-2.31C7.58 4 4 7.58 4 12c0 1.42.37 2.81 1.07 4.03L4 20l4.07-1.05A7.94 7.94 0 0 0 12 19.94c4.42 0 8-3.58 8-8 0-2.13-.84-4.16-2.4-5.63ZM12 18.5c-1.27 0-2.51-.34-3.6-.99l-.26-.15-2.42.63.65-2.36-.17-.27A6.5 6.5 0 1 1 12 18.5Z"/></svg>'
};

const POSTHOG = (variant) => `<script>
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init me ws ys ps bs capture je Di ks register register_once register_for_session unregister unregister_for_session Ps getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Es $s createPersonProfile Is opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing Ss debug L qs getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  try{posthog.init('phc_ktsJAdQbuZh9PbsdX7RxZdTWZjEgkZLHAyB7kzb9eG6t',{
    api_host:'https://eu.i.posthog.com',person_profiles:'always',capture_pageview:true,capture_pageleave:true,
    autocapture:true,session_recording:{maskAllInputs:true},enable_heatmaps:true});
  posthog.register({landing_variant:'${variant}'});}catch(e){}
</script>`;

/* ============ EVENT DATA ============ */
const EVENTS = [
  {
    slug:'social-warm-up', title:'Social Warm Up', titleHtml:'Social <em>Warm Up</em>', glyph:'★',
    kind:'entry', price:0, photo:'assets/hero-bg.jpg',
    kicker:'Der Entry Point · jede Woche', tagline:'Wo dein Abend beginnt.',
    sub:'Der wöchentliche Einstieg in den Abend — danach ziehen wir gemeinsam weiter. Hier fängt alles an. Du musst niemanden kennen.',
    when:'Samstag · 18:00', where:'Bernstein, Bielefeld', duration:'offen', priceLabel:'Kostenlos',
    body:[
      'Niemand kommt das erste Mal mit jemandem. Genau dafür gibt es das Social Warm Up: ein lockerer Treffpunkt am Samstagabend, an dem du einfach dazukommst. Kein Programm, kein Druck — ein Getränk, ein paar neue Gesichter, und schon bist du mittendrin.',
      'Es ist der Einstiegspunkt in die Tribe: kostenlos, jede Woche, offen für alle. Von hier ziehen wir gemeinsam weiter — mal in eine Bar, mal zu einem der größeren Events.'
    ],
    expect:[
      {h:'Ein vertrautes Gesicht ab Minute eins', p:'Wir holen Neue aktiv rein — keiner steht allein in der Ecke.'},
      {h:'Kein Plan nötig', p:'Komm wie du bist, geh wann du willst. Null Verpflichtung.'},
      {h:'Der Absprung in den Abend', p:'Aus dem Warm Up wird oft die ganze Nacht — gemeinsam weiterziehen ist die Regel.'}
    ],
    includes:['Treffpunkt jeden Samstag','Wir stellen dich vor','Gemeinsam weiterziehen','Teil der Tribe-Community'],
    related:['laufgruppe','wine-walk','pub-crawl']
  },
  {
    slug:'laufgruppe', title:'Laufgruppe', titleHtml:'Lauf<em>gruppe</em>', glyph:'➜',
    kind:'free', price:0, color:'#B5331A',
    kicker:'Kostenlos · jede Woche', tagline:'Kopf frei, Beine müde, gut drauf.',
    sub:'Mittwochs locker laufen, quatschen, den Kopf frei machen. Jedes Tempo ist willkommen — wir warten aufeinander.',
    when:'Mittwoch · 19:00', where:'Treffpunkt in der Gruppe', duration:'ca. 45–60 Min', priceLabel:'Kostenlos',
    body:[
      'Laufen ist besser zu zweit — und noch besser zu zehnt. Unsere Laufgruppe ist kein Wettkampf, sondern ein lockerer Mittwochabend, an dem Bewegung und gute Gespräche zusammenkommen. Anfänger und Routiniers laufen nebeneinander, niemand bleibt zurück.',
      'Danach bleibt oft noch Zeit für ein Getränk. Bring einfach Laufschuhe mit — den Rest machen wir gemeinsam.'
    ],
    expect:[
      {h:'Jedes Tempo willkommen', p:'Wir teilen uns auf, sodass niemand über- oder unterfordert ist.'},
      {h:'Reden statt rennen', p:'Beim lockeren Laufen entstehen die besten Gespräche.'},
      {h:'Wöchentlich dran bleiben', p:'Feste Zeit, feste Crew — der einfachste Weg, dranzubleiben.'}
    ],
    includes:['Wöchentlicher Lauftreff','Gruppe für jedes Tempo','Gemeinsamer Ausklang','Kostenlos & unverbindlich'],
    related:['social-warm-up','boulder-beer','stadion-kick']
  },
  {
    slug:'stadion-kick', title:'Stadion-Kick', titleHtml:'Stadion-<em>Kick</em>', glyph:'⚽',
    kind:'free', price:0, color:'#1F4D31',
    kicker:'Kostenlos · an Spieltagen', tagline:'Zusammen kicken, zusammen mitfiebern.',
    sub:'Gemeinsam kicken oder die Spiele schauen — Sonntags, wenn der Ball rollt. Für alle, die Sport lieber in Gesellschaft erleben.',
    when:'Sonntag · an Spieltagen', where:'Bolzplatz / Sportsbar', duration:'Spieltags', priceLabel:'Kostenlos',
    body:[
      'Ob selbst auf dem Platz oder gemeinsam vor dem Spiel: der Stadion-Kick ist für alle, die Fußball lieber in Gesellschaft erleben. Wir treffen uns an Spieltagen, kicken eine Runde oder schauen zusammen — laut, locker, gemeinsam.',
      'Keine Vereinsmeierschaft, keine Aufstellung in Stein gemeißelt. Komm vorbei, mach mit, jubel mit.'
    ],
    expect:[
      {h:'Mitspielen oder mitfiebern', p:'Beides geht — je nach Spieltag und Lust.'},
      {h:'Locker & ohne Leistungsdruck', p:'Spaß steht über Tabelle. Jeder darf ran.'},
      {h:'Danach zusammen weiter', p:'Aus dem Anpfiff wird oft ein ganzer Sonntag.'}
    ],
    includes:['Treff an Spieltagen','Kicken oder Schauen','Offene, lockere Runde','Kostenlos dabei'],
    related:['social-warm-up','laufgruppe','pub-crawl']
  },
  {
    slug:'wine-walk', title:'Wine Walk', titleHtml:'Wine <em>Walk</em>', glyph:'❦',
    kind:'prem', price:25, photo:'assets/wine/cheers.jpg',
    kicker:'Premium-Event · Sommer 2026', tagline:'Walk. Sip. Connect.',
    sub:'Ein Spaziergang mit feinen Weinen an kleinen Stopps — vom Bürgerpark zum Obersee. Gute Gespräche, schöne Ausblicke, ein Glas in der Hand.',
    when:'Freitag · 19:00', where:'Bürgerpark → Obersee', duration:'ca. 2 Std', priceLabel:'25 € / Person',
    body:[
      'Gemeinsam laufen, genießen und den Abend in bester Gesellschaft ausklingen lassen. An kleinen Stopps entlang der Route stoßen wir an, probieren ausgewählte Weine und kommen ins Gespräch — beim Laufen entstehen die besten davon.',
      'Vom Bürgerpark schlendern wir bis zum Obersee, wo der Sonnenuntergang am Wasser das Finale setzt. Kein Programm, kein Druck — einfach loslaufen und schauen, wen du unterwegs kennenlernst.'
    ],
    expect:[
      {h:'Ausgewählte Weine an mehreren Stopps', p:'Unterwegs halten wir an, stoßen an und genießen.'},
      {h:'Zeit für gute Gespräche & neue Leute', p:'Die lockere Bewegung macht das Kennenlernen leicht.'},
      {h:'Bielefeld zu Fuß', p:'Park, Stadt und Wasser — die schönste Seite der Stadt.'},
      {h:'Ausklang am Obersee', p:'Sonnenuntergang am Wasser als großes Finale.'}
    ],
    includes:['Ausgewählte Weine an mehreren Stopps','Geführte Route Bürgerpark → Obersee','Gemeinsamer Ausklang am Wasser','Teil der Tribe-Community'],
    related:['supper-club','buchclub','pub-crawl']
  },
  {
    slug:'buchclub', title:'Book Club', titleHtml:'Book <em>Club</em>', glyph:'❧',
    kind:'prem', price:12, color:'#6E1F2E',
    kicker:'Premium-Event · monatlich', tagline:'Lesen. Reden. Ankommen.',
    sub:'Einmal im Monat ein Buch, ein Glas und echte Gespräche. Kein Uni-Seminar — ein gemütlicher Abend mit Tiefgang.',
    when:'Mittwoch · 19:30', where:'wechselndes Café', duration:'ca. 2 Std', priceLabel:'12 € / Person',
    body:[
      'Ein Buch im Monat, ein Abend zum Reden. Im Book Club geht es nicht um die richtige Interpretation, sondern um das, was Geschichten in uns auslösen. Wir lesen gemeinsam, treffen uns und tauschen uns aus — bei einem Glas und in gemütlicher Runde.',
      'Du musst kein Vielleser sein. Wer mitliest, ist dabei; wer nur zuhören will, auch. Das Buch wählen wir zusammen.'
    ],
    expect:[
      {h:'Ein Buch, das wir zusammen wählen', p:'Demokratisch entschieden, für alle machbar.'},
      {h:'Echte Gespräche statt Smalltalk', p:'Bücher öffnen Themen, über die man sonst nicht spricht.'},
      {h:'Gemütliche Runde mit Glas', p:'Café-Atmosphäre, kein Leistungsdruck.'}
    ],
    includes:['Buch des Monats & Leseimpulse','Moderierter Gesprächsabend','Ein Begrüßungsgetränk','Kleine, feine Runde'],
    related:['wine-walk','supper-club','techno-paint']
  },
  {
    slug:'pub-crawl', title:'Pub Crawl', titleHtml:'Pub <em>Crawl</em>', glyph:'❂',
    kind:'prem', price:15, photo:'assets/ad/bar.jpg',
    kicker:'Premium-Event · monatlich', tagline:'Vier Bars, eine Crew, ein Abend.',
    sub:'Durch die Altstadt mit Welcome-Shot an jedem Stopp. Wir kennen die Läden, du kennst am Ende die Leute.',
    when:'Freitag · 20:00', where:'Altstadt Bielefeld', duration:'ca. 4 Std', priceLabel:'15 € / Person',
    body:[
      'Eine Nacht, vier Locations, eine wachsende Crew. Wir starten gemeinsam und ziehen durch die besten Spots der Altstadt — mit einem Welcome-Shot an jedem Stopp und genug Zeit, um wirklich ins Gespräch zu kommen.',
      'Du kennst die Läden noch nicht? Perfekt. Wir führen, du genießt. Am Ende des Abends kennst du nicht nur die Bars, sondern auch die Leute.'
    ],
    expect:[
      {h:'Vier handverlesene Bars', p:'Wir kennen die Spots — du musst nichts planen.'},
      {h:'Welcome-Shot an jedem Stopp', p:'Im Preis inklusive, für den richtigen Start.'},
      {h:'Eine Crew, die zusammenwächst', p:'Von Bar zu Bar wird aus Fremden eine Runde.'}
    ],
    includes:['Geführte Route durch 4 Bars','Welcome-Shot an jedem Stopp','Reservierte Plätze','Eine Crew für die ganze Nacht'],
    related:['social-warm-up','tribe-concert','wine-walk']
  },
  {
    slug:'techno-paint', title:'Techno & Paint', titleHtml:'Techno <em>&amp; Paint</em>', glyph:'✺',
    kind:'prem', price:29, color:'#3A1D5C',
    kicker:'Premium-Special · monatlich', tagline:'Leinwand, Farbe & Beats.',
    sub:'Lass los und mal drauf los — zu treibenden Beats. Kein Können nötig, Material gibt es vor Ort. Mitnehmen darfst du dein Werk.',
    when:'Sonntag · 16:00', where:'Studio / Atelier', duration:'ca. 3 Std', priceLabel:'29 € / Person · Material inkl.',
    body:[
      'Vergiss „ich kann nicht malen". Techno & Paint ist kein Kurs, sondern ein Ventil: Leinwand, Acrylfarben und ein DJ-Set, das dich in Bewegung hält. Du malst, was rauswill — abstrakt, wild, ehrlich. Niemand bewertet, alle machen mit.',
      'Material und Leinwand stellen wir, dein Werk nimmst du am Ende mit nach Hause. Anziehen, was Farbe abkriegen darf.'
    ],
    expect:[
      {h:'Kein Können nötig', p:'Es geht ums Machen, nicht ums Können. Jeder fängt bei null an.'},
      {h:'Beats, die dich tragen', p:'Ein DJ-Set sorgt für Flow statt Stille.'},
      {h:'Dein Werk zum Mitnehmen', p:'Leinwand & Farbe inklusive — das Ergebnis gehört dir.'}
    ],
    includes:['Leinwand & Acryl-Material','Live-DJ / Beats','Schürze & Grundausstattung','Dein Bild zum Mitnehmen'],
    related:['buchclub','supper-club','tribe-concert']
  },
  {
    slug:'supper-club', title:'Supper Club', titleHtml:'Supper <em>Club</em>', glyph:'❖',
    kind:'prem', price:34, color:'#8A3B1E',
    kicker:'Premium-Special · monatlich', tagline:'Ein langer Tisch. Viele neue Gesichter.',
    sub:'Tribe Table: drei Gänge, ein langer Tisch, gute Gespräche. Essen verbindet — hier sitzt du neben Menschen, die du noch nicht kennst.',
    when:'Freitag · 19:00', where:'wechselnde Location', duration:'ca. 3 Std', priceLabel:'34 € / Person · 3 Gänge',
    body:[
      'Es gibt keinen besseren Eisbrecher als einen geteilten Tisch. Beim Supper Club kochen wir auf, decken einen langen Tisch und setzen Menschen zusammen, die sich noch nicht kennen. Drei Gänge, viel Zeit, keine Sitzordnung nach Bekanntschaft.',
      'Du kommst allein? Ideal. Am Ende des Abends hast du mit der ganzen Tafel geredet.'
    ],
    expect:[
      {h:'Drei Gänge, frisch gemacht', p:'Ein durchdachtes Menü, das den Abend trägt.'},
      {h:'Ein langer, geteilter Tisch', p:'Gemeinschaft entsteht beim Weiterreichen.'},
      {h:'Neben Fremden, die keine bleiben', p:'Wir setzen bewusst durcheinander.'}
    ],
    includes:['3-Gänge-Menü','Platz an der Tribe-Tafel','Aperitif zum Auftakt','Gemeinsamer Abend mit neuen Leuten'],
    related:['wine-walk','buchclub','techno-paint']
  },
  {
    slug:'boulder-beer', title:'Boulder & Beer', titleHtml:'Boulder <em>&amp; Beer</em>', glyph:'◮',
    kind:'prem', price:18, color:'#16463B',
    kicker:'Premium-Special · monatlich', tagline:'Erst an die Wand, dann ans Bier.',
    sub:'Zusammen bouldern — keine Erfahrung nötig — und danach ein kühles Bier. Klettern macht locker, der Rest kommt von allein.',
    when:'Samstag · 17:00', where:'Boulderhalle Bielefeld', duration:'ca. 2,5 Std', priceLabel:'18 € / Person · Eintritt inkl.',
    body:[
      'Bouldern ist der perfekte Gruppensport: man feuert sich an, lacht über Fehlversuche und kommt ganz nebenbei ins Reden. Keine Vorerfahrung nötig — wir zeigen dir die Basics, der Rest ist Ausprobieren.',
      'Wenn die Arme müde sind, wechseln wir an die Bar nebenan. Erst klettern, dann anstoßen — die Tribe-Variante des perfekten Samstags.'
    ],
    expect:[
      {h:'Keine Erfahrung nötig', p:'Wir erklären Griffe, Matten und die ersten Routen.'},
      {h:'Anfeuern verbindet', p:'Beim gemeinsamen Tüfteln entsteht sofort Nähe.'},
      {h:'Bier danach inklusive Plan', p:'Der Ausklang an der Bar gehört dazu.'}
    ],
    includes:['Hallen-Eintritt','Kurze Einführung für Neue','Gruppe für jedes Level','Gemeinsamer Ausklang'],
    related:['laufgruppe','social-warm-up','sauna']
  },
  {
    slug:'sauna', title:'Sauna & Cold Plunge', titleHtml:'Sauna <em>&amp; Cold Plunge</em>', glyph:'❋',
    kind:'prem', price:24, color:'#1C3A5C',
    kicker:'Premium-Special · Sonntags', tagline:'Aufguss, Eisbad, Reset.',
    sub:'Der Sonntags-Reset für Körper und Kopf: heißer Aufguss, kaltes Eisbad, Ruhe — gemeinsam. Raus aus der Woche, rein in die Klarheit.',
    when:'Sonntag · 09:00', where:'Sauna / Therme', duration:'ca. 2,5 Std', priceLabel:'24 € / Person',
    body:[
      'Ein bewusster Start in den Sonntag: wir wechseln zwischen heißem Aufguss und kaltem Eisbad, atmen durch und kommen runter. Die Hitze-Kälte-Wechsel sind ein Reset für Körper und Kopf — und in der Gruppe fällt der Sprung ins kalte Wasser deutlich leichter.',
      'Zwischen den Gängen bleibt Zeit für ruhige Gespräche. Kein Leistungsgedanke, nur Wohltun. Handtuch mitbringen, den Rest organisieren wir.'
    ],
    expect:[
      {h:'Geführte Aufguss- & Eisbad-Runden', p:'Wir geben den Rhythmus vor — du lässt los.'},
      {h:'Gemeinsam ins Kalte', p:'Zusammen springt es sich leichter ins Eisbad.'},
      {h:'Ruhiger Sonntags-Reset', p:'Entschleunigung statt Party — die andere Tribe-Seite.'}
    ],
    includes:['Eintritt Sauna & Eisbad','Geführte Aufgüsse','Ruhephasen in der Gruppe','Klarer Start in den Sonntag'],
    related:['laufgruppe','boulder-beer','social-warm-up']
  },
  {
    slug:'tribe-concert', title:'Tribe Concert', titleHtml:'Tribe <em>Concert</em>', glyph:'♪',
    kind:'flag', price:22, photo:'assets/ad/concert.jpg',
    kicker:'Flagship · streng limitiert', tagline:'Ein Abend zum Erinnern.',
    sub:'Live-Musik, unsere Leute, ein Abend, der bleibt. Das Highlight der Saison — die Plätze sind streng limitiert.',
    when:'Samstag · 20:00', where:'Live-Venue Bielefeld', duration:'der ganze Abend', priceLabel:'22 € · Members-Preis',
    body:[
      'Einmal pro Saison machen wir es groß: ein echtes Konzert, kuratiert für die Tribe. Live auf der Bühne, unsere Leute im Publikum, und das Gefühl, Teil von etwas zu sein. Das ist kein anonymer Gig — das ist unser Abend.',
      'Die Plätze sind bewusst limitiert, damit es eng und besonders bleibt. Premium-Mitglieder bekommen den Members-Preis und die ersten Plätze.'
    ],
    expect:[
      {h:'Kuratierte Live-Acts', p:'Handverlesen für die Stimmung des Abends.'},
      {h:'Unsere Leute im Publikum', p:'Du feierst neben Gesichtern, die du kennst.'},
      {h:'Streng limitiert', p:'Kleine Venue, große Nähe — bewusst eng gehalten.'}
    ],
    includes:['Eintritt zum Live-Konzert','Members-Preis & Priority-Einlass','Gemeinsamer Abend mit der Tribe','Das Highlight der Saison'],
    related:['pub-crawl','techno-paint','wine-walk']
  }
];

const bySlug = Object.fromEntries(EVENTS.map(e=>[e.slug,e]));
const tagLabel = {entry:'Entry Point', free:'Free', prem:'Premium', flag:'Flagship'};
const tagClass = {entry:'tagp--entry', free:'tagp--free', prem:'tagp--prem', flag:'tagp--flag'};

function relatedCard(slug){
  const e = bySlug[slug]; if(!e) return '';
  const price = e.price>0 ? `${e.price} €` : 'Frei';
  return `<a class="rel" href="${e.slug}.html" data-cta="rel-${e.slug}">
        <p class="rk">${tagLabel[e.kind]} · ${price}</p>
        <h3>${e.title} <span class="arr">→</span></h3>
        <p>${e.tagline}</p>
      </a>`;
}

function page(e){
  const free = e.price<=0;
  const variant = 'event-'+e.slug;
  const og = e.photo ? `https://maikz91.github.io/the-tribe-bot/${e.photo}` : OG;

  /* hero */
  let hero;
  if(e.photo){
    hero = `<section class="feature feature--photo">
    <div class="fbg"><img src="${e.photo}" alt="" fetchpriority="high" decoding="async"></div>
    <div class="wrap">
      <a class="back" href="premium.html#programme" data-cta="back">${I.back} Programm</a>
      <p class="ek">${e.kicker}</p>
      <h1>${e.titleHtml}</h1>
      <p class="ftag">${e.tagline}</p>
      <p class="fsub">${e.sub}</p>
    </div>
  </section>`;
  } else {
    hero = `<section class="feature feature--color" style="--ev:${e.color}">
    <span class="glyph" aria-hidden="true">${e.glyph}</span>
    <div class="wrap">
      <a class="back" href="premium.html#programme" data-cta="back">${I.back} Programm</a>
      <p class="ek">${e.kicker}</p>
      <h1>${e.titleHtml}</h1>
      <p class="ftag">${e.tagline}</p>
      <p class="fsub">${e.sub}</p>
    </div>
  </section>`;
  }

  const expectRows = e.expect.map((x,i)=>`<div class="xrow rise"><span class="xn">0${i+1}</span><div><h3>${x.h}</h3><p>${x.p}</p></div></div>`).join('\n      ');
  const inclLis = e.includes.map(t=>`<li>${I.check}${t}</li>`).join('');
  const body = e.body.map((p,i)=>`<p${i===0?' class="dropcap"':''}>${p}</p>`).join('\n        ');

  /* booking module */
  const qtyBlock = free ? '' : `<div class="qty">
          <span class="qlbl">Anzahl</span>
          <div class="qctrl"><button class="qbtn" data-q="-" aria-label="weniger" disabled>−</button><span class="qval">1</span><button class="qbtn" data-q="+" aria-label="mehr">+</button></div>
        </div>`;
  const payLabel = free ? 'Kostenlos dabei sein' : `Platz sichern · ${e.price} €`;
  const payBtnClass = free ? 'btn--wa' : 'btn--flame';
  const payIcon = free ? I.wa+' ' : '';
  const secure = free
    ? `<div class="bk-secure">${I.wa} Öffnet WhatsApp · einfach vorbeikommen</div>`
    : `<div class="bk-secure">${I.lock} Sichere Zahlung · begrenzte Plätze</div>`;
  const premNote = free
    ? `<div class="bk-prem" style="border-color:var(--moss);color:var(--ink-2)"><b style="color:var(--moss)">Immer kostenlos.</b> Teil der Basis-Mitgliedschaft — einfach dabei sein.</div>`
    : `<div class="bk-prem"><b>Premium-Mitglied?</b> Dann ist dieses Event <a href="premium.html#models">bereits inklusive</a> — kein Einzelkauf nötig.</div>`;
  const priceHead = free
    ? `<div class="bk-price"><span data-total>Frei</span></div>`
    : `<div class="bk-price"><span data-total>${e.price}&nbsp;€</span><span class="per"> / Person</span></div>`;

  const booking = `<div class="booking rise d1" data-booking data-book="${e.title}" data-amount="${e.price}" data-max="10">
      <div class="bk-top">
        <div class="bk-name">${e.title}<small>${free?'Kostenloses Event':(e.kind==='flag'?'Flagship · Members-Preis':'Premium-Event · Einzelticket')}</small></div>
        ${priceHead}
      </div>
      <div class="bk-body">
        <ul class="incl">${inclLis}</ul>
        ${qtyBlock}
        <button class="btn ${payBtnClass} btn--block" data-pay data-cta="book-${e.slug}"><span data-paylabel>${payIcon}${payLabel}</span></button>
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
<meta name="theme-color" content="${e.photo?'#191510':(e.color||'#191510')}">
<meta name="description" content="The Tribe — ${e.title}: ${e.sub}">
<title>${e.title} — The Tribe Bielefeld</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%23EFE6D2'/><text x='16' y='23' font-family='Georgia,serif' font-size='20' fill='%23DA4324' text-anchor='middle' font-style='italic'>T</text></svg>">
<meta property="og:type" content="website">
<meta property="og:title" content="${e.title} — The Tribe Bielefeld">
<meta property="og:description" content="${e.tagline} ${e.sub}">
<meta property="og:image" content="${og}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="assets/fonts/familjen-grotesk-latin.woff2" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
${e.photo?`<link rel="preload" as="image" href="${e.photo}" fetchpriority="high">`:''}
<link rel="stylesheet" href="assets/club.css">
</head>
<body data-variant="${variant}" data-darkhero>

${POSTHOG(variant)}

<!-- MASTHEAD -->
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

${hero}

<!-- INTRO + DETAILS -->
<section class="band">
  <div class="wrap">
    <div class="idx rise"><span class="no">01</span> Worum es geht <span class="ln"></span></div>
    <div class="body-copy rise d1">
        ${body}
    </div>

    <div class="idx rise" style="margin-top:clamp(40px,6vw,72px)"><span class="no">·</span> Die Eckdaten <span class="ln"></span></div>
    <div class="ledger rise d1">
      <div class="row"><span class="k">Wann</span><span class="v">${e.when}</span></div>
      <div class="row"><span class="k">Wo</span><span class="v">${e.where}</span></div>
      <div class="row"><span class="k">Dauer</span><span class="v">${e.duration}</span></div>
      <div class="row"><span class="k">Preis</span><span class="v">${free?'<span class="free">Kostenlos</span>':e.priceLabel}</span></div>
    </div>
  </div>
</section>

<!-- EXPECT -->
<section class="band band--paper2">
  <div class="wrap">
    <div class="idx rise"><span class="no">02</span> Was dich erwartet <span class="ln"></span></div>
    <h2 class="head rise">Mehr als ein <em>Termin.</em></h2>
    <div class="expect" style="margin-top:34px">
      ${expectRows}
    </div>
  </div>
</section>

<!-- BOOKING -->
<section class="band" id="book" data-sticky-until>
  <div class="wrap">
    <div class="idx rise"><span class="no">03</span> ${free?'Dabei sein':'Platz sichern'} <span class="ln"></span></div>
    <h2 class="head rise">${free?'Einfach <em>kommen.</em>':'Sei <em>dabei.</em>'}</h2>
    <p class="deck rise d1">${free?'Dieses Event ist kostenlos — Teil der Basis-Mitgliedschaft. Tritt der Gruppe bei und sei beim nächsten Mal dabei.':'Einzeln buchen — oder mit <a href="premium.html#models" style="color:var(--flame);text-decoration:underline;text-underline-offset:2px">Premium</a> ohne Aufpreis bei allem dabei sein.'}</p>
    <div style="margin-top:34px;max-width:520px">
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
      <a class="btn btn--flame btn--lg" href="premium.html#models" data-cta="related-premium">Alle Events mit Premium →</a>
      <a class="btn btn--ghost btn--lg" href="premium.html#programme" data-cta="related-programme" style="color:var(--paper);border-color:var(--paper)">Ganzes Programm</a>
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
      <a href="https://chat.whatsapp.com/CTbK6Xi8QHRExmoXhkaqvL">WhatsApp-Community</a>
    </nav>
    <p class="copy">The Tribe · Bielefeld · ${e.title} · Members' Journal</p>
  </div>
</footer>

<div class="sticky" id="sticky">
  <div class="si"><b>${e.title}</b><span>${free?'Kostenlos · jederzeit dabei':e.priceLabel}</span></div>
  <a class="btn ${free?'btn--wa':'btn--flame'}" href="#book" data-cta="sticky-book">${stickyLabel}</a>
</div>

<script src="assets/club.js" defer></script>
</body>
</html>
`;
}

let n=0;
for(const e of EVENTS){
  const out = join(process.cwd(),'docs',e.slug+'.html');
  writeFileSync(out, page(e), 'utf8');
  console.log('  ✓ docs/'+e.slug+'.html');
  n++;
}
console.log(`\nGenerated ${n} event pages.`);
