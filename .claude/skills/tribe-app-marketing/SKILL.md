---
name: tribe-app-marketing
description: Positionierung, Texte und B2C/B2B-Rotation für @the_tribe.bi.ms und die THE TRIBE App (Events + Community Bielefeld). Nutzen bei jedem Tribe-Post, Story, Profiltext oder App-Werbung.
---

# THE TRIBE – Positionierung (Maik, 16.10.2026)

App: https://maikz91.github.io/the-tribe-bot/tribe/  ·  Community: WhatsApp (Link in Bio)

## Alleinstellungsmerkmal (immer mitschwingen)
Es gibt viele Event-Apps, Seiten und Insta-Accounts – unübersichtlich, und am Ende gehst du trotzdem allein.
THE TRIBE ist die **einzige** Ausgeh-App in Bielefeld, die Events UND Community verbindet:
1. **Finden** – alle Partys, Konzerte, Bars übersichtlich nach Tag, ohne Sport/Wochenmarkt-Rauschen.
2. **Connecten** – direkt Leute aus der Community finden, die mitkommen.
3. **Teilen** – jedes Event mit einem Tipp auf WhatsApp an Freunde oder die Community.
4. **Spontan raus** – „Bin gerade im Sternberg, hab Bock auf ein Bier“ + Standort → wer in der Nähe ist, kommt dazu.

Kernsatz: **„Events finden. Leute finden. Rausgehen.“**

## Feature-Rotation (jeder App-Post zeigt EIN Feature groß, mit echtem Live-Screenshot)
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

## Profiltext (Vorschlag, Maik setzt ihn manuell)
THE TRIBE · Bielefeld
Events finden. Leute finden. Rausgehen.
Die Ausgeh-App mit Community 🔗
Veranstalter? Event listen ↓

## Rotation Events-Post (zweiter Post/Tag, ~11:00)
- **Tag A – B2C:** „Das geht heute“ – 3 echte Event-Karten (Foto, Zeit, Ort aus events.json), dann Folie mit App-Screenshot + Feature (rotierend: Teilen, Spontan, Merken, Community), CTA „Alle Events + Leute zum Mitgehen: App-Link in Bio“.
- **Tag B – B2B:** an Veranstalter/Bars/Clubs: „Deine Party verdient mehr als einen Story-Slide“ – Benefit: Leute, die wirklich rausgehen, Community, die gemeinsam kommt, Highlight-Platz, Insta-Story/Weekend-Planer. Preise nur so, wie sie in der App stehen. CTA „Event listen: Link in Bio / DM“.
- **Donnerstag:** immer Weekend-Planer (Fr–So, echte Events) + App-Hinweis.
- App-Screenshots: echte Screenshots der Live-App (Playwright, 1080×1920), nie Mockups mit erfundenen Events.

## Regeln
- Nichts erfinden: Events nur aus events.json, keine erfundenen Nutzerzahlen („die einzige App mit Community“ ist Maiks Positionierung – keine Zahlen dazudichten).
- Niemanden markieren. Keine KI-Menschen. Münster-Fotos nie als Bielefeld.
- Ton: locker, direkt, Du, kein Werbe-Sprech.

## Installation (in Posts/Stories erwähnen)
Die App ist eine Web-App – kein App Store, kostenlos. In Posts als „App“ bezeichnen, Installation in einer Folie/Story zeigen:
- **iPhone:** Link in Safari öffnen → Teilen → „Zum Home-Bildschirm“.
- **Android:** Link öffnen → Button „Installieren“ unten in der App (oder Chrome-Menü ⋮ → „App installieren“).
- Direktlink mit Anleitung: https://maikz91.github.io/the-tribe-bot/tribe/#installieren
- Hinweis: Aus Instagram heraus erst „Im Browser öffnen“, dann installieren.

## Community-Verweis in jedem Post (Maik 17.10.)
Jeder Tribe-Post verweist auf die Community: Caption endet automatisch mit `caption_footer` (Link in Bio → kostenlose WhatsApp-Community). Jede Story bekommt automatisch den Kasten aus `story_cta` in `tribe_autopilot/config.json` („KOMM IN DIE COMMUNITY · Link in Bio · WhatsApp · kostenlos“), bei Reels oben, bei Karussell-Storys unten. Nicht abschalten.

