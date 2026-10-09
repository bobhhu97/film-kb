import sys, os, json, time, urllib.parse, urllib.request, io
sys.path.insert(0,"/Users/claw/Documents/film-kb/tools/imgwork")
from common import strip, em_val, lic_ok, IMGDIR
from PIL import Image
UA="FilmKB-AssetBot/1.0 (https://github.com/film-kb; contact: local) python-urllib"
API="https://commons.wikimedia.org/w/api.php"
def get(url,tries=6):
    req=urllib.request.Request(url,headers={"User-Agent":UA})
    d=8
    for a in range(tries):
        try:
            with urllib.request.urlopen(req,timeout=120) as r: return r.read()
        except Exception as e:
            print("  retry",repr(e)[:50]); time.sleep(d); d=min(d*2,120)
    raise RuntimeError("give up")
def info(title):
    u=API+"?"+urllib.parse.urlencode({"action":"query","titles":title,"prop":"imageinfo",
        "iiprop":"url|extmetadata|size|mime","iiurlwidth":"1400","format":"json"})
    d=json.loads(get(u).decode())
    for p in d.get("query",{}).get("pages",{}).values():
        if "imageinfo" in p: return p["imageinfo"][0]
def main(slug,title):
    ii=info(title); em=ii.get("extmetadata",{})
    lic=strip(em_val(em,"LicenseShortName")); print("lic",lic)
    assert lic_ok(lic), lic
    data=get(ii.get("thumburl") or ii["url"])
    im=Image.open(io.BytesIO(data))
    if getattr(im,"n_frames",1)>1: im.seek(0)
    dst=os.path.join(IMGDIR,slug+".png")
    im=im.convert("RGBA")
    w,h=im.size
    if max(w,h)>1100:
        r=1100/max(w,h); im=im.resize((round(w*r),round(h*r)),Image.LANCZOS)
    im.save(dst,"PNG",optimize=True)
    if os.path.getsize(dst)>350*1024:
        im.convert("P",palette=Image.ADAPTIVE,colors=160).save(dst,"PNG",optimize=True)
    print("OK",dst,im.size,os.path.getsize(dst)//1024,"KB")
    print(json.dumps({"slug":slug,"commons_title":title,"license":lic,"author":strip(em_val(em,"Artist")),
      "commons_url":"https://commons.wikimedia.org/wiki/"+urllib.parse.quote(title.replace(' ','_')),
      "description":strip(em_val(em,"ImageDescription"))[:300]},ensure_ascii=False))
main(sys.argv[1],sys.argv[2])
