"""Branchenmodul Gastronomie & Events.

Turns a short operator message ("Freitag DJ ab 21 Uhr, Samstag Cocktail Happy
Hour, Sonntag Live-Musik.") into ready post specs for the existing autopilot:
one weekly programme carousel plus one reel per event (each also goes out as
a story via `story_repost`). Everything lands as status "draft" in the
customer's folder and only posts after `freigeben`.

Only what the message says is used: no invented events, times or prices.
Missing details are listed in the approval file instead of being guessed.

Usage (from the repo root):
  python instagram_autopilot/branchen/gastro.py woche KUNDE "TEXT" [--ab YYYY-MM-DD] [--render]
  python instagram_autopilot/branchen/gastro.py freigeben KUNDE ID|alle
  python instagram_autopilot/branchen/gastro.py status KUNDE

KUNDE is a folder under instagram_autopilot/kunden/ (config.json with
"branche": "gastro"). Rendering and publishing run through autopilot.py with
AUTOPILOT_HOME set to that folder, exactly like The Tribe.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

CODE = Path(__file__).resolve().parent.parent          # instagram_autopilot/
KUNDEN = CODE / "kunden"

DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
SHORT = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"]
# full names (also "freitags"), case-insensitive; two-letter forms only capitalised and followed by
# a dot, a number, "ab" or a capitalised word ("Fr 21 Uhr", "Do Karaoke") – so "So viel los" is no Sunday
DAY_RE = re.compile(
    r"\b(?:(?i:(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag))s?"
    r"|(Mo|Di|Mi|Do|Fr|Sa|So)(?:\.|(?=\s+(?:[0-9A-ZÄÖÜ]|ab\b))))")
TIME_RE = re.compile(
    r"(?P<ab>\bab\s*)?(?P<h1>\d{1,2})(?:[:.](?P<m1>\d{2}))?"
    r"(?:\s*(?:-|–|bis)\s*(?P<h2>\d{1,2})(?:[:.](?P<m2>\d{2}))?)?\s*(?:Uhr|h)\b", re.I)
PRICE_RE = re.compile(r"\d+(?:[,.]\d{1,2})?\s*(?:€|Euro\b|EUR\b)|(?:€|\bEUR)\s*\d+(?:[,.]\d{1,2})?", re.I)

KINDS = [   # first match wins
    ("happyhour", ("happy hour", "happyhour")),
    ("dj", ("dj", "turntable", "plattenteller")),
    ("sport", ("fußball", "fussball", "bundesliga", "champions league", "länderspiel", "public viewing")),
    ("live", ("live", "band", "konzert", "akustik", "unplugged", "open mic")),
    ("quiz", ("quiz", "karaoke", "spieleabend", "bingo")),
    ("essen", ("brunch", "frühstück", "menü", "burger", "pizza", "küche", "essen", "mittagstisch")),
    ("drinks", ("cocktail", "bier", "wein", "drink", "getränk", "special", "spritz", "shots")),
    ("thema", ("party", "motto", "themenabend", "abend", "oktoberfest", "halloween", "silvester")),
]
EMOJI = {"happyhour": "🍹", "dj": "🎧", "live": "🎸", "sport": "⚽", "quiz": "🎤", "essen": "🍽️",
         "drinks": "🍻", "thema": "✨", "event": "📅"}
TAGS = {"happyhour": ["#happyhour", "#cocktails"], "dj": ["#djnight", "#nightlife"],
        "live": ["#livemusik", "#livemusic"], "sport": ["#publicviewing", "#fussball"],
        "quiz": ["#quizabend"], "essen": ["#foodie", "#essengehen"], "drinks": ["#drinks", "#bar"],
        "thema": ["#party"], "event": []}
REEL_IDEA = {   # what the operator could film in 5 seconds – suggestion only, nothing is rendered from it
    "happyhour": "Cocktail wird geshakt oder eingeschenkt, von nah",
    "dj": "Hände am DJ-Pult, Lichter im Hintergrund",
    "live": "Soundcheck der Band oder Gitarre von nah",
    "sport": "Leinwand/TV mit Stimmung am Tresen (ohne erkennbare Gäste ohne Einverständnis)",
    "quiz": "Quizmaster mit Mikro oder Antwortzettel auf dem Tisch",
    "essen": "Teller wird angerichtet und rausgereicht",
    "drinks": "Bier wird gezapft oder Drink wird garniert",
    "thema": "Deko-Detail oder Aufbau am Nachmittag",
    "event": "Kurzer Schwenk durch den Laden vor dem Öffnen",
}


# --------------------------------------------------------------------------
# Parsing
# --------------------------------------------------------------------------

def kind_of(text: str) -> str:
    low = text.lower()
    for kind, words in KINDS:
        if any(w in low for w in words):
            return kind
    return "event"


def clean_title(text: str) -> str:
    t = re.sub(r"\s+", " ", text).strip(" ,;.:-–\n")
    t = re.sub(r"^(?:ist|gibt'?s|gibt es|haben wir|wieder)\s+", "", t, flags=re.I)
    return t[:1].upper() + t[1:] if t else t


def parse(message: str, start: date) -> list[dict]:
    """Split at weekday names; each segment becomes one event on the next such day >= start."""
    hits = list(DAY_RE.finditer(message))
    events = []
    for i, m in enumerate(hits):
        seg = message[m.end(): hits[i + 1].start() if i + 1 < len(hits) else len(message)]
        name = (m.group(1) or m.group(2)).lower()
        wd = next(k for k, d in enumerate(DAYS) if d.lower().startswith(name[:2]))
        when = start + timedelta(days=(wd - start.weekday()) % 7)
        tm = TIME_RE.search(seg)
        time_txt = ""
        if tm:
            fmt = lambda h, mm: f"{int(h)}" + (f":{mm}" if mm and mm != "00" else "")
            time_txt = fmt(tm["h1"], tm["m1"])
            if tm["h2"]:
                time_txt += f"–{fmt(tm['h2'], tm['m2'])}"
            time_txt = ("ab " if tm["ab"] else "") + time_txt + " Uhr"
            seg = seg[:tm.start()] + seg[tm.end():]
        prices = PRICE_RE.findall(seg)
        for p in prices:
            seg = seg.replace(p, " ")
        title = clean_title(re.sub(r"\b(?:für|zu|nur)\s*$", "", clean_title(seg)))
        if not title:
            continue
        missing = [] if time_txt else ["Uhrzeit"]
        events.append({"weekday": wd, "date": when.isoformat(), "title": title, "time": time_txt,
                       "price": " / ".join(p.strip() for p in prices), "kind": kind_of(title),
                       "missing": missing, "source": message[m.start():m.end()] + seg.rstrip()})
    events.sort(key=lambda e: e["date"])
    return events


# --------------------------------------------------------------------------
# Content
# --------------------------------------------------------------------------

def slugify(text: str) -> str:
    t = text.lower().translate(str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"}))
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:28]


def when_line(e: dict) -> str:
    d = date.fromisoformat(e["date"])
    parts = [f"{SHORT[e['weekday']].title()} {d:%d.%m.}"]
    if e["time"]:
        parts.append(e["time"])
    if e["price"]:
        parts.append(e["price"])
    return " · ".join(parts)


class Picker:
    """Rotates the customer's own photos per event type (falls back to 'allgemein', then none)."""

    def __init__(self, bilder: dict):
        self.bilder, self.used = bilder, {}

    def __call__(self, kind: str) -> str | None:
        pool = self.bilder.get(kind) or self.bilder.get("drinks" if kind == "happyhour" else "") \
            or self.bilder.get("allgemein") or []
        if not pool:
            return None
        n = self.used.get(id(pool), 0)
        self.used[id(pool)] = n + 1
        return pool[n % len(pool)]


