const fs = require('fs');
let h = fs.readFileSync('docs/leads/dashboard/index.html', 'utf8');
h = h.replace('preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-panama/"},\n  ]', 'preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-panama/"},\n    {id:"berlin-gastronomie-kink",name:"KINK — Restaurant & Bar",industry:"Gastronomie",hebel:"niedrig",score:25,website:"https://www.kink-berlin.de",noweb:false,problems:["Kirby CMS, gutes Design aber austauschbar"],opps:["Edgy Restaurant-Branding","4 Fotos als Galerie"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-kink/"},\n  ]');
h = h.replace('"berlin-gastronomie-panama":"info@panama-berlin.de"};', '"berlin-gastronomie-panama":"info@panama-berlin.de",\n    "berlin-gastronomie-kink":"info@kink-berlin.de"};');
fs.writeFileSync('docs/leads/dashboard/index.html', h); console.log('+KINK');
