const fs = require('fs');
const h = fs.readFileSync('docs/leads/dashboard/index.html', 'utf8');
const m = h.match(/var SEED=\[([\s\S]*?)\];/);
const ids = [...m[1].matchAll(/id:"([^"]+)"/g)].map(x => x[1]).filter(id => !id.startsWith('berlin-'));
ids.sort();
fs.writeFileSync('docs/leads/dashboard/done.json', JSON.stringify(ids, null, 2));
console.log(ids.length + ' done (only Bielefeld, Berlin excluded)');
