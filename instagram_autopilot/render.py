"""Render Instagram posts (reels + carousels) from JSON specs.

A post spec lives in ``posts/<id>.json``. Reels are drawn frame by frame with
Pillow, voiced with a local Piper TTS voice and a self-synthesised music bed,
and encoded with ffmpeg. Carousels are rendered as 1080x1350 JPEGs.
No generative image/video models are involved, so the output is free to
produce and never shows AI-generated people.
"""
from __future__ import annotations

import io
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import wave
import zlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
CONFIG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
FONT_DIR = ROOT / "fonts"
VOICE_DIR = Path(os.getenv("PIPER_VOICE_DIR", ROOT / ".voices"))
FPS = 30
SR = 48000
W, H_REEL, H_CAROUSEL = 1080, 1920, 1350
MARGIN_X = 90


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


B = {k: hex_rgb(v) for k, v in CONFIG["brand"].items()}


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / f"Geist-{weight}.ttf"), size)


def ffmpeg_exe() -> str:
    exe = os.getenv("FFMPEG") or shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


# --------------------------------------------------------------------------
# Audio
# --------------------------------------------------------------------------

def ensure_voice(name: str) -> Path:
    """Download the Piper voice once (cached between workflow runs)."""
    VOICE_DIR.mkdir(parents=True, exist_ok=True)
    lang = name.split("-")[0]              # de_DE
    speaker, quality = name.split("-")[1], name.split("-")[2]
    base = (f"https://huggingface.co/rhasspy/piper-voices/resolve/main/"
            f"{lang.split('_')[0]}/{lang}/{speaker}/{quality}/{name}")
    model = VOICE_DIR / f"{name}.onnx"
    for suffix in (".onnx", ".onnx.json"):
        target = VOICE_DIR / f"{name}{suffix}"
        if not target.exists() or target.stat().st_size == 0:
            urllib.request.urlretrieve(base + suffix, target)
    return model


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as w:
        sr = w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        if w.getnchannels() > 1:
            data = data.reshape(-1, w.getnchannels()).mean(axis=1)
    return data.astype(np.float32) / 32768.0, sr


def resample(x: np.ndarray, sr_in: int, sr_out: int = SR) -> np.ndarray:
    if sr_in == sr_out or len(x) == 0:
        return x
    n = int(len(x) * sr_out / sr_in)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def tts(text: str) -> np.ndarray:
    """Synthesise one line with Piper; returns mono float32 at SR."""
    if not text.strip():
        return np.zeros(0, dtype=np.float32)
    model = ensure_voice(CONFIG["voice"])
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "line.wav"
        subprocess.run(
            [sys.executable, "-m", "piper", "-m", str(model), "-f", str(out),
             "--length-scale", str(CONFIG.get("voice_length_scale", 1.0)),
             "--sentence-silence", "0.25"],
            input=text.encode("utf-8"), check=True, capture_output=True)
        x, sr = read_wav(out)
    return resample(x, sr)


def music_bed(seconds: float, seed: int) -> np.ndarray:
    """Soft self-synthesised pad (no third-party music, no licence issues)."""
    rng = np.random.default_rng(seed)
    t = np.arange(int(seconds * SR)) / SR
    progressions = [
        [(57, 60, 64, 67), (53, 57, 60, 64), (48, 52, 55, 59), (55, 59, 62, 65)],
        [(50, 53, 57, 60), (46, 50, 53, 57), (43, 47, 50, 53), (45, 49, 52, 55)],
        [(52, 55, 59, 62), (48, 52, 55, 59), (53, 57, 60, 64), (55, 59, 62, 66)],
    ]
    chords = progressions[int(rng.integers(len(progressions)))]
    bar = 4.0
    out = np.zeros_like(t)
    for i, chord in enumerate(chords * int(math.ceil(seconds / (bar * len(chords))) + 1)):
        start = i * bar
        if start > seconds:
            break
        seg = (t >= start) & (t < start + bar + 1.5)
        tt = t[seg] - start
        env = np.minimum(tt / 1.2, 1.0) * np.exp(-np.maximum(tt - bar, 0) * 2.2)
        for note in chord:
            f = 440.0 * 2 ** ((note - 69) / 12)
            out[seg] += env * (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt)) / len(chord)
    kernel = np.ones(24) / 24                     # gentle low-pass
    out = np.convolve(out, kernel, mode="same")
    fade = np.minimum(1.0, np.minimum(t / 1.5, (seconds - t) / 1.5))
    out *= np.clip(fade, 0, 1)
    out /= max(1e-6, np.abs(out).max())
    return (out * 10 ** (CONFIG.get("music_volume_db", -27) / 20)).astype(np.float32)


