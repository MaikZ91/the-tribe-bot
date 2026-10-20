"""Flow-Tool-Reel: Hook -> 4 Feature-Szenen (Bildschirmaufnahmen im Handy/Browser-Rahmen) -> CTA.
Avatar (HeyGen-Video, gesprochenes Skript) läuft durchgehend als runde Bubble unten links und liefert den Ton.
Dateien hier ablegen: avatar.mp4 (optional), screens/buchhaltung.mp4|png, kalender, landingpage, dashboard.
Fehlt etwas, wird ein Platzhalter gezeichnet. python3 build.py -> flow-reel.mp4"""
import subprocess,os,glob
from PIL import Image,ImageDraw,ImageFont
F='/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2'
G='/home/user/the-tribe-bot/instagram_autopilot/fonts/'
W,H,FPS=1080,1920,30;WH=(245,243,238);AC=(201,150,105);BG=(8,8,10)
def osw(s):
    f=ImageFont.truetype('Oswald.ttf',s);f.set_variation_by_name('Bold');return f
def g(n,s):return ImageFont.truetype(G+n,s)
def ease(t):t=max(0,min(1,t));return 1-(1-t)**3
def frames_of(name,w,h,n):
    for ext in ('mp4','mov'):
        p=f'screens/{name}.{ext}'
        if os.path.exists(p):
            d=f'.fr/{name}';os.makedirs(d,exist_ok=True)
            if not glob.glob(d+'/*.jpg'):subprocess.run([F,'-v','error','-i',p,'-vf',f'scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={FPS}','-q:v','3',d+'/%04d.jpg'],check=True)
            fs=sorted(glob.glob(d+'/*.jpg'));return [Image.open(fs[min(i,len(fs)-1)]).convert('RGB') for i in range(n)]
    if os.path.exists(f'screens/{name}.png'):
        im=Image.open(f'screens/{name}.png').convert('RGB');s=max(w/im.width,h/im.height);im=im.resize((int(im.width*s)+1,int(im.height*s)+1))
        return [im.crop((0,int((im.height-h)*i/max(n-1,1)),w,int((im.height-h)*i/max(n-1,1))+h)) for i in range(n)]   # langsamer Scroll
    ph=Image.new('RGB',(w,h),(28,28,32));d=ImageDraw.Draw(ph);d.text((w//2,h//2),f'[{name}]\nBildschirmaufnahme',font=g('Geist-Medium.ttf',40),fill=(120,120,130),anchor='mm',align='center')
    return [ph]*n
out=[]
def card(fr,w,h):
    m=Image.new('L',(w,h),0);ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),40,fill=255)
    c=Image.new('RGBA',(w+20,h+20),(0,0,0,0));ImageDraw.Draw(c).rounded_rectangle((0,0,w+19,h+19),48,fill=(40,40,44));c.paste(fr,(10,10),m);return c
def hook(dur):
    n=int(dur*FPS)
    for i in range(n):
        im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
        for k,(s,c) in enumerate([('1 STUNDE.',WH),('MEIN GANZES',WH),('BUSINESS.',AC)]):
            a=ease((i-k*5)/7)
            if a>0:
                L=Image.new('RGBA',(W,H));ImageDraw.Draw(L).text((80,620+k*200+int((1-a)*40)),s,font=osw(190),fill=c+(int(255*a),));im.paste(L,(0,0),L)
        out.append(im)
def feature(name,label,num,dur):
    n=int(dur*FPS);w,h=900,1200;fr=frames_of(name,w,h,n)
    for i in range(n):
        im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
        a=ease(i/8);c=card(fr[i],w,h);im.paste(c,((W-c.width)//2,330+int((1-a)*300)),c)
        d.text((80,130),f'0{num}',font=osw(90),fill=AC);d.text((210,150),label,font=g('Geist-Bold.ttf',72),fill=WH)
        if i<3:im=Image.blend(im,Image.new('RGB',(W,H),(255,255,255)),.4-.13*i)
        out.append(im)
def cta(dur):
    n=int(dur*FPS)
    for i in range(n):
        im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
        d.text((W//2,700),'Alles in einem Tool.',font=g('Geist-Bold.ttf',84),fill=WH,anchor='mm')
        d.text((W//2,820),'Gebaut in 1 Stunde.',font=g('Geist-Bold.ttf',84),fill=AC,anchor='mm')
        d.text((W//2,1000),'Kommentiere FLOW',font=g('Geist-SemiBold.ttf',60),fill=WH,anchor='mm')
        out.append(im)
hook(2.5)
for k,(nm,lb) in enumerate([('buchhaltung','Buchhaltung'),('kalender','Kalender'),('landingpage','Landingpage'),('dashboard','Dashboard')],1):feature(nm,lb,k,4.0)
cta(3.5)
# Avatar-Bubble unten links (rund), liefert Ton
av=os.path.exists('avatar.mp4');N=len(out);R=330
if av:
    os.makedirs('.fr/av',exist_ok=True)
    if not glob.glob('.fr/av/*.jpg'):subprocess.run([F,'-v','error','-i','avatar.mp4','-vf',f'scale={R}:{R}:force_original_aspect_ratio=increase,crop={R}:{R},fps={FPS}','-q:v','3','.fr/av/%04d.jpg'],check=True)
    afs=sorted(glob.glob('.fr/av/*.jpg'))
mask=Image.new('L',(R,R),0);ImageDraw.Draw(mask).ellipse((0,0,R-1,R-1),fill=255)
dur=N/FPS
args=[F,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-']
args+=(['-i','avatar.mp4','-map','0:v','-map','1:a?','-shortest'] if av else [])
args+=['-c:v','libx264','-pix_fmt','yuv420p','-crf','19','-c:a','aac','flow-reel.mp4']
p=subprocess.Popen(args,stdin=subprocess.PIPE)
for i,im in enumerate(out):
    if av:fa=Image.open(afs[min(i,len(afs)-1)])
    else:
        fa=Image.new('RGB',(R,R),(60,60,66));ImageDraw.Draw(fa).text((R//2,R//2),'Avatar',font=g('Geist-Medium.ttf',44),fill=(150,150,160),anchor='mm')
    ImageDraw.Draw(im).ellipse((60-6,H-R-260-6,60+R+6,H-260+6),fill=AC);im.paste(fa,(60,H-R-260),mask)
    p.stdin.write(im.tobytes())
    if i%60==30:im.save(f'.prev{i:04d}.jpg')
p.stdin.close();p.wait();print(round(dur,1),'s')
