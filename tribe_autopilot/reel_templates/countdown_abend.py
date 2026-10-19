import subprocess
from PIL import Image,ImageDraw,ImageFont,ImageEnhance,ImageFilter
F='/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2'
G='/home/user/the-tribe-bot/instagram_autopilot/fonts/';I='/home/user/the-tribe-bot/tribe_autopilot/images/'
W,H,FPS=1080,1920,30;WH=(245,243,238);CU=(201,150,105)
def osw(s):
    f=ImageFont.truetype('Oswald.ttf',s);f.set_variation_by_name('Bold');return f
def g(n,s):return ImageFont.truetype(G+n,s)
def ease(t):t=max(0,min(1,t));return 1-(1-t)**3
def load(p,bw=False):
    im=Image.open(I+p).convert('RGB');im=ImageEnhance.Color(im).enhance(0 if bw else .85);return ImageEnhance.Contrast(im).enhance(1.1)
def cover(im,z):
    s=max(W/im.width,H/im.height)*z;r=im.resize((int(im.width*s)+1,int(im.height*s)+1),Image.LANCZOS)
    x=(r.width-W)//2;y=(r.height-H)//2;return r.crop((x,y,x+W,y+H))
def txt(im,xy,s,f,fill,a,anchor='la'):
    if a<=0:return
    L=Image.new('RGBA',im.size,(0,0,0,0));D=ImageDraw.Draw(L);D.text((xy[0]+4,xy[1]+4),s,font=f,fill=(0,0,0,int(170*a)),anchor=anchor);D.text(xy,s,font=f,fill=fill+(int(255*a),),anchor=anchor);im.paste(L,(0,0),L)
def shade(im):
    g_=Image.new('L',(W,H));d=ImageDraw.Draw(g_)
    for y in range(H):d.line((0,y,W,y),fill=int(200*max(0,(y-H*.4)/(H*.6))))
    return Image.composite(Image.new('RGB',(W,H)),im,g_)
frames=[]
def scene(photo,time_,title,sub,dur,bw=False,first=False):
    im0=load(photo,bw);n=int(dur*FPS)
    for i in range(n):
        im=shade(ImageEnhance.Brightness(cover(im0,1.12-.1*i/n)).enhance(.8))
        d=ImageDraw.Draw(im);d.text((70,110),'THE TRIBE · MONTAG',font=g('Geist-SemiBold.ttf',38),fill=WH)
        a=ease(i/(3 if first else 6))
        txt(im,(70,1150+int((1-a)*60)),time_,osw(300),WH,a)
        txt(im,(76,1500),title,g('Geist-Bold.ttf',70),WH,ease((i-4)/6))
        txt(im,(78,1600),sub,g('Geist-Medium.ttf',44),CU,ease((i-7)/6))
        if i<3 and not first:im=Image.blend(im,Image.new('RGB',(W,H),(255,255,255)),.5-.17*i)
        frames.append(im)
def end(dur):
    im0=load('bar-tischrunde-gross.jpg');n=int(dur*FPS)
    for i in range(n):
        im=ImageEnhance.Brightness(cover(im0,1.05).filter(ImageFilter.GaussianBlur(18))).enhance(.4)
        txt(im,(W//2,760),'Montagabend.',g('Geist-Bold.ttf',96),WH,ease(i/6),'mm')
        txt(im,(W//2,880),'Nicht allein.',g('Geist-Bold.ttf',96),CU,ease((i-4)/6),'mm')
        txt(im,(W//2,1080),'Wer kommt mit? Frag in der Community.',g('Geist-Medium.ttf',44),WH,ease((i-8)/6),'mm')
        txt(im,(W//2,1200),'App + Community · Link in Bio',g('Geist-SemiBold.ttf',50),CU,ease((i-12)/6),'mm')
        frames.append(im)
scene('wandern-gruppe-ausblick.jpg','18:00','Tribe Powerworkout','Gellershagen Park',2.2,first=True)
scene('club-drei-freunde.jpg','20:00','Pub Quiz','Irish Pub',2.0,bw=True)
scene('bar-tisch-lachen.jpg','20:10','Kino: Verity','Cinemaxx',2.0)
end(3.0)
f0=frames[0]
for k in range(5):frames[-5+k]=Image.blend(frames[-5+k],f0,(k+1)/6)
dur=len(frames)/FPS
p=subprocess.Popen([F,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i','/home/user/the-tribe-bot/instagram_autopilot/music/house-vibes.mp3','-t',str(dur),'-af',f'afade=t=out:st={dur-1}:d=1','-c:v','libx264','-pix_fmt','yuv420p','-crf','19','-c:a','aac','-b:a','192k','reel.mp4'],stdin=subprocess.PIPE)
for k,im in enumerate(frames):
    p.stdin.write(im.tobytes())
    if k%40==20:im.save(f's{k:04d}.jpg')
p.stdin.close();p.wait();print(dur)
