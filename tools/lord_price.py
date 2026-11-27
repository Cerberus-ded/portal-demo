# -*- coding: utf-8 -*-
# python -I lord_price.py <Бланк заказа LORD .xlsm> <web/lord/lord.json> <out web/lord/price.json> [date]
# What LORD's order form (the factory's corrected price list) says about the collections on the site, without a single price:
#   name    the collection's name in the price when it differs from the factory's website (Альт Ф, Эклипс, Тока...)
#   names   each model's name as the price spells it (Астория 1 rather than Astoria 1), the glass kept after "|"
#   gone    the site's models the price no longer lists: the build leaves them out of the catalogue
#   rows    how the door can be made: thickness and aluminium edge, edge colours, moulding, blank or glazed, made to a sketch
#   new     collections of the price the site does not have (the factory's website has no photos of them)
# Reads the workbook's values only, no macros run.
import io, json, re, sys, collections
import openpyxl
sys.stdout.reconfigure(encoding='utf-8')
BOOK, SITE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
DATE = sys.argv[4] if len(sys.argv) > 4 else ''
# the price's collection -> the site's collection (the factory's website slug)
MAP = {'Аванти': 'avavnti', 'Астория': 'astoria', 'Асти': 'asti', 'Альт Ф': 'altro', 'Альт МФ': 'altro-mf', 'Альт СФ': 'altro-sf',
       'Атриум': 'atrium', 'Атриум Л': 'atrium', 'Альфа': 'alfa', 'Баухаус': 'bauhaus', 'Бела': 'bella', 'Бриз': 'brezza', 'Корона': 'corona',
       'Ар-Деко': 'deco', 'Дольче': 'dolce', 'Эклипс': 'eclissi', 'Элегант': 'elegant', 'Фигура': 'figura', 'Футуризм': 'futuristic',
       'Италия': 'italy', 'Арт': 'italy-grafica', 'Ренессанс': 'renaissance', 'Стиль': 'style', 'Тока': 'tocco', 'Техно': 'techno',
       'Кантри Вилла': 'kantri-villa', 'Люми': 'lumi-linee', 'Милети': 'miletti', 'Модерн': 'modern', 'Мелфорд': 'melford',
       'Брио': 'novita-brio', 'Мария': 'novita-mia-maria', 'Фелиция': 'novita-felicia', 'Соло (Гладкое)': 'solo',
       'Пунта': 'punta', 'Муна': 'moon', 'Зенит': 'zenit', 'Арея': 'area', 'Рельеф': 'rilievo', 'Молле': 'molle'}
# the site's name stays where the price only abbreviates or joins collections
KEEP_NAME = {'atrium', 'solo', 'lumi-linee'}
LAT = str.maketrans({'A': 'А', 'K': 'К', 'M': 'М', 'C': 'С', 'B': 'В', 'E': 'Е', 'H': 'Н', 'O': 'О', 'P': 'Р', 'T': 'Т', 'X': 'Х'})


# the factory's website spells a few models in Latin
ALIAS = {'thalia': 'талия', 'velda': 'вельда'}


def base(name):
    # the model without blank/glazed, thickness and edge: "Астория 1 ПГ 38 мм" -> "Астория 1"; a Latin K in "K 1" made Cyrillic
    n = name.split('|')[0].strip()
    n = re.sub(r'(?<![A-Za-z])([AKMC])(?=\s?\d)', lambda m: m.group(1).translate(LAT), n)
    n = re.sub(r'\s+(ПГ|ПО|ДГ|ДО)\b.*$', '', n)
    n = re.sub(r'\s+\d+\s*мм.*$', '', n)
    return re.sub(r'\s+', ' ', n.replace('–', '-')).strip()


def ident(name):
    # the model's mark inside its collection: the number (1, 1.1, 1-1), R/U, with "Л" for Лайт and "N" for Новый
    n = base(re.sub(r'^Межкомнатная дверь\s+', '', name, flags=re.I)).replace('Лайт', 'Л')
    new = 'N' if re.search(r'нов', n, re.I) else ''
    m = re.search(r'(\d+(?:[.-]\d+)?)\s*(Л|SF|MF|F|СФ|МФ|Ф)?\s*$', n)
    if m:
        suf = (m.group(2) or '').replace('SF', 'СФ').replace('MF', 'МФ').replace('F', 'Ф')
        return new + m.group(1) + suf
    if re.search(r'\bZ\s*\d', n):
        return n
    m = re.search(r'\b([RU])\s*$', n)
    if m:
        return m.group(1)
    if new:
        return 'N1'
    if n.lower() in ALIAS:
        return ALIAS[n.lower()]
    return n.translate(LAT).lower()


wb = openpyxl.load_workbook(BOOK, data_only=True, read_only=True, keep_vba=False)
models = collections.OrderedDict()       # price collection -> ident -> price base name
groups = collections.defaultdict(list)   # price collection -> its variant groups
kinds = collections.defaultdict(set)     # price collection -> ПГ / ПО
sketch = set()
for r in list(wb['Номенклатура'].iter_rows(values_only=True))[1:]:
    if not r[0]:
        continue
    p = [x.strip() for x in str(r[0]).split(':')]
    if p[0] != 'Межкомнатные двери' or len(p) < 2:
        continue
    coll = re.sub(r'^Коллекция\s+', '', p[1]).strip()
    groups[coll].append(re.sub(r'\s+', ' ', ': '.join(p[2:])))
    for m in [x.strip() for x in str(r[1] or '').split(',') if x.strip()]:
        if 'эскиз' in m.lower():
            sketch.add(coll)
            continue
        k = re.search(r'\s(ПГ|ДГ|ПО|ДО)\b', m)
        if k:
            kinds[coll].add('глухое' if k.group(1) in ('ПГ', 'ДГ') else 'остеклённое')
        models.setdefault(coll, collections.OrderedDict()).setdefault(ident(m), base(m))

