# -*- coding: utf-8 -*-
import os, json, subprocess, sys

WORK = r"C:\Users\Maik Zschach\the-tribe\tribe-story"
SEG  = os.path.join(WORK,"seg"); os.makedirs(SEG, exist_ok=True)
CARDS= os.path.join(WORK,"cards")
CAPS = os.path.join(WORK,"caps")
manifest = {m["idx"]: m for m in json.load(open(os.path.join(WORK,"manifest.json"),encoding="utf-8"))}
BED_SRC = r"D:\Media\Bilder\2022\THE TRIBE.BI\SofaKonzertYvos301022.avi"
BED_START = 15

GRADE = "eq=contrast=1.07:saturation=1.13:brightness=0.012,colorbalance=rm=0.04:rh=0.03:bm=-0.05:bh=-0.03"
VIG = "vignette=PI/4.5"
GRAIN = "noise=alls=6:allf=t"
GRAIN_L = "noise=alls=3:allf=t"

def probe_dims(path):
    out = subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries",
                          "stream=width,height","-of","csv=p=0",path],capture_output=True,text=True)
    try:
        w,h = out.stdout.strip().split(",")[:2]; return int(w),int(h)
    except: return 1080,1920

def kb(idx, zoomin=True):
    if zoomin:
        z="min(1.001+0.00075*on,1.12)"
    else:
        z="max(1.12-0.00075*on,1.0)"
    return (f"zoompan=z='{z}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":s=1080x1920:fps=30")

# ---- TIMELINE ----
# kind: card/still/clip ; for clip: inq fraction ; cap: caption file
T = [
 dict(kind="card", src="title.png", dur=4.4),
 dict(kind="card", src="ch2021.png", dur=2.6),
 dict(kind="still", idx=6,  dur=3.0),
 dict(kind="still", idx=13, dur=2.4),
 dict(kind="still", idx=16, dur=3.0, cap="cap_freunde.png"),
 dict(kind="clip", idx=27, dur=2.6, inq=0.4),
 dict(kind="clip", idx=33, dur=2.8, inq=0.45, cap="cap_leben.png"),
 dict(kind="clip", idx=31, dur=2.4, inq=0.4),
 dict(kind="card", src="ch2022.png", dur=2.6),
 dict(kind="still", idx=129, dur=2.6, grade=False),
 dict(kind="still", idx=55, dur=2.4),
 dict(kind="still", idx=96, dur=3.0, cap="cap_mehr.png"),
 dict(kind="still", idx=65, dur=2.4, cap="cap_stadt.png"),
 dict(kind="still", idx=66, dur=2.2),
 dict(kind="still", idx=100, dur=2.2),
 dict(kind="still", idx=95, dur=2.8),
 dict(kind="card", src="ch2025.png", dur=2.6),
 dict(kind="clip", idx=152, dur=2.8, inq=0.30, raw=True),
 dict(kind="clip", idx=151, dur=3.0, inq=0.28, raw=True),
 dict(kind="clip", idx=147, dur=2.6, inq=0.30, raw=True),
 dict(kind="still", idx=154, dur=2.6, cap="cap_app.png"),
 dict(kind="clip", idx=141, dur=2.4, inq=0.20, raw=True),
 dict(kind="card", src="end.png", dur=5.5),
]

def build(seg, i):
    dur=seg["dur"]; cap=seg.get("cap"); grade=seg.get("grade",True); raw=seg.get("raw",False)
    inputs=[]; fc=""
    fin=f"fade=t=in:st=0:d=0.35,fade=t=out:st={dur-0.4:.2f}:d=0.4"
    if seg["kind"]=="card":
        src=os.path.join(CARDS,seg["src"])
        inputs=["-loop","1","-framerate","30","-t",f"{dur}","-i",src]
        fc=(f"[0:v]scale=1188:2112:force_original_aspect_ratio=increase,crop=1188:2112,setsar=1,"
            f"zoompan=z='min(1.001+0.0004*on,1.05)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,"
            f"{GRAIN_L},{fin}[vout]")
        return inputs,fc
    m=manifest[seg["idx"]]; path=m["path"]; w,h=probe_dims(path); ar=w/h
    cover = ar<=0.82
    if seg["kind"]=="still":
        inputs=["-loop","1","-framerate","30","-t",f"{dur}","-i",path]
        zin = (i%2==0)
        if cover:
            chain=(f"[0:v]scale=1188:2112:force_original_aspect_ratio=increase,crop=1188:2112,setsar=1"
                   + (f",{GRADE},{VIG}" if grade else "")
                   + f",{kb(i,zin)},{GRAIN}[base]")
        else:
            chain=(f"[0:v]split=2[a][b];"
                   f"[a]scale=1188:2112:force_original_aspect_ratio=increase,crop=1188:2112,gblur=sigma=22,eq=brightness=-0.16:saturation=0.5[bg];"
                   f"[b]scale=1188:2112:force_original_aspect_ratio=decrease[fg];"
                   f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1"
                   + (f",{GRADE},{VIG}" if grade else "")
                   + f",{kb(i,zin)},{GRAIN}[base]")
    else: # clip
        dursrc=m["dur"] or (seg["dur"]+1)
        inq=seg.get("inq",0.4); inn=max(0.2,min(dursrc*inq, dursrc-dur-0.3))
        inputs=["-ss",f"{inn:.2f}","-t",f"{dur}","-i",path]
        g = ("eq=contrast=1.04:saturation=1.05" if raw else GRADE)
        gr = (GRAIN_L if raw else GRAIN)
        vg = ("" if raw else f",{VIG}")
        if cover:
            chain=(f"[0:v]fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,"
                   f"{g}{vg},{gr}[base]")
        else:
            chain=(f"[0:v]fps=30,split=2[a][b];"
                   f"[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=22,eq=brightness=-0.16:saturation=0.5[bg];"
                   f"[b]scale=1080:1920:force_original_aspect_ratio=decrease[fg];"
                   f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,"
                   f"{g}{vg},{gr}[base]")
    # caption + fade
    if cap:
        inputs += ["-loop","1","-framerate","30","-t",f"{dur}","-i",os.path.join(CAPS,cap)]
        fc=chain+f";[base][1:v]overlay=0:0,{fin}[vout]"
    else:
        fc=chain+f";[base]{fin}[vout]"
    return inputs,fc

ok=0
for i,seg in enumerate(T):
    out=os.path.join(SEG,f"seg_{i:02d}.mp4")
    inputs,fc=build(seg,i)
    cmd=["ffmpeg","-y","-v","error"]+inputs+["-filter_complex",fc,"-map","[vout]",
         "-r","30","-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p",
         "-an","-video_track_timescale","30000",out]
    r=subprocess.run(cmd,capture_output=True,text=True)
    if r.returncode==0 and os.path.exists(out):
        ok+=1; print(f"OK  seg_{i:02d} {seg['kind']} {seg.get('idx','')} dur={seg['dur']}",flush=True)
    else:
        print(f"FAIL seg_{i:02d} ({seg['kind']} {seg.get('idx','')}):\nCMD FILTER: {fc}\nSTDERR:\n{r.stderr[-1800:]}",flush=True)
print(f"segments: {ok}/{len(T)}")
if ok!=len(T):
    sys.exit("segment failures")

# ---- xfade chain ----
def seg_dur(p):
    o=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p],capture_output=True,text=True)
    return float(o.stdout.strip())
