"""Build the community-poll reel (9:16, 1080x1920, 30 fps).

Pass 1 renders every shot to an intermediate clip on the musical beat grid,
pass 2 joins them, lays the German text overlays on top and mixes the music.
"""
import os, subprocess, sys, math
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
FF = imageio_ffmpeg.get_ffmpeg_exe()
SRC = os.path.join(HERE, 'assets', 'src')      # stock footage, see fetch_assets.py
OV = os.path.join(HERE, 'overlays')            # text cards, see build_overlays.py
SEG = os.path.join(HERE, 'seg')                # per-shot intermediates
OUT = os.path.join(HERE, 'out')
MUSIC = os.path.join(HERE, 'assets', 'mus', '124.mp3')

W, H, FPS = 1080, 1920, 30
BPM = 124.0
BEAT = 60.0 / BPM              # 0.483871 s
MUSIC_IN = 58.540              # downbeat inside the track's high-energy section

# Colour treatment per event side.
GRADE = {
    # golden hour, open air
    'warm': "eq=contrast=1.08:saturation=1.20:brightness=0.012,"
            "colorbalance=rm=0.07:rh=0.05:gm=0.01:bm=-0.06:bh=-0.05",
    # neon club, violet cast
    'cool': "eq=contrast=1.13:saturation=1.18:brightness=-0.004,"
            "colorbalance=rm=0.04:rh=0.03:gm=-0.03:bm=0.08:bh=0.06",
}
FINISH = "vignette=PI/4.6,unsharp=5:5:0.55:5:5:0.0,noise=alls=4:allf=t"

# ── shot list ────────────────────────────────────────────────────────────────
# kind 'clip':  (id, in-point, beats, grade, zoom-in?, horizontal crop centre 0..1)
# kind 'split': two of those, left half = option A, right half = option B
SHOTS = [
    # hook — daylight open air vs. neon club, side by side
    dict(kind='split', beats=6, left=('4556', 10.6, 'warm', True,  0.50),
                                right=('4187', 0.8, 'cool', False, 0.50)),

    # A — Silent Disco (15 beats)
    dict(kind='clip', beats=3, clip=('51295', 6.6, 'warm', True,  0.50)),
    dict(kind='clip', beats=2, clip=('21239', 1.4, 'warm', False, 0.62)),
    dict(kind='clip', beats=3, clip=('4636', 1.6, 'warm', True,  0.50)),
    dict(kind='clip', beats=2, clip=('4556', 21.6, 'warm', False, 0.50)),
    dict(kind='clip', beats=3, clip=('4269', 0.8, 'warm', True,  0.50)),
    dict(kind='clip', beats=2, clip=('4664', 0.8, 'warm', False, 0.50)),

    # switch
    dict(kind='split', beats=2, left=('4636', 8.6, 'warm', True,  0.50),
                                right=('33906', 17.6, 'cool', True, 0.50)),

    # B — Techno × Paint (15 beats)
    dict(kind='clip', beats=3, clip=('4187', 3.4, 'cool', True,  0.50)),
    dict(kind='clip', beats=2, clip=('43444', 8.8, 'cool', False, 0.50)),
    dict(kind='clip', beats=3, clip=('33906', 10.6, 'cool', True,  0.50)),
    dict(kind='clip', beats=2, clip=('43427', 2.8, 'cool', False, 0.50)),
    dict(kind='clip', beats=3, clip=('33899', 8.6, 'cool', True,  0.50)),
    dict(kind='clip', beats=2, clip=('41996', 2.8, 'cool', False, 0.50)),

    # outro — both options on screen again while the CTA sits on top
    dict(kind='split', beats=8, left=('51295', 12.6, 'warm', True,  0.50),
                                right=('33906', 2.6, 'cool', True, 0.50)),
]

# ── text overlays: png, start, end, fade-in, fade-out ────────────────────────
def overlays(t):
    """t = cumulative segment start times (seconds), one entry per shot."""
    return [
        ('hook.png',    t[0] + 0.15, t[1] - 0.05, 0.35, 0.25),
        ('label_a.png', t[1] + 0.12, t[4],        0.30, 0.30),
        ('vs.png',      t[7],        t[8],        0.12, 0.12),
        ('label_b.png', t[8] + 0.12, t[11],       0.30, 0.30),
        ('outro_a.png', t[14] + 0.10, None,       0.35, 0.0),
        ('outro_b.png', t[14] + 1.05, None,       0.30, 0.0),
    ]


def run(args):
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode:
        print(' '.join(args[:14]), '...\n', p.stderr[-2500:], file=sys.stderr)
        raise SystemExit(f'ffmpeg failed ({p.returncode})')


def shot_chain(label, dur, grade, zoom_in, cx, out_w):
    """Cover-crop a landscape source to `out_w`x1920 with a slow push."""
    frames = max(2, int(round(dur * FPS)))
    tall = 2112                                  # work above target height for zoom room
    win = int(round(out_w / H * tall))           # 9:16 window width at that height
    z0, z1 = (1.10, 1.21) if zoom_in else (1.21, 1.10)
    step = (z1 - z0) / frames
    zexpr = (f"min({z0}+{step:.6f}*on,{z1})" if zoom_in else f"max({z0}{step:.6f}*on,{z1})")
    return (
        f"[{label}]fps={FPS},scale=-2:{tall}:flags=bicubic,"
        f"crop={win}:{tall}:x='(iw-{win})*{cx:.3f}':y=0,"
        f"zoompan=z='{zexpr}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":s={out_w}x{H}:fps={FPS},"
        f"{GRADE[grade]},setsar=1"
    )


