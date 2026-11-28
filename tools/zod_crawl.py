# -*- coding: utf-8 -*-
# python -I zod_crawl.py <cache dir> <out json>
# Interior doors of the Zodchij factory (zodchij.ru), by series: the series page gives the name, the text about it,
# the style and the characteristics; each model page gives its executions (solid, glazed) with a photo each,
# and the list of coverings. Pages are cached in <cache dir>, so a second run reads from disk.
import html, io, json, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.stdout.reconfigure(encoding='utf-8')
CACHE, OUT = sys.argv[1], sys.argv[2]
SITE = 'https://zodchij.ru'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36'
os.makedirs(CACHE, exist_ok=True)


def get(path):
    f = os.path.join(CACHE, re.sub(r'[^a-z0-9_-]+', '_', path.strip('/')) + '.html')
    if os.path.exists(f):
        return io.open(f, encoding='utf-8').read()
    for k in range(4):
        try:
            rq = urllib.request.Request(SITE + path, headers={'User-Agent': UA})
            with urllib.request.urlopen(rq, timeout=60) as r:
                s = r.read().decode('utf-8', 'replace')
            io.open(f, 'w', encoding='utf-8').write(s)
            time.sleep(0.3)
            return s
        except Exception as e:
            if k == 3:
                raise
            time.sleep(3 + 4 * k)


def txt(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


listing = get('/catalog/mezhkomnatnye-dveri/')
cards = re.findall(r'href="/catalog/mezhkomnatnye-dveri/([a-z0-9_\-]+)/"\s+data-series-card\s+data-series-name="([^"]+)"\s+data-style="([^"]*)"', listing)
order = []
for slug, name, style in cards:
    if slug not in [o[0] for o in order]:
        order.append((slug, html.unescape(name), style))
# series linked from the menu but missing from the cards (hidden doors and the like)
for slug in re.findall(r'href="/catalog/mezhkomnatnye-dveri/([a-z0-9_\-]+)/"', listing):
    if slug not in [o[0] for o in order]:
        order.append((slug, None, ''))
print('series', len(order))


def series(entry):
    slug, name, style = entry
    s = get('/catalog/mezhkomnatnye-dveri/%s/' % slug)
    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.S)
    name = txt(h1.group(1)) if h1 else name
    about = []
    m = re.search(r'<div class="series-about__text">(.*?)</div>', s, re.S)
    if m:
        about.append(txt(m.group(1)))
    specs = []
    for h, p in re.findall(r'<div class="series-info-card series-info-card--spec">\s*<h3>(.*?)</h3>\s*<p>(.*?)</p>', s, re.S):
        specs.append([txt(h), txt(p).replace('мм мм', 'мм')])
    models = []
    for path, alt in re.findall(r'<a href="(/catalog/mezhkomnatnye-dveri/%s/[a-z0-9_\-]+/)">\s*<div class="catalog-card-image catalog-model-card__image">.*?alt="([^"]*)"' % re.escape(slug), s, re.S):
        if path not in [x[0] for x in models]:
            models.append((path, html.unescape(alt)))
    return {'slug': slug, 'name': name, 'style_key': style, 'url': SITE + '/catalog/mezhkomnatnye-dveri/%s/' % slug,
            'about': ' '.join(a for a in about if a), 'specs': specs, 'model_pages': models}


def model(path):
    s = get(path)
    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.S)
    title = txt(h1.group(1)) if h1 else ''
    execs = None
    for m in re.finditer(r'<script[^>]*>\s*(\[\{"code":.*?\])\s*</script>', s, re.S):
        try:
            execs = json.loads(m.group(1))
            break
        except ValueError:
            pass
    coats = [html.unescape(x) for x in re.findall(r'data-covering-modal-item\s+data-name="([^"]+)"', s)]
    return {'path': path, 'title': title, 'execs': execs or [], 'coats': coats}


with ThreadPoolExecutor(3) as ex:
    ser = list(ex.map(series, order))
pages = [p for x in ser for p, _ in x['model_pages']]
print('model pages', len(pages))
with ThreadPoolExecutor(3) as ex:
    got = dict((m['path'], m) for m in ex.map(model, pages))

out, warn = [], []
for x in ser:
    styles = [v for k, v in x['specs'] if k == 'Стиль']
    coll = {'slug': x['slug'], 'name': x['name'], 'url': x['url'], 'styles': styles[:1], 'style_key': x['style_key'],
            'about': x['about'], 'specs': [p for p in x['specs'] if p[0] != 'Стиль'], 'coats': [], 'models': []}
    # one colour for the whole series where the factory shows nearly every model in it (Нуар: all white, though
    # Нуар 2 comes first in «Пана Кота»); series shown on purpose in different colours (Вектор) stay as they are
    execs = [e for p, _ in x['model_pages'] for e in got[p]['execs'] if e.get('images')]
    tally, first = {}, {}
    for e in execs:
        for c in set((i.get('colorName') or '').lower() for i in e['images']):
            tally[c] = tally.get(c, 0) + 1
        c0 = (e['images'][0].get('colorName') or '').lower()
        first[c0] = first.get(c0, 0) + 1
    # on a tie, the colour the factory puts first wins
    main = max(tally, key=lambda c: (tally[c], first.get(c, 0))) if tally else ''
    if not main or tally[main] < 0.8 * len(execs):
        main = ''
    for path, alt in x['model_pages']:
        m = got[path]
        base = m['title'] or alt
        mslug = path.rstrip('/').split('/')[-1]
        for c in m['coats']:
            if c not in coll['coats']:
                coll['coats'].append(c)
        if not m['execs']:
            warn.append('no executions ' + path)
        for e in m['execs']:
            imgs = e.get('images') or []
            if not imgs:
                warn.append('no image %s %s' % (path, e.get('code')))
                continue
            im = next((i for i in imgs if main and (i.get('colorName') or '').lower() == main), imgs[0])
            solid = e.get('code') == 'PG' or (e.get('shortName') or '').lower().startswith('глух')
            coll['models'].append({
                'code': 'zod-' + mslug.replace('_', '-') + ('' if solid else '-' + (e.get('code') or 'x').lower()),
                'title': base if solid else base + ' | ' + (e.get('shortName') or e.get('name') or '').lower(),
                'img': SITE + (im.get('original') or im.get('src')),
                'color': im.get('colorName') or '',
                'page': SITE + path})
    if not coll['models']:
        warn.append('series without models ' + x['slug'])
    out.append(coll)
io.open(OUT, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1))
print('series', len(out), 'models', sum(len(c['models']) for c in out), 'warnings', len(warn))
for w in warn[:40]:
    print(' ', w)
