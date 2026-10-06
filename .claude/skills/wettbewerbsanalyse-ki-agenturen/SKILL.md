---
name: wettbewerbsanalyse-ki-agenturen
description: Wettbewerbsanalyse für „KI für dein Business“ (@ki.fuer.dein.business, Bielefeld/OWL) – findet und vergleicht KI-Agenturen, Automatisierungs-Freelancer und Social-Media-/Marketing-Agenturen, die Praxen, Gesundheits-Coaches oder Gastronomie KI-Lösungen anbieten. Nutze diesen Skill, wenn Maik nach Mitbewerbern, Konkurrenz, Wettbewerb, Positionierung gegenüber anderen Agenturen, Preisen am Markt oder Lücken im Angebot fragt, und monatlich in der Wochenstrategie. Ergebnis: instagram_autopilot/data/wettbewerb.md (Matrix, Profile, Chancen) plus konkrete Folgerungen für Reels und Angebot.
---

# Wettbewerbsanalyse: KI-Agenturen (Fokus Bielefeld/OWL und DACH)

Ziel: Wissen, wer Maiks Zielgruppen (Praxen & Gesundheits-Coaches, Gastronomie) mit KI und
Automatisierung schon bedient, wie die Anbieter sich positionieren, was sie kosten und wo
**KI für dein Business** sich klar abheben kann. Die Analyse fließt direkt in Reels, Hooks,
Angebot und Preise.

## Regeln (unverhandelbar)

- **Nur öffentliche Informationen** (Websites, Impressum, öffentliche Social-Profile, Presse,
  Branchenverzeichnisse, Google-Bewertungen). Keine Logins umgehen, keine Testanfragen unter
  falschem Namen, keine Kontaktaufnahme mit Mitbewerbern.
- **Nichts erfinden.** Jede Angabe mit Quelle (URL) und Abrufdatum. Unbekanntes → „n/a“.
  Preise nur, wenn öffentlich genannt. Follower-Zahlen nur, wenn öffentlich sichtbar
  (Websuche-Snippet, eigene Website); instagram.com selbst blockt Abrufe aus der Cloud.
- **Nicht kopieren.** Texte, Bilder, Videos von Mitbewerbern nie übernehmen – nur Muster
  ableiten (Thema, Format, Hook-Art, Angebotslogik) und mit eigenem Material umsetzen.
- **Fair bewerten.** Stärken der Mitbewerber ehrlich benennen; keine abwertenden Aussagen in
  Reels oder Captions über konkrete Firmen (UWG: keine herabsetzende vergleichende Werbung).
- **Personen:** nur Firmen und öffentlich auftretende Inhaber in ihrer Geschäftsrolle; keine
  privaten Daten sammeln.

## Vorgehen

### 1. Suchen (WebSearch, mehrere Anfragen parallel)

Lokal zuerst, dann DACH. Beispiel-Anfragen (anpassen, Ergebnisse dedupen):

- `KI Agentur Bielefeld`, `KI Automatisierung Bielefeld`, `KI Agentur OWL`, `Automatisierung
  Agentur Gütersloh Paderborn Herford`
- `KI Telefonassistent Arztpraxis`, `KI Rezeption Praxis`, `KI Agentur Physiotherapie`,
  `KI Zahnarztpraxis Automatisierung`
- `KI Social Media Gastronomie`, `Instagram Agentur Restaurant Bielefeld`, `KI Marketing Bar
  Kneipe Wochenprogramm`
- `KI Automatisierung Coaches`, `KI Assistent Terminbuchung Coach`
- Plattform-Anbieter mit gleicher Zielgruppe (z. B. KI-Telefonassistenten, Social-Media-Tools
  für Gastro) – als **indirekte** Wettbewerber getrennt führen.

Ziel: 8–15 relevante Anbieter. Unterteilen in
**A** lokal (OWL), **B** DACH mit gleicher Nische, **C** Tools/SaaS (indirekt).

### 2. Je Anbieter erfassen (WebFetch der Website; Impressum für Ort/Rechtsform)

| Feld | Was |
|---|---|
| Name, Ort, URL | aus Impressum |
| Typ | Agentur / Freelancer / SaaS-Tool |
| Zielgruppen | Praxen, Coaches, Gastro, allgemein KMU … |
| Kernangebot | z. B. KI-Telefon, Chatbot, Social-Media-Automatisierung, Websites, Workflows |
| Preise | öffentlich genannt? Pakete, Setup, monatlich – sonst n/a |
| Versprechen / Hook | Hauptaussage der Startseite (wörtlich kurz zitieren, Quelle) |
| Beweise | Cases, Kundenlogos, Bewertungen (Anzahl/Schnitt nur wenn öffentlich) |
| Lead-Magnet / CTA | Erstgespräch, Check, Demo, Rechner … |
| Social | Instagram/LinkedIn/TikTok vorhanden? Formate (Reels, Talking Head, Demos)? |
| Stärke | was sie besser machen |
| Lücke | was fehlt oder schwach ist (aus Sicht von Maiks Zielgruppen) |

### 3. Bewerten (1–5, kurz begründen)

Positionierungs-Schärfe · Nischen-Nähe zu Maik · Preis-Transparenz · Beweise/Vertrauen ·
Social-Content-Qualität · Lokaler Bezug OWL.

### 4. Folgerungen ableiten (der eigentliche Zweck)

- **Differenzierung:** 3 Punkte, mit denen KI für dein Business sich klar abhebt
  (z. B. Nische Gastro-Wochenprogramm, lokal Bielefeld, sichtbare echte Tool-Ausgaben, kein Fachchinesisch).
- **Content:** 3–5 Reel-Ideen aus den Lücken der Mitbewerber (Thema + Hook-Idee + Format),
  als Vorschlag für den Creative Director (`learnings.md` / nächstes Briefing).
- **Angebot & Preis:** Wo liegt der Markt, wo passt Maiks Angebot hinein (z. B. Gastro-Pakete
  79/149/249 € aus `branchen/README.md` vs. Markt)?
- **Vorbilder:** Accounts mit gutem Social-Content in `data/benchmark_accounts.json` →
  `vorbilder` eintragen (mit Begründung).

## Ausgabe

1. `instagram_autopilot/data/wettbewerb.md` (überschreiben, ältere Fassung bleibt in Git):
   - Kopf: Datum, Suchanfragen, Anzahl Anbieter
   - **Matrix** (eine Zeile je Anbieter: Typ, Ort, Zielgruppen, Kernangebot, Preis, Bewertung)
   - **Profile** (je Anbieter 4–6 Zeilen, mit Quellen-URLs)
   - **Veränderungen seit letzter Analyse** (neue Anbieter, neue Preise, neue Angebote)
   - **Chancen für KI für dein Business** (Differenzierung, Reel-Ideen, Angebot/Preis)
2. Reel-Ideen zusätzlich kurz oben in `instagram_autopilot/learnings.md` als Vorschlag
   vermerken, damit der Creative Director sie aufgreift.
3. Commit + Push auf `main` (Nachricht: „Wettbewerbsanalyse <Datum>“).
4. Kurzbericht an Maik (max. 10 Zeilen): wichtigste Mitbewerber, wo der Markt steht,
   die 3 Differenzierungspunkte, die besten 2 Reel-Ideen. Quellen als Links.

## Rhythmus

- Auf Zuruf von Maik jederzeit.
- Automatisch einmal im Monat im Rahmen der Wochenstrategie (erster Sonntag im Monat):
  nur Veränderungen nachziehen, nicht alles neu erheben.
