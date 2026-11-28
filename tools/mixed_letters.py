# -*- coding: utf-8 -*-
# python -I tools/mixed_letters.py [<project dir>]
# Слова, где смешаны русские и латинские буквы (латинская «C» в «Cтена», «PР» в «DELTA PRO PР»), в данных
# каталога web/**/*.json: на сайте они выглядят как обычные, но это опечатки. Ссылки и картинки не смотрит.
# Печатает файл и слова; ничего не нашёл: «mixed letters: none».
import glob, io, json, os, re, sys

root = sys.argv[1] if len(sys.argv) > 1 else '.'
MIXED = re.compile(r'[A-Za-zА-Яа-яЁё]*(?:[А-Яа-яЁё][A-Za-z]|[A-Za-z][А-Яа-яЁё])[A-Za-zА-Яа-яЁё]*')


def texts(o):
    if isinstance(o, str):
        if not o.startswith(('http://', 'https://', 'data:', 'web/')):
            yield o
    elif isinstance(o, dict):
        for v in o.values():
            yield from texts(v)
    elif isinstance(o, list):
        for v in o:
            yield from texts(v)


found = 0
for p in sorted(glob.glob(os.path.join(root, 'web', '**', '*.json'), recursive=True)):
    words = sorted({w for t in texts(json.load(io.open(p, encoding='utf-8'))) for w in MIXED.findall(t)})
    if words:
        found += len(words)
        print(os.path.relpath(p, root), ', '.join(words))
if not found:
    print('mixed letters: none')
