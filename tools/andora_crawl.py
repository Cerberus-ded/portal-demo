# -*- coding: utf-8 -*-
# python -I andora_crawl.py <cache dir> <out json>
# Interior doors of the Andora factory (andora-doors.ru, Ulyanovsk), by collection. A collection page lists its models;
# a model page gives one photo, the film colours, the characteristics and a description with the door's make-up.
# Pages are cached in <cache dir>, so a second run reads from disk.
import html, io, json, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.stdout.reconfigure(encoding='utf-8')
CACHE, OUT = sys.argv[1], sys.argv[2]
SITE = 'https://andora-doors.ru'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36'
SKIP = {'dveri_v_nalichii', 'dekorativnye_pokrytiya', 'stenovye_paneli', 'falshframugi'}
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
        except Exception:
            if k == 3:
                raise
            time.sleep(3 + 4 * k)


def txt(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


cat = get('/catalog/')
secs = []
for path, inner in re.findall(r'<a[^>]+href="/catalog/([a-z_]+)/"[^>]*>(.*?)</a>', cat, re.S):
    name = txt(inner)
    if path in SKIP or not name or path in [x[0] for x in secs]:
        continue
    secs.append((path, name))
print('collections', len(secs))


def listing(sec):
    path, name = sec
    s = get('/catalog/%s/' % path)
    pages = sorted(set(int(n) for n in re.findall(r'PAGEN_1=(\d+)', s)))
    for n in pages:
        if n > 1:
            s += get('/catalog/%s/?PAGEN_1=%d' % (path, n))
    prods = []
    for href in re.findall(r'<a href="(/catalog/%s/[a-z0-9_\-]+/(?:\?oid=\d+)?)" class="image-list__link"' % path, s):
        base = href.split('?')[0]
        if base not in [p.split('?')[0] for p in prods]:
            prods.append(html.unescape(href))
    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.S)
    count = re.search(r'element-count[^>]*>(\d+)', s)
    return {'slug': path, 'title': txt(h1.group(1)) if h1 else name, 'count': int(count.group(1)) if count else None, 'prods': prods}


def groups(desc_html):
    # "Head:<br>- a<br>- b<br><br>Head 2:..." into [head, [values]]
    lines = [txt(x) for x in re.split(r'<br\s*/?>|\n', desc_html or '')]
    out, g, free = [], None, []
    for ln in lines:
        if not ln:
            continue
        if re.search(r':\s*$', ln) and len(ln) < 70:
            g = [re.sub(r'\s*:\s*$', '', ln), []]
            out.append(g)
        elif g:
            g[1].append(re.sub(r'^[-–•\s]+', '', ln).strip())
        else:
            free.append(ln)
    return free, out


def product(href):
    s = get(href)
    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.S)
    # the door photo of the gallery is the full one; og:image is often a half-size preview
    big = re.search(r'<div class="detail-gallery-big-wrapper">\s*<link href="([^"]+)" itemprop="image"', s)
    og = re.search(r'<meta property="og:image" content="([^"]+)"', s)
    img = big.group(1) if big else (og.group(1).replace(':443', '') if og else '')
    props = [(txt(a), txt(b)) for a, b in re.findall(r'js-prop-title">(.*?)</div>.*?js-prop-value">(.*?)</div>', s, re.S)]
    seen, uniq = set(), []
    for k, v in props:
        if k not in seen:
            seen.add(k)
            uniq.append([k, v])
    film = re.search(r'<div class="sku-props__title[^"]*">\s*(.*?)\s*:', s, re.S)
    colours = []
    for t in re.findall(r'class="sku-props__value sku-props__value--pict[^"]*"\s+data-onevalue="[^"]+"\s+data-title="([^"]+)"', s):
        t = html.unescape(t).strip()
        if t and t not in colours:
            colours.append(t)
    d = re.search(r'<div class="content content--max-width js-detail-description" itemprop="description">(.*?)</div>', s, re.S)
    free, grp = groups(d.group(1) if d else '')
    return {'href': href, 'title': txt(h1.group(1)) if h1 else '', 'img': img, 'props': uniq,
            'film': txt(film.group(1)) if film else '', 'colours': colours, 'free': free, 'groups': grp}


with ThreadPoolExecutor(3) as ex:
    lists = list(ex.map(listing, secs))
hrefs = [h for x in lists for h in x['prods']]
print('models', len(hrefs))
with ThreadPoolExecutor(3) as ex:
    prods = dict((p['href'], p) for p in ex.map(product, hrefs))

out, warn = [], []
for x in lists:
    name = re.sub(r'^Коллекция\s+', '', x['title']).strip()
    coll = {'slug': x['slug'], 'name': name, 'url': SITE + '/catalog/%s/' % x['slug'], 'styles': [],
            'about': '', 'specs': [], 'coat': [], 'film': '', 'colours': [], 'models': []}
    if x['count'] is not None and x['count'] != len(x['prods']):
        warn.append('%s: page says %d, found %d' % (x['slug'], x['count'], len(x['prods'])))
    heads = {}
    for href in x['prods']:
        p = prods[href]
        if not p['img']:
            warn.append('no photo ' + href)
            continue
        mslug = href.split('?')[0].rstrip('/').split('/')[-1]
        coll['models'].append({'code': 'and-' + mslug.replace('_', '-'), 'title': p['title'], 'img': SITE + p['img'] if p['img'].startswith('/') else p['img'],
                               'page': SITE + href})
        for c in p['colours']:
            if c not in coll['colours']:
                coll['colours'].append(c)
        if p['film'] and not coll['film']:
            coll['film'] = p['film']
        for k, v in p['props']:
            if k == 'Покрытие':
                for t in re.split(r'\s*[,/;]\s*', v):
                    if t and t not in coll['coat']:
                        coll['coat'].append(t)
            elif k not in heads:
                heads[k] = v
        for h, vals in p['groups']:
            if vals and h not in heads:
                heads[h] = '; '.join(vals)
        if p['free'] and not coll['about']:
            coll['about'] = ' '.join(p['free'])
    coll['specs'] = [[k, v] for k, v in heads.items()]
    if not coll['models']:
        warn.append('collection without models ' + x['slug'])
    out.append(coll)
io.open(OUT, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1))
print('collections', len(out), 'models', sum(len(c['models']) for c in out), 'warnings', len(warn))
for w in warn[:40]:
    print(' ', w)
