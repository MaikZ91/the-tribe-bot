"""Add web discovery to daemon.js — autonomous lead finding."""
import os

DAEMON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'scripts', 'daemon.js')

with open(DAEMON, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add http/https requires
content = content.replace(
    "const fs = require('fs');\nconst path = require('path');",
    "const fs = require('fs');\nconst path = require('path');\nconst https = require('https');\nconst http = require('http');"
)

# 2. Update header comment
old_header = " * Queue leer → DISCOVERY_NEEDED.txt → DeepSeek Agent füllt auf."
new_header = " * Queue leer → sucht SELBSTSTÄNDIG neue Leads via DuckDuckGo."
content = content.replace(old_header, new_header)

# Add auto-discovery note
old_intro = " * Interval konfigurierbar via INTERVAL_MINUTES (env) oder --interval=<min>\n */"
new_intro = " * Interval konfigurierbar via INTERVAL_MINUTES (env) oder --interval=<min>\n * Auto-Discovery: DISCOVER=true (env) aktiviert automatische Websuche\n */"
content = content.replace(old_intro, new_intro)

# 3. Add SEARCH_TERMS after COLORS
search_terms = """
// Suchbegriffe für Auto-Discovery
const SEARCH_TERMS = [
  'Friseur Bielefeld', 'Zahnarzt Bielefeld', 'Steuerberater Bielefeld',
  'Maler Bielefeld', 'Dachdecker Bielefeld', 'Elektriker Bielefeld',
  'Tischler Bielefeld', 'Restaurant Bielefeld', 'Fotograf Bielefeld',
  'Kosmetikstudio Bielefeld', 'Massage Bielefeld', 'Physiotherapie Bielefeld',
  'Bäcker Bielefeld', 'Goldschmied Bielefeld', 'Hundesalon Bielefeld',
];
"""
content = content.replace("const COLORS = {", search_terms + "\nconst COLORS = {")

# 4. Add discovery functions before autoFillFromDiscoveries
discovery_funcs = """
// ─── Web Discovery (DuckDuckGo Scraping) ──────────────────────────
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 15000, headers: { 'User-Agent': 'MZ9-LeadAgent/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => { data += c; if (data.length > 200000) { res.destroy(); resolve({ status: res.statusCode, html: data.slice(0, 100000), url }); } });
      res.on('end', () => resolve({ status: res.statusCode, html: data.slice(0, 100000), url }));
    }).on('error', reject).on('timeout', () => { this.destroy(); reject(new Error('timeout')); });
  });
}

function evaluateWebsite(html, url) {
  let score = 100;
  const problems = [], opps = [];
  if (!url.startsWith('https')) { score -= 20; problems.push('Kein HTTPS'); opps.push('SSL/HTTPS einrichten'); }
  if (!html.includes('viewport')) { score -= 15; problems.push('Nicht mobil-optimiert'); opps.push('Responsive Design'); }
  if (!/<form/i.test(html)) { score -= 10; problems.push('Kein Kontaktformular'); opps.push('Kontaktformular integrieren'); }
  if (html.includes('IONOS MyWebsite') || html.includes('website-start.de')) { score -= 10; problems.push('Veralteter Website-Baukasten'); opps.push('Moderne CMS-Plattform'); }
  if ((html.match(/<img/gi) || []).length < 2) { score -= 5; problems.push('Wenig Bilder'); opps.push('Bildergalerie aufbauen'); }
  return { score: Math.max(0, Math.round(score * 0.7 + 30)), problems: problems.slice(0, 4), opps: opps.slice(0, 4) };
}

function extractContact(html) {
  const email = (html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}/i) || [''])[0];
  const phone = (html.match(/(?:\\+49\\s?)?(?:05[0-9]{2,3}\\s?[\\/\\-\\s]?\\s?[0-9]{2,8})/) || [''])[0];
  return { email, phone };
}

function extractMeta(html) {
  const title = (html.match(/<title>([^<]+)<\\/title>/i) || ['',''])[1];
  const desc = (html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) || ['',''])[1];
  return { title, desc };
}

function guessIndustry(title, url) {
  const t = (title + ' ' + url).toLowerCase();
  if (/friseur|hair|salon/i.test(t)) return 'Friseur';
  if (/zahnarzt|zahn/i.test(t)) return 'Zahnarzt';
  if (/steuerberat|kanzlei/i.test(t)) return 'Kanzlei';
  if (/physio|therapie/i.test(t)) return 'Physiotherapie';
  if (/maler|dachdeck|elektro|tischler|schreiner/i.test(t)) return 'Handwerk';
  if (/restaurant|café|cafe|imbiss|bäck|bäcker|konditor/i.test(t)) return 'Gastronomie';
  if (/fotograf/i.test(t)) return 'Dienstleistung';
  if (/kosmetik/i.test(t)) return 'Kosmetik';
  if (/massage/i.test(t)) return 'Dienstleistung';
  if (/auto|kfz|werkstatt|reifen/i.test(t)) return 'Automotive';
  if (/blumen|florist/i.test(t)) return 'Florist';
  if (/immobilien/i.test(t)) return 'Immobilien';
  return 'Dienstleistung';
}

async function discoverOnline() {
  const term = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
  log(`🔍 Auto-Discovery: "${term}"`);
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(term)}+website`;
  try {
    const { html } = await fetchUrl(url);
    const links = [...html.matchAll(/<a[^>]+href="(https?:\\/\\/[^"]+)"[^>]*>([^<]+)<\\/a>/gi)];
    const results = [];
    const seen = new Set();
    for (const [, link, text] of links) {
      if (seen.has(link) || link.includes('duckduckgo') || link.includes('google.') || link.includes('facebook') || link.includes('instagram')) continue;
      seen.add(link);
      try { const domain = new URL(link).hostname.replace('www.', ''); if (domain.split('.').length <= 3) results.push({ url: link, name: text.replace(/<\\/?[^>]+>/g, '').trim(), domain }); } catch {}
      if (results.length >= 5) break;
    }
    log(`  ${results.length} Websites gefunden.`);
    return results;
  } catch (e) { log(`  Fehler: ${e.message}`); return []; }
}

"""

content = content.replace("// ─── Phase 2: Auto-Discovery aus Backlog ─────────────────────────", discovery_funcs + "// ─── Phase 2: Auto-Discovery aus Backlog ─────────────────────────")

# 5. Replace autoFillFromDiscoveries to try web discovery when files are empty
old_auto = """  if (files.length === 0) {
    const branches = queue?.settings?.discover_branches || ['Gastronomie', 'Handwerk'];
    fs.writeFileSync(DISCOVERY_FLAG,
      `Discovery needed at ${new Date().toISOString()}\\n` +
      `Branchen: ${branches.join(', ')}\\n` +
      `Region: ${queue?.settings?.discover_region || 'Bielefeld'}\\n`
    );
    log(`🚩 Vorrat leer. DISCOVERY_NEEDED.txt — DeepSeek muss auffüllen.`);
    log(`   Branchen: ${branches.join(', ')}`);
    return false;
  }"""

new_auto = """  if (files.length === 0) {
    // Keine Batch-Dateien — versuche Online-Discovery
    log('🚩 Vorrat leer — starte automatische Websuche...');
    try {
      const discovered = await discoverOnline();
      if (discovered.length > 0) {
        const leads = [];
        for (const r of discovered) {
          try {
            const { html } = await fetchUrl(r.url);
            if (!html) continue;
            const ev = evaluateWebsite(html, r.url);
            const contact = extractContact(html);
            const meta = extractMeta(html);
            const name = meta.title?.split(/[–\\-\\|]/)[0]?.trim() || r.name;
            const industry = guessIndustry(meta.title, r.url);
            leads.push({
              id: r.domain.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 50),
              name, nameShort: name.split(' ').slice(0, 2).join(' '),
              industry, hebel: ev.score < 45 ? 'hoch' : ev.score < 60 ? 'mittel' : 'niedrig',
              website: r.url, phone: contact.phone || '+495210000000',
              email: contact.email || `info@${r.domain}`, score: ev.score,
              problems: ev.problems, opps: ev.opps,
              heroH1: `${name.split(' ').pop()}.<br><em>${industry} in Bielefeld.</em>`,
              heroSub: meta.desc || `${industry} mit Qualität und Erfahrung.`,
              ctaText: 'Jetzt anfragen', features: [ev.opps[0] || 'Professionell', ev.opps[1] || 'Zuverlässig', ev.opps[2] || 'Erfahren'],
            });
          } catch (e) { /* skip */ }
        }
        if (leads.length > 0) {
          leads.sort((a, b) => a.score - b.score);
          queue.leads = leads.slice(0, 3);
          saveJson(QUEUE_FILE, queue);
          log(`  ✅ ${Math.min(3, leads.length)} neue Leads in Queue.`);
          return true;
        }
      }
    } catch (e) { log(`  ⚠️  Discovery-Fehler: ${e.message}`); }
    log('  Keine neuen Leads gefunden. Versuche es beim nächsten Tick erneut.');
    return false;
  }"""

content = content.replace(old_auto, new_auto)

# 6. Make autoFillFromDiscoveries async
content = content.replace(
    "function autoFillFromDiscoveries(queue) {",
    "async function autoFillFromDiscoveries(queue) {"
)

# 7. Make tick async-aware
content = content.replace(
    "    const filled = autoFillFromDiscoveries(queue);",
    "    const filled = await autoFillFromDiscoveries(queue);"
)

with open(DAEMON, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Daemon updated: {DAEMON}")
print("Added: web discovery, http/https, SEARCH_TERMS, auto-fill from DuckDuckGo")
