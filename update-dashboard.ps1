$file = 'C:\Users\Maik Zschach\the-tribe\docs\leads\dashboard\index.html'
$content = Get-Content $file -Raw

# 1. SEED entries — insert after hamburg-bk-hairstyle
$oldSeedPattern = [regex]::Escape('preview:"https://maikz91.github.io/the-tribe-bot/leads/hamburg-bk-hairstyle/"},')
$newSeedInsert = 'preview:"https://maikz91.github.io/the-tribe-bot/leads/hamburg-bk-hairstyle/"},' + "`n" +
'    {id:"link-gmbh-heizung",name:"LINK GmbH – Wärme & Wasser",industry:"Heizung",hebel:"hoch",score:15,website:"http://linkheizung.de/",problems:["Nur HTTP, kein HTTPS","Kein Responsive Design","Kein Kontaktformular","t-online.de E-Mail statt Firmen-Domain","Statisches HTML, kein CMS"],opps:["Moderne Website mit HTTPS","Responsive Design fuer alle Geraete","Kontaktformular und Online-Angebotsanfrage","Professionelle Firmen-E-Mail-Adresse"],preview:"https://maikz91.github.io/the-tribe-bot/leads/link-gmbh-heizung/"},' + "`n" +
'    {id:"fahrschule-bielefeld",name:"Fahrschule Bielefeld",industry:"Fahrschule",hebel:"hoch",score:15,website:"http://bielefeld-fahrschule.de/",problems:["Nur HTTP","Plain HTML, kein CMS","Kein Responsive Design","Kein Kontaktformular","Keine Online-Anmeldung"],opps:["Moderne responsive Website","Online-Anmeldeformular","Google-Bewertungen einbinden","Fuehrerscheinklassen mit Preisen online"],preview:"https://maikz91.github.io/the-tribe-bot/leads/fahrschule-bielefeld/"},' + "`n" +
'    {id:"heizungsbau-sonntag",name:"Heizungsbau Michael Sonntag",industry:"Sanitaer",hebel:"hoch",score:45,website:"https://www.heizungsbau-sonntag.com/",problems:["IONOS Baukasten-Template","Kein Viewport-Tag, nicht mobil optimiert","Kein Kontaktformular auf Startseite","Keine Kundenbewertungen"],opps:["Individuelles Handwerker-Design","Responsive mobile Website","Kontaktformular und Notdienst-CTA","Referenzprojekte und Bewertungen einbinden"],preview:"https://maikz91.github.io/the-tribe-bot/leads/heizungsbau-sonntag/"},' + "`n" +
'    {id:"elsner-sanitaer",name:"Andreas Elsner - Sanitaer & Heizung",industry:"Sanitaer",hebel:"hoch",score:50,website:"https://www.elsner-kassel.de/",problems:["Strato Baukasten-Template","Kein Kontaktformular auf Startseite","Design nicht zeitgemaess","Keine Kundenbewertungen sichtbar"],opps:["Individuelles, warmes Handwerker-Design","Online-Angebotsanfrage mit Kontaktformular","Referenzprojekte mit Bildern","Google-Bewertungen einbinden"],preview:"https://maikz91.github.io/the-tribe-bot/leads/elsner-sanitaer/"},' + "`n" +
'    {id:"gessner-sohn",name:"Gessner & Sohn - Heizungsbau & Sanitaer",industry:"Sanitaer",hebel:"mittel",score:70,website:"https://www.gessner-und-sohn.de/",problems:["Duda Baukasten-Template","Austauschbares Standard-Design","Keine sichtbaren Kundenbewertungen"],opps:["Individuelles, modernes Handwerks-Design","Google-Bewertungen prominent einbinden","SEO-optimierte Website","Referenzprojekte mit Bildern"],preview:"https://maikz91.github.io/the-tribe-bot/leads/gessner-sohn/"},' + "`n" +
'    {id:"are-ausbau",name:"ARE Ausbau GmbH",industry:"Heizung",hebel:"mittel",score:65,website:"https://www.are-ausbau.de/",problems:["WordPress Elementor Standard-Template","Einfaches, generisches Webdesign","Keine sichtbaren Bewertungen"],opps:["Markantes, individuelles Branding","Referenzprojekte mit Status-Badges","Google-Bewertungen einbinden","Online-Projektanfrage-Formular"],preview:"https://maikz91.github.io/the-tribe-bot/leads/are-ausbau/"},'

if ($content -match $oldSeedPattern) {
    $content = $content -replace $oldSeedPattern, $newSeedInsert
    Write-Host "SEED: 6 entries added"
} else {
    Write-Host "SEED: FAIL"
}

# 2. EMAILS entries
$oldEmailPattern = [regex]::Escape('"kosmetik-your-beauty-care":"info@your-beauty-care.de"')
$newEmailInsert = '"kosmetik-your-beauty-care":"info@your-beauty-care.de",' + "`n" +
'    "link-gmbh-heizung":"linkheizunggmbh@t-online.de",' + "`n" +
'    "fahrschule-bielefeld":"info@bielefeld-fahrschule.de",' + "`n" +
'    "heizungsbau-sonntag":"info@heizungsbau-sonntag.com",' + "`n" +
'    "elsner-sanitaer":"info@elsner-kassel.de",' + "`n" +
'    "gessner-sohn":"info@gessner-und-sohn.de",' + "`n" +
'    "are-ausbau":"info@are-ausbau.de"'

if ($content -match $oldEmailPattern) {
    $content = $content -replace $oldEmailPattern, $newEmailInsert
    Write-Host "EMAILS: 6 entries added"
} else {
    Write-Host "EMAILS: FAIL"
}

Set-Content -Path $file -Value $content -NoNewline
Write-Host "Dashboard saved"