# -*- coding: utf-8 -*-
# python -I lord31_crawl.py <out dir>: LORD's collections from dveri-lord.ru, each with its models and their photos.
import io, json, os, re, sys, time, html, urllib.request
OUT = sys.argv[1]
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
def get(url):
    for k in range(3):
        try:
            rq = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ru'})
            with urllib.request.urlopen(rq, timeout=40) as r:
                return r.read()
        except Exception as e:
            err = e
            time.sleep(2 + k * 3)
    raise err

products = []
for page in (1, 2):
    d = json.loads(get('https://dveri-lord.ru/wp-json/wc/store/v1/products?per_page=100&page=%d' % page).decode('utf-8'))
    if not d:
        break
    products += d
print('products', len(products))

STYLE = {'klassika': 'Классика', 'neoklassika': 'Неоклассика', 'minimalizm': 'Минимализм', 'dizajn': 'Дизайн', 'alyuminievye-dveri-alveo': 'Алюминиевые'}
# which products each style page lists: the store API leaves some collections without a style
cats = {}
for slug in STYLE:
    s = get('https://dveri-lord.ru/product-category/door/%s/' % slug).decode('utf-8', 'replace')
    for p in sorted(set(re.findall(r'https://dveri-lord\.ru/product/([a-z0-9-]+)/', s))):
        cats.setdefault(p, []).append(STYLE[slug])
    time.sleep(0.5)

def text_of(h):
    h = re.sub(r'<br\s*/?>', '\n', h)
    h = re.sub(r'<[^>]+>', '', h)
    return html.unescape(h).strip()

out = []
for p in products:
    if not any(c['slug'] == 'door' for c in p.get('categories', [])) and p['slug'] not in cats:
        continue
    page = get(p['permalink']).decode('utf-8', 'replace')
    models = []
    for m in re.finditer(r'<input[^>]*name="door_pa_model"[^>]*>', page):
        tag = m.group(0)
        val = re.search(r'value="([^"]+)"', tag)
        img = re.search(r'data-img="([^"]+)"', tag)
        nm = re.search(r'data-pa_modelname="([^"]+)"', tag)
        if val and img:
            models.append({'code': val.group(1), 'img': html.unescape(img.group(1)), 'title': html.unescape(nm.group(1)) if nm else val.group(1)})
    paras = [text_of(x) for x in re.findall(r'<p>(.*?)</p>', p.get('short_description') or '', re.S)]
    styles = cats.get(p['slug']) or [STYLE[c['slug']] for c in p.get('categories', []) if c['slug'] in STYLE]
    main = (p.get('images') or [{}])[0].get('src')
    out.append({'slug': p['slug'], 'name': html.unescape(p['name']), 'url': p['permalink'], 'styles': styles, 'paras': [x for x in paras if x],
                'main': main, 'models': models})
    print(p['slug'], p['name'], len(models), styles)
    time.sleep(0.6)
io.open(os.path.join(OUT, 'lord.json'), 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1))
print('collections', len(out), 'models', sum(len(x['models']) for x in out))
