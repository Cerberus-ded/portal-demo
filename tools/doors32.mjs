// node doors32.mjs <site dir> <shots dir> <node_modules parent>: interior doors of Lord, Zodchij and Andora by collection, a door up close, no motion.
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
const [site, shots, nm] = process.argv.slice(2);
mkdirSync(shots, { recursive: true });
const puppeteer = (await import(pathToFileURL(join(nm, "node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")).href)).default;
const T = { ".html": "text/html; charset=utf-8", ".webp": "image/webp", ".js": "text/javascript", ".json": "application/json" };
const miss = new Set();
const srv = createServer((q, r) => {
  let p = join(site, decodeURIComponent(q.url.split("?")[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) { miss.add(q.url); r.writeHead(404); return r.end(); }
  // a page without its own head gets what the artifact's frame wraps it in: the phone viewport and the small reset
  let body = readFileSync(p);
  if (extname(p) === ".html" && !/name="viewport"/.test(body.toString("utf8"))) body = Buffer.concat([Buffer.from('<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>' + String.fromCharCode(10)), body]);
  r.writeHead(200, { "content-type": T[extname(p)] || "application/octet-stream" }); r.end(body);
}).listen(0);
const base = "http://127.0.0.1:" + srv.address().port + "/";
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "shell", args: ["--no-sandbox"] });
let fails = 0; const ok = (c, m, x) => { console.log((c ? "ok   " : "FAIL ") + m + (c || x === undefined ? "" : " " + JSON.stringify(x))); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
const page = async (w, h) => { const p = await b.newPage(); await p.setViewport({ width: w, height: h }); p.on("pageerror", (e) => errs.push(e.message));
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem("cookie-choice", JSON.stringify({ v: "2026-11-18", choice: "no", at: "" })); } catch (e) {} }); return p; };
const open = async (p, path) => { await p.goto("about:blank"); await p.goto(base + path, { waitUntil: "networkidle0", timeout: 120000 }); await wait(500); };
const moving = (p) => p.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").map((a) => (a.effect && a.effect.target && a.effect.target.className) || a.animationName || "?"));
const loadedIn = (p, sel) => p.evaluate((s) => { const im = [...document.querySelectorAll(s)]; return { n: im.length, ok: im.filter((i) => i.complete && i.naturalWidth > 0).length }; }, sel);

const p = await page(1280, 900);
await open(p, "index.html#katalog");
let o = await p.evaluate(() => ({ cards: document.querySelectorAll("#overview .card").length, soon: [...document.querySelectorAll(".soon li")].map((x) => x.textContent), title: document.getElementById("title").textContent }));
ok(o.cards === 2 && o.soon.length === 4, "catalogue: interior and entrance doors filled, four more sections marked as coming", o);
await p.screenshot({ path: join(shots, "root.png") });

await open(p, "index.html#mezhkomnatnye");
await wait(600);
let g = await p.evaluate(() => ({ cards: document.querySelectorAll("#grid .card").length, names: [...document.querySelectorAll("#grid .card__link")].slice(0, 6).map((a) => a.textContent),
  facets: [...document.querySelectorAll("#facets summary")].map((s) => s.textContent), count: document.getElementById("count").textContent }));
const groups = await p.evaluate(() => [...document.querySelectorAll(".grid__group")].map((x) => x.textContent.replace(/\s+/g, " ").trim()));
ok(g.cards === 163 && g.facets.includes("Фабрика") && g.facets.includes("Стиль") && g.facets.includes("Покрытие"), "doors: 163 collections, filters by factory, style and coating", g);
ok(groups.join("|") === "Лорд40 коллекций|Зодчий60 коллекций|Андора25 коллекций|Хамелеон22 коллекции|Адема15 коллекций|Разные производители1 коллекция", "grouped by factory: Лорд 40, Зодчий 60, Андора 25, Хамелеон 22, Адема 15, Разные производители 1", groups);
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await wait(1500); await p.evaluate(() => window.scrollTo(0, 0)); await wait(800);
let im = await loadedIn(p, "#grid .pic__img");
ok(im.n === 163 && im.ok === 163, "every collection card shows its door", im);
ok((await moving(p)).length === 0, "nothing moves on the page", await moving(p));
await p.screenshot({ path: join(shots, "grid.png") });
const card = await p.evaluateHandle(() => [...document.querySelectorAll("#grid .card")].find((c) => /Кантри Вилла/.test(c.textContent)));
await card.asElement().hover(); await wait(400);
ok((await card.asElement().evaluate((c) => getComputedStyle(c).transform)) !== "none", "the card lifts under the cursor");
// a style filter
await p.evaluate(() => { const l = [...document.querySelectorAll("#facets label")].find((x) => /^Классика/.test(x.textContent.trim())); l.click(); });
await wait(300);
const kl = await p.evaluate(() => [...document.querySelectorAll("#grid .card__link")].map((a) => a.textContent));
ok(kl.length > 3 && kl.includes("Фелиция") && kl.includes("Молле") && kl.includes("Кантри Вилла") && kl.includes("Каролина") && !kl.includes("Техно") && !kl.includes("Альфа"), "style filter: classic collections of Лорд and Зодчий only", kl);
await p.evaluate(() => { const l = [...document.querySelectorAll("#facets label")].find((x) => /^Классика/.test(x.textContent.trim())); l.click(); });
await p.evaluate(() => { const l = [...document.querySelectorAll("#facets label")].find((x) => /^Андора/.test(x.textContent.trim())); l.click(); });
await wait(300);
const an = await p.evaluate(() => ({ n: document.querySelectorAll("#grid .card").length, brands: [...new Set([...document.querySelectorAll("#grid .card__brand")].map((x) => x.textContent.split(" · ")[0]))] }));
ok(an.n === 25 && an.brands.join() === "Андора", "factory filter: Андора alone, 25 collections", an);
await p.screenshot({ path: join(shots, "grid-andora.png") });

