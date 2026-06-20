import os
IMG={k:f"https://thedentalcompany.de/wp-content/uploads/{v}" for k,v in {"h1":"2024/10/Frame-30.jpg","h2":"2024/10/Frame-31.jpg","h3":"2024/10/Frame-33.jpg","h4":"2024/10/Frame-34.jpg","h5":"2024/10/Frame-35.jpg","h6":"2024/10/Frame-36-1.jpg","zm":"2024/10/the-dental-company-zahnmedizin.jpg","za":"2024/10/the-dental-company-zahnaesthetik.jpg","ze":"2024/10/Rahmen-13.jpg","gz":"2024/10/the-dental-company-ganzheitliche-zahngesundheit.jpg","al":"2023/06/Thedentalcompany-Aligner-therapie.png","li":"2023/06/Thedentalcompany-lippenunterspritzung.png","bx":"2024/07/The-Dental-company-btox-bruxismus-behandlung.jpg","tm":"2023/10/The-Dental-Company-Team-1024x517.jpg","ap":"2023/10/Home_Termin_buchen_929x485.jpg","lw":"2022/06/Site_Logo_Meta_Weis_500-1.png"}.items()}

CSS="""
*{margin:0;padding:0;box-sizing:border-box}html{scroll-behavior:smooth;font-size:16px}
body{font-family:'Montserrat',sans-serif;background:#1A1D20;color:#F7F3EB;overflow-x:hidden;line-height:1.7}
h1,h2,h3,h4{font-family:'Cormorant Garamond',serif;font-weight:600;line-height:1.08;color:#F7F3EB}
a{color:inherit;text-decoration:none}img{max-width:100%;height:auto;display:block}
::selection{background:#C8A45C;color:#1A1D20}::-webkit-scrollbar{width:6px;background:#1A1D20}::-webkit-scrollbar-thumb{background:#C8A45C;border-radius:3px}
@keyframes goldPulse{0%,100%{box-shadow:0 0 15px rgba(200,164,92,0.3)}50%{box-shadow:0 0 35px rgba(200,164,92,0.6)}}
@keyframes lineGrow{from{width:0}to{width:80px}}
.container{max-width:1200px;margin:0 auto;padding:0 24px}
.gold-line{width:80px;height:2px;background:linear-gradient(90deg,#C8A45C,transparent);margin:20px 0 24px;animation:lineGrow 0.8s ease-out forwards}
.gold{color:#C8A45C}.section{padding:100px 0;position:relative}
.section-tag{font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#C8A45C;margin-bottom:8px}
.section-title{font-size:clamp(2rem,4vw,3.2rem);margin-bottom:16px}
.section-sub{color:rgba(247,243,235,0.65);font-size:15px;max-width:580px;font-weight:300}
.btn{display:inline-flex;align-items:center;gap:10px;padding:14px 32px;border-radius:50px;font-weight:600;font-size:13px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border:1px solid transparent;transition:all 0.4s ease}
.btn:hover{transform:translateY(-3px)}
.btn-gold{background:linear-gradient(135deg,#C8A45C,#A8893A);color:#1A1D20;box-shadow:0 8px 25px rgba(200,164,92,0.3)}
.btn-gold:hover{box-shadow:0 12px 35px rgba(200,164,92,0.5)}
.btn-outline{border:1px solid rgba(200,164,92,0.5);color:#C8A45C;background:transparent}
.btn-outline:hover{background:rgba(200,164,92,0.1);border-color:#C8A45C}
.btn-white{border:1px solid rgba(247,243,235,0.3);color:#F7F3EB;background:transparent}
.btn-white:hover{background:rgba(247,243,235,0.08)}
.fade-up{opacity:0;transform:translateY(30px);transition:opacity 0.8s ease,transform 0.8s ease}
.fade-up.visible{opacity:1;transform:translateY(0)}
.navbar{position:fixed;top:0;left:0;right:0;z-index:1000;padding:16px 0;transition:all 0.4s ease;background:transparent}
.navbar.scrolled{background:rgba(26,29,32,0.95);backdrop-filter:blur(20px);padding:10px 0;border-bottom:1px solid rgba(200,164,92,0.15)}
.nav-inner{display:flex;align-items:center;justify-content:space-between}
.nav-logo{display:flex;align-items:center}.logo-img{height:42px;width:auto}
.nav-links{display:flex;align-items:center;gap:32px}
.nav-links a{font-size:13px;font-weight:500;letter-spacing:1px;text-transform:uppercase;color:rgba(247,243,235,0.8);transition:color 0.3s;position:relative}
.nav-links a::after{content:'';position:absolute;bottom:-4px;left:0;width:0;height:1px;background:#C8A45C;transition:width 0.3s}
.nav-links a:hover{color:#C8A45C}.nav-links a:hover::after{width:100%}
.nav-cta{background:linear-gradient(135deg,#C8A45C,#A8893A);color:#1A1D20!important;padding:8px 20px!important;border-radius:50px;font-weight:600!important}
.nav-cta::after{display:none!important}
.nav-cta:hover{color:#1A1D20!important;box-shadow:0 4px 15px rgba(200,164,92,0.4)}
.nav-toggle{display:none;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;padding:4px}
.nav-toggle span{display:block;width:26px;height:2px;background:#C8A45C;transition:all 0.3s;border-radius:2px}
.nav-toggle.active span:nth-child(1){transform:rotate(45deg) translate(5px,5px)}
.nav-toggle.active span:nth-child(2){opacity:0}
.nav-toggle.active span:nth-child(3){transform:rotate(-45deg) translate(5px,-5px)}
@media(max-width:768px){
  .nav-links{position:fixed;top:0;right:-100%;width:280px;height:100vh;background:rgba(26,29,32,0.98);backdrop-filter:blur(20px);flex-direction:column;justify-content:center;gap:24px;transition:right 0.4s ease;border-left:1px solid rgba(200,164,92,0.2)}
  .nav-links.open{right:0}.nav-toggle{display:flex}.logo-img{height:32px}
}
.hero{position:relative;min-height:100vh;display:flex;align-items:center;overflow:hidden}
.hero-bg{position:absolute;inset:0;background:linear-gradient(160deg,#1A1D20 0%,#0F1113 40%,#1A1D20 100%)}
.hero-bg::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 70% 30%,rgba(200,164,92,0.08) 0%,transparent 60%),radial-gradient(ellipse at 30% 70%,rgba(30,58,95,0.12) 0%,transparent 50%);animation:heroGlow 8s ease-in-out infinite alternate}
@keyframes heroGlow{0%{opacity:0.5}100%{opacity:1}}
.hero-overlay{position:absolute;inset:0;background:url(H1_IMAGE) center/cover no-repeat;opacity:0.12;mix-blend-mode:overlay}
.hero-particles{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.hero-content{position:relative;z-index:2;max-width:720px;padding:120px 0 60px}
.hero-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 20px;border:1px solid rgba(200,164,92,0.3);border-radius:50px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C8A45C;margin-bottom:24px}
.hero-title{font-size:clamp(2.8rem,6vw,5rem);font-weight:700;letter-spacing:-0.02em;line-height:1;margin-bottom:16px}
.hero-title .gold{background:linear-gradient(135deg,#C8A45C,#D4B96A,#C8A45C);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero-sub{font-size:clamp(1rem,1.4vw,1.2rem);color:rgba(247,243,235,0.7);font-weight:300;max-width:540px;margin-bottom:32px;line-height:1.8}
.hero-actions{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:32px}
.hero-trust{display:flex;flex-wrap:wrap;align-items:center;gap:12px;font-size:13px;color:rgba(247,243,235,0.6)}
.hero-trust span:first-child{color:#C8A45C;letter-spacing:3px}
.trust-dot{opacity:0.3}
.hero-scroll-indicator{position:absolute;bottom:30px;left:50%;transform:translateX(-50%);z-index:2}
.hero-scroll-indicator span{display:block;width:20px;height:32px;border:2px solid rgba(200,164,92,0.3);border-radius:10px;position:relative}
.hero-scroll-indicator span::after{content:'';position:absolute;top:6px;left:50%;transform:translateX(-50%);width:3px;height:8px;background:#C8A45C;border-radius:2px;animation:scrollAnim 2s infinite}
@keyframes scrollAnim{0%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(12px)}}
@media(max-width:768px){
  .hero-content{padding:100px 0 40px}.hero-actions{flex-direction:column}.btn{width:100%;justify-content:center}
}
.smile-concierge{position:fixed;bottom:30px;right:30px;z-index:999;display:flex;align-items:center;gap:10px;padding:14px 24px;background:linear-gradient(135deg,#C8A45C,#A8893A);color:#1A1D20;border-radius:50px;font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;box-shadow:0 8px 30px rgba(200,164,92,0.4);cursor:pointer;transition:all 0.3s ease;border:none;animation:goldPulse 3s ease-in-out infinite}
.smile-concierge:hover{transform:translateY(-3px) scale(1.05);box-shadow:0 12px 40px rgba(200,164,92,0.6)}
.smile-concierge svg{flex:none}
@media(max-width:768px){
  .smile-concierge{bottom:20px;right:20px;padding:12px 18px;font-size:11px}.smile-concierge span{display:none}
}
#gold-particles{position:fixed;inset:0;pointer-events:none;z-index:1;overflow:hidden}
@media(max-width:768px){.section{padding:60px 0}.container{padding:0 16px}}
"""

