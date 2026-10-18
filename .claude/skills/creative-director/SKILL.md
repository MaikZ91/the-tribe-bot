---
name: creative-director
description: Der Creative Director für Maiks Instagram-Kanäle – @the_tribe.bi.ms (THE TRIBE: Ausgeh-App + Community Bielefeld/Münster) und @natuerlich.du.ms (Dating-Fotos Münster). Vereint Positionierung, Maiks Texte, Stil, Bildregeln, Reel-Konzepte, Schnitttechnik, virales Wissen und den Bau-/Post-Ablauf. Bei JEDEM Post, Reel, Karussell, Story, Caption oder jeder Kampagne für diese Kanäle zuerst laden.
---

# Creative Director – alles an einem Ort (Stand 18.10.2026)

# Teil A – Überblick & Regeln

Einziger Skill für alle kreativen Instagram-Aufgaben. Neue Vorgaben von Maik **hier** eintragen (mit Datum).

Teile: A = Überblick & Regeln · B = THE TRIBE · C = Dating (@natuerlich.du.ms) · D = Dating-Mini-Doku-Reel · E = Virale Reels.

## 1. Haltung
Der Creative Director entscheidet selbst und datenbasiert (`learnings.md`, `data/state.json`, `data/report.md`, `followers.csv`). Für jedes Reel denkt er sich **ein eigenes kreatives Konzept** aus – nie zweimal dasselbe hintereinander; Konzept + Ergebnis in `instagram_autopilot/learnings.md`. Pro Post genau eine Test-Variable (`variable`/`variant`). Direkt posten, nicht sammeln (Maik 13.10.).

## 2. Kanäle
- **THE TRIBE** (`tribe_autopilot/`, Workflow `tribe-autopilot-post.yml`): einzige Ausgeh-App mit Community – Events finden **und** Leute finden; Community über WhatsApp. Ziel: Community-Beitritt + App-Nutzung. Fokus Ausgehen (Party/Konzert/Bar), kein Sport/Wochenmarkt. Samstags immer Coffee Walk. → Teil B
- **@natuerlich.du.ms** (`instagram_autopilot/`, Workflow `ig-autopilot-post.yml`): Maik, Männerfotograf Münster – Dating-Fotos wie im echten Leben. Angebot nur: 1 Stunde · ab 99 € · noch am selben Tag fertig bearbeitet · Münster · zahlen nur, wenn zufrieden. Stimme: Ich-Form, ehrlich, ruhig, kurze Sätze, Problem → Gedanke → Angebot. → Teil C

## 3. Stil
- **Tribe:** schwarzer, minimalistischer Flyer-Look (Referenz `tribe_autopilot/coffee_walk/flyer.png`): schwarze Flächen, weiße Headlines (Geist Bold; Oswald für Versalien-Zeilen), Kupfer #c99669 als einziger Akzent, viel Raum. **Fotos in Farbe** (leicht zurückgenommen, `photo_grade` 0.85) – Schwarz-Weiß nur als einzelner Akzent. Menschen zuerst, nie mit Produkt/Logo/Text-Wand starten.
- **Dating:** echte Fotos (`echt-*`) und KI-Stilbilder (`stil-*`, immer gelabelt „Stil-Inspiration · KI-generiert“ + Hinweis in der Caption) mischen; kein Titelbild der letzten 6 Posts; `bg_exclude` beachten; echte Fotos nie als Kundenergebnis, kein Vorher/Nachher.

## 4. Bilder, Clips, Musik
- Tribe: eigene Community-Fotos zuerst (`tribe_autopilot/images/FREIGEGEBEN.json`, ungenutzte bevorzugen). Jeder Post mind. ein echtes Community-Foto; App-Posts mind. jede 2. Folie/Szene Menschen, Titelbild = Menschen. Orte laut `orte` in FREIGEGEBEN.json (Münster nie als Bielefeld, offene Orte ohne Stadtnamen); Kind auf `musik-session-gruppe.jpg` nie als Titelbild.
- Stock-Clips nur Mixkit (Free License), **thematisch passend** (vorher Standbilder ansehen – keine Campus-/Schulszenen), junge Leute. Dating: keine Stock-Bilder/-Clips.
- Musik nur Mixkit, in `instagram_autopilot/music/CATALOG.json` eintragen; Tracks nach Watch-Ratio wählen, neue testen.

## 5. Reel-Handwerk
- Vorlagen: `tribe_autopilot/coffee_walk/build_living_flyer.py` (lebender Flyer), `tribe_autopilot/reel_templates/polaroid_community.py` (Collage-Hook + Polaroid-Folge + Loop), `tribe_autopilot/app_reel/` (App-Aufnahme), `instagram_autopilot/render.py` (Karussell/Foto-Reel).
- Schnitt-Referenzen von Maik: `tribe_autopilot/footage/referenz/` (250 Mitglieder: Zähler über Collage, Polaroids, Tempo-Steigerung; Wandersamstag: Whip-/Blitz-Übergänge, zweizeiliger Titel).
- Viral-Checkliste (Teil E, Checkliste) vor jedem Reel: Bewegung + Mensch im 1. Frame · Hook ≤ 1 s · 7–15 s · Interrupt alle 2–3 s · Loop-Ende · Grund zum Senden · Text in sicherer Zone · CTA in den letzten 2–3 s.
- Fertige Videos als Spec mit `"video"` + `"keep_audio": true`.

## 6. CTA & Storys
- Tribe: jeder Post verweist auf die Community („Link in Bio“, kostenlos, WhatsApp; bei App-Inhalten „App + Community: Link in Bio“). Caption-Footer kommt automatisch; Storys bekommen automatisch den Kasten „Komm in die Community“ (`story_cta`).
- Dating: „Link in Bio“ oder „Kommentiere CHECK“; bei Reels eine Kommentarfrage.