// the four newest LORD collections: the door fills its frame like the others
await open(p, "index.html#mezhkomnatnye-LORD-PUNTA");
await wait(800);
const fill = await p.evaluate(() => [...document.querySelectorAll(".model__img")].map((i) => +(i.naturalWidth / i.naturalHeight).toFixed(2)));
ok(fill.length === 4 && fill.every((r) => r > 0.4 && r < 0.48), "Пунта: doors cropped to the door, no empty margins", fill);
await p.screenshot({ path: join(shots, "punta.png") });

// a collection
await open(p, "index.html#mezhkomnatnye-LORD-MOLLE");
await wait(800);
let d = await p.evaluate(() => ({ h: document.querySelector("#detail h1").textContent, tiles: [...document.querySelectorAll(".model__name")].map((x) => x.textContent),
  spec: [...document.querySelectorAll(".specs th")].map((x) => x.textContent), about: (document.querySelector(".specs__about") || {}).textContent || "", sel: (document.querySelector(".pick__name") || {}).textContent }));
ok(d.h === "Молле" && d.tiles.join() === "Молле 1,Молле 2,Молле 3,Молле 4,Молле 5,Молле 6" && d.sel === "Молле 1", "Молле: six models, the first chosen", d.tiles);
ok(d.spec.includes("Покрытие") && d.spec.includes("Размеры") && /парящей/.test(d.about), "Молле: what the factory says about it", d.spec);
im = await loadedIn(p, ".model__img");
ok(im.n === 6 && im.ok === 6, "all six doors are shown", im);
await p.screenshot({ path: join(shots, "molle.png") });

// up close
await p.click(".models li:nth-child(3) .model");
await wait(900);
let v = await p.evaluate(() => { const d = document.querySelector(".viewer"), i = d.querySelector(".viewer__img"); return { open: d.open, name: d.querySelector(".viewer__name").textContent, sub: d.querySelector(".viewer__sub").textContent, w: i.naturalWidth, h: i.naturalHeight, shown: Math.round(i.getBoundingClientRect().height), pick: document.querySelector(".pick__name").textContent }; });
ok(v.open && v.name === "Молле 3" && v.w >= 700 && v.h >= 1500 && v.pick === "Молле 3", "a click on a door opens it large (about 1600 tall, the floor strip cut off) and chooses it", v);
ok((await moving(p)).length === 0, "the viewer opens without animation");
await p.screenshot({ path: join(shots, "viewer.png") });
// no loupe any more (the salon asked): a press on the photo changes nothing, the door stays whole on the screen
const sh0 = await p.evaluate(() => Math.round(document.querySelector(".viewer__img").getBoundingClientRect().height));
await p.click(".viewer__img"); await wait(300);
v = await p.evaluate(() => { const d = document.querySelector(".viewer"), s = d.querySelector(".viewer__stage"), i = d.querySelector(".viewer__img");
  return { open: d.open, lens: !!d.querySelector(".viewer__lens"), zoom: d.getAttribute("data-zoom"), h: Math.round(i.getBoundingClientRect().height), scroll: s.scrollHeight > s.clientHeight + 2, hint: d.querySelector(".viewer__hint").textContent }; });
ok(v.open && !v.lens && v.zoom === null && v.h === sh0 && !v.scroll && !/луп|риблиз/i.test(v.hint), "no loupe: no «Приблизить» button, a press keeps the whole door on the screen", v);
await p.keyboard.press("ArrowRight"); await wait(500);
ok(await p.evaluate(() => document.querySelector(".viewer__name").textContent === "Молле 4" && document.querySelector(".pick__name").textContent === "Молле 4"), "arrow key: the next model, chosen on the page too");
await p.evaluate(() => [...document.querySelectorAll(".viewer__btn")].find((x) => x.textContent === "В корзину").click()); await wait(300);
ok(await p.evaluate(() => document.getElementById("cartN").textContent === "1"), "«В корзину» from the viewer");
await p.evaluate(() => [...document.querySelectorAll(".viewer__btn")].find((x) => x.textContent === "Оставить заявку").click()); await wait(500);
ok(await p.evaluate(() => !document.querySelector(".viewer").open && document.activeElement && /one-/.test(document.activeElement.id) && /Молле 4/.test(document.querySelector(".order__what").textContent)), "«Оставить заявку» closes it and goes to the form for that door");
await p.keyboard.press("Escape");

// the biggest collection and a search
await open(p, "index.html#mezhkomnatnye-LORD-DOLCE");
await wait(1000);
im = await loadedIn(p, ".model__img");
ok(im.n === 40 && im.ok === 40, "Дольче: all 40 doors", im);
await open(p, "index.html#katalog");
await p.keyboard.press("/"); await wait(300); await p.type("#seek-q", "фелиция"); await wait(600);
const sr = await p.evaluate(() => [...document.querySelectorAll(".seek__row")].slice(0, 3).map((a) => ({ t: a.textContent.trim().slice(0, 40), pic: !!a.querySelector(".seek__sw[data-photo]") })));
ok(sr.length && /Фелиция/.test(sr[0].t) && sr[0].pic, "search finds Фелиция and shows its door", sr);
await p.screenshot({ path: join(shots, "seek.png") });
await p.keyboard.press("Escape"); await wait(300);

// a Zodchij series: solid and glazed, the covering on the photo, the long colour list folded
await open(p, "index.html#mezhkomnatnye-ZODCHIJ-ALFA");
await wait(1000);
d = await p.evaluate(() => ({ h: document.querySelector("#detail h1").textContent, tiles: [...document.querySelectorAll(".model__name")].map((x) => x.textContent),
  spec: [...document.querySelectorAll(".specs th")].map((x) => x.textContent), list: (document.querySelector(".specs__list summary") || {}).textContent, open: (document.querySelector(".specs__list") || {}).open }));
