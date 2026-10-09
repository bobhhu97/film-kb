import json, time, re, sys, os, urllib.request, urllib.parse, io

UA = "FilmKB-AssetBot/1.0 (film-kb image collection; python-urllib)"
API = "https://commons.wikimedia.org/w/api.php"
IMGDIR = "/Users/claw/Documents/film-kb/web/img"
MAXDIM = 1100
MAXBYTES = 350*1024

def strip(html):
    if not html: return ""
    t = re.sub(r"<[^>]+>", " ", html)
    for a,b in (("&amp;","&"),("&quot;",'"'),("&#039;","'"),("&nbsp;"," "),("&#160;"," ")):
        t = t.replace(a,b)
    return re.sub(r"\s+"," ",t).strip()

def em_val(em, key):
    v = em.get(key)
    if isinstance(v, dict): return v.get("value","") or ""
    return v or ""

GOOD_LIC = ("public domain","cc0","cc by","cc-by","pd-","no restrictions")
def lic_ok(name):
    if not name: return False
    n = name.lower()
    if any(b in n for b in ("non-commercial","noncommercial","-nc "," nc "," nd ","nd-","noderiv","no derivative","fair use")): return False
    return any(g in n for g in GOOD_LIC)

def fetch(url, referer=None, timeout=120):
    h = {"User-Agent":UA}
    if referer: h["Referer"]=referer
    req = urllib.request.Request(url, headers=h)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429,503): time.sleep(3*(attempt+1)); continue
            raise
        except Exception:
            time.sleep(3*(attempt+1))
    raise RuntimeError("fetch failed: "+url)

def api_get(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            return json.loads(fetch(url).decode())
        except urllib.error.HTTPError as e:
            if e.code in (429,503): time.sleep(4*(attempt+1)); continue
            raise
        except Exception:
            time.sleep(4*(attempt+1))
    return {}