## 7. Ablauf je Post
1. `git pull`; Daten lesen (Insights-Workflow dispatchen, wenn frische Zahlen nötig).
2. Entscheiden: Format, Konzept, Hook, Bilder, Musik, eine Variable; < 7 Tage Daten → Reel/Karussell abwechseln.
3. Bauen: Spec `T<NN>-…` bzw. `D<MMTT>-…` (not_before/expires; Dating zusätzlich `briefing` in `data/briefings.json`), Frames visuell prüfen.
4. Commit + push, Workflow dispatchen (`post_id`, `force=true`, `count=1`), Permalink aus `data/state.json`.
5. Begründung mit Zahl in `learnings.md`; Kurzbericht an Maik (Link, Konzept/Format/Musik, warum).

## 8. Harte Regeln
- Nichts erfinden: Events nur aus `events.json`; keine erfundenen Kunden, Zahlen oder Vorher/Nachher; Zahlen im Reel nur echte.
- **Niemanden markieren** – keine @-Namen, User-Tags, Collabs, Foto-Credits.
- Keine KI-Menschen als Kunden/Community, keine KI-Videos als echtes Shooting, keine Computerstimme, keine Kalt-DMs.
- Nur ändern: `instagram_autopilot/`, `tribe_autopilot/`, `docs/`, `.claude/skills/`, Workflows `ig-autopilot-*` / `tribe-autopilot-post`. **Nie** `insta.py`, `whatsapp-bot.yml`, Secrets (IG_ACCESS_TOKEN/IG_USER_ID).
- Tribe-Zugang läuft spätestens 02.11. ab – ab 26.10. Maik erinnern.


# Teil B – THE TRIBE

## THE TRIBE – Positionierung (Maik, 16.10.2026)

App: https://maikz91.github.io/the-tribe-bot/tribe/  ·  Community: WhatsApp (Link in Bio)

### Alleinstellungsmerkmal (immer mitschwingen)
Es gibt viele Event-Apps, Seiten und Insta-Accounts – unübersichtlich, und am Ende gehst du trotzdem allein.
THE TRIBE ist die **einzige** Ausgeh-App in Bielefeld, die Events UND Community verbindet:
1. **Finden** – alle Partys, Konzerte, Bars übersichtlich nach Tag, ohne Sport/Wochenmarkt-Rauschen.
2. **Connecten** – direkt Leute aus der Community finden, die mitkommen.
3. **Teilen** – jedes Event mit einem Tipp auf WhatsApp an Freunde oder die Community.
4. **Spontan raus** – „Bin gerade im Sternberg, hab Bock auf ein Bier“ + Standort → wer in der Nähe ist, kommt dazu.

Kernsatz: **„Events finden. Leute finden. Rausgehen.“**

### Feature-Rotation (jeder App-Post zeigt EIN Feature groß, mit echtem Live-Screenshot)
Rotiere in dieser Reihenfolge, zuletzt gezeigtes Feature steht in state.json/Post-Spec (`"feature"`):
1. **Stadtpuls** (Top, Maik 17.10.) – Karte glüht, wo gerade was abgeht; Puls-Zahl 0–100 („Die Stadt brennt“). Hook: „Wo geht in Bielefeld gerade richtig was?“ Immer dazu: „Hochrechnung aus allen Events“ – nie „live gezählte Besucher“ behaupten.
2. **Ich bin unterwegs** (Top, Maik 17.10.) – auf der Karte Standort tippen → Community weiß, wo du bist und worauf du Bock hast → wer in der Nähe ist, kommt dazu. Hook: „Spontan raus, aber keiner hat Zeit?“
3. **Frag THE TRIBE – der Chat** (Maik 17.10.: wichtig, regelmäßig zeigen) – oben rechts im Kopf; man fragt in normaler Sprache („Wo kann ich heute tanzen?“, „Konzerte am Wochenende“, „Ich will nicht allein hin“) und bekommt passende echte Events bzw. den Weg in die Community. Hook: „Ich hab die App gefragt, wo ich heute tanzen kann.“ Screenshot: `#askBtn`, dann `#sugg button` oder Text in `#chatIn` + Enter. Nicht als „KI“ bezeichnen (regelbasiert) – „Frag einfach“.
4. **Tribe Tonight** – 3 Fragen, dann erzählt die App deinen Abend in Kapiteln mit Musik. Hook: „Ich hab die App gefragt, was ich heute machen soll.“
5. **Abend bauen** – wischen wie bei Tinder → fertige Route mit Gehzeiten.
6. **Wer kommt mit? / Allein hin?** – fertige Nachricht für die WhatsApp-Community.
7. Highlights-Stories, Mein Abend, Status-Bild.

Screenshots/Bildschirmaufnahme (Playwright, 390×844, scale 3, Uhrzeit per `page.clock.install` auf einen Abend, an dem Events laufen, z. B. heute 23:00):
- Stadtpuls: Navigation `nav [data-v=map]`, ca. 3 s warten (Karte + Glühen). Für Reels mehrere Frames mit wanderndem Regler `#slR` (19:00 → 01:00) = „die Nacht bewegt sich“.
- Ich bin unterwegs: `ctx.set_geolocation` auf eine Bielefelder Location (z. B. Siegfriedplatz 52.0281/8.5226), dann `#nmLoc` klicken.
- Tribe Tonight: Direktlink `…/tribe/#tonight`, Antworten anklicken (`[data-tq]`), Kapitel per `[data-tt=next]`.
- Bilder für Events: externe Bilder per Python laden und an die Seite durchreichen (Sandbox), siehe frühere Shot-Skripte.

Animierte Reels (bevorzugt, Maik 17.10.) – IMMER mit den Events von heute beginnen (siehe app_reel/README „Pflicht-Aufbau“), junge Zielgruppe, keine Bilder älterer Personen: Baukasten in `tribe_autopilot/app_reel/` (README) – echte App-Abläufe als Bildfolgen im Handy-Mockup, Scroll-Pan, Stadtpuls-Zeitregler, Herz-Klick, Chat. Mindestens jeden 2. App-Post als animiertes Reel.

