"""Instagram autopilot for @ai.made.in.bielefeld.

Commands (run from the repo root):
  python instagram_autopilot/autopilot.py due          -> prints the post id due now (or nothing)
  python instagram_autopilot/autopilot.py render ID    -> renders ID into docs/ig-media/ID/
  python instagram_autopilot/autopilot.py publish ID   -> posts ID via the Instagram API
  python instagram_autopilot/autopilot.py insights     -> stores metrics + rebuilds data/report.md
  python instagram_autopilot/autopilot.py refresh      -> refreshes the long-lived token
  python instagram_autopilot/autopilot.py prune        -> deletes media of posts published >3 days ago

Uses the "Instagram API with Instagram Login" (graph.instagram.com), so no
Facebook page is needed. Secrets: IG_AI_TOKEN, IG_AI_USER_ID (optional
GH_SECRETS_PAT to store a refreshed token back into the repo secrets).
"""
from __future__ import annotations

import base64
import csv
import json
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
CONFIG = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
POSTS = HERE / "posts"
DATA = HERE / "data"
STATE_FILE = DATA / "state.json"
MEDIA_DIR = REPO / "docs" / "ig-media"
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
        if who.get("username", "").lower() != CONFIG["account"].lower():
            sys.exit(f"Token gehört zu @{who.get('username')}, erwartet @{CONFIG['account']} – Abbruch.")
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
    for attempt in range(4):
        r = requests.request(method, url, params=params if method == "GET" else None,
                             data=params if method != "GET" else None, timeout=60)
        if r.status_code < 500:
            break
        time.sleep(5 * (attempt + 1))
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
    if r.status_code >= 400 or "error" in body:
        raise RuntimeError(f"{method} {path} -> {r.status_code}: {json.dumps(body)[:500]}")
    return body


# --------------------------------------------------------------------------
# Scheduling
# --------------------------------------------------------------------------

def next_queued(state: dict) -> str | None:
    for f in sorted(POSTS.glob("*.json")):
        spec = json.loads(f.read_text(encoding="utf-8"))
        if spec.get("status", "queued") == "queued" and spec["id"] not in state["published"]:
            return spec["id"]
    return None


def cmd_due() -> None:
    """Print the id of the post to publish now, if a slot is open."""
    now = datetime.now(TZ)
    state = load_state()
    today = now.date().isoformat()
    posted_today = sum(1 for p in state["published"].values() if p.get("local_date") == today)
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
    if in_slot or os.getenv("FORCE") == "1":
        pid = os.getenv("POST_ID") or next_queued(state)
        if pid:
            print(pid)


# --------------------------------------------------------------------------
# Render + publish
# --------------------------------------------------------------------------

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
    for _ in range(minutes * 6):
        st = api("GET", cid, fields="status_code,status")
        code = st.get("status_code")
        if code == "FINISHED":
            return
        if code in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Container {cid}: {st}")
        time.sleep(10)
    raise RuntimeError(f"Container {cid} nicht fertig geworden")


def caption_for(spec: dict) -> str:
    parts = [spec["caption"].strip(), "", CONFIG["caption_footer"]]
    if spec.get("hashtags"):
        parts += ["", " ".join(spec["hashtags"])]
    return "\n".join(parts)[:2150]


def cmd_publish(post_id: str) -> None:
    spec = load_spec(post_id)
    meta = json.loads((MEDIA_DIR / post_id / "meta.json").read_text(encoding="utf-8"))
    uid = user_id()
    caption = caption_for(spec)
    if spec["type"] == "reel":
        c = api("POST", f"{uid}/media", media_type="REELS", video_url=media_url(post_id, meta["video"]),
                cover_url=media_url(post_id, meta["cover"]), caption=caption, share_to_feed="true")
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
    pub = api("POST", f"{uid}/media_publish", creation_id=cid)
    info = api("GET", pub["id"], fields="permalink,timestamp")
    now = datetime.now(TZ)
    state = load_state()
    state["published"][post_id] = {
        "media_id": pub["id"], "permalink": info.get("permalink"), "timestamp": info.get("timestamp"),
        "local_date": now.date().isoformat(), "local_time": now.strftime("%H:%M"),
        "weekday": now.weekday(), "type": spec["type"], "format": spec.get("format"),
        "hook_style": spec.get("hook_style"), "topic": spec.get("topic"),
        "seconds": meta.get("seconds"),
    }
    save_state(state)
    spec["status"] = "published"
    (POSTS / f"{post_id}.json").write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Veröffentlicht: {post_id} -> {info.get('permalink')}")