def caption(e: dict, g: dict, name: str) -> str:
    d = date.fromisoformat(e["date"])
    head = f"{EMOJI[e['kind']]} {DAYS[e['weekday']]}, {d:%d.%m.}: {e['title']}"
    if e["time"]:
        head += f" – {e['time']}"
    if e["price"]:
        head += f" ({e['price']})"
    where = ", ".join(x for x in (name.split(" (")[0], g.get("adresse")) if x)
    tags = list(dict.fromkeys(g.get("hashtags", []) + TAGS[e["kind"]]))
    return f"{head}\n\n{g.get('cta', '')}\n\n📍 {where}\n\n" + " ".join(tags)


def event_spec(e: dict, g: dict, cfg: dict, pick: Picker, week_id: str) -> dict:
    d = date.fromisoformat(e["date"])
    bg = pick(e["kind"])
    hook = {"kind": "hook", "tag": f"{DAYS[e['weekday']].upper()} · {d:%d.%m.}", "text": e["title"],
            "max_seconds": 3.4}
    if e["time"]:
        hook["sub"] = e["time"] + (f" · {e['price']}" if e["price"] else "")
    if bg:
        hook["bg"] = bg
    where = ", ".join(x for x in (cfg.get("name", "").split(" (")[0], g.get("adresse")) if x)
    point = {"kind": "point", "num": SHORT[e["weekday"]], "title": e["title"], "body": when_line(e)
             + (f"\n{where}" if where else "")}
    cta = {"kind": "cta", "text": g.get("cta", ""), "button": cfg.get("cta_title", "Wir sehen uns!"),
           "button_sub": cfg.get("cta_sub", "")}
    if bg:
        cta["bg"] = bg
    return {"id": f"{week_id}-{SHORT[e['weekday']].lower()}-{slugify(e['title'])}", "type": "reel", "format": "gastro-event",
            "hook_style": e["kind"], "niche": "gastro", "topic": e["kind"], "pain": "event", "music": "bed",
            "priority": 2, "not_before": e["date"], "expires": e["date"], "status": "draft",
            "caption": caption(e, g, cfg.get("name", "")), "hashtags": [],
            "slides": [hook, point, cta], "gastro": {"event": e, "reel_idee": REEL_IDEA[e["kind"]]}}


