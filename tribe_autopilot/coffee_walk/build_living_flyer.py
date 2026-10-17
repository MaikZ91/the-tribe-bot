import subprocess,os,glob
from PIL import Image,ImageDraw,ImageFont,ImageEnhance
F='/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2'
G='/home/user/the-tribe-bot/instagram_autopilot/fonts/'
W,H,FPS=1080,1920,30
FL=Image.open('flyer.png').convert('RGB')          # 941x1672
K=2*W/FL.width                                      # 2x working canvas
CW,CH=int(FL.width*K),int(FL.height*K)
BASE=FL.resize((CW,CH),Image.LANCZOS)
SLOTS={'top':(452,75,940,836),'bl':(26,852,524,1430),'br':(548,852,919,1430)}
CLIPS={'top':('41229',0.5,0.8),'bl':('4560',0.5,0.5),'br':('43247',0.5,0.35)}
TOTAL=22.5
def osw(s,w='Bold'):
    f=ImageFont.truetype('Oswald.ttf',s);f.set_variation_by_name(w);return f
def ease(t):t=max(0,min(1,t));return t*t*(3-2*t)
def px(r):return tuple(int(v*K) for v in r)
frames={}
for k,(cid,ss,ax) in CLIPS.items():
    x0,y0,x1,y1=px(SLOTS[k]);w,h=x1-x0,y1-y0;d=f'lv/{k}';os.makedirs(d,exist_ok=True)
    if not glob.glob(d+'/*.jpg'):
        subprocess.run([F,'-v','error','-stream_loop','-1','-ss',str(ss),'-i',f'stock/{cid}.mp4','-t',str(TOTAL),
          '-vf',f'scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}:(iw-{w})*{ax}:(ih-{h})/2,fps={FPS},eq=saturation=0.7:contrast=1.12:brightness=-0.04,colorbalance=rs=0.06:bs=-0.06',
          '-q:v','3',d+'/%04d.jpg'],check=True)
    frames[k]=sorted(glob.glob(d+'/*.jpg'))
def canvas(i,live):
    c=BASE.copy()
    if live>0:
        for k,r in SLOTS.items():
            x0,y0,x1,y1=px(r);v=Image.open(frames[k][min(i,len(frames[k])-1)]).convert('RGB').resize((x1-x0,y1-y0))
            if live<1:v=Image.blend(c.crop((x0,y0,x1,y1)),v,live)
            c.paste(v,(x0,y0))
    return c
def view_for(r,pad=0.0):
    x0,y0,x1,y1=px(r);cx,cy=(x0+x1)/2,(y0+y1)/2;h=(y1-y0)*(1+pad);w=h*W/H
    if w<(x1-x0)*(1+pad):w=(x1-x0)*(1+pad);h=w*H/W
    return (cx,cy,w)
FULL=(CW/2,CH/2,CW)
def lerp(a,b,t):return tuple(a[j]+(b[j]-a[j])*t for j in range(3))
V={k:view_for(r,-0.02) for k,r in SLOTS.items()}
# keyframes: (time, view)
KF=[(0,FULL),(3.0,FULL),(4.6,V['top']),(8.0,V['top']),(9.4,V['bl']),(12.4,V['bl']),(13.8,V['br']),(16.6,V['br']),(18.2,FULL),(22.5,FULL)]
def cam(t):
    for (t0,a),(t1,b) in zip(KF,KF[1:]):
        if t0<=t<=t1:return lerp(a,b,ease((t-t0)/(t1-t0)) if t1>t0 else 1)
    return FULL
CAP=[(4.6,8.0,'GUTE LEUTE.'),(9.4,12.4,'ECHTE MOMENTE.'),(13.8,16.6,'GUTER KAFFEE.')]
def caption(im,t):
    for a,b,s in CAP:
        if a-0.2<=t<=b:
            al=min(ease((t-a+0.2)/0.5),ease((b-t)/0.4))
            L=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(L)
            d.rectangle((0,H-430,W,H),fill=(0,0,0,int(150*al)))
            d.text((70,H-330+int((1-al)*30)),s,font=osw(130),fill=(245,243,238,int(255*al)))
            d.line((72,H-140,72+int(140*al),H-140),fill=(201,150,105,int(255*al)),width=5)
            im.paste(L,(0,0),L)
def endcard(im,t):
    a=ease((t-19.6)/0.8)
    if a<=0:return im
    b=Image.new('RGB',(W,H),(0,0,0));d=ImageDraw.Draw(b)
    d.text((W//2,560),'THE TRIBE',font=ImageFont.truetype(G+'Geist-Medium.ttf',54),fill=(245,243,238),anchor='mm')
    d.line((W//2-70,610,W//2+70,610),fill=(201,150,105),width=4)
    d.text((W//2,800),'Coffee',font=ImageFont.truetype(G+'Geist-Bold.ttf',190),fill=(245,243,238),anchor='mm')
    d.text((W//2,990),'Walk',font=ImageFont.truetype(G+'Geist-Bold.ttf',190),fill=(245,243,238),anchor='mm')
    d.text((W//2,1200),'JEDEN SONNTAG',font=osw(96),fill=(245,243,238),anchor='mm')
    d.text((W//2,1320),'Bielefeld & Münster',font=ImageFont.truetype(G+'Geist-Regular.ttf',50),fill=(245,243,238),anchor='mm')
    d.rounded_rectangle((170,1450,W-170,1590),70,outline=(201,150,105),width=4)
    d.text((W//2,1520),'Community · Link in Bio →',font=ImageFont.truetype(G+'Geist-SemiBold.ttf',50),fill=(201,150,105),anchor='mm')
    return Image.blend(im,b,a)
p=subprocess.Popen([F,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i','/home/user/the-tribe-bot/instagram_autopilot/music/upbeat-jazz.mp3','-shortest','-af','afade=t=in:d=0.5,afade=t=out:st=20.5:d=2','-c:v','libx264','-pix_fmt','yuv420p','-crf','19','-preset','medium','-c:a','aac','-b:a','192k','coffee-walk-v2.mp4'],stdin=subprocess.PIPE)
N=int(TOTAL*FPS)
for i in range(N):
    t=i/FPS;live=ease((t-1.8)/1.2)
    c=canvas(i,live);cx,cy,w=cam(t);h=w*H/W
    cx=min(max(cx,w/2),CW-w/2) if w<CW*0.999 else CW/2;cy=min(max(cy,h/2),CH-h/2) if h<CH else CH/2
    box=(max(0,cx-w/2),max(0,cy-h/2),min(CW,cx+w/2),min(CH,cy+h/2))
    im=c.resize((W,H),Image.LANCZOS,box=box) if w<CW*0.999 else c.resize((W,int(W*CH/CW)),Image.LANCZOS)
    if im.size!=(W,H):b=Image.new('RGB',(W,H));b.paste(im,(0,(H-im.height)//2));im=b
    caption(im,t);im=endcard(im,t)
    if i in (15,75,180,320,450,540,630):im.save(f'lv_{i:03d}.jpg')
    p.stdin.write(im.tobytes())
p.stdin.close();p.wait()