def cmd_prune() -> None:
    state = load_state()
    cutoff = (datetime.now(TZ) - timedelta(days=3)).date().isoformat()
    for pid, p in state["published"].items():
        d = MEDIA_DIR / pid
        if d.exists() and p.get("local_date", "9999") < cutoff:
            shutil.rmtree(d)
            print(f"Medien gelöscht: {pid}")


# --------------------------------------------------------------------------
# Insights + report
# --------------------------------------------------------------------------

REEL_METRICS = ["views", "reach", "saved", "shares", "likes", "comments", "total_interactions",
                "ig_reels_avg_watch_time", "ig_reels_video_view_total_time"]
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
        except (RuntimeError, IndexError, KeyError):
            continue
    return out


def score(row: dict) -> float:
    """Weighted engagement per 100 reached accounts (saves/shares weigh most)."""
    reach = max(float(row.get("reach") or 0), 1.0)
    pts = (4 * float(row.get("shares") or 0) + 3 * float(row.get("saved") or 0)
           + 2 * float(row.get("comments") or 0) + float(row.get("likes") or 0)
           + 5 * float(row.get("follows") or 0))
    return round(100 * pts / reach, 2)


def cmd_insights() -> None:
    uid = user_id()
    state = load_state()
    acct = api("GET", uid, fields="username,followers_count,media_count")
    rows = []
    for pid, p in state["published"].items():
        metrics = REEL_METRICS if p["type"] == "reel" else FEED_METRICS
        m = media_insights(p["media_id"], metrics)
        row = {"post_id": pid, **{k: p.get(k) for k in ("type", "format", "hook_style", "topic",
                                                         "local_date", "local_time", "weekday", "seconds")}, **m}
        if p["type"] == "reel" and m.get("ig_reels_avg_watch_time") and p.get("seconds"):
            row["watch_ratio"] = round(float(m["ig_reels_avg_watch_time"]) / 1000 / float(p["seconds"]), 3)
        row["score"] = score(row)
        rows.append(row)
    today = datetime.now(TZ).date().isoformat()
    DATA.mkdir(parents=True, exist_ok=True)
    snap = {"date": today, "account": acct, "posts": rows}
    (DATA / "insights_latest.json").write_text(json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8")
    hist = DATA / "followers.csv"
    new = not hist.exists()
    with hist.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["date", "followers", "media_count"])
        w.writerow([today, acct.get("followers_count"), acct.get("media_count")])
    write_report(snap)
    print(f"{len(rows)} Beiträge ausgewertet, Follower: {acct.get('followers_count')}")


def write_report(snap: dict) -> None:
    rows = sorted(snap["posts"], key=lambda r: r["score"], reverse=True)
    lines = [f"# Instagram-Report {snap['date']}", "",
             f"Follower: **{snap['account'].get('followers_count')}** · Beiträge: {snap['account'].get('media_count')}", "",
             "| Beitrag | Typ | Format | Hook | Reichweite | Views | Saves | Shares | Watch-Ratio | Score |",
             "|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        lines.append(f"| {r['post_id']} | {r['type']} | {r.get('format')} | {r.get('hook_style')} | "
                     f"{r.get('reach', '–')} | {r.get('views', '–')} | {r.get('saved', '–')} | "
                     f"{r.get('shares', '–')} | {r.get('watch_ratio', '–')} | {r['score']} |")
    for key in ("format", "hook_style", "topic", "local_time"):
        agg: dict = {}
        for r in rows:
            agg.setdefault(r.get(key), []).append(r["score"])
        lines += ["", f"## Ø Score nach {key}", ""]
        for k, v in sorted(agg.items(), key=lambda kv: -sum(kv[1]) / len(kv[1])):
            lines.append(f"- {k}: {sum(v) / len(v):.2f} (n={len(v)})")
    (DATA / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


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
     "refresh": cmd_refresh, "prune": cmd_prune}[cmd](*args)
