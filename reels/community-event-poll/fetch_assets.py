"""Fetch the stock footage, the music bed and the fonts the reel is built from.

Everything here comes from Mixkit under the Mixkit Free License (commercial use
allowed, no attribution required, redistribution of the raw asset is not) —
which is why the sources are downloaded on demand instead of being committed.

    python fetch_assets.py            # into ./assets
"""
import os, shutil, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, 'assets')
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'}

# Mixkit clip id → (resolution suffix, what it shows)
CLIPS = {
    # A — Silent Disco
    '51295': ('1080', 'Five young people dancing a choreography in the street'),
    '21239': ('720',  'Woman feels happiness when listening to music'),
    '4636':  ('1080', 'Couple in love dancing happily'),
    '4556':  ('1080', 'Friends with colored smoke bombs'),
    '4269':  ('1080', 'Audience at a concert'),
    '4664':  ('1080', 'Lovers holding each other on a romantic sunset'),
    # B — Techno × Paint
    '4187':  ('1080', 'DJ playing on a stage with LED screens'),
    '43444': ('1080', 'Artist painting painting on a canvas'),
    '33906': ('1080', 'Girl dancing on a dark floor under colored lights'),
    '43427': ('1080', 'Many brushes of an artist'),
    '33899': ('1080', 'Young woman dancing under a cloud of smoke and a purple light'),
    '41996': ('1080', 'Pink orange and yellow ink dissolving in water'),
}
MUSIC = ('124', 'Techno Fest Vibes — 124 BPM')
INTER_ZIP = 'https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip'
ANTON_IN_REPO = os.path.join(HERE, '..', '..', 'tribe-story', 'fonts', 'Anton-Regular.ttf')


def download(url, dst):
    if os.path.exists(dst) and os.path.getsize(dst) > 50_000:
        return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r, \
            open(dst, 'wb') as fh:
        shutil.copyfileobj(r, fh)
    return True


def main():
    for cid, (res, what) in CLIPS.items():
        dst = os.path.join(ASSETS, 'src', f'{cid}.mp4')
        got = download(f'https://assets.mixkit.co/videos/{cid}/{cid}-{res}.mp4', dst)
        print(f"{'↓' if got else '·'} {cid:6} {what}")

    dst = os.path.join(ASSETS, 'mus', f'{MUSIC[0]}.mp3')
    got = download(f'https://assets.mixkit.co/music/{MUSIC[0]}/{MUSIC[0]}.mp3', dst)
    print(f"{'↓' if got else '·'} music  {MUSIC[1]}")

    # fonts: Anton already lives in the repo, Inter comes from the upstream release
    ov = os.path.join(HERE, 'overlays')
    if os.path.exists(ANTON_IN_REPO):
        shutil.copyfile(ANTON_IN_REPO, os.path.join(ov, 'anton.ttf'))
        print('· font   Anton (from tribe-story/fonts)')
    zip_path = os.path.join(ASSETS, 'Inter-4.0.zip')
    if download(INTER_ZIP, zip_path):
        print('↓ font   Inter 4.0')
    unpacked = os.path.join(ASSETS, 'inter')
    if not os.path.isdir(unpacked):
        subprocess.run(['unzip', '-o', '-q', zip_path, '-d', unpacked], check=True)
    for name, target in (('Inter-Bold.ttf', 'inter-bold.ttf'),
                         ('Inter-SemiBold.ttf', 'inter-semibold.ttf')):
        shutil.copyfile(os.path.join(unpacked, 'extras', 'ttf', name), os.path.join(ov, target))
    print('· font   Inter Bold + SemiBold → overlays/')


if __name__ == '__main__':
    sys.exit(main())