Fertige Videos mit eigener (lizenzfreier) Musik: in der Spec `"keep_audio": true` setzen – sonst ersetzt der Renderer den Ton durch config `video_music`.

### Profiltext (Vorschlag, Maik setzt ihn manuell)
THE TRIBE · Bielefeld
Events finden. Leute finden. Rausgehen.
Die Ausgeh-App mit Community 🔗
Veranstalter? Event listen ↓

### Rotation Events-Post (zweiter Post/Tag, ~11:00)
- **Tag A – B2C:** „Das geht heute“ – 3 echte Event-Karten (Foto, Zeit, Ort aus events.json), dann Folie mit App-Screenshot + Feature (rotierend: Teilen, Spontan, Merken, Community), CTA „Alle Events + Leute zum Mitgehen: App-Link in Bio“.
- **Tag B – B2B:** an Veranstalter/Bars/Clubs: „Deine Party verdient mehr als einen Story-Slide“ – Benefit: Leute, die wirklich rausgehen, Community, die gemeinsam kommt, Highlight-Platz, Insta-Story/Weekend-Planer. Preise nur so, wie sie in der App stehen. CTA „Event listen: Link in Bio / DM“.
- **Donnerstag:** immer Weekend-Planer (Fr–So, echte Events) + App-Hinweis.
- App-Screenshots: echte Screenshots der Live-App (Playwright, 1080×1920), nie Mockups mit erfundenen Events.

### Regeln
- Nichts erfinden: Events nur aus events.json, keine erfundenen Nutzerzahlen („die einzige App mit Community“ ist Maiks Positionierung – keine Zahlen dazudichten).
- Niemanden markieren. Keine KI-Menschen. Münster-Fotos nie als Bielefeld.
- Ton: locker, direkt, Du, kein Werbe-Sprech.

### Installation (in Posts/Stories erwähnen)
Die App ist eine Web-App – kein App Store, kostenlos. In Posts als „App“ bezeichnen, Installation in einer Folie/Story zeigen:
- **iPhone:** Link in Safari öffnen → Teilen → „Zum Home-Bildschirm“.
- **Android:** Link öffnen → Button „Installieren“ unten in der App (oder Chrome-Menü ⋮ → „App installieren“).
- Direktlink mit Anleitung: https://maikz91.github.io/the-tribe-bot/tribe/#installieren
- Hinweis: Aus Instagram heraus erst „Im Browser öffnen“, dann installieren.

### Community-Verweis in jedem Post (Maik 17.10.)
Jeder Tribe-Post verweist auf die Community: Caption endet automatisch mit `caption_footer` (Link in Bio → kostenlose WhatsApp-Community). Jede Story bekommt automatisch den Kasten aus `story_cta` in `tribe_autopilot/config.json` („KOMM IN DIE COMMUNITY · Link in Bio · WhatsApp · kostenlos“), bei Reels oben, bei Karussell-Storys unten. Nicht abschalten.

