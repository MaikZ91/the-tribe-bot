# Learnings

## 04.10. 06:50 – Creative Director (Morgenlauf)
- Daten (Auswertung 06:43): Reichweite 313, davon 95 % Nicht-Follower; Ø Views 03.10. 23 (02.10. 17, 01.10. 15) – leicht steigend, aber weit unter 27.09. (124). Follower 56, 0 Shares/Saves/Keyword-Kommentare. Stock-Anteil 9 von 15 (Originalitätsrisiko).
- Entscheidung: beide Reels heute komplett aus eigener Grafik (Hook, Ablauf-Pipeline, Teilen-Folie, Logo) – kein Stock. Teilen-Aufforderung als neuer Standard (Recherche: Sends wichtigstes Signal für Nicht-Follower).
- 08:00 P0410a Physio „Physios: Wie oft heute „Kein Platz frei“?“ – Experiment variable=opener, variant=grafik-ohne-stock.
- 14:30 P0410b Coach „Anfrage 21:04. Antwort 21:06.“ – Remix des bisher besten Hooks (134 Views, Skip 67,5 %) für Coaches; Experiment variable=trial, variant=SS_PERFORMANCE (Probe-Reel nur an Nicht-Follower, ohne Story).
- 20:00 Gastro baut der Nachmittagslauf (Gastro ist aktuell die Nische mit den meisten Views, n=2).

## 03.10. 15:45 – Creative Director (Nachmittagslauf)
- 08:00 Physio + 14:30 Zahnarzt gepostet. 20:00 Gastro P0310c „Euer Wochenprogramm? Hängt an der Tür.“ – zeigt das Wochenprogramm-Karussell der Demo-Kneipe als Ausgabe.
- Tribe: heute T06 (Samstagabend-Karussell), morgen T09 (Video „Neu in Bielefeld?“) – Wechsel Karussell/Video.

## 03.10. 06:45 – Creative Director (Morgenlauf)
- Daten (Auswertung 02.10. 20 Uhr): Reels bleiben bei 8–15 Aufrufen, Watch-Ratio 0,30–0,62. Account-Umbenennung + Feiertag: keine belastbare Veränderung.
- Heute: 08:00 P0310a Physio-Personal („Seit Monaten keine Bewerbung.“, Quelle BA-Engpass in Caption), 14:30 P0310b Zahnarzt-Selbstzahler („Prophylaxe? Bleaching? Auf der Website versteckt.“), 20:00 Gastro baut der Nachmittagslauf.
- Fix: Cover-Bild nahm bei manchen Hook-Längen das letzte Bild (Logo) statt des Hooks – jetzt immer letzter Frame der Hook-Folie.

## 02.10. 15:45 – Creative Director (Nachmittagslauf)
- 20:00-Slot ist belegt: Zahnarzt-Reel P0210b rückt nach, weil das Gastro-Reel P0210c auf Maiks Wunsch schon 12:17 lief (4-h-Abstand). Kein neues Reel gebaut.
- Account umbenannt in @ki.fuer.dein.business, neues Logo als Endkarte. Gastro-Reel ist das erste unter neuem Namen – Vergleich ab morgen.
- Tribe: Datenschutz-Anfrage → nur noch 3 Fotos (dinner-restaurant, rooftop-gruppe, rooftop-vier). T03 heute umgebaut, T06 „Samstagabend. Feiertag.“ (Black October, Afro Saturday, Cutie Dance aus events.json) für morgen queued.

## 02.10. 10:30 – Maik: 1 von 3 Reels täglich = Gastro
- Neues Branchenmodul `branchen/gastro.py` (Wochennachricht → Wochenprogramm + Event-Reels + Stories, Freigabe). Auf @praxis.ki.bielefeld wird es beworben: 20:00-Slot = Gastro.
- Erstes Gastro-Reel P0210c „Freitag, 17 Uhr. Noch nichts gepostet.“ mit echter Tool-Ausgabe (Demo-Kneipe), CTA „Kommentiere GASTRO“ → eigene Auto-DM.
- Hypothese: Wirte reagieren stärker als Praxen, weil Instagram für sie direkt Gäste bringt. Vergleich je Nische am 08.10.

## 02.10. 06:45 – Creative Director (Morgenlauf)
- Daten (Auswertung 01.10. abends): Praxis-Reels 9–14 Aufrufe, Coach-Reel P0110d nach ~1 h 10 Aufrufe, Watch-Ratio nur 0,12 (Praxis-Reels 0,47–0,69). Reichweite bleibt der Engpass, der Coach-Einstieg hielt schlechter.
- Erste Reels mit korrigierten Pains: 08:00 P0210a Physio „10× heute: Kein Platz frei.“ (Telefon-Unterbrechung trotz Warteliste), 14:30 P0210b Zahnarzt „ZFA: Platz 1 der Engpassberufe“ (erster Statistik-Hook, Quelle BA 2024 in Caption).
- Test: Statistik-Hook (P0210b) vs. Szenen-Hook (P0210a). Variable: Hook-Typ.

