# Mini-Doku-Reel „Gespräch mit Kamera“ (Vorgabe von Maik, 13.10.2026)

## Format
- Reel 9:16, **45–60 s**, Stil kurzer Dokumentarfilm: ruhige, echte Schnitte, kein Effekt-Gewitter.
- **Keine Sprachausgabe**, nur Musik (lizenzfrei aus `instagram_autopilot/music/`, Stimmung ruhig/warm, z. B. `mood:chill`).
- Optional kurze Untertitel-Zeilen (max. 5 Wörter) pro Szene.

## Szenen (Reihenfolge fest)
| # | Szene | Länge | Clip-Quelle |
|---|---|---|---|
| 1 | Ankunft (Kunde kommt an, Begrüßung) | 6–8 s | `footage/dating/01-ankunft*.mp4` |
| 2 | Erstes Gespräch (reden, kein Posieren) | 8–10 s | `footage/dating/02-gespraech*.mp4` |
| 3 | Lachen über etwas Zufälliges | 6–8 s | `footage/dating/03-lachen*.mp4` |
| 4 | Der Klick der Kamera (Nahaufnahme Auslöser) | 3–5 s | `footage/dating/04-klick*.mp4` |
| 5 | Das fertige Bild (Foto aus diesem Shooting, kurzer Zoom) | 5–7 s | `images/dating/kunde-*.jpg` |
| 6 | Titel-Card: „Das ist kein Fotoshooting. Das ist ein Gespräch mit Kamera.“ | 4–5 s | Text auf dunklem Grund |
| 7 | CTA: „Link in Bio“ (+ 1 Stunde · ab 99 € · noch am selben Tag fertig) | 3–4 s | Logo-/CTA-Karte |

## Caption
Kurz, Ich-Form, Maiks Ton. Endet IMMER mit der Kommentarfrage:
**„Was wäre dein liebstes Setting für ein Shooting?“**
Danach: „Link in Bio“. Hashtags z. B. #DatingFotos #OnlineDating #AuthentischeFotos #Münster.

## Harte Regeln
- **Nur echte Clips aus einem echten Shooting.** Keine Stock-Clips, keine KI-Videos, keine nachgestellten Szenen, die als echtes Shooting ausgegeben werden.
- Kunden im Video/Endbild nur mit **schriftlichem Einverständnis** (Maik bestätigt im Chat oder in `footage/dating/FREIGABE.json`).
- Fehlen Clips: **kein Reel bauen**, sondern Maik um die fehlenden Szenen bitten (Liste oben). Kein Ersatz durch Fremdmaterial.
- Übergangslösung (nur wenn Maik zustimmt): „Behind the Scenes“-Version mit Maiks eigenen echten Fotos (`echt-kamera-*.jpg`, `echt-lachen-*`), klar als Fotos statt Video, ohne „fertiges Kundenbild“.

## Umsetzung
Spec in `instagram_autopilot/posts/` mit `"type": "reel"`, Folien `{"kind": "clip", "src": "instagram_autopilot/footage/dating/…", "length": s, "caption": "…"}`, Endkarten als `hook`/`cta`, `"music": "mood:chill"`, kein `voice`. Rendern mit `python3 instagram_autopilot/render.py <spec> <out>`, Frames prüfen, dann queued.
