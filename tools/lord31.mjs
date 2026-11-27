// node lord31.mjs <site dir> <shots dir> <node_modules parent>: LORD's doors by collection, a door up close, no motion.
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
  r.writeHead(200, { "content-type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p));
}).listen(0);
const base = "http://127.0.0.1:" + srv.address().port + "/";
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "shell", args: ["--no-sandbox"] });
let fails = 0; const ok = (c, m, x) => { console.log((c ? "ok   " : "FAIL ") + m + (c || x === undefined ? "" : " " + JSON.stringify(x))); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
const page = async (w, h) => { const p = await b.newPage(); await p.setViewport({ width: w, height: h }); p.on("pageerror", (e) => errs.push(e.message)); return p; };
const open = async (p, path) => { await p.goto("about:blank"); await p.goto(base + path, { waitUntil: "networkidle0", timeout: 120000 }); await wait(500); };
const moving = (p) => p.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").map((a) => (a.effect && a.effect.target && a.effect.target.className) || a.animationName || "?"));
const loadedIn = (p, sel) => p.evaluate((s) => { const im = [...document.querySelectorAll(s)]; return { n: im.length, ok: im.filter((i) => i.complete && i.naturalWidth > 0).length }; }, sel);

const p = await page(1280, 900);
await open(p, "index.html#katalog");
let o = await p.evaluate(() => ({ cards: document.querySelectorAll("#overview .card").length, soon: [...document.querySelectorAll(".soon li")].map((x) => x.textContent), title: document.getElementById("title").textContent }));
ok(o.cards === 1 && o.soon.length === 5, "catalogue: one filled section, five more marked as coming", o);
await p.screenshot({ path: join(shots, "root.png") });

await open(p, "index.html#mezhkomnatnye");
await wait(600);
let g = await p.evaluate(() => ({ cards: document.querySelectorAll("#grid .card").length, names: [...document.querySelectorAll("#grid .card__link")].slice(0, 6).map((a) => a.textContent),
  facets: [...document.querySelectorAll("#facets summary")].map((s) => s.textContent), count: document.getElementById("count").textContent }));
ok(g.cards === 40 && g.facets.includes("Стиль") && g.facets.includes("Покрытие"), "doors: 40 collections of LORD, filters by style and coating", g);
let im = await loadedIn(p, "#grid .pic__img");
ok(im.n === 40 && im.ok === 40, "every collection card shows its door", im);
ok((await moving(p)).length === 0, "nothing moves on the page", await moving(p));
await p.screenshot({ path: join(shots, "grid.png") });
const card = await p.evaluateHandle(() => [...document.querySelectorAll("#grid .card")].find((c) => /Кантри Вилла/.test(c.textContent)));
await card.asElement().hover(); await wait(400);
ok((await card.asElement().evaluate((c) => getComputedStyle(c).transform)) !== "none", "the card lifts under the cursor");
// a style filter
await p.evaluate(() => { const l = [...document.querySelectorAll("#facets label")].find((x) => /^Классика/.test(x.textContent.trim())); l.click(); });
await wait(300);
const kl = await p.evaluate(() => [...document.querySelectorAll("#grid .card__link")].map((a) => a.textContent));
ok(kl.length > 3 && kl.includes("Фелиция") && kl.includes("Молле") && kl.includes("Кантри Вилла") && !kl.includes("Техно"), "style filter: classic collections only", kl);

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
ok(v.open && v.name === "Молле 3" && v.w === 737 && v.h === 1600 && v.pick === "Молле 3", "a click on a door opens it large (737×1600) and chooses it", v);
ok((await moving(p)).length === 0, "the viewer opens without animation");
await p.screenshot({ path: join(shots, "viewer.png") });
await p.click(".viewer__img"); await wait(300);
v = await p.evaluate(() => { const d = document.querySelector(".viewer"), s = d.querySelector(".viewer__stage"), i = d.querySelector(".viewer__img"); return { zoom: d.getAttribute("data-zoom"), h: Math.round(i.getBoundingClientRect().height), scroll: s.scrollHeight > s.clientHeight }; });
ok(v.zoom === "1" && v.h >= 1599 && v.scroll, "a press shows the door at full size, the page scrolls over it", v);
await p.screenshot({ path: join(shots, "viewer-zoom.png") });
await p.click(".viewer__img"); await wait(200);
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

// an empty section
await open(p, "index.html#plitka");
ok(await p.evaluate(() => /Раздел наполняем/.test(document.getElementById("empty").textContent) && !document.querySelectorAll("#grid .card").length), "Плитка: says the section is being filled");

// the homepage
await open(p, "glavnaya.html");
const hm = await p.evaluate(() => ({ rooms: [...document.querySelectorAll(".room__fig")].map((x) => x.textContent.replace(/\s+/g, " ").trim()), menu: [...document.querySelectorAll("#catmenu em")].map((x) => x.textContent) }));
ok(/^40s*коллекций/.test(hm.rooms[0]) && hm.rooms.slice(1).every((r) => /Скоро/.test(r)) && hm.menu[0] === "40 коллекций", "homepage: 40 door collections, the rest marked as coming", hm);

// phone
const m = await page(390, 844);
await open(m, "index.html#mezhkomnatnye-LORD-NOVITA-FELICIA");
await wait(800);
ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "phone: the collection page fits");
await m.screenshot({ path: join(shots, "phone-felicia.png") });
await m.click(".models li:nth-child(2) .model"); await wait(800);
ok(await m.evaluate(() => { const i = document.querySelector(".viewer__img"); return document.querySelector(".viewer").open && i.naturalWidth === 737; }), "phone: a door opens large");
await m.screenshot({ path: join(shots, "phone-viewer.png") });
await open(m, "index.html#mezhkomnatnye");
ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "phone: the grid fits");

ok([...miss].filter((u) => !/favicon/.test(u)).length === 0, "every file is there", [...miss].slice(0, 5));
ok(errs.length === 0, "no script errors", errs.slice(0, 3));
await b.close(); srv.close(); console.log(fails ? fails + " FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);
