# -*- coding: utf-8 -*-
# python -I audit.py <project dir> [factory ...]
# Every door photo of every factory checked the way a visitor would notice a fault:
#   margins   empty transparent or white margins around the door (it looks smaller than its neighbours)
#   ratio     the door is wider or narrower than the rest of its collection (cut casing, other framing)
#   small     the large photo is under 1000 px tall (soft when opened large)
#   twin      two models of one collection show the very same photo
# Reads web/<factory>/<factory>.json and web/<factory>/s|l/<code>.webp. Prints the findings, one per line.
import io, json, os, statistics, struct, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = sys.argv[1]
FABS = sys.argv[2:] or ['lord', 'zodchij', 'andora']
sys.stdout.reconfigure(encoding='utf-8')
GW, GH = 24, 52       # the thumbnail the checks look at


def size(p):
    b = open(p, 'rb').read(40)
    k = b[12:16]
    if k == b'VP8X':
        return 1 + int.from_bytes(b[24:27], 'little'), 1 + int.from_bytes(b[27:30], 'little')
    if k == b'VP8L':
        v = int.from_bytes(b[21:25], 'little')
        return (v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1
    w, h = struct.unpack('<HH', b[26:30])
    return w & 0x3FFF, h & 0x3FFF


def thumb(p):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-vf', 'scale=%d:%d:flags=area,format=rgba' % (GW, GH),
                        '-f', 'rawvideo', '-'], capture_output=True)
    return r.stdout if len(r.stdout) == GW * GH * 4 else None


def edges(px):
    # mean alpha and mean brightness of the outermost column on each side and the top and bottom rows
    def at(x, y):
        i = (y * GW + x) * 4
        return px[i:i + 4]
    out = {}
    for name, pts in (('left', [(0, y) for y in range(GH)]), ('right', [(GW - 1, y) for y in range(GH)]),
                      ('top', [(x, 0) for x in range(GW)]), ('bottom', [(x, GH - 1) for x in range(GW)])):
        a = [at(x, y)[3] for x, y in pts]
        v = [sum(at(x, y)[:3]) / 3 for x, y in pts]
        out[name] = (sum(a) / len(a), sum(v) / len(v), max(v) - min(v))
    return out


def sig(px):
    # a coarse fingerprint: brightness on an 8x16 grid
    g = []
    for gy in range(16):
        for gx in range(8):
            x, y = gx * GW // 8 + 1, gy * GH // 16 + 1
            i = (y * GW + x) * 4
            g.append(round((px[i] + px[i + 1] + px[i + 2]) / 3 * px[i + 3] / 255 / 8))
    return tuple(g)


rows, IMG = [], {}
for fab in FABS:
    data = json.load(io.open(os.path.join(ROOT, 'web', fab, fab + '.json'), encoding='utf-8'))
    for c in data:
        ms = c['models'] or ([{'code': c['slug'], 'title': c['name']}] if c.get('main') else [])
        for m in ms:
            rows.append((fab, c['slug'], c.get('name', ''), m['code'], m.get('title', '')))
            if m.get('img'):
                IMG[(fab, m['code'])] = m['img']


def look(r):
    fab, slug, cname, code, title = r
    pl, ps = (os.path.join(ROOT, 'web', fab, k, code + '.webp') for k in ('l', 's'))
    if not (os.path.exists(pl) and os.path.exists(ps)):
        return r, None, None, None
    w, h = size(pl)
    px = thumb(ps)
    return r, (w, h), (edges(px) if px else None), (sig(px) if px else None)


with ThreadPoolExecutor(8) as ex:
    seen = list(ex.map(look, rows))

found = []
by_coll = {}
for r, wh, ed, sg in seen:
    fab, slug, cname, code, title = r
    if wh is None:
        found.append((fab, slug, 'missing', code, 'no photo'))
        continue
    by_coll.setdefault((fab, slug), []).append((code, title, wh, ed, sg))
    w, h = wh
    if h < 1000:
        found.append((fab, slug, 'small', code, '%dx%d' % (w, h)))
    if ed:
        clear = [k for k, (a, v, spread) in ed.items() if a < 128]
        white = [k for k, (a, v, spread) in ed.items() if a >= 250 and v > 247 and spread < 6]
        if ('left' in clear and 'right' in clear) or ('top' in clear and 'bottom' in clear):
            found.append((fab, slug, 'margins', code, 'transparent ' + ','.join(clear)))
        if ('left' in white and 'right' in white) or ('top' in white and 'bottom' in white):
            found.append((fab, slug, 'margins', code, 'white ' + ','.join(white)))
for (fab, slug), items in by_coll.items():
    ratios = [w / h for _, _, (w, h), _, _ in items]
    if len(items) > 1:
        med = statistics.median(ratios)
        for (code, title, (w, h), _, _), rt in zip(items, ratios):
            if abs(rt - med) / med > 0.06:
                found.append((fab, slug, 'ratio', code, '%.3f vs %.3f in the collection' % (rt, med)))
    # the same source file under several models (a coarse picture match is fooled by plain doors of one colour)
    srcs = {}
    for code, title, _, _, sg in items:
        u = IMG.get((fab, code))
        if u:
            srcs.setdefault(u, []).append(code)
    for u, codes in srcs.items():
        if len(codes) > 1:
            found.append((fab, slug, 'twin', ' = '.join(codes), 'same photo file'))

kinds = {}
for f in found:
    kinds[f[2]] = kinds.get(f[2], 0) + 1
print('photos', len(rows), 'findings', len(found), kinds)
for f in sorted(found):
    print('\t'.join(f))
