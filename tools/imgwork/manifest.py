import sys, os, json, time, urllib.parse, urllib.request, urllib.error
sys.path.insert(0,"/Users/claw/Documents/film-kb/tools/imgwork")
from selection import SELECTION
from common import strip, em_val, IMGDIR
from PIL import Image

UA = "FilmKB-AssetBot/1.0 (https://github.com/film-kb; contact: local) python-urllib"
API = "https://commons.wikimedia.org/w/api.php"

def get(url, tries=6):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    delay = 8
    for a in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=120) as r: return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429,403,503):
                print("backoff",e.code,delay); time.sleep(delay); delay=min(delay*2,120); continue
            raise
        except Exception as ex:
            print("err",repr(ex)); time.sleep(delay); delay=min(delay*2,120)
    raise RuntimeError("give up "+url)

def info_for(title):
    u = API + "?" + urllib.parse.urlencode({"action":"query","titles":title,"prop":"imageinfo",
        "iiprop":"url|extmetadata|size|mime","format":"json"})
    d = json.loads(get(u).decode())
    for p in d.get("query",{}).get("pages",{}).values():
        if "imageinfo" in p: return p["imageinfo"][0]
    return None

out = []
for slug, title, fmt in SELECTION:
    dst = os.path.join(IMGDIR, slug + (".png" if fmt=="png" else ".jpg"))
    if not os.path.exists(dst):
        print("MISSING", slug); continue
    im = Image.open(dst)
    rec = {"slug":slug, "file":"img/"+os.path.basename(dst), "width":im.size[0], "height":im.size[1],
           "bytes":os.path.getsize(dst), "commons_title":title}
    try:
        ii = info_for(title)
        if ii:
            em = ii.get("extmetadata",{})
            rec["commons_url"] = "https://commons.wikimedia.org/wiki/"+urllib.parse.quote(title.replace(' ','_'))
            rec["license"] = strip(em_val(em,"LicenseShortName"))
            rec["license_url"] = strip(em_val(em,"LicenseUrl"))
            rec["author"] = strip(em_val(em,"Artist"))
            rec["credit"] = strip(em_val(em,"Credit"))
            rec["description"] = strip(em_val(em,"ImageDescription"))[:600]
            rec["date"] = strip(em_val(em,"DateTimeOriginal"))
            rec["usage_terms"] = strip(em_val(em,"UsageTerms"))
            rec["attribution_required"] = strip(em_val(em,"AttributionRequired"))
            rec["restrictions"] = strip(em_val(em,"Restrictions"))
        print("OK", slug, rec.get("license"))
    except Exception as e:
        print("METAFAIL", slug, repr(e))
    out.append(rec)
    time.sleep(1.0)
json.dump(out, open("/Users/claw/Documents/film-kb/web/img/MANIFEST.json","w"), ensure_ascii=False, indent=1)
print("wrote", len(out))
