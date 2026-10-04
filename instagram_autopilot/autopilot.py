"""Instagram autopilot for @praxis.ki.bielefeld (formerly @ai.made.in.bielefeld).

Commands (run from the repo root):
  python instagram_autopilot/autopilot.py due          -> prints the post id due now (or nothing)
  python instagram_autopilot/autopilot.py plan N       -> prints the next N post ids in posting order
  python instagram_autopilot/autopilot.py render ID    -> renders ID into docs/ig-media/ID/
  python instagram_autopilot/autopilot.py publish ID   -> posts ID via the Instagram API
  python instagram_autopilot/autopilot.py insights     -> stores metrics + rebuilds data/report.md
  python instagram_autopilot/autopilot.py refresh      -> refreshes the long-lived token
  python instagram_autopilot/autopilot.py prune        -> deletes rendered media of published posts
  python instagram_autopilot/autopilot.py engage       -> DMs the KI-Check link to "CHECK" commenters
  python instagram_autopilot/autopilot.py benchmark    -> data/benchmark.md: what works for comparable accounts
  python instagram_autopilot/autopilot.py briefing [N]  -> data/briefing.md: all data condensed into
                                                           rules for the next reel (N = niche)

Uses the "Instagram API with Instagram Login" (graph.instagram.com), so no
Facebook page is needed. Secrets: IG_AI_TOKEN, IG_AI_USER_ID (optional
GH_SECRETS_PAT to store a refreshed token back into the repo secrets).
"""
from __future__ import annotations

import base64
import csv
import json
import subprocess
import os
import shutil
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
HOME = Path(os.getenv("AUTOPILOT_HOME") or HERE).resolve()   # account folder (config, posts, data)
CONFIG = json.loads((HOME / "config.json").read_text(encoding="utf-8"))
POSTS = HOME / "posts"
DATA = HOME / "data"
STATE_FILE = DATA / "state.json"
MEDIA_DIR = REPO / "docs" / CONFIG.get("media_dir", "ig-media")
API = CONFIG["api_base"]
TZ = ZoneInfo(CONFIG["timezone"])


def token() -> str:
    t = os.getenv("IG_AI_TOKEN", "").strip()
    if not t:
        sys.exit("IG_AI_TOKEN fehlt – bitte als GitHub-Secret anlegen.")
    return t


_ACCOUNT_CHECKED = False


def user_id() -> str:
    """Account id; 'me' works with Instagram-Login tokens when no id is set.

    Before any API work we verify that the token belongs to the configured
    account, so a wrong token (e.g. The Tribe's) can never post here.
    """
    global _ACCOUNT_CHECKED
    u = os.getenv("IG_AI_USER_ID", "").strip() or "me"
    if not _ACCOUNT_CHECKED:
        who = api("GET", u, fields="username")
        print(f"Konto: @{who.get('username')}")
        allowed = CONFIG["account"] if isinstance(CONFIG["account"], list) else [CONFIG["account"]]
        if any(allowed) and who.get("username", "").lower() not in {a.lower() for a in allowed if a}:
            sys.exit(f"Token gehört zu @{who.get('username')}, erwartet @{allowed[0]} – Abbruch.")
        _ACCOUNT_CHECKED = True
    return u


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"published": {}, "token_refreshed_at": None}


def save_state(state: dict) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_spec(post_id: str) -> dict:
    return json.loads((POSTS / f"{post_id}.json").read_text(encoding="utf-8"))


def api(method: str, path: str, **params) -> dict:
    params["access_token"] = token()
    url = path if path.startswith("http") else f"{API}/{path}"
    for attempt in range(8):
        r = requests.request(method, url, params=params if method == "GET" else None,
                             data=params if method != "GET" else None, timeout=60)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
        err = body.get("error") or {}
        if err.get("code") in (4, 17, 32, 613) or err.get("is_transient"):
            wait = min(60 * 2 ** attempt, 900)          # rate limit: back off instead of failing
            print(f"Rate-Limit ({err.get('code')}), warte {wait} s")
            time.sleep(wait)
            continue
        if r.status_code < 500:
            break
        time.sleep(5 * (attempt + 1))
    if r.status_code >= 400 or "error" in body:
        raise RuntimeError(f"{method} {path} -> {r.status_code}: {json.dumps(body)[:500]}")
    return body


# --------------------------------------------------------------------------
# Scheduling
# --------------------------------------------------------------------------

def category(spec: dict) -> str:
    fmt = spec.get("format", "")
    if fmt.startswith("viral"):
        return "viral"
    if fmt.startswith("demo"):
        return "tool"
    if fmt.startswith("service"):
        return "leistung"
    return "wissen"


def next_queued(state: dict) -> str | None:
    """Next queued post following the content mix in config.json (`mix`).

    The slot in the rotation is derived from how many posts are published;
    within a category the lowest `priority` wins (default 50), then file name.
    If the wanted category is empty, the next category in the rotation is used.
    """
    queued = []
    today = datetime.now(TZ).date().isoformat()
    for f in sorted(POSTS.glob("*.json")):
        spec = json.loads(f.read_text(encoding="utf-8"))
        if not spec.get("not_before", "") <= today <= spec.get("expires", "9999"):
            continue      # dated posts (e.g. gastro events) only go out in their window
        if CONFIG.get("require_briefing") and spec.get("status", "queued") == "queued" \
                and not briefing_ok(spec):
            print(f"{spec['id']}: ohne gültiges Briefing – wird nicht gepostet.", file=sys.stderr)
            continue
        if spec.get("status", "queued") == "queued" and spec["id"] not in state["published"]:
            queued.append((spec.get("priority", 50), f.name, spec["id"], category(spec)))
    if not queued:
        return fallback_idea(state) if CONFIG.get("fallback_from_ideas", True) else None
    fresh = [q for q in queued if q[0] <= 1]      # Director's fresh posts beat the content mix
    if fresh:
        return min(fresh)[2]
    mix = CONFIG.get("mix") or ["viral", "tool", "leistung", "viral", "tool", "wissen"]
    start = len(state["published"]) % len(mix)
    for k in range(len(mix)):
        want = mix[(start + k) % len(mix)]
        cand = [q for q in queued if q[3] == want]
        if cand:
            return min(cand)[2]
    return min(queued)[2]


# --------------------------------------------------------------------------
# Freshness + fallback: never repeat the same pictures / format back to back
# --------------------------------------------------------------------------

def spec_images(spec: dict) -> list[str]:
    imgs = [spec["bg"]] if isinstance(spec.get("bg"), str) else list(spec.get("bg") or [])
    for s in spec.get("slides", []):
        if s.get("bg"):
            imgs.append(s["bg"])
        imgs += s.get("frames", [])
    return sorted(set(imgs))


def recent(state: dict, n: int) -> list[dict]:
    rows = []
    for pid, p in state["published"].items():
        if "images" not in p and (POSTS / f"{pid}.json").exists():
            p = {**p, "images": spec_images(load_spec(pid))}
        rows.append(p)
    rows.sort(key=lambda p: (p.get("local_date", ""), p.get("local_time", "")))
    return rows[-n:]


