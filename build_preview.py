#!/usr/bin/env python3
"""Generate the complete premium dental company preview HTML."""
import os

IMG = {
    "h1": "https://thedentalcompany.de/wp-content/uploads/2024/10/Frame-30.jpg",
    "h2": "https://thedentalcompany.de/wp-content/uploads/2024/10/Frame-31.jpg",
    "h3": "https://thedentalcompany.de/wp-content/uploads/2024/10/Frame-33.jpg",
    "h4": "https://thedentalcompany.de/wp-content/uploads/2024/10/Frame-34.jpg",
    "h5": "https://thedentalcompany.de/wp-content/uploads/2024/10/Frame-35.jpg",
    "h6": "https://thedentalcompany.de/wp-content/uploads/2024/10/Frame-36-1.jpg",
    "zm": "https://thedentalcompany.de/wp-content/uploads/2024/10/the-dental-company-zahnmedizin.jpg",
    "za": "https://thedentalcompany.de/wp-content/uploads/2024/10/the-dental-company-zahnaesthetik.jpg",
    "ze": "https://thedentalcompany.de/wp-content/uploads/2024/10/Rahmen-13.jpg",
    "gz": "https://thedentalcompany.de/wp-content/uploads/2024/10/the-dental-company-ganzheitliche-zahngesundheit.jpg",
    "al": "https://thedentalcompany.de/wp-content/uploads/2023/06/Thedentalcompany-Aligner-therapie.png",
    "li": "https://thedentalcompany.de/wp-content/uploads/2023/06/Thedentalcompany-lippenunterspritzung.png",
    "bx": "https://thedentalcompany.de/wp-content/uploads/2024/07/The-Dental-company-btox-bruxismus-behandlung.jpg",
    "tm": "https://thedentalcompany.de/wp-content/uploads/2023/10/The-Dental-Company-Team-1024x517.jpg",
    "ap": "https://thedentalcompany.de/wp-content/uploads/2023/10/Home_Termin_buchen_929x485.jpg",
    "lw": "https://thedentalcompany.de/wp-content/uploads/2022/06/Site_Logo_Meta_Weis_500-1.png",
}

CSS = '''
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;font-size:16px}
body{font-family:'Montserrat',sans-serif;background:#1A1D20;color:#F7F3EB;overflow-x:hidden;line-height:1.7}
h1,h2,h3,h4{font-family:'Cormorant Garamond',serif;font-weight:600;line-height:1.08;color:#F7F3EB}
a{color:inherit;text-decoration:none}
img{max-width:100%;height:auto;display:block}
::selection{background:#C8A45C;color:#1A1D20}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:#1A1D20}
::-webkit-scrollbar-thumb{background:#C8A45C;border-radius:3px}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes sparkle{0%,100%{opacity:0;transform:scale(0)}50%{opacity:0.6;transform:scale(1)}}
@keyframes goldPulse{0%,100%{box-shadow:0 0 15px rgba(200,164,92,0.3)}50%{box-shadow:0 0 35px rgba(200,164,92,0.6)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:translateX(0)}}
@keyframes lineGrow{from{width:0}to{width:80px}}
.container{max-width:1200px;margin:0 auto;padding:0 24px}
.gold-line{width:80px;height:2px;background:linear-gradient(90deg,#C8A45C,transparent);margin:20px 0 24px;animation:lineGrow 0.8s ease-out forwards}
.gold-line.center{margin:20px auto 24px}
.gold{color:#C8A45C}
.section{padding:100px 0;position:relative}
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
.fade-in{opacity:0;transition:opacity 1s ease}
.fade-in.visible{opacity:1}
/* NAVBAR */
.navbar{position:fixed;top:0;left:0;right:0;z-index:1000;padding:16px 0;transition:all 0.4s ease;background:transparent}
.navbar.scrolled{background:rgba(26,29,32,0.95);backdrop-filter:blur(20px);padding:10px 0;border-bottom:1px solid rgba(200,164,92,0.15)}
.nav-inner{display:flex;align-items:center;justify-content:space-between}
.nav-logo{display:flex;align-items:center}
.logo-img{height:42px;width:auto}
.nav-links{display:flex;align-items:center;gap:32px}
.nav-links a{font-size:13px;font-weight:500;letter-spacing:1px;text-transform:uppercase;color:rgba(247,243,235,0.8);transition:color 0.3s;position:relative}
.nav-links a::after{content:'';position:absolute;bottom:-4px;left:0;width:0;height:1px;background:#C8A45C;transition:width 0.3s}
.nav-links a:hover{color:#C8A45C}
.nav-links a:hover::after{width:100%}
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
  .nav-links.open{right:0}
  .nav-toggle{display:flex}
  .logo-img{height:32px}
}
/* HERO */
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
  .hero-content{padding:100px 0 40px}
  .hero-actions{flex-direction:column}
  .btn{width:100%;justify-content:center}
}
/* SMILE CONCIERGE */
.smile-concierge{position:fixed;bottom:30px;right:30px;z-index:999;display:flex;align-items:center;gap:10px;padding:14px 24px;background:linear-gradient(135deg,#C8A45C,#A8893A);color:#1A1D20;border-radius:50px;font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;box-shadow:0 8px 30px rgba(200,164,92,0.4);cursor:pointer;transition:all 0.3s ease;border:none;animation:goldPulse 3s ease-in-out infinite}
.smile-concierge:hover{transform:translateY(-3px) scale(1.05);box-shadow:0 12px 40px rgba(200,164,92,0.6)}
.smile-concierge svg{flex:none}
@media(max-width:768px){
  .smile-concierge{bottom:20px;right:20px;padding:12px 18px;font-size:11px}
  .smile-concierge span{display:none}
}
/* GOLD PARTICLES */
#gold-particles{position:fixed;inset:0;pointer-events:none;z-index:1;overflow:hidden}
'''

os.makedirs("docs/leads/zahnarzt-thedentalcompany", exist_ok=True)
html = CSS.replace("H1_IMAGE", IMG["h1"])
with open("docs/leads/zahnarzt-thedentalcompany/index.html", "w", encoding="utf-8") as f:
    f.write(html)
print("DONE")
