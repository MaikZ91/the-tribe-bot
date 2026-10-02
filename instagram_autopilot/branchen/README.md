# Branchenmodule

Die Engine bleibt eine: `autopilot.py` (planen, posten, Story, Auswertung) und `render.py`
(Reels, Karussells). Ein **Account** ist ein Ordner mit `config.json`, `posts/`, `images/`, `data/`
und wird über `AUTOPILOT_HOME` gewählt. So laufen heute schon Praxis KI (`instagram_autopilot/`)
und The Tribe (`tribe_autopilot/`). Ein **Branchenmodul** erzeugt nur Post-Specs im gemeinsamen
Format und legt sie in den Kundenordner. Rendern, Freigabe und Posten sind für alle gleich.

```
instagram_autopilot/
├── autopilot.py, render.py      Engine (für alle Accounts)
├── branchen/
│   └── gastro.py                Modul Gastronomie & Events
└── kunden/<kunde>/              ein Ordner pro Kunde (config.json mit "branche")
    ├── config.json              Branding, Tonalität, Slots, Hashtags, Bilder je Anlass
    ├── images/                  eigene Fotos des Betriebs
    ├── posts/                   erzeugte Specs (Status draft → queued)
    └── data/                    freigabe-*.md, state.json, Auswertung
```

Einzige Änderung an der Engine: Specs dürfen `not_before`/`expires` (ISO-Datum) tragen. Der
Autopilot postet sie nur in diesem Fenster, abgelaufene Events werden übersprungen. Posts ohne
diese Felder (Praxis KI, The Tribe) verhalten sich unverändert.

## Gastronomie & Events (`gastro.py`)

```bash
# 1. Wochennachricht des Betreibers → Entwürfe + Vorschau + Freigabe-Datei
python instagram_autopilot/branchen/gastro.py woche demo-kneipe \
  "Freitag DJ ab 21 Uhr, Samstag Cocktail Happy Hour, Sonntag Live-Musik." --ab 2026-10-05 --render

# 2. Freigeben (alle oder einzeln) – erst dann postet der Autopilot
python instagram_autopilot/branchen/gastro.py freigeben demo-kneipe alle

# 3. Überblick
python instagram_autopilot/branchen/gastro.py status demo-kneipe
```

Aus einer Nachricht entstehen:

| Inhalt | Format | Wann |
|---|---|---|
| Wochenprogramm | Karussell (Titel, je Event eine Folie, Abschluss) + Story | Montag der Woche |
| Event-Ankündigung | Reel 9–10 s (Tag + Titel + Uhrzeit, Details, Call-to-Action) + Story | am Event-Tag |
| Caption, Hashtags, CTA | aus Kundenconfig + Anlass (DJ, Happy Hour, Live, Sport, Quiz, Essen, Drinks, Thema) | je Post |
| Reel-Idee | Vorschlag für einen 5-s-Handyclip des Betreibers | in der Freigabe-Datei |

Regeln, die der Code durchsetzt:
- **Nichts erfinden.** Nur Tag, Titel, Uhrzeit und Preis aus der Nachricht. Fehlt etwas, steht es
  unter „Fehlt“ in der Freigabe-Datei und wird nicht geschätzt.
- **Eigene Bilder zuerst.** `gastro.bilder` ordnet Fotos des Betriebs den Anlässen zu (rotierend).
  Ohne Foto wird eine Grafik im Branding des Kunden gerendert.
- **Freigabe vor Veröffentlichung.** Alles startet als `draft`.

Erkannt werden Wochentage ausgeschrieben („Freitag“, „samstags“) und kurz („Fr 21 Uhr“, „Mi.“),
Zeiten („ab 21 Uhr“, „18-20 Uhr“, „21:30 Uhr“) und Preise („6,50 €“).

### Neuer Kunde

1. `kunden/demo-kneipe/` kopieren, `config.json` anpassen: `name`, `account` (Instagram-Name, schützt
   vor falschem Token), `brand`-Farben, `handle_line`, `gastro.adresse`, `gastro.hashtags`, `gastro.cta`,
   `media_dir`/`media_public_base`/`media_raw_base` auf den neuen Ordnernamen.
2. Fotos des Betriebs nach `images/` und in `gastro.bilder` den Anlässen zuordnen.
3. Posten: Instagram-Login-Token des Kunden als GitHub-Secret hinterlegen und den Kunden im
   Posting-Workflow eintragen (gleicher Ablauf wie The Tribe: `AUTOPILOT_HOME=instagram_autopilot/kunden/<kunde>`).
   Das wird beim ersten echten Kunden eingerichtet. Ohne dessen Token kann und soll nichts posten.

Die Demo-Kneipe ist ein **fiktiver Beispielkunde** mit Mixkit-Platzhalterbildern (`images/CREDITS.json`)
und ohne Instagram-Account.

### Als Produkt (Vorschlag, Preise ungetestet)

| Paket | Inhalt | Preis/Monat |
|---|---|---|
| Wochenprogramm | 1 Wochen-Karussell + Story, Freigabe per Nachricht | 79 € |
| Events | + Reel + Story je Event (bis 4 pro Woche) | 149 € |
| Events + Clips | + Reels aus eigenen Handyclips, Monatsauswertung | 249 € |

Aufwand pro Kunde: einmalig Config + Fotos (ca. 1 h), danach pro Woche eine Nachricht des
Betreibers und ein Klick zur Freigabe.

### Nächste Ausbaustufen
- Wochennachricht direkt per WhatsApp entgegennehmen und die Freigabe-Vorschau zurückschicken
  (eigener Bot – der bestehende Tribe-WhatsApp-Bot bleibt unberührt).
- Kurze Handyclips des Betreibers automatisch als Clip-Folie in die Event-Reels schneiden
  (`render.py` kann Clips bereits).
- Posting-Workflow für mehrere Kunden (eine Matrix statt eines Workflows pro Kunde).
