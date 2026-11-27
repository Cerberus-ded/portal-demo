# -*- coding: utf-8 -*-
# python -I fix_edges.py <project dir> <backup dir> [--write] factory...
# Cuts foreign strips off the edges of the door photos (web/<factory>/l and s, the same cut on both):
#   bottom / top  a flat band lighter than the door just inside it (the white floor or background under the leaf,
#                 a white line over the casing), or a see-through band
#   all sides     rows or columns that are see-through from end to end
# Photos wider than 3:4 (a room, a wall with the door) are left as they are.
# A band wider than 4 % of the photo is the door's own casing or cornice and stays. One more pixel goes with a cut band,
# the soft line between the band and the door. Without --write it only prints what it would cut.
# The photos it changes are first copied to <backup dir>/<factory>/l|s/.
import io, json, os, shutil, subprocess, sys
import numpy as np
from concurrent.futures import ThreadPoolExecutor

ROOT, BACK = sys.argv[1], sys.argv[2]
WRITE = '--write' in sys.argv
FABS = [a for a in sys.argv[3:] if not a.startswith('--')]
sys.stdout.reconfigure(encoding='utf-8')


def load(p):
    o = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                        '-of', 'csv=p=0', p], capture_output=True, text=True).stdout.strip().split(',')
    w, h = int(o[0]), int(o[1])
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
                         capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 4).astype(np.float32)


def band(a, side):
    # how many rows (T, B) or columns (L, R) from that edge are a foreign strip
    if side in 'LR':
        a = a.transpose(1, 0, 2)
    if side in 'BR':
        a = a[::-1]
    n, w = a.shape[0], a.shape[1]
    lim = max(3, int(n * 0.04))
    al = a[:, :, 3]
    clear = (al < 40).mean(1) > 0.995             # see-through from end to end (a cornice end is not)
    k = 0
    while k < lim and clear[k]:
        k += 1
    if side in 'TB':
        mid = a[:, int(w * 0.3):int(w * 0.7)]     # the leaf, not the casing
        v = mid[:, :, :3].mean(2)
        ma = mid[:, :, 3].mean(1)
        m, s = v.mean(1), v.std(1)
        j = k
        while j < lim:
            inner = m[j + 4:j + 14].mean()
            if ma[j] < 128 or (s[j] < 12 and m[j] > 200 and m[j] - inner > 12):
                j += 1
            else:
                break
        if j >= lim:                              # as wide as a casing: the door's own
            j = k
        if j > k:
            k = j + 1
    return k


def cut_of(p):
    a = load(p)
    h, w = a.shape[:2]
    c = {s: band(a, s) for s in 'TBLR'}
    return c, w, h


def encode(src, out, crop, q):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', crop, '-c:v', 'libwebp', '-quality', str(q),
                    '-compression_level', '6', out], check=True)


def fix(item):
    fab, code = item
    pl = os.path.join(ROOT, 'web', fab, 'l', code + '.webp')
    ps = os.path.join(ROOT, 'web', fab, 's', code + '.webp')
    if not (os.path.exists(pl) and os.path.exists(ps)):
        return None
    c, w, h = cut_of(pl)
    # a wide photo is a room or a wall with the door in it: its edges are the scene's, not strips
    if w / h > 0.75 or not any(c.values()):
        return None
    if WRITE:
        _, ws, hs = cut_of(ps)
        for k, p in (('l', pl), ('s', ps)):
            d = os.path.join(BACK, fab, k)
            os.makedirs(d, exist_ok=True)
            if not os.path.exists(os.path.join(d, code + '.webp')):
                shutil.copy2(p, d)
        # the same share of the photo off the small size, rounded up so no strip is left
        r = hs / h
        cs = {s: int(np.ceil(v * r)) for s, v in c.items()}
        for p, cc, ww, hh, q in ((pl, c, w, h, 82), (ps, cs, ws, hs, 80)):
            cw, ch = ww - cc['L'] - cc['R'], hh - cc['T'] - cc['B']
            tmp = p + '.tmp.webp'
            encode(p, tmp, 'crop=%d:%d:%d:%d' % (cw, ch, cc['L'], cc['T']), q)
            os.replace(tmp, p)
    return fab, code, w, h, c


items = []
for fab in FABS:
    for col in json.load(io.open(os.path.join(ROOT, 'web', fab, fab + '.json'), encoding='utf-8')):
        ms = col['models'] or ([{'code': col['slug']}] if col.get('main') else [])
        items += [(fab, m['code']) for m in ms]
with ThreadPoolExecutor(8) as ex:
    done = [r for r in ex.map(fix, items) if r]
for fab, code, w, h, c in done:
    print(fab, code, '%dx%d' % (w, h), ' '.join('%s%d' % kv for kv in c.items() if kv[1]))
print(('cut' if WRITE else 'would cut'), len(done), 'of', len(items), 'photos')
