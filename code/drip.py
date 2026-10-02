#!/usr/bin/env python3
"""drip.py — 2h drip for The Signature Video Maker AI (TITLE PROVISIONAL).
+250 video ads per run (JAH-AD-######, video creative). Silent unless failure.
800MB repo-size guard.
"""
import os, sys, subprocess, json

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BASE)
sys.path.insert(0, os.path.join(BASE, "code"))
from gen_ads import gen as gen_ads

GUARD = 800 * 1024 * 1024

def data_size():
    total = 0
    for dp, dn, fn in os.walk(os.path.join(BASE, "data")):
        for f in fn:
            total += os.path.getsize(os.path.join(dp, f))
    return total

def main():
    n_ads = int(sys.argv[1]) if len(sys.argv) > 1 else 250
    if data_size() > GUARD:
        print("STATUS: drip paused — 800MB guard tripped", flush=True)
        sys.exit(2)
    astart, am = gen_ads(n_ads)
    subprocess.run([sys.executable, os.path.join(BASE, "code", "build_site_files.py")], check=False)
    subprocess.run(["git", "add", "-A"], check=False)
    st = json.load(open(os.path.join(BASE, "data", "ads_state.json")))
    msg = f"Video ads drip: +{am} ads ({st['ads_total']} total)"
    r = subprocess.run(["git", "commit", "-qm", msg])
    if r.returncode == 0:
        subprocess.run(["git", "push", "-q", "origin", "main"], check=False)
    print(f"STATUS: +{am} video ads | ads total {st['ads_total']}")

if __name__ == "__main__":
    main()
