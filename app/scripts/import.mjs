// node scripts/import.mjs [<корень демо>]
// Переносит каталог из собранной демо-версии (корень репозитория) в Svelte-версию:
//   katalog.html          → src/lib/server/generated/catalog.json (разделы, фильтры, коллекции, документы, реквизиты)
//   <фабрика>/s-*.json, l-*.json (пакеты base64) → static/foto/<фабрика>/s|l/<модель>.webp
//   torex/colors.json     → static/foto/torex/colors/<id>.webp, названия цветов в catalog.json
//   torex/k-<серия>.json  → static/foto/torex/kit/<серия>/<n>.webp и src/lib/server/generated/kit/<серия>.json
//   x1/seek.json          → static/seek.json (данные поиска, как у демо)
//   photos/k-*.webp       → static/photos/ (фото главной)
// Всё, что пишет скрипт, в git не попадает (.gitignore): источник один — сборка демо tools/build31.mjs.
// Запускается сам перед npm run dev и npm run build. Пакеты не изменились — файлы не переписываются.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, copyFileSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(process.argv[2] || join(APP, ".."));
const GEN = join(APP, "src/lib/server/generated");
const STATIC = join(APP, "static");
const R = (p) => readFileSync(join(ROOT, p), "utf8");
const t0 = Date.now();

if (!existsSync(join(ROOT, "katalog.html"))) {
  console.error("import: нет " + join(ROOT, "katalog.html") + ". Укажите корень собранной демо-версии: node scripts/import.mjs <папка>");
  process.exit(1);
}

// ---- данные каталога из скрипта katalog.html: те же F, SECTIONS, ITEMS, DOCS, что видит покупатель в демо ----
const html = R("katalog.html");
function slice(from, to) {
  const a = html.indexOf(from), b = html.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error("import: в katalog.html не нашлось «" + from + "» … «" + to + "»: поменялась сборка демо?");
  return html.slice(a, b);
}
const core = new Function(slice("  var F = {", "  // ---- state ----") + "\nreturn { F: F, SECTIONS: SECTIONS, ITEMS: ITEMS };")();
const legal = new Function(slice("  var LEGAL = ", "  var docBox") + "\nreturn { LEGAL: LEGAL, DOCS: DOCS };")();
// номер счётчика Метрики: сборка демо подставляет его в окно cookie (r31/legal.json, поле metrika)
const META = (/var ID = String\(window\.PortalMetrikaId \|\| "(\d*)"\)/.exec(html) || [])[1] || "";
const { F, SECTIONS, ITEMS } = core;
if (!Array.isArray(ITEMS) || !ITEMS.length) throw new Error("import: в katalog.html нет коллекций");

// ---- фото: пакет base64 → файл webp, размеры из заголовка webp ----
function webpSize(buf) {
  const tag = buf.toString("ascii", 12, 16);
  if (tag === "VP8X") return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (tag === "VP8 ") return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (tag === "VP8L") { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  return [0, 0];
}
let wrote = 0, kept = 0;
function put(rel, dataUrl) {
  const m = /^data:image\/(webp|png|jpeg);base64,(.*)$/s.exec(dataUrl || "");
  if (!m) throw new Error("import: не картинка " + rel);
  const buf = Buffer.from(m[2], "base64");
  const out = join(STATIC, rel);
  if (existsSync(out) && statSync(out).size === buf.length) kept++;
  else { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, buf); wrote++; }
  return webpSize(buf);
}
const packs = {};
const pack = (p) => (packs[p] ??= JSON.parse(R(p + ".json")));

