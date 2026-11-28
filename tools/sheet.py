# -*- coding: utf-8 -*-
# python -I sheet.py <factory dir> <collections json> <collection slug> <out.png> [size s|l] [per row]
# Every door of one collection on one sheet, in the catalogue's order, numbered, each in the same cell on a
# beige ground (as on the site), so uneven sizes, margins, backgrounds or wrong photos show at a glance.
import io, json, os, subprocess, sys

D, SRC, SLUG, OUT = sys.argv[1:5]
SIZE = sys.argv[5] if len(sys.argv) > 5 else 's'
PER = int(sys.argv[6]) if len(sys.argv) > 6 else 10
CW, CH = 170, 340          # cell, the door is fitted inside with its own proportions
FONT = "'C\\:/Windows/Fonts/arial.ttf'"
data = json.load(io.open(SRC, encoding='utf-8'))
coll = [c for c in data if c['slug'] == SLUG]
if not coll:
    sys.exit('no collection ' + SLUG)
models = coll[0]['models']
args, chains = ['ffmpeg', '-v', 'error', '-y'], []
for i, m in enumerate(models):
    args += ['-i', os.path.join(D, SIZE, m['code'] + '.webp')]
    chains.append('[%d]scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2:color=0xe8e2d8,'
                  'drawtext=fontfile=%s:text=%d:x=4:y=4:fontsize=18:fontcolor=0xb03020[c%d]' % (i, CW - 10, CH - 10, CW, CH, FONT, i + 1, i))
n = len(models)
rows = (n + PER - 1) // PER
cols = min(n, PER)
layout = '|'.join('%d_%d' % ((i % PER) * CW, (i // PER) * CH) for i in range(n))
graph = ';'.join(chains) + ';' + ''.join('[c%d]' % i for i in range(n))
graph += ('xstack=inputs=%d:layout=%s:fill=0xe8e2d8' % (n, layout)) if n > 1 else 'null'
args += ['-filter_complex', graph, '-frames:v', '1', OUT]
r = subprocess.run(args, capture_output=True)
if r.returncode:
    sys.exit(r.stderr.decode('utf-8', 'replace')[:800])
for i, m in enumerate(models):
    print(i + 1, m['code'], m['title'])
