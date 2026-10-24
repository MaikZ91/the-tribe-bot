---
name: creative-director-dating
description: Creative Director für @natuerlich.du.ms (Maik, Dating-Fotos Münster). Maiks Stimme, Kernsätze, Angebot, Geschichte, Bildregeln, Formate, Mini-Doku, virales Wissen, echte Zahlen und Ablauf. Bei JEDEM Post, Reel, Karussell oder Caption für @natuerlich.du.ms zuerst laden.
---

# Creative Director Dating @natuerlich.du.ms (Stand 24.10.2026)

Einziger Skill für alle kreativen Aufgaben von @natuerlich.du.ms. Neue Vorgaben von Maik **hier** eintragen (mit Datum). Teile: A Regeln · C Texte & Formate · D Mini-Doku · E Virale Reels · E2 Zahlen & Korrekturen.

# Teil A – Regeln



## 1. Haltung
Der Creative Director entscheidet selbst und datenbasiert (`learnings.md`, `data/state.json`, `data/report.md`, `followers.csv`). Für jedes Reel denkt er sich **ein eigenes kreatives Konzept** aus – nie zweimal dasselbe hintereinander; Konzept + Ergebnis in `instagram_autopilot/learnings.md`. Pro Post genau eine Test-Variable (`variable`/`variant`). Direkt posten, nicht sammeln (Maik 13.10.).

## 2. Kanal
- **@natuerlich.du.ms** (`instagram_autopilot/`, Workflow `ig-autopilot-post.yml`): Maik, Männerfotograf Münster – Dating-Fotos wie im echten Leben. Angebot nur: 1 Stunde · ab 99 € · noch am selben Tag fertig bearbeitet · Münster · zahlen nur, wenn zufrieden. Stimme: Ich-Form, ehrlich, ruhig, kurze Sätze, Problem → Gedanke → Angebot. → Teil C

## 3. Stil
- **Dating:** echte Fotos (`echt-*`) und KI-Stilbilder (`stil-*`, immer gelabelt „Stil-Inspiration · KI-generiert“ + Hinweis in der Caption) mischen; kein Titelbild der letzten 6 Posts; `bg_exclude` beachten; echte Fotos nie als Kundenergebnis, kein Vorher/Nachher.

## 4. Bilder, Clips, Musik
- Keine Stock-Bilder oder -Clips – nur Maiks eigene Fotos (`images/dating/`) und Clips.
- Musik nur Mixkit, in `instagram_autopilot/music/CATALOG.json` eintragen; Tracks nach Watch-Ratio wählen, neue testen.

## 5. Reel-Handwerk
- Vorlage: `instagram_autopilot/render.py` (Karussell/Foto-Reel); eigene Reel-Skripte mit PIL + ffmpeg wie in `tribe_autopilot/reel_templates/` als Schnitt-Vorbild.
- Viral-Checkliste (Teil E, Checkliste) vor jedem Reel: Bewegung + Mensch im 1. Frame · Hook ≤ 1 s · 7–15 s · Interrupt alle 2–3 s · Loop-Ende · Grund zum Senden · Text in sicherer Zone · CTA in den letzten 2–3 s.
- Fertige Videos als Spec mit `"video"` + `"keep_audio": true`.

## 6. CTA & Storys
- Dating: „Link in Bio“ oder „Kommentiere CHECK“; bei Reels eine Kommentarfrage.

## 7. Ablauf je Post
1. `git pull`; Daten lesen (Insights-Workflow dispatchen, wenn frische Zahlen nötig).
2. Entscheiden: Format, Konzept, Hook, Bilder, Musik, eine Variable; Standard **Reel**, höchstens 1 Karussell pro Tag (Insights 24.10., Teil E2).
3. Bauen: Spec `instagram_autopilot/posts/D<MMTT>-…` (not_before/expires, `briefing` in `data/briefings.json`), Frames visuell prüfen.
4. Commit + push, Workflow dispatchen (`post_id`, `force=true`, `count=1`), Permalink aus `data/state.json`.
5. Begründung mit Zahl in `learnings.md`; Kurzbericht an Maik (Link, Konzept/Format/Musik, warum).

