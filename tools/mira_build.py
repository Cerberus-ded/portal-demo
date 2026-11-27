# -*- coding: utf-8 -*-
# python -I mira_build.py <project dir> <good doors images dir> <adema tiles dir>
# Two suppliers that come as PDF catalogues, not sites:
#   web/raznye/raznye.json  «Разные производители»: the Лайн series of «Хорошие двери» (CPL, anti-vandal), one door per page
#                           of «Хорошие двери_2026.pdf», cut out by tools/pdf_images.py (pages 4-27, the ~713x1527 picture)
#   web/adema/adema.json    ADEMA interior doors from «Каталог 2026 NEW.pdf» of «Двери мира» (pages 31-35), cut out of the
#                           rendered pages by tools/pdf_pages.mjs (scale 3.7) and tools/pdf_tiles.py, in reading order
# The names are typed from the pages (the PDFs keep their text as outlines). img points at the local picture.
import glob, io, json, os, re, sys

ROOT, GOOD, ADEMA = sys.argv[1:4]

LINE = [  # page, article, colour
    (4, 'ДП 01-1', 'Белый'), (5, 'ДП 01-2', 'Серый'), (6, 'ДП 02-1', 'Белый / Дуб Каньон Саммер медовый'),
    (7, 'ДП 02-2', 'Матера светлая'), (8, 'ДП 02-3', 'Матера светлая / Матера тёмная'), (9, 'ДП 02-4', 'Дуб Каньон Саммер медовый'),
    (10, 'ДП 03-1', 'Белый / Дуб Каньон Саммер'), (11, 'ДП 03-2', 'Дуб Каньон Саммер'), (12, 'ДП 03-3', 'Белый / Дуб Кварцевый'),
    (13, 'ДП 03-4', 'Дуб Кварцевый'), (14, 'ДП 04', 'Белый / Дуб Жемчужный'), (15, 'ДП 05-2', 'Белый / Дуб Жемчужный'),
    (16, 'ДП 05-3', 'Дуб Жемчужный'), (17, 'ДП 06-1', 'Белый / Дуб Кобург'), (18, 'ДП 06-2', 'Дуб Кобург'),
    (19, 'ДМ 01', 'Белый'), (20, 'ДМ 02', 'Серый'), (21, 'ДМ 03', 'Дуб Жемчужный'), (22, 'ДМ 04', 'Дуб Кобург'),
    (23, 'ДМ 05', 'Дуб Кварцевый'), (24, 'ДМ 06', 'Дуб Каньон Саммер медовый'), (25, 'ДМ 07', 'Дуб Каньон Саммер'),
    (26, 'ДМ 08', 'Матера светлая'), (27, 'ДМ 09', 'Матера тёмная')]


def door_of(page):
    # the door is the tall picture about 713 wide; the others are interiors and a floor reflection
    best = None
    for f in glob.glob(os.path.join(GOOD, 'p%02d-*.png' % page)):
        w, h = [int(x) for x in re.search(r'-(\d+)x(\d+)\.png$', f).groups()]
        if w >= 690 and h >= 1450 and (best is None or h > best[1]):
            best = (f, h)
    if not best:
        sys.exit('no door picture on page %d' % page)
    return best[0]


def code_of(s):
    t = {'Д': 'd', 'П': 'p', 'М': 'm'}
    return ''.join(t.get(ch, ch) for ch in s).lower().replace(' ', '-')


line = {
    'slug': 'layn', 'name': 'Лайн', 'url': '', 'styles': [], 'coat': ['CPL антивандальное'],
    'about': ('Межкомнатные двери «Хорошие двери» с антивандальным покрытием CPL: это пластик из нескольких слоёв крафт-бумаги, '
              'пропитанных смолами и спрессованных под высоким давлением. Он не боится царапин, ударов, влаги и бытовой химии, '
              'поэтому двери подходят для ванной, кухни, гардеробной, прихожей, для дома с детьми и животными и для офиса. '
              'Серия ДП с декоративной вставкой и ручкой-накладкой, серия ДМ гладкая. В каталоге «Двери мира» модели ДП называются '
              '«Лайн» с тем же номером.'),
    'specs': [['Основа', 'МДФ'], ['Покрытие', 'CPL, антивандальное'],
              ['Размеры полотна', '600×2000, 700×2000, 800×2000, 900×2000 мм']],
    'models': [{'code': 'layn-' + code_of(a), 'title': a + ' · ' + c, 'img': door_of(p)} for p, a, c in LINE]}
io.open(os.path.join(ROOT, 'web', 'raznye', 'raznye.json'), 'w', encoding='utf-8').write(json.dumps([line], ensure_ascii=False, indent=1))

