import subprocess,os,glob,math
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageEnhance
F='/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2'
W,H,FPS=1080,1920,30
FD='/home/user/the-tribe-bot/instagram_autopilot/fonts/'
def font(n,s):return ImageFont.truetype(FD+n,s)
CREAM=(242,240,235);AMB=(217,160,102);INK=(10,10,10)
def stock(id,start,dur,tag):
    d=f'fr/{tag}';os.makedirs(d,exist_ok=True)
    if not glob.glob(d+'/*.jpg'):
        subprocess.run([F,'-v','error','-ss',str(start),'-t',str(dur+.2),'-i',f'stock/{id}.mp4','-vf',f'crop=ih*9/16:ih,scale={W}:{H},fps={FPS}','-q:v','3',d+'/%04d.jpg'],check=True)
    return sorted(glob.glob(d+'/*.jpg'))
def ease(t):return 1-(1-max(0,min(1,t)))**3
def text(dr,xy,s,f,fill=CREAM,anchor='la',a=1.0):
    if a>=1:dr.text(xy,s,font=f,fill=fill,anchor=anchor);return
    if a<=0:return
    im=dr._image;L=Image.new('RGBA',im.size,(0,0,0,0));ImageDraw.Draw(L).text(xy,s,font=f,fill=fill+(int(255*a),),anchor=anchor)
    im.paste(L,(0,0),L)
def phone(shot):
    im=Image.open(shot if '/' in shot else 'app/'+shot).convert('RGB');pw=760;ph=int(im.height*pw/im.width);im=im.resize((pw,ph),Image.LANCZOS)
    m=Image.new('L',(pw,ph),0);ImageDraw.Draw(m).rounded_rectangle((0,0,pw-1,ph-1),56,fill=255)
    fr=Image.new('RGBA',(pw+28,ph+28),(0,0,0,0));d=ImageDraw.Draw(fr);d.rounded_rectangle((0,0,pw+27,ph+27),70,fill=(30,30,30),outline=(70,70,70),width=3)
    fr.paste(im,(14,14),m);return fr
