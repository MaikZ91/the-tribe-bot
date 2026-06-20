# -*- coding: utf-8 -*-
import subprocess, re, json, os

CANDS = [
    ("2021_concert_A", r"D:\Media\Bilder\2021\Bilder 2021\The Tribe_Sofa Konzerte\20210827_215228.mp4", 342),
    ("2021_concert_B", r"D:\Media\Bilder\2021\Bilder 2021\The Tribe_Sofa Konzerte\20210827_220102.mp4", 266),
    ("2021_clip_104",  r"D:\Media\Bilder\2021\Bilder 2021\The Tribe_Sofa Konzerte\20211112_214146.mp4", 104),
    ("2022_neuesvideo",r"D:\Media\Bilder\2022\THE TRIBE.BI\Neues Video.mp4", 214),
    ("2022_sofayvos",  r"D:\Media\Bilder\2022\THE TRIBE.BI\SofaKonzertYvos301022.avi", 121),
    ("2025_youcut242", r"D:\Media\Bilder\2025\THE TRIBE\YouCut_20250702_195030648.mp4", 242),
]

def vol(path, ss, t):
    out = subprocess.run(["ffmpeg","-v","error","-ss",str(ss),"-t",str(t),"-i",path,
                          "-af","volumedetect","-f","null","-"],
                          capture_output=True, text=True)
    txt = out.stderr
    mean = re.search(r"mean_volume:\s*(-?[\d.]+) dB", txt)
    mx = re.search(r"max_volume:\s*(-?[\d.]+) dB", txt)
    return (float(mean.group(1)) if mean else None, float(mx.group(1)) if mx else None)

WIN = 20
results = {}
for tag, path, dur in CANDS:
    if not os.path.exists(path):
        results[tag] = "MISSING"; continue
    rows = []
    ss = 0
    while ss + 5 < dur:
        m, mx = vol(path, ss, min(WIN, dur-ss))
        rows.append({"ss":ss,"mean":m,"max":mx})
        ss += WIN
    results[tag] = rows
    # find best sustained 40s window (3 consecutive ~loud windows)
    print(f"\n=== {tag}  ({dur}s) ===")
    for r in rows:
        bar = ""
        if r["mean"] is not None:
            n = max(0, int((r["mean"]+45)/2))
            bar = "#"*n
        print(f"  t={r['ss']:>4}s  mean={r['mean']}  max={r['max']}  {bar}")

with open(r"C:\Users\Maik Zschach\the-tribe\tribe-story\audio_scan.json","w") as f:
    json.dump(results,f,indent=1)
print("\nDONE")
