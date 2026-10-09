import sys, os, json, time, urllib.parse, urllib.request, urllib.error
sys.path.insert(0,"/Users/claw/Documents/film-kb/tools/imgwork")
from common import strip, em_val, lic_ok
UA="FilmKB-AssetBot/1.0 (https://github.com/film-kb; contact: local) python-urllib"
API="https://commons.wikimedia.org/w/api.php"
def get(url, tries=5):
    req=urllib.request.Request(url, headers={"User-Agent":UA})
    d=6
    for a in range(tries):
        try:
            with urllib.request.urlopen(req,timeout=60) as r: return r.read()
        except Exception as e:
            print("  retry",repr(e)[:60]); time.sleep(d); d=min(d*2,60)
    return b"{}"
def search(q, limit=12):
    u=API+"?"+urllib.parse.urlencode({"action":"query","generator":"search","gsrsearch":q,
        "gsrnamespace":"6","gsrlimit":str(limit),"prop":"imageinfo","iiprop":"url|extmetadata|size|mime","format":"json"})
    d=json.loads(get(u).decode() or "{}")
    out=[]
    for p in d.get("query",{}).get("pages",{}).values():
        ii=(p.get("imageinfo") or [{}])[0]
        em=ii.get("extmetadata",{})
        out.append({"title":p["title"],"w":ii.get("width"),"h":ii.get("height"),
                    "mime":ii.get("mime"),"lic":strip(em_val(em,"LicenseShortName")),
                    "desc":strip(em_val(em,"ImageDescription"))[:140]})
    return out
QUERIES=sys.argv[1:]
for q in QUERIES:
    print("="*70); print("QUERY:",q)
    for r in search(q):
        if not r["w"]: continue
        ok = lic_ok(r["lic"])
        print(f"  [{'OK ' if ok else 'no '}] {r['title'][5:70]:66s} {r['w']}x{r['h']} {str(r['lic'])[:18]:18s} {r['desc']}")
    time.sleep(3)
