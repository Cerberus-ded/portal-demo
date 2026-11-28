# -*- coding: utf-8 -*-
# python -I cham_pdf.py <project dir> <Каталог Хамелеон.pdf> <out dir> [<collections json out>]
# Хамелеон: на сайте фабрики фото дверей всего 234×500, в каталоге фабрики (PDF) те же двери примерно вдвое крупнее.
# Достаёт из PDF каждую дверь в её родном размере и находит её модель по подписи под ней («Rail 1» и ниже «ДГ»/«ДО»).
# Пишет <out dir>/<код модели>.png (прозрачность сохраняется) и, если задан, json коллекций для tools/door_fetch.py:
# только модели, у которых снимок из PDF выше нынешнего. Ничего в проекте не меняет.
import io, json, os, re, sys
import pymupdf
from PIL import Image

root, pdf, out = sys.argv[1:4]
jout = sys.argv[4] if len(sys.argv) > 4 else None
os.makedirs(out, exist_ok=True)
sys.stdout.reconfigure(encoding='utf-8')

coll = json.load(io.open(os.path.join(root, 'web/chameleon/chameleon.json'), encoding='utf-8'))
want = {}
for c in coll:
    for m in c['models']:
        kind = m['code'].rsplit('-', 1)[-1]
        # у части коллекций в названии модели уже стоит «ДГ»/«ДО»: тип берём из кода
        title = re.sub(r'\s+(ДГ|ДО)$', '', m['title'].strip())
        want[re.sub(r'\s+', ' ', title.lower()).strip() + '|' + kind] = m['code']


def key(name, typ):
    return re.sub(r'\s+', ' ', name.lower()).strip() + '|' + ('dg' if typ == 'ДГ' else 'do')


doc = pymupdf.open(pdf)
found, seen = {}, set()
for pi, page in enumerate(doc):
    # подписи: название («Rail 1») и на той же высоте правее «ДГ» или «ДО»
    lines = []
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            t = ''.join(s['text'] for s in l['spans']).strip()
            if t:
                lines.append((l['bbox'], t))
    labels = []
    for (bb, t) in lines:
        if t in ('ДГ', 'ДО'):
            left = [(b2, t2) for (b2, t2) in lines if t2 not in ('ДГ', 'ДО') and abs(b2[1] - bb[1]) < 4 and 0 < bb[0] - b2[0] < 140]
            if left:
                b2, name = max(left, key=lambda x: x[0][0])
                labels.append((b2[0], b2[1], key(name, t)))
    for info in page.get_image_info(xrefs=True):
        x0, y0, x1, y1 = info['bbox']
        w, h = info['width'], info['height']
        if h < 600 or h < 1.6 * w or not info['xref']:
            continue
        cand = [lb for lb in labels if x0 - 15 <= lb[0] <= x0 + (x1 - x0) * 0.6 and y1 - 5 <= lb[1] <= y1 + 40]
        if not cand:
            continue
        k = min(cand, key=lambda lb: lb[1] - y1)[2]
        if k not in want or k in seen:
            continue
        seen.add(k)
        pix = pymupdf.Pixmap(doc, info['xref'])
        sm = doc.extract_image(info['xref']).get('smask', 0)
        if pix.n - pix.alpha > 3:
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        im = Image.open(io.BytesIO(pix.tobytes('png')))
        if sm:
            mask = Image.open(io.BytesIO(pymupdf.Pixmap(doc, sm).tobytes('png'))).convert('L')
            if mask.size == im.size:
                im = im.convert('RGB'); im.putalpha(mask)
        code = want[k]
        im.save(os.path.join(out, code + '.png'))
        found[code] = (pi + 1, im.size)

missing = sorted(set(want.values()) - set(found))
print('models', len(want), 'found in PDF', len(found), 'missing', len(missing))
print('missing:', ', '.join(missing))
better = {}
for code, (pg, (w, h)) in found.items():
    cur = os.path.join(root, 'web/chameleon/l', code + '.webp')
    ch = Image.open(cur).size[1] if os.path.exists(cur) else 0
    if h > ch * 1.2:
        better[code] = (ch, h, pg)
print('higher than now (by 20% or more):', len(better))
if jout:
    res = []
    for c in coll:
        ms = [dict(m, img=os.path.join(out, m['code'] + '.png')) for m in c['models'] if m['code'] in better]
        if ms:
            res.append({'slug': c['slug'], 'name': c['name'], 'models': ms})
    json.dump(res, io.open(jout, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
