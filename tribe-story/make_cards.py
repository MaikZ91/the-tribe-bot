# -*- coding: utf-8 -*-
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

WORK = r"C:\Users\Maik Zschach\the-tribe\tribe-story"
CARDS = os.path.join(WORK,"cards"); os.makedirs(CARDS, exist_ok=True)
CAPS = os.path.join(WORK,"caps"); os.makedirs(CAPS, exist_ok=True)
ANTON = os.path.join(WORK,"fonts","Anton-Regular.ttf")
GRO   = os.path.join(WORK,"fonts","FamiljenGrotesk.ttf")

W,H = 1080,1920
BLACK=(10,8,7); AMBER=(245,162,26); TEXT=(247,242,234); MUTED=(168,161,153)

def F(path,size): return ImageFont.truetype(path,size)

def tracked_width(d,text,font,tracking):
    return sum(d.textlength(c,font=font) for c in text) + tracking*max(0,len(text)-1)

def draw_tracked(d,text,font,fill,cx,y,tracking=0,center=True,shadow=None):
    tw=tracked_width(d,text,font,tracking)
    x = cx - tw/2 if center else cx
    for c in text:
        if shadow:
            d.text((x+shadow[0],y+shadow[1]),c,font=font,fill=shadow[2])
        d.text((x,y),c,font=font,fill=fill)
        x += d.textlength(c,font=font)+tracking

def base(grain=False):
    img=Image.new("RGB",(W,H),BLACK)
    # subtle radial glow center
    glow=Image.new("L",(W,H),0); gd=ImageDraw.Draw(glow)
    gd.ellipse([W*0.1,H*0.30,W*0.9,H*0.72],fill=40)
    glow=glow.filter(ImageFilter.GaussianBlur(160))
    amberlayer=Image.new("RGB",(W,H),(60,38,8))
    img=Image.composite(amberlayer,img,glow)
    return img

# ---------------- TITLE ----------------
img=base(); d=ImageDraw.Draw(img)
draw_tracked(d,"EST. 2021 · BIELEFELD",F(GRO,32),AMBER,W/2,690,tracking=10)
draw_tracked(d,"ALLES BEGANN",F(ANTON,118),TEXT,W/2,800,tracking=2)
draw_tracked(d,"MIT EINEM",F(ANTON,118),TEXT,W/2,930,tracking=2)
draw_tracked(d,"SOFA.",F(ANTON,150),AMBER,W/2,1060,tracking=4)
# rule
d.rectangle([W/2-60,1270,W/2+60,1274],fill=AMBER)
draw_tracked(d,"DIE GESCHICHTE EINER COMMUNITY",F(GRO,28),MUTED,W/2,1320,tracking=6)
img.save(os.path.join(CARDS,"title.png"))

# ---------------- CHAPTER ----------------
def chapter(fname,year,label,sub=None):
    img=base(); d=ImageDraw.Draw(img)
    draw_tracked(d,"THE TRIBE",F(GRO,30),MUTED,W/2,560,tracking=14)
    draw_tracked(d,year,F(ANTON,300),AMBER,W/2,700,tracking=0)
    d.rectangle([W/2-70,1120,W/2+70,1125],fill=TEXT)
    draw_tracked(d,label,F(GRO,52),TEXT,W/2,1175,tracking=8)
    if sub:
        draw_tracked(d,sub,F(GRO,34),AMBER,W/2,1255,tracking=6)
    img.save(os.path.join(CARDS,fname))

chapter("ch2021.png","2021","DIE SOFA-KONZERTE")
chapter("ch2022.png","2022","AUS ABENDEN WIRD MEHR")
chapter("ch2025.png","2025","HEUTE", "ÜBER 150 MENSCHEN")

# ---------------- END ----------------
img=base(); d=ImageDraw.Draw(img)
# triangle outline (brand mark)
cx=W/2; ty=760; s=300; h=s*0.866
pts=[(cx,ty-h*0.62),(cx-s/2,ty+h*0.38),(cx+s/2,ty+h*0.38)]
d.line([pts[0],pts[1],pts[2],pts[0]],fill=TEXT,width=16,joint="curve")
draw_tracked(d,"THE TRIBE",F(ANTON,110),TEXT,W/2,ty+h*0.5+40,tracking=6)
draw_tracked(d,"CONNECTING PEOPLE IN REAL LIFE",F(GRO,30),AMBER,W/2,ty+h*0.5+190,tracking=6)
d.rectangle([W/2-50,1320,W/2+50,1324],fill=MUTED)
draw_tracked(d,"Werde Teil der Community.",F(GRO,44),TEXT,W/2,1380,tracking=1)
draw_tracked(d,"@the_tribe.germany",F(GRO,40),AMBER,W/2,1470,tracking=2)
img.save(os.path.join(CARDS,"end.png"))

# ---------------- CAPTIONS (transparent lower-third) ----------------
def caption(fname,kicker,line):
    img=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(img)
    # bottom scrim gradient
    scrim=Image.new("L",(1,H),0)
    for y in range(H):
        a=0
        if y> H*0.62:
            a=int(min(210, (y-H*0.62)/(H*0.38)*210))
        scrim.putpixel((0,y),a)
    scrim=scrim.resize((W,H))
    black=Image.new("RGBA",(W,H),(6,4,3,255))
    black.putalpha(scrim)
    img=Image.alpha_composite(img,black)
    d=ImageDraw.Draw(img)
    mx=90; y0=1500
    d.rectangle([mx,y0+6,mx+8,y0+118],fill=AMBER)
    draw_tracked(d,kicker,F(GRO,30),AMBER,mx+34,y0,tracking=8,center=False)
    # main line (wrap if long)
    fnt=F(GRO,56)
    draw_tracked(d,line,fnt,TEXT,mx+34,y0+44,tracking=0,center=False,shadow=(2,2,(0,0,0)))
    img.save(os.path.join(CAPS,fname))

caption("cap_freunde.png","2021","Wildfremde, die Freunde wurden.")
caption("cap_leben.png","2021","Einfach zusammen. Einfach leben.")
caption("cap_mehr.png","2022","Aus ein paar Leuten wird eine Bewegung.")
caption("cap_stadt.png","2022","Eine ganze Stadt rückt zusammen.")
caption("cap_heute.png","2025","Echte Menschen. Jede Woche. Real Life.")
caption("cap_app.png","2025","Eine App – unzählige echte Begegnungen.")

print("cards+caps done:", os.listdir(CARDS), len(os.listdir(CAPS)),"caps")
