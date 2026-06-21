---
name: mz9-lead-build
description: Baut eine eigenständige Premium-Landingpage als MZ.9-Konzept-Vorschau für einen Akquise-Lead aus einem build-job.json. Nutze diesen Skill, wenn eine Lead-/Konzeptseite für einen Betrieb (Friseur, Handwerk, Gastro, Praxis, Fitness etc.) gebaut werden soll — aufgerufen vom Lead-Agent (auto.js Stufe 2) oder manuell. Output ist EINE self-contained index.html.
---

# MZ.9 Lead-Build — Premium-Konzeptseite aus build-job.json

Du baust **eine** eigenständige `index.html` als unverbindliche Konzept-Vorschau für einen
echten Betrieb. Stil: **Dark-Editorial, „entworfen wie Kunst, gebaut wie ein System"** —
das Niveau von MZ.9, aber mit **eigener, branchenpassender Farbpalette** (nicht 1:1 schwarz).

## Eingabe

Lies **einmal** das Build-Job unter dem im Aufruf genannten Pfad (z. B.
`docs/leads/<id>/build-job.json`). Darin stehen: `name`, `industry`, `website`, `phone`,
`address`, `city`, `problems[]`, `opps[]`, `images[]` (Original-Bild-URLs der echten Website),
`content` (title/desc/h1/h2 als Copy-Basis).

## EISERNE REGELN (niemals verletzen)

1. **Original-Bilder Pflicht**: `images[]` prominent einbauen — Hero, Galerie, CTA-Band,
   Leistungsbilder. **KEINE** bildlose Seite, **KEINE** Stock-/Fantasiebilder. Hero-Bild
   **ohne** `loading="lazy"`, der Rest mit.
2. **Nur echte Daten** aus dem Build-Job — keine Fakten, Preise, Öffnungszeiten erfinden.
   Fehlt etwas, lass die Stelle weg statt zu erfinden.
3. **Eigene branchenpassende Farbpalette** — nicht 1:1 die MZ.9-Referenz. Wähle Akzent +
   Dunkel/Hell passend zur Branche (z. B. Friseur warm-copper, Handwerk amber/steel,
   Gastro deep-red, Praxis teal, Fitness lime). Dark-Editorial-Grundton beibehalten.
4. **Self-contained**: alle `<style>` inline, minimales inline `<script>`. Keine externen
   CSS/JS-Dateien (Google Fonts via `<link>` ist ok).
5. `<html lang="de">`, viewport, `<meta name="robots" content="noindex">`,
   `<title>` + `<meta description>` aus echten Inhalten, sinnvolle `alt`-Texte.
6. Voll responsive, valide, deutsch. Ergebnis > 4 KB.

## Design-DNA (kondensiert aus der MZ.9-Referenz)

**Typografie**: `Hanken Grotesk` (200–600) als Sans, `Allura` als Script-Akzent für
einzelne Wörter. Body ~17px/1.62, weight 300. `h1/h2/h3` weight 200, `letter-spacing:-.02em`,
`line-height:1.02`. Eyebrow: 11px, weight 500, `letter-spacing:.32em`, uppercase, muted.

**Token-System** (`:root` — Palette durch branchenpassende Werte ersetzen):
```css
:root{
  --bg:#0A0A0B; --panel:#08080A;            /* Dark-Editorial-Grundton */
  --on:#F0EEE9; --on-2:#B9B7B1; --on-mut:#7C7A75;
  --ink:#0B0B0C; --ink-2:#4C4A46; --ink-mut:#5E5C57;   /* für helle Sektionen */
  --line:rgba(240,238,233,.14); --line-2:rgba(240,238,233,.07);
  --acc:#10B981; --acc-d:#062a1d;            /* ← branchenpassender Akzent */
  --maxw:1240px;
  --ease:cubic-bezier(.22,.61,.36,1); --ease-out:cubic-bezier(.16,1,.3,1);
  --sans:"Hanken Grotesk",-apple-system,system-ui,sans-serif;
  --script:"Allura",cursive;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--on);font-family:var(--sans);
  font-size:17px;line-height:1.62;font-weight:300;letter-spacing:.005em;
  -webkit-font-smoothing:antialiased;overflow-x:hidden}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 clamp(20px,5vw,56px)}
a{color:inherit;text-decoration:none} img{max-width:100%;display:block}
.eyebrow{font-size:11px;font-weight:500;letter-spacing:.32em;text-transform:uppercase;color:var(--on-mut)}
.script{font-family:var(--script);font-weight:400}
h1,h2,h3{margin:0;font-weight:200;letter-spacing:-.02em;line-height:1.02}
```

