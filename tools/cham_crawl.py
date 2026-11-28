# -*- coding: utf-8 -*-
# python -I cham_crawl.py <cache dir> <out json>
# Interior doors of the Chameleon Doors factory (chameleon-doors.ru, Kazan), by collection. A collection page lists every
# model with its photo and its characteristics in a data-specs attribute, then a text about the collection and
# what comes by default. Pages are cached in <cache dir>.
import html, io, json, os, re, sys, time, urllib.request
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')
CACHE, OUT = sys.argv[1], sys.argv[2]
SITE = 'https://chameleon-doors.ru'
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
        except Exception:
            if k == 3:
                raise
            time.sleep(3 + 4 * k)


def txt(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


home = get('/catalog')
slugs = []
for p in re.findall(r'href="/catalog/([a-z0-9\-]+)"', home):
    if p not in slugs:
        slugs.append(p)
out, warn = [], []
for slug in slugs:
    s = get('/catalog/' + slug)
    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.S)
    name = re.sub(r'\s+Collection$', '', txt(h1.group(1)) if h1 else slug).strip()
    models, specs_all = [], []
    for src, spec, title in re.findall(r'<img class="img-fluid" src="([^"]+)"(?:\s+data-specs=\'([^\']*)\')?[^>]*>\s*<p>(.*?)</p>', s, re.S):
        title = txt(title)
        try:
            sp = json.loads(re.sub(r',\s*}', '}', html.unescape(spec))) if spec else {}  # trailing commas happen
        except ValueError:
            sp = {}
            warn.append('bad specs ' + slug + ' ' + title)
        specs_all.append(sp)
        code = 'cham-' + re.sub(r'[^a-z0-9]+', '-', os.path.splitext(os.path.basename(src))[0].lower()).strip('-')
        models.append({'code': code, 'title': title, 'img': SITE + src if src.startswith('/') else src, 'specs': sp})
    about = ''
    m = re.search(r'<h3>Информация о коллекции[^<]*</h3>\s*(.*?)(?:<h4>|<p class="rounded|<hr)', s, re.S)
    if m:
        about = ' '.join(txt(p) for p in re.findall(r'<p[^>]*>(.*?)</p>', m.group(1), re.S))
    defaults = []
    m = re.search(r'<h4>По умолчанию:</h4>\s*<ul>(.*?)</ul>', s, re.S)
    if m:
        defaults = [txt(li) for li in re.findall(r'<li>(.*?)</li>', m.group(1), re.S)]
    # the collection's characteristics: the value most of its models share
    keys = []
    for sp in specs_all:
        for k in sp:
            if k not in keys:
                keys.append(k)
    specs = []
    for k in keys:
        vals = Counter(sp[k] for sp in specs_all if k in sp)
        specs.append([k, vals.most_common(1)[0][0]])
    coat = sorted(set(sp.get('Покрытие') for sp in specs_all if sp.get('Покрытие')))
    if defaults:
        specs.append(['По умолчанию', '; '.join(defaults)])
    if not models:
        warn.append('no models ' + slug)
    out.append({'slug': slug.replace('-collection', ''), 'name': name, 'url': SITE + '/catalog/' + slug, 'styles': [],
                'coat': coat, 'about': about, 'specs': specs,
                'models': [{'code': x['code'], 'title': x['title'], 'img': x['img']} for x in models]})
codes = [m['code'] for c in out for m in c['models']]
dups = [c for c, n in Counter(codes).items() if n > 1]
if dups:
    warn.append('duplicate codes ' + ', '.join(dups[:10]))
io.open(OUT, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1))
print('collections', len(out), 'models', len(codes), 'warnings', len(warn))
for w in warn:
    print(' ', w)
for c in out:
    print(' ', c['slug'], c['name'], len(c['models']), c['coat'], [k for k, v in c['specs']])
