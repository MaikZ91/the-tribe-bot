# Instagram-Autopilot · @ai.made.in.bielefeld

Bespielt den Instagram-Kanal automatisch – ohne bezahlte Tools.

| Teil | Wo | Wann |
|---|---|---|
| Beiträge (Reels + Karussells) als JSON | `posts/` | Warteschlange, sortiert nach Dateiname |
| Rendern (Pillow + ffmpeg, Stimme: Piper „Kerstin“, CC0) | `render.py` | beim Posten |
| Posten über die Instagram-API (Instagram-Login) | `.github/workflows/ig-autopilot-post.yml` | stündlich prüfen, gepostet wird zu den Slots in `config.json` |
| Kennzahlen + `data/report.md` | `.github/workflows/ig-autopilot-insights.yml` | täglich 04:23 UTC, montags Token verlängern |
| Planung der nächsten Woche | Claude-Routine, Anleitung in `ROUTINE.md` | montags |

Secrets im Repo: `IG_AI_TOKEN`, `IG_AI_USER_ID` (nur dieser Account – The Tribe nutzt
eigene Secrets). Optional `GH_SECRETS_PAT` (fine-grained, Secrets: Read & write), damit ein
beim Verlängern neu ausgegebenes Token automatisch gespeichert wird.

Manuell posten: Actions → „Instagram Autopilot — Posten“ → *Run workflow* (optional
`post_id`, `force`).

Lokal testen: `python instagram_autopilot/render.py instagram_autopilot/posts/001-anfrage-21uhr.json /tmp/out`

## Regeln für Inhalte
- Deutsch, Du-Ansprache, Zielgruppe: Betriebe in Bielefeld/OWL.
- Keine erfundenen Kunden, Zitate, Ergebnisse oder Preise. Beispielzahlen als „Beispielrechnung“ kennzeichnen.
- Keine realistischen KI-Menschen (sonst Kennzeichnungspflicht) – nur Grafik, Text, echte Aufnahmen.
- Nur eigene oder lizenzfreie Musik (`render.py` synthetisiert die Musik selbst).
- Jeder Beitrag endet mit dem Aufruf zum kostenlosen KI-Check.

## Demo-Reels mit Bildschirmaufnahme
1. Tool lokal ausliefern: `cd docs && python3 -m http.server 8765`
2. Mit Playwright (Node) aufnehmen: Viewport 1080×1920, `deviceScaleFactor: 1`,
   per `addInitScript` `document.documentElement.style.zoom = '2.5'` setzen,
   `recordVideo: {size: {width:1080, height:1920}}`, Eingaben mit `keyboard.type(…, {delay: 40})`.
3. WebM nach MP4 wandeln, schwarzes Ende abschneiden (`ffmpeg -t …`), nach `footage/` legen.
4. Im Beitrag: `{"kind": "clip", "src": "footage/<datei>.mp4", "captions": [[start, ende, "Text"], …]}`.