const slugOf = (it) => it.code.toLowerCase();
const items = ITEMS.map((it) => {
  const [dir, coll] = String(it.pack).split("/");
  const s = pack(dir + "/s-" + coll), l = pack(dir + "/l-" + coll);
  const vars = it.vars.map((v) => {
    if (!s[v.code] || !l[v.code]) throw new Error("import: нет фото " + it.code + " " + v.code);
    const ws = put(`foto/${dir}/s/${v.code}.webp`, s[v.code]);
    const wl = put(`foto/${dir}/l/${v.code}.webp`, l[v.code]);
    return { ...v, s: `foto/${dir}/s/${v.code}.webp`, l: `foto/${dir}/l/${v.code}.webp`, sw: ws[0], sh: ws[1], lw: wl[0], lh: wl[1] };
  });
  return { ...it, slug: slugOf(it), dir, coll, vars };
});
const slugs = new Set(items.map((i) => i.s + "/" + i.slug));
if (slugs.size !== items.length) throw new Error("import: повторяются адреса коллекций");

// ---- Торекс: цвета отделки квадратиками и комплектация по прайсу фабрики ----
let colors = {};
if (existsSync(join(ROOT, "torex/colors.json"))) {
  for (const [id, [name, url]] of Object.entries(pack("torex/colors"))) { put(`foto/torex/colors/${id}.webp`, url); colors[id] = name; }
}
rmSync(join(GEN, "kit"), { recursive: true, force: true });
mkdirSync(join(GEN, "kit"), { recursive: true });
let kits = 0;
for (const it of items.filter((i) => i.kit)) {
  const k = pack("torex/k-" + it.coll);
  let n = 0;
  const tile = (t) => { const rel = `foto/torex/kit/${it.coll}/${++n}.webp`; put(rel, t.u); return { ...t, u: rel }; };
  const out = {
    m: k.m, dev: (k.dev || []).map(tile), hw: (k.hw || []).map(tile),
    base: (k.base || []).map((b) => ({ t: b.t, i: b.i.map(tile) })),
    opts: (k.opts || []).map((o) => ({ ...o, i: o.i.map(tile) })),
    more: k.more || []
  };
  writeFileSync(join(GEN, "kit", it.coll + ".json"), JSON.stringify(out));
  kits++;
}

// ---- что видит сайт ----
const { metrika, ...LEGAL } = legal.LEGAL || {};  // metrika сборка демо уже убрала из реквизитов
mkdirSync(GEN, { recursive: true });
writeFileSync(join(GEN, "catalog.json"), JSON.stringify({ F, sections: SECTIONS, items, colors, docs: legal.DOCS, legal: LEGAL, metrika: String(metrika || META || "") }));

// поиск: те же данные, что у главной демо-версии (x1/seek.json), плюс папка фото и адрес коллекции
const drop = (o) => { for (const k of Object.keys(o)) if (o[k] == null || o[k] === false) delete o[k]; return o; };
writeFileSync(join(STATIC, "seek.json"), JSON.stringify({ F, chips: {},
  sections: SECTIONS.map((s) => ({ id: s.id, name: s.name, short: s.short, facets: s.facets.map((f) => drop({ id: f.id, label: f.label, opts: f.opts || null })) })),
  items: items.map((i) => drop({ s: i.s, brand: i.brand, name: i.name, code: i.code, slug: i.slug, dir: i.dir, cover: i.cover || 0, f: i.f,
    vars: i.vars.map((v) => ({ name: v.name, code: v.code, fin: v.fin })) })) }));
// фото главной в двух размерах
mkdirSync(join(STATIC, "photos"), { recursive: true });
let photos = 0;
for (const f of readdirSync(join(ROOT, "photos")).filter((f) => /^k-[a-z-]+-\d+\.webp$/.test(f))) {
  copyFileSync(join(ROOT, "photos", f), join(STATIC, "photos", f));
  photos++;
}

const models = items.reduce((n, i) => n + i.vars.length, 0);
console.log(`import: коллекций ${items.length}, моделей ${models}, комплектаций ${kits}, цветов ${Object.keys(colors).length}, фото главной ${photos}; ` +
  `файлов фото записано ${wrote}, без изменений ${kept}; ${((Date.now() - t0) / 1000).toFixed(1)} с`);
