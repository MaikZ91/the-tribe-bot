---
name: mz9-lead-build
description: Baut eine eigenständige, branchenspezifische Premium-Landingpage als MZ.9-Konzept-Vorschau für einen Akquise-Lead aus einem build-job.json. Nutze diesen Skill, wenn eine Lead-/Konzeptseite für einen Betrieb gebaut werden soll — aufgerufen vom Lead-Agent (auto.js Stufe 2) oder manuell. Output ist EINE self-contained index.html. WICHTIG: kein einheitliches dunkles „MZ.9"-Look — Design + Features passen sich der BRANCHE an, orientiert an der Analyse der Ursprungsseite.
---

# MZ.9 Lead-Build — branchenspezifische Premium-Konzeptseite

Du baust **eine** eigenständige `index.html` als unverbindliche Konzept-Vorschau für einen
echten Betrieb. **Nicht** jede Seite sieht gleich aus: Design, Farbpalette, Stimmung und
Features passen sich der **Branche** an und nehmen die **Ursprungsseite** als Vorlage —
nur hochwertiger, moderner, conversion-stärker. Kein generischer AI-Look, kein
einziger erzwungener Dunkel-Look.

## Eingabe — orientiere dich an der Ursprungsseite

Lies **einmal** das Build-Job unter dem im Aufruf genannten Pfad (`docs/leads/<id>/build-job.json`):
`name`, `industry`, `website`, `phone`, `address`, `city`, `problems[]`, `opps[]`,
`images[]` (Original-Bild-URLs), `content` (title/desc/h1/h2 als Copy-Basis).

**Die Analyse der Ursprungsseite führt das Design:**
- `content.h1/h2/title/desc` → übernehme & schärfe die echte Ansprache/Tonalität.
- `problems[]` → Schwächen der Originalseite (z. B. „keine Online-Terminbuchung",
  „Speisekarte nur als PDF", „kein Kontaktformular") → **genau diese** in der
  Konzeptseite als neue Premium-Features beheben.
- `opps[]` → Hebel, die du verbauen sollst.
- `images[]` → echtes Bildmaterial der Ursprungsseite (Pflicht, siehe Regeln).

## EISERNE REGELN (niemals verletzen)

1. **Original-Bilder Pflicht**: `images[]` prominent — Hero, Galerie, CTA-Band,
   Leistungsbilder. **KEINE** bildlose Seite, **KEINE** Stock-/Fantasiebilder. Hero
   **ohne** `loading="lazy"`, Rest mit.
   - **Hero immer mit passendem, hochauflösendem Bild.** Wähle für den Hero das stärkste,
     thematisch passende Originalbild. **Niedrig aufgelöste Bilder NICHT vollflächig
     hochskalieren** (wirkt verpixelt, besonders mobil) — entweder ein hochauflösendes
     Bild verlangen/nutzen, oder das Bild in einer **festen, kleineren Bühne** neben dem
     Text zeigen (verkleinert = scharf). Fehlt ein scharfes Hero-Bild, beim Lead-Eigner
     anfragen.
2. **Nur echte Daten** aus dem Build-Job — keine Preise/Offenzeiten/Fakten erfinden.
   Fehlt etwas, lass es weg. (Ausnahme: offensichtlich beispielhafte UI-Inhalte wie
   eine Muster-Speisekarte — klar als Beispiel kennzeichnen, falls keine echten vorliegen.)
3. **Branchenspezifisches Design** — Palette & Stimmung passend zur Branche (siehe
   Profile unten), NICHT pauschal schwarz/dunkel.
4. **Self-contained**: alle `<style>` inline, minimales inline `<script>`. Google Fonts
   via `<link>` ok (es ist eine noindex-Konzeptseite).
5. `<html lang="de">`, viewport, `<meta name="robots" content="noindex">`, Titel +
   `<meta description>` aus echten Inhalten, sinnvolle `alt`-Texte.
6. Voll responsive, valide, deutsch, > 4 KB.

## Design-Prinzipien (branchenspezifisch, nicht einheitlich)

Wähle **passend zur Branche** eine eigenständige, hochwertige Designsprache:
- **Palette & Stimmung** zur Branche (Beispiele unten).
- **Typografie**: eine hochwertige Web-Schrift, die zur Branche passt (z. B. serifenlos-
  technisch für Handwerk, elegant-serifenbetont für Beauty/Gastro-Premium, klar-medizinisch
  für Praxen). Schriftgrößen mit Hierarchie, großzügiger Whitespace.
