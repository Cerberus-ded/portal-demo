// node adm31.mjs <site dir> <shots dir> <node_modules parent>: a collection the salon adds itself, in the new door catalogue.
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
const [site, shots, nm] = process.argv.slice(2);
mkdirSync(shots, { recursive: true });
const puppeteer = (await import(pathToFileURL(join(nm, "node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")).href)).default;
const T = { ".html": "text/html; charset=utf-8", ".webp": "image/webp", ".js": "text/javascript", ".json": "application/json" };
const BLOB = readFileSync(join(site, "photos/k-dveri-1200.webp"));
const srv = createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  if (u.startsWith("/_blob/")) { r.writeHead(200, { "content-type": "image/webp" }); return r.end(BLOB); }
  const p = join(site, u);
  if (!existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p));
}).listen(0);
const base = "http://127.0.0.1:" + srv.address().port + "/";
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "shell", args: ["--no-sandbox"] });
let fails = 0; const ok = (c, m, x) => { console.log((c ? "ok   " : "FAIL ") + m + (c || x === undefined ? "" : " " + JSON.stringify(x))); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
const PIC = join(site, "photos/k-dveri-1200.webp"), PIC2 = join(site, "photos/k-hero-1600.webp");
// a stand-in for claude.use(): documents in localStorage, uploads answer with an id the server serves at /_blob/
const MOCK = `(() => {
  const KEY = "mockdb";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } };
  const keep = (d) => localStorage.setItem(KEY, JSON.stringify(d));
  const subs = {};
  const snap = (path) => { const d = load(), has = Object.prototype.hasOwnProperty.call(d, path); return { exists: has, id: path.split("/").pop(), data: () => has ? JSON.parse(JSON.stringify(d[path])) : undefined }; };
  const fire = (path) => (subs[path] || []).forEach((cb) => setTimeout(() => cb(snap(path)), 0));
  const doc = (path) => ({
    get: async () => snap(path),
    set: async (data) => { const d = load(); d[path] = JSON.parse(JSON.stringify(data)); keep(d); fire(path); },
    onSnapshot: (cb) => { (subs[path] = subs[path] || []).push(cb); setTimeout(() => cb(snap(path)), 40); return () => {}; }
  });
  const collection = (path) => ({
    doc: (id) => doc(path + "/" + id),
    onSnapshot: (cb) => { setTimeout(() => { const d = load(); const docs = Object.keys(d).filter((k) => k.indexOf(path + "/") === 0).map((k) => snap(k)); cb({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], forEach: (f) => docs.forEach(f) }); }, 40); return () => {}; }
  });
  const assets = {
    upload: async (blob) => { const id = (Date.now().toString(16) + Math.random().toString(16).slice(2) + "00000000000000000000").slice(0, 32); return { id, url: "/_blob/" + id, sizeBytes: blob.size, contentType: blob.type }; },
    delete: async () => {}, list: async () => ({ assets: [], usage: {} })
  };
  const user = { canEdit: () => true, isOwner: () => true, id: async () => "u1", can: () => true };
  window.claude = { use: (name) => Promise.resolve(name === "db" ? { doc, collection } : name === "assets" ? assets : name === "user" ? user : null) };
})();`;
const p = await b.newPage();
await p.evaluateOnNewDocument(() => { try { localStorage.setItem("cookie-choice", JSON.stringify({ v: "2026-11-18", choice: "no", at: "" })); } catch (e) {} });
await p.setViewport({ width: 1280, height: 900 });
await p.evaluateOnNewDocument(MOCK);
p.on("pageerror", (e) => errs.push(e.message));
const open = async (path) => { await p.goto("about:blank"); await p.goto(base + path, { waitUntil: "networkidle0", timeout: 120000 }); await wait(500); };
const clickText = (sel, t) => p.evaluate((s, t) => { const n = [...document.querySelectorAll(s)].find((x) => x.textContent.trim() === t); if (!n) return false; n.click(); return true; }, sel, t);
const fill = async (label, value) => {
  const id = await p.evaluate((l) => { const lab = [...document.querySelectorAll(".adm__form label")].find((x) => x.textContent.trim() === l); return lab ? lab.htmlFor : null; }, label);
  if (!id) throw new Error("no field " + label);
  const tag = await p.$eval("#" + id, (n) => n.tagName);
  if (tag === "SELECT") await p.select("#" + id, value); else await p.type("#" + id, value);
};
const db = (key) => p.evaluate((k) => { const d = JSON.parse(localStorage.getItem("mockdb") || "{}"); return d["site/" + k] ? d["site/" + k].list : null; }, key);

await open("index.html#katalog");
await p.evaluate(() => localStorage.removeItem("mockdb"));
await open("index.html#admin");
ok(await p.evaluate(() => [...document.querySelectorAll(".adm__tabs button")].map((b) => b.textContent).join("|") === "Акции на главной|Наши работы|Новые коллекции"), "admin: three tabs, no 1С photos");
await clickText(".adm__tabs button", "Новые коллекции"); await wait(200);
await clickText(".adm__head .btn", "Добавить коллекцию"); await wait(200);
await fill("Раздел каталога", "mezhkomnatnye"); await wait(100);
await fill("Фабрика или бренд", "Профиль Дорс");
await fill("Коллекция", "Проба");
await fill("Стиль", "Минимализм");
await p.type('[data-var-name="0"]', "Проба 1");
let inp = await p.$(".adm__var input[type=file]");
await inp.uploadFile(PIC); await wait(1200);
await clickText(".adm__vars > .btn", "Добавить модель"); await wait(200);
await p.type('[data-var-name="1"]', "Проба 2");
inp = (await p.$$(".adm__var input[type=file]"))[1];
await inp.uploadFile(PIC2); await wait(1200);
await p.click(".adm__form button[type=submit]"); await wait(600);
const it = await db("items");
ok(it && it.length === 1 && it[0].vars.length === 2 && it[0].vars.every((v) => v.photo) && it[0].f.style === "Минимализм", "collection saved with two models and photos", it && it[0].f);
const code = "SALON-" + it[0].id.toUpperCase();
await open("index.html#mezhkomnatnye");
const c = await p.evaluate(() => { const card = [...document.querySelectorAll("#grid .card")].find((x) => /Проба/.test(x.textContent)); return card ? { img: card.querySelector(".pic__img").getAttribute("src"), brand: card.querySelector(".card__brand").textContent } : null; });
ok(c && /^\/_blob\//.test(c.img) && /Профиль Дорс · Минимализм/.test(c.brand), "the salon's collection is in the grid with its first model", c);
ok(await p.evaluate(() => [...document.querySelectorAll("#facets label")].some((l) => /^Профиль Дорс/.test(l.textContent.trim()))), "its factory is in the filter");
await open("index.html#mezhkomnatnye-" + code);
const d = await p.evaluate(() => ({ tiles: [...document.querySelectorAll(".model__name")].map((x) => x.textContent), imgs: [...document.querySelectorAll(".model__img")].map((i) => i.getAttribute("src")) }));
ok(d.tiles.join() === "Проба 1,Проба 2" && d.imgs.every((u) => /^\/_blob\//.test(u)), "its page shows both models", d);
await p.click(".models li:nth-child(2) .model"); await wait(600);
ok(await p.evaluate(() => { const v = document.querySelector(".viewer"); return v.open && /^\/_blob\//.test(v.querySelector(".viewer__img").getAttribute("src")) && v.querySelector(".viewer__name").textContent === "Проба 2"; }), "a model opens large");
await p.screenshot({ path: join(shots, "salon-collection.png") });
ok(errs.length === 0, "no script errors", errs.slice(0, 3));
await b.close(); srv.close(); console.log(fails ? fails + " FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);