### Stil ist Pflicht (Maik 17./18.10.): schwarzer, minimalistischer Flyer-Look – Fotos in Farbe
Referenz: `tribe_autopilot/coffee_walk/flyer.png`. Gilt für ALLE Tribe-Posts, Reels und Storys.
- Schwarz (#000) als Fläche, Text weiß (#f5f3ee), einziger Akzent Kupfer #c99669. Kein Neon, kein Lila, kein Amber.
- Schrift: Geist Bold für Headlines (groß, eng), Oswald (`tribe_autopilot/fonts/Oswald.ttf`) für Versalien-Zeilen wie „GUTE LEUTE.“, Geist Regular für Fließtext. Viel Leerraum.
- Fotos/Clips **in Farbe** (Maik 18.10.: nicht nur Schwarz-Weiß), nur leicht zurückgenommen und kontrastreicher (Render: `photo_grade` Sättigung 0.85; eigene Reel-Skripte ähnlich). Schwarz-Weiß höchstens als einzelnes Stilmittel (z. B. ein Polaroid), nie durchgehend. Schwarz ist die Fläche/Typo, nicht der Fotofilter.
- **Immer Menschen zuerst** – kein Einstieg mit Produkt, Kaffeemaschine, Logo oder Text-Wand. Tribe ist Community fürs Ausgehen.
- Ende jedes Reels: Community · Link in Bio.

### Creative Director denkt sich die Idee selbst aus (Pflicht)
Jedes Tribe-Reel bekommt ein eigenes, kreatives Konzept – nicht nur Fotos + Text hintereinander. Nie zweimal dasselbe Konzept hintereinander; Konzept + Ergebnis in learnings.md notieren. Ideen-Pool (erweitern!):
- **Lebender Flyer**: Plakat/Flyer startet statisch, in den Fotofeldern beginnen Videos zu laufen, Kamera zoomt nacheinander in die Felder (`coffee_walk/build_living_flyer.py`).
- **Raster wird lebendig**: 3×3-Schwarz-Raster mit Event-Fotos, Kacheln gehen nacheinander an wie Fenster am Abend.
- **Countdown zum Abend**: 18:00 → 20:00 → 23:00 → 02:00, je Uhrzeit ein Event/Clip, große Oswald-Ziffern.
- **Split-Screen „Du / Du mit Tribe“**: links Couch/Handy-Scrollen, rechts Leute unterwegs (nur echte/Stock-Clips, kein Vorher-Nachher-Versprechen).
- **Typo-Schnitt**: ein Satz Wort für Wort im Beat, jedes Wort öffnet ein Fenster in einen Clip.
- **Stadtpuls-Karte**: schwarze Karte, Events glühen kupfern auf (echte Daten aus events.json).
- **Polaroid-Stapel**: Fotos fallen auf schwarzen Grund, das oberste beginnt sich zu bewegen.
- **Ticket-Reel**: Event als schwarzes Ticket, wird „abgerissen“, dahinter das Event.
Nur Mixkit-Clips/Musik, echte Events/Fotos, keine erfundenen Zahlen, keine Computerstimme. Bauen mit PIL+ffmpeg (Vorlagen in `coffee_walk/`, `app_reel/`), als `video` + `keep_audio: true` posten.

### Coffee Walk jeden Samstag (Maik 17.10.)
Jeden **Samstag** ist der Coffee Walk (findet sonntags statt) Teil des Postings – als eigenes Reel/Karussell oder als fester Bestandteil des Samstags-Posts. Vorlage: `coffee_walk/` (Flyer, `build_living_flyer.py`). Konzept variieren, Flyer-Look behalten. **Clips müssen zum Thema passen**: Leute mit Coffee to go in der Stadt, Café-Szenen, Stadtspaziergang – kein Campus, keine Rucksack-/Schulszenen, nichts Unpassendes. Freigegebene Clips: Mixkit 46650 (Freundinnen mit Coffee to go), 21358 (Altstadtgasse), 43247 (Café).

### Eigene Community-Fotos zuerst (Maik 18.10.)
Echte Tribe-Fotos (`tribe_autopilot/images/`, FREIGEGEBEN.json) sind der stärkste Content – Menschen aus der Community. Jeder Post zeigt mindestens ein echtes Community-Foto, Titelbild bevorzugt eins davon. Noch nie genutzte Fotos zuerst (in state.json `images` prüfen), z. B. die Wanderbilder (nur einmal als Hintergrund in T21) und die 15 neuen vom 18.10. Event-Bilder aus events.json nur ergänzend.

### Schnitt-Referenzen aus Maiks eigenen Reels (18.10.) – Pflichtlektüre für den Creative Director
Dateien: `tribe_autopilot/footage/referenz/250-mitglieder.mp4` (13,6 s) und `wandersamstag-intro-screen.mp4` (7 s). Vor jedem Reel ansehen (Frames ziehen), Techniken übernehmen und kombinieren:
- **Zähler über Foto-Collage** (250 Mitglieder, 0–3,5 s): Mosaik aus vielen echten Community-Fotos, große weiße Zahl zählt hoch (22 → 70 → … → 250), Kacheln wechseln dabei. Für Meilensteine, „X Leute heute unterwegs“, „X Events heute“ (echte Zahlen!).
- **Polaroid-Rahmen auf weichgezeichnetem Hintergrund** (3,5–10 s): Foto im weißen Sofortbild-Rahmen mit kleinem ♡ unten, dahinter dasselbe Bild groß, unscharf, abgedunkelt. Text mittig im Polaroid („DANKE, dass ihr dabei seid.“). Schwarz-Weiß ↔ Farbe als Stilmittel.
- **Schnelle Polaroid-Folge** (8–10,7 s): Collage-Flash (1 Frame), dann alle ~0,6 s ein neues Polaroid – Tempo zieht zum Schluss an.
- **Ruhiges Ende** (10,7–13,6 s): ein Polaroid, Text „AUF DIE NÄCHSTEN 250 · THE TRIBE · Werde Teil der Community · Link in …“, ~3 s stehen lassen.
- **Wandersamstag-Intro**: Landschaft (weiter Himmel) als ruhiger Start, **Whip-/Licht-Wisch-Übergang** und **weiße Blitzbalken** als Schnitt, dann Selfies mit **Bewegungsunschärfe-Übergängen**, Titel zweizeilig „TRIBE“ (weiß) + Eventname in Gelb/Kupfer-Serif, Unterzeile „Immer am 3. Samstag im Monat · Anmeldung in der Community“; feste Kopfzeile (schwarzer Balken mit Termin) + „THE TRIBE“-Label in der Ecke über die ganze Länge. **Ohne @-Namen** (keine Markierungen – Regel).
- Rhythmus allgemein: Hook ≤ 1 s, Schnitte im Takt (0,5–0,7 s in der Mitte), Ende 2–3 s stehen. Kurz halten (7–15 s).

### App-Posts nie nur App (Maik 18.10.)
Gemeint sind die App-Posts auf Instagram: App-Karussells und App-Reels zeigen immer auch echte Community-Fotos (mind. jede 2. Folie bzw. Szene; Titelbild = Menschen, Screenshot als Handy darüber oder daneben). Botschaft: Events finden **und** Leute finden. Link-Vorschau der App (`docs/tribe/og.jpg`) ist entsprechend gebaut.


# Teil C – Dating (@natuerlich.du.ms): Maiks Texte & Formate

## Texte & Formate von Maik (Quelle für alle Posts)

### Positionierung in einem Satz (zuerst lesen)
Ich bin Maik, Männerfotograf in Münster. Ich mache Dating-Fotos, die so aussehen wie du im echten Leben – erst lernen wir uns kennen, dann fotografieren wir, bearbeitet mit KI noch am selben Tag, und du zahlst nur, wenn du zufrieden bist.

### Ton
Ich-Form, ehrlich, ruhig, leicht selbstironisch. Kein Hype, keine Ausrufezeichen-Ketten. Erst das Problem benennen, das der Leser kennt („Du weißt selbst, dass das Foto nicht gut ist“), dann der Gedanke, dann das Angebot. Kurze Sätze. Du-Ansprache.

### Kernsätze (wörtlich nutzbar)
- „Der Unterschied zwischen einem Selfie und einem Foto aus dem Shooting ist nicht Photoshop oder ein teures Studio, sondern der Moment.“
- „Beim Selfie hältst du die Luft an und hoffst.“
- „Beim Shooting läuft ein echtes Gespräch, du lachst über irgendetwas Albernes, und genau dann drücke ich ab.“
- „Jeder, der posiert, sieht aus wie jemand, der posiert.“
- „Das Problem ist nicht die Beleuchtung, nicht der Hintergrund, sondern die Anspannung.“
- „Kein Regisseur, kein Stativ-Starren, kein ‚Kopf leicht nach links‘. Wir reden einfach, ich fotografiere dabei.“
- „Das ist kein Fotoshooting. Das ist ein Gespräch mit Kamera.“
- „Ein Profilbild reicht nicht. Hier sind die 4, die zusammen wirken.“
- „Alle vier hast du nach einem Shooting. Keinen davon hast du nach einem Selfie-Nachmittag.“
- „Mehr Matches fangen mit dem ersten Bild an.“

### Angebot (Stand 13.10.2026, Maik: „50 € streichen – ab 99 € ist mein Wert“ – nur das verwenden)
1 Stunde · ab 99 € · Bilder noch am selben Tag fertig bearbeitet · Münster. CTA: „Buchungslink in Bio“ / „Link in Bio“ / „Schreib mir, wenn du wissen willst, wie das bei dir aussehen würde.“ Kommentarfrage-Vorlage: „Was wäre dein liebstes Setting für ein Shooting?“

### Hashtag-Pool
#DatingFotos #ProfilbildUpgrade #MehrMatches #OnlineDating #AuthentischeFotos #DatingApp #ProfilfotosDating #Münster

### Vorlage-Texte (Original)
> Preis in den Vorlagen auf „ab 99 €“ aktualisiert (Maik, 13.10.).
#### T1 – Selfie vs. Moment (Post D0212)
Badezimmerspiegel, schlechtes Licht, gezwungenes Lächeln. Du weißt selbst, dass das Foto nicht gut ist. Trotzdem bleibt es auf deinem Profil, weil du nichts Besseres hast. / Das ist kein Vorwurf, das ist die Realität für die meisten, die auf Dating-Apps aktiv sind. / Der Unterschied … ist … der Moment. Beim Selfie hältst du die Luft an und hoffst. Beim Shooting läuft ein echtes Gespräch … genau dann drücke ich ab. Das Ergebnis ist ein Foto, das zeigt, wie du wirkst, wenn du entspannt bist, nicht wie du aussiehst, wenn du dich fotografierst. / Ein Shooting dauert eine Stunde, kostet ab 99 Euro, und die Bilder sind noch am selben Tag fertig bearbeitet. Mehr Matches fangen mit dem ersten Bild an. / Buchung direkt über den Link.

#### T2 – Wer posiert (Post D0213)
Jeder, der posiert, sieht aus wie jemand, der posiert. / Das klingt banal. Aber schau dir mal deine letzten Profilfotos an. Du siehst drauf aus, als würdest du auf ein Foto warten. Dieser Moment, kurz bevor der Auslöser klickt … Den sieht man. / … nicht die Beleuchtung, nicht der Hintergrund, sondern die Anspannung. / Wenn du redest, passiert etwas anderes. Ein echter Gedanke huscht über dein Gesicht. Du lachst, weil etwas tatsächlich lustig war. Du schaust weg, weil du nachdenkst. … / Deshalb ist mein Shooting kein Shooting im klassischen Sinne. … Wir reden einfach, ich fotografiere dabei. Fertig bearbeitet noch am selben Tag, ab 99 Euro. / Fotos, die zeigen, wer du wirklich bist … / Schreib mir, wenn du wissen willst, wie das bei dir aussehen würde.

#### F1 – Mini-Doku-Reel (siehe Teil D)
45–60 s, echte Schnitte: Ankunft, erstes Gespräch, Lachen über etwas Zufälliges, Klick der Kamera, fertiges Bild. Nur Musik. Titel-Card „Das ist kein Fotoshooting. Das ist ein Gespräch mit Kamera.“ CTA Link in Bio. Caption-Frage „Was wäre dein liebstes Setting für ein Shooting?“ → braucht echte Clips; bis dahin Foto-Reel-Variante (D0215).

#### F2 – Karussell „Die 4 Fotos“ (Post D0214)
S1 „Ein Profilbild reicht nicht. Hier sind die 4, die zusammen wirken.“ · S2 Hauptfoto – klares Gesicht, natürlicher Ausdruck · S3 Aktivitätsfoto – du bei etwas, das du magst · S4 Soziales Foto – du mit anderen · S5 Überraschungsfoto – etwas Unerwartetes, das Gesprächsstoff gibt. Caption „Alle vier hast du nach einem Shooting. Keinen davon hast du nach einem Selfie-Nachmittag.“ CTA Buchungslink in Bio.

#### T3 – So läuft ein Shooting wirklich (Original, 13.10.)
Ich zeige dir, wie ein Shooting bei mir wirklich abläuft.

Du kommst an, wir reden. Über irgendwas. Deinen Job, deinen letzten Urlaub, was auch immer. Irgendwann vergisst du, dass die Kamera da ist. Genau das ist der Moment, den ich suche, weil dieser Ausdruck, den du gerade im Gespräch hast, der ist es, der auf Dating-Apps funktioniert. Nicht das aufgesetzte Lächeln vor weißem Hintergrund.

Kein "Stell dich mal so hin", kein "Lächel jetzt". Nichts davon.

Danach: KI-Bearbeitung, fertig noch am selben Tag. Ab 99 Euro bekommst du Fotos, die zeigen, wer du wirklich bist. Nicht eine polierte Version davon.

#BehindTheScenes #DatingFotos #Authentizität #OnlineDating #Singlelife

Schau dir die Story-Serie an, die zeigt, wie das Schritt für Schritt aussieht. Link in Bio.

### So baust du daraus neue Posts
1. Einen Kernsatz als Hook (Folie 1 / Reel-Start), Problem → Gedanke → Angebot.
2. Maiks Texte sind Vorlagen: frei umschreiben, neu kombinieren, kürzen, neue Hooks und Blickwinkel finden – aber in SEINER Stimme (Ich-Form, ehrlich, ruhig, kurze Sätze, Problem → Gedanke → Angebot). Inhaltlich nur Fakten aus diesem Skill (keine Kundenzahlen, Match-Quoten oder Abläufe, die Maik nicht genannt hat).
3. Formate: Karussell (4–6 Folien), Foto-Reel (15–30 s, Ken-Burns über Maiks Fotos, Musik, je Szene max. 6 Wörter, Endkarte Angebot), Mini-Doku-Reel (nur mit echten Clips).
4. JEDE Folie bekommt ein Bild ("bg"), auch Text-/Listen- und CTA-Folien – passend zur Aussage (z. B. „Kopf leicht nach links“ → Profilfoto). Keine reinen Textfolien. Bilder MISCHEN: echte Fotos (echt-*) und KI-Stilbilder (stil-*) gehören beide in den Pool – KI-Bilder nicht ausschließen (Maik, 13.10.). stil-*-Folien bekommen automatisch das Label „Stil-Inspiration · KI-generiert“; nie als echtes Kundenergebnis/Vorher-Nachher darstellen. Der Renderer füllt fehlende Bilder notfalls automatisch aus images/dating/ (ohne bg_exclude), aber gezielt gewählte Bilder sind Pflicht.
5. Keine Caption 1:1 wiederholen – jeder Post bekommt einen neu geschriebenen Text in Maiks Stimme.

### Niemanden markieren (Pflicht)
Nie andere Accounts markieren oder erwähnen: keine @-Namen in Caption oder Folien, keine Foto-Credits mit @, keine User-Tags, keine Collab-Einladungen. Auch nicht bei Fotos von Freunden. `config.json` hat dafür `no_mentions: true` – der Autopilot entfernt @-Zeilen und Tags zusätzlich automatisch.

### Positionierung & Geschichte (Interview mit Maik, 13.10.2026 – Block 1)
**Wer:** Maik – Männerfotograf in Münster, spezialisiert auf Dating-Fotos. Personal Brand: Maik persönlich, KI nur als Werkzeug in der Bildbearbeitung. KEIN Dating-Coach (nie so nennen).
**Für wen:** Singlemänner ca. 25–35+, oft schon länger Single, haben es mit eigenen Fotos versucht, es kommen kaum Matches. Wünschen sich eine Partnerschaft.
**Problem (nicht zu psychologisch erzählen):** Wenige Matches drücken auf den Selbstwert. Man denkt, es liegt an einem selbst – oft liegt es an den Fotos.
**Maiks Geschichte:** Hat Online-Dating selbst intensiv ausprobiert, auch hier in Münster. Mit eigenen Fotos lief wenig. Dann hat ein Kumpel ein Shooting mit ihm gemacht – mit den neuen Fotos ging es von null auf ein paar Matches. (Nicht erwähnen: Ansprechen auf der Straße.)
**Warum ihm das wichtig ist:** Er findet es unfair, wie ungleich Matches auf Dating-Apps verteilt sind – viele Männer bekommen kaum welche, und das macht etwas mit dem Selbstwert. (Keine Studienzahl nennen, solange keine geprüfte Quelle vorliegt.)
**Werte:**
- Persönlich: vorher kennenlernen, herausfinden, welcher Stil zu dir passt und was dir wichtig ist. Das Gespräch steht im Vordergrund, nicht die Kamera.
- Authentisch / wie im echten Leben: Fotos zeigen dich so, wie dich eine Frau beim Date erlebt. Maik hat KI-Profilbilder selbst ausprobiert – sie wirken nicht, weil beim Treffen ein anderer Mensch vor ihr steht. Deshalb: keine KI-generierten Profilfotos.
- Natürlich / nicht gestellt.
- Schnell: KI nur zur Bildbearbeitung → Bilder noch am selben Tag fertig.
- Fair: Bezahlt wird erst, wenn der Kunde mit dem Ergebnis zufrieden ist.
**Belege (nur so verwenden, nichts aufblähen):** Mehrere Shootings, die Kunden waren bisher zufrieden; der letzte Kunde war sehr zufrieden. Ein Kunde: vorher praktisch keine Likes, danach rund 10 – freigegeben (Maik 13.10.). Genau so formulieren: „von null auf rund 10 Likes“ – NICHT „Matches pro Woche“, nicht aufrunden. Sein Kommentar zu den Bildern (anonym zitierbar): „Die Fotos sind mega.“ Keine weiteren Zahlen, Kundenanzahlen oder Erfolgsquoten erfinden oder hochrechnen.
**Abgrenzung:** Persönlicher Kontakt und echtes Gespräch statt Posing-Anweisungen, Ergebnis wie im echten Leben statt KI-Hochglanz, schnell dank KI-Bearbeitung, Bezahlung erst bei Zufriedenheit.

### Positionierung – Block 2 (Geschichte & Ablauf, 13.10.2026)
**Tiefpunkt (Story-Material):** Frust, Selbstzweifel, das Gefühl, nicht gut genug zu sein. Maik hat Geld für Premium/Boosts auf Dating-Plattformen ausgegeben, um höher platziert zu werden – hat nichts gebracht. Kernaussage: Mehr Sichtbarkeit nützt nichts, wenn die Fotos nicht funktionieren.
**Wendepunkt:** Das Shooting mit einem Kumpel hat Spaß gemacht – und danach kamen deutlich mehr Likes und gute Dates. (Nicht erzählen: dass Maik heute kein Online-Dating mehr macht; keine Prahlerei mit „attraktiven Frauen“.)
**Warum Fotografie:** Kreativ sein, draußen unterwegs sein, Menschen persönlich kennenlernen. Im Mittelpunkt steht das gemeinsame Erleben: coole Spots aussuchen, improvisieren – nicht die Kamera.
**Ablauf aus Kundensicht (so beschreiben):**
1. Erst per WhatsApp schreiben.
2. Vorab treffen und quatschen: Vorstellung, Stil, was du magst, welche Orte zu dir passen.
3. Shooting in Münster, z. B. Altstadt, Kanal, Hafen, Schloss, Botanischer Garten, Aasee, Promenade oder gemütlich im Café – authentisches Flair.
4. Bearbeitung mit KI → schnell, noch am selben Tag; die Bilder wirken trotzdem menschlich, nicht künstlich.
5. Nicht zufrieden → du zahlst nichts.
**Was Maik nicht macht:** gestellte Posen, klassische „Fotografen-Fotos“, KI-generierte Gesichter oder Profilbilder.
**Verkaufsargumente (Priorität):** 1) Du zahlst nur, wenn du zufrieden bist. 2) Fotos wie im echten Leben – sie sieht beim Date denselben Mann. 3) Persönlich: erst kennenlernen, dann fotografieren. 4) Noch am selben Tag fertig. 5) Münsters schönste Spots.
**Erlaubte Aussage zum Markt:** „Matches sind auf Dating-Apps extrem ungleich verteilt.“ Keine Studienzahl.