- **Tonalität**: an `content` der Ursprungsseite anlehnen.
- Premium-Anmutung: feine Schatten, ruhige Animationen, gute Bildkomposition,
  konsistente Abstände — edel, aber branchengerecht (ein Handwerker darf warm &
  robust wirken, nicht „Kunstmuseum").

### Branchen-Profile (Orientierung, nicht Zwang)
- **Handwerk** (Dachdecker, Maler, Elektriker, Tischler, Sanitär, Heizung, Gartenbau):
  warm, robust, vertrauenswürdig — Erd-/Ambertöne, Stahl-Akzente, klare „Arbeit sichtbar"-
  Bildsprache. Feature: **Anfrage-/Terminformular**, „Leistungen"-Katalog, ggf. Referenzen.
- **Gastro** (Restaurant, Bäckerei, Café): warm, einladend, appetitlich — Terracotta/
  Dunkelrot/Ocker, große Gericht-Fotos. Feature: **Speisekarte/Menü** (kategorisiert),
  Reservierung, Öffnungszeiten.
- **Friseur / Beauty / Kosmetik**: elegant, stilvoll — gedeckte Edeltöne, Script-Akzent
  möglich. Feature: **Online-Terminbuchung**, Galerie, Behandlungsliste.
- **Praxis / Gesundheit** (Zahnarzt, Physio, Hörakustik): sauber, medizinisch, vertrauens-
  stiftend — Weiß/Blau/Teal, ruhig. Feature: **Terminvereinbarung**, Leistungen, Team,
  Anfahrt/Öffnungszeiten.
- **Fitness**: energetisch, dynamisch — kräftige Akzente (Lime/Orange auf Dunkel oder
  Hell). Feature: **Probetraining/Kontakt**, Kurse/Pläne.
- **Einzelhandel** (Goldschmied, Optiker, Blumen, Juwelier): edel, hochwertig präsentierend.
  Feature: Galerie/Vitrine, Beratungstermin.
- Default/sonstige: hochwertig, branchengerecht nach eigenem Ermessen.

## Branchenspezifische Premium-Features (passend einbauen)

Setze die Features ein, die zur Branche UND zu den `problems`/`opps` passen. Mindestens
1–2 davon pro Seite, sinnvoll integriert (kein Feature-Friedhof):

- **Kontakt-Chatbot / Assistent**: kleines Widget, das zur Anfrage/Termin führt
  (klar als Konzept, „Schreib uns" → Mail/Anfrage).
  - **Personalisieren mit dem Inhaber/der Leitung:** Wenn ein Foto + Name der
    Firmen-Leitung vorliegt, nutze dieses **Foto als Avatar** (Launch-Button + Chat-Kopf,
    rund, `object-fit:cover`) und schreibe Begrüßung & Antworten in der **Ich-Form** dieser
    Person (z. B. „Hallo, ich bin Maike …", „ich melde mich persönlich"). Name + Funktion
    im Chat-Kopf. Liegt kein Personenfoto vor: neutraler Marken-Avatar + „Team"-Ansprache.
- **Online-Terminvereinbarung / Buchung** (Praxis, Friseur, Beauty, Handwerk-Anfrage):
  ansprechendes Buchungs-UI (Schritte: Leistung → Wunschtermin → Kontakt) oder
  Kalender-Ansicht, das zu `mailto:`/Anfrage führt.
- **Speisekarte / Menü** (Gastro): kategorisierte Karte mit Gerichten + Preisen —
  NUR wenn echte Inhalte im Build-Job; sonst musterhaft & als Beispiel gekennzeichnet.
- **Leistungs-/Preis-Katalog**: Übersicht der Leistungen (aus `content`/`opps`).
- **Galerie / Referenzen / Vorher-Nachher**: mit Originalbildern.
- **Google-Reviews-Block** (drei Stimmen): NUR als明显 gekennzeichnete Beispiel-Stimmen
  oder weglassen — keine echten Bewertungen erfinden.
- **Öffnungszeiten / Anfahrt / Kontakt**: nur falls echte Daten im Build-Job.

## Sektions-Struktur (passend wählen, in sinnvoller Reihenfolge)

Header (fixiert, scrolled-State) · Hero (Originalbild, klare Headline + CTA) ·
Vertrauens-Strip/USPs · Leistungen · **branchenspezifisches Premium-Feature**
(Terminbuchung / Speisekarte / Katalog) · Galerie/Referenzen · Reviews · CTA-Band ·
Kontakt (tel:-Link, Adresse, Anfrage) · Footer („Konzept-Vorschau · MZ.9") ·
Mobile-CTA-Bar (Haupt-CTA fixiert unten).

## Technik (kompakt)

- Reveal-Animationen optional via `IntersectionObserver` (`.reveal`/`.lift` → `.in`),
  `header.scrolled` beim Scrollen, `prefers-reduced-motion` respektieren.
- Buttons mit klarer Hierarchie (Primär = Akzent, Sekundär = Outline).
- Inline `<style>`, minimales inline `<script>`. Keine externen CSS/JS-Dateien.

## Qualität vor Fertigstellung (Checkliste)

- [ ] Design/Palette **branchenspezifisch** (nicht pauschal dunkel)?
- [ ] Originalbilder aus `images[]` verbaut (Hero + Galerie + mind. 1 CTA-Band)?
- [ ] **Hero-Bild hochauflösend & passend** (nicht verpixelt/hochskaliert; sonst feste Bühne)?
- [ ] **Chatbot mit Inhaber/Leitung personalisiert** (Foto-Avatar + Ich-Form), falls Foto+Name vorhanden?
- [ ] 1–2 **branchenspezifische Premium-Features** (Termin/Speisekarte/Chatbot/…)?
- [ ] An `problems`/`opps` der Ursprungsseite orientiert (Schwächen behoben)?
- [ ] Nur echte Daten, nichts erfunden?
- [ ] `noindex`, `lang="de"`, viewport, title/description?
- [ ] Responsive (Mobile-CTA-Bar, Grids brechen um)?
- [ ] Self-contained, > 4 KB?

Schreibe die fertige `index.html` an den im Aufruf genannten Output-Pfad. Antworte danach
nur knapp (z. B. „✅ gebaut, N Bilder, Branche: X, Palette: <name>, Features: Terminbuchung+Galerie").