ok(d.h === "Альфа" && d.tiles[0] === "Альфа 2" && d.tiles[1] === "Альфа 2 | остеклённое" && d.spec.includes("Высота") && d.spec.includes("Покрытия") && /57 вариантов/.test(d.list) && d.open === false, "Зодчий Альфа: models with glazed versions, sizes, 57 coverings folded", d);
im = await loadedIn(p, ".model__img");
ok(im.n === d.tiles.length && im.ok === im.n, "Альфа: every door is shown", im);
await p.screenshot({ path: join(shots, "zod-alfa.png") });
await p.click(".models li:nth-child(1) .model"); await wait(900);
v = await p.evaluate(() => { const d = document.querySelector(".viewer"), i = d.querySelector(".viewer__img"); return { sub: d.querySelector(".viewer__sub").textContent, h: i.naturalHeight }; });
ok(/Зодчий, коллекция Альфа · на фото: шагрень глясе/.test(v.sub) && v.h >= 1500, "the viewer names the covering on the photo and shows it sharp", v);
await p.screenshot({ path: join(shots, "zod-viewer.png") });
await p.keyboard.press("Escape"); await wait(200);
await open(p, "index.html#mezhkomnatnye-ANDORA-KLASSIK");
await wait(1000);
d = await p.evaluate(() => ({ h: document.querySelector("#detail h1").textContent, n: document.querySelectorAll(".model__name").length,
  rows: [...document.querySelectorAll(".specs tr")].map((x) => x.textContent.replace(/\s+/g, " ").trim()) }));
ok(d.h === "Классик" && d.n === 13 && d.rows.some((r) => /^Высота\s*1000–2300 мм/.test(r)) && d.rows.some((r) => /^Цвета плёнки\s*18 вариантов/.test(r)) && !d.rows.some((r) => /PROP/.test(r)), "Андора Классик: 13 models, sizes, film colours", d.rows);
im = await loadedIn(p, ".model__img");
ok(im.n === 13 && im.ok === 13, "Классик: every door is shown", im);
await p.screenshot({ path: join(shots, "and-klassik.png") });

// «Назад к коллекциям»: back to the grid, to the same place, with the same filter
await open(p, "index.html#mezhkomnatnye");
await p.evaluate(() => { const l = [...document.querySelectorAll("#facets label")].find((x) => /^Зодчий/.test(x.textContent.trim())); l.click(); });
await wait(300);
await p.evaluate(() => { const c = [...document.querySelectorAll("#grid .card")].find((x) => /Нуар/.test(x.textContent)); c.scrollIntoView({ block: "center" }); });
await wait(300);
const y0 = await p.evaluate(() => Math.round(window.scrollY));
await p.evaluate(() => [...document.querySelectorAll("#grid .card")].find((x) => /Нуар/.test(x.textContent)).click());
await wait(800);
const bk = await p.evaluate(() => { const b = document.querySelector(".detail__back"); const r = b && b.getBoundingClientRect(); return { text: b && b.textContent, top: r && Math.round(r.top + window.scrollY), h1: document.querySelector("#detail h1").textContent }; });
ok(bk.text === "← Назад к коллекциям" && bk.h1 === "Нуар", "the collection page has a back button above its name", bk);
await p.screenshot({ path: join(shots, "back-button.png") });
await p.click(".detail__back"); await wait(600);
const after = await p.evaluate(() => ({ detail: !document.getElementById("detail").hidden, cards: document.querySelectorAll("#grid .card").length, y: Math.round(window.scrollY), hash: location.hash }));
ok(!after.detail && after.cards === 60 && Math.abs(after.y - y0) < 4 && after.hash === "#mezhkomnatnye", "back: the grid again, Зодчий still chosen, at the same place", { y0, ...after });
const m2 = await page(390, 844);
await open(m2, "index.html#mezhkomnatnye-ANDORA-KLASSIK");
await wait(800);
const mb = await m2.evaluate(() => { const r = document.querySelector(".detail__back").getBoundingClientRect(); return { x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), fits: document.documentElement.scrollWidth <= innerWidth }; });
ok(mb.x >= 16 && mb.h >= 36 && mb.fits, "phone: the back button sits in the margin, big enough to tap", mb);
await m2.screenshot({ path: join(shots, "phone-back.png") });
await m2.click(".detail__back"); await wait(600);
ok(await m2.evaluate(() => document.getElementById("detail").hidden && document.querySelectorAll("#grid .card").length === 163), "phone: back opens the section grid when the page was opened by a link");

// the Лайн series (Разные производители) under the anti-vandal CPL coating
// the phone tab opened above went to the front; a tab in the background draws no frames and real clicks in it never finish
await p.bringToFront();
await open(p, "index.html#mezhkomnatnye");
await p.evaluate(() => { const l = [...document.querySelectorAll("#facets label")].find((x) => /^CPL антивандальное/.test(x.textContent.trim())); l.click(); });
await wait(300);
const cpl = await p.evaluate(() => [...document.querySelectorAll("#grid .card")].map((c) => c.querySelector(".card__link").textContent + " / " + c.querySelector(".card__brand").textContent));
ok(cpl.length === 1 && /^Лайн \/ Разные производители/.test(cpl[0]), "coating filter «CPL антивандальное»: the Лайн series of Разные производители", cpl);
await open(p, "index.html#mezhkomnatnye-RAZNYE-LAYN");
await wait(1000);
d = await p.evaluate(() => ({ h: document.querySelector("#detail h1").textContent, n: document.querySelectorAll(".model__name").length, first: (document.querySelector(".model__name") || {}).textContent,
  rows: [...document.querySelectorAll(".specs tr")].map((x) => x.textContent.replace(/\s+/g, " ").trim()), src: !!document.querySelector(".detail__src") }));
