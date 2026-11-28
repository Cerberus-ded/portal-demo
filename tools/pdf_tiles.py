# -*- coding: utf-8 -*-
# python -I pdf_tiles.py <page.png> <x0> <x1> <out prefix> [min height px]
# The door pictures of a catalogue page laid out as a grid on white: cut out one by one, in reading order
# (rows top to bottom, then left to right), from the part of the page between x0 and x1 (fractions of its width).
# Bands of the page with ink are found first; tall bands are rows of doors, short ones their captions.
import subprocess, sys

PNG, X0, X1, OUT = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
MINH = int(sys.argv[5]) if len(sys.argv) > 5 else 400
pr = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', PNG], capture_output=True)
W, H = [int(x) for x in pr.stdout.decode().strip().split(',')[:2]]
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', PNG, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
a, b = int(W * X0), int(W * X1)
INK = 250


def ink(x, y):
    return raw[y * W + x] < INK


# rows with any ink in the region (sampled every 2 px across)
rowink = [sum(1 for x in range(a, b, 2) if ink(x, y)) for y in range(H)]
bands, y = [], 0
while y < H:
    if rowink[y] > 3:
        s = y
        while y < H and rowink[y] > 3:
            y += 1
        bands.append((s, y))
    else:
        y += 1
# glue bands split by a thin light line inside a picture (gaps of a few px)
merged = []
for s, e in bands:
    if merged and s - merged[-1][1] <= 6:
        merged[-1] = (merged[-1][0], e)
    else:
        merged.append((s, e))
tiles = []
for s, e in merged:
    if e - s < MINH:
        continue
    colink = [sum(1 for yy in range(s, e, 3) if ink(x, yy)) for x in range(a, b)]
    x = 0
    while x < len(colink):
        if colink[x] > 3:
            cs = x
            while x < len(colink) and colink[x] > 3:
                x += 1
            if x - cs > 60:
                # this picture's own top and bottom
                cx0, cx1 = a + cs, a + x
                rows = [yy for yy in range(s, e) if sum(1 for xx in range(cx0, cx1, 2) if ink(xx, yy)) > 3]
                tiles.append((cx0, rows[0], cx1 - cx0, rows[-1] - rows[0] + 1))
        else:
            x += 1
for i, (x, y, w, h) in enumerate(tiles, 1):
    out = '%s-%02d.png' % (OUT, i)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', PNG, '-vf', 'crop=%d:%d:%d:%d' % (w, h, x, y), out])
    print(out, w, h, x, y)