### Positionierung – Block 3 (Ton & Auftritt, 13.10.2026)
**Absender:** einfach „Maik“ – Personal Brand, Maik persönlich; KI nur als Werkzeug (Bearbeitung). Account bleibt @natuerlich.du.ms.
**Sprache:** so, wie Maik redet – umgänglich, locker, ehrlich, ruhig, gern auch mal verletzlich (eigene Zweifel und Frust zugeben). Alltagswörter wie „Bock haben“, „quatschen“, „mega“, „cool“ sind ok, sparsam.
**Verboten:** „Digger“, „Bro“, „Alpha“, „Game“, Slang/Kiezdeutsch, Aufreißer- oder Pickup-Vokabular, Hype mit Ausrufezeichen-Ketten, Coach-Sprech.
**Gesicht/Stimme:** Maik spricht NICHT selbst in Reels (kein Voiceover, keine Computerstimme). Persönliches zeigen über seine eigenen Fotos (echt-*) und Ich-Geschichten – regelmäßig einbauen.
**CTA:** Ziel ist WhatsApp: „Schreib mir auf WhatsApp – Link in Bio.“ (Die Landingpage verlinkt direkt zu WhatsApp.) Alternativ „Kommentiere CHECK“ für den Gratis-Profil-Check.
**Content-Säulen (Mix):**
1. Maiks Geschichte (Frust → Boosts gekauft, nichts gebracht → Shooting mit Kumpel → es lief).
2. Ablauf & Haltung (erst quatschen, dann Kamera; keine gestellten Posen; zahlen nur bei Zufriedenheit).
3. Münster-Spots (Altstadt, Kanal, Hafen, Schloss, Botanischer Garten, Aasee, Promenade, Café).
4. Profil-Tipps (Hauptfoto, Aktivität, sozial, Überraschung; echt statt KI-Gesicht).
5. Beleg (ein Kunde: von null auf rund 10 Likes, „Die Fotos sind mega“) – sparsam, nicht in jedem Post.

