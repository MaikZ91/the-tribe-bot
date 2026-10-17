import subprocess,os,glob
from PIL import Image,ImageDraw,ImageFont,ImageEnhance,ImageFilter
F='/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2'
W,H,FPS=1080,1920,30
G='/home/user/the-tribe-bot/instagram_autopilot/fonts/'
def osw(s,w='Bold'):
    f=ImageFont.truetype('Oswald.ttf',s);f.set_variation_by_name(w);return f
def geist(n,s):return ImageFont.truetype(G+n,s)
WH=(245,243,238);GOLD=(201,150,105)
def ease(t):t=max(0,min(1,t));return 1-(1-t)**3
def frames(id,start,dur):
    d=f'fr/{id}';os.makedirs(d,exist_ok=True)
    if not glob.glob(d+'/*.jpg'):
        subprocess.run([F,'-v','error','-ss',str(start),'-t',str(dur+.3),'-i',f'stock/{id}.mp4','-vf',f'crop=ih*9/16:ih,scale={W}:{H},fps={FPS}','-q:v','3',d+'/%04d.jpg'],check=True)
    return sorted(glob.glob(d+'/*.jpg'))
def alpha_text(im,xy,s,f,fill,a,anchor='la'):
    if a<=0:return
    L=Image.new('RGBA',im.size,(0,0,0,0));ImageDraw.Draw(L).text(xy,s,font=f,fill=fill+(int(255*a),),anchor=anchor);im.paste(L,(0,0),L)
def grade(im):
    im=ImageEnhance.Color(im).enhance(.55);im=ImageEnhance.Contrast(im).enhance(1.15);im=ImageEnhance.Brightness(im).enhance(.6)
    g=Image.new('L',(W,H));dr=ImageDraw.Draw(g)
    for y in range(H):dr.line((0,y,W,y),fill=int(235*max(0,(y-H*.45)/(H*.55))))
    return Image.composite(Image.new('RGB',(W,H),(0,0,0)),im,g)
def brand(im):
    d=ImageDraw.Draw(im);d.text((W//2,150),'THE TRIBE',font=geist('Geist-SemiBold.ttf',44),fill=WH,anchor='mm')
    d.line((W//2-60,195,W//2+60,195),fill=GOLD,width=3)
scenes=[]
def clip(id,start,dur,big,small=None):
    fr=frames(id,start,dur)
    def r(i,n):
        im=grade(Image.open(fr[min(i,len(fr)-1)]).convert('RGB'))
        z=1+.05*i/n;w2,h2=int(W*z),int(H*z);im=im.resize((w2,h2)).crop(((w2-W)//2,(h2-H)//2,(w2-W)//2+W,(h2-H)//2+H))
        brand(im);a=ease(i/9);y=1240+int((1-a)*50)
        for k,s in enumerate(big):alpha_text(im,(80,y+k*185),s,osw(160),WH,ease((i-k*4)/9))
        if small:
            yy=y+len(big)*185+75;ImageDraw.Draw(im).line((80,yy,80+int(160*ease((i-6)/10)),yy),fill=WH,width=4)
            alpha_text(im,(80,yy+40),small,geist('Geist-Medium.ttf',46),WH,ease((i-8)/9))
        return im
    scenes.append((dur,r))
fl=Image.open('flyer.png').convert('RGB')
def flyer(dur):
    def r(i,n):
        b=Image.new('RGB',(W,H),(0,0,0))
        z=1.35-.35*ease(i/(n*.7));fw=int(W*z);fh=int(fw*fl.height/fl.width);f2=fl.resize((fw,fh),Image.LANCZOS)
        x=(W-fw)//2;y=(H-fh)//2+int((fh-H)*.0)
        b.paste(f2,(x,y));a=ease(i/8)
        if a<1:b=Image.blend(Image.new('RGB',(W,H),(0,0,0)),b,a)
        return b
    scenes.append((dur,r))
def card(dur):
    def r(i,n):
        im=Image.new('RGB',(W,H),(0,0,0));brand(im);d=ImageDraw.Draw(im)
        L=[('JEDEN SONNTAG',osw(120),0),('Bielefeld & Münster',geist('Geist-Medium.ttf',58),5),('Wechselnde Cafés.',geist('Geist-Regular.ttf',52),8),('Treffpunkt in der Gruppe.',geist('Geist-Regular.ttf',52),11),('Link in Bio →',geist('Geist-SemiBold.ttf',72),16)]
        y=700
        for s,f,dl in L:
            a=ease((i-dl)/9);alpha_text(im,(W//2,y+int((1-a)*30)),s,f,GOLD if s.startswith('Link') else WH,a,'mm');y+=f.size+70
        return im
    scenes.append((dur,r))
clip('41865',3,2.6,['SONNTAG.'],'Kaffee in der Hand.')
clip('810',2,2.6,['GUTER','KAFFEE.'])
clip('4519',1,2.8,['GUTE','LEUTE.'])
clip('5891',1,2.8,['ECHTE','MOMENTE.'])
clip('25890',2,2.8,['DURCH DIE','STADT.'],'Neue Menschen im Blick.')
flyer(4.5)
card(3.5)
p=subprocess.Popen([F,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i','/home/user/the-tribe-bot/instagram_autopilot/music/upbeat-jazz.mp3','-shortest','-af','afade=t=out:st=19:d=2','-c:v','libx264','-pix_fmt','yuv420p','-crf','19','-c:a','aac','-b:a','192k','coffee-walk.mp4'],stdin=subprocess.PIPE)
k=0
for dur,r in scenes:
    n=int(dur*FPS)
    for i in range(n):
        im=r(i,n)
        if i<5 and k>0:im=Image.blend(prev,im,(i+1)/6)
        p.stdin.write(im.tobytes())
        if i==n//2:im.save(f'shot{k}.jpg')
        prev=im
    k+=1
p.stdin.close();p.wait()
