import json, os

BASE = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE, "build-job.json")) as f:
    bj = json.load(f)

# Extract data
NAME = bj["name"]
PHONE = bj["phone"]
EMAIL = bj["email"]
ADDRESS = bj["address"]
IMAGES = bj["images"]
OPPS = bj["opps"]
HERO_IMG = IMAGES[5]  # slide.jpg
ICO = IMAGES[:5]       # icons

# Build HTML sections
print("Building index.html...")
