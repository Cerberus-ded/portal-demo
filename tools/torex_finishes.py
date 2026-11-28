# -*- coding: utf-8 -*-
# The finishes of each Torex series, from torex.ru, as colour squares with names, like the salon's Excel price list
# (the salon shows what can be ordered, it does not sell options: no prices, nothing to pick).
#
#   python -I torex_finishes.py list <project> <pages dir> <swatches.txt>
#       torex.ru pages saved beforehand (curl -4: torex.ru does not answer over IPv6 here):
#         <pages dir>/series/<series>.html   the series page (links to its products)
#         <pages dir>/product/<id>.html      a product: «Посмотреть дверь в интерьере» lists every design of the series, outer and
#                                            inner, with its colour id and variant (MP: metal outside, PP: panel outside)
#         <pages dir>/catalog/<series>.html  /catalog/series_<series>/: the colour filter, a square picture per colour id
#       Writes web/torex/finishes.json (per series the colour ids: m outside metal, p outside panel, i inside panel),
#       web/torex/colors.json (colour id: name, picture) and "<id> <address>" lines to <swatches.txt> (fetch each into <id>.<ext>).
#   python -I torex_finishes.py images <project> <swatches dir>
#       The squares into web/torex/swatch/<id>.webp, 120x120.
import glob, io, json, os, re, sys
import html as H

mode, root = sys.argv[1], sys.argv[2]
sys.stdout.reconfigure(encoding='utf-8')
TX = os.path.join(root, 'web', 'torex')


def clean(c):
    # «Лиственница белая (арт. ПВХ Лиственница белая)» → «Лиственница белая»
    return re.sub(r'\s*\(арт\.[^)]*\)', '', H.unescape(c)).strip()


def designs(s):
    out = {}
    for side in ('outer', 'inner'):
        m = re.search(r'data-interior-side="%s">(.*?)(?=<div class="interior__side-container|<div class="interior__tab-content)' % side, s, re.S)
        out[side] = [(a.group(1).split(':')[0], clean(a.group(2)), H.unescape(a.group(3)).strip()) for a in re.finditer(
            r'class="interior__door-item[^"]*" data-id="([^"]+)">\s*<img src="[^"]+"[^>]*alt="([^"]*)">\s*<span class="interior__door-item-text">([^<]*)</span>',
            m.group(1) if m else '')]
    return out


if mode == 'list':
    pages, listing = sys.argv[3], sys.argv[4]
    series = json.load(io.open(os.path.join(TX, 'torex.json'), encoding='utf-8'))
    colors, res = {}, {}
    for f in sorted(glob.glob(os.path.join(pages, 'catalog', '*.html'))):
        for m in re.finditer(r'data-filter="(\d+)"><div style="background-image: url\(([^)]+)\);"></div><div>([^<]*)</div>', io.open(f, encoding='utf-8').read()):
            colors.setdefault(m.group(1), {'name': clean(m.group(3)), 'src': m.group(2)})
    used = set()
    for c in series:
        m = re.search(r'/catalog/series/([^/]+)/', c.get('url') or '')
        if not m:
            print('no factory page:', c['name'])
            continue
        sp = io.open(os.path.join(pages, 'series', m.group(1) + '.html'), encoding='utf-8').read()
        # any product of the series lists the same designs: the first one saved
        pid = next(p for p in re.findall(r'/catalog/product/(\d+)/', sp) if os.path.exists(os.path.join(pages, 'product', p + '.html')))
        d = designs(io.open(os.path.join(pages, 'product', pid + '.html'), encoding='utf-8').read())
        entry = {'from': 'https://torex.ru/catalog/product/%s/' % pid}
        groups = (('m', [x for x in d['outer'] if x[2].endswith(' MP')]), ('p', [x for x in d['outer'] if not x[2].endswith(' MP')]), ('i', d['inner']))
        for key, items in groups:
            ids, names = [], set()
            for cid, name, _ in items:
                n = (colors.get(cid, {}).get('name') or name).lower()
                if cid in ids or n in names:  # «Колоре Неро» and «Колоре неро»: one square
                    continue
                if cid not in colors:
                    print('  no square for', c['name'], cid, name)
                    continue
                ids.append(cid); names.add(n); used.add(cid)
            entry[key] = ids
        res[c['slug']] = entry
        print(c['name'], 'outside metal', len(entry['m']), 'outside panel', len(entry['p']), 'inside', len(entry['i']))
    colors = {k: v for k, v in sorted(colors.items(), key=lambda kv: int(kv[0])) if k in used}
    for name, data in (('finishes.json', res), ('colors.json', colors)):
        io.open(os.path.join(TX, name), 'w', encoding='utf-8', newline='\n').write(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
    io.open(listing, 'w', encoding='utf-8', newline='\n').write(''.join('%s %s\n' % (k, v['src']) for k, v in colors.items()))
    print('colours', len(colors))

elif mode == 'images':
    from PIL import Image
    src = sys.argv[3]
    colors = json.load(io.open(os.path.join(TX, 'colors.json'), encoding='utf-8'))
    d = os.path.join(TX, 'swatch')
    os.makedirs(d, exist_ok=True)
    for cid in colors:
        a = Image.open(glob.glob(os.path.join(src, cid + '.*'))[0]).convert('RGBA')
        im = Image.new('RGB', a.size, (255, 255, 255))  # a sample with see-through bits lies on white
        im.paste(a, mask=a.getchannel('A'))
        s = min(im.size)  # the middle square of the sample
        im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width - s) // 2 + s, (im.height - s) // 2 + s))
        im.resize((120, 120), Image.LANCZOS).save(os.path.join(d, cid + '.webp'), 'WEBP', quality=86, method=6)
    print('squares', len(colors))
