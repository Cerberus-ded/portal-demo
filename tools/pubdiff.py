# -*- coding: utf-8 -*-
# python -I pubdiff.py <published build dir> <new build dir> <out prefix> [MB per batch]
# What an artifact update has to send: files new or changed since the published build (the page itself aside),
# split into batches small enough to upload in one go (big publishes time out), plus files that are gone.
# Writes <out prefix>-<n>.json (a files list for the Artifact tool) and <out prefix>-gone.json.
import filecmp, json, os, sys

A, B, OUT = sys.argv[1:4]
LIMIT = float(sys.argv[4]) * 1e6 if len(sys.argv) > 4 else 11e6


def files(d):
    out = set()
    for dp, _, fs in os.walk(d):
        for f in fs:
            out.add(os.path.relpath(os.path.join(dp, f), d).replace(os.sep, '/'))
    return out


fa, fb = files(A), files(B)
gone = sorted(p for p in fa - fb if p != 'old-index.html')
changed = sorted(p for p in fb if p not in ('index.html', 'old-index.html')
                 and (p not in fa or not filecmp.cmp(os.path.join(A, p), os.path.join(B, p), shallow=False)))
batches, size = [[]], 0
for p in changed:
    s = os.path.getsize(os.path.join(B, p))
    if size + s > LIMIT and batches[-1]:
        batches.append([])
        size = 0
    batches[-1].append(p)
    size += s
print('gone', len(gone), 'changed or new', len(changed), 'batches', len(batches))
for i, b in enumerate(batches):
    print(i, len(b), round(sum(os.path.getsize(os.path.join(B, p)) for p in b) / 1e6, 1), 'MB')
    json.dump([{'path': p} for p in b], open('%s-%d.json' % (OUT, i), 'w'))
json.dump(gone, open(OUT + '-gone.json', 'w'))
