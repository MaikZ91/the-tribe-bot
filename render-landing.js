const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const HTML_PATH = path.resolve(__dirname, 'Landing Pages', 'the-tribe-v2 (1).html');
const OUT = path.resolve(__dirname, 'landing-review');

const VIEWPORTS = [
    { name: 'mobile-iphone-se', width: 375, height: 667, deviceScaleFactor: 2, isMobile: true },
    { name: 'mobile-iphone-15', width: 393, height: 852, deviceScaleFactor: 3, isMobile: true },
    { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2 },
    { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 2 },
];

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
        for (const vp of VIEWPORTS) {
            const page = await browser.newPage();
            await page.setViewport(vp);
            await page.goto('file://' + HTML_PATH.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 30000 });
            await new Promise(r => setTimeout(r, 1500));
            const above = path.join(OUT, `${vp.name}-above-fold.png`);
            await page.screenshot({ path: above, fullPage: false });
            const full = path.join(OUT, `${vp.name}-full.png`);
            await page.screenshot({ path: full, fullPage: true });
            console.log(`${vp.name}: above=${above}, full=${full}`);
            await page.close();
        }
    } finally {
        await browser.close();
    }
})().catch(e => { console.error(e); process.exit(1); });