def write_wav(path: Path, x: np.ndarray) -> None:
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# --------------------------------------------------------------------------
# Drawing helpers
# --------------------------------------------------------------------------

def ease(x: float) -> float:
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def wrap(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    lines: list[str] = []
    for para in text.split("\n"):
        cur = ""
        for word in para.split():
            test = f"{cur} {word}".strip()
            if draw.textlength(test, font=f) <= max_w:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                cur = word
        lines.append(cur)
    return lines


def blend(c1, c2, a: float):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * a) for i in range(3))


class Canvas:
    """Background + chrome shared by every frame of one post."""

    def __init__(self, height: int, seed: int):
        self.h = height
        rng = np.random.default_rng(seed)
        self.blob_phase = float(rng.uniform(0, 6.28))
        size = 1400
        blob = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(blob)
        d.ellipse([300, 300, size - 300, size - 300], fill=B["accent2"] + (48,))
        self.blob = blob.filter(ImageFilter.GaussianBlur(160))
        self.small = font("Medium", 34)

    def base(self, t: float, page: str | None = None) -> Image.Image:
        img = Image.new("RGB", (W, self.h), B["bg"])
        x = int(W * 0.55 + 180 * math.sin(t * 0.25 + self.blob_phase)) - 700
        y = int(self.h * 0.35 + 140 * math.cos(t * 0.2 + self.blob_phase)) - 700
        img.paste(self.blob, (x, y), self.blob)
        d = ImageDraw.Draw(img)
        top = 150 if self.h == H_REEL else 70
        d.ellipse([MARGIN_X, top + 6, MARGIN_X + 22, top + 28], fill=B["accent"])
        d.text((MARGIN_X + 38, top), CONFIG["handle_line"], font=self.small, fill=B["text"])
        if page:
            tw = d.textlength(page, font=self.small)
            d.text((W - MARGIN_X - tw, top), page, font=self.small, fill=B["muted"])
        return img


# Each slide renderer draws the slide at local time t (seconds) of total dur.
# For carousels t == dur, i.e. the final, fully revealed state.

def text_block(d, lines, f, x, y, color, t, start, stagger=0.09, line_gap=1.18):
    """Draw lines with a staggered slide-up reveal; returns the bottom y."""
    lh = int(f.size * line_gap)
    for i, line in enumerate(lines):
        a = ease((t - start - i * stagger) / 0.45)
        if a <= 0:
            continue
        col = blend(B["bg"], color, a)
        d.text((x, y + i * lh + int((1 - a) * 40)), line, font=f, fill=col)
    return y + len(lines) * lh


def slide_hook(img, s, t, dur, h):
    d = ImageDraw.Draw(img)
    f = font("Bold", 104 if h == H_REEL else 92)
    lines = wrap(d, s["text"], f, W - 2 * MARGIN_X)
    fs = font("Medium", 46)
    sub = wrap(d, s.get("sub", ""), fs, W - 2 * MARGIN_X) if s.get("sub") else []
    total = len(lines) * int(f.size * 1.18) + (40 + len(sub) * int(fs.size * 1.3) if sub else 0)
    y = (h - total) // 2 - (60 if h == H_REEL else 0)
    y = text_block(d, lines, f, MARGIN_X, y, B["text"], t, 0.05)
    if sub:
        text_block(d, sub, fs, MARGIN_X, y + 40, B["muted"], t, 0.35 + 0.09 * len(lines), line_gap=1.3)


def slide_point(img, s, t, dur, h):
    d = ImageDraw.Draw(img)
    ft, fb, fn = font("Bold", 84), font("Medium", 50), font("SemiBold", 44)
    title = wrap(d, s["title"], ft, W - 2 * MARGIN_X)
    body = wrap(d, s.get("body", ""), fb, W - 2 * MARGIN_X) if s.get("body") else []
    total = (90 if s.get("num") else 0) + len(title) * int(84 * 1.15) + (36 + len(body) * int(50 * 1.35) if body else 0)
    y = (h - total) // 2 - (60 if h == H_REEL else 0)
    if s.get("num"):
        a = ease(t / 0.4)
        if s["num"] == "✓":   # Geist has no check glyph -> draw it
            d.rounded_rectangle([MARGIN_X, y, MARGIN_X + 96, y + 66], 33, fill=blend(B["bg"], B["accent"], a))
            d.line([(MARGIN_X + 30, y + 34), (MARGIN_X + 43, y + 47), (MARGIN_X + 67, y + 21)],
                   fill=(255, 255, 255), width=7, joint="curve")
        else:
            d.rounded_rectangle([MARGIN_X, y, MARGIN_X + 34 + d.textlength(s["num"], font=fn) + 34, y + 66], 33,
                                fill=blend(B["bg"], B["accent"], a))
            d.text((MARGIN_X + 34, y + 9), s["num"], font=fn, fill=(255, 255, 255))
        y += 96
    y = text_block(d, title, ft, MARGIN_X, y, B["text"], t, 0.15, line_gap=1.15)
    if body:
        text_block(d, body, fb, MARGIN_X, y + 36, B["muted"], t, 0.45, line_gap=1.35)