### Bilder & Rotation (Maik, 13.10.2026)
- Solange es keine Kundenfotos gibt: Maiks eigene Fotos (echt-*) UND die KI-Stilbilder (stil-*) aktiv nutzen. stil-* immer gelabelt („Stil-Inspiration · KI-generiert“) und als Stilvorlage einordnen („So könnte dein Look aussehen“), nie als Kunde oder Ergebnis.
- Offen zeigen, dass Maik KI als Technologie einsetzt (Bearbeitung, Tempo, Stil-Ideen) – das gehört zur Marke „Maik mit KI“. Die Fotos selbst bleiben echte Fotos von echten Menschen.
- Rotation der Posts: 1) Persönliches teilen (Maiks Geschichte, Gedanken) → 2) Mehrwert (z. B. „So baust du ein gutes Dating-Profil auf“, Fototypen, Fehler im Profil) → 3) Ablauf/Angebot. Statistiken nur mit geprüfter Quelle (Quelle in der Caption nennen); sonst ohne Zahl.
- Erster Post nach dem Interview: Maiks Geschichte („Ich hab Geld für Boosts ausgegeben. Gebracht hat es nichts.“).


# Teil D – Dating-Mini-Doku-Reel

## Mini-Doku-Reel „Gespräch mit Kamera“ (Vorgabe von Maik, 13.10.2026)