BG=None
scenes=[]  # (dur, renderer)
def s_stock(id,start,dur,lines,tag):
    frames=stock(id,start,dur,tag)
    def r(i,n):
        im=Image.open(frames[min(i,len(frames)-1)]).convert('RGB');im=ImageEnhance.Brightness(im).enhance(.62);ov=Image.new('L',(W,H),0);ImageDraw.Draw(ov).ellipse((-200,H//2-520,W+200,H//2+520),fill=210);ov=ov.filter(ImageFilter.GaussianBlur(120));im=Image.composite(Image.new('RGB',(W,H),(0,0,0)),im,ov)
        z=1+.06*i/n;w2,h2=int(W*z),int(H*z);im=im.resize((w2,h2)).crop(((w2-W)//2,(h2-H)//2,(w2-W)//2+W,(h2-H)//2+H))
        d=ImageDraw.Draw(im);y=H//2-len(lines)*70
        for k,(s,f,c) in enumerate(lines):
            a=ease((i-k*3)/8);text(d,(W//2,y+int((1-a)*40)),s,f,c,'mm',a);y+=f.size+30
        return im
    scenes.append((dur,r))
bgf=None
def s_phone(shot,dur,cap,sub=None):
    global bgf
    if bgf is None:bgf=stock('14116',1,6,'bg')
    shots=shot if isinstance(shot,list) else [shot];PH=[phone(x) for x in shots]
    def r(i,n):
        ph=PH[min(len(PH)-1,i*len(PH)//n)]
        k=(len(scenes_idx)*0)
        b=Image.open(bgf[(i*2)%len(bgf)]).convert('RGB').filter(ImageFilter.GaussianBlur(28));b=ImageEnhance.Brightness(b).enhance(.35)
        a=ease(i/10);s=.92+.08*a+.03*i/n
        p=ph.resize((int(ph.width*s),int(ph.height*s)));x=(W-p.width)//2;y=560+int((1-a)*500)-int(30*i/n)
        b.paste(p,(x,y),p)
        d=ImageDraw.Draw(b);ta=ease((i-3)/8)
        text(d,(W//2,250-int((1-ta)*30)),cap,font('Geist-Bold.ttf',92),CREAM,'mm',ta)
        if sub:text(d,(W//2,370),sub,font('Geist-Medium.ttf',46),AMB,'mm',ta)
        return b
    scenes.append((dur,r))
scenes_idx=[]
def s_end(dur):
    def r(i,n):
        b=Image.new('RGB',(W,H),INK);d=ImageDraw.Draw(b);a=ease(i/10)
        text(d,(W//2,700),'THE TRIBE',font('Geist-SemiBold.ttf',96),CREAM,'mm')
        tw=d.textlength('THE TRIBE',font=font('Geist-SemiBold.ttf',96));d.ellipse((W//2+tw/2+10,722,W//2+tw/2+32,744),fill=AMB)
        text(d,(W//2,860),'Events finden.',font('Geist-Bold.ttf',78),CREAM,'mm',ease((i-2)/6))
        text(d,(W//2,960),'Leute finden.',font('Geist-Bold.ttf',78),CREAM,'mm',ease((i-5)/6))
        text(d,(W//2,1060),'Rausgehen.',font('Geist-Bold.ttf',78),AMB,'mm',ease((i-8)/6))
        if i>12:
            d.rounded_rectangle((W//2-330,1240,W//2+330,1360),60,fill=CREAM);text(d,(W//2,1300),'Jetzt kostenlos installieren',font('Geist-SemiBold.ttf',44),INK,'mm')
            text(d,(W//2,1440),'App + Community: Link in Bio',font('Geist-Medium.ttf',40),(154,152,147),'mm')
            text(d,(W//2,1500),'Stadtpuls = Hochrechnung aus allen Events',font('Geist-Medium.ttf',40),(154,152,147),'mm')
        return b
    scenes.append((dur,r))

def s_pan(path,dur,cap,sub=None):
    global bgf
    if bgf is None:bgf=stock('14116',1,6,'bg')
    full=Image.open(path).convert('RGB');pw=760;full=full.resize((pw,int(full.height*pw/full.width)),Image.LANCZOS);vh=int(844*pw/390)
    m=Image.new('L',(pw,vh),0);ImageDraw.Draw(m).rounded_rectangle((0,0,pw-1,vh-1),56,fill=255)
    def r(i,n):
        b=Image.open(bgf[(i*2)%len(bgf)]).convert('RGB').filter(ImageFilter.GaussianBlur(28));b=ImageEnhance.Brightness(b).enhance(.35)
        t=ease(i/n) if False else (i/n);t=t*t*(3-2*t);y0=int(t*min(full.height-vh,vh*1.6))
        win=full.crop((0,y0,pw,y0+vh));fr=Image.new('RGBA',(pw+28,vh+28),(0,0,0,0));d=ImageDraw.Draw(fr);d.rounded_rectangle((0,0,pw+27,vh+27),70,fill=(30,30,30),outline=(70,70,70),width=3);fr.paste(win,(14,14),m)
        a=ease(i/10);b.paste(fr,((W-fr.width)//2,560+int((1-a)*500)),fr)
        d=ImageDraw.Draw(b);ta=ease((i-3)/8)
        text(d,(W//2,250-int((1-ta)*30)),cap,font('Geist-Bold.ttf',92),CREAM,'mm',ta)
        if sub:text(d,(W//2,370),sub,font('Geist-Medium.ttf',46),AMB,'mm',ta)
        return b
    scenes.append((dur,r))

import json as _json,requests as _rq,re as _re,io as _io,datetime as _dt
def today_events(day,n=4):
    d=_json.load(open('../ev_live.json'));out=[]
    for e in d:
        if day not in e.get('date',''):continue
        t=e.get('event','');c=(e.get('category') or '').lower();txt=(t+' '+c).lower()
        if _re.search(r'hochschulsport|wochenmarkt|yoga|laufen|fußball|stammtisch',txt) or not e.get('image_url') or not e.get('time'):continue
        pri=3 if 'party' in c or _re.search(r'party|club|rave|dance|friday|saturday|techno|house',txt) else 0 if _re.search(r'kammer|oetker|semesterstart|orchester|klassik|lange nacht musik',txt) else 2 if _re.search(r'konzert|live|band|punk|rock|indie|hip ?hop|movie|forum|sams',txt) else 1
        m=_re.search(r'\(@?([^)]+)\)\s*$',t);ven=m.group(1).replace('_',' ').replace('bielefeld','').strip().title() if m else ''
        out.append((pri,e['time'],_re.sub(r'\s*\(@?[^)]+\)\s*$','',t).strip(),ven,e['image_url']))
    out=[o for o in out if o[0]>=2]
    out.sort(key=lambda x:(-x[0],x[1]));pick=sorted(out[:n],key=lambda x:x[1])
    ims=[]
    for p in pick:
        try:
            r=_rq.get(p[4],headers={'User-Agent':'Mozilla/5.0','Referer':'https://maikz91.github.io/'},timeout=15,verify='/root/.ccr/ca-bundle.crt');ims.append((p,Image.open(_io.BytesIO(r.content)).convert('RGB')))
        except Exception:pass
    return ims
def s_today(dur,label,events):
    def r(i,n):
        b=Image.new('RGB',(W,H),INK);d=ImageDraw.Draw(b)
        a0=ease(i/8);text(d,(80,190),'HEUTE IN BIELEFELD',font('Geist-SemiBold.ttf',40),AMB,'la',a0);text(d,(80,250),label,font('Geist-Bold.ttf',96),CREAM,'la',a0)
        y=440
        for k,(p,im) in enumerate(events):
            a=ease((i-6-k*5)/9)
            if a<=0:continue
            x=80+int((1-a)*120);ch=330;cw=W-160
            card=Image.new('RGB',(cw,ch),(24,24,24));th=im.copy();s=max(ch/th.height,300/th.width);th=th.resize((int(th.width*s),int(th.height*s)));card.paste(th.crop(((th.width-300)//2,(th.height-ch)//2,(th.width-300)//2+300,(th.height-ch)//2+ch)),(0,0))
            cd=ImageDraw.Draw(card);cd.text((330,40),p[1]+' Uhr',font=font('Geist-SemiBold.ttf',40),fill=AMB)
            ttl=p[2] if len(p[2])<=26 else p[2][:25]+'…';cd.text((330,100),ttl,font=font('Geist-Bold.ttf',46),fill=CREAM)
            cd.text((330,170),p[3][:28],font=font('Geist-Medium.ttf',36),fill=(154,152,147))
            m=Image.new('L',(cw,ch),0);ImageDraw.Draw(m).rounded_rectangle((0,0,cw-1,ch-1),36,fill=int(255*a))
            b.paste(card,(x,y),m);y+=ch+40
        return b
    scenes.append((dur,r))
B=font('Geist-Bold.ttf',116);M=font('Geist-SemiBold.ttf',64);S=font('Geist-Medium.ttf',54)
A='app3/'
EV=today_events('17.10.2026')
s_stock('4185',0.5,1.3,[('Samstag.',B,CREAM),('Was geht?',B,AMB)],'a2')
s_today(3.4,'Samstag, 17.10.',EV)
s_phone([A+f'tick{k}.png' for k in range(4)],2.0,'Alles live in der App.','Was läuft – direkt oben im Ticker')
s_phone([A+f'fy{k}.png' for k in range(8)]+[A+'liked.png']*3,2.0,'Herz = mehr davon.','Die App lernt deinen Geschmack')
s_phone([A+f'puls{k}.png' for k in range(7)],2.6,'Stadtpuls.','Sieh, wo die Stadt gerade brennt')
s_phone(A+'here.png',1.6,'Ich bin unterwegs.','Wer in der Nähe ist, kommt dazu')
s_stock('14105',1,1.6,[('Geh nicht allein.',B,CREAM),('Finde deine Leute.',M,AMB)],'z')
s_end(2.8)
os.makedirs('out',exist_ok=True)
p=subprocess.Popen([F,'-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-ss','15.5','-i','/home/user/the-tribe-bot/instagram_autopilot/music/house-vibes.mp3',
  '-map','0:v','-map','1:a','-shortest','-c:v','libx264','-pix_fmt','yuv420p','-crf','19','-preset','medium','-c:a','aac','-b:a','192k','-af','afade=t=in:d=0.3,afade=t=out:st=17.6:d=1.2','-movflags','+faststart','out/tribe-app-v4.mp4'],stdin=subprocess.PIPE)
tot=0
for dur,r in scenes:
    n=int(dur*FPS)
    for i in range(n):p.stdin.write(r(i,n).tobytes())
    tot+=dur
p.stdin.close();p.wait();print('dur',tot)
