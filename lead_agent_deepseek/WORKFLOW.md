# MZ.9 Lead Agent — Autonomer Workflow (Deutschlandweit)

Vollautomatischer, kontinuierlicher Lead-Funnel. Findet echte Betriebe
deutschlandweit, baut jedem eine **echte Premium-Landingpage mit Original-
bildern** und veröffentlicht sie inkl. Dashboard-Eintrag — **ohne manuelles
Eingreifen**, mit **automatischem Push** nach GitHub Pages.

> Tool-agnostisch: Stufe 2 (Seitenbau) erledigt **DeepSeek ODER Claude**.
> Stufe 1 + 3 sind reine Node-Scripts und brauchen keinen LLM.

## ⚠️ EISERNE REGEL: KEINE TEMPLATE-PREVIEWS
Jede Konzept-Vorschau ist ein **handgebautes Unikat** mit eigenem Premium-Design
und Originalbildern — als bewusster Kontrast zur alten Website des Betriebs.
Kein `templates/preview.html`, kein `{{PLATZHALTER}}`-Ersatz.

---

## Die drei Stufen

```
┌─────────────────────────────────────────────────────────────────┐
│ STUFE 1 — DISCOVER               (Node, vollautomatisch)        │
│   scripts/daemon.js  (--once oder Dauer-Loop)                    │
│   • Overpass-API: echte Betriebe (Stadt×Branche, deutschlandweit)│
│   • zieht Original-Bild-URLs, Kontakt, Content, Schwächen+Score  │
│   • schreibt docs/leads/<id>/build-job.json (status: needs_build)│
│   • KEIN Seitenbau, KEIN Push (kein Lighthouse nötig)           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STUFE 2 — CUSTOM BUILD            (LLM-Agent: DeepSeek/Claude)   │
│   Worklist:  node scripts/pending.js                            │
│   • baut docs/leads/<id>/index.html — echte Premium-Seite       │
│   • Frontend-Design-Skills, Originalbilder aus build-job.json    │
│   • Stilreferenz: docs/leads/alt-bielefeld/index.html           │
│   • Multi-Agent: bei mehreren Leads parallele Sub-Agenten        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STUFE 3 — PUBLISH + AUTO-PUSH     (Node, vollautomatisch)       │
│   scripts/publish.js --all                                      │
│   • Dashboard-Eintrag (SEED + EMAILS)                           │
│   • build-job.json → status: published                          │
│   • git commit + push  → GitHub Pages deployt (1–2 Min)         │
└─────────────────────────────────────────────────────────────────┘
```

**Wichtig:** Dashboard-Eintrag + Push passieren ERST nach dem Seitenbau
(Stufe 3) — so entstehen nie tote Links auf leere Seiten.

---

## So läuft es autonom

### Variante A — Turnkey: `run-auto.bat` (empfohlen, voll custom)
Ein Doppelklick startet den autonomen Dauerloop (`scripts/auto.js`), der pro
Zyklus alle drei Stufen fährt: Discovery → Custom-Build → Publish + Auto-Push.

```
lead_agent_deepseek\run-auto.bat
```

Der Build-Agent (Stufe 2) ist **tool-agnostisch** und über `BUILD_CMD` wählbar:
- **Default:** Claude Code headless (`claude -p ... --dangerously-skip-permissions`).
- **DeepSeek o.a.:** vorher setzen, `{ID}`/`{DIR}` werden ersetzt:
  ```
  set BUILD_CMD=deepseek run build-lead --id {ID}
  ```

Steuerung per Umgebungsvariablen: `INTERVAL_MINUTES` (Default 5),
`MAX_BUILDS` pro Zyklus (Default 3), `BUILD_TIMEOUT_MIN` (Default 12),
`ONCE=1` (nur ein Zyklus, zum Testen).

