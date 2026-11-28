# -*- coding: utf-8 -*-
# python -I build_demo31.py <site31 dir> <glavnaya31.src.html> <out dir>   (run from the project folder)
# The client demo as a plain static site (GitHub Pages): index.html is the homepage, katalog.html the catalogue.
# Orders, the manager's screen and the admin screen work against PortalDemo, a store in the visitor's own browser.
import io, os, re, shutil, sys

SITE, HOME, OUT = sys.argv[1], sys.argv[2], sys.argv[3]


# OUT is deleted whole before writing: never the project, a folder above it, the build it reads, one of the project's
# source folders or a folder inside one, nor any folder that holds sources or git (the door photos in web/ exist only
# on the owner's computer)
def within(a, b):
    a, b = os.path.normcase(os.path.realpath(a)), os.path.normcase(os.path.realpath(b))
    return a == b or a.startswith(b.rstrip(os.sep) + os.sep)


KEEP = ('r31', 'src31', 'web', 'tools', 'photos', '.git')
if (any(within(p, OUT) for p in ('.', SITE, HOME))
        or any(within(OUT, d) for d in KEEP)
        or any(os.path.exists(os.path.join(OUT, d)) for d in ('r31', 'src31', 'web', '.git'))):
    sys.exit('will not delete %s: it is the project, holds it or the build, or is part of it; '
             'give the demo a folder of its own, e.g. _build/demo' % OUT)

CAT = 'https://claude.ai/artifact/MTMYB5MvJyFsLYuVuPdNih'
R = lambda p: io.open(p, encoding='utf-8').read()

shim = R('src31/demo.js')
LINE = ('Демо-версия сайта салона «Портал». Попробуйте его и как покупатель, и как салон: оставьте заявку и откройте «Заявки менеджеру», '
        'добавьте акцию, работу или коллекцию в «Админке». Всё сохраняется только в этом браузере и никуда не отправляется.')
RESET = '<button type="button" class="protolink" data-demo-reset>Начать демо заново</button>'
ICON = ('<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E'
        '%3Crect width=%2232%22 height=%2232%22 rx=%224%22 fill=%22%231d1611%22/%3E%3Ctext x=%2216%22 y=%2223%22 font-family=%22Georgia,serif%22 '
        'font-size=%2220%22 fill=%22%23f1ece4%22 text-anchor=%22middle%22%3E%D0%9F%3C/text%3E%3C/svg%3E">')
EXTRA = '''<style>
button.protolink { background: transparent; font: inherit; font-size: var(--text-sm); font-weight: 600; cursor: pointer; }
button.protolink:hover { background: var(--color-ink); color: var(--color-paper); }
[data-demo-reset][data-armed] { background: var(--color-bad); border-color: var(--color-bad); color: var(--color-paper); }
.order--done .order__demo { font-size: var(--text-sm); padding: var(--space-sm) var(--space-md); background: var(--color-paper-2); border-left: 3px solid var(--color-accent); max-width: 70ch; }
</style>
'''

def page(src):
    i = src.index('<div class="protobar">')
    head, body = src[:i], src[i:]
    head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
    top = ('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
           '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
           '<meta name="robots" content="noindex, nofollow">\n' + ICON + '\n')
    return top + head + EXTRA + '</head>\n<body>\n<script>\n' + shim + '</script>\n' + body + '\n</body>\n</html>\n'

def bar(s, links, what):
    s2, n = re.subn(r'<p class="modeline">[^<]*</p>', '<p class="modeline">' + LINE + '</p>', s, count=1)
    if n != 1:
        sys.exit(what + ': no modeline')
    j = s2.index('</p>', s2.index('<p class="modeline">')) + 4
    k = s2.index('  </div>\n</div>', j)
    return s2[:j] + s2[j:k] + links + '\n' + s2[k:]

# ---- the catalogue ----
cat = R(os.path.join(SITE, 'index.html')).replace('glavnaya.html', 'index.html')
cat, n = re.subn(r'\s*<a [^>]*data-owner[^>]*>[^<]*</a>', '', cat)
cat = page(bar(cat, '    ' + RESET, 'catalogue'))

# ---- the homepage: two photo sizes, links into katalog.html in the same tab ----
home = R(HOME).replace(CAT, 'katalog.html')
home, m = re.subn(r'\s*<a [^>]*data-owner[^>]*>[^<]*</a>', '', home)
home, m2 = re.subn(r'\s*<p data-owner[^>]*>.*?</p>', '', home)
home = page(bar(home, '    <a class="protolink" href="katalog.html#zayavki">Заявки менеджеру</a>\n    ' + RESET, 'homepage'))
if 'claude.ai' in home or 'claude.ai' in cat:
    sys.exit('a claude.ai address is left: ' + ('home' if 'claude.ai' in home else 'catalogue'))

if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT)
io.open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8', newline='\n').write(home)
io.open(os.path.join(OUT, 'katalog.html'), 'w', encoding='utf-8', newline='\n').write(cat)

# ---- what the pages load: the door packs, the search data, the homepage photos in both sizes ----
# every factory folder of the build (the one with a covers.json)
for fab in sorted(d for d in os.listdir(SITE) if os.path.isfile(os.path.join(SITE, d, 'covers.json'))):
    shutil.copytree(os.path.join(SITE, fab), os.path.join(OUT, fab))
os.makedirs(os.path.join(OUT, 'x1'))
shutil.copyfile(os.path.join(SITE, 'x1', 'seek.json'), os.path.join(OUT, 'x1', 'seek.json'))
used = set(re.findall(r'photos/(k-[a-z-]+-\d+\.webp)', home))
os.makedirs(os.path.join(OUT, 'photos'))
for f in sorted(used):
    shutil.copyfile(os.path.join('photos', f), os.path.join(OUT, 'photos', f))
io.open(os.path.join(OUT, '.nojekyll'), 'w').write('')
# README.md, CLAUDE.md and .claude/ live in the repository itself: the build does not write them
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
print('demo files', sum(len(fs) for _, _, fs in os.walk(OUT)), 'MB', round(size / 1e6, 1), 'photos', len(used), 'owner links removed', n, m + m2)
