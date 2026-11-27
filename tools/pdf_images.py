# -*- coding: utf-8 -*-
# python -I pdf_images.py <pdf> <out dir> [first-last]
# The pictures of each page of a simple PDF (no object streams), as PNG with their transparency:
# DCTDecode (JPEG) colour with a FlateDecode SMask as alpha. Files: p<page>-<n>-<w>x<h>.png. The PDF is read as data only.
import os, re, subprocess, sys, zlib

PDF, OUT = sys.argv[1], sys.argv[2]
rng = sys.argv[3] if len(sys.argv) > 3 else None
os.makedirs(OUT, exist_ok=True)
b = open(PDF, 'rb').read()
objs = {}
for m in re.finditer(rb'(\d+)\s+0\s+obj\s*(.*?)endobj', b, re.S):
    objs[int(m.group(1))] = m.group(2)


def resolve(v):
    m = re.match(rb'\s*(\d+)\s+0\s+R', v)
    return objs[int(m.group(1))] if m else v


def stream(o):
    m = re.search(rb'stream\r?\n(.*)endstream', o, re.S)
    return m.group(1) if m else b''


kids = []
for n, o in objs.items():
    if re.search(rb'/Type\s*/Pages', o):
        k = re.search(rb'/Kids\s*\[([^\]]*)\]', o)
        if k:
            kids = [int(x) for x in re.findall(rb'(\d+)\s+0\s+R', k.group(1))]
            break
a, z = (1, len(kids))
if rng:
    a, z = [int(x) for x in rng.split('-')]
for pi in range(a, z + 1):
    po = objs[kids[pi - 1]]
    res = re.search(rb'/Resources\s*(\d+\s+0\s+R|<<.*>>)', po, re.S)
    r = resolve(res.group(1)) if res else b''
    xo = re.search(rb'/XObject\s*(\d+\s+0\s+R|<<[^>]*>>)', r, re.S)
    x = resolve(xo.group(1)) if xo else b''
    n = 0
    for name, num in re.findall(rb'/(\w+)\s+(\d+)\s+0\s+R', x):
        o = objs[int(num)]
        head = o[:o.find(b'stream')]
        if b'/DCTDecode' not in head:
            continue
        w = int(re.search(rb'/Width\s+(\d+)', head).group(1))
        h = int(re.search(rb'/Height\s+(\d+)', head).group(1))
        n += 1
        base = os.path.join(OUT, 'p%02d-%d-%dx%d' % (pi, n, w, h))
        open(base + '.jpg', 'wb').write(stream(o))
        sm = re.search(rb'/SMask\s+(\d+)\s+0\s+R', head)
        if sm:
            mo = objs[int(sm.group(1))]
            raw = zlib.decompress(stream(mo))
            open(base + '.a', 'wb').write(raw)
            r2 = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', base + '.jpg', '-f', 'rawvideo', '-pix_fmt', 'gray',
                                 '-s', '%dx%d' % (w, h), '-i', base + '.a', '-filter_complex', '[0]format=rgba[c];[c][1]alphamerge',
                                 base + '.png'], capture_output=True)
            os.remove(base + '.a')
            if r2.returncode:
                print('mask failed', base, r2.stderr[:200])
            else:
                os.remove(base + '.jpg')
        print(os.path.basename(base))
