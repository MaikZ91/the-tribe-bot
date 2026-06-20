# -*- coding: utf-8 -*-
import os, json, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

WORK = r"C:\Users\Maik Zschach\the-tribe\tribe-story"
FRAMES = os.path.join(WORK, "frames")
SHEETS = os.path.join(WORK, "sheets")
os.makedirs(FRAMES, exist_ok=True)
os.makedirs(SHEETS, exist_ok=True)

FOLDERS = [
    ("2021", r"D:\Media\Bilder\2021\Bilder 2021\The Tribe_Sofa Konzerte"),
    ("2022", r"D:\Media\Bilder\2022\THE TRIBE.BI"),
    ("2025", r"D:\Media\Bilder\2025\THE TRIBE"),
]
IMG_EXT = (".jpg", ".jpeg", ".png")
VID_EXT = (".mp4", ".mov", ".avi", ".m4v")

ANTON = os.path.join(WORK, "fonts", "Anton-Regular.ttf")
GRO = os.path.join(WORK, "fonts", "FamiljenGrotesk.ttf")

def ffprobe_dur(path):
    try:
        out = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                              "-of","csv=p=0", path], capture_output=True, text=True)
        return float(out.stdout.strip())
    except Exception:
        return 0.0

def extract_frame(path, dst, dur):
    t = max(0.1, min(dur*0.45, dur-0.2)) if dur>0.5 else 0.0
    subprocess.run(["ffmpeg","-y","-v","error","-ss",str(t),"-i",path,
                    "-frames:v","1","-q:v","3",dst], capture_output=True)
    return os.path.exists(dst)

# gather
items = []
for year, folder in FOLDERS:
    if not os.path.isdir(folder):
        continue
    for name in sorted(os.listdir(folder)):
        path = os.path.join(folder, name)
        if not os.path.isfile(path):
            continue
        ext = os.path.splitext(name)[1].lower()
        if ext in IMG_EXT:
            items.append({"year":year,"name":name,"path":path,"type":"photo"})
        elif ext in VID_EXT:
            items.append({"year":year,"name":name,"path":path,"type":"video"})

manifest = []
for i, it in enumerate(items):
    idx = i+1
    it["idx"] = idx
    if it["type"] == "video":
        dur = ffprobe_dur(it["path"])
        it["dur"] = round(dur,1)
        fp = os.path.join(FRAMES, f"f{idx:03d}.jpg")
        ok = extract_frame(it["path"], fp, dur)
        it["thumb_src"] = fp if ok else None
    else:
        it["dur"] = 0
        it["thumb_src"] = it["path"]
    manifest.append({k:it[k] for k in ("idx","year","name","type","dur","path","thumb_src")})

with open(os.path.join(WORK,"manifest.json"),"w",encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)

# build sheets
CELL_W, CELL_IMG_H, LABEL_H = 380, 300, 52
CELL_H = CELL_IMG_H + LABEL_H
COLS = 6
PER_SHEET = COLS * 5  # 30 per sheet
BG = (10,8,7)
PANEL = (22,18,15)
AMBER = (245,162,26)
TEXT = (247,242,234)
MUTED = (168,161,153)

f_idx = ImageFont.truetype(ANTON, 30)
f_name = ImageFont.truetype(GRO, 15)
f_badge = ImageFont.truetype(ANTON, 18)

def fit(im, w, h):
    im = im.convert("RGB")
    iw, ih = im.size
    s = min(w/iw, h/ih)
    nw, nh = max(1,int(iw*s)), max(1,int(ih*s))
    return im.resize((nw,nh), Image.LANCZOS), nw, nh

sheets = [items[i:i+PER_SHEET] for i in range(0,len(items),PER_SHEET)]
for si, group in enumerate(sheets):
    rows = (len(group)+COLS-1)//COLS
    W = COLS*CELL_W
    H = rows*CELL_H + 60
    sheet = Image.new("RGB",(W,H),BG)
    d = ImageDraw.Draw(sheet)
    d.text((16,16), f"THE TRIBE — CONTACT SHEET {si+1}/{len(sheets)}", font=f_badge, fill=AMBER)
    for j, it in enumerate(group):
        r, c = divmod(j, COLS)
        x = c*CELL_W
        y = 60 + r*CELL_H
        d.rectangle([x+4,y+4,x+CELL_W-4,y+CELL_H-4], fill=PANEL)
        # image
        try:
            if it["thumb_src"] and os.path.exists(it["thumb_src"]):
                im, nw, nh = fit(Image.open(it["thumb_src"]), CELL_W-16, CELL_IMG_H-8)
                ox = x + (CELL_W-nw)//2
                oy = y + 4 + (CELL_IMG_H-nh)//2
                sheet.paste(im,(ox,oy))
            else:
                d.text((x+16,y+120),"[no preview]",font=f_name,fill=MUTED)
        except Exception as e:
            d.text((x+16,y+120),f"[err]",font=f_name,fill=MUTED)
        # index badge
        d.rectangle([x+6,y+6,x+58,y+44], fill=(0,0,0))
        d.text((x+12,y+6), f"{it['idx']}", font=f_idx, fill=AMBER)
        # label
        ly = y+CELL_IMG_H+2
        tag = ("VIDEO %ss"%it["dur"]) if it["type"]=="video" else "FOTO"
        d.text((x+10,ly), f"{it['year']} · {tag}", font=f_name, fill=AMBER)
        nm = it["name"]
        if len(nm)>40: nm = nm[:37]+"..."
        d.text((x+10,ly+22), nm, font=f_name, fill=MUTED)
    out = os.path.join(SHEETS, f"sheet_{si+1:02d}.png")
    sheet.save(out)
    print("wrote", out, sheet.size)

print("TOTAL items:", len(items), "sheets:", len(sheets))
