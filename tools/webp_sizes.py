# -*- coding: utf-8 -*-
# python -I webp_sizes.py <dir> [min height]: the size of every WebP in a folder, read from its header (no ffprobe),
# and the ones lower than <min height>.
import os, struct, sys
from collections import Counter


def size(p):
    b = open(p, 'rb').read(40)
    kind = b[12:16]
    if kind == b'VP8X':
        return 1 + int.from_bytes(b[24:27], 'little'), 1 + int.from_bytes(b[27:30], 'little')
    if kind == b'VP8L':
        v = int.from_bytes(b[21:25], 'little')
        return (v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1
    if kind == b'VP8 ':
        w, h = struct.unpack('<HH', b[26:30])
        return w & 0x3FFF, h & 0x3FFF
    return 0, 0


d = sys.argv[1]
low = int(sys.argv[2]) if len(sys.argv) > 2 else 0
sizes = {f: size(os.path.join(d, f)) for f in sorted(os.listdir(d)) if f.endswith('.webp')}
print(len(sizes), 'files; heights:', Counter((h // 100) * 100 for w, h in sizes.values()).most_common())
if low:
    small = [(f, s) for f, s in sizes.items() if s[1] < low]
    print(len(small), 'lower than', low)
    for f, s in small:
        print(' ', f, s)
