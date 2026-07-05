# INSYNC Campaign-Seite — statische 1:1-Replik

Statischer Nachbau von `https://www.in-sync.io/campaign/start` (Next.js-Site),
Stand 2026-07-05. Alle Bilder, Videos, Fonts und Styles liegen lokal in diesem
Ordner — die Seite läuft komplett ohne die Original-Infrastruktur.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html` | Server-gerendertes HTML des Originals, Pfade auf lokale Assets umgeschrieben, Next.js-Scripts entfernt |
| `replica.js` | Ersetzt die Client-Interaktivität: Scroll-Reveals, Header-Theme-Wechsel (hell/dunkel), VSL-/Testimonial-/Team-Videos, Portfolio-Tabs & -Videos, Testimonial-Slider (7 Einträge), Calendly-Popup, Newsletter-Hinweis |
| `next-static/` | Original-CSS (Tailwind-Build) + Fonts (woff2) |
| `images/` | Alle Bilder; `images/sanity/` = ehemals Sanity-CDN |
| `videos/wistia/` | Haupt-Video (VSL, `r6e4qrwvdw`, 720p) + Testimonial-Video Alex Kurze (`tnbkbvqf08`, 720p) — von Wistia geladen |
| `videos/sanity/` | 4 Portfolio-Loop-Videos (FRAMEN, INVENTRY, Theraletik, SONIQ) |
| `videos/team/` | Team-Video (Autoplay-Loop) |
| `textures/` | Grain-Overlay |

## Bewusste Abweichungen vom Original

- **Wistia-Videos** laufen als lokale `<video>`-Elemente (720p) statt über den
  Wistia-Player. Originale in höherer Auflösung überschreiten das
  GitHub-Dateilimit (VSL-Original: 275 MB).
- **Calendly** öffnet das echte Popup des Originals (externes Widget); ohne
  Netz fällt es auf einen neuen Tab zurück.
- **Newsletter-Formulare** senden nichts (kein Backend) und zeigen einen
  Hinweis statt einer Fake-Bestätigung.
- **Interne Links** (Footer, Impressum, …) zeigen auf die Live-Seite
  `www.in-sync.io`.

## Deployment

Wird über GitHub Pages aus `docs/` mit ausgeliefert:
`https://maikz91.github.io/the-tribe-bot/insync-campaign/`
