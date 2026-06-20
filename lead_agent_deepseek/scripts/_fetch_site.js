const https = require('https');
const http = require('http');

const url = process.argv[2] || 'https://www.rancho-steakhouse.de/';

function fetch(u) {
  return new Promise((resolve, reject) => {
    const mod = u.startsWith('https') ? https : http;
    const req = mod.get(u, {headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}}, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location;
        const next = loc.startsWith('http') ? loc : (new URL(u)).origin + (loc.startsWith('/') ? '' : '/') + loc;
        return fetch(next).then(resolve).catch(reject);
      }
      let d = '';
      res.on('data', c => { d += c; if (d.length > 200000) { res.destroy(); } });
      res.on('end', () => resolve({ status: res.statusCode, html: d.slice(0, 150000), url: u }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  try {
    console.log(`Fetching: ${url}`);
    const { html, status, url: finalUrl } = await fetch(url);
    console.log(`STATUS: ${status}`);
    console.log(`FINAL_URL: ${finalUrl}`);
    console.log(`LENGTH: ${html.length}`);
    
    const title = html.match(/<title>([^<]+)<\/title>/i);
    if (title) console.log(`TITLE: ${title[1].trim()}`);
    
    const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if (desc) console.log(`DESC: ${desc[1].trim().substring(0, 300)}`);
    
    const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
    console.log(`\nIMAGES (${imgs.length}):`);
    const origin = new URL(finalUrl).origin;
    imgs.slice(0, 25).forEach((m, i) => {
      let src = m[1].trim();
      try {
        if (src.startsWith('//')) src = 'https:' + src;
        else if (src.startsWith('/')) src = origin + src;
        else if (!src.startsWith('http')) src = finalUrl.replace(/\/$/, '') + '/' + src.replace(/^\//, '');
        console.log(`  ${i+1}. ${src}`);
      } catch(e) {
        console.log(`  ${i+1}. [skipped: ${e.message}] ${m[1].substring(0,80)}`);
      }
    });

  } catch (e) {
    console.error(`ERROR: ${e.message}`);
  }
})();