ok(d.h === "Лайн" && d.n === 24 && d.first === "ДП 01-1 · Белый" && d.rows.some((r) => /^Покрытие\s*CPL, антивандальное/.test(r)) && !d.src, "Лайн: 24 models, CPL, no link to a factory site", d);
im = await loadedIn(p, ".model__img");
ok(im.n === 24 && im.ok === 24, "Лайн: every door is shown", im);
await p.screenshot({ path: join(shots, "layn.png") });
// ADEMA and Chameleon
await open(p, "index.html#mezhkomnatnye-ADEMA-VEGA");
await wait(900);
d = await p.evaluate(() => ({ h: document.querySelector("#detail h1").textContent, names: [...document.querySelectorAll(".model__name")].map((x) => x.textContent) }));
ok(d.h === "Вега" && d.names.join("|") === "Вега-3 · Оазис|Вега-2 · Меджик меркури|Вега-5 · Меджик дюна|Вега-5 · Меджик фреско|Вега-6 · Меджик тоффи", "Адема Вега: five doors named as in the catalogue", d.names);
im = await loadedIn(p, ".model__img");
ok(im.n === 5 && im.ok === 5, "Вега: every door is shown", im);
await p.screenshot({ path: join(shots, "adema-vega.png") });
await p.click(".models li:nth-child(1) .model"); await wait(900);
ok(await p.evaluate(() => document.querySelector(".viewer").open && !document.querySelector(".viewer__lens")), "Вега up close: opens, no loupe");
await p.keyboard.press("Escape"); await wait(200);
await open(p, "index.html#mezhkomnatnye-CHAMELEON-DESIGN");
await wait(900);
d = await p.evaluate(() => ({ h: document.querySelector("#detail h1").textContent, n: document.querySelectorAll(".model__name").length,
  rows: [...document.querySelectorAll(".specs th")].map((x) => x.textContent) }));
ok(d.h === "Design" && d.n === 26 && d.rows.includes("Толщина полотна"), "Хамелеон Design: 26 models with the factory's sizes", d);
im = await loadedIn(p, ".model__img");
ok(im.n === 26 && im.ok === 26, "Design: every door is shown", im);
// the fixed Zodchij and Andora photos
await open(p, "index.html#mezhkomnatnye-ZODCHIJ-NUAR");
await wait(900);
const nu = await p.evaluate(() => [...document.querySelectorAll(".model__img")].map((i) => +(i.naturalWidth / i.naturalHeight).toFixed(3)));
ok(nu.length === 6 && Math.max(...nu) - Math.min(...nu) < 0.02, "Зодчий Нуар: every door framed alike (casing on both sides)", nu);
await p.screenshot({ path: join(shots, "zod-nuar.png") });
await open(p, "index.html#mezhkomnatnye-ANDORA-ASTRA");
await wait(900);
const as = await p.evaluate(() => [...document.querySelectorAll(".model__img")].map((i) => +(i.naturalWidth / i.naturalHeight).toFixed(3)));
ok(as.length === 6 && Math.max(...as) - Math.min(...as) < 0.03, "Андора Астра: Астра 1 without its white frame, like the others", as);
await p.screenshot({ path: join(shots, "and-astra.png") });

// consent to personal data processing: a document of its own, linked from the order form and the footer
await open(p, "index.html#mezhkomnatnye-LORD-MOLLE");
await wait(800);
const okl = await p.evaluate(() => { const l = document.querySelector(".order__ok"); const a = l && l.querySelector("a"); return { text: l && l.textContent, link: a && a.textContent, checked: document.getElementById("one-ok").checked }; });
ok(/^Даю согласие на обработку моих персональных данных/.test(okl.text) && okl.link === "Согласия на обработку персональных данных" && okl.checked === false, "order form: the consent box is unticked and links to the document", okl);
await p.click(".order__ok a"); await wait(400);
const docv = await p.evaluate(() => { const d = document.querySelector("dialog.doc"); return { open: !!(d && d.open), h: d && d.querySelector("h2").textContent, ver: d && d.querySelector(".doc__ver").textContent,
  law: /152-ФЗ/.test(d ? d.textContent : ""), parts: d ? d.querySelectorAll(".doc__body h3").length : 0, fills: d ? d.querySelectorAll("mark.legal-fill").length : 0, ticked: document.getElementById("one-ok").checked }; });
ok(docv.open && docv.h === "Согласие на обработку персональных данных" && docv.ver === "Редакция от 18 ноября 2026" && docv.law && docv.parts === 7 && docv.fills >= 4 && !docv.ticked,
  "the link opens the consent: 7 parts, 152-ФЗ, the salon's details marked to fill in, the box still unticked", docv);
await p.screenshot({ path: join(shots, "consent.png") });
await p.evaluate(() => [...document.querySelectorAll("dialog.doc button")].find((b) => b.textContent === "Закрыть").click()); await wait(200);
ok(await p.evaluate(() => !document.querySelector("dialog.doc").open), "«Закрыть» closes it");
await p.evaluate(() => document.querySelector('.foot [data-doc="soglasie"]').click()); await wait(300);
ok(await p.evaluate(() => document.querySelector("dialog.doc").open), "the footer link opens it too");
// the policy: from the form, from inside the consent, from the footer and by its own address
await p.evaluate(() => document.querySelector("dialog.doc").close()); await wait(200);
const polLink = await p.evaluate(() => { const a = document.querySelector(".order__policy a"); return a && a.textContent; });
await p.click(".order__policy a"); await wait(300);
const pol = await p.evaluate(() => { const d = document.querySelector("dialog.doc"); return { open: d.open, h: d.querySelector("h2").textContent, parts: d.querySelectorAll(".doc__body h3").length,
  rf: /ч\. 5 ст\. 18/.test(d.textContent), rights: /Роскомнадзоре/.test(d.textContent), days: /10 рабочих дней/.test(d.textContent), metrika: /Яндекс Метрика собирает/.test(d.textContent) && /Вебвизор/.test(d.textContent) }; });
