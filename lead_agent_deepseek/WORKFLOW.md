# MZ.9 Lead Agent — Workflow (Deutschlandweit)

## ⚠️ EISERNE REGEL: KEINE TEMPLATE-PREVIEWS

**Jede Konzept-Vorschau wird individuell von Grund auf als Custom-Build erstellt.**
Kein `templates/preview.html`, kein `{{PLATZHALTER}}`-Ersatz, keine Standard-Blöcke.
Jede Seite ist ein Unikat mit eigenem Premium-Design — als bewusster Kontrast zur alten Website.

## Workflow-Phasen

### Phase 1: Discovery 🔍
- **DeepSeek Agent** sucht Unternehmen deutschlandweit
- Tools: `web_search "<branche> <stadt>"` → `fetch_url <website>`
- 54 Städte × 30 Branchen = 1.620 Kombinationen
- Region: ganz Deutschland (vorher: nur Bielefeld)

### Phase 2: Evaluate 📊
- Website-Analyse: HTTPS, Mobile, Formulare, CMS, Bilder, SEO
- Score 0–100 (niedriger = mehr Hebel für Verbesserung)
- Probleme & Opportunities dokumentieren
- Optional: Lighthouse-Audit via `daemon.js` (Performance, A11y, SEO)

### Phase 3: Custom Premium Build 🎨 ⭐ ENTSCHEIDEND
- **DeepSeek Agent baut individuelle HTML-Vorschau**
- **KEINE Templates!** Jede Seite ist handgebaut mit:
  - ✅ **Originalbildern** von der echten Website (extrahiert via `fetch_url`)
  - ✅ **Premium-Design** mit starker visueller Hierarchie, Animationen, Farbkonzept
  - ✅ **Branchen-spezifischem Layout** (Restaurant ≠ Maler ≠ Friseur)
  - ✅ **Echten Google-Bewertungen** (extrahiert oder als Platzhalter)
  - ✅ **Kontrast zur alten Seite**: Modern, mobile-first, hohe Design-Qualität
- **Multi-Agent-Strategie**: Bei 4+ Leads → parallele Sub-Agenten pro Build
- Output: `docs/leads/<id>/index.html`

### Phase 4: Dashboard 📋
- Lead in `docs/leads/dashboard/index.html` eintragen
- SEED-Array + EMAILS-Objekt aktualisieren
- Vorschau-URL: `https://maikz91.github.io/the-tribe-bot/leads/<id>/`

### Phase 5: E-Mail 📧 ⚠️ VORHER FRAGEN
- **User muss E-Mail-Versand ausdrücklich bestätigen**
- `send_mail.js` via Gmail SMTP
- Personalisierte Texte mit Vorschau-Link, Problemen & Opportunities
- Absender: Maik von MZ.9 — Media Engineering.AI (stadtneutral)

### Phase 6: Deploy 🚀
- `git add docs/leads/` → `git commit` → `git push`
- GitHub Pages deployed automatisch von `main`

## Datei-Struktur

```
lead_agent_deepseek/
├── discoveries/          ← Batch-JSONs (vom Agent befüllt)
│   └── used/             ← verarbeitete Batches
├── leads/                ← Lead-JSONs + Lighthouse-Daten
├── scripts/
│   ├── daemon.js         ← Auto-Loop: Queue → LH → Custom-Marker → Dashboard
│   ├── pipeline.js       ← Einmal-Pipeline (GitHub Actions)
│   └── send_mail.js      ← E-Mail-Versand via Gmail SMTP
├── queue.json            ← Settings + verarbeitete Leads
├── DISCOVERY_NEEDED.txt  ← Flag: Queue leer → Agent füllt auf
└── WORKFLOW.md           ← Diese Datei
```

## Konfiguration

- `queue.json` → `settings.discover_region`: "Deutschland"
- 54 Städte in `CITIES[]` (daemon.js + pipeline.js)
- 30 Branchen in `BRANCHES[]`

## E-Mail-Regel

⚠️ **Nie ungefragt E-Mails versenden.** Vor jedem Versand:
1. Leads + Empfänger-Adressen auflisten
2. User-Konfirmation abwarten
3. Erst dann `send_mail.js` ausführen

## Git-Notiz

Letzter Stand: 2026-06-20 — Deutschlandweites Rollout, Template-freie Custom-Builds, Multi-Agent-Parallelisierung.