def week_spec(events: list[dict], g: dict, cfg: dict, pick: Picker, week_id: str, start: date) -> dict:
    first, last = date.fromisoformat(events[0]["date"]), date.fromisoformat(events[-1]["date"])
    slides = [{"kind": "hook", "tag": "WOCHENPROGRAMM", "text": "Diese Woche\nbei uns",
               "sub": f"{first:%d.%m.} – {last:%d.%m.}"}]
    bg0 = pick("allgemein")
    if bg0:
        slides[0]["bg"] = bg0
    for e in events:
        s = {"kind": "point", "num": SHORT[e["weekday"]], "title": e["title"], "body": when_line(e)}
        bg = pick(e["kind"])
        if bg:
            s["bg"] = bg
        slides.append(s)
    slides.append({"kind": "cta", "text": g.get("cta", ""), "button": cfg.get("cta_title", "Wir sehen uns!"),
                   "button_sub": cfg.get("cta_sub", "")})
    lines = [f"{EMOJI[e['kind']]} {DAYS[e['weekday']]}: {e['title']}" + (f" – {e['time']}" if e["time"] else "")
             + (f" ({e['price']})" if e["price"] else "") for e in events]
    tags = list(dict.fromkeys(g.get("hashtags", []) + [t for e in events for t in TAGS[e["kind"]]]))[:12]
    cap = "Das läuft diese Woche bei uns:\n\n" + "\n".join(lines) + f"\n\n{g.get('cta', '')}\n\n" + " ".join(tags)
    return {"id": f"{week_id}-wochenprogramm", "type": "carousel", "format": "gastro-woche",
            "hook_style": "wochenprogramm", "niche": "gastro", "topic": "woche", "pain": "event",
            "priority": 1, "not_before": start.isoformat(), "expires": last.isoformat(), "status": "draft",
            "caption": cap, "hashtags": [], "slides": slides}


# --------------------------------------------------------------------------
# Commands
# --------------------------------------------------------------------------

def load_kunde(slug: str) -> tuple[Path, dict]:
    home = KUNDEN / slug
    cfg = json.loads((home / "config.json").read_text(encoding="utf-8"))
    if cfg.get("branche") != "gastro":
        sys.exit(f"{slug}: config.json ist kein Gastro-Kunde (branche != gastro).")
    return home, cfg


def autopilot(home: Path, *args: str) -> None:
    env = {**os.environ, "AUTOPILOT_HOME": str(home)}
    subprocess.run([sys.executable, str(CODE / "autopilot.py"), *args], env=env, check=True,
                   stdout=subprocess.DEVNULL)


def cmd_woche(slug: str, message: str, ab: str | None, render: bool) -> None:
    home, cfg = load_kunde(slug)
    g = cfg.get("gastro", {})
    start = date.fromisoformat(ab) if ab else date.today()
    events = parse(message, start)
    if not events:
        sys.exit("Keine Wochentage erkannt – bitte z. B. „Freitag DJ ab 21 Uhr“ schreiben.")
    week_id = f"G{start:%y%m%d}"
    pick = Picker(g.get("bilder", {}))
    specs = [week_spec(events, g, cfg, pick, week_id, start)] + [event_spec(e, g, cfg, pick, week_id) for e in events]
    (home / "posts").mkdir(exist_ok=True)
    for s in specs:
        (home / "posts" / f"{s['id']}.json").write_text(json.dumps(s, ensure_ascii=False, indent=2) + "\n",
                                                        encoding="utf-8")
        if render:
            autopilot(home, "render", s["id"])
    review = freigabe_md(cfg, message, events, specs)
    out = home / "data" / f"freigabe-{week_id}.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text(review, encoding="utf-8")
    print(review)
    print(f"\n→ {out.relative_to(CODE.parent)}")


