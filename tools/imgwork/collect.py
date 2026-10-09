import json,os,re,sys,time,urllib.request,urllib.parse
UA="FilmKB-AssetBot/1.0 (film-kb image collection; python-urllib)"
API="https://commons.wikimedia.org/w/api.php"
IMGDIR="/Users/claw/Documents/film-kb/web/img"
MAXDIM=1100

def strip(h):
    if not h: return ""
    t=re.sub(r"<[^>]+>"," ",h)
    for a,b in (("&amp;","&"),("&quot;",'"'),("&#039;","'"),("&nbsp;"," "),("&#160;"," ")): t=t.replace(a,b)
    return re.sub(r"\s+"," ",t).strip()

def fetch(url,timeout=180):
    req=urllib.request.Request(url,headers={"User-Agent":UA})
    for a in range(5):
        try:
            with urllib.request.urlopen(req,timeout=timeout) as r: return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429,503): time.sleep(4*(a+1)); continue
            raise
        except Exception: time.sleep(3*(a+1))
    raise RuntimeError("fail "+url)

def api(params):
    for a in range(5):
        try: return json.loads(fetch(API+"?"+urllib.parse.urlencode(params),60).decode())
        except urllib.error.HTTPError as e:
            if e.code in (429,503): time.sleep(5*(a+1)); continue
            raise
        except Exception: time.sleep(4*(a+1))
    return {}

GOOD=("public domain","cc0","cc by","cc-by","pd-","no restrictions")
def lic_ok(n):
    if not n: return False
    x=n.lower()
    if any(b in x for b in ("non-commercial","noncommercial","-nc"," nd","nd-","noderiv","no derivative","fair use")): return False
    return any(g in x for g in GOOD)

def emv(em,k):
    v=em.get(k)
    if isinstance(v,dict): return v.get("value","") or ""
    return v or ""

if __name__=="__main__":
    targets=json.load(open("targets.json"))
    os.makedirs(IMGDIR,exist_ok=True)
    out={}
    for key,terms in targets.items():
        res=[]
        for t in terms:
            d=api({"action":"query","generator":"search","gsrsearch":t,"gsrnamespace":"6",
                   "gsrlimit":"12","prop":"imageinfo","iiprop":"url|extmetadata|size|mime","format":"json"})
            time.sleep(1.2)
            for p in ((d or {}).get("query",{}).get("pages",{}) or {}).values():
                ii=(p.get("imageinfo") or [{}])[0]; em=ii.get("extmetadata",{}) or {}
                mime=ii.get("mime") or ""; lic=emv(em,"LicenseShortName")
                if mime not in ("image/jpeg","image/png","image/svg+xml","image/webp"): continue
                if not lic_ok(lic): continue
                w,h=ii.get("width") or 0, ii.get("height") or 0
                if mime=="image/svg+xml":
                    if w<200 or h<120: continue
                else:
                    if w<500 or h<350: continue
                    if w*h>90_000_000: continue
                res.append({"title":p.get("title"),"mime":mime,"w":w,"h":h,"bytes":ii.get("size"),
                    "license":lic,"artist":strip(emv(em,"Artist")),"credit":strip(emv(em,"Credit")),
                    "desc":strip(emv(em,"ImageDescription"))[:300],"url":ii.get("url"),
                    "page":ii.get("descriptionurl"),"query":t})
        seen=set(); dd=[]
        for r in res:
            if r["title"] in seen: continue
            seen.add(r["title"]); dd.append(r)
        dd.sort(key=lambda r:-r["bytes"])
        out[key]=dd
        print(f"== {key}: {len(dd)}",file=sys.stderr,flush=True)
    json.dump(out,open("sweep_results.json","w"),ensure_ascii=False,indent=1)
    print("TOTAL",sum(len(v) for v in out.values()))
