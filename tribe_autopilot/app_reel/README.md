# App-Reel-Baukasten (THE TRIBE App)

Animierte Promo-Reels aus echten App-Abläufen (Maik 17.10.: „geile Animationen für die Posts“).

1. `capture_app.py` – Playwright nimmt die Live-App auf (Ticker, Für-dich-Scroll, Herz, Chat, Stadtpuls mit wanderndem Zeitregler, „Ich bin unterwegs“, Tribe Tonight, Ganzseiten-Screenshot für den Scroll-Pan). Uhrzeit per `page.clock.install` auf einen Abend mit laufenden Events setzen; Event-Daten/Bilder wie im Skript per Route laden. Pfade (Port, Ordner, Event-JSON) anpassen.
2. `build_reel.py` – baut 1080×1920 @30 fps: Stock-Szenen (Mixkit, Ordner `stock/`), Handy-Mockup mit Bildfolgen (`s_phone([...])`), Scroll-Pan (`s_pan`), Endkarte, Musik (Mixkit). Szenenliste unten im Skript anpassen.
3. Als fertiges Video posten mit `"keep_audio": true` in der Spec.

Regeln: nur echte App-Screens, Stadtpuls = „Hochrechnung aus allen Events“, keine KI-Menschen, nur Mixkit-Lizenz.
