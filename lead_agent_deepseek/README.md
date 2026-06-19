# MZ.9 Lead Agent — DeepSeek Edition (Lokal)

Parallel-Workflow zum Claude/Playwright-System. Nutzt DeepSeeks native Tools.
Output kompatibel mit dem bestehenden Dashboard unter `docs/leads/dashboard/`.

## 🚀 Quickstart

```bash
# Daemon starten (alle 5 Min ein Lead):
lead_agent_deepseek\run.bat

# Oder direkt:
node lead_agent_deepseek/scripts/daemon.js

# Mit eigenem Intervall (z.B. 2 Minuten):
set INTERVAL_MINUTES=2 && node lead_agent_deepseek/scripts/daemon.js
```

## Architektur

```
┌──────────────────────────────────────────────────┐
│              LOKALER DAEMON (alle 5 min)         │
│                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │ QUEUE    │ → │ AUDIT    │ → │ BUILD    │     │
│  │ next lead│   │ Lighthse │   │ Preview  │     │
│  └──────────┘   └──────────┘   └──────────┘    │
│       ↑                              │          │
│       │         ┌──────────────┐     │          │
│       └─────────│ DEEPSEEK     │     │          │
│   Queue füllen  │ (LLM Agent)  │     │          │
│                 └──────────────┘     │          │
│                          ↓           ↓          │
│                    DASHBOARD    GIT PUSH         │
│                    (eintragen)  (Pages Deploy)   │
└──────────────────────────────────────────────────┘
```

**Zwei Modi, ein System:**

| Modus | Wer | Was |
|---|---|---|
| ⚡ **Daemon** (alle 5 min) | `daemon.js` | Queue → Lighthouse → Build → Dashboard → Push |
| 🧠 **Intelligent** | DeepSeek Agent | Unternehmen finden, Copy schreiben, Queue füllen |

## Dateien

```
lead_agent_deepseek/
├── README.md                    Diese Datei
├── run.bat                      ⭐ Doppelklick zum Starten
├── queue.json                   Lead-Queue (wird abgearbeitet)
├── DISCOVERY_NEEDED.txt         Flag: Queue leer → DeepSeek füllt auf
├── jobs/
│   ├── discovery.json           Discovery-Job
│   ├── build.json               Build-Job
│   └── deliver.json             E-Mail-Template
├── scripts/
│   ├── daemon.js                ⭐ Lokaler Daemon (Haupt-Script)
│   ├── loop.js                  CI-Variante (GitHub Actions)
│   └── audit.js                 Einmal-Audit
├── templates/
│   └── preview.html             Basis-Template mit {{PLATZHALTERN}}
└── leads/                       Audit-Ergebnis-JSONs
```

## So läuft's

### Automatisch (Daemon läuft lokal)
1. `daemon.js` prüft alle 5 Minuten `queue.json`
2. Nächster Lead → Lighthouse-Audit
3. HTML-Vorschau aus Template → `docs/leads/<id>/`
4. Dashboard updaten
5. Git commit + push → GitHub Pages deployt

### Manuell (Queue auffüllen)
1. DeepSeek Agent: `web_search "<branche> Bielefeld"`
2. DeepSeek Agent: `fetch_url <website>` → HTML lesen
3. DeepSeek Agent: Lead in `queue.json` eintragen
4. Daemon verarbeitet automatisch beim nächsten Tick

## Lead-Queue Format

```json
{
  "id": "restaurant-beispiel",
  "name": "Restaurant Beispiel",
  "nameShort": "Beispiel",
  "industry": "Gastronomie",
  "hebel": "hoch",
  "website": "https://www.restaurant-beispiel.de/",
  "phone": "+495211234567",
  "email": "info@restaurant-beispiel.de",
  "heroH1": "Gut essen.<br><em>Mitten in Bielefeld.</em>",
  "heroSub": "Frische, saisonale Küche...",
  "ctaText": "Tisch reservieren",
  "features": ["Saisonale Küche", "Täglich frisch"],
  "problems": ["Keine Online-Reservierung", "Speisekarte nur PDF"],
  "opps": ["Online-Reservierung 24/7", "Inline-Speisekarte"]
}
```

## Deployment

GitHub Pages deployed von `docs/` auf `main` Branch.
- Dashboard: `https://maikz91.github.io/the-tribe-bot/leads/dashboard/`
- MZ.9 Seite: `https://maikz91.github.io/the-tribe-bot/mz9.html`
