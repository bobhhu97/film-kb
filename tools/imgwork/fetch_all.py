import sys, os, json, time, traceback
sys.path.insert(0,"/Users/claw/Documents/film-kb/tools/imgwork")
from selection import SELECTION
from fetch_one import get_info
from common import fetch, strip, em_val, lic_ok, IMGDIR
from scale import scale_file

results, errors = [], []
for slug, title, fmt in SELECTION:
    dst = os.path.join(IMGDIR, slug + (".png" if fmt=="png" else ".jpg"))
    try:
        info = get_info(title)
        if not info:
            errors.append((slug,title,"no imageinfo")); print("FAIL",slug,"no imageinfo"); continue
        em = info["em"]; lic = em_val(em,"LicenseShortName")
        if not lic_ok(lic):
            errors.append((slug,title,"license "+str(lic))); print("FAIL",slug,"lic",lic); continue
        tmp = os.path.join(IMGDIR,"_t_"+slug)
        data = fetch(info["url"]); open(tmp,"wb").write(data)
        try:
            w,h,nb = scale_file(tmp, dst, is_svg=(info["mime"]=="image/svg+xml"))
        finally:
            if os.path.exists(tmp): os.remove(tmp)
        rec = {"slug":slug,"file":"web/img/"+os.path.basename(dst),
               "source_title":info["title"],"description_url":info["page"],
               "license":lic,"author":strip(em_val(em,"Artist")),
               "width":w,"height":h,"bytes":nb,"mime":info["mime"],
               "credit":strip(em_val(em,"Credit")),
               "description":strip(em_val(em,"ImageDescription")),
               "date":strip(em_val(em,"DateTimeOriginal"))}
        results.append(rec)
        print(f"OK  {slug:22s} {w}x{h} {nb//1024}KB  {lic}")
    except Exception as e:
        errors.append((slug,title,repr(e))); print("FAIL",slug,repr(e))
    time.sleep(1.5)

json.dump({"ok":results,"err":errors}, open("fetched.json","w"), ensure_ascii=False, indent=1)
print(f"\nDONE {len(results)} ok / {len(errors)} failed")
