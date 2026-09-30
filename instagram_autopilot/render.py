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

CODE = Path(__file__).resolve().parent
ROOT = Path(os.getenv("AUTOPILOT_HOME") or CODE).resolve()   # account folder: config, posts, images
CONFIG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
FONT_DIR = CODE / "fonts"
VOICE_DIR = Path(os.getenv("PIPER_VOICE_DIR", ROOT / ".voices"))
FPS = 30
SR = 48000
W, H_REEL, H_CAROUSEL = 1080, 1920, 1350
MARGIN_X = 90


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


B = {k: hex_rgb(v) for k, v in CONFIG["brand"].items()}
B.setdefault("accent_ink", (255, 255, 255))
B.setdefault("card_ink", (10, 10, 10))      # text on cards
B.setdefault("card_muted", (150, 150, 150))
B["accent_text"] = B["accent"]
LIGHT = dict(B)
DARK = dict(B, text=(255, 255, 255), muted=(226, 230, 238), bg=(16, 18, 24), accent_text=(147, 197, 253))
INK = (10, 10, 10)          # text on white cards, independent of the theme


def use_theme(dark: bool) -> None:
    """Switch the palette in place (photo slides use light text on dark)."""
    B.clear()
    B.update(DARK if dark else LIGHT)


_PHOTOS: dict = {}


def photo(path: str) -> Image.Image:
    if path not in _PHOTOS:
        _PHOTOS[path] = Image.open(ROOT / path).convert("RGB")
    return _PHOTOS[path]


_OVERLAYS: dict = {}


def overlay(h: int) -> Image.Image:
    """Dark gradient so white text stays readable on any photo."""
    if h not in _OVERLAYS:
        a = np.linspace(0, 1, h)[:, None]
        mid = np.exp(-((a - 0.45) ** 2) / 0.05)          # a bit darker where the text sits
        alpha = (55 + 70 * mid + 120 * a ** 2.2).clip(0, 225).astype(np.uint8)
        arr = np.zeros((h, W, 4), dtype=np.uint8)
        arr[..., 0:3] = (8, 12, 28)
        arr[..., 3] = np.repeat(alpha, W, axis=1)
        _OVERLAYS[h] = Image.fromarray(arr, "RGBA")
    return _OVERLAYS[h]


def ken_burns(path: str, h: int, p: float, seed: int) -> Image.Image:
    """Slow zoom + pan over a photo, cover-fitted to W x h."""
    src = photo(path)
    z = 1.04 + 0.12 * p
    scale = max(W / src.width, h / src.height) * z
    tw, th = int(src.width * scale), int(src.height * scale)
    dx = (tw - W) * (0.5 + 0.35 * math.sin(seed + p * 1.3) * (1 if seed % 2 else -1) * p)
    dy = (th - h) * (0.5 - 0.25 * p)
    img = src.resize((tw, th), Image.BILINEAR).crop((int(dx), int(dy), int(dx) + W, int(dy) + h))
    img.paste(overlay(h), (0, 0), overlay(h))
    return img


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    custom = CONFIG.get("fonts", {}).get(weight)          # e.g. a display face per account
    return ImageFont.truetype(str(ROOT / custom if custom else FONT_DIR / f"Geist-{weight}.ttf"), size)


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


def reading_seconds(slide: dict) -> float:
    """Time a viewer needs to read a slide without voice-over (~3.3 words/s)."""
    text = " ".join(str(slide.get(k, "")) for k in ("text", "sub", "title", "body", "label", "note"))
    text += " " + " ".join(slide.get("steps", []))
    words = len(text.split())
    base = {"flow": 1.8, "stat": 1.6, "cta": 1.4, "clip": 0}.get(slide["kind"], 1.2)
    return base + words / 3.3


def music_bed(seconds: float, seed: int, volume_db: float = -27) -> np.ndarray:
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
    return (out * 10 ** (volume_db / 20)).astype(np.float32)


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

    def base(self, t: float, page: str | None = None, bg: str | None = None, p: float = 1.0) -> Image.Image:
        if bg:
            img = ken_burns(bg, self.h, p, int(self.blob_phase * 1000))
        else:
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

def text_block(d, lines, f, x, y, color, t, start, stagger=0.09, line_gap=1.18, center=False):
    """Draw lines with a staggered slide-up reveal; returns the bottom y."""
    lh = int(f.size * line_gap)
    for i, line in enumerate(lines):
        a = ease((t - start - i * stagger) / 0.45)
        if a <= 0:
            continue
        col = blend(B["bg"], color, a)
        yy = y + i * lh + int((1 - a) * 40)
        xx = (W - d.textlength(line, font=f)) / 2 if center else x
        if B is not None and B.get("text") == (255, 255, 255):
            d.text((xx + 3, yy + 4), line, font=f, fill=(0, 0, 0))
        d.text((xx, yy), line, font=f, fill=col)
    return y + len(lines) * lh


