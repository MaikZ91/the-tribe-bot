# MZ.9 Lead Agent — Workflow

Autonomer Funnel: findet echte Betriebe, baut individuelle Premium-Seiten mit
Originalbildern, publiziert sie und mailt eine Konzept-Vorschau — alles doppelt
abgesichert gegen Doppelversendung.

## Starten

```
start lead agent                            # → startet auto.js im Hintergrund
node lead_agent_deepseek/scripts/auto.js    # direkt
lead_agent_deepseek/run-auto.bat            # per Doppelklick
```

Test (ein Zyklus, sofortige Mail):
```
ONCE=1 EMAIL_DELAY_MAX_MIN=0 node lead_agent_deepseek/scripts/auto.js
```

## Die 5 Dateien

| Datei | Aufgabe |
|---|---|
| `scripts/rules.js` | **Einzige Wahrheitsquelle** für alle Regeln: Filter, `sent.json`-Schutz, `gate()`, `preflight()`, Listen. |
| `scripts/discover.js` | Overpass-Discovery: echte Betriebe + Originalbilder + Schwächen. |
| `scripts/auto.js` | **Der einzige Loop.** 3 Stufen, alles inline. |
| `scripts/screenshot-compare.js` | Original-vs-Preview-Vergleichsbild (Puppeteer). |
| `scripts/send_mail.js` | SMTP-Versand + `recordSent`. |

## Die 3 Stufen (pro Zyklus in `auto.js`)

**Stufe 1 — Discovery + Build-Job**
Queue leer? → `discover()` (Overpass) füllt sie. 1 Lead konsumieren → Bilder ggf.
nachholen → `gate()` prüfen → bei `ok` `build-job.json` (`needs_build`) anlegen.

**Stufe 2 — Premium-Seite bauen**
Alle offenen Builds parallel via `claude -p` (frontend-design-Skill, Originalbilder
prominent). Verifikation: `index.html` > 4 KB.

**Stufe 3 — Publish + Screenshot + Mail**
`listBuiltNotSent()` → `markPublished` + `gitPushBulk` (commit-first, OHNE autostash)
→ Pages-Deploy abwarten → `screenshot-compare` (mit Retry) → pro Lead `send_mail.js`
mit 0–`EMAIL_DELAY_MAX_MIN` Min Staffelung → bei Erfolg `recordSent(id)`.

→ `INTERVAL_MIN` Pause, nächster Zyklus.

## Die eisernen Regeln (aus `rules.js`, an jedem Gate)

1. **Keine Kanzlei/Recht/Steuer/Anwalt** — `isKanzleiSteuer()`.
2. **Keine Placeholder-Mails** (mustermann/beispiel/rotlicht/example/…) — `isPlaceholderEmail()`.
3. **`sent.json`-Dedup** — jede Adresse genau einmal — `isEmailAlreadySent()`.
4. **`sent.json` race-sicher** (`.sent.lock`-Mutex via `recordSent`) + **autostash-sicher**
   (`auto.js` committet zuerst, dann `pull --rebase` OHNE `--autostash`).
5. **Originalbilder Pflicht** — kein Bild → kein Build-Job, keine bildlose/Stock-Seite.
6. **E-Mail-Timing unverändert** — 0–`EMAIL_DELAY_MAX_MIN` Min Staffelung.
7. **Single-Instance-Lock** — `.auto.lock` + PID-Liveness, kein zweiter Loop.

### `gate(lead)` — die eine Prüfung, die alle Regeln bündelt

```
kanzlei/recht/steuer/anwalt?  → nein
valide E-Mail?                → nein
placeholder?                  → nein
schon versendet (sent.json)?  → nein
Originalbilder vorhanden?     → nein
sonst: ok
```

## Status prüfen

```
node lead_agent_deepseek/scripts/rules.js          # Pending-Liste
node lead_agent_deepseek/scripts/rules.js --json   # als JSON
```

## Konfiguration (env)

| Var | Default | Bedeutung |
|---|---|---|
| `INTERVAL_MINUTES` | 5 | Pause zwischen Zyklen |
| `EMAIL_DELAY_MAX_MIN` | 10 | max. E-Mail-Verzögerung (0 = sofort) |
| `BUILD_CMD` | `claude -p` | eigener Build-Befehl (`{ID}`/`{DIR}`) |
| `BUILD_TIMEOUT_MIN` | 8 | Build-Timeout |
| `PAGES_DEPLOY_WAIT_SEC` | 75 | Wartezeit auf GitHub-Pages-Deploy vor Screenshot |
| `ONCE` | — | `1` = nur ein Zyklus |

## Daten

- `sent.json` — versendete Leads: `{ "<id>": "<ISO-Zeitstempel>" }`. Die E-Mail-Adresse
  steht im zugehörigen `docs/leads/<id>/build-job.json`. **Einzige Schreibstelle:**
  `recordSent()` in `rules.js` (unter Mutex).
- `queue.json` — Discovery-Staging (`leads[]` + `processed[]`).
- `leads/<id>.json` — Roh-Lead (Dedup + Archiv).
- `docs/leads/<id>/` — `build-job.json`, `index.html`, `compare.png`/`original.png`/`preview.png`.

## Deployment

GitHub Pages deployed von `docs/` auf `main`. MZ.9-Seite: `https://maikz91.github.io/the-tribe-bot/mz9.html`.