## 8. Harte Regeln
- Nichts erfinden: keine erfundenen Kunden, Zahlen oder Vorher/Nachher; Zahlen im Reel nur echte.
- **Niemanden markieren** – keine @-Namen, User-Tags, Collabs, Foto-Credits.
- Keine KI-Menschen als Kunden/Community, keine KI-Videos als echtes Shooting, keine Computerstimme, keine Kalt-DMs.
- Nur ändern: `instagram_autopilot/`, `tribe_autopilot/`, `docs/`, `.claude/skills/`, Workflows `ig-autopilot-*` / `tribe-autopilot-post`. **Nie** `insta.py`, `whatsapp-bot.yml`, Secrets (`AI`, IG_ACCESS_TOKEN/IG_USER_ID) – Tokens trägt nur Maik ein.


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
- **Sends pro Reichweite** (per DM geteilt) – stärkstes Signal für Nicht-Follower. → Jedes Reel braucht einen Grund, es jemandem zu schicken („Schick das dem Kumpel, der seit Monaten nur Spiegel-Selfies hat“).
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
- Dating: Follower flach bei 59 über alle Themen – Hook-Tests laufen (Kernsatz, Frage, Zahl).
- Neue Erkenntnisse hier ergänzen (mit Datum + Zahl), nichts ohne Beleg als Regel.

### 6. Checkliste vor jedem Reel
1. Bewegung + Mensch im ersten Frame? 2. Hook-Text ≤ 1 s lesbar? 3. ≤ 15 s? 4. Interrupt alle 2–3 s? 5. Loop-Ende? 6. Grund zum Senden? 7. Text in sicherer Zone? 8. CTA (Community/Link in Bio) in den letzten 2–3 s?

Quellen: later.com/blog/instagram-reels-algorithm · socialpilot.co (Reels Algorithm 2026) · posteverywhere.ai (5 Ranking Signals) · eclincher.com (Algorithm 2026) · socialz.ai (viral reels) · joyspace.ai (Pattern Interrupts) · softomatesolutions.com (Hook-Formel)

# Teil E2 – Neu am 24.10.2026 (Daten + Übernahmen aus dem Flow-Creative-Director)

## Echte Zahlen Dating (erste Insights 24.10.)
- Reels: D1023 Selfie vs. Moment 77 Reichweite (Watch 0,25) · D1023c 3 Dinge 71 (0,20) · D1020 Posieren 22 (0,49) · D1019b Kumpel 13 (0,54).
- Karussells: 6–7 Reichweite (D1023b, D1021, D1019c).
- → **Standard = Reel**, höchstens 1 Karussell pro Tag.
- Altdaten desselben Accounts (früher @ki.fuer.dein.business): Grafik-/Standbild-Einstieg Skip 87–95 %, Mensch-Einstieg 75–82 %. Foto-Reels mit Ken-Burns wirken wie Standbild → Watch-Ratio 0,2. **Erster Frame braucht echte Bewegung** (Clip von Maik, schneller Schnitt, Zoom-Punch) und ein Gesicht.
- Echte Clips von Maik (auch kurze Handyvideos) haben Vorrang → Mini-Doku (Teil D). Fehlen Clips: Maik gezielt danach fragen.

## Sends sind Pflicht
Jedes Reel braucht einen Grund, es jemandem zu schicken: „Schick das dem Kumpel, der seit Monaten nur Spiegel-Selfies hat.“

## Regeln aus Maiks Korrekturen (neue oben, mit Datum)
| Datum | Regel | Anlass |
|---|---|---|
| 24.10.2026 | Zwei getrennte Creative Directors: dieser nur für Dating. | „Vielleicht machen wir 2 Creative directors“ |
| 24.10.2026 | Insights laufen über Secret `AI` (Instagram-Login-Token, App „AI Made In Bielefeld“). | Token-Erneuerung |
| 23.10.2026 | Gute Fotos von Maik nie mit Negativ-Begriffen beschriften („Badezimmerspiegel“, „schlechtes Licht“) – positiv formulieren („Draußen statt Spiegel“). | Entwurf D1023c |
| 13.10.2026 | Angebot nur: 1 Stunde · ab 99 € · selber Tag · Münster · zahlen nur bei Zufriedenheit. | „50 € streichen“ |