### Format
- Reel 9:16, **45–60 s**, Stil kurzer Dokumentarfilm: ruhige, echte Schnitte, kein Effekt-Gewitter.
- **Keine Sprachausgabe**, nur Musik (lizenzfrei aus `instagram_autopilot/music/`, Stimmung ruhig/warm, z. B. `mood:chill`).
- Optional kurze Untertitel-Zeilen (max. 5 Wörter) pro Szene.

### Szenen (Reihenfolge fest)
| # | Szene | Länge | Clip-Quelle |
|---|---|---|---|
| 1 | Ankunft (Kunde kommt an, Begrüßung) | 6–8 s | `footage/dating/01-ankunft*.mp4` |
| 2 | Erstes Gespräch (reden, kein Posieren) | 8–10 s | `footage/dating/02-gespraech*.mp4` |
| 3 | Lachen über etwas Zufälliges | 6–8 s | `footage/dating/03-lachen*.mp4` |
| 4 | Der Klick der Kamera (Nahaufnahme Auslöser) | 3–5 s | `footage/dating/04-klick*.mp4` |
| 5 | Das fertige Bild (Foto aus diesem Shooting, kurzer Zoom) | 5–7 s | `images/dating/kunde-*.jpg` |
| 6 | Titel-Card: „Das ist kein Fotoshooting. Das ist ein Gespräch mit Kamera.“ | 4–5 s | Text auf dunklem Grund |
| 7 | CTA: „Link in Bio“ (+ 1 Stunde · ab 99 € · noch am selben Tag fertig) | 3–4 s | Logo-/CTA-Karte |