## 01.10. 18:00 – Pain-Korrektur nach Gespräch Maik ↔ Ergotherapeutin
- Praxis-Realität: Heilmittelpraxen (Physio/Ergo/Logo) sind **überlastet und haben Wartelisten** – ein Drittel nennt 3 Monate Wartezeit, Hausbesuche oft 7+ Monate (HELPER-Befragung, Bayer. Gesundheitsministerium/FAU, iww 05.05.2026). Die meisten haben **Praxissoftware** mit Terminplanung, Erinnerung, Abrechnung.
- Folge: „Du verlierst Patienten, weil du nicht erreichbar bist“ ist für Therapiepraxen der **falsche** Pain. Die brauchen nicht mehr Patienten, sondern weniger Last.
- Richtige Pains je Typ:
  - Therapie/Physio/Ergo: **Personal** (Physio-Stelle 280 Tage offen, >12.000 Fachkräfte fehlen) → Recruiting + Instagram als Arbeitgeber; **Telefon-Unterbrechungen**: zehnmal am Tag „Haben Sie noch einen Platz?“ – „Nein, Warteliste“ mitten in der Behandlung.
  - Zahnarzt: Personal (ZFA Engpass Nr. 1) + Selbstzahler-Leistungen sichtbar machen (Prophylaxe, Implantate).
  - Coaches: Anfragen/Kundengewinnung bleibt richtig – die brauchen Kunden.
- Nicht anbieten, was die Praxissoftware schon kann (Terminbuchung, Erinnerung, Abrechnung). Dokumentation/Verordnungen = Patientendaten → bleibt tabu.
- Reel-Regel: Für Therapiepraxen keine „verpasste Patienten“-Hooks mehr. Stattdessen z. B. „Seit 9 Monaten suchst du eine Physiotherapeutin.“ / „Zum 10. Mal heute: Nein, wir haben keinen Platz frei.“

## 01.10. 15:45 – Creative Director (Nachmittagslauf)
- Daten (Auswertung 01.10. 15:37): Konto 56 Follower, Reichweite 137. P0110b 7 Aufrufe, P0110a 9, P0110c 1 (frisch). Watch-Ratio 0,74–0,77 = beste Haltewerte überhaupt → Inhalt trägt, Verteilung fehlt weiter.
- Test 20:00: erstes Coach-Reel P0110d (Szene „Mitten im Training. 6 neue Anfragen.“, 3 echte Mixkit-Clips, Logo-Endkarte „Kommentiere COACH“). Frage: holt die Coach-Nische mehr Reichweite als Praxen?
- Tribe: T05 „Samstag ist Feiertag“ (Events aus events.json: Afro Friday, parkrun Obersee, Cutie Dance) für morgen 17:15 queued; T03 läuft heute.

## 01.10. 17:30 – Belegte Statistiken (data/statistiken.md)
- Nur Zahlen aus `data/statistiken.md` verwenden, Quelle + Jahr in die Caption. Stärkste: 88 % finden Praxen telefonisch schwer erreichbar (Bitkom 2024); 27 % wählen die Praxis nach Online-Termin aus (Bitkom 2024); ZFA = Engpassberuf Nr. 1 (BA 2024).
- Test: ein Statistik-Hook pro Tag gegen Szenen-Hook (z. B. „Anfrage um 22:40“). Variable: Hook-Typ.
- Praxis-Check zeigt im Ergebnis jetzt je größter Baustelle eine belegte Zahl mit Quelle.

## 01.10. 17:00 – Praxis-Analyse (12 Websites Bielefeld/OWL, data/praxis_analyse.md)
- Fakten: 0 von 12 Praxis-Websites mit Chat/KI-Assistent. Online-Buchung: 7 von 8 Zahnärzten, 0 von 3 Physio/HP. Zahnärzte Brake + Dr. Störmer suchen seit 03.08. öffentlich ZFA. Einzeltherapeuten oft nur per Handynummer erreichbar.
- Folge für Reels – Pain je Praxistyp statt einheitlich:
  - Zahnarzt: nicht „Telefon“ (die haben Buchung), sondern **Recruiting** („ZFA-Anzeige seit August online – und keiner meldet sich?“) und **Website-Assistent** („Patientin fragt um 22:40, ob ihr Angstpatienten behandelt“).
  - Physio/Therapie: **Telefon + fehlende Online-Termine** („Behandeln oder ans Telefon gehen?“, „Kursplan als PDF“).
  - Einzelpraxis/Coach: **Handy klingelt während der Behandlung**.
- Neue Hook-Möglichkeit mit echter Zahl: „Wir haben uns 12 Praxis-Websites in Bielefeld angesehen. Keine einzige hat das.“ (Stichprobe nennen, keine Praxis namentlich, nichts übertreiben.)
- KI-Check: Option „Chat / Assistent auf der Website“ ergänzt; Ergebnis zeigt jetzt einen Bielefeld-Vergleich aus dieser Stichprobe.

