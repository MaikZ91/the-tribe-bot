const https = require('https');

const site = process.argv[2] || 'thedentalcompany.de';

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json,*/*'
      },
      timeout: 20000,
      rejectUnauthorized: false
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let d = '';
      res.on('data', c => { d += c; if (d.length > 500000) res.destroy(); });
      res.on('end', () => resolve({ status: res.statusCode, data: d.slice(0, 200000), url }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  // Try multiple approaches
  const approaches = [
    `https://${site}/`,
    `https://${site}/wp-json/wp/v2/media?per_page=15`,
    `https://${site}/wp-content/uploads/`,
  ];

  for (const url of approaches) {
    try {
      console.log(`\n=== Trying: ${url} ===`);
      const { data, status } = await fetch(url);
      console.log(`Status: ${status}, Length: ${data.length}`);

      if (data.startsWith('[') || data.startsWith('{')) {
        try {
          const json = JSON.parse(data);
          if (Array.isArray(json)) {
            json.forEach(m => {
              const src = m.source_url || m.guid?.rendered || '';
              if (src) console.log(`IMG: ${src}`);
            });
          }
        } catch (e) { /* not JSON */ }
      }

      // Extract image URLs from HTML
      const imgs = [...data.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].slice(0, 20);
      if (imgs.length) {
        console.log(`Found ${imgs.length} images:`);
        imgs.forEach((m, i) => {
          let src = m[1];
          if (src.startsWith('//')) src = 'https:' + src;
          else if (src.startsWith('/')) src = `https://${site}` + src;
          console.log(`  ${i + 1}. ${src}`);
        });
      }
    } catch (e) {
      console.log(`Failed: ${e.message}`);
    }
  }
})();