def slide_hook(img, s, t, dur, h):
    d = ImageDraw.Draw(img)
    f = font("Bold", 104 if h == H_REEL else 92)
    lines = wrap(d, s["text"], f, W - 2 * MARGIN_X)
    fs = font("Medium", 46)
    sub = wrap(d, s.get("sub", ""), fs, W - 2 * MARGIN_X) if s.get("sub") else []
    center = s.get("align", CONFIG.get("hook_align", "left")) == "center"
    tag = s.get("tag")          # names the exact audience, e.g. "FÜR HANDWERKSBETRIEBE IN OWL"
    ft = font("Bold", 36)
    total = len(lines) * int(f.size * 1.18) + (40 + len(sub) * int(fs.size * 1.3) if sub else 0) + (90 if tag else 0)
    y = (h - total) // 2 - (60 if h == H_REEL else 0)
    if tag:
        tw = d.textlength(tag, font=ft)
        x0 = (W - tw) / 2 - 24 if center else MARGIN_X
        d.rounded_rectangle([x0, y, x0 + tw + 48, y + 62], radius=31, fill=B["accent"])
        d.text((x0 + 24, y + 11), tag, font=ft, fill=B.get("accent_ink", (255, 255, 255)))
        y += 90
    y = text_block(d, lines, f, MARGIN_X, y, B["text"], t, 0.05, center=center)
    if sub:
        text_block(d, sub, fs, MARGIN_X, y + 40, B["muted"], t, 0.35 + 0.09 * len(lines), line_gap=1.3, center=center)


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
                   fill=blend(B["card_muted"], B["card_ink"], max(active, 0.35 if t < on_at else 1)))
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
    d.text((MARGIN_X, y), txt, font=fbig, fill=B["accent_text"])
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
    label = s.get("button", CONFIG["cta_title"])
    bw = d.textlength(label, font=fb) + 120
    pulse = 1 + 0.025 * math.sin(t * 4) if a >= 1 else 1
    x0, y0 = MARGIN_X, y + int((1 - a) * 30)
    d.rounded_rectangle([x0, y0, x0 + bw * pulse, y0 + 140 * pulse], 70, fill=blend(B["bg"], B["accent"], a))
    d.text((x0 + 60, y0 + 34), label, font=fb, fill=blend(B["bg"], (255, 255, 255), a))
    text_block(d, [s.get("button_sub", CONFIG["cta_sub"])], fs, MARGIN_X + 8, y0 + 180, B["muted"], t, 0.55)


def clip_path(s: dict) -> Path:
    return (ROOT / s["src"]).resolve()


def clip_duration(path: Path) -> float:
    out = subprocess.run([ffmpeg_exe(), "-i", str(path)], capture_output=True, text=True).stderr
    for line in out.splitlines():
        if "Duration:" in line:
            h, m, sec = line.split("Duration:")[1].split(",")[0].strip().split(":")
            return int(h) * 3600 + int(m) * 60 + float(sec)
    raise RuntimeError(f"Dauer von {path} unbekannt")