ok(polLink === "Политика обработки персональных данных" && pol.open && pol.h === "Политика обработки персональных данных" && pol.parts === 10 && pol.rf && pol.rights && pol.days && pol.metrika,
  "the policy sits under the consent box: 10 parts, data kept in Russia, rights, 10 working days, what Metrika collects", pol);
await p.screenshot({ path: join(shots, "policy.png") });
await p.evaluate(() => [...document.querySelectorAll("dialog.doc .doc__body a")].find((a) => /Согласии/.test(a.textContent)).click()); await wait(200);
ok(await p.evaluate(() => document.querySelector("dialog.doc h2").textContent === "Согласие на обработку персональных данных"), "the policy links to the consent and back");
await p.evaluate(() => document.querySelector("dialog.doc").close()); await wait(200);
const foot = await p.evaluate(() => { const f = document.querySelector(".foot__legal"); return { text: f && f.textContent.replace(/\s+/g, " "), fills: f ? f.querySelectorAll("mark.legal-fill").length : 0, pol: !!document.querySelector('.foot [data-doc="politika"]') }; });
ok(/Продавец:/.test(foot.text) && /Гончарова, 11/.test(foot.text) && /не является публичной офертой/.test(foot.text) && foot.fills === 4 && foot.pol,
  "the footer names the seller (details marked to fill), says the site is no public offer, links the policy", foot);
await open(p, "index.html#politika");
await wait(600);
ok(await p.evaluate(() => document.querySelector("dialog.doc").open && document.querySelector("dialog.doc h2").textContent === "Политика обработки персональных данных"), "a direct link #politika opens the policy");
await open(p, "index.html#soglasie");
await wait(600);
ok(await p.evaluate(() => { const d = document.querySelector("dialog.doc"); return !!(d && d.open) && !document.getElementById("overview").hidden; }), "a direct link #soglasie opens it over the catalogue");
const m3 = await page(390, 844);
await open(m3, "index.html#soglasie");
await wait(600);
const md = await m3.evaluate(() => { const d = document.querySelector("dialog.doc"), r = d.getBoundingClientRect(); return { open: d.open, left: Math.round(r.left), right: Math.round(innerWidth - r.right), fits: r.width <= innerWidth && d.querySelector(".doc__body").scrollWidth <= d.querySelector(".doc__body").clientWidth }; });
ok(md.open && md.left >= 8 && md.right >= 8 && md.fits, "phone: the consent fits the screen with margins", md);
await m3.screenshot({ path: join(shots, "phone-consent.png") });
await p.bringToFront();

// the homepage: who runs the promotions, the documents and the seller in its footer
await open(p, "glavnaya.html");
const hl = await p.evaluate(() => ({ terms: (document.getElementById("akcii-terms") || {}).textContent || "", docs: [...document.querySelectorAll(".foot__docs a")].map((a) => a.textContent + " " + a.getAttribute("href")),
  seller: /Продавец:/.test((document.querySelector(".foot__legal") || {}).textContent || "") }));
ok(/^Организатор акций:/.test(hl.terms) && /Сроки указаны у каждой акции/.test(hl.terms) && hl.docs.length === 3 && /index\.html#soglasie$/.test(hl.docs[0]) && /index\.html#politika$/.test(hl.docs[1]) && /^Настройки cookie index\.html#cookie$/.test(hl.docs[2]) && hl.seller,
  "homepage: the organiser of the promotions, links to both documents, the seller", hl);

// cookies and Yandex Metrika: a clean browser profile, as a first-time visitor
const ctxs = [];
const fresh = async (w, h, id) => {
  // a profile of its own each time: nothing remembered from another visitor
  const cx = await b.createBrowserContext(); ctxs.push(cx);
  const q = await cx.newPage(); await q.setViewport({ width: w, height: h }); q.on("pageerror", (e) => errs.push(e.message));
  if (id) await q.evaluateOnNewDocument((n) => { window.PortalMetrikaId = n; }, id);
  // nothing goes to Yandex from a test: requests to the counter are stopped and counted
  q.ym = [];
  await q.setRequestInterception(true);
  q.on("request", (r) => { if (/mc\.yandex\.ru/.test(r.url())) { q.ym.push(r.url()); r.abort(); } else r.continue(); });
  return q;
};
const c1 = await fresh(1280, 900);
await open(c1, "index.html#katalog");
let ck = await c1.evaluate(() => { const c = document.querySelector(".cookies"); const bs = [...c.querySelectorAll("[data-cookie]")];
  return { shown: !c.hidden, text: c.textContent, buttons: bs.map((x) => x.textContent + "|" + x.className), widths: bs.map((x) => Math.round(x.getBoundingClientRect().width)), script: !!document.querySelector('script[src*="mc.yandex.ru"]') }; });
ok(ck.shown && /Яндекс Метрику/.test(ck.text) && ck.buttons.join() === "Разрешить|btn btn--outline btn--mini,Отказаться|btn btn--outline btn--mini" && Math.abs(ck.widths[0] - ck.widths[1]) <= 2 && !ck.script && c1.ym.length === 0,
  "first visit: the cookie window asks, two equal buttons, no counter before an answer", ck);