def freigabe_md(cfg: dict, message: str, events: list[dict], specs: list[dict]) -> str:
    media = cfg.get("media_public_base", "")
    rows = [f"# Freigabe {cfg.get('name')} – Woche ab {specs[0]['not_before']}", "",
            f"Eingang: „{message.strip()}“", "", "## Erkannt", "",
            "| Tag | Datum | Was | Uhrzeit | Preis | Fehlt |", "|---|---|---|---|---|---|"]
    for e in events:
        rows.append(f"| {DAYS[e['weekday']]} | {date.fromisoformat(e['date']):%d.%m.} | {e['title']} | "
                    f"{e['time'] or '–'} | {e['price'] or '–'} | {', '.join(e['missing']) or '–'} |")
    rows += ["", "Nichts wurde ergänzt oder geschätzt. Fehlende Angaben bitte nachreichen, sonst geht der Post ohne sie raus.",
             "", "## Inhalte (Status: Entwurf)", ""]
    for s in specs:
        when = "Mo der Woche" if s["format"] == "gastro-woche" else f"am {date.fromisoformat(s['not_before']):%d.%m.}"
        kind = "Karussell + Story" if s["type"] == "carousel" else "Reel + Story"
        rows += [f"### {s['id']}", f"- {kind}, geht {when} im Slot raus (abgelaufen = wird übersprungen)",
                 f"- Vorschau: {media}/{s['id']}/", "", "```", s["caption"], "```"]
        if s.get("gastro"):
            rows.append(f"- Reel-Idee für eigenen Clip (5 s): {s['gastro']['reel_idee']}")
        rows.append("")
    rows += ["## Freigeben", "", f"`python instagram_autopilot/branchen/gastro.py freigeben {cfg_slug(cfg)} alle`",
             "oder einzeln mit der ID. Erst danach postet der Autopilot."]
    return "\n".join(rows) + "\n"


def cfg_slug(cfg: dict) -> str:
    return cfg.get("media_dir", "/KUNDE").rsplit("/", 1)[-1]


def cmd_freigeben(slug: str, which: str) -> None:
    home, _ = load_kunde(slug)
    n = 0
    for f in sorted((home / "posts").glob("*.json")):
        spec = json.loads(f.read_text(encoding="utf-8"))
        if spec.get("status") == "draft" and which in ("alle", spec["id"]):
            spec["status"] = "queued"
            f.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"freigegeben: {spec['id']}")
            n += 1
    if not n:
        print("Nichts freizugeben.")


def cmd_status(slug: str) -> None:
    home, _ = load_kunde(slug)
    state_f = home / "data" / "state.json"
    published = json.loads(state_f.read_text(encoding="utf-8"))["published"] if state_f.exists() else {}
    for f in sorted((home / "posts").glob("*.json")):
        s = json.loads(f.read_text(encoding="utf-8"))
        st = "veröffentlicht" if s["id"] in published else s.get("status")
        print(f"{s['id']:<44} {st:<15} ab {s.get('not_before', '–')}  bis {s.get('expires', '–')}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Gastro-Modul: Nachricht → Posts → Freigabe → Autopilot")
    sub = ap.add_subparsers(dest="cmd", required=True)
    w = sub.add_parser("woche")
    w.add_argument("kunde")
    w.add_argument("text")
    w.add_argument("--ab", help="erster Tag der Woche (YYYY-MM-DD), Standard heute")
    w.add_argument("--render", action="store_true")
    f = sub.add_parser("freigeben")
    f.add_argument("kunde")
    f.add_argument("id")
    s = sub.add_parser("status")
    s.add_argument("kunde")
    a = ap.parse_args()
    if a.cmd == "woche":
        cmd_woche(a.kunde, a.text, a.ab, a.render)
    elif a.cmd == "freigeben":
        cmd_freigeben(a.kunde, a.id)
    else:
        cmd_status(a.kunde)


if __name__ == "__main__":
    main()
