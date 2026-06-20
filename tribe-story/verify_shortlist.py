# -*- coding: utf-8 -*-
import os, json, subprocess
from PIL import Image, ImageDraw, ImageFont

WORK = r"C:\Users\Maik Zschach\the-tribe\tribe-story"
TMP = os.path.join(WORK, "vtmp"); os.makedirs(TMP, exist_ok=True)
OUT = os.path.join(WORK, "verify"); os.makedirs(OUT, exist_ok=True)
manifest = {m["idx"]: m for m in json.load(open(os.path.join(WORK,"manifest.json"),encoding="utf-8"))}

ANTON = os.path.join(WORK,"fonts","Anton-Regular.ttf")
GRO = os.path.join(WORK,"fonts","FamiljenGrotesk.ttf")

SHORTLIST = [
 5,6,16,13,4,2,3,27,29,31,33,34,43,49,52,
 55,65,66,95,96,109,98,100,102,87,137,129,114,116,
 142,143,147,148,149,151,152,154,146,153,156,138,139,141
]

def frame(path, ss, dst, w=300):
    subprocess.run(["ffmpeg","-y","-v","error","-ss",str(ss),"-i",path,"-frames:v","1",
                    "-vf",f"scale={w}:-1",dst],capture_output=True)
    return os.path.exists(dst)

def fit(im,w,h):
    im=im.convert("RGB"); iw,ih=im.size; s=min(w/iw,h/ih)
    return im.resize((max(1,int(iw*s)),max(1,int(ih*s))),Image.LANCZOS)

CW,CH,LH = 860,520,46
COLS=3
BG=(10,8,7); PANEL=(20,16,13); AMBER=(245,162,26); MUTED=(168,161,153)
f_idx=ImageFont.truetype(ANTON,34); f_lab=ImageFont.truetype(GRO,17)

cells=[]
for idx in SHORTLIST:
    m=manifest[idx]; cell=Image.new("RGB",(CW,CH+LH),PANEL); d=ImageDraw.Draw(cell)
    area_w,area_h=CW-20,CH-20
    if m["type"]=="photo":
        try:
            im=fit(Image.open(m["path"]),area_w,area_h)
            cell.paste(im,((CW-im.width)//2,10+(area_h-im.height)//2))
        except Exception as e: d.text((20,20),f"err {e}",font=f_lab,fill=MUTED)
    else:
        dur=m["dur"] or 6; offs=[max(0.3,dur*0.2),dur*0.5,min(dur-0.3,dur*0.8)]
        fw=area_w//3
        for i,ss in enumerate(offs):
            fp=os.path.join(TMP,f"v{idx}_{i}.jpg")
            if frame(m["path"],round(ss,1),fp,fw):
                try:
                    im=fit(Image.open(fp),fw-6,area_h)
                    cell.paste(im,(10+i*fw+(fw-im.width)//2,10+(area_h-im.height)//2))
                except: pass
    d.rectangle([6,6,70,46],fill=(0,0,0)); d.text((12,6),str(idx),font=f_idx,fill=AMBER)
    tag=("VIDEO %ss"%m["dur"]) if m["type"]=="video" else "FOTO"
    d.text((12,CH+6),f"#{idx} · {m['year']} · {tag} · {m['name'][:46]}",font=f_lab,fill=AMBER)
    cells.append((idx,cell))

per=9
sheets=[cells[i:i+per] for i in range(0,len(cells),per)]
for si,grp in enumerate(sheets):
    rows=(len(grp)+COLS-1)//COLS
    W=COLS*CW; H=rows*(CH+LH)+50
    sh=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(sh)
    d.text((16,12),f"VERIFY {si+1}/{len(sheets)}",font=ImageFont.truetype(ANTON,24),fill=AMBER)
    for j,(idx,cell) in enumerate(grp):
        r,c=divmod(j,COLS); sh.paste(cell,(c*CW,50+r*(CH+LH)))
    p=os.path.join(OUT,f"verify_{si+1}.png"); sh.save(p); print("wrote",p,sh.size)
print("done",len(cells),"cells")
