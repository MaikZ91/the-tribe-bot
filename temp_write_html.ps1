$html = @"
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Dental Company — Zahnarztpraxis Bielefeld | Premium Zahnmedizin auf höchstem Niveau</title>
<meta name="description" content="The Dental Company – Ihre Zahnarztpraxis in Bielefeld. Moderne Zahnmedizin, Ästhetik, Implantologie & Prophylaxe. Termin vereinbaren.">
<meta name="theme-color" content="#1A1D20">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Montserrat',sans-serif;background:#1A1D20;color:#F7F3EB;overflow-x:hidden;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}img{max-width:100%;display:block}
h1,h2,h3,h4{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;line-height:1.1}
::selection{background:#C8A45C;color:#1A1D20}
::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#1A1D20}::-webkit-scrollbar-thumb{background:#C8A45C;border-radius:4px}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px}
.gold-divider{width:80px;height:2px;background:linear-gradient(90deg,transparent,#C8A45C,transparent);margin:0 auto}
.gold-divider-wide{width:120px;height:2px;background:linear-gradient(90deg,transparent,#C8A45C,transparent);margin:40px auto 0}
</style>
</head>
<body>
<h1>Test</h1>
</body>
</html>
"@
$html | Out-File -FilePath docs/leads/zahnarzt-thedentalcompany/index.html -Encoding utf8 -Force
Write-Host "DONE"