**Reveal-Animationen** (Progressive Enhancement — nur wenn JS an):
```css
.js .reveal{opacity:0;transition:opacity 1s var(--ease)} .js .reveal.in{opacity:1}
.js .lift{opacity:0;transform:translateY(26px);transition:opacity 1s var(--ease),transform 1.05s var(--ease-out)} .js .lift.in{opacity:1;transform:none}
```
```html
<script>document.documentElement.className=document.documentElement.className.replace("no-js","js");
const io=new IntersectionObserver((es)=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.15});
addEventListener("DOMContentLoaded",()=>document.querySelectorAll(".reveal,.lift").forEach(el=>io.observe(el)));
const h=document.getElementById("header");addEventListener("scroll",()=>h.classList.toggle("scrolled",scrollY>40));</script>
```
`prefers-reduced-motion`: alle Animationen/Transitions deaktivieren, `.reveal/.lift` sichtbar.

**Feinkorn-Textur** auf dunklen Flächen (`.grain::after` mit feinem SVG-Noise, opacity .045)
für die „Kunst"-Anmutung — sparsam, nur Hero/CTA.

## Sektions-Struktur (Lead-Seite, in dieser Reihenfolge)

1. **Ribbon** — schmale Leiste oben (z. B. „Konzept-Vorschau · MZ.9" oder Standort).
2. **Fixer Header** (`#header`, `.scrolled` beim Scrollen) — Brand links, minimale Nav
   rechts, CTA-Button.
3. **Vollbild-Hero** (`min-height:100svh`) — Original-Bild als Hintergrund
   (object-fit:cover, dezenter grayscale/contrast-Filter + Scrim für Lesbarkeit),
   Eyebrow + Script-Akzent + großer H1 + Sub + primärer CTA. Kein Lazy-Load fürs Hero.
4. **Info-Strip** — kompakte Kennzahlen/USPs in einer Reihe (echte Werte/Bilder-Bezug).
5. **Leistungen-Grid** — 3–4 Karten mit Icon/Mini-Bild + Titel + Text aus `problems/opps`.
6. **Galerie** — mehrere Original-Bilder (`images[]`) in einem responsiven Grid/Masonry,
   alle außer Hero mit `loading="lazy"`.
7. **3× Google-Reviews** — drei Testimonial-Karten (als Platzhalter-Beispiele klar als
   solche markieren, KEINE echten Bewertungen erfinden — stattdessen generische, offen
   als „Beispiel" gekennzeichnete Stimmen oder weglassen) + Trust-Fußnote.
8. **CTA-Band** — vollflächiges Original-Bild mit Scrim + starker CTA-Aussage + Button.
9. **Kontakt** — Adresse, Telefon als `tel:`-Link, Website, Öffnungszeiten nur falls im
   Build-Job. Klarer CTA.
10. **Footer** — „Konzept-Vorschau · MZ.9 — Media Engineering.AI" + Hinweis, dass es sich
    um ein unverbindliches Konzept handelt.
11. **Mobile-CTA-Bar** — fixierte Leiste unten auf Mobil mit Haupt-CTA (z. B. Anrufen/Anfrage).

## Buttons
`.btn`: uppercase, `letter-spacing:.18em`, `min-width`-Pill oder eckig, hover `translateY(-2px)`.
`.btn.ghost` mit Outline. Primärer CTA = Akzent-Farbe.

## Qualität vor Fertigstellung (Checkliste)

- [ ] Alle Original-Bilder aus `images[]` verbaut (Hero + Galerie + mind. 1 CTA-Band)?
- [ ] Nur echte Daten, nichts erfunden?
- [ ] Eigene branchenpassende Palette (nicht 1:1 MZ.9)?
- [ ] Reveal-Animationen + header.scrolled + reduced-motion drin?
- [ ] `noindex`, `lang="de"`, viewport, title/description?
- [ ] Responsive (Mobil-CTA-Bar, Grids brechen um)?
- [ ] Self-contained, > 4 KB?

Schreibe die fertige `index.html` an den im Aufruf genannten Output-Pfad. Antworte danach
nur knapp (z. B. „✅ gebaut, N Bilder, Palette: <name>"). Die Datei ist das Ergebnis.
