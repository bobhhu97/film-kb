"""Fetch one Commons file by exact title: get imageinfo + extmetadata, download original,
scale, write scaled file + a metadata sidecar json. Usage:
  python3 fetch_one.py <slug> <File_Title> [jpg|png]
Prints one JSON line on success; on failure prints ERR and exits 1.
"""
import sys, os, json, time
sys.path.insert(0,"/Users/claw/Documents/film-kb/tools/imgwork")
from common import api_get, fetch, strip, em_val, lic_ok, IMGDIR
from scale import scale_file

def get_info(title):
    d = api_get({"action":"query","titles":title,"prop":"imageinfo",
                 "iiprop":"url|extmetadata|size|mime","format":"json"})
    pages = (d.get("query",{}) or {}).get("pages",{}) or {}
    for p in pages.values():
        if "imageinfo" not in p: return None
        ii = p["imageinfo"][0]
        return {"title":p.get("title"),"mime":ii.get("mime"),"w":ii.get("width"),"h":ii.get("height"),
                "bytes":ii.get("size"),"url":ii.get("url"),
                "page":ii.get("descriptionurl"),
                "em":ii.get("extmetadata",{})}
    return None

def main():
    slug, title = sys.argv[1], sys.argv[2]
    fmt = sys.argv[3] if len(sys.argv)>3 else "jpg"
    info = get_info(title)
    if not info: print("ERR no imageinfo"); return 1
    em = info["em"]
    lic = em_val(em,"LicenseShortName")
    if not lic_ok(lic):
        print(f"ERR license rejected: {lic}"); return 1
    ext = ".png" if fmt=="png" else ".jpg"
    dst = os.path.join(IMGDIR, slug+ext)
    tmp = os.path.join(IMGDIR, "_tmp_"+slug+os.path.splitext(info["url"])[1][:6])
    try:
        data = fetch(info["url"])
        open(tmp,"wb").write(data)
        is_svg = info["mime"]=="image/svg+xml"
        w,h,nb = scale_file(tmp, dst, is_svg=is_svg)
    finally:
        if os.path.exists(tmp): os.remove(tmp)
    meta = {"slug":slug,"file":"web/img/"+slug+ext,"source_title":info["title"],
            "description_url":info["page"],"license":lic,
            "author":strip(em_val(em,"Artist")),"width":w,"height":h,"bytes":nb,
            "orig_w":info["w"],"orig_h":info["h"],"mime":info["mime"],
            "credit":strip(em_val(em,"Credit")),
            "description":strip(em_val(em,"ImageDescription")),
            "date":strip(em_val(em,"DateTimeOriginal"))}
    print(json.dumps(meta, ensure_ascii=False))
    return 0

if __name__=="__main__":
    sys.exit(main())
