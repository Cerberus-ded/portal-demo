# -*- coding: utf-8 -*-
# python -I door_fetch.py <factory dir> <collections json> [--redo code-prefix,...] [--crop auto|none] [--cache <dir>] [--from <dir>]
#   --cache: keep the downloaded originals there (outside OneDrive) and reuse them on the next run
#   --from: the dir of pictures cut out of a PDF catalogue (tools/mira_build.py): a model's img that is not a link
#           is a file name there
# Every model photo of a factory as two WebP sizes: l/<code>.webp 1600 tall for the enlarged view, s/<code>.webp 800 tall
# for the grid. Empty margins around the door are cut first, so every door fills its frame the same way: by transparency
# when the photo has it, otherwise by the white background. The downloaded original is dropped after.
import io, json, os, re, subprocess, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

D, SRC = sys.argv[1], sys.argv[2]
REDO = []
CACHE = sys.argv[sys.argv.index('--cache') + 1] if '--cache' in sys.argv else None
if CACHE:
    os.makedirs(CACHE, exist_ok=True)
FROM = sys.argv[sys.argv.index('--from') + 1] if '--from' in sys.argv else None
if '--redo' in sys.argv:
    REDO = [x for x in sys.argv[sys.argv.index('--redo') + 1].split(',') if x]
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36'
data = json.load(io.open(SRC, encoding='utf-8'))
for k in ('png', 'l', 's'):
    os.makedirs(os.path.join(D, k), exist_ok=True)
jobs = []
for c in data:
    ms = c['models'] or ([{'code': c['slug'], 'img': c['main']}] if c.get('main') else [])
    for m in ms:
        jobs.append((m['code'], os.path.join(FROM, m['img']) if FROM and not re.match(r'https?://', m['img']) else m['img']))


def run(args):
    return subprocess.run(args, capture_output=True)


# --crop none: keep the photo as it is (the factory's photo is already the door with its casing, edge to edge)
CROP = sys.argv[sys.argv.index('--crop') + 1] if '--crop' in sys.argv else 'auto'


def box(path):
    # the door's bounding box: (w, h, x, y) inside the full (W, H), or None when the door already fills the frame.
    # By transparency when the photo has it. Otherwise by a white background, and only on an axis where there is
    # a margin on both sides: a white casing on one edge of a white door looks like background and must stay.
    pr = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'csv=p=0', path])
    W, H, fmt = pr.stdout.decode().strip().split(',')[:3]
    W, H = int(W), int(H)
    if CROP == 'none':
        return W, H, None
    alpha = fmt.startswith(('rgba', 'bgra', 'argb', 'abgr', 'ya', 'yuva', 'pal8', 'gbrap'))
    if alpha:
        r = run(['ffmpeg', '-hide_banner', '-i', path, '-vf', 'alphaextract,format=gray,cropdetect=limit=0.1:round=2:reset=0:skip=0', '-f', 'null', '-'])
        m = re.findall(r'crop=(\d+):(\d+):(\d+):(\d+)', r.stderr.decode('utf-8', 'replace'))
        if m:
            w, h, x, y = map(int, m[-1])
            if w > 0 and h > 0 and not (w >= W * 0.97 and h >= H * 0.97):
                return W, H, (w, h, x, y)
    # opaque: a near-white background (lighter than 250 of 255)
    r = run(['ffmpeg', '-hide_banner', '-i', path, '-vf', 'format=gray,negate,cropdetect=limit=0.02:round=2:reset=0:skip=0', '-f', 'null', '-'])
    m = re.findall(r'crop=(\d+):(\d+):(\d+):(\d+)', r.stderr.decode('utf-8', 'replace'))
    if not m:
        return W, H, None
    w, h, x, y = map(int, m[-1])
    if w <= 0 or h <= 0:
        return W, H, None
    left, right, top, bottom = x, W - x - w, y, H - y - h
    if not (left >= W * 0.015 and right >= W * 0.015):
        x, w = 0, W
    if not (top >= H * 0.015 and bottom >= H * 0.015):
        y, h = 0, H
    if w >= W * 0.97 and h >= H * 0.97:
        return W, H, None
    return W, H, (w, h, x, y)


def one(job):
    code, url = job
    out_l, out_s = os.path.join(D, 'l', code + '.webp'), os.path.join(D, 's', code + '.webp')
    redo = any(code.startswith(p) for p in REDO)
    if os.path.exists(out_l) and os.path.exists(out_s) and not redo:
        return code, 'have'
    src = os.path.join(CACHE or os.path.join(D, 'png'), code + (os.path.splitext(url.split('?')[0])[1].lower() or '.img'))
    for k in range(4):
        if CACHE and os.path.exists(src) and os.path.getsize(src) > 0:
            break
        if os.path.isfile(url):
            # a picture already on disk (cut out of a PDF catalogue): used as it is, never deleted
            src = url
            break
        try:
            rq = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(rq, timeout=90) as r:
                b = r.read()
            io.open(src, 'wb').write(b)
            break
        except Exception as e:
            if k == 3:
                return code, 'ERR ' + str(e)
            time.sleep(3 + k * 4)
    W, H, bb = box(src)
    crop = 'crop=%d:%d:%d:%d,' % bb if bb else ''
    for out, h, q in ((out_l, 1600, 82), (out_s, 800, 80)):
        r = run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-vf',
                 crop + "scale='if(gt(ih,%d),-2,iw)':'if(gt(ih,%d),%d,ih)':flags=lanczos,format=yuva420p" % (h, h, h),
                 '-c:v', 'libwebp', '-quality', str(q), '-compression_level', '6', out])
        if r.returncode:
            return code, 'FFMPEG ' + r.stderr.decode('utf-8', 'replace')[:200]
    if not CACHE and not os.path.isfile(url):
        os.remove(src)
    return code, 'cut %dx%d of %dx%d' % (bb[0], bb[1], W, H) if bb else 'ok'


t0 = time.time()
bad, cut, cuts = [], 0, []
with ThreadPoolExecutor(4) as ex:
    for n, (code, st) in enumerate(ex.map(one, jobs), 1):
        if st.startswith('cut'):
            cut += 1
            cuts.append(code + ' ' + st)
        elif st not in ('ok', 'have'):
            bad.append((code, st))
        if n % 50 == 0:
            print(n, 'of', len(jobs), round(time.time() - t0), 's', flush=True)
print('done', len(jobs), 'margins cut', cut, 'failed', len(bad), bad[:10])
if '--list' in sys.argv:
    print(chr(10).join(cuts))
