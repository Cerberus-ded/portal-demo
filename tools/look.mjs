// node look.mjs <site dir> <node_modules parent> <page with #hash> <out.png> [width] [height] [full|view] [js to run before the shot]
// A picture of a page as a visitor sees it: the cookie choice is already made, the photos have loaded.
// full: the whole page (cut at 6000 px), view: only the screen. Prints the page's errors and anything wider than the screen.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
const [site, nm, page, out, width, height, mode, js] = process.argv.slice(2);
const puppeteer = (await import(pathToFileURL(join(nm, "node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")).href)).default;
const T = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
// a page without its own head gets what the artifact's frame wraps it in: the phone viewport and the small reset
const SKELETON = '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>' + String.fromCharCode(10);
const body = (p) => { const b = readFileSync(p); if (extname(p) !== ".html") return b; const s = b.toString("utf8"); return /name="viewport"/.test(s) ? b : SKELETON + s; };
const srv = createServer((q, r) => { const p = join(site, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": T[extname(p)] || "application/octet-stream" }); r.end(body(p)); }).listen(0);
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "shell", args: ["--no-sandbox"] });
const p = await b.newPage();
const W = Number(width || 1280), H = Number(height || 900), phone = W < 768;
await p.setViewport({ width: W, height: H, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1 });
await p.evaluateOnNewDocument(() => { try { localStorage.setItem("cookie-choice", JSON.stringify({ v: "2026-11-18", metrika: false, at: "2026-11-18T00:00:00Z" })); } catch (e) {} });
p.on("pageerror", (e) => console.log("page error:", e.message));
p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) console.log("console error:", m.text()); });
p.on("response", (r) => { if (r.status() >= 400) console.log("http", r.status(), r.url()); });
await p.goto("http://127.0.0.1:" + srv.address().port + "/" + page, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
if (js) { const res = await p.evaluate(js); if (res !== undefined) console.log("js:", JSON.stringify(res)); await new Promise((r) => setTimeout(r, 900)); }
const wide = await p.evaluate(() => {
  const vw = document.documentElement.clientWidth, bad = [];
  if (document.documentElement.scrollWidth > vw) bad.push("page scrolls sideways: " + document.documentElement.scrollWidth + " > " + vw);
  document.querySelectorAll("body *").forEach((n) => {
    const r = n.getBoundingClientRect();
    if (!r.width || getComputedStyle(n).visibility === "hidden") return;
    let q = n.parentElement, clipped = false;
    while (q && q !== document.body) { const o = getComputedStyle(q).overflowX; if (o === "auto" || o === "hidden" || o === "scroll" || o === "clip") { clipped = true; break; } q = q.parentElement; }
    if (!clipped && (r.right > vw + 1 || r.left < -1)) bad.push((n.id ? "#" + n.id : n.tagName.toLowerCase() + "." + String(n.className).split(" ")[0]) + " " + Math.round(r.left) + ".." + Math.round(r.right));
  });
  return bad.slice(0, 12);
});
wide.forEach((x) => console.log("too wide:", x));
if (mode === "full") await p.screenshot({ path: out, captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: Math.min(6000, await p.evaluate(() => document.documentElement.scrollHeight)) } });
else await p.screenshot({ path: out });
console.log("ok", out);
await b.close(); srv.close();
