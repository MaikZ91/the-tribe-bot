const fs = require('fs');
let h = fs.readFileSync('docs/leads/dashboard/index.html', 'utf8');
const e = '\n    {id:"berlin-gastronomie-standard-pizza",name:"STANDARD — Serious Pizza",industry:"Gastronomie",hebel:"niedrig",score:25,website:"https://www.standard-berlin.de",noweb:false,problems:["WordPress, gut aber austauschbar","Instagram-Placeholder"],opps:["Bold monochrome Branding","Standort-Hub"],preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-standard-pizza/"},';
h = h.replace('preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-curry36/"},\n  ]', 'preview:"https://maikz91.github.io/the-tribe-bot/leads/berlin/gastronomie-curry36/"},' + e + '\n  ]');
h = h.replace('"berlin-gastronomie-curry36":"info@curry36.de"};', '"berlin-gastronomie-curry36":"info@curry36.de",\n    "berlin-gastronomie-standard-pizza":"info@standard-berlin.de"};');
fs.writeFileSync('docs/leads/dashboard/index.html', h);
console.log('+Standard to dashboard');
