import os, sys, time, json, urllib.request, urllib.error
sys.path.insert(0,"/Users/claw/Documents/film-kb/tools/imgwork")
from common import UA
from selection import SELECTION
from fetch_one import get_info

CACHE = "/Users/claw/Documents/film-kb/tools/imgwork/orig_cache"

def dl(url, dest, tries=6):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent":UA})
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
            if len(data) < 200: raise RuntimeError("too small")
            open(dest,"wb").write(data)
            return len(data)
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
            wait = 25*(i+1) if e.code==429 else 6*(i+1)
            print(f"    retry {i+1}/{tries} {e.code} -> sleep {wait}s", flush=True)
            time.sleep(wait)
        except Exception as e:
            last = repr(e); print(f"    retry {i+1}/{tries} {e!r} -> sleep {8*(i+1)}s", flush=True)
            time.sleep(8*(i+1))
    raise RuntimeError(f"download failed after {tries}: {last}")

meta = {}
for slug, title, fmt in SELECTION:
    ext = os.path.splitext(title)[1].lower()
    dest = os.path.join(CACHE, slug+ext)
    if os.path.exists(dest) and os.path.getsize(dest) > 200:
        print(f"SKIP {slug} (cached)"); continue
    try:
        info = get_info(title)
        if not info: print(f"FAIL {slug} no info"); continue
        n = dl(info["url"], dest)
        meta[slug] = {"title":info["title"],"page":info["page"],"mime":info["mime"],
                      "url":info["url"],"ext":ext,"bytes":n}
        print(f"GOT  {slug:22s} {n//1024}KB", flush=True)
    except Exception as e:
        print(f"FAIL {slug} {e!r}")
    time.sleep(9)   # be gentle with the CDN

json.dump(meta, open("orig_meta.json","w"), ensure_ascii=False, indent=1)
print("cached:", len(os.listdir(CACHE)))
