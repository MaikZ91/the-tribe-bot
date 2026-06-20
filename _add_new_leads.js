const fs = require('fs');

const newLeads = [
  {id:"anja-kelle-blumen",name:"Anja Kelle | Blumen & mehr",industry:"Florist",hebel:"hoch",score:36,website:"http://www.blumen-bielefeld.com/",problems:["HTTP only, kein HTTPS","Statisches HTML (~2018)","Keine echten Blumenfotos (nur Stock)","Kein Online-Shop"],opps:["SSL/HTTPS einrichten","Echte Produktfotos zeigen","Online-Bestellsystem","Moderne Website"],preview:"https://maikz91.github.io/the-tribe-bot/leads/anja-kelle-blumen/"},
  {id:"begemanns-blumengarten",name:"Begemanns Blumengarten",industry:"Florist",hebel:"mittel",score:42,website:"http://www.begemanns-blumengarten.de/",problems:["HTTP only","Metro-UI-Design (2015-Ära)","Langsam, viele alte Scripts","Ohne HTTPS kein Vertrauen"],opps:["Moderne, schnelle Website","SSL einrichten","Blumenabo online buchbar","Responsive Bildergalerie"],preview:"https://maikz91.github.io/the-tribe-bot/leads/begemanns-blumengarten/"},
  {id:"pizzeriasalvatore",name:"Pizzeria da Salvatore",industry:"Gastronomie",hebel:"hoch",score:30,website:"https://www.pizzeriadasalvatore.de/",problems:["Nur Plain-Text, keine Inhalte","Keine Speisekarte online","Keine Bilder","Keine Online-Reservierung"],opps:["Komplette Website mit Speisekarte","Online-Reservierung","Foto-Galerie","Google-Bewertungen einbinden"],preview:"https://maikz91.github.io/the-tribe-bot/leads/pizzeriasalvatore/"},
  {id:"maler-dreier",name:"Malerfachbetrieb Dreier",industry:"Handwerk",hebel:"mittel",score:48,website:"https://www.malerfachbetrieb-dreier.de/",problems:["Veralteter Website-Baukasten","Massives Inline-CSS","Nicht responsive optimiert","Design nicht zeitgemäß"],opps:["Modernes Handwerker-Design","Responsive Website","Referenz-Galerie modern","Online-Angebotsrechner"],preview:"https://maikz91.github.io/the-tribe-bot/leads/maler-dreier/"}
];

const dashPath = 'docs/leads/dashboard/index.html';
let html = fs.readFileSync(dashPath, 'utf8');

// Find the SEED closing bracket: the line "  ]" right before the EMAILS comment
const seedClose = html.indexOf('\n  ]\n\n  /* ---- echte Kontakt');
const seedClose2 = html.indexOf('\r\n  ]\r\n\r\n  /* ---- echte Kontakt');
const marker = seedClose > 0 ? seedClose : seedClose2;
if (marker < 0) { console.log('ERROR: seed end not found'); process.exit(1); }

const insertPoint = marker + (seedClose > 0 ? 3 : 5); // after \n  ] or \r\n  ]

const entries = newLeads.map(l => 
  `    {id:"${l.id}",name:"${l.name}",industry:"${l.industry}",hebel:"${l.hebel}",score:${l.score},website:"${l.website}",problems:${JSON.stringify(l.problems)},opps:${JSON.stringify(l.opps)},preview:"${l.preview}"}`
).join(',\n');

html = html.slice(0, insertPoint) + ',\n' + entries + html.slice(insertPoint);

// Add emails
const emailClose = html.indexOf('\n  };\n\n  var built');
const emailClose2 = html.indexOf('\r\n  };\r\n\r\n  var built');
const emailMarker = emailClose > 0 ? emailClose : emailClose2;
if (emailMarker > 0) {
  const emailInsert = emailMarker + (emailClose > 0 ? 6 : 8); // after \n  }; or \r\n  };
  const newEmails = [
    '    "anja-kelle-blumen":"anja.kelle@web.de",',
    '    "begemanns-blumengarten":"info@begemanns-blumengarten.de",',
    '    "pizzeriasalvatore":"info@pizzeriadasalvatore.de",',
    '    "maler-dreier":"malerfachbetriebdreier@t-online.de",'
  ].join('\n');
  html = html.slice(0, emailInsert) + '\n' + newEmails + html.slice(emailInsert);
}

fs.writeFileSync(dashPath, html);
const v = fs.readFileSync(dashPath, 'utf8');
const count = (v.match(/\{id:"/g) || []).length;
console.log('Dashboard: ' + count + ' entries (was 60, expect 64)');
