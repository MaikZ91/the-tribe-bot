const fs = require('fs');
const file = 'docs/leads/dashboard/index.html';
let h = fs.readFileSync(file, 'utf8');

// Berlin SEED entries (insert before closing ])
const berlinSEED = `
    {id:"berlin-gastronomie-dicke-wirtin",name:"Dicke Wirtin",industry:"Gastronomie",hebel:"hoch",score:40,website:"https://dicke-wirtin.de/",noweb:false,problems:["WordPress-Theme von 2018","Wenig echte Food-Fotos","Keine Online-Reservierung","Design nicht zeitgemäß"],opps:["Modernes, warmes Restaurant-Design","Online-Reservierung","Echte Food-Fotografie","Google-Bewertungen prominent"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-dicke-wirtin/"},
    {id:"berlin-gastronomie-henne",name:"Henne — Brathähnchen seit 1908",industry:"Gastronomie",hebel:"hoch",score:20,website:"https://www.henne-berlin.de",noweb:false,problems:["Einfaches Website-Builder-Template","Keine echten Food-Fotos","Viele Blank-Placeholder-Bilder","Keine Online-Reservierung"],opps:["Kult-Design mit Geschichte","Online-Reservierung","Echte Food-Fotografie","JFK-Storytelling"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-henne/"},
    {id:"berlin-baeckerei-siebert",name:"Bäckerei Siebert (seit 1906)",industry:"Bäckerei",hebel:"hoch",score:35,website:"https://baeckerei-siebert.de",noweb:false,problems:["Strato/CM4all-Baukasten","Design nicht zeitgemäß","Komplexe Bild-URLs","Keine Online-Bestellung"],opps:["Modernes Backstuben-Design","Echte Brot-Fotos","Online-Vorbestellung","Storytelling: älteste Bäckerei Berlins"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/baeckerei-siebert/"},
    {id:"berlin-gastronomie-marjellchen",name:"Marjellchen — Deutsche Taverne",industry:"Gastronomie",hebel:"mittel",score:45,website:"https://www.marjellchen-berlin.de/",noweb:false,problems:["WordPress mit vielen Werbe-Logos","Wenig echte Restaurant-Fotos","Keine Online-Reservierung","Design austauschbar"],opps:["Modernes Tavernen-Design","Online-Reservierung","Echte Ambiente-Fotos","Regionale Küche hervorheben"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-marjellchen/"},
    {id:"berlin-gastronomie-maxundmoritz",name:"Max & Moritz — Kulturwirtshaus",industry:"Gastronomie",hebel:"hoch",score:30,website:"https://maxundmoritzberlin.de/",noweb:false,problems:["Einfaches WordPress-Theme","Nur Logo als Bild","Keine Event-Integration","Keine Online-Reservierung"],opps:["Kultur-Wirtshaus-Design","Online-Reservierung","Event-Kalender","Live-Musik hervorheben"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-maxundmoritz/"},
    {id:"berlin-gastronomie-cafe-einstein",name:"Café Einstein — Wiener Kaffeehaus",industry:"Gastronomie",hebel:"hoch",score:15,website:"https://www.cafe-einstein.de",noweb:false,problems:["Nur 7 KB HTML","Kein CMS","Keine Bilder","Kein Kontaktformular","Keine Speisekarte online"],opps:["Komplett neue Kaffeehaus-Website","Online-Speisekarte","Wiener Kaffeehaus-Design","Frühstückskarte online"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-cafe-einstein/"},
    {id:"berlin-baeckerei-zeitfuerbrot",name:"Zeit für Brot — Bioland-Bäckerei",industry:"Bäckerei",hebel:"mittel",score:40,website:"https://zeitfuerbrot.com",noweb:false,problems:["Gute Website — nur Konzept-Vorschau zur Inspiration","Bioland-Storytelling ausbaufähig"],opps:["Bioland-Handwerk hervorheben","Backstuben-Galerie","Online-Bestellung","Storytelling"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/baeckerei-zeitfuerbrot/"},`;

// Insert before closing ] of SEED array
h = h.replace('{id:"physio-rusert"', '{id:"physio-rusert"');
h = h.replace('preview:"https://maikz91.github.io/the-tribe-bot/leads/physio-rusert/"}\n  ]', 'preview:"https://maikz91.github.io/the-tribe-bot/leads/physio-rusert/"},' + berlinSEED + '\n  ]');

// Add Berlin emails
h = h.replace('"physio-rusert":"info@praxis-rusert.de"};', '"physio-rusert":"info@praxis-rusert.de",\n    "berlin-gastronomie-dicke-wirtin":"info@dicke-wirtin.de",\n    "berlin-gastronomie-henne":"info@henne-berlin.de",\n    "berlin-baeckerei-siebert":"info@baeckerei-siebert.de",\n    "berlin-gastronomie-marjellchen":"info@marjellchen-berlin.de",\n    "berlin-gastronomie-maxundmoritz":"info@maxundmoritzberlin.de",\n    "berlin-gastronomie-cafe-einstein":"info@cafe-einstein.de",\n    "berlin-baeckerei-zeitfuerbrot":"info@zeitfuerbrot.com"};');

fs.writeFileSync(file, h);
console.log('Dashboard updated with 7 Berlin leads.');
