# Community-Abstimmung: Silent Disco vs. Techno × Paint

Instagram-Reel (9:16, 1080×1920, 30 fps, ~22 s) als Community-Umfrage:
**Welches Event sollen wir als Nächstes veranstalten?**

Ergebnis: `the-tribe-event-poll-reel.mp4`

## Aufbau

| Zeit | Inhalt |
|---|---|
| 0,0 – 2,9 s | Split-Screen-Hook: links Silent Disco, rechts Techno × Paint, Titelfrage oben |
| 2,9 – 10,2 s | Block **A — 🎧 Silent Disco**: Open Air, Sonnenuntergang, Funkkopfhörer |
| 10,2 – 11,1 s | „ODER" — Split-Screen-Flash als Umschaltpunkt |
| 11,1 – 18,4 s | Block **B — 🎨🎶 Techno × Paint**: DJ, Neon, Leinwand, Pinsel, Farbe |
| 18,4 – 22,3 s | Outro: „🔥 Du entscheidest!" + A/B-Karten + „👇 Schreib deine Wahl in die Kommentare!" |

Jeder Schnitt liegt auf dem Beat (124 BPM, Schnitte alle 2–3 Beats), die beiden
Event-Blöcke sind exakt gleich lang (je 15 Beats) — keine Seite wird optisch
bevorzugt. Grading trennt die Optionen: warm/golden für A, kühl/violett für B.

## Neu bauen

```bash
python fetch_assets.py     # lädt Stock-Clips, Musik und Inter-Font nach ./assets
python build.py            # rendert nach ./out/the-tribe-event-poll-reel.mp4
```

Voraussetzungen: `pip install imageio-ffmpeg` und ein Chromium (für die
Text-Overlays). Der Pfad zum Browser steht in `build_overlays.py`.

## Wie es gebaut ist

- **`fetch_assets.py`** – lädt Footage + Musik von Mixkit (siehe `SOURCES.md`).
- **`overlays/*.html`** – sämtliche Texte sind HTML/CSS und werden von Chromium
  als transparente PNGs in 1080×1920 gerendert (`build_overlays.py`). Grund:
  So sind echte Farb-Emojis (🗳️ 🎧 🎨 🔥 👇) und sauberes Typo-Layout möglich —
  `drawtext` in ffmpeg kann beides nicht.
- **`build.py`** – Pass 1 schneidet jeden Shot auf das Beat-Raster (9:16-Crop mit
  langsamem Push, Grading, Vignette, Korn), Pass 2 legt die Text-Overlays mit
  Ein-/Ausblendungen darüber und mischt die Musik.

## Text ändern

Texte stehen in `overlays/*.html`, danach:

```bash
python build_overlays.py && python build.py
```

Die Schnittfolge selbst steht als `SHOTS`-Liste oben in `build.py` — Reihenfolge,
Ein-Punkt, Länge in Beats, Grading und Zoomrichtung pro Shot.
