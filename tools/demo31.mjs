// node demo30.mjs <demo dir> <shots dir> <node_modules parent> [base url]: the client demo as a static site, its store in the browser.
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
const [dir, shots, nm, remote] = process.argv.slice(2);
mkdirSync(shots, { recursive: true });
const puppeteer = (await import(pathToFileURL(join(nm, "node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")).href)).default;
const T = { ".html": "text/html; charset=utf-8", ".webp": "image/webp", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg" };
const miss = new Set();
let base = remote;
let srv = null;
if (!base) {
  srv = createServer((q, r) => {
    let p = join(dir, decodeURIComponent(q.url.split("?")[0]));
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
    if (!existsSync(p)) { miss.add(q.url); r.writeHead(404); return r.end(); }
    r.writeHead(200, { "content-type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p));
  }).listen(0);
  base = "http://127.0.0.1:" + srv.address().port + "/";
}
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "shell", args: ["--no-sandbox"] });
let fails = 0; const ok = (c, m, x) => { console.log((c ? "ok   " : "FAIL ") + m + (c || x === undefined ? "" : " " + JSON.stringify(x))); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [], bad = [];
const ctx = await b.createBrowserContext();
const page = async (w, h) => { const p = await ctx.newPage(); await p.setViewport({ width: w, height: h }); await p.evaluateOnNewDocument(() => { try { localStorage.setItem("cookie-choice", JSON.stringify({ v: "2026-11-18", choice: "no", at: "" })); } catch (e) {} }); p.on("pageerror", (e) => errs.push(e.message)); p.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url()); }); return p; };
const open = async (p, path) => { await p.goto(base + path, { waitUntil: "networkidle0", timeout: 120000 }); await wait(700); };
const clickText = (p, sel, t) => p.evaluate((s, t) => { const n = [...document.querySelectorAll(s)].find((x) => x.textContent.trim() === t); if (!n) return false; n.click(); return true; }, sel, t);
const fill = async (p, label, value) => {
  const id = await p.evaluate((l) => { const lab = [...document.querySelectorAll(".adm__form label")].find((x) => x.textContent.trim() === l); return lab ? lab.htmlFor : null; }, label);
  const tag = await p.$eval("#" + id, (n) => n.tagName);
  if (tag === "SELECT") await p.select("#" + id, value); else await p.type("#" + id, value);
};

const p = await page(1280, 900);
await open(p, "");
let h = await p.evaluate(() => ({ title: document.title, bar: document.querySelector(".modeline").textContent, admin: !document.getElementById("adminLink").hidden,
  promos: document.querySelectorAll(".promo").length, slides: document.querySelectorAll(".reel__slide").length, cat: document.querySelector('.nav a[href^="katalog.html"]') ? true : false,
  claude: /claude\.ai/.test(document.documentElement.innerHTML), noindex: !!document.querySelector('meta[name="robots"][content*="noindex"]'),
  owner: document.querySelectorAll("[data-owner]").length }));
ok(/^Демо-версия/.test(h.bar) && h.admin && h.promos === 3 && h.slides === 2 && h.cat, "homepage opens first: demo bar, admin link, demo promotions and works", h);
ok(!h.claude && h.noindex && h.owner === 0, "no claude.ai address, closed to search engines, no owner-only links");
const img = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute("loading") !== "lazy").map((i) => i.src));
ok(img.length === 0, "homepage pictures load", img);
await p.screenshot({ path: join(shots, "demo-home.png") });

// into the catalogue by the menu, in the same tab
await Promise.all([p.waitForNavigation({ waitUntil: "networkidle0" }), p.click('.nav a[href^="katalog.html"]')]);
await wait(700);
let c = await p.evaluate(() => ({ url: location.pathname, cards: document.querySelectorAll(".card, .overview .card, .lead").length, inbox: !document.getElementById("inboxLink").hidden, admin: !document.getElementById("adminLink").hidden, back: (document.querySelector(".brand") || {}).getAttribute?.call(document.querySelector(".brand"), "href") }));
ok(/katalog\.html$/.test(c.url) && c.inbox && c.admin && c.back === "index.html", "catalogue: same tab, manager and admin links, the logo leads home", c);

