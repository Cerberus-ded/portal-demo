# -*- coding: utf-8 -*-
# python -I lord31_fetch.py <lord dir>: every model photo from dveri-lord.ru, as two WebP sizes:
#   l/<code>.webp  737x1600 for the enlarged view, s/<code>.webp 368x800 for the grid. The PNG is dropped after.
import io, json, os, sys, time, subprocess, urllib.request
from concurrent.futures import ThreadPoolExecutor
D = sys.argv[1]
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36'
data = json.load(io.open(os.path.join(D, 'lord.json'), encoding='utf-8'))
for k in ('png', 'l', 's'):
    os.makedirs(os.path.join(D, k), exist_ok=True)
jobs = []
for c in data:
    ms = c['models'] or [{'code': c['slug'], 'img': c['main'], 'title': c['name']}]
    for m in ms:
        jobs.append((m['code'], m['img']))

def one(job):
    code, url = job
    out_l, out_s = os.path.join(D, 'l', code + '.webp'), os.path.join(D, 's', code + '.webp')
    if os.path.exists(out_l) and os.path.exists(out_s):
        return code, 'have'
    src = os.path.join(D, 'png', code + os.path.splitext(url)[1].lower())
    for k in range(4):
        try:
            rq = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(rq, timeout=60) as r:
                b = r.read()
            io.open(src, 'wb').write(b)
            break
        except Exception as e:
            if k == 3:
                return code, 'ERR ' + str(e)
            time.sleep(3 + k * 4)
    # door photos are 737x1600 with transparency; the main pictures of a collection are 700x550 JPEG
    for out, h, q in ((out_l, 1600, 82), (out_s, 800, 80)):
        r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-vf',
                            "scale='if(gt(ih,%d),-2,iw)':'if(gt(ih,%d),%d,ih)':flags=lanczos,format=yuva420p" % (h, h, h),
                            '-c:v', 'libwebp', '-quality', str(q), '-compression_level', '6', out], capture_output=True)
        if r.returncode:
            return code, 'FFMPEG ' + r.stderr.decode('utf-8', 'replace')[:200]
    os.remove(src)
    return code, 'ok'

t0 = time.time()
bad = []
with ThreadPoolExecutor(4) as ex:
    for n, (code, st) in enumerate(ex.map(one, jobs), 1):
        if st not in ('ok', 'have'):
            bad.append((code, st))
        if n % 50 == 0:
            print(n, 'of', len(jobs), round(time.time() - t0), 's', flush=True)
print('done', len(jobs), 'failed', len(bad), bad[:10])
