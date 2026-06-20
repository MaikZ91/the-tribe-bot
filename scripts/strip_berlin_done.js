const fs = require('fs');
const done = JSON.parse(fs.readFileSync('docs/leads/dashboard/done.json', 'utf8'));
const filtered = done.filter(id => !id.startsWith('berlin-'));
fs.writeFileSync('docs/leads/dashboard/done.json', JSON.stringify(filtered, null, 2));
console.log(filtered.length + ' done (removed ' + (done.length - filtered.length) + ' Berlin leads)');
