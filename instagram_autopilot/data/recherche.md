# Recherche: Plattform-Wissen für den Creative Director

Pflege: der Creative Director recherchiert selbst (ROUTINE.md, Abschnitt 0 – Recherche) und trägt Neues oben ein.
Jede Zeile: Erkenntnis → was wir daraus machen → Quelle. Nur Belegtes; Schätzungen aus Blogs als solche kennzeichnen.

## 03.10.2026 – Warum zeigt Instagram unsere Reels kaum Nicht-Followern?

Ausgangslage: 27.09. 100–135 Views je Reel bei 56 Followern (also fast nur Nicht-Follower), seit 30.09. 5–25 Views.

| Erkenntnis | Konsequenz für uns | Quelle |
|---|---|---|
| Top-Signale laut Mosseri (Jan. 2025): Watch-Time, Likes, **Sends** (Teilen per DM). Sends zählen bei Nicht-Followern mehr als Likes. | Jedes Reel braucht einen Grund zum Weiterschicken (Moment, den die Zielgruppe kennt; Schluss „Schick das deiner Kollegin“). Shares bisher: 0. | highstyle.ai, clixie.ai (Zusammenfassungen der Mosseri-Aussagen) |
| **Originalität:** Konten, deren Inhalte in einem rollierenden 30-Tage-Fenster überwiegend nicht eigenes Material sind, verlieren die Empfehlungsfähigkeit. Fremdmaterial muss „materiell verändert“ sein (eigener Text, eigene Grafik, Schnitt). | Stark verdächtig: 9 der 15 Reels, die noch online sind, tragen Stock-Clips als Einstieg oder Hauptteil – über der Hälfte. Seit 30.09. beginnen fast alle Reels mit Mixkit-Stock-Clips, die starken Reels vom 27.09. waren reine eigene Grafik. Stock-Anteil senken, Stock nie als Hauptmotiv ohne eigene Ebene; eigene Tool-Ausgaben/Bildschirmaufnahmen vorziehen. Briefing misst den Stock-Anteil der letzten 30 Tage. | communicateonline.me, emarketer.com, planoly.com |
| ≥ 10 Reposts in 30 Tagen schließen ein Konto von allen Empfehlungen aus. | Nie Fremd-Reels/Tribe-Inhalte reposten. | highstyle.ai |
| Instagram testet jedes Reel zuerst an einer kleinen Gruppe; erst gute Signale (Halten, Teilen, Speichern) öffnen die nächste Stufe. Reels wachsen teils noch nach Tagen. | Nichts löschen (laut state.json sind 38 von 53 veröffentlichten Beiträgen wieder gelöscht, online sind 15). Schwache Reels stehen lassen. | blog.chatplace.io, view-ig-story.com |
| Skip-Rate = Anteil, der in den ersten 3 s wegwischt; Ziel: ≥ 60 % halten (Skip ≤ 40 %). | Unsere Skip-Rate: 56–100 %. Der Einstieg ist der Engpass, nicht der Inhalt (Watch-Ratio der Gehaltenen ok). Hook als Text in den ersten 3 s, 5–10 Wörter, groß, kontrastreich, Zielgruppe benennen („Physiopraxen:“). Ein Takt vor der Lösung starten: Symptom zeigen, dann Risiko nennen. | truefuturemedia.com, inro.social |
| Business-Reels: 21–34 s als Arbeitsbereich (Hook, ein Nutzen, CTA). Über 3 min keine Empfehlung mehr. | Länge 20–30 s beibehalten. | inro.social, highstyle.ai |
| **Probe-Reels** (Trial Reels): zuerst nur an Nicht-Follower; per API `trial_params.graduation_strategy` (MANUAL / SS_PERFORMANCE). | Eingebaut (`"trial"` in der Spec). Für Experimente nutzen, Vergleich im Briefing. | ayrshare.com, postfa.st |
| Konto-Insights `reach`/`views` lassen sich nach `follow_type` (FOLLOWER / NON_FOLLOWER) aufschlüsseln. | Eingebaut, Anteil Nicht-Follower im Briefing. | developers.facebook.com |

**Offene Prüfung durch Maik:** Einstellungen → Kontostatus → „Empfehlungsfähigkeit“. Steht dort etwas, ist das die Ursache.
