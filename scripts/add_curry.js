const fs = require('fs');
const file = 'docs/leads/dashboard/index.html';
let h = fs.readFileSync(file, 'utf8');

const entry = '\n    {id:"berlin-gastronomie-curry36",name:"Curry 36 — Original Berliner Currywurst",industry:"Gastronomie",hebel:"niedrig",score:30,website:"https://curry36.de/",noweb:false,problems:["WordPress-Theme austauschbar","Wenige Fotos"],opps:["Kult-Design","Currywurst-Konfigurator","Standort-Karte"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-curry36/"},';

h = h.replace('preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-schneeweiss/"},\n  ]', 'preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-schneeweiss/"},' + entry + '\n  ]');
h = h.replace('"berlin-gastronomie-schneeweiss":"info@schneeweiss-berlin.de"};', '"berlin-gastronomie-schneeweiss":"info@schneeweiss-berlin.de",\n    "berlin-gastronomie-curry36":"info@curry36.de"};');

fs.writeFileSync(file, h);
console.log('+Curry 36 to dashboard');