Manuell / Schritt für Schritt (was auto.js intern macht):
```bash
node lead_agent_deepseek/scripts/daemon.js --once     # Stufe 1
node lead_agent_deepseek/scripts/pending.js --json     # Worklist Stufe 2
#   → pro „needsBuild": docs/leads/<id>/index.html bauen (Build-Briefing unten)
node lead_agent_deepseek/scripts/publish.js --all      # Stufe 3 (+ Auto-Push)
```

### Variante B — Reiner Daemon (Dauer-Loop)
`run.bat` bzw. `node scripts/daemon.js` läuft alle N Minuten und legt nur
Build-Jobs an. Seiten werden dann separat vom Agenten gebaut + publiziert.
Für „wirklich ohne mich" → Variante A.

---

## Build-Briefing für Stufe 2 (Qualitätsstandard)

Jede Seite muss das Niveau von `docs/leads/alt-bielefeld/index.html` haben:

- **Self-contained** `index.html` (inline `<style>`, minimal inline JS für
  Scroll-Reveal `.rv`/`.in`, Header-scrolled-State, Mobile-Nav).
- **Original-Bilder = PFLICHT** aus `build-job.json` → `images[]` (Hero, Galerie,
  CTA-Band, Leistungsbilder). Hero ohne `loading=lazy`, Rest mit. NIE eine
  bildlose Seite, NIE Stock-/Fantasiebilder. Leads ohne `images[]` werden gar
  nicht erst gebaut (Daemon/auto.js überspringen sie).
- **Echte Inhalte** aus `build-job.json` → `content` (Titel, H1/H2, Desc) und
  `name`/`address`/`phone`. **Keine Fakten erfinden, keine Preise erfinden.**
- Branchen-passende, eigene Farbpalette (nicht 1:1 die Referenz kopieren).
- Sektionen: Ribbon · fixer Header · Vollbild-Hero · Info-Strip · Leistungen-
  Grid · Galerie · Reviews (3× „· Google" + Trust-Fußnote) · CTA-Band ·
  Kontakt (tel:-Link) · Footer „Konzept-Vorschau · MZ.9" · Mobile-CTA-Bar.
- `<html lang="de">`, viewport, **`<meta name="robots" content="noindex">`**
  (Akquise-Konzeptseite!), Titel + Description aus echten Inhalten.
- Voll responsive, valide, deutsch, sinnvolle alt-Texte.

---

## E-Mail-Versand ⚠️ NICHT im Auto-Loop — VORHER FRAGEN
Der Versand an Leads läuft **niemals automatisch** mit. Vor jedem Versand:
1. Leads + Empfänger-Adressen auflisten
2. Betreiber-Bestätigung abwarten
3. Erst dann versenden (SMTP-Creds in `.env`)

---

## Befehle & Datenfluss

| Zweck | Befehl |
|---|---|
| Ein Discovery-Tick | `node scripts/daemon.js --once` |
| Dauer-Loop (alle N Min) | `node scripts/daemon.js` · `INTERVAL_MINUTES=5` |
| Discovery direkt testen | `node scripts/discover.js <Stadt> <Branche> <n>` |
| Worklist offener Builds | `node scripts/pending.js` (`--json`) |
| Einen Lead publizieren | `node scripts/publish.js <id>` |
| Alles Gebaute publizieren | `node scripts/publish.js --all` |

| Datenfluss | Ort |
|---|---|
| Queue | `lead_agent_deepseek/queue.json` |
| Build-Job pro Lead | `docs/leads/<id>/build-job.json` |
| Fertige Seite | `docs/leads/<id>/index.html` |
| Dashboard | `docs/leads/dashboard/index.html` |
| Live | `https://maikz91.github.io/the-tribe-bot/leads/dashboard/` |

## Quellen / Technik
- Discovery: **OpenStreetMap Overpass API** (`scripts/discover.js`) — ersetzt das
  frühere, unzuverlässige DuckDuckGo-Scraping. Kein API-Key. 53 Städte × ~27 Branchen.
- Dedup gegen `docs/leads/dashboard/done.json` + bestehende Lead-Ordner.

Letzter Stand: 2026-06-20 — Overpass-Discovery, 3-Stufen-Autoloop, Auto-Push.
