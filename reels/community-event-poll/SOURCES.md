# Quellen & Lizenz

Alle Bewegtbild- und Musik-Quellen stammen von **[Mixkit](https://mixkit.co)** und
stehen unter der **[Mixkit Free License](https://mixkit.co/license/)**:
kommerzielle Nutzung erlaubt, keine Namensnennung nötig, Weiterverbreitung der
*rohen* Assets nicht erlaubt. Deshalb liegen die Originaldateien **nicht** im
Repo — `fetch_assets.py` lädt sie bei Bedarf neu.

## Musik

| Titel | BPM | Mixkit-ID |
|---|---|---|
| Techno Fest Vibes | 124 | [124](https://mixkit.co/free-stock-music/techno-fest-vibes-124/) |

Der Schnitt liegt auf dem Beat-Raster von 124 BPM (Beat = 0,4839 s); der
Musik-Einstieg (`MUSIC_IN` in `build.py`) sitzt auf einer Downbeat-Zählzeit im
energiereichsten Abschnitt des Tracks.

## Footage

### A — 🎧 Silent Disco (warmes Grading)

| ID | Motiv |
|---|---|
| 51295 | Five young people dancing a choreography in the street |
| 21239 | Woman feels happiness when listening to music |
| 4636 | Couple in love dancing happily |
| 4556 | Friends with colored smoke bombs |
| 4269 | Audience at a concert |
| 4664 | Lovers holding each other on a romantic sunset |

### B — 🎨🎶 Techno × Paint (kühles Neon-Grading)

| ID | Motiv |
|---|---|
| 4187 | DJ playing on a stage with LED screens |
| 43444 | Artist painting painting on a canvas |
| 33906 | Girl dancing on a dark floor under colored lights |
| 43427 | Many brushes of an artist |
| 33899 | Young woman dancing under a cloud of smoke and a purple light |
| 41996 | Pink orange and yellow ink dissolving in water |

## Schriften

- **Anton** (Headlines) — SIL Open Font License, liegt bereits unter `tribe-story/fonts/`.
- **Inter 4.0** (Sublines, Tags) — SIL Open Font License, wird von `fetch_assets.py` geladen.

## Farben

Aus dem Tribe-Look der Landingpage übernommen: Tinte `#0A0807`, Creme `#F7F2EA`,
Amber `#F5A21A` (Seite A) — dazu Violett `#A855F7` als Neon-Gegenpol für Seite B.