## 01.10. 06:50 – Creative Director (Morgenlauf, Tag 1 Praxis KI)
- Erster Praxis-Post P0110a (30.09. 21:15): nach ~9 h 9 Aufrufe, 4 Reichweite, aber Watch-Ratio 0,68 – bester Haltewert bisher. Inhalt hält, Verteilung fehlt (Konto noch gedrosselt, neue Zielgruppe ohne Follower-Basis).
- Hypothese: Echte Clips + Praxis-Szene halten die Leute; Reichweite kommt erst mit Abstand zwischen Posts und/oder etwas Werbebudget. Test heute: 08:00 Physio-Telefon (Clip + Ablauf), 14:30 Zahnarzt-Website mit KI-Assistent (zwei Clips), 20:00 Coach.

## 30.09. 20:15 – Maik hat alle Posts unter 90 Aufrufen gelöscht
- Übrig (Aufrufe): „Bielefelder Unternehmen aufgepasst" 7.256 (echte Person, direkte lokale Ansprache; vermutlich beworben – klären), „Genau das kann KI für dich übernehmen" 924 (Person im Bild, angepinnt), „Videos schneiden?" 133, „Anfrage um 21:04" 133, „Rechnest du zu billig?" 122, „Wie viel Umsatz verlierst du…" 99, „60 € pro Stunde" 96, Logo-Post 22. 30-Tage-Aufrufe gesamt 8.998.
- Lehre: Die Autopilot-Masse (≈40 Posts < 90 Aufrufe) hat nichts beigetragen. Maßstab ab jetzt: ein Post muss > 90 Aufrufe schaffen, sonst Format verwerfen. Lokale Direktansprache („Bielefelder Unternehmen …") ist das stärkste Signal im Profil.
- Gelöschte Posts werden in der Auswertung automatisch als `deleted` markiert und ignoriert.

## 30.09. 15:50 – Creative Director (Nachmittagslauf)
- Heute zwei Posts binnen 18 min im 08:00-Slot (Routine-Dispatch + GitHub-Zeitplan). Neu: `min_gap_minutes: 120` in config.json – ein zweiter Lauf im selben Slot postet nicht mehr.
- Richtungswechsel nach Maiks Feedback (kaum Reichweite): erst Kanal aufbauen, dann verkaufen. Test: teilbares Relatable-Karussell „Was Kunden sagen – und was sie meinen“ mit CTA Kommentieren/Teilen/Folgen statt CHECK.

## 30.09. 06:55 – Creative Director (Morgenlauf)
- Daten (41 Posts, 55 Follower): Die Posts von gestern bleiben klein (E2909a 13, E2909b 5, E2909c 2, 025 7), obwohl E2909a exakt das Format des Top-Reels 001 (126) hat. Gleiches Format, 10× weniger Reichweite → Engpass ist gerade die Verteilung, nicht das Motiv. Wahrscheinliche Ursache: Massen-Postings am 27./28. (~75 Posts) + ein Doppel-Post (E2909b 17:47/17:54, Bug behoben).
- Hypothese: Instagram drosselt das Konto nach der Flut; Erholung braucht einige Tage mit sauberem Rhythmus. Test heute: erstes Karussell seit Tagen (Karussells bekommen als einzige Kommentare) + zwei Demo-Reels zu den stärksten Pains (Anfragen, Preise/Zeit).
- Doppel-Post E2909b (Dd4HvYZEQgV) sollte manuell gelöscht werden (API kann nicht löschen).

## 29.09. 06:50 – Creative Director (Morgenlauf)
- Daten (37 Posts, 55 Follower, Konto-Reichweite 1.299): Demo-Reels mit Zahl-Hook tragen (D2809b 47 Reichweite in wenigen Stunden, 018 30). Uhrzeit-Szene als Beat-Reel geflopped (D2809a: 2), als ruhiges Hook+Flow-Reel (001) weiter Spitze (126). M02 Video-Schnitt nachträglich 129 Reichweite, aber Skip 100 %.
- Hypothese: Nicht das Thema, sondern die Form entscheidet – ruhiger Hook-Slide + Ablauf schlägt Wort-Pop. Test heute: 08:00 Uhrzeit-Szene exakt im 001-Format (neue Uhrzeit/Situation), 11:30 Zahl-Hook + Angebots-Demo, 14:30 Media als Vorher/Nachher mit Hook-Slide statt Beat. Musik überall „bed“.
- Stapel gestern abgebrochen (4 Posts in < 1 h); ab jetzt nur Slots.

## 28.09. 06:55 – Creative Director (Morgenlauf)
- Daten (27 Posts, 58 Follower): Reichweite 0–108; Skip-Rate 61–100 %, Ø Watch 2–6 s → der Einstieg ist der Engpass.
- Bester Hook: „Anfrage um 21:04. Antwort um 21:06.“ (niedrigste Skip-Rate 62 %, 5,8 s Watch) → konkrete Uhrzeit-Szene hält.
- Pain „anfragen“ am stärksten (n=5), „preise“ höchste Einzelreichweite (n=1, Hypothese).
- Karussells bekommen als einzige Kommentare (M06: 2, 022: 1).
- Test heute: Serie „Uhrzeit-Szene“ (Reel + Karussell) vs. Zahl-Frage-Hook „60 € pro Stunde“. Variable: Hook-Typ.

