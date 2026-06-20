const fs = require('fs');
let h = fs.readFileSync('docs/leads/dashboard/index.html', 'utf8');
const e = `
    {id:"berlin-gastronomie-facil",name:"FACIL — 2 Michelin-Sterne",industry:"Gastronomie",hebel:"niedrig",score:20,website:"https://facil.de/",noweb:false,problems:["ProcessWire CMS, individuell aber nüchtern","Mehr Food-Fotografie möglich"],opps:["Luxuriöses Fine-Dining-Design","Galerie mit Food-Fotos","Menü online"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-facil/"},
    {id:"berlin-gastronomie-rembrandt-burger",name:"Rembrandt Burger",industry:"Gastronomie",hebel:"hoch",score:45,website:"https://www.rembrandt-burger.de",noweb:false,problems:["WordPress von 2014","Nur Logo, keine Food-Fotos","Kein Online-Bestellsystem","Design veraltet"],opps:["Modernes Burger-Design","Food-Fotografie","Online-Bestellung","Weekly-Special-Banner"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-rembrandt-burger/"},`;
h = h.replace('preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-standard-pizza/"},\n  ]', 'preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-standard-pizza/"},' + e + '\n  ]');
h = h.replace('"berlin-gastronomie-standard-pizza":"info@standard-berlin.de"};', '"berlin-gastronomie-standard-pizza":"info@standard-berlin.de",\n    "berlin-gastronomie-facil":"info@facil.de",\n    "berlin-gastronomie-rembrandt-burger":"info@rembrandt-burger.de"};');
fs.writeFileSync('docs/leads/dashboard/index.html', h);
console.log('+2 Berlin leads to dashboard');