# ADEMA, tile by tile as the catalogue shows them
TILES = [
    ('vega', 'Вега-3 · Оазис'), ('vega', 'Вега-2 · Меджик меркури'), ('vega', 'Вега-5 · Меджик дюна'),
    ('vega', 'Вега-5 · Меджик фреско'), ('vega', 'Вега-6 · Меджик тоффи'), ('parallel', 'Параллель · Астана табак'),
    ('legend', 'Легенд · Дюна норд / Дюна солано'), ('madrid', 'Мадрид · Арктик'), ('akcent', 'Акцент 2 · Арктик'),
    ('sonata', 'Соната · Эмалит белый'), ('241', '241 · Арктик'), ('241', '241 · Смоки'),
    ('ermitazh', 'Эрмитаж-2 · Арктик'), ('ermitazh', 'Эрмитаж-2 · Смоки'),
    ('royal', 'Роял · Суфле'), ('royal', 'Роял · Эмалит белый'), ('royal', 'Роял 2 · Эмалит белый'),
    ('favorit', 'Фаворит · Эмалит белый'), ('malta', 'Мальта · Эмалит белый'), ('vektor', 'Вектор · Эмалит белый'),
    ('novella', 'Новелла · Эмалит белый'), ('novella', 'Новелла · Эмалит серый'),
    ('layt', 'Лайт 1 · Эмалит белый'), ('layt', 'Лайт 4 · Пацифик'), ('layt', 'Лайт 5 · Бетон снежный'),
    ('layt', 'Лайт 3 · Арктик'),
    ('adema', 'Адема 1 · Белый бланко, чёрное стекло'), ('adema', 'Адема 1 · Эшвайт, чёрное стекло'),
    ('adema', 'Адема 1 · Белёный дуб, чёрное стекло'), ('adema', 'Адема 1 · Грей, чёрное стекло'),
    ('adema', 'Адема 1 · Неаполь, чёрное стекло'), ('adema', 'Адема 1 · Венге, чёрное стекло'),
    ('adema', 'Адема 1 · Орех, чёрное стекло'), ('adema', 'Адема 1 · Белый бланко, матовое стекло'),
    ('adema', 'Адема 1 · Эшвайт, матовое стекло'), ('adema', 'Адема 1 · Белёный дуб, матовое стекло'),
    ('adema', 'Адема 26 · Бетон бежевый, чёрное стекло'), ('adema', 'Адема 28 · Санторини белый, чёрное стекло'),
    ('adema', 'Адема 30 · Бетон снежный, стекло графит'), ('adema', 'Адема 31 · Ривьера айс, чёрное стекло'),
    ('adema', 'Адема 31 · Эшвайт, чёрное стекло'), ('adema', 'Адема 32 · Ривьера айс, стекло графит'),
    ('adema', 'Адема 33 · Бетон снежный, чёрное стекло')]
NAMES = {'vega': 'Вега', 'parallel': 'Параллель', 'legend': 'Легенд', 'madrid': 'Мадрид', 'akcent': 'Акцент', 'sonata': 'Соната',
         '241': '241', 'ermitazh': 'Эрмитаж', 'royal': 'Роял', 'favorit': 'Фаворит', 'malta': 'Мальта', 'vektor': 'Вектор',
         'novella': 'Новелла', 'layt': 'Лайт', 'adema': 'Адема'}
files = []
for pfx in ('p31', 'p32', 'p33', 'p34', 'p35a', 'p35b'):
    files += sorted(glob.glob(os.path.join(ADEMA, pfx + '-*.png')))
if len(files) != len(TILES):
    sys.exit('tiles %d, names %d' % (len(files), len(TILES)))
colls, order = {}, []
for f, (slug, title) in zip(files, TILES):
    if slug not in colls:
        colls[slug] = {'slug': slug, 'name': NAMES[slug], 'url': '', 'styles': [], 'coat': [],
                       'about': 'Межкомнатные двери ADEMA из каталога «Двери мира» 2026. Отделку, стекло, размеры и комплектацию уточняйте у менеджера.',
                       'specs': [], 'models': []}
        order.append(slug)
    n = len(colls[slug]['models']) + 1
    colls[slug]['models'].append({'code': 'adema-%s-%d' % (slug, n), 'title': title, 'img': f})
io.open(os.path.join(ROOT, 'web', 'adema', 'adema.json'), 'w', encoding='utf-8').write(
    json.dumps([colls[s] for s in order], ensure_ascii=False, indent=1))
print('Лайн', len(line['models']), 'models; ADEMA', len(order), 'collections', len(files), 'models')
