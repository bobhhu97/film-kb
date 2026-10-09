import json, time, urllib.request, urllib.parse, sys

UA = "FilmKB-AssetBot/1.0 (contact: local-dev; python-urllib) film-kb-image-collection"
API = "https://commons.wikimedia.org/w/api.php"

def api_search(terms, limit=10):
    params = {
        "action":"query","generator":"search","gsrsearch":terms,
        "gsrnamespace":"6","gsrlimit":str(limit),
        "prop":"imageinfo","iiprop":"url|extmetadata|size|mime",
        "format":"json",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent":UA,"Accept":"application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            print("HTTP", e.code, "attempt", attempt, file=sys.stderr)
            if e.code in (429,503):
                time.sleep(3*(attempt+1)); continue
            raise
        except Exception as e:
            print("ERR", e, "attempt", attempt, file=sys.stderr)
            time.sleep(3*(attempt+1))
    return None

if __name__ == "__main__":
    d = api_search(sys.argv[1] if len(sys.argv)>1 else "film developing reel")
    pages = (d or {}).get("query",{}).get("pages",{})
    for p in pages.values():
        ii = (p.get("imageinfo") or [{}])[0]
        em = ii.get("extmetadata",{})
        print(json.dumps({
            "title": p.get("title"),
            "mime": ii.get("mime"),
            "size": f"{ii.get('width')}x{ii.get('height')}",
            "bytes": ii.get("size"),
            "license": em.get("LicenseShortName",{}).get("value"),
            "artist": em.get("Artist",{}).get("value","")[:90],
            "desc": em.get("ImageDescription",{}).get("value","")[:110],
        }, ensure_ascii=False))
