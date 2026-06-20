const fs = require('fs');
const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>Lechtermann-Pollmeier — Tradition seit 1901</title>
<meta name="description" content="Lechtermann-Pollmeier Bäckereien GmbH & Co. KG — Ihre Traditionsbäckerei seit 1901 in Bielefeld. Handwerkliche Backkunst."/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Amatic+SC:wght@400;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Raleway:wght@300;400;600;700&display=swap" rel="stylesheet"/>
</head>
<body>
<nav></nav>
<section id="hero">HERO_PLACEHOLDER</section>
<section id="about">ABOUT_PLACEHOLDER</section>
<section id="products">PRODUCTS_PLACEHOLDER</section>
<section id="locations">LOCATIONS_PLACEHOLDER</section>
<section id="reviews">REVIEWS_PLACEHOLDER</section>
<section id="contact">CONTACT_PLACEHOLDER</section>
<footer id="footer">FOOTER_PLACEHOLDER</footer>
</body>
</html>`;
fs.writeFileSync('docs/leads/baeckerei-lechtermann-pollmeier/index.html', html, 'utf8');
console.log('Written');