## Stil ist Pflicht (Maik 17.10.): Schwarz-Weiß, minimalistisch – Flyer-Look
Referenz: `tribe_autopilot/coffee_walk/flyer.png`. Gilt für ALLE Tribe-Posts, Reels und Storys.
- Schwarz (#000) als Fläche, Text weiß (#f5f3ee), einziger Akzent Kupfer #c99669. Kein Neon, kein Lila, kein Amber.
- Schrift: Geist Bold für Headlines (groß, eng), Oswald (`tribe_autopilot/fonts/Oswald.ttf`) für Versalien-Zeilen wie „GUTE LEUTE.“, Geist Regular für Fließtext. Viel Leerraum.
- Fotos/Clips **in Farbe** (Maik 18.10.: nicht nur Schwarz-Weiß), nur leicht zurückgenommen und kontrastreicher (Render: `photo_grade` Sättigung 0.85; eigene Reel-Skripte ähnlich). Schwarz-Weiß höchstens als einzelnes Stilmittel (z. B. ein Polaroid), nie durchgehend. Schwarz ist die Fläche/Typo, nicht der Fotofilter.
- **Immer Menschen zuerst** – kein Einstieg mit Produkt, Kaffeemaschine, Logo oder Text-Wand. Tribe ist Community fürs Ausgehen.
- Ende jedes Reels: Community · Link in Bio.

## Creative Director denkt sich die Idee selbst aus (Pflicht)
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

## Coffee Walk jeden Samstag (Maik 17.10.)
Jeden **Samstag** ist der Coffee Walk (findet sonntags statt) Teil des Postings – als eigenes Reel/Karussell oder als fester Bestandteil des Samstags-Posts. Vorlage: `coffee_walk/` (Flyer, `build_living_flyer.py`). Konzept variieren, Flyer-Look behalten. **Clips müssen zum Thema passen**: Leute mit Coffee to go in der Stadt, Café-Szenen, Stadtspaziergang – kein Campus, keine Rucksack-/Schulszenen, nichts Unpassendes. Freigegebene Clips: Mixkit 46650 (Freundinnen mit Coffee to go), 21358 (Altstadtgasse), 43247 (Café).

## Eigene Community-Fotos zuerst (Maik 18.10.)
Echte Tribe-Fotos (`tribe_autopilot/images/`, FREIGEGEBEN.json) sind der stärkste Content – Menschen aus der Community. Jeder Post zeigt mindestens ein echtes Community-Foto, Titelbild bevorzugt eins davon. Noch nie genutzte Fotos zuerst (in state.json `images` prüfen), z. B. die Wanderbilder (nur einmal als Hintergrund in T21) und die 15 neuen vom 18.10. Event-Bilder aus events.json nur ergänzend.

## Schnitt-Referenzen aus Maiks eigenen Reels (18.10.) – Pflichtlektüre für den Creative Director
Dateien: `tribe_autopilot/footage/referenz/250-mitglieder.mp4` (13,6 s) und `wandersamstag-intro-screen.mp4` (7 s). Vor jedem Reel ansehen (Frames ziehen), Techniken übernehmen und kombinieren:
- **Zähler über Foto-Collage** (250 Mitglieder, 0–3,5 s): Mosaik aus vielen echten Community-Fotos, große weiße Zahl zählt hoch (22 → 70 → … → 250), Kacheln wechseln dabei. Für Meilensteine, „X Leute heute unterwegs“, „X Events heute“ (echte Zahlen!).
- **Polaroid-Rahmen auf weichgezeichnetem Hintergrund** (3,5–10 s): Foto im weißen Sofortbild-Rahmen mit kleinem ♡ unten, dahinter dasselbe Bild groß, unscharf, abgedunkelt. Text mittig im Polaroid („DANKE, dass ihr dabei seid.“). Schwarz-Weiß ↔ Farbe als Stilmittel.
- **Schnelle Polaroid-Folge** (8–10,7 s): Collage-Flash (1 Frame), dann alle ~0,6 s ein neues Polaroid – Tempo zieht zum Schluss an.
- **Ruhiges Ende** (10,7–13,6 s): ein Polaroid, Text „AUF DIE NÄCHSTEN 250 · THE TRIBE · Werde Teil der Community · Link in …“, ~3 s stehen lassen.
- **Wandersamstag-Intro**: Landschaft (weiter Himmel) als ruhiger Start, **Whip-/Licht-Wisch-Übergang** und **weiße Blitzbalken** als Schnitt, dann Selfies mit **Bewegungsunschärfe-Übergängen**, Titel zweizeilig „TRIBE“ (weiß) + Eventname in Gelb/Kupfer-Serif, Unterzeile „Immer am 3. Samstag im Monat · Anmeldung in der Community“; feste Kopfzeile (schwarzer Balken mit Termin) + „THE TRIBE“-Label in der Ecke über die ganze Länge. **Ohne @-Namen** (keine Markierungen – Regel).
- Rhythmus allgemein: Hook ≤ 1 s, Schnitte im Takt (0,5–0,7 s in der Mitte), Ende 2–3 s stehen. Kurz halten (7–15 s).

## App-Posts nie nur App (Maik 18.10.)
Gemeint sind die App-Posts auf Instagram: App-Karussells und App-Reels zeigen immer auch echte Community-Fotos (mind. jede 2. Folie bzw. Szene; Titelbild = Menschen, Screenshot als Handy darüber oder daneben). Botschaft: Events finden **und** Leute finden. Link-Vorschau der App (`docs/tribe/og.jpg`) ist entsprechend gebaut.
