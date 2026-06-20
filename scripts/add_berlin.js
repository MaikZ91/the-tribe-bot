const fs = require('fs');
const file = 'docs/leads/dashboard/index.html';
let h = fs.readFileSync(file, 'utf8');

// Add 2 new entries before closing ]
const entries = `
    {id:"berlin-gastronomie-fleischerei",name:"Fleischerei — Restaurant · Bar · Grill",industry:"Gastronomie",hebel:"mittel",score:35,website:"https://fleischerei-berlin.com",noweb:false,problems:["Jimdo-Baukasten","Keine Online-Reservierung","Design austauschbar","Kaum echte Food-Fotos"],opps:["Modernes Steakhouse-Design","Online-Reservierung","Bildergalerie","Cocktail-Karte online"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-fleischerei/"},
    {id:"berlin-gastronomie-schneeweiss",name:"Schneeweiss — Alpenküche",industry:"Gastronomie",hebel:"mittel",score:40,website:"https://www.schneeweiss-berlin.de",noweb:false,problems:["JWWB-Baukasten (Jimdo)","Design könnte individueller sein","Keine Online-Reservierung direkt"],opps:["Modernes Alpen-Design","Online-Reservierung","Saisonale Speisekarte","Food-Fotografie"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-schneeweiss/"},`;

h = h.replace('preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/baeckerei-zeitfuerbrot/"},\n  ]', 'preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/baeckerei-zeitfuerbrot/"},' + entries + '\n  ]');

// Add emails
h = h.replace('"berlin-baeckerei-zeitfuerbrot":"info@zeitfuerbrot.com"};', '"berlin-baeckerei-zeitfuerbrot":"info@zeitfuerbrot.com",\n    "berlin-gastronomie-fleischerei":"info@fleischerei-berlin.com",\n    "berlin-gastronomie-schneeweiss":"info@schneeweiss-berlin.de"};');

fs.writeFileSync(file, h);
console.log('Dashboard: +2 Berlin leads');
