import sys, os, json, time, urllib.parse, urllib.request, urllib.error
sys.path.insert(0,"/Users/claw/Documents/film-kb/tools/imgwork")
from selection import SELECTION
from common import strip, em_val, lic_ok, IMGDIR
from PIL import Image

UA = "FilmKB-AssetBot/1.0 (https://github.com/film-kb; contact: local) python-urllib"
API = "https://commons.wikimedia.org/w/api.php"
THUMBW = 1400

def get(url, tries=6):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    delay = 8
    for a in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 403, 503):
                print(f"    {e.code} backoff {delay}s"); time.sleep(delay); delay = min(delay*2, 120); continue
            raise
        except Exception as ex:
            print(f"    err {ex!r} backoff {delay}s"); time.sleep(delay); delay = min(delay*2, 120)
    raise RuntimeError("give up "+url)

def info_for(title):
    u = API + "?" + urllib.parse.urlencode({"action":"query","titles":title,"prop":"imageinfo",
        "iiprop":"url|extmetadata|size|mime","iiurlwidth":str(THUMBW),"format":"json"})
    d = json.loads(get(u).decode())
    for p in d.get("query",{}).get("pages",{}).values():
        if "imageinfo" not in p: return None
        return p["imageinfo"][0]
    return None

def save_scaled(data, dst):
    import io
    im = Image.open(io.BytesIO(data))
    if getattr(im,"n_frames",1) > 1: im.seek(0)
    if dst.lower().endswith(".png"):
        im = im.convert("RGBA"); fmt="PNG"
    else:
        im = im.convert("RGB"); fmt="JPEG"
    w,h = im.size
    if max(w,h) > 1100:
        r = 1100/max(w,h); im = im.resize((max(1,round(w*r)),max(1,round(h*r))), Image.LANCZOS)
    if fmt=="PNG":
        im.save(dst,"PNG",optimize=True)
        if os.path.getsize(dst) > 350*1024:
            im.convert("P",palette=Image.ADAPTIVE,colors=128).save(dst,"PNG",optimize=True)
    else:
        q=85
        while q>=55:
            im.save(dst,"JPEG",quality=q,optimize=True,progressive=True)
            if os.path.getsize(dst)<=350*1024: break
            q-=7
    return im.size[0], im.size[1], os.path.getsize(dst)

results, errors = [], []
for slug, title, fmt in SELECTION:
    dst = os.path.join(IMGDIR, slug + (".png" if fmt=="png" else ".jpg"))
    if os.path.exists(dst) and os.path.getsize(dst) > 3000:
        print("SKIP", slug); continue
    try:
        ii = info_for(title)
        if not ii: errors.append((slug,"no imageinfo")); print("FAIL",slug,"no imageinfo"); continue
        em = ii.get("extmetadata",{}); lic = em_val(em,"LicenseShortName")
        if not lic_ok(lic): errors.append((slug,"license "+str(lic))); print("FAIL",slug,"lic",lic); continue
        url = ii.get("thumburl") or ii.get("url")
        print(f"  get {slug} {url.split('/')[-1][:60]}")
        data = get(url)
        if len(data) < 2000: raise RuntimeError("too small "+str(len(data)))
        w,h,nb = save_scaled(data, dst)
        results.append({"slug":slug,"file":"web/img/"+os.path.basename(dst),
            "source_title":title,"description_url":"https://commons.wikimedia.org/wiki/"+urllib.parse.quote(title.replace(' ','_')),
            "license":lic,"author":strip(em_val(em,"Artist")),"width":w,"height":h,"bytes":nb,
            "mime":ii.get("mime"),"credit":strip(em_val(em,"Credit")),
            "description":strip(em_val(em,"ImageDescription")),
            "date":strip(em_val(em,"DateTimeOriginal"))})
        print(f"OK  {slug:22s} {w}x{h} {nb//1024}KB  {lic}")
    except Exception as e:
        errors.append((slug,repr(e))); print("FAIL",slug,repr(e))
        if os.path.exists(dst): os.remove(dst)
    time.sleep(4)
json.dump({"ok":results,"err":errors}, open("fetched3.json","w"), ensure_ascii=False, indent=1)
print(f"\nDONE {len(results)} ok / {len(errors)} failed")
