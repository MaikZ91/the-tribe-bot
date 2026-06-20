const fs = require('fs');
let h = fs.readFileSync('docs/leads/dashboard/index.html', 'utf8');
const e = `
    {id:"berlin-gastronomie-dudu",name:"DUDU — Asian Fusion",industry:"Gastronomie",hebel:"mittel",score:40,website:"https://dudu-berlin.de/",noweb:false,problems:["WordPress 2018, nur Logo-Bilder","Keine Food-Fotos"],opps:["Minimalistisches Fusion-Design","Food-Fotografie"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-dudu/"},
    {id:"berlin-gastronomie-panama",name:"Panama — Restaurant & Bar",industry:"Gastronomie",hebel:"niedrig",score:28,website:"https://panama-berlin.de/",noweb:false,problems:["WordPress 2019, Foto-Galerie aber nüchternes Layout"],opps:["Design mit lateinamerikanischer Seele","Galerie modernisiert"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-panama/"},`;
h = h.replace('preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-ottenthal/"},\n  ]', 'preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-ottenthal/"},' + e + '\n  ]');
h = h.replace('"berlin-gastronomie-ottenthal":"info@ottenthal.com"};', '"berlin-gastronomie-ottenthal":"info@ottenthal.com",\n    "berlin-gastronomie-dudu":"info@dudu-berlin.de",\n    "berlin-gastronomie-panama":"info@panama-berlin.de"};');
fs.writeFileSync('docs/leads/dashboard/index.html', h);
console.log('+2 Berlin');