def render_clip(spec, dur, dst):
    cid, tin, grade, zoom_in, cx = spec
    chain = shot_chain('0:v', dur, grade, zoom_in, cx, W)
    run([FF, '-v', 'error', '-y', '-ss', str(tin), '-t', f'{dur:.4f}',
         '-i', os.path.join(SRC, f'{cid}.mp4'),
         '-filter_complex', f"{chain},{FINISH}[v]",
         '-map', '[v]', '-an', '-r', str(FPS),
         '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', dst])


def render_split(left, right, dur, dst):
    half = W // 2
    lc = shot_chain('0:v', dur, left[2], left[3], left[4], half)
    rc = shot_chain('1:v', dur, right[2], right[3], right[4], half)
    fc = f"{lc}[l];{rc}[r];[l][r]hstack=inputs=2,{FINISH}[v]"
    run([FF, '-v', 'error', '-y',
         '-ss', str(left[1]), '-t', f'{dur:.4f}', '-i', os.path.join(SRC, f'{left[0]}.mp4'),
         '-ss', str(right[1]), '-t', f'{dur:.4f}', '-i', os.path.join(SRC, f'{right[0]}.mp4'),
         '-filter_complex', fc, '-map', '[v]', '-an', '-r', str(FPS),
         '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', dst])


def build_shots(starts):
    """Pass 1 — cut every shot to the beat grid."""
    t = 0.0
    for i, s in enumerate(SHOTS):
        dur = s['beats'] * BEAT
        starts.append(t)
        dst = os.path.join(SEG, f'{i:02d}.mp4')
        if s['kind'] == 'split':
            render_split(s['left'], s['right'], dur, dst)
        else:
            render_clip(s['clip'], dur, dst)
        print(f"  shot {i:02d}  {t:6.3f}s  +{dur:5.3f}s  {s['kind']}")
        t += dur
    return t


def build_final(starts, total):
    """Pass 2 — join the shots, lay the text over them, mix the music.

    The shots are joined with the concat *filter*, not the concat demuxer:
    stream-copying the h.264 segments together collides their timestamps, which
    silently swallows whole shots and freezes the previous one in their place.

    Each overlay image is looped across the whole timeline so its fade times can
    be given in timeline seconds; the alpha fades keep it invisible outside its
    own window, `enable` keeps ffmpeg from compositing it there at all.
    """
    n_shots = len(SHOTS)
    ins, parts = [], []
    for i in range(n_shots):
        ins += ['-i', os.path.join(SEG, f'{i:02d}.mp4')]
    parts.append(''.join(f'[{i}:v]' for i in range(n_shots)) +
                 f'concat=n={n_shots}:v=1:a=0[base]')
    last = 'base'

    for n, (png, t0, t1, fin, fout) in enumerate(overlays(starts), start=n_shots):
        t1 = total if t1 is None else t1
        ins += ['-loop', '1', '-framerate', str(FPS), '-t', f'{total:.4f}',
                '-i', os.path.join(OV, png)]
        chain = f"[{n}:v]format=rgba,fade=t=in:st={t0:.4f}:d={fin}:alpha=1"
        if fout > 0:
            chain += f",fade=t=out:st={t1 - fout:.4f}:d={fout}:alpha=1"
        parts.append(chain + f"[o{n}]")
        parts.append(f"[{last}][o{n}]overlay=0:0:eof_action=pass:"
                     f"enable='between(t,{t0:.4f},{t1:.4f})'[v{n}]")
        last = f'v{n}'

    ins += ['-ss', f'{MUSIC_IN:.3f}', '-t', f'{total:.4f}', '-i', MUSIC]
    ai = n_shots + len(overlays(starts))
    parts.append(f"[{ai}:a]afade=t=in:st=0:d=0.05,"
                 f"afade=t=out:st={total - 1.4:.3f}:d=1.4[a]")

    final = os.path.join(OUT, 'the-tribe-event-poll-reel.mp4')
    run([FF, '-v', 'error', '-y'] + ins +
        ['-filter_complex', ';'.join(parts),
         '-map', f'[{last}]', '-map', '[a]', '-t', f'{total:.4f}',
         '-c:v', 'libx264', '-crf', '21', '-preset', 'medium', '-profile:v', 'high',
         '-maxrate', '10M', '-bufsize', '16M',
         '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', str(FPS),
         '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', final])
    print(f"\n  → {final}  ({total:.2f}s)")


def main():
    os.makedirs(SEG, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    starts = []
    have_shots = all(os.path.exists(os.path.join(SEG, f'{i:02d}.mp4')) for i in range(len(SHOTS)))
    if '--overlays-only' in sys.argv and have_shots:
        t = 0.0
        for shot in SHOTS:
            starts.append(t)
            t += shot['beats'] * BEAT
        total = t
    else:
        total = build_shots(starts)
    build_final(starts, total)


if __name__ == '__main__':
    main()
