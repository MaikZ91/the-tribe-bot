# MZ.9 Lead Agent — DeepSeek Edition

Parallel-Workflow zum Claude/Playwright-System. Nutzt DeepSeeks native Tools statt
Playwright MCP. Output kompatibel mit dem bestehenden Dashboard unter
`docs/leads/dashboard/`.

## Architektur: Kontinuierlicher Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    GITHUB ACTIONS (alle 30 min)             │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌───────┐│
│  │ QUEUE    │ →  │ AUDIT    │ →  │ BUILD    │ →  │ PUSH  ││
│  │ next lead│    │ Lighthse │    │ Preview  │    │ Pages ││
│  └──────────┘    └──────────┘    └──────────┘    └───────┘│
│       ↑                                              │     │
│       │         ┌──────────────┐                     │     │
│       └─────────│ DEEPSEEK     │←────────────────────┘     │
│   Queue füllen  │ (LLM Agent)  │  Dashboard + E-Mail       │
│                 └──────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

**Zwei Modi, ein System:**

| Modus | Wer | Was |
|---|---|---|
| **Mechanisch** (alle 30 min) | GitHub Actions | Queue → Lighthouse → Build → Dashboard → Push |
| **Intelligent** (on-demand) | DeepSeek Agent | Unternehmen finden, Copy schreiben, Queue füllen |

## Tool-Mapping: Claude → DeepSeek

| Schritt | Claude (Playwright MCP) | DeepSeek |
|---|---|---|
| Unternehmen finden | Google Maps / Playwright browse | `web_search` |
| Website analysieren | Playwright render + DOM-Snapshot | `fetch_url` (HTML) + `exec_shell` (Lighthouse) |
| Audit-Score | Playwright DOM-Auswertung | Lighthouse JSON + Heuristik |
| Vorschau bauen | LLM generiert HTML | LLM generiert HTML (identisch) |
| E-Mail generieren | Playwright MCP Formular | `mailto:`-Link (identisch) |
| Deployen | Git Push via MCP | `git commit` + `git push` |
| **Scheduling** | Claude scheduled_tasks.lock | **GitHub Actions alle 30 min** |

## Dateien

```
lead_agent_deepseek/
├── README.md                    Diese Datei
├── queue.json                   Lead-Queue (wird vom Loop abgearbeitet)
├── DISCOVERY_NEEDED.txt         Flag: Queue leer, DeepSeek muss auffüllen
├── jobs/
│   ├── discovery.json           Discovery-Job (Branche, Region, Count)
│   ├── build.json               Build-Job (Lead-ID, Website, Instruction)
│   └── deliver.json             E-Mail-Template + Dashboard-Format
├── scripts/
│   ├── loop.js                  ⭐ Kontinuierlicher Loop (Haupt-Script)
│   └── audit.js                 Lighthouse-Runner (einmalig)
├── templates/
│   └── preview.html             Basis-Template mit {{PLATZHALTERN}}
└── leads/                       Audit-Ergebnis-JSONs

.github/workflows/
└── lead-agent-deepseek.yml      ⭐ Scheduled Workflow (alle 30 min)
```

## Workflow: So läuft's

### Automatisch (alle 30 Minuten via GitHub Actions)
1. `loop.js` nimmt nächsten Lead aus `queue.json`
2. Lighthouse-Audit der Website
3. HTML-Vorschau aus Template generieren → `docs/leads/<id>/`
4. Dashboard updaten (`docs/leads/dashboard/index.html`)
5. Git commit + push → GitHub Pages deployt

### Manuell (wenn Queue leer oder neue Branche)
1. DeepSeek Agent: `web_search "<branche> Bielefeld"`
2. DeepSeek Agent: `fetch_url <website>` → HTML lesen
3. DeepSeek Agent: Lead in `queue.json` eintragen mit allen Feldern
4. DeepSeek Agent: `git commit + push`
5. Nächster GitHub Actions Run verarbeitet ihn automatisch

## Lead-Queue Format

```json
{
  "id": "restaurant-beispiel",
  "name": "Restaurant Beispiel",
  "nameShort": "Beispiel",
  "industry": "Gastronomie",
  "hebel": "hoch",
  "score": 45,
  "website": "https://www.restaurant-beispiel.de/",
  "phone": "+495211234567",
  "email": "info@restaurant-beispiel.de",
  "heroH1": "Gut essen.<br><em>Mitten in Bielefeld.</em>",
  "heroSub": "Frische, saisonale Küche in gemütlichem Ambiente...",
  "ctaText": "Tisch reservieren",
  "ctaHref": "#reservieren",
  "features": ["Saisonale Küche", "Täglich frische Karte", "Biergarten"],
  "problems": ["Keine Online-Reservierung", "Speisekarte nur als PDF", "Keine Bewertungen"],
  "opps": ["Online-Reservierung 24/7", "Inline-Speisekarte", "Google-Reviews prominent"]
}
```

## Deployment

GitHub Pages deployed automatisch von `docs/` auf dem `main` Branch.
Live-URLs:
- Dashboard: `https://maikz91.github.io/the-tribe-bot/leads/dashboard/`
- MZ.9 Seite: `https://maikz91.github.io/the-tribe-bot/mz9.html`
