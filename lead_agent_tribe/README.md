# The Tribe Lead Agent — Community-Agent für Bielefeld

Autonomer DeepSeek-Agent. Findet kreative Menschen in Bielefeld und lädt sie in die
The Tribe WhatsApp Community ein.

## 🎯 Mission

Kreative Menschen in Bielefeld + Umgebung erkennen und sie unaufdringlich in die
The Tribe WhatsApp Community einladen — ein offener Raum für Austausch, Projekte
und gemeinsames kreatives Schaffen.

## Architektur

```
┌──────────────────────────────────────────────────┐
│           DEEPSEEK COMMUNITY-AGENT               │
│                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │ DISCOVER │ → │ EVALUATE │ → │ INVITE   │    │
│  │ Profile  │   │ Kriterien│   │ WhatsApp │    │
│  │ finden   │   │ prüfen   │   │ Einladung│    │
│  └──────────┘   └──────────┘   └──────────┘    │
│       │                              │          │
│       │         ┌──────────────┐     │          │
│       └─────────│ QUEUE        │     │          │
│   Queue füllen  │ (queue.json) │     │          │
│                 └──────────────┘     │          │
│                          ↓           ↓          │
│                    SENT LOG     COMMUNITY       │
│                    (sent.json)  (WhatsApp)      │
└──────────────────────────────────────────────────┘
```

**Ein Modus — agent-driven:**
Der DeepSeek-Agent sucht, bewertet und lädt ein. Keine automatisierten Scripts nötig —
der Agent nutzt `web_search`, `fetch_url` und seine eigenen Bewertungsfähigkeiten.

## Dateien

```
lead_agent_tribe/
├── README.md                  Diese Datei
├── WORKFLOW.md                ⭐ Agent-Prompt & Workflow (vollständige Spec)
├── queue.json                 Lead-Queue (kreative Personen, 10 Einträge)
├── sent.json                  Bereits eingeladene Personen (Dedup)
├── jobs/
│   └── discovery.json         Discovery-Job-Spezifikation
├── scripts/
│   └── send_invite.js         ⭐ E-Mail-Versand (via Gmail SMTP)
└── templates/
    └── invitation.txt         ⭐ Fixe Einladungsvorlage (WhatsApp)
```

## So läuft's

### ⚡ Automatisch (empfohlen)

**Zwei-Schicht-System — läuft ohne dein Zutun:**

| Schicht | Was | Läuft wo | Intervall |
|---|---|---|---|
| **Agent Discovery** | DeepSeek sucht neue Leads | Durable Automation | Alle 6 Stunden |
| **E-Mail-Versand** | send_invite.js --all | GitHub Actions | Alle 30 Minuten |

1. **Agent-Discovery** (alle 6h): DeepSeek sucht nach kreativen Menschen in Bielefeld, bewertet Profile und trägt neue Leads in `queue.json` ein.
2. **Auto-Send** (alle 30 Min): GitHub Actions prüft `queue.json` auf neue uninvited E-Mail-Leads und sendet automatisch Einladungen.
3. Beide schreiben nach `sent.json` → keine Doppel-Einladungen.

**Lokal läuft das Ganze via:**
```bash
lead_agent_tribe\run_auto.bat          # Doppelklick — Dauerloop lokal
node lead_agent_tribe/scripts/auto.js  # oder direkt via Node
```

### Manuell (Agent-driven)
1. **DeepSeek Agent**: `web_search "kreative Leute Bielefeld Design"` (oder Musik, Kunst, etc.)
2. **DeepSeek Agent**: `fetch_url <portfolio/social-media>` → Profil prüfen
3. **DeepSeek Agent**: Kriterien-Check (kreativ tätig? Bielefeld-Bezug?)
4. **DeepSeek Agent**: Lead in `queue.json` eintragen
5. **DeepSeek Agent**: Einladungstext aus `templates/invitation.txt` ausgeben
6. **Manuell/Agent**: In `sent.json` vermerken

### Automatisch (geplant)
- Periodischer Agent-Run via GitHub Actions oder lokalem Cron
- Queue-basierte Abarbeitung mit Dedup gegen `sent.json`

## Lead-Queue Format

```json
{
  "id": "max-mustermann-design",
  "name": "Max Mustermann",
  "category": "Design",
  "subcategory": "Grafikdesign / Illustration",
  "source": "https://www.instagram.com/maxmustermann/",
  "portfolio": "https://maxmustermann.de",
  "relevance": "Grafikdesigner aus Bielefeld, regelmäßige Projekt-Posts auf Instagram",
  "discovered_at": "2026-06-20T12:00:00Z",
  "invited": false
}
```

## Kriterien

Die Person ist relevant, wenn sie **kreativ tätig** ist oder kreative Inhalte veröffentlicht:
- Design
- Musik
- Foto / Video
- Kunst
- Coding / Projekte
- Events / Kultur
- eigene kreative Arbeiten

**Fokus: Bielefeld + Umgebung**

## E-Mail-Versand

```bash
# Einladungen per E-Mail verschicken:
node lead_agent_tribe/scripts/send_invite.js                 # Status anzeigen
node lead_agent_tribe/scripts/send_invite.js --dry-run       # Vorschau
node lead_agent_tribe/scripts/send_invite.js --all           # Alle 7 E-Mail-Leads senden
node lead_agent_tribe/scripts/send_invite.js <lead-id>       # Einzelnen Lead
```

Nutzt dieselben SMTP-Credentials wie MZ.9 (`lead_agent_deepseek/.env`).
Absender: "The Tribe Bielefeld" via mzschach@googlemail.com.

## Einladungstext (fix)

Der Einladungstext ist fest vorgegeben (`templates/invitation.txt`). Keine Variation,
kein zusätzlicher Text außerhalb der Vorlage.

## Tonalität

- ruhig
- menschlich
- unaufdringlich
- kein Druck
- kein Verkauf
