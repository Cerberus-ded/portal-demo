# torex_price.py — базовая комплектация и опции серий Торекс из розничных прайсов фабрики (xlsx), БЕЗ ЦЕН.
#
#   python -I tools/torex_price.py <проект> <прайс.xlsx> <лист=серия> [<лист=серия> ...]
#
# Прайс — чужой файл: читаем его как zip с XML, ничего из него не запускаем.
# По каждому листу серии пишет web/torex/kit/<серия>.json и картинки web/torex/kit/<серия>/<n>.webp:
#   specs  — таблица «Базовая комплектация» (группы и строки), без столбца с ценами;
#   models — исполнения (МР — снаружи металл, РР — снаружи панель);
#   device — разрезы двери и короба (картинки без выносок);
#   base   — блоки базовой комплектации: заголовок из прайса и картинки;
#   opts   — опции: номера, тексты строк прайса (без цен), картинки с этими номерами;
#   more   — опции без картинок (порог, третья петля, размеры…).
# Сборные картинки фабрики («двери в ряд, подписи под ними») режутся на плитки tools/kit_slice.py,
# остальные идут целиком. Подписи, лежащие в прайсе отдельными надписями, кладём в cap плитки.
import io, json, os, re, sys, zipfile
import xml.etree.ElementTree as ET
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit_slice

M = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
X = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'
A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
NS = {'m': M, 'r': R, 'x': X, 'a': A}
EMU_PX, EMU_PT = 9525, 12700


def col_n(c):
    n = 0
    for ch in c:
        n = n * 26 + ord(ch) - 64
    return n


class Book:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.ss = []
        if 'xl/sharedStrings.xml' in self.z.namelist():
            for si in ET.fromstring(self.z.read('xl/sharedStrings.xml')).findall('m:si', NS):
                self.ss.append(''.join(t.text or '' for t in si.iter('{%s}t' % M)))
        wb = ET.fromstring(self.z.read('xl/workbook.xml'))
        rm = {r.get('Id'): r.get('Target') for r in ET.fromstring(self.z.read('xl/_rels/workbook.xml.rels'))}
        self.sheets = {s.get('name'): 'xl/' + rm[s.get('{%s}id' % R)].lstrip('/').replace('xl/', '') for s in wb.find('m:sheets', NS)}

    def sheet(self, name):
        return Sheet(self, self.sheets[name])


