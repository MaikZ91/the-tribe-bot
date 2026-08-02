"""Render the German text overlays to transparent 1080x1920 PNGs via Chromium.

ffmpeg's drawtext is not an option here: the reel needs colour emoji and real
CSS layout, so every text card is an HTML file screenshotted with a transparent
background.
"""
import os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OV = os.path.join(HERE, 'overlays')
CARDS = ['hook', 'label_a', 'label_b', 'vs', 'outro_a', 'outro_b']

CANDIDATES = [
    os.environ.get('CHROME_PATH'),
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    shutil.which('chromium'),
    shutil.which('chromium-browser'),
    shutil.which('google-chrome'),
]


def chrome():
    for c in CANDIDATES:
        if c and os.path.exists(c):
            return c
    hit = subprocess.run(['bash', '-lc', 'ls -d /opt/pw-browsers/chromium*/chrome-linux/chrome 2>/dev/null'],
                         capture_output=True, text=True).stdout.split()
    if hit:
        return hit[0]
    raise SystemExit('Kein Chromium gefunden — CHROME_PATH setzen.')


def main():
    exe = chrome()
    for card in CARDS:
        src = os.path.join(OV, f'{card}.html')
        dst = os.path.join(OV, f'{card}.png')
        subprocess.run([exe, '--headless', '--no-sandbox', '--disable-gpu',
                        '--hide-scrollbars', '--force-device-scale-factor=1',
                        '--default-background-color=00000000',
                        '--window-size=1080,1920',
                        f'--screenshot={dst}', f'file://{src}'],
                       capture_output=True, check=True)
        print(f'· {card}.png')


if __name__ == '__main__':
    sys.exit(main())
