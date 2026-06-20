const s = require('./lead_agent_deepseek/sent.json');
const fs = require('fs');
const path = require('path');
const dirs = fs.readdirSync('docs/leads', {withFileTypes: true})
  .filter(d => d.isDirectory() && d.name !== 'dashboard');
const missing = [];
for (const d of dirs) {
  if (!s[d.name]) continue;
  const idx = path.join('docs/leads', d.name, 'index.html');
  let built = false;
  try { built = fs.statSync(idx).size > 2000; } catch {}
  if (!built) missing.push(d.name);
}
console.log(missing.length + ' Leads: Mail gesendet, Seite fehlt:');
missing.forEach(n => console.log(' -', n));