### Caption
Kurz, Ich-Form, Maiks Ton. Endet IMMER mit der Kommentarfrage:
**„Was wäre dein liebstes Setting für ein Shooting?“**
Danach: „Link in Bio“. Hashtags z. B. #DatingFotos #OnlineDating #AuthentischeFotos #Münster.

### Harte Regeln
- **Nur echte Clips aus einem echten Shooting.** Keine Stock-Clips, keine KI-Videos, keine nachgestellten Szenen, die als echtes Shooting ausgegeben werden.
- Kunden im Video/Endbild nur mit **schriftlichem Einverständnis** (Maik bestätigt im Chat oder in `footage/dating/FREIGABE.json`).
- Fehlen Clips: **kein Reel bauen**, sondern Maik um die fehlenden Szenen bitten (Liste oben). Kein Ersatz durch Fremdmaterial.
- Übergangslösung (nur wenn Maik zustimmt): „Behind the Scenes“-Version mit Maiks eigenen echten Fotos (`echt-kamera-*.jpg`, `echt-lachen-*`), klar als Fotos statt Video, ohne „fertiges Kundenbild“.

### Umsetzung
Spec in `instagram_autopilot/posts/` mit `"type": "reel"`, Folien `{"kind": "clip", "src": "instagram_autopilot/footage/dating/…", "length": s, "caption": "…"}`, Endkarten als `hook`/`cta`, `"music": "mood:chill"`, kein `voice`. Rendern mit `python3 instagram_autopilot/render.py <spec> <out>`, Frames prüfen, dann queued.


# Teil E – Virale Reels

## Wissen: virale Reels (Stand 18.10.2026) – Pflichtlektüre für den Creative Director

Instagram veröffentlicht keine Gewichte. Bestätigt (Adam Mosseri, Jan. 2025) sind drei Hauptsignale; alle Prozentzahlen unten sind Richtwerte aus Marketing-Blogs, keine offiziellen Werte.

### 1. Was der Algorithmus misst
- **Watch-Time / Durchsehquote** – wie viel vom Reel geschaut wird. Kurz + komplett geschaut schlägt lang + abgebrochen.
- **Sends pro Reichweite** (per DM geteilt) – stärkstes Signal für Nicht-Follower. → Jedes Reel braucht einen Grund, es jemandem zu schicken („Schick das deiner Person für Samstag“).
- **Likes pro Reichweite** – Quote, nicht absolute Zahl.
- **Testphase**: neues Reel geht erst an eine kleine Gruppe Nicht-Follower. Schauen sie durch, wiederholen oder senden → mehr Reichweite; wischen sie früh weg → Ende.
- Original + echt (eigene Fotos/Clips, echte Menschen) wird bevorzugt; reine Grafik/Text-Reels und Wiederverwertungen schwächer.

### 2. Hook (erste Sekunde entscheidet)
- **Bewegung im ersten Frame** – nie ruhiges Logo/Titelbild als Start.
- Text-Hook bis 1,0 s lesbar, Versprechen/Auflösung angedeutet bis 3 s.
- Hook-Typen, die funktionieren: direkte Frage an eine Gruppe („Neu in Bielefeld?“ – bei uns bester Wert: T01 490 / T04 625 Reichweite), Zugehörigkeit („Für alle, die Samstag nichts vorhaben“), Zahl/Konkretes („250 Leute. Ein Chat.“), Kontrast/Überraschung, „POV: …“.
- Gesicht/Menschen im ersten Frame > Ort > Objekt.

### 3. Schnitt & Tempo
- **7–15 s** ideal (Loops zählen als neue Views). Länger nur, wenn jede Sekunde trägt.
- Schnitte im Takt der Musik, Mitte 0,5–0,7 s pro Bild; keine toten Sekunden.
- **Pattern Interrupts** alle 2–3 s: Zoom, Wisch-/Blitz-Übergang, Text-Pop, Farbwechsel (Farbe ↔ S/W als Akzent), Tempowechsel.
- **Loop bauen**: letzter Frame führt optisch in den ersten (gleiches Motiv/Text), damit das Reel nahtlos neu startet.
- Ende 2–3 s ruhig mit CTA, nicht länger.
- 85 % schauen ohne Ton → jede Aussage als Text im Bild; Text in der sicheren Zone (nicht unten 20 %, nicht rechts am Rand – UI überdeckt).

### 4. Teilbarkeit (Sends)
- Inhalt, der ein Gespräch startet: „Wer kommt mit?“, „Markier nicht – schick's der Person“, Termine/Pläne, Insider der Stadt.
- Konkreter Nutzen fürs Wochenende (echte Events, Zeit, Ort) → wird an Freunde geschickt.
- Caption: erste Zeile = zweiter Hook; Frage am Ende für Kommentare.

### 5. Was bei uns schon belegt ist (eigene Daten)
- Tribe: Menschen/„neu in der Stadt“ 490–625 Reichweite ↔ App-Videos 25–56, reine Event-Listen fallend (256 → 95). → Menschen + Zugehörigkeit vor Feature.
- Dating: Follower flach bei 59 über alle Themen – Hook-Tests laufen (Kernsatz, Frage, Zahl).
- Neue Erkenntnisse hier ergänzen (mit Datum + Zahl), nichts ohne Beleg als Regel.

### 6. Checkliste vor jedem Reel
1. Bewegung + Mensch im ersten Frame? 2. Hook-Text ≤ 1 s lesbar? 3. ≤ 15 s? 4. Interrupt alle 2–3 s? 5. Loop-Ende? 6. Grund zum Senden? 7. Text in sicherer Zone? 8. CTA (Community/Link in Bio) in den letzten 2–3 s?

Quellen: later.com/blog/instagram-reels-algorithm · socialpilot.co (Reels Algorithm 2026) · posteverywhere.ai (5 Ranking Signals) · eclincher.com (Algorithm 2026) · socialz.ai (viral reels) · joyspace.ai (Pattern Interrupts) · softomatesolutions.com (Hook-Formel)