class Sheet:
    def __init__(self, book, path):
        z = book.z
        sh = ET.fromstring(z.read(path))
        self.cells = {}
        for c in sh.iter('{%s}c' % M):
            v = c.find('m:v', NS); t = c.get('t'); txt = None
            if t == 's' and v is not None: txt = book.ss[int(v.text)]
            elif t == 'inlineStr': txt = ''.join(x.text or '' for x in c.iter('{%s}t' % M))
            elif v is not None: txt = v.text
            if txt is None or not str(txt).strip(): continue
            m = re.match(r'([A-Z]+)(\d+)', c.get('r'))
            self.cells[(int(m.group(2)), col_n(m.group(1)))] = str(txt).strip()
        # размеры столбцов и строк, чтобы знать, где лежат картинки и надписи
        fmt = sh.find('m:sheetFormatPr', NS)
        dcw = float(fmt.get('defaultColWidth') or (float(fmt.get('baseColWidth') or 8) + 0.71)) if fmt is not None else 8.43
        self.drh = float(fmt.get('defaultRowHeight') or 15) if fmt is not None else 15
        self.colw = {}
        cols = sh.find('m:cols', NS)
        if cols is not None:
            for c in cols:
                for i in range(int(c.get('min')), int(c.get('max')) + 1):
                    self.colw[i] = float(c.get('width'))
        self.dcw = dcw
        self.rowh = {}
        for r in sh.iter('{%s}row' % M):
            if r.get('ht'): self.rowh[int(r.get('r'))] = float(r.get('ht'))
        self.pics, self.shapes = [], []
        rel = 'xl/worksheets/_rels/' + path.split('/')[-1] + '.rels'
        if rel not in z.namelist(): return
        for r in ET.fromstring(z.read(rel)):
            if 'drawing' not in r.get('Type'): continue
            dp = 'xl/drawings/' + r.get('Target').split('/')[-1]
            drel = {x.get('Id'): x.get('Target') for x in ET.fromstring(z.read('xl/drawings/_rels/' + dp.split('/')[-1] + '.rels'))}
            for anc in ET.fromstring(z.read(dp)):
                box = self.anchor_box(anc)
                if box is None: continue
                self.walk(anc, box, drel, z)

    # столбец (с 1) и смещение → EMU от левого края листа
    def xpos(self, col, off):
        px = 0
        for c in range(1, col):
            w = self.colw.get(c, self.dcw)
            px += int((256 * w + int(128 / 7)) / 256 * 7)
        return px * EMU_PX + off

    def ypos(self, row, off):
        pt = sum(self.rowh.get(r, self.drh) for r in range(1, row))
        return pt * EMU_PT + off

    def anchor_box(self, anc):
        fr = anc.find('x:from', NS)
        if fr is None: return None
        def pt(e):
            c = int(e.find('x:col', NS).text) + 1; co = int(e.find('x:colOff', NS).text)
            rr = int(e.find('x:row', NS).text) + 1; ro = int(e.find('x:rowOff', NS).text)
            return c, co, rr, ro
        c0, co0, r0, ro0 = pt(fr)
        x0, y0 = self.xpos(c0, co0), self.ypos(r0, ro0)
        to = anc.find('x:to', NS)
        if to is not None:
            c1, co1, r1, ro1 = pt(to)
            x1, y1 = self.xpos(c1, co1), self.ypos(r1, ro1)
        else:
            ext = anc.find('x:ext', NS)
            x1 = x0 + int(ext.get('cx')) if ext is not None else x0
            y1 = y0 + int(ext.get('cy')) if ext is not None else y0
            r1 = r0
        return {'row': r0, 'row2': r1, 'col': c0, 'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1}

    # картинки и надписи; в группе (grpSp) у каждого элемента своё место внутри рамки группы
    def walk(self, node, box, drel, z, tf=None):
        for ch in list(node):
            tag = ch.tag.split('}')[1]
            if tag == 'grpSp':
                g = ch.find('x:grpSpPr/a:xfrm', NS)
                sub = None
                if g is not None and g.find('a:off', NS) is not None and g.find('a:chOff', NS) is not None:
                    off, ext = g.find('a:off', NS), g.find('a:ext', NS)
                    co, ce = g.find('a:chOff', NS), g.find('a:chExt', NS)
                    sub = (int(off.get('x')), int(off.get('y')), int(ext.get('cx')), int(ext.get('cy')),
                           int(co.get('x')), int(co.get('y')), int(ce.get('cx')) or 1, int(ce.get('cy')) or 1)
                self.walk(ch, box, drel, z, (tf, sub))
            elif tag in ('pic', 'sp'):
                b = self.child_box(ch, box, tf)
                if tag == 'pic':
                    bl = ch.find('.//a:blip', NS)
                    if bl is None: continue
                    tgt = drel.get(bl.get('{%s}embed' % R), '').split('/')[-1]
                    if not tgt.lower().endswith(('.png', '.jpg', '.jpeg')): continue
                    sr = ch.find('.//a:srcRect', NS)
                    crop = {k: int(sr.get(k) or 0) for k in 'ltrb'} if sr is not None else None
                    nv = ch.find('x:nvPicPr/x:cNvPr', NS)
                    self.pics.append(dict(b, media=tgt, crop=crop, name=nv.get('name') if nv is not None else ''))
                else:
                    tx = ' '.join(''.join(t.text or '' for t in p.iter('{%s}t' % A)) for p in ch.iter('{%s}p' % A)).strip()
                    tx = re.sub(r'\s+', ' ', tx)
                    if tx: self.shapes.append(dict(b, text=tx))

    def child_box(self, el, box, tf):
        # без группы — рамка якоря; в группе — переводим координаты потомка в координаты листа
        xf = el.find('.//a:xfrm', NS)
        if tf is None or xf is None or xf.find('a:off', NS) is None:
            return dict(box)
        x, y = int(xf.find('a:off', NS).get('x')), int(xf.find('a:off', NS).get('y'))
        cx, cy = int(xf.find('a:ext', NS).get('cx')), int(xf.find('a:ext', NS).get('cy'))
        chain = []
        t = tf
        while t is not None:
            chain.append(t[1]); t = t[0]
        for g in chain:  # от ближней группы к дальней
            if g is None: continue
            ox, oy, ex, ey, cox, coy, cex, cey = g
            sx, sy = ex / cex, ey / cey
            x, y, cx, cy = ox + (x - cox) * sx, oy + (y - coy) * sy, cx * sx, cy * sy
        # off группы верхнего уровня задан в координатах листа (EMU)
        b = dict(box)
        b.update(x0=x, y0=y, x1=x + cx, y1=y + cy)
        return b


# строки прайса «Доплата за …» стоят в винительном падеже: переводим в именительный, где он отличается
NOMINATIVE = [
    (r'^замену базовой ручки на ручку (.+)$', r'ручка \1 вместо базовой'),
    (r'^замену базовых замков на (.+)$', r'\1 вместо базовых замков'),
    (r'^замену (.+?) на (.+)$', r'\2 вместо \1'),
    (r'^броненакладку круглую', 'броненакладка круглая'), (r'^броненакладку', 'броненакладка'), (r'^третью петлю', 'третья петля'),
    (r'^ширину', 'ширина'), (r'^высоту', 'высота'), (r'^ручку', 'ручка'),
    (r'^изготовление двери без дополнительного замка', 'дверь без дополнительного замка'),
    (r'^комбинированный тип монтажа', 'комбинированный монтаж'), (r'^тип монтажа: ', 'монтаж '),
]


def clean_opt(t):
    t = re.sub(r'\s+', ' ', t).strip()
    t = re.sub(r'^(Доплата за|Доплата|Скидка за)\s+', '', t, flags=re.I)
    t = re.sub(r'\bцвет цвет\b', 'цвет', t)
    t = re.sub(r'\s*(ВНИМАНИЕ|Внимание)!+.*$', '', t)
    t = re.sub(r'\s*\*+\s*$', '', t)
    t = re.sub(r'\.\s*(В других|При ширине).*$', '', t)
    t = t.replace('МОЛДИНГОМ', 'молдингом')
    t = re.sub(r',?\s*(с базовым покрытием|в базовом покрытии) ПВХ', '', t)
    t = re.sub(r'\s+', ' ', t).strip(' .;:')
    low = t[:1].lower() + t[1:]
    for a, b in NOMINATIVE:
        if re.search(a, low):
            low = re.sub(a, b, low); break
    t = low
    return t[:1].upper() + t[1:]


# «… (снаружи)» и «… (внутри)» с одинаковым началом — одна строка «… (снаружи и внутри)»
def merge_sides(texts):
    out = []
    for t in texts:
        m = re.match(r'^(.*)\((снаружи|внутри)\)$', t)
        if m and out:
            p = re.match(r'^(.*)\((снаружи|внутри)\)$', out[-1])
            if p and p.group(1).strip() == m.group(1).strip() and p.group(2) != m.group(2):
                out[-1] = m.group(1).strip() + ' (снаружи и внутри)'
                continue
        out.append(t)
    return out


# «Толщина полотна MM/MP/PP, мм: -/74/84» → «Толщина полотна, мм: МР 74, РР 84»
def spec_row(k, v):
    k = k.strip().rstrip(':').strip()
    m = re.match(r'^(.*?)\s*(MM/MP/PP|ММ/МР/РР|MP/PP|МР/РР)\s*(,.*)?$', k)
    if m and v:
        names = [x.replace('M', 'М').replace('P', 'Р') for x in m.group(2).split('/')]
        vals = [x.strip() for x in v.split('/')]
        if len(vals) == len(names):
            v = ', '.join(n + ' ' + x for n, x in zip(names, vals) if x and x != '-')
            k = m.group(1) + (m.group(3) or '')
    if v:
        v = re.sub(r'\s+', ' ', v).strip()
        v = re.sub(r'^(\d+)\.(\d+)$', r'\1,\2', v)
    return [k, v]


def find_rows(sh, pat):
    return sorted(r for (r, c), v in sh.cells.items() if re.search(pat, v))


def save_img(book, p, out, name):
    data = book.z.read('xl/media/' + p['media'])
    im = Image.open(io.BytesIO(data)); im.load()
    if p['crop'] and any(p['crop'].values()):
        W, H = im.size; g = lambda k: p['crop'][k] / 100000
        im = im.crop((int(W * g('l')), int(H * g('t')), int(W * (1 - g('r'))), int(H * (1 - g('b')))))
    if im.mode in ('P', 'LA', 'RGBA'):
        im = im.convert('RGBA')
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.alpha_composite(im); im = bg
    im = im.convert('RGB')
    return im


def emit(im, out, rel, n, cap=None):
    # одна картинка → одна плитка webp; ширина и высота нужны странице, чтобы не прыгала вёрстка
    fn = '%02d.webp' % n
    im.save(os.path.join(out, fn), 'WEBP', quality=88, method=6)
    t = {'img': rel + '/' + fn, 'w': im.width, 'h': im.height}
    if cap: t['cap'] = cap
    return t


def series(book, sheet_name, slug, root):
    sh = book.sheet(sheet_name)
    out = os.path.join(root, 'web/torex/kit', slug)
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        if f.endswith('.webp'): os.remove(os.path.join(out, f))
    rel = 'web/torex/kit/' + slug
    base_rows = find_rows(sh, r'^БАЗОВАЯ')
    opt_rows = find_rows(sh, r'^ОПЦИИ')
    end_rows = find_rows(sh, r'^Расч[её]т цены')
    r_spec0 = base_rows[0]
    r_base = max(r for r in base_rows if r < opt_rows[0])
    r_opt = opt_rows[0]
    r_end = end_rows[0] if end_rows else 10 ** 6

    # 1. характеристики: в столбцах F и G между первым «БАЗОВАЯ» и вторым
    specs = []
    notes = []
    for r in range(r_spec0 + 1, r_base):
        k = sh.cells.get((r, 6)); v = sh.cells.get((r, 7))
        for x in (k, v):
            if x and x.strip().startswith('*'): notes.append(re.sub(r'\s+', ' ', x.strip()))
        if k and k.strip().startswith('*'): continue
        # «Стеклопакет» и на второй строке сноска «*** справочный размер…» без значения: сноску не берём
        if k and '\n' in k: k = k.split('\n')[0]
        if v and v.strip().startswith('*'): v = None
        if k and v:
            if v.strip() in ('-', '—', '–'): continue
            specs.append(spec_row(k, v))
        elif k and not re.search(r',|дБ|мм|кг|шумоизоляц', k):
            specs.append([k.strip().rstrip(':'), None])   # группа: «Полотно», «Короб»
    specs = [s for s in specs if s[0] != 'Модель']
    # группа без строк под ней не нужна
    specs = [s for i, s in enumerate(specs) if s[1] is not None or (i + 1 < len(specs) and specs[i + 1][1] is not None)]
    note = notes[0] if notes else None

    # 2. исполнения
    models = []
    for r in range(r_base + 1, r_opt):
        v = sh.cells.get((r, 1))
        if v and re.search(r'\b(M[MРP]|М[МРP]|[PР][PР])\s*$', v.replace('Р', 'P').replace('М', 'M')) and v != 'Модель':
            models.append(v)

    # 3. опции: строки «N.» в столбце A и текст в B; подзаголовки «Опции | …»
    opts = {}
    cats = []
    for (r, c), v in sorted(sh.cells.items()):
        if r <= r_opt or r >= r_end: continue
        if c == 1 and re.match(r'^\d+\.$', v):
            t = sh.cells.get((r, 2), '')
            if t: opts[int(v[:-1])] = {'row': r, 'text': clean_opt(t), 'raw': re.sub(r'\s+', ' ', t)}
        if c == 1 and v.startswith('Опции'):
            cats.append((r, v.split('|', 1)[-1].strip()))

    # подписи-номера на картинках опций: «5.», «9-10.», «3-4. Коллекция ПВХ», «6, 7.»
    def nums_of(t):
        m = re.match(r'^\s*(\d+(?:\s*[-–,]\s*\d+)*)\s*\.?\s*(.*)$', t)
        if not m or not re.match(r'^\d', t.strip()): return None, None
        ns = set()
        for part in re.split(r'\s*,\s*', m.group(1)):
            ab = re.split(r'\s*[-–]\s*', part)
            if len(ab) == 2: ns.update(range(int(ab[0]), int(ab[1]) + 1))
            else: ns.add(int(ab[0]))
        return sorted(ns), m.group(2).strip()

    def inside(s, p, pad=0):
        cx, cy = (s['x0'] + s['x1']) / 2, (s['y0'] + s['y1']) / 2
        return p['x0'] - pad <= cx <= p['x1'] + pad and p['y0'] - pad <= cy <= p['y1'] + pad

    pics = [p for p in sh.pics]
    # «скоро в продаже» — плашка поверх строк опций; логотип в шапке страниц и плашки не показываем
    soon = set()
    logo_media = {}
    for p in pics:
        logo_media[p['media']] = logo_media.get(p['media'], 0) + 1
    def is_logo(p):
        return logo_media[p['media']] >= 3 and (p['x1'] - p['x0']) > 4 * (p['y1'] - p['y0'])
    def is_badge(p):
        data = book.z.read('xl/media/' + p['media'])
        try:
            im = Image.open(io.BytesIO(data)).convert('RGB'); im.thumbnail((64, 64))
        except Exception:
            return False
        px = list(im.getdata())
        red = sum(1 for r, g, b in px if r > 170 and g < 90 and b < 90)
        return red > 0.25 * len(px)
    def tiny(p):
        try:
            w, h = Image.open(io.BytesIO(book.z.read('xl/media/' + p['media']))).size
        except Exception:
            return True
        return w < 24 or h < 24
    badges = [p for p in pics if is_badge(p)]
    def overlap(a, b):
        w = min(a['x1'], b['x1']) - max(a['x0'], b['x0']); h = min(a['y1'], b['y1']) - max(a['y0'], b['y0'])
        return max(0, w) * max(0, h)
    pics = [p for p in pics if not is_logo(p) and p not in badges and not tiny(p)]
    soon_pics = set()
    for b in badges:
        for p in pics:
            if overlap(b, p) > 0.3 * (b['x1'] - b['x0']) * (b['y1'] - b['y0']): soon_pics.add(id(p))

    # надписи: номера опций и подписи к картинкам
    labels = []  # (nums, rest, shape)
    caps = []
    for s in sh.shapes:
        ns, rest = nums_of(s['text'])
        if ns and s['row'] > r_opt and len(s['text']) < 60:
            labels.append((ns, rest, s))
        elif not ns and len(s['text']) < 40 and not re.search(r'ВНИМАНИЕ|Внимание', s['text']):
            caps.append(s)

    def dist(a, b):
        ax, ay = (a['x0'] + a['x1']) / 2, (a['y0'] + a['y1']) / 2
        bx, by = b['x0'], b['y0']
        # номер стоит слева сверху от своей картинки
        return abs(ax - bx) + abs(ay - by)

    n_img = [0]
    def tiles_of(p, cap_shapes):
        im = save_img(book, p, out, None)
        t = kit_slice.tiles(im)
        res = []
        if t and len(t) > 1:
            for (x0, y0, x1, y1) in t:
                n_img[0] += 1
                tt = emit(im.crop((x0, y0, x1, y1)), out, rel, n_img[0])
                tt['cut'] = 1   # плитка из сборной картинки: странице можно привести её к общему размеру
                res.append(tt)
        else:
            n_img[0] += 1
            cap = None
            if cap_shapes:
                cap = ', '.join(c['text'] for c in cap_shapes)
            im = kit_slice.trim(im)
            res.append(emit(im, out, rel, n_img[0], cap))
        return res

    # подпись-надпись принадлежит картинке, если лежит на ней или сразу под/рядом (не дальше 0,6 см)
    def caps_for(p):
        got = []
        for c in caps:
            cx, cy = (c['x0'] + c['x1']) / 2, (c['y0'] + c['y1']) / 2
            if p['x0'] - 2e5 <= cx <= p['x1'] + 2e5 and p['y0'] - 1e5 <= cy <= p['y1'] + 2.2e5:
                got.append(c)
        return got

    # маленькие картинки с подписью-надписью у каждой (образцы ПВХ в TAU PRO и т. п.): своя подпись у каждой
    def own_cap(p):
        best, bd = None, None
        for c in caps:
            cx, cy = (c['x0'] + c['x1']) / 2, (c['y0'] + c['y1']) / 2
            if p['x0'] - 1e5 <= cx <= p['x1'] + 1e5 and p['y1'] - 1e5 <= cy <= p['y1'] + 4e5:
                d = cy - p['y1']
                if bd is None or abs(d) < bd: best, bd = c, abs(d)
            elif p['y0'] <= cy <= p['y1'] and p['x1'] - 1e5 <= cx <= p['x1'] + 2.5e6:
                d = cx - p['x1']
                if bd is None or abs(d) < bd: best, bd = c, abs(d)
        return best

    # 4. разрез двери: картинки в таблице характеристик
    # разрезы стоят выше строки «Ручка» таблицы, фурнитура — рядом с ней и ниже
    r_handle = min([r for (r, c), v in sh.cells.items() if c == 6 and r_spec0 < r < r_base and re.match(r'^Ручка', v)] or [r_base])
    device, hw = [], []
    for p in sorted([p for p in pics if r_spec0 < p['row'] < r_base], key=lambda p: (p['y0'], p['x0'])):
        im = kit_slice.trim(save_img(book, p, out, None))
        if im.width < 60 or im.height < 60: continue
        n_img[0] += 1
        (device if p['row'] < r_handle - 1 else hw).append(emit(im, out, rel, n_img[0]))

    # 5. базовая комплектация: заголовки в A..J, картинки под ними
    heads = []
    for (r, c), v in sh.cells.items():
        if r_base < r < r_opt and c <= 10 and not re.search(r'^\d|ориентировочная|^Модель$', v) and v not in models and not re.match(r'^-?[\d.]+$', v):
            heads.append((r, c, v))
    used = set()
    base = []
    bpics = sorted([p for p in pics if r_base < p['row'] < r_opt], key=lambda p: (p['row'], p['col'], p['y0'], p['x0']))
    groups = {}
    for p in bpics:
        cand = [h for h in heads if h[0] <= p['row'] + 1]
        if not cand: continue
        top = max(h[0] for h in cand)
        same = [h for h in cand if h[0] == top]
        # в одной строке два заголовка (A и F): берём тот, что ближе слева
        h = max([h for h in same if h[1] <= p['col'] + 1] or same, key=lambda h: h[1])
        groups.setdefault(h, []).append(p)
    for h in sorted(groups, key=lambda h: (h[0], h[1])):
        ps = groups[h]
        items = []
        small = [p for p in ps if (p['x1'] - p['x0']) < 1.2e6 and (p['y1'] - p['y0']) < 1.2e6]
        for p in ps:
            if p in small and len(small) > 2:
                c = own_cap(p)
                im = kit_slice.trim(save_img(book, p, out, None))
                n_img[0] += 1
                t = emit(im, out, rel, n_img[0], c['text'] if c else None)
                t['sw'] = 1
                items.append(t)
            else:
                items += tiles_of(p, caps_for(p))
        base.append({'title': h[2], 'items': items})

    # 6. опции с картинками
    opics = sorted([p for p in pics if r_opt < p['row'] < r_end], key=lambda p: (p['row'], p['col'], p['y0'], p['x0']))
    owner = {}
    for ns, rest, s in labels:
        cand = [p for p in opics if inside(s, p, 3e5) or (p['y0'] - 4e5 <= (s['y0'] + s['y1']) / 2 <= p['y1'] and p['x0'] - 1.2e6 <= (s['x0'] + s['x1']) / 2 <= p['x1'])]
        if not cand: continue
        p = min(cand, key=lambda p: dist(s, p))
        owner.setdefault(id(p), []).append((ns, rest))
    out_opts = []
    last = None
    for p in opics:
        lab = owner.get(id(p))
        if lab:
            ns = sorted({n for l in lab for n in l[0]})
            names = [l[1] for l in lab if l[1]]
            grp = {'nums': ns, 'name': '; '.join(names) or None, 'items': []}
            out_opts.append(grp); last = grp
        elif last is not None and p['row'] <= last.get('_row2', p['row']) + 2:
            grp = last
        else:
            grp = {'nums': [], 'name': None, 'items': []}
            out_opts.append(grp); last = grp
        grp['_row2'] = max(grp.get('_row2', 0), p['row2'])
        if id(p) in soon_pics: grp['soon'] = True
        cs = caps_for(p)
        grp['items'] += tiles_of(p, cs)
    pictured = set()
    for g in out_opts:
        g.pop('_row2', None)
        g['texts'] = merge_sides([opts[n]['text'] for n in g['nums'] if n in opts])
        g['soon'] = bool(g.get('soon'))
        pictured.update(g['nums'])
    more = [{'n': n, 'text': o['text']} for n, o in sorted(opts.items()) if n not in pictured]
    cat_of = {}
    for n, o in opts.items():
        cc = [c for c in cats if c[0] < o['row']]
        cat_of[n] = cc[-1][1] if cc else ''
    for g in out_opts:
        g['cat'] = cat_of.get(g['nums'][0], '') if g['nums'] else ''
    for m in more:
        m['cat'] = cat_of.get(m['n'], '')
    res = {'sheet': sheet_name, 'specs': specs, 'note': note, 'notes': notes, 'models': models, 'device': device, 'hw': hw,
           'base': base, 'opts': out_opts, 'more': more}
    with open(os.path.join(root, 'web/torex/kit', slug + '.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    return res


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    root, xlsx = sys.argv[1], sys.argv[2]
    book = Book(xlsx)
    for arg in sys.argv[3:]:
        sheet, slug = arg.rsplit('=', 1)
        r = series(book, sheet, slug, root)
        print(slug, '| specs', len(r['specs']), '| models', r['models'], '| device', len(r['device']), '| hw', len(r['hw']),
              '| base', [(b['title'][:30], len(b['items'])) for b in r['base']],
              '| opts', [(g['nums'], len(g['items'])) for g in r['opts']], '| more', [m['n'] for m in r['more']])