def staleness(spec: dict, state: dict) -> float:
    """0 = completely fresh, 1 = looks like something we just posted."""
    last = recent(state, CONFIG.get("freshness_window", 8))
    used = {img for p in last for img in p.get("images", [])}
    imgs = spec_images(spec)
    overlap = len([i for i in imgs if i in used]) / len(imgs) if imgs else 0.0
    same_fmt = sum(1 for p in last[-2:] if p.get("format") == spec.get("format"))
    same_hook = sum(1 for p in last[-3:] if p.get("hook_style") == spec.get("hook_style"))
    return min(1.0, 0.6 * overlap + 0.2 * same_fmt + 0.1 * same_hook)


def pain_strength() -> dict:
    """Mean interest per pain from the last insights run (empty if none yet)."""
    try:
        rows = json.loads((DATA / "insights_latest.json").read_text(encoding="utf-8"))["posts"]
    except (FileNotFoundError, KeyError, json.JSONDecodeError):
        return {}
    agg: dict = {}
    for r in rows:
        agg.setdefault(r.get("pain"), []).append(float(r.get("interest") or 0))
    return {k: sum(v) / len(v) for k, v in agg.items()}


def fallback_idea(state: dict) -> str | None:
    """Safety net when the creative director has not queued anything:
    pick the idea whose pain performs best and that looks least like recent posts."""
    strength = pain_strength()
    top = max(strength.values(), default=0) or 1.0
    best = None
    for f in sorted(POSTS.glob("*.json")):
        spec = json.loads(f.read_text(encoding="utf-8"))
        if spec.get("status") != "idea" or spec["id"] in state["published"]:
            continue
        val = strength.get(spec.get("pain"), top * 0.5) / top - 1.5 * staleness(spec, state)
        if best is None or val > best[0]:
            best = (val, spec["id"])
    return best[1] if best else None


def cmd_due() -> None:
    """Print the id of the post to publish now, if a slot is open."""
    now = datetime.now(TZ)
    state = load_state()
    today = now.date().isoformat()
    posted_today = sum(1 for p in state["published"].values()
                       if p.get("local_date") == today
                       and (CONFIG.get("forced_counts") or not p.get("forced")))   # backlog runs don't eat slots
    if posted_today >= CONFIG.get("max_posts_per_day", 1) and os.getenv("FORCE") != "1":
        return
    window = timedelta(minutes=CONFIG.get("slot_window_minutes", 55))
    in_slot = False
    for slot in CONFIG["slots"]:
        if slot["weekday"] != now.weekday():
            continue
        h, m = map(int, slot["time"].split(":"))
        start = now.replace(hour=h, minute=m, second=0, microsecond=0)
        if start <= now < start + window:
            in_slot = True
    gap = CONFIG.get("min_gap_minutes", 0)
    if gap and os.getenv("FORCE") != "1":   # two runs in one slot must not post back to back
        stamps = [p.get("timestamp") for p in state["published"].values() if p.get("timestamp")]
        if stamps:
            last = max(datetime.strptime(t, "%Y-%m-%dT%H:%M:%S%z") for t in stamps)
            if now - last < timedelta(minutes=gap):
                return
    if in_slot or os.getenv("FORCE") == "1":
        pid = os.getenv("POST_ID") or next_queued(state)
        if pid:
            print(pid)


# --------------------------------------------------------------------------
# Render + publish
# --------------------------------------------------------------------------

def cmd_plan(n: str = "1") -> None:
    """Print the next n post ids in posting order (lets a batch render them in parallel)."""
    state = load_state()
    for _ in range(int(n)):
        pid = next_queued(state)
        if not pid:
            break
        spec = load_spec(pid)
        state["published"][pid] = {"local_date": "9999", "local_time": "99:99", "format": spec.get("format"),
                                   "hook_style": spec.get("hook_style"), "images": spec_images(spec)}
        print(pid)