def slide_flow(img, s, t, dur, h):
    d = ImageDraw.Draw(img)
    ft, fs, fn = font("Bold", 70), font("SemiBold", 46), font("Bold", 40)
    steps = s["steps"]
    n = len(steps)
    card_h = 150 if h == H_REEL else 128
    gap = 70 if h == H_REEL else 44
    title = wrap(d, s.get("title", ""), ft, W - 2 * MARGIN_X) if s.get("title") else []
    total = len(title) * int(70 * 1.15) + (60 if title else 0) + n * card_h + (n - 1) * gap
    y = (h - total) // 2 - (40 if h == H_REEL else -20)
    y = text_block(d, title, ft, MARGIN_X, y, B["text"], t, 0.0, line_gap=1.15) + (60 if title else 0)
    for i, step in enumerate(steps):
        on_at = 0.5 + i * max(0.6, (dur - 1.2) / max(n, 1))
        appear = ease((t - 0.25 - i * 0.12) / 0.4)
        active = ease((t - on_at) / 0.35)
        if appear <= 0:
            continue
        top = y + i * (card_h + gap) + int((1 - appear) * 30)
        box = [MARGIN_X, top, W - MARGIN_X, top + card_h]
        d.rounded_rectangle(box, 34, fill=blend(B["bg"], B["card"], appear),
                            outline=blend(B["card"], B["accent"], active), width=5)
        cx, cy, r = MARGIN_X + 80, top + card_h // 2, 38
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=blend((210, 214, 222), B["accent"], active))
        num = str(i + 1)
        d.text((cx - d.textlength(num, font=fn) / 2, cy - 25), num, font=fn, fill=(255, 255, 255))
        lines = wrap(d, step, fs, W - 2 * MARGIN_X - 190)
        ty = cy - len(lines) * 29
        for j, line in enumerate(lines):
            d.text((MARGIN_X + 150, ty + j * 58), line, font=fs,
                   fill=blend((150, 150, 150), B["text"], max(active, 0.35 if t < on_at else 1)))
        if i < n - 1 and appear >= 1:
            ax = W // 2
            d.polygon([(ax - 18, top + card_h + gap // 2 - 8), (ax + 18, top + card_h + gap // 2 - 8),
                       (ax, top + card_h + gap // 2 + 14)], fill=blend((190, 190, 190), B["accent"], active))


def slide_stat(img, s, t, dur, h):
    d = ImageDraw.Draw(img)
    fl, ff = font("SemiBold", 58), font("Regular", 36)
    value = float(s["value"])
    final = f"{value:,.0f}".replace(",", ".") + s.get("suffix", "")
    size = 230
    while size > 90 and d.textlength(final, font=font("Bold", size)) > W - 2 * MARGIN_X:
        size -= 10
    fbig = font("Bold", size)
    shown = value * ease(t / max(0.9, dur * 0.5))
    txt = f"{shown:,.0f}".replace(",", ".") + s.get("suffix", "")
    y = h // 2 - 260
    d.text((MARGIN_X, y), txt, font=fbig, fill=B["accent"])
    y = text_block(d, wrap(d, s.get("label", ""), fl, W - 2 * MARGIN_X), fl, MARGIN_X, y + 270, B["text"], t, 0.3)
    if s.get("note"):
        text_block(d, wrap(d, s["note"], ff, W - 2 * MARGIN_X), ff, MARGIN_X, y + 30, B["muted"], t, 0.6)


def slide_cta(img, s, t, dur, h):
    d = ImageDraw.Draw(img)
    ft, fb, fs = font("Bold", 80), font("Bold", 60), font("Medium", 44)
    y = h // 2 - 280
    if s.get("text"):
        y = text_block(d, wrap(d, s["text"], ft, W - 2 * MARGIN_X), ft, MARGIN_X, y, B["text"], t, 0.0, line_gap=1.15) + 70
    a = ease((t - 0.3) / 0.45)
    label = CONFIG["cta_title"]
    bw = d.textlength(label, font=fb) + 120
    pulse = 1 + 0.025 * math.sin(t * 4) if a >= 1 else 1
    x0, y0 = MARGIN_X, y + int((1 - a) * 30)
    d.rounded_rectangle([x0, y0, x0 + bw * pulse, y0 + 140 * pulse], 70, fill=blend(B["bg"], B["accent"], a))
    d.text((x0 + 60, y0 + 34), label, font=fb, fill=blend(B["bg"], (255, 255, 255), a))
    text_block(d, [CONFIG["cta_sub"]], fs, MARGIN_X + 8, y0 + 180, B["muted"], t, 0.55)


RENDERERS = {"hook": slide_hook, "point": slide_point, "flow": slide_flow,
             "stat": slide_stat, "cta": slide_cta}


def draw_slide(canvas: Canvas, s: dict, t: float, dur: float, page: str | None = None) -> Image.Image:
    img = canvas.base(t, page)
    RENDERERS[s["kind"]](img, s, t, dur, canvas.h)
    return img


# --------------------------------------------------------------------------
# Post renderers
# --------------------------------------------------------------------------

def render_reel(spec: dict, out_dir: Path) -> dict:
    seed = zlib.crc32(spec["id"].encode())
    canvas = Canvas(H_REEL, seed)
    lines = [tts(s.get("voice", "")) for s in spec["slides"]]
    durs = [max(s.get("min_seconds", 2.4), len(v) / SR + 0.75) for s, v in zip(spec["slides"], lines)]
    total = sum(durs) + 0.3
    audio = music_bed(total, seed)
    pos = 0.0
    for v, dur in zip(lines, durs):
        start = int((pos + 0.3) * SR)
        audio[start:start + len(v)] += v[: max(0, len(audio) - start)] * 0.95
        pos += dur
    out_dir.mkdir(parents=True, exist_ok=True)
    wav = out_dir / "audio.wav"
    write_wav(wav, audio / max(1.0, float(np.abs(audio).max())))

    mp4 = out_dir / "reel.mp4"
    cmd = [ffmpeg_exe(), "-y", "-v", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H_REEL}", "-r", str(FPS), "-i", "-",
           "-i", str(wav),
           "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-preset", "medium",
           "-crf", "20", "-maxrate", "8M", "-bufsize", "16M", "-g", str(FPS * 2),
           "-c:a", "aac", "-ar", str(SR), "-b:a", "128k", "-ac", "2",
           "-shortest", "-movflags", "+faststart", str(mp4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    cover = None
    bar_y = H_REEL - 70
    elapsed = 0.0
    for s, dur in zip(spec["slides"], durs):
        for k in range(int(round(dur * FPS))):
            t = k / FPS
            img = draw_slide(canvas, s, t, dur)
            d = ImageDraw.Draw(img)
            prog = (elapsed + t) / total
            d.rectangle([0, bar_y, W, bar_y + 8], fill=(214, 214, 214))
            d.rectangle([0, bar_y, int(W * prog), bar_y + 8], fill=B["accent"])
            if cover is None and s is spec["slides"][0] and t >= dur - 1 / FPS:
                cover = img.copy()
            proc.stdin.write(img.tobytes())
        elapsed += dur
    for _ in range(int(0.3 * FPS)):
        proc.stdin.write(img.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("ffmpeg failed")
    wav.unlink()
    (cover or img).convert("RGB").save(out_dir / "cover.jpg", quality=92)
    return {"video": "reel.mp4", "cover": "cover.jpg", "seconds": round(total, 2)}


def render_carousel(spec: dict, out_dir: Path) -> dict:
    seed = zlib.crc32(spec["id"].encode())
    canvas = Canvas(H_CAROUSEL, seed)
    out_dir.mkdir(parents=True, exist_ok=True)
    files = []
    n = len(spec["slides"])
    for i, s in enumerate(spec["slides"]):
        img = draw_slide(canvas, s, 99.0, 1.0, page=f"{i + 1}/{n}")
        if i == 0 and n > 1:
            d = ImageDraw.Draw(img)
            f = font("SemiBold", 40)
            hint = "Swipe →"
            d.text((W - MARGIN_X - d.textlength(hint, font=f), H_CAROUSEL - 110), hint, font=f, fill=B["accent"])
        name = f"slide_{i + 1:02d}.jpg"
        img.convert("RGB").save(out_dir / name, quality=92)
        files.append(name)
    return {"images": files}


def render(spec: dict, out_dir: Path) -> dict:
    if spec["type"] == "reel":
        return render_reel(spec, out_dir)
    if spec["type"] == "carousel":
        return render_carousel(spec, out_dir)
    raise ValueError(f"unknown post type {spec['type']}")


if __name__ == "__main__":
    # python render.py posts/001-x.json out/
    spec_path, out = Path(sys.argv[1]), Path(sys.argv[2])
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    print(json.dumps(render(spec, out / spec["id"]), indent=2))