def clip_frames(path: Path, height: int):
    """Yield RGB frames of a screen recording, scaled/padded to W x height."""
    cmd = [ffmpeg_exe(), "-v", "error", "-i", str(path), "-vf",
           f"scale={W}:{height}:force_original_aspect_ratio=decrease,pad={W}:{height}:(ow-iw)/2:(oh-ih)/2:color=0xededed,fps={FPS}",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    size = W * height * 3
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        yield Image.frombytes("RGB", (W, height), buf)
    proc.wait()


def draw_clip_caption(img: Image.Image, text: str, a: float) -> None:
    """Caption pill in the lower safe zone of a screen-recording slide."""
    if not text or a <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    f = font("Bold", 58)
    lines = wrap(d, text, f, W - 2 * MARGIN_X - 60)
    lh = 72
    h = len(lines) * lh + 50
    y0 = int(H_REEL * 0.70) + int((1 - a) * 30)
    d.rounded_rectangle([MARGIN_X - 10, y0, W - MARGIN_X + 10, y0 + h], 34, fill=B["text"] + (int(235 * a),))
    for i, line in enumerate(lines):
        tw = d.textlength(line, font=f)
        d.text(((W - tw) / 2, y0 + 25 + i * lh), line, font=f, fill=(255, 255, 255, int(255 * a)))


_FONT_CACHE: dict = {}


def font_c(weight: str, size: int) -> ImageFont.FreeTypeFont:
    key = (weight, size)
    if key not in _FONT_CACHE:
        _FONT_CACHE[key] = font(weight, size)
    return _FONT_CACHE[key]


def slide_beat(img, s, t, dur, h):
    """Viral beat: words pop in one by one (scale bounce), *word* = highlighted."""
    d = ImageDraw.Draw(img)
    size = s.get("size", 112)
    words = s["text"].split()
    while size > 60 and max(d.textlength(w.strip("*"), font=font_c("Bold", size)) for w in words) > W - 2 * MARGIN_X - 40:
        size -= 6                                   # long single words must fit
    base = font_c("Bold", size)
    # layout with the final size
    lines, cur, maxw = [], [], W - 2 * MARGIN_X
    for w in words:
        test = " ".join(x.strip("*") for x in cur + [w])
        if d.textlength(test, font=base) <= maxw or not cur:
            cur.append(w)
        else:
            lines.append(cur); cur = [w]
    lines.append(cur)
    lh = int(size * 1.16)
    y0 = (h - len(lines) * lh) // 2 - (40 if h == H_REEL else 0)
    i = 0
    for li, line in enumerate(lines):
        widths = [d.textlength(w.strip("*"), font=base) for w in line]
        space = d.textlength(" ", font=base)
        x = (W - (sum(widths) + space * (len(line) - 1))) / 2
        for w, ww in zip(line, widths):
            appear = t - i * s.get("stagger", 0.07)
            if appear >= 0:
                k = min(1.0, appear / 0.16)
                sc = 1.0 + 0.35 * (1 - k) ** 2          # pop: big -> normal
                sc = min(sc, (W - 40) / max(ww, 1))      # never wider than the frame
                f = font_c("Bold", max(10, int(size * sc)))
                word = w.strip("*")
                wx = x + (ww - d.textlength(word, font=f)) / 2
                wy = y0 + li * lh - (f.size - size) / 2
                if w.startswith("*"):                     # box hugs the real glyphs (any font)
                    bb = d.textbbox((x, y0 + li * lh), word, font=base)
                    d.rounded_rectangle([bb[0] - 14, bb[1] - 12, bb[2] + 14, bb[3] + 14], 18, fill=B["accent"])
                if w.startswith("*") and B["accent_ink"] != (255, 255, 255):
                    d.text((wx, wy), word, font=f, fill=B["accent_ink"])
                else:
                    d.text((wx + 4, wy + 5), word, font=f, fill=(0, 0, 0))
                    d.text((wx, wy), word, font=f, fill=(255, 255, 255))
            x += ww + space
            i += 1
    if s.get("small"):
        fs = font_c("Medium", 44)
        tw = d.textlength(s["small"], font=fs)
        d.text(((W - tw) / 2, y0 + len(lines) * lh + 40), s["small"], font=fs, fill=(235, 238, 245))


def beat_track(seconds: float, bpm: int, seed: int) -> np.ndarray:
    """Self-made punchy beat (kick, clap, hats, bass) – no licensing issues."""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    out = np.zeros(n, dtype=np.float32)
    beat = 60.0 / bpm
    t_k = np.arange(int(0.35 * SR)) / SR
    kick = np.sin(2 * np.pi * (50 + 110 * np.exp(-t_k * 28)) * t_k) * np.exp(-t_k * 9)
    t_c = np.arange(int(0.18 * SR)) / SR
    clap = rng.standard_normal(len(t_c)) * np.exp(-t_c * 26) * 0.55
    t_h = np.arange(int(0.05 * SR)) / SR
    hat = np.diff(rng.standard_normal(len(t_h) + 1)) * np.exp(-t_h * 90) * 0.18
    roots = [45, 45, 41, 43]                       # A, A, F, G (bass)
    def add(sig, at):
        i = int(at * SR)
        if i < n:
            out[i:i + len(sig)] += sig[: n - i]
    b = 0
    while b * beat < seconds:
        at = b * beat
        add(kick * 0.9, at)
        if b % 2 == 1:
            add(clap, at)
        add(hat, at + beat / 2)
        f = 440 * 2 ** ((roots[(b // 4) % 4] - 69) / 12)
        tb = np.arange(int(beat * 0.9 * SR)) / SR
        add((np.sign(np.sin(2 * np.pi * f * tb)) * 0.12 + np.sin(2 * np.pi * f * tb) * 0.2) * np.exp(-tb * 3), at)
        b += 1
    out = np.convolve(out, np.ones(6) / 6, mode="same")
    fade = np.clip(np.minimum(np.arange(n) / (0.05 * SR), (n - np.arange(n)) / (0.4 * SR)), 0, 1)
    out *= fade
    out = out / max(1e-6, np.abs(out).max())
    out = np.tanh(out * 2.6) / np.tanh(2.6)          # soft-clip = louder, punchier
    return (out * 0.92).astype(np.float32)



# --------------------------------------------------------------------------
# Motion graphics: icons, automation pipeline, editing timeline
# --------------------------------------------------------------------------

# Line icons on a 24x24 grid: ("l", points) polyline, ("c", cx, cy, r) circle,
# ("r", x0, y0, x1, y1, radius) rounded rect, ("p", points) closed polygon.
ICONS = {
    "camera": [("r", 3, 7, 21, 19, 2.5), ("c", 12, 13, 3.6), ("l", [(8, 7), (9.5, 4.5), (14.5, 4.5), (16, 7)])],
    "video": [("r", 2, 6, 16, 18, 2.5), ("p", [(16, 10), (22, 7), (22, 17), (16, 14)])],
    "scissors": [("c", 6, 6, 3), ("c", 6, 18, 3), ("l", [(8.4, 7.8), (20, 18)]), ("l", [(8.4, 16.2), (20, 6)])],
    "captions": [("r", 3, 5, 21, 19, 2.5), ("l", [(7, 11), (17, 11)]), ("l", [(7, 15), (13, 15)])],
    "send": [("p", [(3, 11), (21, 3), (13, 21), (11, 13)]), ("l", [(11, 13), (21, 3)])],
    "chart": [("l", [(3, 20), (21, 20)]), ("l", [(6, 16), (10, 11), (13, 14), (18, 7)])],
    "chat": [("r", 3, 4, 21, 16, 3), ("l", [(8, 16), (6, 21), (12, 16)])],
    "target": [("c", 12, 12, 9), ("c", 12, 12, 5), ("c", 12, 12, 1.5)],
    "calendar": [("r", 3, 5, 21, 21, 2.5), ("l", [(3, 10), (21, 10)]), ("l", [(8, 3), (8, 7)]), ("l", [(16, 3), (16, 7)])],
    "check": [("l", [(5, 12.5), (10, 17), (19, 7)])],
    "image": [("r", 3, 4, 21, 20, 2.5), ("c", 8.5, 9.5, 1.8), ("l", [(3, 17), (9, 12), (13, 15), (16, 13), (21, 17)])],
    "bot": [("r", 5, 8, 19, 19, 3), ("c", 9.5, 13.5, 1.2), ("c", 14.5, 13.5, 1.2), ("l", [(12, 8), (12, 4.5)]), ("c", 12, 3.5, 1)],
    "idea": [("c", 12, 10, 6), ("l", [(9.5, 16), (9.5, 19), (14.5, 19), (14.5, 16)]), ("l", [(10.5, 21.5), (13.5, 21.5)])],
    "phone": [("r", 7, 2, 17, 22, 2.5), ("l", [(11, 18.5), (13, 18.5)])],
    "tag": [("p", [(3, 3), (12, 3), (21, 12), (12, 21), (3, 12)]), ("c", 7.5, 7.5, 1.3)],
}


def draw_icon(d, name: str, cx: float, cy: float, size: float, color, width: int = 5) -> None:
    k = size / 24.0
    ox, oy = cx - size / 2, cy - size / 2
    P = lambda x, y: (ox + x * k, oy + y * k)
    for part in ICONS.get(name, ICONS["check"]):
        if part[0] == "l":
            d.line([P(*pt) for pt in part[1]], fill=color, width=width, joint="curve")
        elif part[0] == "p":
            pts = [P(*pt) for pt in part[1]]
            d.line(pts + [pts[0]], fill=color, width=width, joint="curve")
        elif part[0] == "c":
            x, y = P(part[1], part[2]); r = part[3] * k
            d.ellipse([x - r, y - r, x + r, y + r], outline=color, width=width)
        elif part[0] == "r":
            x0, y0 = P(part[1], part[2]); x1, y1 = P(part[3], part[4])
            d.rounded_rectangle([x0, y0, x1, y1], part[5] * k, outline=color, width=width)


def glow_dot(img: Image.Image, x: float, y: float, r: float, color) -> None:
    """Soft glowing packet travelling along a connector."""
    d = ImageDraw.Draw(img, "RGBA")
    for rr, a in ((r * 3.2, 40), (r * 2.2, 80), (r * 1.4, 150)):
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=tuple(color) + (a,))
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 255))


def slide_pipeline(img, s, t, dur, h):
    """Automation chain: nodes light up one after another, packets flow between them."""
    d = ImageDraw.Draw(img)
    nodes = s["nodes"]
    n = len(nodes)
    reel = h == H_REEL
    ft, fl, fs = font_c("Bold", 70 if reel else 60), font_c("Bold", 50 if reel else 40), font_c("Medium", 34 if reel else 28)
    card_h = (168 if reel else 118) if n <= 5 else (132 if reel else 100)
    gap = (62 if reel else 34) if n <= 5 else (44 if reel else 26)
    title = wrap(d, s.get("title", ""), ft, W - 2 * MARGIN_X) if s.get("title") else []
    badge_h = 110 if s.get("badge") else 0
    total = len(title) * int(ft.size * 1.15) + (56 if title else 0) + n * card_h + (n - 1) * gap + badge_h
    y = (h - total) // 2 - (30 if reel else -10)
    y = text_block(d, title, ft, MARGIN_X, y, B["text"], t, 0.0, line_gap=1.15) + (56 if title else 0)
    step = max(0.55, (dur - 1.6) / max(n, 1))
    on = [0.45 + i * step for i in range(n)]
    ix = MARGIN_X + 82                                      # icon column / connector x
    tops = [y + i * (card_h + gap) for i in range(n)]
    for i, node in enumerate(nodes):
        appear = ease((t - 0.15 - i * 0.08) / 0.4)
        if appear <= 0:
            continue
        active = ease((t - on[i]) / 0.3)
        top = tops[i] + int((1 - appear) * 30)
        pop = 1 + 0.04 * math.sin(min(1.0, max(0.0, (t - on[i]) / 0.35)) * math.pi)
        dx = (W - 2 * MARGIN_X) * (pop - 1) / 2
        d.rounded_rectangle([MARGIN_X - dx, top, W - MARGIN_X + dx, top + card_h], 36,
                            fill=blend(B["bg"], B["card"], appear), outline=blend(B["card"], B["accent"], active), width=5)
        cy, r = top + card_h // 2, card_h * 0.30
        d.ellipse([ix - r, cy - r, ix + r, cy + r], fill=blend((226, 230, 238), B["accent"], active))
        draw_icon(d, node.get("icon", "check"), ix, cy, r * 1.15, blend((90, 96, 110), (255, 255, 255), active), 5)
        label, sub = node.get("label", ""), node.get("sub", "")
        tx = ix + r + 40
        room = W - MARGIN_X - 100 - tx                      # keep clear of the done badge
        size = fl.size
        while size > 26 and d.textlength(label, font=font_c("Bold", size)) > room:
            size -= 2
        fl = font_c("Bold", size)
        col = blend(B["card_muted"], B["card_ink"], max(active, 0.45))
        if sub:
            d.text((tx, cy - fl.size + 2), label, font=fl, fill=col)
            d.text((tx, cy + 10), sub, font=fs, fill=blend((170, 170, 170), (95, 100, 112), max(active, 0.4)))
        else:
            d.text((tx, cy - fl.size * 0.62), label, font=fl, fill=col)
        if active >= 1:                                    # done badge on the right
            bx, br = W - MARGIN_X - 58, 24
            d.ellipse([bx - br, cy - br, bx + br, cy + br], fill=(46, 139, 87))
            d.line([(bx - 11, cy + 1), (bx - 3, cy + 9), (bx + 12, cy - 8)], fill=(255, 255, 255), width=5, joint="curve")
    for i in range(n - 1):                                  # connectors + packets
        if t < 0.3 + (i + 1) * 0.08:
            continue
        y0, y1 = tops[i] + card_h, tops[i + 1]
        done = ease((t - on[i]) / max(0.2, on[i + 1] - on[i]))
        d.line([(ix, y0), (ix, y1)], fill=(205, 210, 220), width=6)
        if done > 0:
            d.line([(ix, y0), (ix, y0 + (y1 - y0) * done)], fill=B["accent"], width=6)
        if 0 < done < 1:
            glow_dot(img, ix, y0 + (y1 - y0) * done, 9, B["accent2"])
        elif t > on[-1] + 0.3 and t < 90:                   # steady flow once the chain runs
            ph = ((t * 1.3 + i * 0.37) % 1.0)
            glow_dot(img, ix, y0 + (y1 - y0) * ph, 7, B["accent2"])
    if s.get("badge"):
        a = ease((t - on[-1] - 0.35) / 0.4)
        if a > 0:
            fb = font_c("Bold", 44 if reel else 38)
            bw = d.textlength(s["badge"], font=fb) + 110
            by = tops[-1] + card_h + 44 + int((1 - a) * 24)
            bx = (W - bw) / 2
            d.rounded_rectangle([bx, by, bx + bw, by + 84], 42, fill=blend(B["bg"], (10, 10, 10), a))
            d.ellipse([bx + 34, by + 32, bx + 54, by + 52], fill=blend((10, 10, 10), (46, 200, 110), a * (0.6 + 0.4 * math.sin(t * 6) ** 2)))
            d.text((bx + 72, by + 18), s["badge"], font=fb, fill=blend((10, 10, 10), (255, 255, 255), a))


_CROPS: dict = {}


def cover_crop(path: str, w: int, h: int) -> Image.Image:
    key = (path, w, h)
    if key not in _CROPS:
        im = photo(path)
        sc = max(w * 1.15 / im.width, h * 1.15 / im.height)
        _CROPS[key] = im.resize((int(im.width * sc), int(im.height * sc)), Image.LANCZOS)
    return _CROPS[key]


def slide_timeline(img, s, t, dur, h):
    """Auto-editing: raw footage -> pauses cut -> captions -> all formats."""
    d = ImageDraw.Draw(img, "RGBA")
    reel = h == H_REEL
    x0, x1 = 60, W - 60
    top = 300 if reel else 150
    bottom = h - (360 if reel else 110)
    d.rounded_rectangle([x0, top, x1, bottom], 40, fill=(18, 20, 26))
    for k, c in enumerate(((255, 95, 86), (255, 189, 46), (39, 201, 63))):
        d.ellipse([x0 + 34 + k * 34, top + 30, x0 + 54 + k * 34, top + 50], fill=c)
    fm = font_c("Medium", 30)
    d.text((x0 + 150, top + 22), s.get("file", "baustelle_rohmaterial.mp4"), font=fm, fill=(150, 156, 170))
    T = t if t < 90 else dur
    ph = min(3.999, max(0.0, T / dur * 4.0))                # phase 0..3
    stage, local = int(ph), ph - int(ph)
    # preview monitor
    pw, phh = x1 - x0 - 80, int((x1 - x0 - 80) * (0.62 if reel else 0.5))
    px, py = x0 + 40, top + 80
    frames = s.get("frames") or []
    if frames:
        src = cover_crop(frames[min(len(frames) - 1, int(T / dur * len(frames)))], pw, phh)
        z = 1 + 0.06 * (T % 2.5) / 2.5
        cw, ch = int(pw / z), int(phh / z)
        ox, oy = (src.width - cw) // 2, (src.height - ch) // 2
        img.paste(src.crop((ox, oy, ox + cw, oy + ch)).resize((pw, phh)), (px, py))
    else:
        d.rectangle([px, py, px + pw, py + phh], fill=(40, 44, 54))
    d.rectangle([px, py, px + pw, py + phh], outline=(60, 64, 76), width=3)
    if stage >= 2:                                          # burnt-in caption preview
        caps = s.get("captions", ["So läuft das ab", "automatisch geschnitten"])
        cap = caps[int(T * 1.6) % len(caps)]
        fc = font_c("Bold", 46 if reel else 38)
        cw = d.textlength(cap, font=fc)
        a = ease((ph - 2) / 0.2)
        d.rounded_rectangle([px + (pw - cw) / 2 - 24, py + phh - 110, px + (pw + cw) / 2 + 24, py + phh - 40], 18,
                            fill=(10, 10, 10, int(210 * a)))
        d.text((px + (pw - cw) / 2, py + phh - 104), cap, font=fc, fill=(255, 255, 255, int(255 * a)))
    # tracks
    ty = py + phh + 60
    tl_x0, tl_x1 = x0 + 110, x1 - 40
    track_h, tgap = (74, 26) if reel else (56, 16)
    fl = font_c("SemiBold", 28)
    for k, name in enumerate(("V1", "A1", "T1")):
        d.text((x0 + 36, ty + k * (track_h + tgap) + track_h / 2 - 16), name, font=fl, fill=(130, 136, 150))
        d.rounded_rectangle([tl_x0, ty + k * (track_h + tgap), tl_x1, ty + k * (track_h + tgap) + track_h], 12,
                            fill=(30, 33, 41))
    rng = np.random.default_rng(7)
    segs = [(0.0, 0.17), (0.25, 0.44), (0.52, 0.63), (0.72, 0.92)]          # speech parts of the raw clip
    total_speech = sum(b - a for a, b in segs)
    squeeze = 0.0 if stage == 0 else (ease(local / 0.8) if stage == 1 else 1.0)
    span = tl_x1 - tl_x0
    pos, cur = [], 0.0
    for a, b in segs:                                       # compacted layout blends from raw positions
        ca, cb = cur, cur + (b - a) / total_speech * 0.96
        pos.append((a + (ca - a) * squeeze, b + (cb - b) * squeeze))
        cur = cb + 0.0133
    vy, ay, cy_ = ty, ty + track_h + tgap, ty + 2 * (track_h + tgap)
    for k, (a, b) in enumerate(pos):
        xa, xb = tl_x0 + a * span, tl_x0 + b * span
        d.rounded_rectangle([xa + 2, vy + 6, xb - 2, vy + track_h - 6], 10, fill=B["accent"])
        n_bars = max(4, int((xb - xa) / 12))
        amp = rng.uniform(0.3, 1.0, n_bars)
        for j in range(n_bars):
            bx = xa + 6 + j * (xb - xa - 12) / n_bars
            hh = (track_h - 18) * amp[j] * (0.6 + 0.4 * math.sin(j * 0.9 + k))
            d.line([(bx, ay + track_h / 2 - hh / 2), (bx, ay + track_h / 2 + hh / 2)], fill=(120, 200, 255), width=5)
    if stage == 0:                                          # silent gaps marked red
        for (a, _), (b, _) in zip([(sg[1], 0) for sg in segs[:-1]], [(sg[0], 0) for sg in segs[1:]]):
            al = int(120 + 100 * abs(math.sin(T * 5)))
            d.rounded_rectangle([tl_x0 + a * span + 3, vy + 6, tl_x0 + b * span - 3, ay + track_h - 6], 10,
                                fill=(192, 57, 43, al))
    if stage >= 2:                                          # caption blocks pop in
        for k, (a, b) in enumerate(pos):
            ap = ease((ph - 2 - k * 0.12) / 0.25)
            if ap > 0:
                d.rounded_rectangle([tl_x0 + a * span + 4, cy_ + 8 + (1 - ap) * 20, tl_x0 + b * span - 4, cy_ + track_h - 8],
                                    10, fill=(239, 125, 0, int(255 * ap)))
    play = tl_x0 + span * (local if stage != 1 else 0.96 * local)
    d.line([(play, ty - 16), (play, cy_ + track_h + 10)], fill=(255, 255, 255), width=4)
    d.polygon([(play - 14, ty - 30), (play + 14, ty - 30), (play, ty - 12)], fill=(255, 255, 255))
    # format tiles in the last phase
    fy = cy_ + track_h + (50 if reel else 26)
    if stage >= 3:
        specs = [("9:16", 0.5625), ("1:1", 1.0), ("16:9", 1.78)]
        bh = 130 if reel else 90
        widths = [bh * r for _, r in specs]
        gx = (W - sum(widths) - 2 * 50) / 2
        for k, ((lab, r), bw) in enumerate(zip(specs, widths)):
            ap = ease((ph - 3 - k * 0.1) / 0.2)
            if ap > 0:
                yy = fy + (1 - ap) * 30
                d.rounded_rectangle([gx, yy, gx + bw, yy + bh], 14, fill=(59, 130, 255, int(90 * ap)),
                                    outline=(255, 255, 255, int(255 * ap)), width=4)
                fb = font_c("Bold", 32)
                d.text((gx + (bw - d.textlength(lab, font=fb)) / 2, yy + bh + 10), lab, font=fb, fill=(255, 255, 255, int(255 * ap)))
            gx += bw + 50
    # stage label
    labels = s.get("labels", ["Rohmaterial rein", "Pausen & Versprecher raus", "Untertitel automatisch", "Fertig für jedes Format"])
    lab = labels[stage]
    fb = font_c("Bold", 54 if reel else 44)
    la = ease(local / 0.15) if t < 90 else 1.0
    lw = d.textlength(lab, font=fb)
    ly = bottom + 50 if reel else top - 80
    d.rounded_rectangle([(W - lw) / 2 - 36, ly - 14, (W + lw) / 2 + 36, ly + fb.size + 22], 40,
                        fill=B["accent"] + (int(255 * la),))
    d.text(((W - lw) / 2, ly), lab, font=fb, fill=(255, 255, 255, int(255 * la)))

def slide_logo(img, s, t, dur, h):
    """Brand end card: the square logo contained and centred on its own colour, gentle zoom-in."""
    src = photo(s["src"])
    img.paste(src.getpixel((8, 8)), [0, 0, W, h])
    a = ease(t / 0.6)
    size = int(W * (0.92 + 0.04 * min(t / max(dur, 0.1), 1)))
    logo = src.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rectangle([60, 60, size - 60, size - 60], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(45))
    if a < 1:
        logo = Image.blend(Image.new("RGB", logo.size, src.getpixel((8, 8))), logo, a)
    img.paste(logo, ((W - size) // 2, (h - size) // 2 - (40 if h == H_REEL else 0)), mask)
    if s.get("text"):
        d = ImageDraw.Draw(img)
        f = font("Bold", 48)
        tw = d.textlength(s["text"], font=f)
        y = (h + size) // 2 + 20
        d.rounded_rectangle([(W - tw) / 2 - 36, y - 14, (W + tw) / 2 + 36, y + 70], 42, fill=B["accent"])
        d.text(((W - tw) / 2, y), s["text"], font=f, fill=B.get("accent_ink", (255, 255, 255)))


RENDERERS = {"beat": slide_beat, "logo": slide_logo, "hook": slide_hook, "point": slide_point, "flow": slide_flow,
             "stat": slide_stat, "cta": slide_cta,
             "pipeline": slide_pipeline, "timeline": slide_timeline}


def draw_slide(canvas: Canvas, s: dict, t: float, dur: float, page: str | None = None) -> Image.Image:
    bg = s.get("bg")
    use_theme(bool(bg))
    p = min(1.0, t / max(dur, 0.1))
    if s["kind"] == "beat":                     # fast punch-in right after the cut
        p = 0.35 * (1 - ease(t / 0.25)) + 0.6 * p
    img = canvas.base(t, page, bg, p)
    RENDERERS[s["kind"]](img, s, t, dur, canvas.h)
    use_theme(False)
    return img


def apply_bg(spec: dict) -> None:
    """Spec-level `bg` (one path or a list) fills slides without their own."""
    pool = spec.get("bg")
    if not pool:
        return
    pool = [pool] if isinstance(pool, str) else pool
    k = 0
    for s in spec["slides"]:
        if s["kind"] not in ("clip", "logo") and "bg" not in s:
            s["bg"] = pool[k % len(pool)]
            k += 1


# --------------------------------------------------------------------------
# Post renderers
# --------------------------------------------------------------------------

def render_reel(spec: dict, out_dir: Path) -> dict:
    seed = zlib.crc32(spec["id"].encode())
    canvas = Canvas(H_REEL, seed)
    use_voice = bool(CONFIG.get("voice")) and spec.get("voice", True)
    lines = [tts(s.get("voice", "")) if use_voice else np.zeros(0, dtype=np.float32) for s in spec["slides"]]
    bpm = spec.get("bpm", 120)
    durs = [s.get("beats", 3) * 60.0 / bpm if s["kind"] == "beat"
            else clip_duration(clip_path(s)) if s["kind"] == "clip"
            else max(s.get("min_seconds", 2.4), len(v) / SR + 0.75,
                     min(reading_seconds(s), s.get("max_seconds", 3.0)) if s["kind"] == "hook" else reading_seconds(s))
            for s, v in zip(spec["slides"], lines)]
    total = sum(durs) + 0.3
    if spec.get("music") == "beat":
        audio = beat_track(total, bpm, seed)
    else:
        audio = music_bed(total, seed, CONFIG.get("music_volume_db" if use_voice else "music_volume_db_novoice", -27))
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
    prev = None
    for s, dur in zip(spec["slides"], durs):
        if s["kind"] == "clip":
            frames = clip_frames(clip_path(s), H_REEL)
        for k in range(int(round(dur * FPS))):
            t = k / FPS
            if s["kind"] == "clip":
                frame = next(frames, None)
                img = frame if frame is not None else img
                img = img.copy()
                for c0, c1, text in s.get("captions", []):
                    if c0 <= t < c1:
                        draw_clip_caption(img, text, ease((t - c0) / 0.3))
            else:
                img = draw_slide(canvas, s, t, dur)
            if s["kind"] == "beat":
                if k < 3 and prev is not None:      # hard cut with a short white flash
                    img = Image.blend(img, Image.new("RGB", img.size, (255, 255, 255)), 0.45 * (1 - k / 3))
            elif k < 7 and prev is not None:        # soft crossfade between slides
                img = Image.blend(prev, img, (k + 1) / 8)
            d = ImageDraw.Draw(img)
            prog = (elapsed + t) / total
            d.rectangle([0, bar_y, W, bar_y + 8], fill=(214, 214, 214))
            d.rectangle([0, bar_y, int(W * prog), bar_y + 8], fill=B["accent"])
            if cover is None and s is spec["slides"][0] and t >= dur - 1 / FPS:
                cover = img.copy()
            proc.stdin.write(img.tobytes())
        prev = img.copy()
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
            d.text((W - MARGIN_X - d.textlength(hint, font=f), H_CAROUSEL - 110), hint, font=f,
                   fill=(255, 255, 255) if s.get("bg") else B["accent"])
        name = f"slide_{i + 1:02d}.jpg"
        img.convert("RGB").save(out_dir / name, quality=92)
        files.append(name)
    return {"images": files}


def render(spec: dict, out_dir: Path) -> dict:
    spec = json.loads(json.dumps(spec))
    apply_bg(spec)
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