HTML = '''
NAV
HERO
PHILOSOPHIE
LEISTUNGEN
TEAM
BEWERTUNGEN
KONTAKT
FOOTER
'''

def gen():
    return f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The Dental Company – Premium Zahnarztpraxis Bielefeld</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
<div id="gold-particles"></div>
TEST_PLACEHOLDER
<script>
document.getElementById("navToggle")?.addEventListener("click",function(){{this.classList.toggle("active");document.querySelector(".nav-links")?.classList.toggle("open")}});
window.addEventListener("scroll",function(){{document.querySelector(".navbar")?.classList.toggle("scrolled",window.scrollY>50)}},{{passive:true}});
const obs=new IntersectionObserver(e=>{{e.forEach(en=>{{if(en.isIntersecting){{en.target.classList.add("visible");obs.unobserve(en.target)}}}})}},{{threshold:0.1}});
document.querySelectorAll(".fade-up").forEach(el=>obs.observe(el));
(function(){{var c=document.getElementById("gold-particles");if(!c)return;for(var i=0;i<30;i++){{var p=document.createElement("div");p.style.cssText="position:absolute;width:"+(2+Math.random()*3)+"px;height:"+(2+Math.random()*3)+"px;background:#C8A45C;border-radius:50%;left:"+(Math.random()*100)+"%;top:"+(Math.random()*100)+"%;opacity:"+(0.1+Math.random()*0.3)+";animation:sparkle "+(3+Math.random()*5)+"s ease-in-out "+(Math.random()*5)+"s infinite";c.appendChild(p)}}})();
(function(){{var h=document.getElementById("heroParticles");if(!h)return;for(var i=0;i<20;i++){{var p=document.createElement("div");p.style.cssText="position:absolute;width:2px;height:"+(10+Math.random()*30)+"px;background:linear-gradient(to top,#C8A45C,transparent);left:"+(Math.random()*100)+"%;bottom:-30px;opacity:"+(0.1+Math.random()*0.3)+";animation:floatUp "+(6+Math.random()*8)+"s linear "+(Math.random()*6)+"s infinite";h.appendChild(p)}}}})();
var ks="floatUp";var sheet=document.createElement("style");sheet.textContent="@keyframes sparkle{0%,100%{opacity:0;transform:scale(0)}50%{opacity:0.8;transform:scale(1)}}@keyframes floatUp{0%{transform:translateY(0);opacity:0}10%{opacity:0.5}90%{opacity:0.3}100%{transform:translateY(-100vh);opacity:0}}";document.head.appendChild(sheet);
</script>
</body>
</html>"""

os.makedirs("docs/leads/zahnarzt-thedentalcompany", exist_ok=True)
with open("docs/leads/zahnarzt-thedentalcompany/index.html","w",encoding="utf-8") as f:
    f.write(gen().replace("H1_IMAGE",IMG["h1"]).replace("TEST_PLACEHOLDER",HTML))
print("DONE")
