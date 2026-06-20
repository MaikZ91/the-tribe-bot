# -*- coding: utf-8 -*-
import os, subprocess
from PIL import Image
WORK=r"C:\Users\Maik Zschach\the-tribe\tribe-story"
F=os.path.join(WORK,"THE_TRIBE_Story.mp4")
T=os.path.join(WORK,"vfinal"); os.makedirs(T,exist_ok=True)
stamps=[1.5,5.5,8.5,12.5,17.0,21.0,25.5,30.5,38.0,41.5,46.0,54.5]
imgs=[]
for i,ts in enumerate(stamps):
    o=os.path.join(T,f"f{i:02d}.jpg")
    subprocess.run(["ffmpeg","-y","-v","error","-ss",str(ts),"-i",F,"-frames:v","1","-q:v","3",o],capture_output=True)
    if os.path.exists(o): imgs.append((ts,o))
# montage 3 cols
cols=3; cw,ch=360,640
rows=(len(imgs)+cols-1)//cols
sheet=Image.new("RGB",(cols*cw, rows*ch),(10,8,7))
from PIL import ImageDraw, ImageFont
fnt=ImageFont.truetype(os.path.join(WORK,"fonts","FamiljenGrotesk.ttf"),26)
d=ImageDraw.Draw(sheet)
for j,(ts,p) in enumerate(imgs):
    r,c=divmod(j,cols)
    im=Image.open(p).convert("RGB"); im.thumbnail((cw,ch))
    sheet.paste(im,(c*cw+(cw-im.width)//2, r*ch+(ch-im.height)//2))
    d.text((c*cw+10,r*ch+8),f"t={ts}s",font=fnt,fill=(245,162,26))
out=os.path.join(WORK,"final_overview.png"); sheet.save(out)
print("wrote",out,sheet.size,"frames",len(imgs))