COL = {'Черный': 'чёрный', 'Матовый хром': 'матовый хром', 'Золото': 'золото', 'Шампань': 'шампань', 'Белый': 'белый',
       'RAL / NCS': 'по RAL или NCS', 'Бронза': 'бронза', 'Графит': 'графит'}


def rows_of(colls):
    # how the door can be made, from the names of the price's groups
    th = collections.OrderedDict(); edge = []; mould = []; reverse = False
    for c in colls:
        for g in groups[c]:
            t = re.search(r'(\d\d) мм', g)
            sides = re.search(r'с (\d)х сторон', g)
            if 'реверс' in g.lower():
                reverse = True
            if t and t.group(1) in ('42', '58') and sides:
                th.setdefault(t.group(1), set()).add(sides.group(1))
            elif t and t.group(1) == '38' or not t and 'реверс' not in g.lower():
                th.setdefault('38', set())
            for k, v in COL.items():
                if re.search(r'кромка[^,)]*' + re.escape(k), g) and v not in edge:
                    edge.append(v)
            mm = re.search(r'Молдинг - ([^),]+)', g)
            if mm and COL.get(mm.group(1).strip(), mm.group(1).strip().lower()) not in mould:
                mould.append(COL.get(mm.group(1).strip(), mm.group(1).strip().lower()))
    out = []
    made = []
    if '38' in th:
        made.append('38 мм, стандарт')
    for t in ('42', '58'):
        if t in th:
            s = sorted(th[t])
            made.append(t + ' мм с алюминиевой кромкой с ' + ' или '.join(s) + ' сторон')
    if reverse:
        made.append('56 мм, реверсивное открывание с четвертью')
    if len(made) > 1:
        out.append(['Исполнение', '; '.join(made)])
    if edge:
        out.append(['Цвет алюминиевой кромки', ', '.join(edge)])
    if mould:
        out.append(['Молдинг', ', '.join(mould)])
    k = set().union(*[kinds[c] for c in colls])
    if k:
        out.append(['Полотно', 'глухое и остеклённое' if len(k) > 1 else k.pop()])
    if any(c in sketch for c in colls):
        out.append(['По эскизу', 'дверь этой коллекции можно заказать по своему эскизу'])
    return out


site = json.load(io.open(SITE, encoding='utf-8'))
by_slug = collections.defaultdict(list)
for c in models:
    if c in MAP:
        by_slug[MAP[c]].append(c)
out = {'date': DATE, 'source': 'бланк заказа фабрики LORD, без цен', 'collections': {}, 'new': []}
for c in models:
    if c not in MAP and not c.startswith('Полотно по'):
        out['new'].append({'name': c, 'models': list(models[c].values())})
for sc in site:
    colls = by_slug.get(sc['slug'])
    if not colls:
        continue
    pm = collections.OrderedDict()
    for c in colls:
        for k, v in models[c].items():
            pm.setdefault(k, v)
    count = collections.Counter(pm.keys())
    names, gone = {}, []
    mlist = sc['models'] or [{'code': sc['slug'], 'title': sc['name']}]
    # a collection of one model (Соло) is the same door whatever the price calls it
    single = len(pm) == 1 and len({ident(m['title']) for m in mlist}) == 1
    # Люми: the price has four letters per number, one photo each on the site: the names stay
    ambiguous = sc['slug'] == 'lumi-linee'
    for m in mlist:
        k = ident(m['title'])
        if single:
            continue
        if k not in pm:
            gone.append(m['code'])
            continue
        if ambiguous:
            continue
        glass = m['title'].split('|', 1)[1].strip() if '|' in m['title'] else ''
        nm = pm[k] + (' | ' + glass if glass else '')
        if nm != re.sub(r'^Межкомнатная дверь\s+', '', m['title'], flags=re.I).strip():
            names[m['code']] = nm
    entry = {'rows': rows_of(colls)}
    pname = colls[0] if len(colls) == 1 else None
    if pname and sc['slug'] not in KEEP_NAME and pname != sc['name']:
        entry['name'] = pname
    if names:
        entry['names'] = names
    if gone:
        entry['gone'] = gone
    missing = [v for k, v in pm.items() if k not in {ident(m['title']) for m in mlist}]
    if missing and not single and not ambiguous:
        entry['no_photo'] = missing
    out['collections'][sc['slug']] = entry
io.open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, indent=1))
for slug, e in out['collections'].items():
    print(slug, '|', e.get('name', ''), '| renamed', len(e.get('names', {})), '| gone', e.get('gone', []), '| no photo', e.get('no_photo', []), '|', [r[0] for r in e['rows']])
print('new in the price:', [(n['name'], len(n['models'])) for n in out['new']])
