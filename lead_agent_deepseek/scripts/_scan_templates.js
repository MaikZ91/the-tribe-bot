const fs = require('fs');
const path = require('path');

const dir = 'docs/leads';
const dirs = fs.readdirSync(dir).filter(d => {
  try { return fs.statSync(path.join(dir, d)).isDirectory(); } catch { return false; }
});

let tpl = 0, custom = 0;
const templateLeads = [];

dirs.forEach(d => {
  const f = path.join(dir, d, 'index.html');
  if (!fs.existsSync(f)) return;
  const c = fs.readFileSync(f, 'utf8');
  const isTemplate = c.includes('Platzhalter:') || 
                     c.includes('MZ.9 Lead Agent — Preview Template') ||
                     c.includes('.actionbar') ||
                     c.includes('.ribbon{') ||
                     c.includes('--char:#1A1518');
  if (isTemplate) {
    tpl++;
    templateLeads.push(d);
  } else {
    custom++;
  }
});

console.log('=== TEMPLATE PAGES (' + tpl + ') ===');
templateLeads.forEach(d => console.log('  ' + d));
console.log('\nTemplate: ' + tpl + ' | Custom: ' + custom + ' | Total: ' + (tpl + custom));
