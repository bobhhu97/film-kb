import sys, os, subprocess, io
sys.path.insert(0,"/Users/claw/Documents/film-kb/tools/imgwork")
from common import IMGDIR, MAXDIM, MAXBYTES
from PIL import Image, ImageSequence

def scale_file(src, dst, is_svg=False):
    """Scale src (path) to dst per rules. Returns (w,h,bytes) or raises."""
    if is_svg:
        tmp = dst + ".raw.png"
        ok = False
        try:
            subprocess.run(["rsvg-convert","-w",str(MAXDIM),"-h",str(MAXDIM),
                            "--keep-aspect-ratio","-b","white",src,"-o",tmp],
                           check=True, capture_output=True)
            ok = os.path.exists(tmp) and os.path.getsize(tmp) > 200
        except Exception as e:
            print("rsvg failed:", e, file=sys.stderr)
        if not ok:
            subprocess.run(["magick","-density","200","-background","white",
                            src,"-flatten","-resize",f"{MAXDIM}x{MAXDIM}",tmp], check=True)
        im = Image.open(tmp).convert("RGB")
        os.remove(tmp)
        if max(im.size) > MAXDIM:
            r = MAXDIM/max(im.size); im = im.resize((max(1,round(im.size[0]*r)),max(1,round(im.size[1]*r))), Image.LANCZOS)
        out = dst
        im.save(out, "PNG", optimize=True)
        if os.path.getsize(out) > MAXBYTES:
            p2 = im.convert("P", palette=Image.ADAPTIVE, colors=128)
            p2.save(out, "PNG", optimize=True)
        if os.path.getsize(out) > MAXBYTES:
            im.convert("RGB").save(out, "JPEG", quality=88, optimize=True)
        return im.size[0], im.size[1], os.path.getsize(out)
    im = Image.open(src)
    if getattr(im, "n_frames", 1) > 1:
        im.seek(0)
    im = im.convert("RGB") if dst.lower().endswith((".jpg",".jpeg")) else im.convert("RGBA")
    w,h = im.size
    if max(w,h) > MAXDIM:
        r = MAXDIM/max(w,h)
        im = im.resize((max(1,round(w*r)), max(1,round(h*r))), Image.LANCZOS)
    q = 82
    im = im.convert("RGB")
    while q >= 55:
        im.save(dst, "JPEG", quality=q, optimize=True, progressive=True)
        if os.path.getsize(dst) <= MAXBYTES: break
        q -= 7
    if os.path.getsize(dst) > MAXBYTES:
        w,h = im.size
        r = 1000/max(w,h)
        im = im.resize((max(1,round(w*r)),max(1,round(h*r))), Image.LANCZOS)
        im.save(dst,"JPEG",quality=80,optimize=True,progressive=True)
    return im.size[0], im.size[1], os.path.getsize(dst)
