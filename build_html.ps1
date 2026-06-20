$out = "docs/leads/zahnarzt-thedentalcompany/index.html"

# HEAD section
$html = @"
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Dental Company — Zahnarztpraxis Bielefeld | Premium Zahnmedizin auf höchstem Niveau</title>
<meta name="description" content="The Dental Company – Ihre Zahnarztpraxis in Bielefeld. Moderne Zahnmedizin, Ästhetik & Prophylaxe auf höchstem Niveau.">
<meta name="theme-color" content="#1A1D20">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--charcoal:#1A1D20;--gold:#C8A45C;--cream:#F7F3EB;--sapphire:#1E3A5F}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:Montserrat,sans-serif;background:var(--charcoal);color:var(--cream);overflow-x:hidden;-webkit-font-smoothing:antialiased;line-height:1.7}
a{color:inherit;text-decoration:none}img{max-width:100%;display:block;height:auto}
h1,h2,h3,h4{font-family:Cormorant Garamond,Georgia,serif;font-weight:600;line-height:1.1;color:var(--cream)}
::selection{background:var(--gold);color:var(--charcoal)}
::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:var(--charcoal)}::-webkit-scrollbar-thumb{background:var(--gold);border-radius:4px}
.container{max-width:1200px;margin:0 auto;padding:0 24px}
section{padding:100px 0;position:relative}
.gold-text{background:linear-gradient(135deg,#C8A45C,#E8D5A3,#C8A45C);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.gold-divider{width:80px;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);margin:24px auto}
.gold-line{width:60px;height:2px;background:var(--gold);margin:16px 0}
.btn-gold{display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#C8A45C,#B8963E);color:var(--charcoal);font-weight:600;font-size:14px;border:none;border-radius:50px;cursor:pointer;transition:all .3s ease;text-transform:uppercase;letter-spacing:1px}
.btn-gold:hover{transform:translateY(-3px);box-shadow:0 10px 30px rgba(200,164,92,.3)}
.btn-outline{display:inline-block;padding:14px 36px;border:2px solid var(--gold);color:var(--gold);font-weight:600;font-size:14px;border-radius:50px;cursor:pointer;transition:all .3s ease;background:transparent;text-transform:uppercase;letter-spacing:1px}
.btn-outline:hover{background:var(--gold);color:var(--charcoal);transform:translateY(-3px)}
.section-title{font-size:clamp(2rem,5vw,3.25rem);text-align:center;margin-bottom:8px}
.section-sub{text-align:center;font-size:16px;color:rgba(247,243,235,.6);max-width:600px;margin:0 auto 48px;font-weight:300}
.fade-up{opacity:0;transform:translateY(40px);transition:all 1s cubic-bezier(.22,.61,.36,1)}
.fade-up.visible{opacity:1;transform:translateY(0)}
@media(max-width:768px){section{padding:60px 0!important}.container{padding:0 20px}}
@media(max-width:768px){.nav-links{display:none!important}.hamburger{display:flex!important}}
</style>
</head>
<body>
"@

# Write head
$html | Out-File -FilePath $out -Encoding utf8 -Force

# NAV section
@"
<!-- NAV -->
<nav id="navbar" style="position:fixed;top:0;left:0;right:0;z-index:1000;padding:16px 0;transition:all .4s ease;background:transparent">
<div class="container" style="display:flex;align-items:center;justify-content:space-between">
<a href="#hero"><img src="https://thedentalcompany.de/wp-content/uploads/2022/06/Site_Logo_Meta_Weis_500-1.png" alt="The Dental Company" style="height:40px"></a>
<div class="nav-links" style="display:flex;align-items:center;gap:32px">
<a href="#philosophie" style="font-size:14px;font-weight:500;letter-spacing:1px;text-transform:uppercase;padding-bottom:4px;border-bottom:2px solid transparent;transition:all .3s">Philosophie</a>
<a href="#leistungen" style="font-size:14px;font-weight:500;letter-spacing:1px;text-transform:uppercase;padding-bottom:4px;border-bottom:2px solid transparent;transition:all .3s">Leistungen</a>
<a href="#team" style="font-size:14px;font-weight:500;letter-spacing:1px;text-transform:uppercase;padding-bottom:4px;border-bottom:2px solid transparent;transition:all .3s">Team</a>
<a href="#bewertungen" style="font-size:14px;font-weight:500;letter-spacing:1px;text-transform:uppercase;padding-bottom:4px;border-bottom:2px solid transparent;transition:all .3s">Bewertungen</a>
<a href="#kontakt" style="font-size:14px;font-weight:500;letter-spacing:1px;text-transform:uppercase;padding-bottom:4px;border-bottom:2px solid transparent;transition:all .3s">Kontakt</a>
<a href="#kontakt" class="btn-gold" style="padding:10px 24px;font-size:12px">Termin</a>
</div>
<div class="hamburger" style="display:none;flex-direction:column;gap:5px;cursor:pointer;padding:5px" onclick="toggleMenu()">
<span style="display:block;width:28px;height:2px;background:var(--gold);transition:all .3s"></span>
<span style="display:block;width:28px;height:2px;background:var(--gold);transition:all .3s"></span>
<span style="display:block;width:28px;height:2px;background:var(--gold);transition:all .3s"></span>
</div>
</div>
</nav>
"@ | Out-File -FilePath $out -Encoding utf8 -Append

# HERO section
@"
<!-- HERO -->
<section id="hero" style="min-height:100vh;display:flex;align-items:center;background:linear-gradient(135deg,#1A1D20 0%,#0D1117 40%,#1E3A5F 100%);position:relative;padding-top:80px">
<div style="position:absolute;inset:0;opacity:0.2;background:url('https://thedentalcompany.de/wp-content/uploads/2024/10/Frame-30.jpg') center/cover no-repeat;z-index:0"></div>
<div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 50%,transparent 0%,rgba(26,29,32,0.9) 70%);z-index:1"></div>
<div class="container" style="position:relative;z-index:2;text-align:center">
<div class="fade-up"><span style="font-size:14px;letter-spacing:4px;text-transform:uppercase;color:var(--gold);font-weight:500">Zahnarztpraxis Bielefeld</span></div>
<h1 class="fade-up" style="font-size:clamp(2.5rem,8vw,5rem);margin:24px 0 16px;line-height:1.05"><span class="gold-text">Zahnmedizin auf h&#246;chstem Niveau</span></h1>
<p class="fade-up" style="font-size:clamp(1rem,2vw,1.25rem);color:rgba(247,243,235,0.7);max-width:600px;margin:0 auto 36px;font-weight:300">Moderne Zahnheilkunde mit h&#246;chstem Anspruch an &#196;sthetik, Qualit&#228;t und Ihre pers&#246;nliche Betreuung.</p>
<div class="fade-up" style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
<a href="#kontakt" class="btn-gold">Termin vereinbaren</a>
<a href="#leistungen" class="btn-outline">Unsere Leistungen</a>
</div>
</div>
</section>
"@ | Out-File -FilePath $out -Encoding utf8 -Append

# PHILOSOPHIE section
@"
<!-- PHILOSOPHIE -->
<section id="philosophie" style="padding:100px 0;background:var(--charcoal)">
<div class="container">
<div class="fade-up" style="text-align:center;margin-bottom:16px"><span style="font-size:13px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:var(--gold)">Unsere Philosophie</span></div>
<h2 class="fade-up section-title">Excellence in der Zahnmedizin</h2>
<div class="gold-divider"></div>
<div class="fade-up" style="display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;margin-top:48px">
<div>
<p style="font-size:18px;line-height:1.8;color:rgba(247,243,235,0.8);margin-bottom:20px"><strong style="color:var(--cream)">Zahnmedizin auf h&ouml;chstem Niveau</strong> &ndash; das ist unser Versprechen an Sie. In unserer Praxis vereinen wir moderne Zahnheilkunde mit einer ganzheitlichen Betrachtungsweise.</p>
<p style="font-size:18px;line-height:1.8;color:rgba(247,243,235,0.8);margin-bottom:20px">Wir legen gr&ouml;&szlig;ten Wert auf eine <strong style="color:var(--cream)">vertrauensvolle Arzt-Patienten-Beziehung</strong>, die auf Transparenz, Einf&uuml;hlungsverm&ouml;gen und medizinischer Kompetenz basiert.</p>
<p style="font-size:18px;line-height:1.8;color:rgba(247,243,235,0.8)">Unsere Praxis ist mit <strong style="color:var(--cream)">modernster Technologie</strong> ausgestattet: Von der digitalen Volumentomographie bis zum hochpr&auml;zisen CEREC-System.</p>
</div>
<div style="border-radius:16px;overflow:hidden;border:1px solid rgba(200,164,92,0.2)"><img src="https://thedentalcompany.de/wp-content/uploads/2024/10/the-dental-company-zahnmedizin.jpg" alt="Moderne Zahnmedizin" style="width:100%"></div>
</div>
</div>
</section>
<div style="width:120px;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);margin:0 auto"></div>
"@ | Out-File -FilePath $out -Encoding utf8 -Append

# LEISTUNGEN section
@"
<!-- LEISTUNGEN -->
<section id="leistungen" style="padding:100px 0;background:linear-gradient(180deg,var(--charcoal) 0%,#121418 100%)">
<div class="container">
<div class="fade-up" style="text-align:center;margin-bottom:16px"><span style="font-size:13px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:var(--gold)">Unser Angebot</span></div>
<h2 class="fade-up section-title">Leistungen auf Premium-Niveau</h2>
<div class="gold-divider"></div>
<p class="fade-up" style="text-align:center;font-size:16px;color:rgba(247,243,235,0.6);max-width:600px;margin:0 auto 48px;font-weight:300">Von der &Auml;sthetik bis zur Implantologie &ndash; wir bieten Ihnen das gesamte Spektrum moderner Zahnmedizin.</p>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:24px;margin-top:48px">
"@ | Out-File -FilePath $out -Encoding utf8 -Append

# Cards array
$cards = @(
    @{img="https://thedentalcompany.de/wp-content/uploads/2024/10/the-dental-company-zahnaesthetik.jpg";title="Zahn&auml;sthetik";desc="Bleaching, Veneers, Aligner, Lippenunterspritzung und Lip Flip f&uuml;r Ihr perfektes L&auml;cheln.";items=@("Bleaching &amp; Veneers","Aligner-Therapie","Lippenunterspritzung &amp; Lip Flip")}
    @{img="https://thedentalcompany.de/wp-content/uploads/2024/10/Rahmen-13.jpg";title="Zahnersatz &amp; Zahnerhaltung";desc="Hochwertiger Zahnersatz, professionelle Zahnreinigung und Parodontitis-Behandlung.";items=@("Professionelle Zahnreinigung","Parodontitis-Behandlung","Digitale Abformung")}
    @{img="https://thedentalcompany.de/wp-content/uploads/2024/10/the-dental-company-ganzheitliche-zahngesundheit.jpg";title="CEREC &amp; Spezialbereiche";desc="CEREC-Technik f&uuml;r Zahnersatz in einer Sitzung, Angstpatienten und Notdienst.";items=@("CEREC Labor (1 Sitzung)","Angstpatienten","Zahn&auml;rztlicher Notdienst")}
    @{img="https://thedentalcompany.de/wp-content/uploads/2023/06/Thedentalcompany-Aligner-therapie.png";title="Aligner-Therapie";desc="Unsichtbare Zahnkorrektur f&uuml;r ein gerades L&auml;cheln &ndash; diskret und effektiv.";items=@("Unsichtbare Schienen","Individuelle Pl&auml;ne")}
    @{img="https://thedentalcompany.de/wp-content/uploads/2023/06/Thedentalcompany-lippenunterspritzung.png";title="&Auml;sthetische Behandlungen";desc="Lippenunterspritzung und Lip Flip f&uuml;r nat&uuml;rlich vollere Lippen.";items=@("Lippenunterspritzung","Lip Flip")}
    @{img="https://thedentalcompany.de/wp-content/uploads/2023/10/Home_Termin_buchen_929x485.jpg";title="Ihr erster Besuch";desc="Vereinbaren Sie Ihren Termin &ndash; wir nehmen uns Zeit f&uuml;r Sie.";items=@();btn="Termin anfragen"}
)

foreach($c in $cards) {
    $cardHtml = @"
<div class="fade-up" style="background:linear-gradient(145deg,#22262A,#1A1D20);border-radius:16px;overflow:hidden;border:1px solid rgba(200,164,92,0.15)">
<div style="height:200px;overflow:hidden"><img src="$($c.img)" alt="$($c.title)" style="width:100%;height:100%;object-fit:cover"></div>
<div style="padding:28px"><h3 style="font-size:24px;margin-bottom:12px;color:var(--cream)">$($c.title)</h3>
<div class="gold-line"></div>
<p style="color:rgba(247,243,235,0.7);font-size:15px;line-height:1.7;margin-bottom:16px">$($c.desc)</p>
"@
    if($c.items.Count -gt 0) {
        $cardHtml += "<ul style=`"list-style:none;color:rgba(247,243,235,0.6);font-size:14px`">`n"
        foreach($item in $c.items) {
            $cardHtml += "<li style=`"margin-bottom:6px;display:flex;align-items:center;gap:8px`"><span style=`"color:var(--gold)`">&#10022;</span> $item</li>`n"
        }
        $cardHtml += "</ul>`n"
    }
    if($c.btn) {
        $cardHtml += "<a href=`"#kontakt`" class=`"btn-gold`" style=`"display:inline-block;padding:10px 24px;font-size:12px`">$($c.btn)</a>`n"
    }
    $cardHtml += "</div></div>`n"
    $cardHtml | Out-File -FilePath $out -Encoding utf8 -Append
}

@"
</div></div></section>
<div style="width:120px;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);margin:0 auto"></div>
"@ | Out-File -FilePath $out -Encoding utf8 -Append

Write-Host "Phase 2 done"