segs=[os.path.join(SEG,f"seg_{i:02d}.mp4") for i in range(len(T))]
durs=[seg_dur(p) for p in segs]
Tx=0.4
inputs=[]
for p in segs: inputs+=["-i",p]
fc=""; prev="0:v"; running=durs[0]
for k in range(1,len(segs)):
    off=running - Tx
    outl=f"x{k}"
    fc+=f"[{prev}][{k}:v]xfade=transition=fade:duration={Tx}:offset={off:.3f}[{outl}];"
    prev=outl; running=running+durs[k]-Tx
fc=fc.rstrip(";")
montage=os.path.join(WORK,"montage_silent.mp4")
cmd=["ffmpeg","-y","-v","error"]+inputs+["-filter_complex",fc,"-map",f"[{prev}]",
     "-r","30","-c:v","libx264","-preset","medium","-crf","18","-pix_fmt","yuv420p","-an",montage]
r=subprocess.run(cmd,capture_output=True,text=True)
if r.returncode!=0: sys.exit("xfade FAIL: "+r.stderr[-800:])
total=seg_dur(montage)
print(f"montage_silent.mp4 dur={total:.2f}s")

# ---- audio bed + mux ----
bed=os.path.join(WORK,"bed.m4a")
af=(f"loudnorm=I=-15:TP=-1.5:LRA=11,"
    f"afade=t=in:st=0:d=1.3,afade=t=out:st={total-2.6:.2f}:d=2.6")
cmd=["ffmpeg","-y","-v","error","-ss",str(BED_START),"-t",f"{total:.2f}","-i",BED_SRC,
     "-vn","-af",af,"-ar","48000","-c:a","aac","-b:a","192k",bed]
r=subprocess.run(cmd,capture_output=True,text=True)
if r.returncode!=0: sys.exit("bed FAIL: "+r.stderr[-600:])

final=os.path.join(WORK,"THE_TRIBE_Story.mp4")
cmd=["ffmpeg","-y","-v","error","-i",montage,"-i",bed,"-map","0:v:0","-map","1:a:0",
     "-c:v","copy","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart",final]
r=subprocess.run(cmd,capture_output=True,text=True)
if r.returncode!=0: sys.exit("mux FAIL: "+r.stderr[-600:])
print("FINAL:",final, f"{seg_dur(final):.2f}s")