await c1.screenshot({ path: join(shots, "cookies.png") });
await c1.evaluate(() => document.querySelector(".cookies a").click()); await wait(300);
ck = await c1.evaluate(() => { const d = document.querySelector("dialog.doc"); return { open: d.open, h: d.querySelector("h2").textContent, parts: d.querySelectorAll(".doc__body h3").length, webvisor: /Вебвизор\) не ведётся/.test(d.textContent), yandex: /ООО «ЯНДЕКС»/.test(d.textContent) }; });
ok(ck.open && ck.h === "Согласие на обработку данных с помощью cookie и Яндекс Метрики" && ck.parts === 6 && ck.webvisor && ck.yandex, "its link opens a consent of its own for cookies and Metrika", ck);
await c1.evaluate(() => document.querySelector("dialog.doc").close());
await c1.click('.cookies [data-cookie="no"]'); await wait(200);
await open(c1, "index.html#katalog");
ck = await c1.evaluate(() => ({ hidden: document.querySelector(".cookies") ? document.querySelector(".cookies").hidden : true, choice: window.PortalCookies.choice() }));
ok(ck.hidden && ck.choice === "no" && c1.ym.length === 0, "«Отказаться»: the window goes and stays gone, no counter", ck);
await c1.evaluate(() => document.querySelector(".foot [data-cookie-settings]").click()); await wait(200);
ok(await c1.evaluate(() => !document.querySelector(".cookies").hidden), "«Настройки cookie» in the footer brings the window back");
await c1.click('.cookies [data-cookie="yes"]'); await wait(300);
ok(await c1.evaluate(() => window.PortalCookies.choice() === "yes" && !document.querySelector('script[src*="mc.yandex.ru"]')), "«Разрешить» without a counter number loads nothing");
// with a counter number: loads only after «Разрешить», counts the goals, a refusal later removes it
const c2 = await fresh(1280, 900, "12345678");
await open(c2, "index.html#mezhkomnatnye-LORD-MOLLE");
await wait(400);
const before = c2.ym.length;
await c2.click('.cookies [data-cookie="yes"]'); await wait(800);
ck = await c2.evaluate(() => { window.PortalCookies.goal("call"); return { script: !!document.querySelector('script[src="https://mc.yandex.ru/metrika/tag.js"]'), calls: (window.ym && window.ym.a || []).map((a) => [].slice.call(a).map(String).join(" ")) }; });
ok(before === 0 && c2.ym.length >= 1 && ck.script && ck.calls.some((x) => /^12345678 init/.test(x)) && ck.calls.some((x) => x === "12345678 reachGoal call"),
  "a counter number: Metrika loads only after «Разрешить», without Webvisor, and counts the goals", { before, after: c2.ym.length, calls: ck.calls });
const init = await c2.evaluate(() => { const a = (window.ym.a || []).find((x) => x[1] === "init"); return a && a[2]; });
ok(init && init.webvisor === false, "Webvisor is off", init);
await c2.type("#one-name", "Проба"); await c2.type("#one-phone", "+79000000000"); await c2.click("#one-ok");
await c2.click('#one-order button[type="submit"]'); await wait(1200);
const goals = await c2.evaluate(() => (window.ym.a || []).filter((x) => x[1] === "reachGoal").map((x) => x[2]));
ok(goals.includes("order") || /не уходит менеджеру|не отправилась/.test(await c2.evaluate(() => document.body.textContent)), "goal «order» when the order is sent", goals);
await c2.evaluate(() => document.querySelector(".foot [data-cookie-settings]").click()); await wait(200);
await Promise.all([c2.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}), c2.click('.cookies [data-cookie="no"]')]);
await wait(500);
ck = await c2.evaluate(() => ({ choice: window.PortalCookies.choice(), script: !!document.querySelector('script[src*="mc.yandex.ru"]'), ym: document.cookie.indexOf("_ym") }));
ok(ck.choice === "no" && !ck.script && ck.ym < 0, "a refusal later: the page reloads without the counter and its cookies", ck);
// the homepage and a phone
const c3 = await fresh(390, 844);
await open(c3, "glavnaya.html");
ck = await c3.evaluate(() => { const c = document.querySelector(".cookies"), r = c.getBoundingClientRect(); return { shown: !c.hidden, href: c.querySelector("a").getAttribute("href"), left: Math.round(r.left), right: Math.round(innerWidth - r.right), fits: document.documentElement.scrollWidth <= innerWidth, settings: !!document.querySelector(".foot__docs [data-cookie-settings]") }; });
ok(ck.shown && ck.href === "index.html#cookie" && ck.left >= 12 && ck.right >= 12 && ck.fits && ck.settings, "homepage on a phone: the window fits with margins, links the consent, footer has the settings", ck);
await c3.screenshot({ path: join(shots, "phone-cookies.png") });
for (const cx of ctxs) await cx.close();
await p.bringToFront();

// entrance doors: Torex apartment and street series, any design, the price on request, no price anywhere
await open(p, "index.html#vhodnye");
await wait(800);
const vh = await p.evaluate(() => ({ cards: [...document.querySelectorAll("#grid .card")].map((c) => c.querySelector(".card__link").textContent + "|" + c.querySelector(".card__meta").textContent),
  pair: document.getElementById("grid").classList.contains("grid--pair"), facets: [...document.querySelectorAll("#facets summary")].map((s) => s.textContent) }));
ok(vh.cards.length === 9 && vh.cards.every((c) => /Дизайн на выбор/.test(c) && /цена по запросу/.test(c)) && vh.pair
  && ["Дельта ПРО", "Дельта 100", "ТАУ ПРО", "С.Омега ПРО", "Сайбер ПРО", "Ультиматум ПРО", "Снегирь Арктик", "Снегирь Арктик-S", "Снегирь Арктик LT"].every((n) => vh.cards.some((c) => c.startsWith(n + "|"))),
  "Входные двери: the nine Torex series (six for flats, three for houses), «Дизайн на выбор», price on request", vh);
im = await loadedIn(p, "#grid .pic__img");
ok(im.n === 9 && im.ok === 9, "every Torex series shows its picture", im);
// inside Torex: the six apartment series under their own heading first, then the three street ones
const vk = await p.evaluate(() => [...document.querySelectorAll("#grid > *")].map((n) => n.classList.contains("grid__group--sub") ? "#" + n.querySelector("h3").textContent + "|" + n.querySelector("span").textContent
  : n.classList.contains("grid__group") ? "" : n.querySelector(".card__link").textContent).filter(Boolean));
