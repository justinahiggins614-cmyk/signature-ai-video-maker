#!/usr/bin/env python3
"""gen_ads.py — generate JAH-AD-###### product-ad records.
Each ad advertises one of Manon's products (mall/books/comics) with a
deterministic image creative + video creative. Records stored; creatives
regenerate client-side from the stored seed — nothing rendered server-side.
"""
import json, gzip, os, sys, hashlib, random

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "data")
WS = "/home/hatch/workspace"
CHUNK = 250

HEADLINES = ["YOURS TODAY", "BUILT FOR YOU", "THE SIGNATURE CHOICE", "GRAB IT NOW",
             "MADE TO AMAZE", "DON'T MISS IT", "PURE SIGNATURE", "ONE OF A KIND"]
TAGLINES = ["Pure Signature quality.", "From the Signature line.", "Made to amaze.",
            "Yours today, free to explore.", "The Signature standard."]

def load_products():
    """Round-robin across product sources. Returns list of (site, pid, name)."""
    out = []
    # mega-mall: list of {id, n, d, ...}
    try:
        mp = json.load(open(os.path.join(WS, "signature-cyber-mega-mall", "products.json")))
        items = mp if isinstance(mp, list) else mp.get("products", [])
        for p in items:
            pid = p.get("id")
            nm = p.get("n") or p.get("name") or p.get("title")
            if pid and nm:
                out.append(("mall", str(pid), str(nm)))
    except Exception as e:
        print(f"mall load: {e}", file=sys.stderr)
    # books: data/index/books.idx.json.gz — lines are JSON arrays of {id,t,...}
    try:
        bp = os.path.join(WS, "signature-books", "data", "index", "books.idx.json.gz")
        if os.path.exists(bp):
            with gzip.open(bp, "rt") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except Exception:
                        continue
                    books = obj if isinstance(obj, list) else [obj]
                    for b in books:
                        bid = b.get("id"); nm = b.get("t") or b.get("title") or b.get("name")
                        if bid and nm:
                            out.append(("books", str(bid), str(nm)))
    except Exception as e:
        print(f"books load: {e}", file=sys.stderr)
    # comics: data/volumes/*.jsonl.gz with {id,t,...} or data/index
    try:
        for cdir in [os.path.join(WS, "signature-comics", "data", "volumes"),
                     os.path.join(WS, "signature-comics", "data", "index")]:
            if os.path.isdir(cdir):
                for fn in sorted(os.listdir(cdir)):
                    if fn.endswith(".jsonl.gz"):
                        with gzip.open(os.path.join(cdir, fn), "rt") as f:
                            for line in f:
                                line = line.strip()
                                if not line:
                                    continue
                                try:
                                    obj = json.loads(line)
                                except Exception:
                                    continue
                                items = obj if isinstance(obj, list) else [obj]
                                for b in items:
                                    if not isinstance(b, dict):
                                        continue
                                    bid = b.get("id"); nm = b.get("t") or b.get("title") or b.get("name")
                                    if bid and nm:
                                        out.append(("comics", str(bid), str(nm)))
    except Exception as e:
        print(f"comics load: {e}", file=sys.stderr)
    return out

def rng_for(idx):
    h = int(hashlib.sha256(f"ads:{idx}".encode()).hexdigest()[:16], 16)
    return random.Random(h)

def make_ad(idx, prod):
    r = rng_for(idx)
    site, pid, name = prod
    return {
        "id": f"JAH-AD-{idx:06d}",
        "product": {"site": site, "pid": pid, "name": name},
        "headline": r.choice(HEADLINES),
        "tagline": r.choice(TAGLINES),
        "seed": int(hashlib.sha256(f"ad:{idx}:{pid}".encode()).hexdigest()[:8], 16),
        "video_caption": f"{name} — {r.choice(TAGLINES)}",
        "video_seconds": r.choice([3, 6, 6, 10]),
    }

def state():
    p = os.path.join(DATA, "ads_state.json")
    if os.path.exists(p):
        return json.load(open(p))
    return {"next_index": 1, "ads_total": 0, "prod_cursor": 0}

def save_state(s):
    json.dump(s, open(os.path.join(DATA, "ads_state.json"), "w"), indent=1)

def chunk_path(n):
    d = os.path.join(DATA, "ads")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, f"c{n:04d}.jsonl.gz")

def gen(n):
    prods = load_products()
    if not prods:
        print("no products found; ads skipped")
        return 0, 0
    s = state()
    start = s["next_index"]
    cur = s.get("prod_cursor", 0) % len(prods)
    made = 0
    buf = []
    for i in range(n):
        idx = start + i
        buf.append(make_ad(idx, prods[(cur + i) % len(prods)]))
        made += 1
        if len(buf) >= CHUNK:
            cn = (idx - 1) // CHUNK + 1
            p = chunk_path(cn)
            with gzip.open(p, "at" if os.path.exists(p) else "wt") as f:
                for a in buf:
                    f.write(json.dumps(a) + "\n")
            buf = []
    if buf:
        cn = (start + n - 1 - 1) // CHUNK + 1
        p = chunk_path(cn)
        with gzip.open(p, "at" if os.path.exists(p) else "wt") as f:
            for a in buf:
                f.write(json.dumps(a) + "\n")
    s["next_index"] = start + n
    s["ads_total"] = s.get("ads_total", 0) + n
    s["prod_cursor"] = (cur + n) % len(prods)
    save_state(s)
    rebuild_index()
    return start, made

def rebuild_index():
    idx_dir = os.path.join(DATA, "index")
    os.makedirs(idx_dir, exist_ok=True)
    rows = []
    d = os.path.join(DATA, "ads")
    if os.path.isdir(d):
        for fn in sorted(os.listdir(d)):
            if not fn.endswith(".jsonl.gz"):
                continue
            with gzip.open(os.path.join(d, fn), "rt") as f:
                for line in f:
                    a = json.loads(line)
                    rows.append([a["id"], a["product"]["name"], a["product"]["site"], fn])
    with gzip.open(os.path.join(idx_dir, "ads.idx.json.gz"), "wt") as f:
        for r_ in rows:
            f.write(json.dumps(r_) + "\n")
    return len(rows)

if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 250
    start, made = gen(n)
    print(f"+{made} ads (JAH-AD-{start:06d}..)")
