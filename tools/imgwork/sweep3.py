import json, time, re, sys, urllib.request, urllib.parse

UA = "FilmKB-AssetBot/1.0 (film-kb image collection; python-urllib)"
API = "https://commons.wikimedia.org/w/api.php"

def api_search(terms, limit=12):
    params = {"action":"query","generator":"search","gsrsearch":terms,
        "gsrnamespace":"6","gsrlimit":str(limit),
        "prop":"imageinfo","iiprop":"url|extmetadata|size|mime","format":"json"}
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent":UA,"Accept":"application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code in (429,503):
                time.sleep(4*(attempt+1)); continue
            print("HTTP", e.code, terms, file=sys.stderr); return None
        except Exception as e:
            time.sleep(4*(attempt+1))
    return None

def strip(html):
    if not html: return ""
    t = re.sub(r"<[^>]+>", " ", html)
    t = t.replace("&amp;","&").replace("&quot;",'"').replace("&#039;","'").replace("&nbsp;"," ")
    return re.sub(r"\s+"," ",t).strip()

GOOD_LIC = ("public domain","cc0","cc by","cc-by","pd-","no restrictions")

def lic_ok(name):
    if not name: return False
    n = name.lower()
    if any(b in n for b in ("non-commercial","noncommercial","-nc"," nd","nd-","noderiv","no derivative","fair use")): return False
    return any(g in n for g in GOOD_LIC)

TARGETS = json.load(open("targets3.json"))
out = {}
for key, terms in TARGETS.items():
    res = []
    for t in terms:
        d = api_search(t)
        time.sleep(1.6)
        for p in ((d or {}).get("query",{}).get("pages",{}) or {}).values():
            ii = (p.get("imageinfo") or [{}])[0]
            em = ii.get("extmetadata",{})
            mime = ii.get("mime") or ""
            if mime not in ("image/jpeg","image/png","image/svg+xml","image/tiff","image/webp"): continue
            lic = (em.get("LicenseShortName",{}) or {}).get("value") or ""
            if not lic_ok(lic): continue
            w,h = ii.get("width") or 0, ii.get("height") or 0
            if mime == "image/svg+xml":
                if w < 200 or h < 120: continue
            else:
                if w < 500 or h < 350: continue
                if w*h > 90_000_000: continue
            res.append({"title":p.get("title"),"mime":mime,"w":w,"h":h,"bytes":ii.get("size"),
                "license":lic,"artist":strip(em.get("Artist",{}).get("value","") if isinstance(em.get("Artist",{}),dict) else ""),
                "desc":strip(em.get("ImageDescription",{}).get("value","") if isinstance(em.get("ImageDescription",{}),dict) else ""),
                "url":ii.get("url"),"page":ii.get("descriptionurl"),"query":t})
    # dedupe by title
    seen=set(); dd=[]
    for r in res:
        if r["title"] in seen: continue
        seen.add(r["title"]); dd.append(r)
    out[key]=dd
    print(f"== {key}: {len(dd)}", file=sys.stderr)

json.dump(out, open("sweep_results3.json","w"), ensure_ascii=False, indent=1)
print("done", sum(len(v) for v in out.values()))
