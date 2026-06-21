# MZ.9 Lead Agent

Autonomer Lead-Funnel: findet echte Betriebe (Overpass), baut individuelle
Premium-Seiten mit Originalbildern (`claude -p`), publiziert auf GitHub Pages und
mailt eine Konzept-Vorschau — abgesichert gegen Doppelversendung.

## Quickstart

```bash
# Autonomer Loop (Hintergrund):
node lead_agent_deepseek/scripts/auto.js
# oder Doppelklick: lead_agent_deepseek/run-auto.bat

# Einmal zum Testen (sofortige Mail):
ONCE=1 EMAIL_DELAY_MAX_MIN=0 node lead_agent_deepseek/scripts/auto.js

# Status der offenen Builds:
node lead_agent_deepseek/scripts/rules.js
```

## Architektur (5 Live-Dateien)

```
rules.js            ← EINZIGE Wahrheitsquelle: Filter, sent.json-Schutz, gate(), preflight()
  ↑
auto.js             ← Der einzige Loop (3 Stufen, inline)
  ├─ discover.js    ← Stufe 1: Overpass-Discovery + Originalbilder
  ├─ (claude -p)    ← Stufe 2: Premium-Seite bauen
  ├─ screenshot-compare.js  ← Stufe 3: Original-vs-Preview-Vergleichsbild
  └─ send_mail.js   ← Stufe 3: SMTP-Versand + recordSent
```

## Die 3 Stufen pro Zyklus

1. **Discovery + Build-Job** — Queue füllen (Overpass), 1 Lead, Bilder nachholen,
   `gate()` prüfen, `build-job.json` anlegen.
2. **Build** — paralleler `claude -p`-Build, Verifikation > 4 KB.
3. **Publish + Screenshot + Mail** — Bulk-Push (commit-first, kein autostash),
   Vergleichsbild, gestaffelte E-Mail (0–10 Min), `recordSent`.

## Eisernen Regeln

Keine Kanzlei/Recht/Steuer/Anwalt · keine Placeholder-Mails · `sent.json`-Dedup
(jede Adresse genau einmal) · `sent.json` race- + autostash-sicher · Originalbilder
Pflicht · E-Mail-Timing 0–10 Min · Single-Instance-Lock.

Siehe `WORKFLOW.md` für Details.
