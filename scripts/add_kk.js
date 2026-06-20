const fs = require('fs');
let h = fs.readFileSync('docs/leads/dashboard/index.html', 'utf8');
const e = `
    {id:"berlin-gastronomie-kumpelundkeule",name:"Kumpel & Keule",industry:"Gastronomie",hebel:"niedrig",score:22,website:"https://www.kumpelundkeule.de",noweb:false,problems:["Squarespace-Website, okay aber austauschbar"],opps:["Bold Butcher-Branding","Bildergalerie","Online-Shop für Fleischpakete"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-kumpelundkeule/"},
    {id:"berlin-gastronomie-ottenthal",name:"Ottenthal — Wiener Küche",industry:"Gastronomie",hebel:"mittel",score:35,website:"https://www.ottenthal.com/",noweb:false,problems:["WordPress, nur Logo-Bild","Keine Food-Fotos","Design nüchtern"],opps:["Warmes Wien-Ambiente","Food-Fotografie","Baumkuchen-Storytelling"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-ottenthal/"},`;
h = h.replace('preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-rembrandt-burger/"},\n  ]', 'preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-rembrandt-burger/"},' + e + '\n  ]');
h = h.replace('"berlin-gastronomie-rembrandt-burger":"info@rembrandt-burger.de"};', '"berlin-gastronomie-rembrandt-burger":"info@rembrandt-burger.de",\n    "berlin-gastronomie-kumpelundkeule":"info@kumpelundkeule.de",\n    "berlin-gastronomie-ottenthal":"info@ottenthal.com"};');
fs.writeFileSync('docs/leads/dashboard/index.html', h);
console.log('+2 Berlin');
