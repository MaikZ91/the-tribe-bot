"""Fix updateDashboard() in daemon.js - replace lastIndexOf with anchored indexOf."""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAEMON = os.path.join(ROOT, 'scripts', 'daemon.js')

with open(DAEMON, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the updateDashboard function and replace it
old_func = '''function updateDashboard(lead, previewUrl) {
  if (!fs.existsSync(DASHBOARD_FILE)) return false;
  let h = fs.readFileSync(DASHBOARD_FILE, 'utf8');
  if (h.includes(`id:"${lead.id}"`)) { log('  \u2139\ufe0f  Bereits im Dashboard.'); return true; }
  const entry = `\\n    {id:"${lead.id}",name:"${lead.name}",industry:"${lead.industry}",hebel:"${lead.hebel||'mittel'}",score:${lead.score||50},website:"${lead.website}",problems:${JSON.stringify(lead.problems||['Veraltetes Design','Schwache CTA'])},opps:${JSON.stringify(lead.opps||['Modernes Design','Klare CTAs'])},preview:"${previewUrl}"},`;
  const pos = h.lastIndexOf('];');
  if (pos > 0) h = h.slice(0, pos) + entry + h.slice(pos);
  if (lead.email) {
    const ep = h.lastIndexOf('};');
    if (ep > 0 && !h.includes(`"${lead.id}":`)) {
      h = h.slice(0, ep) + `\\n    "${lead.id}":"${lead.email}",` + h.slice(ep);
    }
  }
  fs.writeFileSync(DASHBOARD_FILE, h);
  log('\U0001f4ca Dashboard aktualisiert.');
  return true;
}'''

new_func = '''function updateDashboard(lead, previewUrl) {
  if (!fs.existsSync(DASHBOARD_FILE)) return false;
  let h = fs.readFileSync(DASHBOARD_FILE, 'utf8');
  if (h.includes(`id:"${lead.id}"`)) { log('  \u2139\ufe0f  Bereits im Dashboard.'); return true; }

  // Insert into SEED array \u2014 find 'var SEED=[' then first '];' after it
  const seedStart = h.indexOf('var SEED=[');
  if (seedStart < 0) { log('  \u26a0\ufe0f  SEED-Marker nicht gefunden.'); return false; }
  const seedEnd = h.indexOf('];', seedStart);
  if (seedEnd < 0) { log('  \u26a0\ufe0f  SEED-Ende nicht gefunden.'); return false; }

  const entry = `\\n    {id:"${lead.id}",name:"${lead.name}",industry:"${lead.industry}",hebel:"${lead.hebel||'mittel'}",score:${lead.score||50},website:"${lead.website}",problems:${JSON.stringify(lead.problems||['Veraltetes Design','Schwache CTA'])},opps:${JSON.stringify(lead.opps||['Modernes Design','Klare CTAs'])},preview:"${previewUrl}"},`;
  h = h.slice(0, seedEnd) + entry + h.slice(seedEnd);

  // Insert into EMAILS object \u2014 find 'var EMAILS={' then first '};' after it
  if (lead.email) {
    const mailStart = h.indexOf('var EMAILS={');
    if (mailStart > 0) {
      const mailEnd = h.indexOf('};', mailStart);
      if (mailEnd > 0 && !h.includes(`"${lead.id}":`)) {
        h = h.slice(0, mailEnd) + `\\n    "${lead.id}":"${lead.email}",` + h.slice(mailEnd);
      }
    }
  }

  fs.writeFileSync(DASHBOARD_FILE, h);
  log('\U0001f4ca Dashboard aktualisiert.');
  return true;
}'''

if old_func in content:
    content = content.replace(old_func, new_func)
    print("Function replaced successfully")
else:
    print("ERROR: old function not found in daemon.js")
    # Try to find the section around updateDashboard
    idx = content.find('function updateDashboard')
    if idx >= 0:
        print(f"Found 'function updateDashboard' at char {idx}")
        print(content[idx:idx+200])

with open(DAEMON, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Written: {DAEMON}")