ok(vk.length === 11 && vk[0] === "#Квартирные двери|6 серий" && vk[7] === "#Уличные двери для частного дома|3 серии" && vk.slice(8).every((n) => /^Снегирь Арктик/.test(n)),
  "Торекс: квартирные and уличные under their own headings", vk);
await p.evaluate(() => { const b = [...document.querySelectorAll("#facets label")].find((l) => /Уличные/.test(l.textContent)); b.click(); }); await wait(500);
const st2 = await p.evaluate(() => [...document.querySelectorAll("#grid .card__link")].map((a) => a.textContent));
ok(st2.length === 3 && st2.every((n) => /^Снегирь Арктик/.test(n)), "the purpose filter: three street series", st2);
await open(p, "index.html#vhodnye");
await wait(800);
await p.evaluate(() => { const b = [...document.querySelectorAll("#facets label")].find((l) => /Электронный/.test(l.textContent)); b.click(); }); await wait(500);
const el2 = await p.evaluate(() => [...document.querySelectorAll("#grid .card__link")].map((a) => a.textContent));
ok(el2.length === 2 && el2.includes("Сайбер ПРО") && el2.includes("ТАУ ПРО"), "the lock filter: an electronic lock in Сайбер ПРО, as an option in ТАУ ПРО", el2);
await open(p, "index.html#vhodnye-TOREX-CYBER-PRO");
await wait(900);
const tx = await p.evaluate(() => ({ top: document.querySelector(".detail__top p:last-child").textContent, note: (document.querySelector(".pick__note") || {}).textContent || "",
  rows: [...document.querySelectorAll(".specs th")].map((t) => t.textContent), what: document.querySelector(".order__what").textContent,
  src: (document.querySelector(".detail__src") || {}).textContent, img: (() => { const i = document.querySelector(".model__img"); return i && i.complete && i.naturalWidth; })(),
  money: /\d[\d\s]*(₽|руб)/i.test(document.body.innerText) }));
ok(/Дизайн любой на выбор/.test(tx.top) && /любой на выбор/.test(tx.note) && /Цена зависит от выбранного дизайна/.test(tx.note), "a series says any design can be chosen and the price depends on it", tx);
ok(["Полотно", "Короб", "Замковая система", "Основной замок", "Ручка", "Глазок", "Дизайн"].every((k) => tx.rows.includes(k)) && !tx.rows.includes("Моделей в коллекции"), "the series' make-up from the factory's price: leaf, frame, locks, handle, viewer", tx.rows);
ok(/Торекс, Сайбер ПРО, Дизайн на выбор/.test(tx.what) && /Серия на сайте фабрики Торекс/.test(tx.src) && tx.img > 700, "the order names the series, the picture is the salon's own photo", tx);
ok(!tx.money, "no price on the page", tx.money);
await p.click(".model"); await wait(700);
const tv = await p.evaluate(() => ({ open: document.querySelector(".viewer").open, sub: document.querySelector(".viewer__sub").textContent }));
ok(tv.open && /Торекс, серия Сайбер ПРО/.test(tv.sub) && /снаружи и изнутри/.test(tv.sub), "up close: the series, outside and inside", tv);
await p.keyboard.press("Escape"); await wait(300);
await open(p, "index.html#vhodnye-TOREX-SNEGIR-ARCTIC-S");
await wait(900);
const sa = await p.evaluate(() => ({ fin: document.querySelector(".pick__fin").textContent, rows: [...document.querySelectorAll(".specs th")].map((t) => t.textContent),
  src: (document.querySelector(".detail__src") || {}).href || "", img: (() => { const i = document.querySelector(".model__img"); return i && i.complete && i.naturalWidth; })() }));
ok(/уличная входная дверь/.test(sa.fin) && ["Полотно", "Стеклопакет", "Короб", "Терморазрыв", "Основной замок"].every((k) => sa.rows.includes(k)) && /snegir-arctic-c/.test(sa.src) && sa.img > 700,
  "Снегирь Арктик-S: a street door, glass and heat in its make-up, the factory's page", sa);
// the factory's price list without prices: the basic set on the right, the options on the left, pictures and captions from the price, nothing to press
await p.evaluate(() => document.querySelector(".kit").scrollIntoView({ block: "start", behavior: "instant" })); await wait(1200);
const kt = await p.evaluate(() => {
  const s = document.querySelector(".kit"), base = s.querySelector(".kit__base"), opts = s.querySelector(".kit__opts");
  const r = (e) => e.getBoundingClientRect();
  return { h2: s.querySelector("h2").textContent, heads: [...s.querySelectorAll(".kit__h")].map((h) => h.textContent), right: r(base).left > r(opts).left,
    base: [...base.querySelectorAll(".kit__name")].map((h) => h.textContent), opts: opts.querySelectorAll(".kit__grp").length, more: opts.querySelectorAll(".kit__more li").length,
    models: (base.querySelector(".kit__models") || {}).textContent || "",
    loaded: [...s.querySelectorAll(".kit__img")].filter((i) => i.complete && i.naturalWidth > 0).length, all: s.querySelectorAll(".kit__img").length,
    press: s.querySelectorAll("a, button, input, [tabindex], [role=button]").length,
    money: /\d[\d\s]*(₽|руб)|доплат|ориентировочн/i.test(s.innerText), wide: document.documentElement.scrollWidth > document.documentElement.clientWidth };
});
ok(kt.h2 === "Что входит в дверь и что можно добавить" && kt.heads.join() === "Базовая комплектация,Дополнительные опции" && kt.right
  && ["Как устроена дверь", "Фурнитура в комплекте"].every((t) => kt.base.includes(t)) && kt.base.length >= 5 && kt.opts >= 10 && kt.more >= 3
  && /МР — снаружи металл/.test(kt.models) && /РР — снаружи панель/.test(kt.models) && kt.all > 60 && kt.loaded === kt.all && !kt.press && !kt.money && !kt.wide,
  "Снегирь Арктик-S: the basic set on the right, the options on the left, all pictures from the price, nothing to press, no prices", kt);