// an order
await open(p, "katalog.html#mezhkomnatnye-LORD-TECHNO");
await p.type("#one-name", "Проверка"); await p.type("#one-phone", "+79000000000"); await p.click("#one-ok");
await p.click('#one-order button[type="submit"]'); await wait(1200);
const done = await p.evaluate(() => (document.querySelector(".order--done") || {}).innerText || "");
ok(/ушла менеджеру/.test(done) && /Это демо-версия/.test(done), "order: accepted, and says it stayed in this browser", done.slice(0, 80));
await open(p, "katalog.html#zayavki");
const inbox = await p.evaluate(() => ({ n: document.querySelectorAll(".ticket").length, txt: (document.querySelector(".ticket") || {}).innerText || "", count: document.getElementById("inboxN").textContent }));
ok(inbox.n === 1 && /Проверка/.test(inbox.txt) && /Техно/.test(inbox.txt), "manager's screen shows the order", inbox);
ok(/Согласие на обработку данных\s*дано, редакция от 18 ноября 2026/.test(inbox.txt), "the order keeps which consent was given", inbox.txt.slice(0, 300));
await p.screenshot({ path: join(shots, "demo-inbox.png") });

// the admin: a promotion and a work with a photo
await open(p, "katalog.html#admin");
await clickText(p, ".adm__head .btn", "Добавить акцию"); await wait(200);
await fill(p, "Что за акция", "Демо-акция салона");
await fill(p, "Срок акции", "до 31 декабря");
await fill(p, "Куда ведёт кнопка", "oboi");
await p.click(".adm__form button[type=submit]"); await wait(500);
await clickText(p, ".adm__tabs button", "Наши работы"); await wait(200);
await clickText(p, ".adm__head .btn", "Добавить работу"); await wait(200);
const inp = await p.$(".adm__strip input[type=file]");
await inp.uploadFile(join(dir, "photos/k-hero-800.webp")); await wait(1500);
await fill(p, "Заголовок", "Дом в Мулловке");
await p.click(".adm__form button[type=submit]"); await wait(600);
ok(/Сохранено/.test(await p.evaluate(() => document.querySelector(".adm__msg").textContent)), "admin: the work is saved");
await open(p, "");
h = await p.evaluate(() => ({ promos: [...document.querySelectorAll(".promo h3")].map((x) => x.textContent), href: document.querySelector(".promo__go").getAttribute("href"),
  note: (document.querySelector(".reel__note:not([hidden]) h3") || {}).textContent, src: (document.querySelector(".reel__slide img") || {}).src || "" }));
const loaded = await p.evaluate(() => { const i = document.querySelector(".reel__slide img"); return i && i.complete && i.naturalWidth > 0; });
ok(h.promos.join() === "Демо-акция салона" && h.href === "katalog.html#oboi", "homepage: the promotion from the admin", h.promos);
ok(h.note === "Дом в Мулловке" && /^blob:/.test(h.src) && loaded, "homepage: the work with its photo from this browser", { note: h.note, src: h.src.slice(0, 20) });
// a fresh visit keeps it (IndexedDB)
await p.reload({ waitUntil: "networkidle0" }); await wait(800);
ok(await p.evaluate(() => { const i = document.querySelector(".reel__slide img"); return !!i && /^blob:/.test(i.src) && i.complete && i.naturalWidth > 0; }), "after reload the photo is still there");

// start over
await p.click("[data-demo-reset]"); await wait(200);
ok(await p.evaluate(() => /Стереть/.test(document.querySelector("[data-demo-reset]").textContent)), "reset: first press asks");
await Promise.all([p.waitForNavigation({ waitUntil: "networkidle0" }), p.click("[data-demo-reset]")]);
await wait(800);
h = await p.evaluate(() => ({ promos: document.querySelectorAll(".promo").length, slides: document.querySelectorAll(".reel__slide").length, note: document.querySelector(".reel__note:not([hidden]) h3").textContent }));
ok(h.promos === 3 && h.slides === 2 && h.note === "Квартира в новостройке", "reset: the demo starts over with the example promotions and works", h);
await open(p, "katalog.html#zayavki");
ok(await p.evaluate(() => document.querySelectorAll(".ticket").length === 0), "reset: no orders left");

// phone
const m = await page(390, 844);
await open(m, "");
ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "phone homepage: no sideways scroll");
await m.screenshot({ path: join(shots, "demo-home-phone.png") });
await open(m, "katalog.html#plitka");
ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "phone catalogue: no sideways scroll");

ok(bad.filter((u) => !/favicon/.test(u)).length === 0, "nothing answered with an error", bad.slice(0, 5));
ok(errs.length === 0, "no script errors", errs.slice(0, 3));
await b.close(); if (srv) srv.close(); console.log(fails ? fails + " FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);