def cmd_render(post_id: str) -> None:
    sys.path.insert(0, str(HERE))
    import render  # noqa: E402  (heavy imports only when rendering)
    out = MEDIA_DIR / post_id
    if out.exists():
        shutil.rmtree(out)
    meta = render.render(load_spec(post_id), out)
    (out / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(json.dumps(meta))


def media_url(post_id: str, name: str) -> str:
    """Prefer the GitHub Pages URL (correct content-type); fall back to raw."""
    pages = f"{CONFIG['media_public_base']}/{post_id}/{name}"
    deadline = time.time() + int(os.getenv("PAGES_WAIT_SECONDS", "600"))
    while time.time() < deadline:
        try:
            r = requests.head(pages, timeout=20, allow_redirects=True)
            if r.status_code == 200:
                return pages
        except requests.RequestException:
            pass
        time.sleep(20)
    print(f"Pages-URL nicht erreichbar, nutze raw: {name}")
    return f"{CONFIG['media_raw_base']}/{post_id}/{name}"


def wait_container(cid: str, minutes: int = 12) -> None:
    for _ in range(minutes * 3):
        st = api("GET", cid, fields="status_code,status")
        code = st.get("status_code")
        if code == "FINISHED":
            return
        if code in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Container {cid}: {st}")
        time.sleep(20)
    raise RuntimeError(f"Container {cid} nicht fertig geworden")


def caption_for(spec: dict) -> str:
    parts = [spec["caption"].strip(), "", CONFIG["caption_footer"]]
    if spec.get("hashtags"):
        parts += ["", " ".join(spec["hashtags"])]
    return "\n".join(parts)[:2150]


def quota_left(uid: str) -> int:
    """Remaining API publishes in the rolling 24 h window (stories must never starve the reels)."""
    try:
        res = api("GET", f"{uid}/content_publishing_limit", fields="quota_usage,config")
        item = res["data"][0]
        return int(item.get("config", {}).get("quota_total", 100)) - int(item.get("quota_usage", 0))
    except (RuntimeError, IndexError, KeyError, ValueError):
        return 100


def cmd_publish(post_id: str) -> None:
    spec = load_spec(post_id)
    subprocess.run(["git", "pull", "-q", "--rebase", "--autostash"], cwd=REPO, check=False)
    if post_id in load_state()["published"]:   # a parallel run already posted it
        print(f"{post_id} ist bereits veröffentlicht – übersprungen.")
        return
    meta = json.loads((MEDIA_DIR / post_id / "meta.json").read_text(encoding="utf-8"))
    uid = user_id()
    left = quota_left(uid)
    if left < 1:   # rolling 24 h limit of the publishing API: keep the post queued, try again later
        print(f"Kontingent erschöpft ({left} frei) – {post_id} bleibt in der Warteschlange.")
        return
    caption = caption_for(spec)
    trial = None
    if spec["type"] == "reel":
        args = dict(media_type="REELS", video_url=media_url(post_id, meta["video"]),
                    cover_url=media_url(post_id, meta["cover"]), caption=caption, share_to_feed="true")
        trial = spec.get("trial")
        if trial:   # trial reel: shown to non-followers only; Meta graduates it on good early performance
            strategy = trial if trial in ("MANUAL", "SS_PERFORMANCE") else "SS_PERFORMANCE"
            try:
                c = api("POST", f"{uid}/media", **args, trial_params=json.dumps({"graduation_strategy": strategy}))
            except RuntimeError as e:
                print(f"Probe-Reel abgelehnt, poste normal: {e}")
                trial, c = None, api("POST", f"{uid}/media", **args)
        else:
            c = api("POST", f"{uid}/media", **args)
        cid = c["id"]
    else:
        children = []
        for name in meta["images"]:
            child = api("POST", f"{uid}/media", image_url=media_url(post_id, name), is_carousel_item="true")
            children.append(child["id"])
        for ch in children:
            wait_container(ch, minutes=5)
        c = api("POST", f"{uid}/media", media_type="CAROUSEL", children=",".join(children), caption=caption)
        cid = c["id"]
    wait_container(cid)
    try:
        pub = api("POST", f"{uid}/media_publish", creation_id=cid)
    except RuntimeError as e:
        if "2207042" in str(e):   # publishing limit reached: not an error, the post simply waits
            print(f"Veröffentlichungslimit erreicht – {post_id} bleibt in der Warteschlange.")
            return
        raise
    info = api("GET", pub["id"], fields="permalink,timestamp")
    story = None
    if CONFIG.get("story_repost", True) and not trial and quota_left(uid) > CONFIG.get("story_min_quota", 25):
        try:   # same content as a story -> reaches existing followers first (carousel: its cover slide)
            if spec["type"] == "reel":
                st = api("POST", f"{uid}/media", media_type="STORIES", video_url=media_url(post_id, meta["video"]))
            else:
                st = api("POST", f"{uid}/media", media_type="STORIES",
                         image_url=media_url(post_id, meta.get("story") or meta["images"][0]))
            wait_container(st["id"], minutes=8)
            story = api("POST", f"{uid}/media_publish", creation_id=st["id"])["id"]
            print("Story veröffentlicht")
        except RuntimeError as e:
            print(f"Story fehlgeschlagen (Beitrag ist trotzdem online): {e}")
    now = datetime.now(TZ)
    state = load_state()
    state["published"][post_id] = {
        "media_id": pub["id"], "permalink": info.get("permalink"), "timestamp": info.get("timestamp"),
        "local_date": now.date().isoformat(), "local_time": now.strftime("%H:%M"),
        "weekday": now.weekday(), "type": spec["type"], "format": spec.get("format"),
        "hook_style": spec.get("hook_style"), "topic": spec.get("topic"), "pain": spec.get("pain"),
        "seconds": meta.get("seconds"), "images": spec_images(spec),
        "hook": next((s.get("text") or s.get("title") for s in spec.get("slides", [])
                      if s.get("text") or s.get("title")), ""),
        "kinds": [s["kind"] for s in spec.get("slides", [])], "music": meta.get("music") or spec.get("music", "bed"),
        "series": spec.get("series"), "forced": os.getenv("FORCE") == "1", "story_id": story,
        "trial": bool(trial), "briefing": spec.get("briefing"), "hypothesis": spec.get("hypothesis"),
        "variable": spec.get("variable"), "variant": spec.get("variant"),
    }
    save_state(state)
    spec["status"] = "published"
    (POSTS / f"{post_id}.json").write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Veröffentlicht: {post_id} -> {info.get('permalink')}")


def cmd_prune() -> None:
    state = load_state()
    cutoff = (datetime.now(TZ) - timedelta(days=CONFIG.get("prune_after_days", 0))).date().isoformat()
    for pid, p in state["published"].items():
        d = MEDIA_DIR / pid
        if d.exists() and p.get("local_date", "9999") <= cutoff:
            shutil.rmtree(d)
            print(f"Medien gelöscht: {pid}")


# --------------------------------------------------------------------------
# Engagement: keyword comments -> private reply (DM) with the KI-Check link
# --------------------------------------------------------------------------

ENGAGE_FILE = DATA / "engage.json"


def api_json(path: str, payload: dict) -> dict:
    r = requests.post(f"{API}/{path}", params={"access_token": token()}, json=payload, timeout=60)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
    if r.status_code >= 400 or "error" in body:
        raise RuntimeError(f"POST {path} -> {r.status_code}: {json.dumps(body)[:400]}")
    return body


def is_keyword(text: str) -> bool:
    words = {w.strip(".,!?:;\"'()").lower() for w in (text or "").split()}
    return bool(words & {k.lower() for k in CONFIG["engage"]["keywords"]})


def dm_text_for(comment: str, cfg: dict) -> str:
    """Keyword-specific DM (engage.texts, e.g. GASTRO) before the default text."""
    words = {w.strip(".,!?:;\"'()").lower() for w in (comment or "").split()}
    for key, text in (cfg.get("texts") or {}).items():
        if key.lower() in words:
            return text
    return cfg["dm_text"]


def cmd_engage() -> None:
    """Answer keyword comments (e.g. "CHECK") once with a private reply.

    Only comments on our own recent posts are handled, each at most once,
    and only because the commenter asked for it. Stored: comment ids only.
    """
    cfg = CONFIG["engage"]
    uid = user_id()
    handled = set(json.loads(ENGAGE_FILE.read_text())["handled"]) if ENGAGE_FILE.exists() else set()
    cutoff = datetime.now(timezone.utc) - timedelta(days=6)   # private replies: max 7 days
    media = api("GET", f"{uid}/media", fields="id,timestamp", limit=25).get("data", [])
    new = 0
    for m in media:
        if datetime.strptime(m["timestamp"], "%Y-%m-%dT%H:%M:%S%z") < cutoff:
            continue
        comments = api("GET", f"{m['id']}/comments", fields="id,text,username,timestamp", limit=50).get("data", [])
        for c in comments:
            own = CONFIG["account"] if isinstance(CONFIG["account"], list) else [CONFIG["account"]]
            if c["id"] in handled or c.get("username", "").lower() in {a.lower() for a in own if a}:
                continue
            if not is_keyword(c.get("text", "")):
                continue
            name = c.get("username", "")
            text = dm_text_for(c.get("text", ""), cfg)
            try:
                api_json(f"{uid}/messages", {"recipient": {"comment_id": c["id"]},
                                               "message": {"text": text.format(name=name, link=CONFIG["dm_link"])}})
                api("POST", f"{c['id']}/replies", message=cfg["public_reply"].format(name=name))
                new += 1
            except RuntimeError as e:
                print(f"Antwort auf Kommentar {c['id']} fehlgeschlagen: {e}")
                continue
            handled.add(c["id"])
    DATA.mkdir(parents=True, exist_ok=True)
    ENGAGE_FILE.write_text(json.dumps({"handled": sorted(handled)}, indent=1) + "\n", encoding="utf-8")
    stats = DATA / "engage_stats.json"
    st = json.loads(stats.read_text()) if stats.exists() else {}
    day = datetime.now(TZ).date().isoformat()
    if new:
        st[day] = st.get(day, 0) + new
        stats.write_text(json.dumps(st, indent=1) + "\n", encoding="utf-8")
    print(f"{new} Keyword-Kommentare beantwortet")


# --------------------------------------------------------------------------
# Insights + report
# --------------------------------------------------------------------------

REEL_METRICS = ["views", "reach", "saved", "shares", "likes", "comments", "total_interactions",
                "ig_reels_avg_watch_time", "ig_reels_video_view_total_time", "reels_skip_rate",
                "follows", "profile_visits"]
FEED_METRICS = ["views", "reach", "saved", "shares", "likes", "comments", "total_interactions",
                "follows", "profile_visits"]


def media_insights(mid: str, metrics: list[str]) -> dict:
    """Fetch metrics; drop the ones the API rejects instead of failing."""
    out: dict = {}
    try:
        res = api("GET", f"{mid}/insights", metric=",".join(metrics))
        for item in res.get("data", []):
            vals = item.get("values") or [{}]
            out[item["name"]] = vals[0].get("value", item.get("total_value", {}).get("value"))
        return out
    except RuntimeError:
        pass
    for m in metrics:          # slow path: one by one
        try:
            res = api("GET", f"{mid}/insights", metric=m)
            item = res["data"][0]
            out[m] = (item.get("values") or [{}])[0].get("value", item.get("total_value", {}).get("value"))
        except (RuntimeError, IndexError, KeyError) as e:
            err = e
            continue
    if not out:
        print(f"Keine Kennzahlen für {mid}: {locals().get('err')}", file=sys.stderr)
    return out


def score(row: dict) -> float:
    """Weighted engagement per 100 reached accounts (saves/shares weigh most)."""
    reach = max(float(row.get("reach") or 0), 1.0)
    pts = (4 * float(row.get("shares") or 0) + 3 * float(row.get("saved") or 0)
           + 2 * float(row.get("comments") or 0) + float(row.get("likes") or 0)
           + 5 * float(row.get("follows") or 0))
    return round(100 * pts / reach, 2)


def interest(row: dict) -> float:
    """Absolute interest: views plus weighted interactions, boosted by retention."""
    g = lambda k: float(row.get(k) or 0)
    pts = g("views") + 3 * g("likes") + 5 * g("comments") + 6 * g("saved") + 8 * g("shares") + 10 * g("follows")
    return round(pts * (0.5 + min(float(row.get("watch_ratio") or 1.0), 2.5) / 2), 1)


def pain_report(rows: list[dict]) -> list[str]:
    """Rank audience pains by interest and point to the next tool to build."""
    tools = CONFIG.get("tools_by_pain", {})
    agg: dict = {}
    for r in rows:
        agg.setdefault(r.get("pain") or "sonstiges", []).append(r)
    ranking = sorted(agg.items(), key=lambda kv: -sum(x["interest"] for x in kv[1]) / len(kv[1]))
    out = ["", "## Pain-Ranking (Ø Interesse je Thema)", "",
           "| Pain | Ø Interesse | Ø Views | Ø Watch-Ratio | Beiträge | Tool vorhanden |", "|---|---|---|---|---|---|"]
    for pain, rs in ranking:
        wr = [x["watch_ratio"] for x in rs if x.get("watch_ratio")]
        out.append(f"| {pain} | {sum(x['interest'] for x in rs) / len(rs):.1f} | "
                   f"{sum(float(x.get('views') or 0) for x in rs) / len(rs):.1f} | "
                   f"{(sum(wr) / len(wr)) if wr else 0:.2f} | {len(rs)} | {', '.join(tools.get(pain, [])) or '–'} |")
    top_without = next((p for p, rs in ranking if not tools.get(p) and len(rs) >= 1 and p not in ("sonstiges", "allgemein")), None)
    top = ranking[0][0] if ranking else None
    out += ["", f"**Stärkster Pain:** {top or '–'}  ",
            f"**Nächstes Tool bauen für:** {top_without or 'Varianten/Verbesserung des Tools zum stärksten Pain'}  ",
            "_Unter 3 Beiträgen je Pain nur Hypothese._"]
    return out


def cmd_insights() -> None:
    uid = user_id()
    state = load_state()
    acct = api("GET", uid, fields="username,followers_count,media_count")
    live, url = set(), f"{uid}/media"
    try:   # posts Maik deleted by hand drop out of the analysis instead of erroring
        params = {"fields": "id", "limit": 100}
        while url:
            page = api("GET", url, **params)
            live |= {m["id"] for m in page.get("data", [])}
            nxt = page.get("paging", {}).get("next")
            url, params = nxt, {}
    except RuntimeError:
        live = set()
    rows = []
    for pid, p in state["published"].items():
        if live and p.get("media_id") not in live:
            p["deleted"] = True
            continue
        metrics = REEL_METRICS if p["type"] == "reel" else FEED_METRICS
        m = media_insights(p["media_id"], metrics)
        try:
            spec = load_spec(pid)
            p = {"images": spec_images(spec), "kinds": [x["kind"] for x in spec.get("slides", [])],
                 "music": spec.get("music", "bed"), "series": spec.get("series"),
                 "hook": next((x.get("text") or x.get("title") for x in spec.get("slides", [])
                               if x.get("text") or x.get("title")), ""),
                 **p, "pain": spec.get("pain") or spec.get("topic"), "niche": spec.get("niche")}
        except FileNotFoundError:
            pass
        row = {"post_id": pid, **{k: p.get(k) for k in ("type", "format", "hook_style", "topic", "pain",
                                                         "local_date", "local_time", "weekday", "seconds",
                                                         "images", "hook", "kinds", "music", "series",
                                                         "permalink", "niche", "trial", "timestamp",
                                                         "hypothesis", "variable", "variant")}, **m}
        if m.get("ig_reels_avg_watch_time"):
            row["avg_watch_s"] = round(float(m["ig_reels_avg_watch_time"]) / 1000, 2)
        if p["type"] == "reel" and m.get("ig_reels_avg_watch_time") and p.get("seconds"):
            row["watch_ratio"] = round(float(m["ig_reels_avg_watch_time"]) / 1000 / float(p["seconds"]), 3)
        row["score"] = score(row)
        row["interest"] = interest(row)
        rows.append(row)
    order = sorted(rows, key=lambda r: (r.get("local_date") or "", r.get("local_time") or ""))
    for prev, r in zip([None] + order[:-1], order):     # minutes since the previous post
        if prev and prev.get("local_date") == r.get("local_date") and prev.get("local_time") and r.get("local_time"):
            h1, m1 = map(int, prev["local_time"].split(":")); h2, m2 = map(int, r["local_time"].split(":"))
            r["gap_min"] = (h2 * 60 + m2) - (h1 * 60 + m1)
    today = datetime.now(TZ).date().isoformat()
    DATA.mkdir(parents=True, exist_ok=True)
    snap = {"date": today, "generated_at": datetime.now(TZ).isoformat(timespec="minutes"), "account": acct, "account_insights": account_insights(uid), "posts": rows}
    (DATA / "insights_latest.json").write_text(json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8")
    hist = DATA / "followers.csv"
    new = not hist.exists()
    with hist.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["date", "followers", "media_count"])
        w.writerow([today, acct.get("followers_count"), acct.get("media_count")])
    save_state(state)
    write_report(snap)
    evaluate_experiments(rows)
    print(f"{len(rows)} Beiträge ausgewertet, Follower: {acct.get('followers_count')}")


def account_insights(uid: str) -> dict:
    """Account-level signals: daily reach/profile views and where the audience lives."""
    out: dict = {}
    for metric in ("reach", "profile_views", "accounts_engaged", "follows_and_unfollows", "website_clicks"):
        try:
            res = api("GET", f"{uid}/insights", metric=metric, period="day", metric_type="total_value")
            item = res["data"][0]
            out[metric] = item.get("total_value", {}).get("value")
        except (RuntimeError, IndexError, KeyError):
            continue
    for metric in ("reach", "views"):   # how much comes from people who do not follow yet
        try:
            res = api("GET", f"{uid}/insights", metric=metric, period="day", metric_type="total_value",
                      breakdown="follow_type")
            res_b = res["data"][0]["total_value"]["breakdowns"][0]["results"]
            out[f"{metric}_by_follow_type"] = {r["dimension_values"][0]: r["value"] for r in res_b}
        except (RuntimeError, IndexError, KeyError):
            continue
    for metric, key in (("engaged_audience_demographics", "engaged_cities"), ("follower_demographics", "follower_cities")):
        try:
            res = api("GET", f"{uid}/insights", metric=metric, period="lifetime", timeframe="this_month",
                      breakdown="city", metric_type="total_value")
            res_b = res["data"][0]["total_value"]["breakdowns"][0]["results"]
            out[key] = sorted(({"city": r["dimension_values"][0], "n": r["value"]} for r in res_b),
                              key=lambda x: -x["n"])[:8]
        except (RuntimeError, IndexError, KeyError):
            continue
    return out


def deep_report(snap: dict, rows: list[dict]) -> list[str]:
    """What the creative director needs: hooks that held people, fatigue, cadence, audience."""
    out = ["", "## Hooks: was hält, was nicht", ""]
    reels = [r for r in rows if r.get("type") == "reel"]
    for r in sorted(reels, key=lambda r: -(r.get("interest") or 0))[:3]:
        out.append(f"- TOP {r['post_id']}: „{r.get('hook', '')}“ · Ø {r.get('avg_watch_s', '–')} s von "
                   f"{r.get('seconds', '–')} s · Skip {r.get('reels_skip_rate', '–')} · Reichweite {r.get('reach', '–')}")
    for r in sorted(reels, key=lambda r: (r.get("interest") or 0))[:3]:
        out.append(f"- FLOP {r['post_id']}: „{r.get('hook', '')}“ · Ø {r.get('avg_watch_s', '–')} s · "
                   f"Skip {r.get('reels_skip_rate', '–')} · Reichweite {r.get('reach', '–')}")
    gaps = [r for r in rows if r.get("gap_min") is not None]
    if gaps:
        close = [r for r in gaps if r["gap_min"] < 90]
        far = [r for r in gaps if r["gap_min"] >= 90]
        avg = lambda xs: sum(float(x.get("reach") or 0) for x in xs) / len(xs) if xs else 0
        out += ["", "## Abstand zwischen Posts", "",
                f"- < 90 min nach dem vorigen Post: Ø Reichweite {avg(close):.1f} (n={len(close)})",
                f"- ≥ 90 min: Ø Reichweite {avg(far):.1f} (n={len(far)})"]
    img: dict = {}
    for r in rows:
        for i in r.get("images") or []:
            img.setdefault(i, []).append(float(r.get("interest") or 0))
    if img:
        out += ["", "## Bilder (Ø Interesse, Anzahl Einsätze)", ""]
        for i, v in sorted(img.items(), key=lambda kv: -sum(kv[1]) / len(kv[1]))[:12]:
            out.append(f"- {i}: {sum(v) / len(v):.1f} (n={len(v)})")
    ai = snap.get("account_insights") or {}
    if ai:
        out += ["", "## Konto (heute)", ""]
        for k in ("reach", "profile_views", "accounts_engaged", "website_clicks", "follows_and_unfollows"):
            if k in ai:
                out.append(f"- {k}: {ai[k]}")
        for key in ("engaged_cities", "follower_cities"):
            if ai.get(key):
                out.append(f"- {key}: " + ", ".join(f"{c['city']} ({c['n']})" for c in ai[key]))
    return out


def write_report(snap: dict) -> None:
    rows = sorted(snap["posts"], key=lambda r: r.get("interest", 0), reverse=True)
    lines = [f"# Instagram-Report {snap['date']}", "",
             f"Follower: **{snap['account'].get('followers_count')}** · Beiträge: {snap['account'].get('media_count')}", "",
             "| Beitrag | Format | Pain | Hook | Reichweite | Views | Likes | Komm. | Saves | Shares | Watch-Ratio | Interesse |",
             "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        lines.append(f"| {r['post_id']} | {r.get('format')} | {r.get('pain')} | {r.get('hook_style')} | "
                     f"{r.get('reach', '–')} | {r.get('views', '–')} | {r.get('likes', '–')} | {r.get('comments', '–')} | "
                     f"{r.get('saved', '–')} | {r.get('shares', '–')} | {r.get('watch_ratio', '–')} | {r.get('interest', 0)} |")
    lines += pain_report(rows)
    lines += deep_report(snap, rows)
    for key in ("niche", "format", "hook_style", "pain", "local_time", "music"):
        agg: dict = {}
        for r in rows:
            agg.setdefault(r.get(key), []).append(r.get("interest", 0))
        lines += ["", f"## Ø Interesse nach {key}", ""]
        for k, v in sorted(agg.items(), key=lambda kv: -sum(kv[1]) / len(kv[1])):
            lines.append(f"- {k}: {sum(v) / len(v):.2f} (n={len(v)})")
    (DATA / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


# --------------------------------------------------------------------------
# Briefing: every reel is built from the data, and only briefed reels post
# --------------------------------------------------------------------------

BRIEFINGS = DATA / "briefings.json"


def briefing_ok(spec: dict) -> bool:
    """A queued spec posts only if it names a briefing written in the last 2 days."""
    try:
        known = json.loads(BRIEFINGS.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return False
    made = known.get(spec.get("briefing") or "")
    if not made:
        return False
    return datetime.now(TZ) - datetime.fromisoformat(made) < timedelta(days=2)


def _avg(xs: list) -> float | None:
    xs = [float(x) for x in xs if x not in (None, "", "–")]
    return round(sum(xs) / len(xs), 2) if xs else None


def _table(rows: list[dict], key, title: str) -> list[str]:
    """Mean views / watch ratio / skip rate grouped by key (a field name or a function)."""
    agg: dict = {}
    for r in rows:
        agg.setdefault(key(r) if callable(key) else r.get(key), []).append(r)
    out = ["", f"### {title}", "", "| Wert | n | Ø Views | Ø Reichweite | Ø Watch-Ratio | Ø Skip % |", "|---|---|---|---|---|---|"]
    for k, rs in sorted(agg.items(), key=lambda kv: -(_avg([r.get("views") for r in kv[1]]) or 0)):
        out.append(f"| {k} | {len(rs)} | {_avg([r.get('views') for r in rs])} | {_avg([r.get('reach') for r in rs])} | "
                   f"{_avg([r.get('watch_ratio') for r in rs])} | {_avg([r.get('reels_skip_rate') for r in rs])} |")
    return out


def _length(r: dict) -> str:
    s = float(r.get("seconds") or 0)
    return "< 12 s" if s < 12 else "12–18 s" if s < 18 else "18–24 s" if s < 24 else "≥ 24 s"


def _slot(r: dict) -> str:
    return (r.get("local_time") or "??")[:2] + " Uhr"


def _niche(r: dict) -> str:
    return r.get("niche") or "alt (vor Nischenwechsel 30.09.)"


def _music(r: dict) -> str:
    """Music group: self-made bed/beat or the library track's main mood (music/CATALOG.json)."""
    m = str(r.get("music") or "bed")
    if not m.startswith("track:"):
        return f"selbst gemacht ({m})"
    try:
        cat = json.loads((HERE / "music" / "CATALOG.json").read_text(encoding="utf-8"))["tracks"]
        moods = cat[m[6:]]["moods"]
        return f"Bibliothek: {moods[1] if len(moods) > 1 else moods[0]}"
    except (FileNotFoundError, KeyError):
        return m


def _opener(r: dict) -> str:
    kinds = r.get("kinds") or []
    return "Clip zuerst" if kinds[1:2] == ["clip"] or kinds[:1] == ["clip"] else "Grafik zuerst"


def cmd_briefing(niche: str = "") -> None:
    """Condense every data source into data/briefing.md before a reel is built.

    Sources: insights_latest.json (per-reel metrics), followers.csv (trend), state.json
    (what ran when, fatigue), engage.json (keyword comments/DMs), learnings.md (last
    hypotheses). Writes a briefing id the new spec must carry ("briefing": id);
    with config "require_briefing" only such specs are posted.
    """
    now = datetime.now(TZ)
    bid = now.strftime("B%Y%m%d-%H%M")
    try:
        snap = json.loads((DATA / "insights_latest.json").read_text(encoding="utf-8"))
    except FileNotFoundError:
        snap = {"posts": [], "account": {}}
    rows = [r for r in snap.get("posts", []) if r.get("type") == "reel"]
    since = (now.date() - timedelta(days=14)).isoformat()
    cur = [r for r in rows if (r.get("local_date") or "") >= since]
    gen = snap.get("generated_at")
    age_h = (now - datetime.fromisoformat(gen)).total_seconds() / 3600 if gen else None
    L = [f"# Briefing {bid}" + (f" · Nische {niche}" if niche else ""), "",
         f"Daten: Auswertung {gen or snap.get('date', 'n/a')}"
         + (f" ({age_h:.1f} h alt)" if age_h is not None else "")
         + (" – **VERALTET: erst ig-autopilot-insights.yml laufen lassen**" if age_h is None or age_h > 3 else ""),
         f"Reels gesamt: {len(rows)} · davon letzte 14 Tage: {len(cur)}", ""]

    # 1. account trend: last value per day
    try:
        per_day: dict = {}
        with (DATA / "followers.csv").open(encoding="utf-8") as f:
            for row in csv.DictReader(f):
                per_day[row["date"]] = row["followers"]
        days = sorted(per_day)[-7:]
        L += ["## Konto", "", "Follower: " + " → ".join(f"{d[5:]} {per_day[d]}" for d in days)]
    except FileNotFoundError:
        L += ["## Konto", "", "Follower: n/a"]
    ai = snap.get("account_insights") or {}
    L.append("Heute: " + ", ".join(f"{k} {ai.get(k, 'n/a')}" for k in
                                    ("reach", "profile_views", "accounts_engaged", "website_clicks")))
    for metric in ("reach", "views"):
        ft = ai.get(f"{metric}_by_follow_type")
        if ft:
            non, fol = float(ft.get("NON_FOLLOWER") or 0), float(ft.get("FOLLOWER") or 0)
            L.append(f"{metric} heute: Nicht-Follower {non:.0f} · Follower {fol:.0f} · "
                     f"Anteil Nicht-Follower {100 * non / max(non + fol, 1):.0f} %")
        else:
            L.append(f"{metric} nach Follower/Nicht-Follower: n/a")
    by_day: dict = {}
    for r in rows:
        by_day.setdefault(r.get("local_date"), []).append(float(r.get("views") or 0))
    L.append("Ø Views je Posting-Tag: " + ", ".join(f"{d[5:]} {sum(v) / len(v):.0f} (n={len(v)})"
                                                 for d, v in sorted(by_day.items()) if d))

    # 1b. freshest signal first: the last 72 h decide the next reel more than old averages
    cut72 = (now - timedelta(hours=72)).date().isoformat()
    fresh = sorted((r for r in rows if (r.get("local_date") or "") >= cut72),
                   key=lambda r: -float(r.get("views") or 0))
    if fresh:
        L += ["", "## Stärkstes Signal (letzte 72 h) – zuerst darauf reagieren", ""]
        for r in fresh:
            hook = (r.get("hook") or "").replace("\n", " / ")
            L.append(f"- {r.get('views', 'n/a')} Views · Reichweite {r.get('reach', 'n/a')} · Skip {r.get('reels_skip_rate', 'n/a')} % · "
                     f"WR {r.get('watch_ratio', 'n/a')} · {r.get('niche')} · {r.get('local_date', '')[5:]} {r.get('local_time')} · „{hook}“")
        top = fresh[0]
        L.append(f"→ Top: {top['post_id']}. Viel Reichweite + hohe Skip-Rate = Thema/Zeit tragen, Einstieg hält nicht "
                 "(Thema behalten, Hook neu). Wenig Reichweite + niedrige Skip-Rate = Inhalt hält, Verteilung fehlt.")

    # 2. leads
    try:
        handled = json.loads((DATA / "engage.json").read_text(encoding="utf-8")).get("handled", [])
    except FileNotFoundError:
        handled = []
    L += ["", "## Leads", "", f"Keyword-Kommentare mit Auto-DM bisher: {len(handled)}",
          f"Kommentare auf Reels gesamt: {sum(int(r.get('comments') or 0) for r in rows)}, "
          f"Shares: {sum(int(r.get('shares') or 0) for r in rows)}, Saves: {sum(int(r.get('saved') or 0) for r in rows)}"]

    # 3. what works – recent reels first (old account phase is a different audience)
    base = cur or rows
    L += ["", "## Was wirkt (letzte 14 Tage, Views = Verteilung, Skip = erste Sekunden, Watch-Ratio = Inhalt)"]
    L += _table(base, _niche, "Nische")
    L += _table(base, "hook_style", "Hook-Stil")
    L += _table(base, "pain", "Pain")
    L += _table(base, _slot, "Uhrzeit (Stunde)")
    L += _table(base, _length, "Länge")
    L += _table(base, _opener, "Einstieg")
    L += _table(base, _music, "Musik")
    L += _table(base, lambda r: "Probe-Reel (nur Nicht-Follower)" if r.get("trial") else "normal", "Ausspielung")
    ranked = sorted(base, key=lambda r: -float(r.get("views") or 0))
    L += ["", "### Hooks nach Views", ""]
    for r in ranked:
        hook = (r.get("hook") or "").replace("\n", " / ")
        L.append(f"- {r.get('views', 'n/a')} Views · Skip {r.get('reels_skip_rate', 'n/a')} % · "
                 f"WR {r.get('watch_ratio', 'n/a')} · {r.get('niche')}/{r.get('hook_style')} · „{hook}“ ({r['post_id']})")

    # 4. derived rules (only from groups with n >= 2; below that it is a hypothesis)
    def best(key, metric, low=False):
        agg: dict = {}
        for r in base:
            v = r.get(metric)
            if v not in (None, "", "–") and (key != "niche" or r.get("niche")):
                agg.setdefault(key(r) if callable(key) else r.get(key), []).append(float(v))
        agg = {k: sum(v) / len(v) for k, v in agg.items() if len(v) >= 2}
        if not agg:
            return None
        return (min if low else max)(agg.items(), key=lambda kv: kv[1])
    L += ["", "## Regeln für das nächste Reel", ""]
    for label, key, metric, low in (("Hook-Stil mit niedrigster Skip-Rate", "hook_style", "reels_skip_rate", True),
                                    ("Hook-Stil mit meisten Views", "hook_style", "views", False),
                                    ("Länge mit bester Watch-Ratio", _length, "watch_ratio", False),
                                    ("Einstieg mit niedrigster Skip-Rate", _opener, "reels_skip_rate", True),
                                    ("Uhrzeit mit meisten Views", _slot, "views", False),
                                    ("Nische mit meisten Views", "niche", "views", False)):
        b = best(key, metric, low)
        L.append(f"- {label}: {b[0]} ({b[1]:.2f})" if b else f"- {label}: n/a (unter 2 Reels je Gruppe – nur Hypothese)")
    if niche:
        own = [r for r in base if r.get("niche") == niche]
        L.append(f"- Nische {niche}: {len(own)} Reels, Ø Views {_avg([r.get('views') for r in own])}, "
                 f"Ø Skip {_avg([r.get('reels_skip_rate') for r in own])} %, Ø WR {_avg([r.get('watch_ratio') for r in own])}")

    # 5. fatigue: do not repeat
    last = recent(load_state(), CONFIG.get("freshness_window", 8))
    imgs = sorted({i for p in last for i in p.get("images", [])})
    L += ["", "## Nicht wiederholen (letzte 8 Posts)", "",
          "- Bilder: " + (", ".join(imgs) or "–"),
          "- Hooks: " + " | ".join((p.get("hook") or "").replace("\n", " / ") for p in last[-4:]),
          "- Hook-Stile zuletzt: " + ", ".join(str(p.get("hook_style")) for p in last[-3:])]

    # 6. originality: share of reels in the last 30 days that lean on stock footage
    cut = (now.date() - timedelta(days=30)).isoformat()
    stock = total = 0
    for pid, p in load_state()["published"].items():
        if p.get("type") != "reel" or p.get("deleted") or (p.get("local_date") or "") < cut or not (POSTS / f"{pid}.json").exists():
            continue
        slides = load_spec(pid).get("slides", [])
        clips = [x for x in slides if x.get("kind") == "clip" and "footage/stock" in str(x.get("src", ""))]
        total += 1
        stock += bool(clips) and (slides[1:2] == clips[:1] or slides[:1] == clips[:1] or len(clips) * 2 >= len(slides))
    L += ["", "## Originalität (Empfehlungsfähigkeit)", "",
          f"Reels der letzten 30 Tage mit Stock-Clip als Einstieg oder Hauptteil: {stock} von {total}"
          + (" – **über der Hälfte: Risiko, nicht mehr empfohlen zu werden. Eigenes Material vorziehen.**"
             if total and stock * 2 > total else "")]
    try:
        heads = [l for l in (DATA / "recherche.md").read_text(encoding="utf-8").splitlines() if l.startswith("## ")][:2]
        L.append("Recherche (data/recherche.md): " + " · ".join(h[3:] for h in heads))
    except FileNotFoundError:
        L.append("Recherche: data/recherche.md fehlt – anlegen.")

    try:
        bm = (DATA / "benchmark.md").read_text(encoding="utf-8").splitlines()
        top = [l for l in bm if l.startswith("- ") and "->" not in l][:5] or [
            "- keine Fremddaten abrufbar (Facebook-Login-Token fehlt) – Vorbilder per Websuche auswerten"]
        L += ["", "## Andere Accounts (data/benchmark.md, " + bm[0][12:] + ")", ""] + top
    except (FileNotFoundError, IndexError):
        L += ["", "## Andere Accounts", "", "data/benchmark.md fehlt – `autopilot.py benchmark` laufen lassen."]

    L += ["", "## Gelernte Regeln (data/regeln.json – bestätigte nutzen, verworfene meiden)", ""] + rules_summary()

    # 7. last hypotheses
    try:
        heads = [l for l in (HOME / "learnings.md").read_text(encoding="utf-8").splitlines() if l.startswith("## ")][:3]
        L += ["", "## Letzte Einträge in learnings.md", ""] + [f"- {h[3:]}" for h in heads]
    except FileNotFoundError:
        pass
    L += ["", f"Neue Specs tragen `\"briefing\": \"{bid}\"`, `\"hypothesis\"` (Begründung aus den Daten), "
          "`\"variable\"` (die eine getestete Größe: hook_style, opener, length, trial, music, topic, time …) und "
          "`\"variant\"` (der getestete Wert). Nur so lernt das System, was wirkt."]
    (DATA / "briefing.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    try:
        known = json.loads(BRIEFINGS.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        known = {}
    known[bid] = now.isoformat(timespec="minutes")
    known = dict(sorted(known.items())[-30:])
    BRIEFINGS.write_text(json.dumps(known, indent=1), encoding="utf-8")
    print("\n".join(L))


# --------------------------------------------------------------------------
# Experiments -> rules: the account's long-term memory
# --------------------------------------------------------------------------

RULES = DATA / "regeln.json"


def evaluate_experiments(rows: list[dict]) -> None:
    """Judge every reel that tested a variable against the 10 reels before it, then aggregate.

    A spec declares "variable" (hook_style, opener, length, trial, music, topic, time …) and
    "variant" (the value tried). After 48 h: win = views >= 1.3x baseline median and skip rate
    not more than 5 points worse; loss = views <= 0.77x baseline. Per variable/variant:
    n >= 3 with 2+ wins and more wins than losses -> "bestätigt" (rule), 2+ losses -> "verworfen".
    """
    reels = sorted((r for r in rows if r.get("type") == "reel" and r.get("views") is not None),
                   key=lambda r: (r.get("local_date") or "", r.get("local_time") or ""))
    now = datetime.now(timezone.utc)
    med = lambda xs: sorted(xs)[len(xs) // 2] if xs else None
    results = []
    for i, r in enumerate(reels):
        if not r.get("variable") or not r.get("timestamp"):
            continue
        age_h = (now - datetime.strptime(r["timestamp"], "%Y-%m-%dT%H:%M:%S%z")).total_seconds() / 3600
        prev = reels[max(0, i - 10):i]
        base_v = med([float(x.get("views") or 0) for x in prev])
        base_s = med([float(x["reels_skip_rate"]) for x in prev if x.get("reels_skip_rate") is not None])
        if age_h < 48 or not base_v:
            verdict = "läuft"
        else:
            ratio = float(r.get("views") or 0) / base_v
            skip_worse = (r.get("reels_skip_rate") is not None and base_s is not None
                          and float(r["reels_skip_rate"]) > base_s + 5)
            verdict = "gewonnen" if ratio >= 1.3 and not skip_worse else "verloren" if ratio <= 0.77 else "neutral"
        results.append({"post_id": r["post_id"], "variable": r["variable"], "variant": r.get("variant"),
                        "hypothesis": r.get("hypothesis"), "views": r.get("views"), "baseline_views": base_v,
                        "skip": r.get("reels_skip_rate"), "baseline_skip": base_s, "verdict": verdict})
    agg: dict = {}
    for x in results:
        if x["verdict"] != "läuft":
            agg.setdefault(f"{x['variable']}={x['variant']}", []).append(x["verdict"])
    rules = {}
    for key, vs in agg.items():
        w, l = vs.count("gewonnen"), vs.count("verloren")
        status = ("bestätigt" if len(vs) >= 3 and w >= 2 and w > l else
                  "verworfen" if len(vs) >= 3 and l >= 2 else "offen")
        rules[key] = {"n": len(vs), "gewonnen": w, "verloren": l, "status": status}
    RULES.write_text(json.dumps({"updated": now.isoformat(timespec="minutes"), "rules": rules,
                                 "experiments": results}, ensure_ascii=False, indent=1), encoding="utf-8")


def rules_summary() -> list[str]:
    try:
        data = json.loads(RULES.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return ["Noch keine ausgewerteten Experimente – jede Spec mit \"variable\" und \"variant\" anlegen."]
    out = []
    for status in ("bestätigt", "verworfen", "offen"):
        keys = [f"{k} ({v['gewonnen']}:{v['verloren']} von {v['n']})" for k, v in data["rules"].items() if v["status"] == status]
        out.append(f"- {status}: " + (", ".join(keys) or "–"))
    running = [x["post_id"] for x in data["experiments"] if x["verdict"] == "läuft"]
    out.append(f"- läuft noch (< 48 h): {', '.join(running) or '–'}")
    return out


# --------------------------------------------------------------------------
# Benchmark: what works for other accounts (public business_discovery data)
# --------------------------------------------------------------------------

def cmd_benchmark() -> None:
    """Fetch public metrics of the accounts in data/benchmark_accounts.json and rank their posts.

    Uses business_discovery (professional accounts only, likes/comments, no views).
    Writes data/benchmark.json + data/benchmark.md; unreachable accounts are listed, not fatal.
    """
    cfg = json.loads((DATA / "benchmark_accounts.json").read_text(encoding="utf-8"))
    # business_discovery exists only in the API with Facebook Login (graph.facebook.com):
    # optional secrets IG_FB_TOKEN / IG_FB_USER_ID; without them the Instagram-Login token is tried (fails).
    fb_token, fb_uid = os.getenv("IG_FB_TOKEN"), os.getenv("IG_FB_USER_ID")

    def discover(h: str, flds: str) -> dict:
        q = f"business_discovery.username({h}){{{flds}}}"
        if fb_token and fb_uid:
            r = requests.get(f"https://graph.facebook.com/v25.0/{fb_uid}",
                             params={"fields": q, "access_token": fb_token}, timeout=60)
            body = r.json()
            if r.status_code >= 400 or "error" in body:
                raise RuntimeError(f"{r.status_code}: {json.dumps(body)[:300]}")
            return body["business_discovery"]
        return api("GET", user_id(), fields=q)["business_discovery"]
    fields = ("username,name,followers_count,media_count,biography,media.limit(25)"
              "{caption,like_count,comments_count,media_type,media_product_type,timestamp,permalink}")
    accounts, failed = [], []
    for group, handles in cfg.items():
        if group.startswith("_"):
            continue
        for h in handles:
            try:
                res = discover(h, fields)
                res["group"] = group
                accounts.append(res)
            except (RuntimeError, KeyError) as e:
                failed.append((h, str(e)[:160]))
    posts = []
    for a in accounts:
        fol = max(int(a.get("followers_count") or 0), 1)
        for m in (a.get("media") or {}).get("data", []):
            eng = int(m.get("like_count") or 0) + 2 * int(m.get("comments_count") or 0)
            posts.append({"account": a["username"], "group": a["group"], "followers": fol,
                          "type": m.get("media_product_type") or m.get("media_type"),
                          "eng": eng, "eng_rate": round(100 * eng / fol, 2), "timestamp": m.get("timestamp"),
                          "hook": ((m.get("caption") or "").strip().splitlines() or [""])[0][:120],
                          "permalink": m.get("permalink")})
    now = datetime.now(TZ).isoformat(timespec="minutes")
    (DATA / "benchmark.json").write_text(json.dumps({"generated_at": now, "accounts": accounts, "failed": failed},
                                                    ensure_ascii=False, indent=1), encoding="utf-8")
    L = [f"# Benchmark {now}", "", "Interaktion = Likes + 2 × Kommentare, Rate = je 100 Follower. Views gibt die API für fremde Accounts nicht her.", ""]
    if accounts:
        L += ["## Accounts", "", "| Account | Gruppe | Follower | Ø Rate Reels | Ø Rate Bilder/Karussell | Reels-Anteil |", "|---|---|---|---|---|---|"]
        for a in sorted(accounts, key=lambda a: -int(a.get("followers_count") or 0)):
            ps = [p for p in posts if p["account"] == a["username"]]
            reels = [p["eng_rate"] for p in ps if p["type"] == "REELS"]
            other = [p["eng_rate"] for p in ps if p["type"] != "REELS"]
            L.append(f"| @{a['username']} | {a['group']} | {a.get('followers_count')} | {_avg(reels)} | {_avg(other)} | "
                     f"{len(reels)}/{len(ps)} |")
        L += ["", "## Top-Beiträge nach Rate (erste Caption-Zeile = Hook)", ""]
        for p in sorted(posts, key=lambda p: -p["eng_rate"])[:15]:
            L.append(f"- {p['eng_rate']} · {p['type']} · @{p['account']} · „{p['hook']}“ {p['permalink']}")
        L += ["", "## Schwächste Beiträge", ""]
        for p in sorted(posts, key=lambda p: p["eng_rate"])[:5]:
            L.append(f"- {p['eng_rate']} · {p['type']} · @{p['account']} · „{p['hook']}“")
    if failed:
        L += ["", "## Nicht abrufbar", ""] + [f"- @{h}: {e}" for h, e in failed]
        if not accounts:
            L += ["", "_Fremde Kennzahlen gibt es nur über die Instagram-API mit Facebook-Login (Secrets IG_FB_TOKEN, "
                  "IG_FB_USER_ID; Instagram-Konto mit einer Facebook-Seite verknüpft). Bis dahin Vergleich per Websuche "
                  "(öffentliche Artikel, Fallstudien, Profile) und im Bericht so kennzeichnen._"]
    (DATA / "benchmark.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L))


# --------------------------------------------------------------------------
# Token refresh
# --------------------------------------------------------------------------

def store_secret(name: str, value: str) -> bool:
    pat, repo = os.getenv("GH_SECRETS_PAT"), os.getenv("GITHUB_REPOSITORY")
    if not pat or not repo:
        return False
    from nacl import encoding, public
    h = {"Authorization": f"Bearer {pat}", "Accept": "application/vnd.github+json"}
    key = requests.get(f"https://api.github.com/repos/{repo}/actions/secrets/public-key", headers=h, timeout=30).json()
    box = public.SealedBox(public.PublicKey(key["key"].encode(), encoding.Base64Encoder()))
    enc = base64.b64encode(box.encrypt(value.encode())).decode()
    r = requests.put(f"https://api.github.com/repos/{repo}/actions/secrets/{name}", headers=h,
                     json={"encrypted_value": enc, "key_id": key["key_id"]}, timeout=30)
    return r.status_code in (201, 204)


def cmd_refresh() -> None:
    r = requests.get("https://graph.instagram.com/refresh_access_token",
                     params={"grant_type": "ig_refresh_token", "access_token": token()}, timeout=30)
    body = r.json()
    if "access_token" not in body:
        sys.exit(f"Token-Erneuerung fehlgeschlagen: {body}")
    days = int(body.get("expires_in", 0)) // 86400
    state = load_state()
    state["token_refreshed_at"] = datetime.now(timezone.utc).isoformat()
    state["token_expires_in_days"] = days
    if body["access_token"] != token():
        stored = store_secret("IG_AI_TOKEN", body["access_token"])
        state["token_secret_updated"] = stored
        print("Neues Token gespeichert." if stored else
              "WARNUNG: neues Token erhalten, aber GH_SECRETS_PAT fehlt – Secret nicht aktualisiert.")
    save_state(state)
    print(f"Token gültig für weitere {days} Tage.")


if __name__ == "__main__":
    cmd, *args = sys.argv[1:] or ["due"]
    {"due": cmd_due, "render": cmd_render, "publish": cmd_publish, "insights": cmd_insights,
     "refresh": cmd_refresh, "prune": cmd_prune, "engage": cmd_engage, "plan": cmd_plan,
     "briefing": cmd_briefing, "benchmark": cmd_benchmark}[cmd](*args)