await p.screenshot({ path: join(shots, "torex-kit.png") });
const kn = await p.evaluate(() => [...document.querySelectorAll(".specs__note")].map((n) => n.textContent));
ok(kn.includes("* размер под заказ") && !kn.some((n) => /доплат/.test(n)), "sizes marked * are made to order, not «с доплатой»", kn);
await open(p, "index.html#vhodnye-TOREX-SNEGIR-ARCTIC-LT");
await wait(900);
await p.evaluate(() => document.querySelector(".kit").scrollIntoView({ block: "start", behavior: "instant" })); await wait(1200);
const lt = await p.evaluate(() => ({ src: !!document.querySelector(".detail__src"), fins: !!document.querySelector(".fins"), rows: [...document.querySelectorAll(".specs th")].map((t) => t.textContent),
  kit: document.querySelectorAll(".kit__img").length, models: (document.querySelector(".kit__models") || {}).textContent || "", money: /\d[\d\s]*(₽|руб)/i.test(document.body.innerText) }));
ok(!lt.src && !lt.fins && ["Полотно", "Терморазрыв", "Основной замок"].every((k) => lt.rows.includes(k)) && !lt.rows.includes("Устройство двери") && lt.kit > 30 && /^Исполнение МР/.test(lt.models) && !lt.money,
  "Снегирь Арктик LT: its make-up and its set from the street price list, no factory page to link, no price", lt);
// the price's «Скоро в продаже» badge is not shown (asked 27.11.2026); the option itself stays
await open(p, "index.html#vhodnye-TOREX-DELTA-PRO");
await wait(900);
await p.evaluate(() => document.querySelector(".kit").scrollIntoView({ block: "start", behavior: "instant" })); await wait(1200);
const dp = await p.evaluate(() => ({ soon: /скоро в продаже/i.test(document.body.innerText) || !!document.querySelector(".kit__soon"),
  hw: [...document.querySelectorAll(".kit__opts .kit__grp")].some((g) => /золото сатин/i.test(g.textContent) && g.querySelector(".kit__img")) }));
ok(!dp.soon && dp.hw, "Дельта ПРО: no «Скоро в продаже» badge, the hardware option is still there with its picture", dp);

// LORD after its corrected price list (12.11.2026): the price's names, its models only, lacobel brown and chamois off the standard
await open(p, "index.html#mezhkomnatnye-LORD-MODERN");
await wait(800);
const lm = await p.evaluate(() => [...document.querySelectorAll(".model__name")].map((x) => x.textContent));
ok(lm.length === 8 && lm[0] === "Модерн 1" && lm.includes("Модерн 23") && !lm.includes("Модерн 3"), "Модерн: the 8 models the price lists, named as in the price", lm);
await open(p, "index.html#mezhkomnatnye-LORD-ALTRO-SF");
await wait(800);
const la = await p.evaluate(() => ({ h: document.querySelector(".detail h1").textContent, first: document.querySelector(".model__name").textContent,
  rows: Object.fromEntries([...document.querySelectorAll(".specs tr")].map((r) => [r.querySelector("th").textContent, r.querySelector("td").textContent])) }));
ok(la.h === "Альт СФ" && la.first === "Альт 1 СФ" && /42 мм с алюминиевой кромкой/.test(la.rows["Исполнение"] || "") && /золото/.test(la.rows["Цвет алюминиевой кромки"] || "")
  && /по своему эскизу/.test(la.rows["По эскизу"] || ""), "Альт СФ: the price's name, how the door can be made, edge colours, made to a sketch", la);
ok(!/Шамуа|Коричневый/i.test((la.rows["Остекление"] || "").split("Лакобель:")[1] || "") && /коричневый и шамуа/.test(la.rows["Лакобель под заказ"] || ""), "lacobel brown and chamois only as painted glass by RAL or NCS", la.rows);

// an empty section
await open(p, "index.html#plitka");
ok(await p.evaluate(() => /Раздел наполняем/.test(document.getElementById("empty").textContent) && !document.querySelectorAll("#grid .card").length), "Плитка: says the section is being filled");

// the homepage
await open(p, "glavnaya.html");
const hm = await p.evaluate(() => ({ rooms: [...document.querySelectorAll(".room__fig")].map((x) => x.textContent.replace(/\s+/g, " ").trim()), menu: [...document.querySelectorAll("#catmenu em")].map((x) => x.textContent) }));
ok(/^172\s*коллекции/.test(hm.rooms[0]) && hm.rooms.slice(1).every((r) => /Скоро/.test(r)) && hm.menu[0] === "172 коллекции" && hm.menu[1] === "163 коллекции" && hm.menu[2] === "9 коллекций", "homepage: 172 door collections (163 interior, 9 entrance), the rest marked as coming", hm);

// phone
const m = await page(390, 844);
await open(m, "index.html#mezhkomnatnye-LORD-NOVITA-FELICIA");
await wait(800);
ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "phone: the collection page fits");
await m.screenshot({ path: join(shots, "phone-felicia.png") });
await m.click(".models li:nth-child(2) .model"); await wait(800);
ok(await m.evaluate(() => { const i = document.querySelector(".viewer__img"); return document.querySelector(".viewer").open && i.naturalWidth >= 700; }), "phone: a door opens large");
await m.screenshot({ path: join(shots, "phone-viewer.png") });
await open(m, "index.html#mezhkomnatnye");
ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "phone: the grid fits");

ok([...miss].filter((u) => !/favicon/.test(u)).length === 0, "every file is there", [...miss].slice(0, 5));
ok(errs.length === 0, "no script errors", errs.slice(0, 3));
await b.close(); srv.close(); console.log(fails ? fails + " FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);
