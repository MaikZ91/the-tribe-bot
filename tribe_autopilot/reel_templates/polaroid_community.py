import subprocess,math,random
from PIL import Image,ImageDraw,ImageFont,ImageFilter,ImageEnhance
F='/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2'
G='/home/user/the-tribe-bot/instagram_autopilot/fonts/';I='/home/user/the-tribe-bot/tribe_autopilot/images/'
W,H,FPS=1080,1920,30;WH=(245,243,238);CU=(201,150,105)
def osw(s,w='Bold'):
    f=ImageFont.truetype('Oswald.ttf',s);f.set_variation_by_name(w);return f
def geist(n,s):return ImageFont.truetype(G+n,s)
def ease(t):t=max(0,min(1,t));return 1-(1-t)**3
def load(p):
    im=Image.open(I+p).convert('RGB');return ImageEnhance.Contrast(ImageEnhance.Color(im).enhance(.9)).enhance(1.08)
def cover(im,w,h,z=1.0):
    s=max(w/im.width,h/im.height)*z;im=im.resize((int(im.width*s)+1,int(im.height*s)+1),Image.LANCZOS)
    return im.crop(((im.width-w)//2,(im.height-h)//2,(im.width-w)//2+w,(im.height-h)//2+h))
P=['club-drei-freunde.jpg','wandern-selfie-wald.jpg','gitarre-live.jpg','bar-tischrunde-gross.jpg','dj-pult-gruppe.jpg','wandern-gruppe-ausblick.jpg','dinner-tischrunde-halle.jpg','creative-circle-band.jpg','bar-selfie-zwei.jpg','selfie-drei-schwarz.jpg','weekend-starter-tisch.jpg','wandern-selfie-baum.jpg']
IM={p:load(p) for p in P}
# collage 3x4
def collage(t):
    c=Image.new('RGB',(W,H));cw,ch=W//3,H//4
    for k in range(12):
        p=P[(k+int(t*6))%12] if (k*7+int(t*6))%5==0 else P[k]
        c.paste(cover(IM[p],cw,ch),((k%3)*cw,(k//3)*ch))
    return ImageEnhance.Brightness(c).enhance(.55)
def polaroid(p,bw=False):
    ph=cover(IM[p],760,900)
    if bw:ph=ImageEnhance.Color(ph).enhance(0)
    fr=Image.new('RGB',(820,1100),(242,240,235));fr.paste(ph,(30,30))
    d=ImageDraw.Draw(fr);d.text((790,1050),'♡',font=geist('Geist-Regular.ttf',44),fill=(120,115,110),anchor='rm')
    return fr
def blurbg(p):return ImageEnhance.Brightness(cover(IM[p],W,H,1.1).filter(ImageFilter.GaussianBlur(30))).enhance(.45)
def txt(im,xy,s,f,fill=WH,a=1,anchor='mm'):
    if a<=0:return
    L=Image.new('RGBA',im.size,(0,0,0,0));D=ImageDraw.Draw(L)
    D.text((xy[0]+3,xy[1]+3),s,font=f,fill=(0,0,0,int(160*a)),anchor=anchor);D.text(xy,s,font=f,fill=fill+(int(255*a),),anchor=anchor);im.paste(L,(0,0),L)
def flash(im,a):
    if a>0:im=Image.blend(im,Image.new('RGB',im.size,(255,255,255)),a)
    return im
SEQ=[('wandern-selfie-wald.jpg','WANDERN.',False),('gitarre-live.jpg','MUSIK.',False),('bar-tischrunde-gross.jpg','FREITAGABEND.',False),('club-drei-freunde.jpg','PARTY.',True),('dj-pult-gruppe.jpg','AUFLEGEN.',False),('dinner-tischrunde-halle.jpg','ESSEN GEHEN.',False)]
frames=[]
def scene_hook(n):   # 0-2.2s collage + hook
    for i in range(n):
        t=i/FPS;im=collage(t);z=1.08-.08*ease(i/n);w2,h2=int(W*z),int(H*z);im=im.resize((w2,h2)).crop(((w2-W)//2,(h2-H)//2,(w2-W)//2+W,(h2-H)//2+H))
        txt(im,(W//2,H//2-120),'NEU IN',osw(170),WH,ease(i/4));txt(im,(W//2,H//2+70),'DER STADT?',osw(170),WH,ease((i-3)/4))
        txt(im,(W//2,H//2+260),'Und keiner hat Zeit?',geist('Geist-Medium.ttf',54),CU,ease((i-14)/8))
        frames.append(im)
def scene_pol(p,word,bw,n,first=False):
    pol=polaroid(p,bw);bg=blurbg(p);ang=random.Random(p).uniform(-5,5)
    for i in range(n):
        a=ease(i/6);im=bg.copy();s=.86+.06*a+.03*i/n
        q=pol.resize((int(pol.width*s),int(pol.height*s))).rotate(ang*(1-a)+ang*.3,expand=True,fillcolor=(0,0,0))
        mask=pol.resize((int(pol.width*s),int(pol.height*s))).convert('L').point(lambda v:255).rotate(ang*(1-a)+ang*.3,expand=True)
        y=(H-q.height)//2-60+int((1-a)*400);im.paste(q,((W-q.width)//2,y),mask)
        txt(im,(W//2,1700),word,osw(120),WH,ease((i-2)/4))
        if i<2:im=flash(im,.6-.3*i)
        frames.append(im)
def scene_gesamt(n):
    for i in range(n):
        im=collage(2+i/FPS);im=ImageEnhance.Brightness(im).enhance(.8)
        txt(im,(W//2,H//2-90),'EINE',osw(150),WH,ease(i/5));txt(im,(W//2,H//2+80),'COMMUNITY.',osw(150),CU,ease((i-3)/5))
        if i<3:im=flash(im,.7-.25*i)
        frames.append(im)
def scene_end(n):
    pol=polaroid('wandern-gruppe-ausblick.jpg');bg=blurbg('wandern-gruppe-ausblick.jpg')
    for i in range(n):
        im=bg.copy();q=pol.resize((700,938));im.paste(q,((W-700)//2,330))
        L=Image.new('RGBA',(W,H),(0,0,0,0));D=ImageDraw.Draw(L);D.rectangle((190,360,890,1210),fill=(0,0,0,110));im.paste(L,(0,0),L)
        txt(im,(W//2,620),'THE TRIBE',geist('Geist-Bold.ttf',100),WH,ease(i/8))
        txt(im,(W//2,740),'Events finden. Leute finden.',geist('Geist-Medium.ttf',44),WH,ease((i-4)/8))
        txt(im,(W//2,1440),'Kostenlose Community',osw(84),WH,ease((i-8)/8))
        txt(im,(W//2,1560),'Link in Bio →',geist('Geist-SemiBold.ttf',62),CU,ease((i-12)/8))
        frames.append(im)
scene_hook(int(2.2*FPS))
for k,(p,w,bw) in enumerate(SEQ):scene_pol(p,w,bw,int((0.9 if k<2 else 0.65)*FPS))
scene_gesamt(int(1.6*FPS))
scene_end(int(3.2*FPS))
# loop: last 6 frames blend into first frame
f0=frames[0]
for k in range(6):frames[-6+k]=Image.blend(frames[-6+k],f0,(k+1)/7)
dur=len(frames)/FPS
p=subprocess.Popen([F,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i','/home/user/the-tribe-bot/instagram_autopilot/music/take-this-higher.mp3','-t',str(dur),'-af',f'afade=t=out:st={dur-1.2}:d=1.2','-c:v','libx264','-pix_fmt','yuv420p','-crf','19','-c:a','aac','-b:a','192k','reel.mp4'],stdin=subprocess.PIPE)
for k,im in enumerate(frames):
    p.stdin.write(im.tobytes())
    if k%30==10:im.save(f's{k:04d}.jpg')
p.stdin.close();p.wait();print(dur)
