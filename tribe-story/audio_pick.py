# -*- coding: utf-8 -*-
import os, subprocess, wave, audioop, json

WORK = r"C:\Users\Maik Zschach\the-tribe\tribe-story"
TMP = os.path.join(WORK,"atmp"); os.makedirs(TMP, exist_ok=True)
PREV = os.path.join(WORK,"audio-previews"); os.makedirs(PREV, exist_ok=True)

CANDS = [
 ("concertA", r"D:\Media\Bilder\2021\Bilder 2021\The Tribe_Sofa Konzerte\20210827_215228.mp4"),
 ("concertB", r"D:\Media\Bilder\2021\Bilder 2021\The Tribe_Sofa Konzerte\20210827_220102.mp4"),
 ("sofaYvos", r"D:\Media\Bilder\2022\THE TRIBE.BI\SofaKonzertYvos301022.avi"),
]
WIN = 52  # target bed length seconds

def to_wav(path, dst):
    subprocess.run(["ffmpeg","-y","-v","error","-i",path,"-ac","1","-ar","8000",
                    "-vn",dst],capture_output=True)
    return os.path.exists(dst)

def rms_per_sec(wavpath):
    w=wave.open(wavpath,'rb'); sr=w.getframerate(); sw=w.getsampwidth()
    n=w.getnframes(); data=w.readframes(n); w.close()
    persec=[]
    step=sr*sw
    for i in range(0, len(data)-step, step):
        persec.append(audioop.rms(data[i:i+step], sw))
    return persec

best=None
report={}
for tag,path in CANDS:
    wv=os.path.join(TMP,tag+".wav")
    if not to_wav(path,wv):
        report[tag]="wav fail"; continue
    r=rms_per_sec(wv)
    report[tag+"_len"]=len(r)
    if len(r) < 10: continue
    # sliding window score = mean - 0.4*std, prefer loud + consistent
    best_local=None
    L=min(WIN,len(r)-1)
    for s in range(0, len(r)-L):
        seg=r[s:s+L]
        m=sum(seg)/len(seg)
        var=sum((x-m)**2 for x in seg)/len(seg)
        std=var**0.5
        # penalize near-silent seconds count
        quiet=sum(1 for x in seg if x < m*0.3)
        score=m - 0.4*std - quiet*15
        if best_local is None or score>best_local[0]:
            best_local=(score,s,L,m)
    report[tag+"_best"]={"score":round(best_local[0]),"start":best_local[1],"len":best_local[2],"mean":round(best_local[3])}
    print(tag, "->", report[tag+"_best"])
    if best is None or best_local[0]>best[0]:
        best=(best_local[0], tag, path, best_local[1], best_local[2])
    # export a 15s preview from the best local spot for user listening
    ss=best_local[1]
    subprocess.run(["ffmpeg","-y","-v","error","-ss",str(ss),"-t","15","-i",path,
                    "-vn","-af","loudnorm=I=-16:TP=-1.5:LRA=11","-q:a","4",
                    os.path.join(PREV,f"{tag}_preview.mp3")],capture_output=True)

print("\nBEST:", best)
with open(os.path.join(WORK,"audio_pick.json"),"w") as f:
    json.dump({"best":{"tag":best[1],"path":best[2],"start":best[3],"len":best[4]} if best else None,
               "report":report}, f, indent=1)
print("wrote audio_pick.json")
