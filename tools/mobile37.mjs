// node mobile37.mjs <site dir> <shots dir> <node_modules parent> [widths, default 360,390,414] [demo]
// The phone version, screen by screen: the catalogue (sections, grid, filters, a collection, the door up close, the cart, the order,
// entrance doors, the documents, the manager's screens), the homepage (menu, search, promos, footer) and the cookie window.
// For each: page errors, anything wider than the screen (the page must never scroll sideways), buttons and links smaller than
// a finger (under 40 px, inline text links excepted), text cut off by its box, fixed bars covering each other. A picture of each.
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
const [site, shots, nm, ws] = process.argv.slice(2);
mkdirSync(shots, { recursive: true });
const puppeteer = (await import(pathToFileURL(join(nm, "node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")).href)).default;
const T = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
// a page without its own head gets what the artifact's frame wraps it in: the phone viewport and the small reset
const SKELETON = '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>' + String.fromCharCode(10);
const body = (p) => { const b = readFileSync(p); if (extname(p) !== ".html") return b; const s = b.toString("utf8"); return /name="viewport"/.test(s) ? b : SKELETON + s; };
const srv = createServer((q, r) => { const p = join(site, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": T[extname(p)] || "application/octet-stream" }); r.end(body(p)); }).listen(0);
const ORIGIN = "http://127.0.0.1:" + srv.address().port + "/";
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "shell", args: ["--no-sandbox"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WIDTHS = (ws || "360,390,414").split(",").map(Number);
let problems = 0;
const say = (w, name, what) => { problems++; console.log("[" + w + "] " + name + ": " + what); };

// what a screen is: the page, a step to run on it, whether the cookie choice is already made
// the client demo names its pages differently: pass "demo" after the widths
const DEMO = process.argv[6] === "demo";
const CAT = DEMO ? "katalog.html" : "index.html", HOME = DEMO ? "index.html" : "glavnaya.html";
const STEPS = [
  { name: "cat-root", page: CAT },
  { name: "cat-menu", page: CAT, run: () => document.getElementById("burger").click() },
  { name: "cat-grid", page: CAT + "#mezhkomnatnye" },
  { name: "cat-filters", page: CAT + "#mezhkomnatnye", run: () => { const t = document.getElementById("railtoggle"); if (t) t.click(); } },
  { name: "cat-coll", page: CAT + "#mezhkomnatnye-LORD-NOVITA-FELICIA", full: true },
  { name: "cat-coll-bar", page: CAT + "#mezhkomnatnye-LORD-NOVITA-FELICIA", run: () => window.scrollTo(0, 900) },
  { name: "cat-viewer", page: CAT + "#mezhkomnatnye-LORD-NOVITA-FELICIA", run: () => document.querySelector(".model").click() },
  { name: "cat-cart", page: CAT + "#mezhkomnatnye-ZODCHIJ-NUAR", run: async () => {
    [...document.querySelectorAll(".pick__act button")].find((x) => /корзину/i.test(x.textContent)).click();
    await new Promise((r) => setTimeout(r, 300));
    document.getElementById("cart").click();
  } },
  { name: "cat-order", page: CAT + "#mezhkomnatnye-ANDORA-ASTRA", run: () => { const f = document.querySelector(".coll__form"); f.scrollIntoView(); } },
  { name: "cat-vhodnye", page: CAT + "#vhodnye", full: true },
  { name: "cat-torex", page: CAT + "#vhodnye-TOREX-CYBER-PRO", full: true },
  { name: "cat-torex-viewer", page: CAT + "#vhodnye-TOREX-DELTA-PRO", run: () => document.querySelector(".model").click() },
  { name: "cat-torex-kit", page: CAT + "#vhodnye-TOREX-SNEGIR-ARCTIC", run: () => document.querySelector(".kit").scrollIntoView({ block: "start", behavior: "instant" }) },
  { name: "cat-torex-opts", page: CAT + "#vhodnye-TOREX-DELTA-PRO", run: () => document.querySelector(".kit__opts").scrollIntoView({ block: "start", behavior: "instant" }) },
  { name: "cat-vhodnye", page: CAT + "#vhodnye" },
  { name: "cat-search", page: CAT, run: async () => {
    document.getElementById("seekfield").click();
    await new Promise((r) => setTimeout(r, 400));
    const i = document.getElementById("seek-q"); if (!i) throw new Error("no search field");
    i.value = "дельта"; i.dispatchEvent(new Event("input", { bubbles: true }));
  } },
  { name: "cat-soon", page: CAT + "#plitka" },
  { name: "cat-doc", page: CAT + "#politika" },
  { name: "cat-inbox", page: CAT + "#inbox" },
  { name: "cat-admin", page: CAT + "#admin" },
  { name: "cat-foot", page: CAT + "#vhodnye", run: () => window.scrollTo(0, document.body.scrollHeight) },
  { name: "cat-cookie", page: CAT + "#mezhkomnatnye", fresh: true },
  { name: "home-top", page: HOME },
  { name: "home-full", page: HOME, full: true },
  { name: "home-menu", page: HOME, run: () => document.getElementById("burger").click() },
  { name: "home-catmenu", page: HOME, run: async () => { document.getElementById("burger").click(); await new Promise((r) => setTimeout(r, 300)); const c = document.getElementById("navCaret"); if (c) c.click(); } },
  { name: "home-search", page: HOME, run: async () => {
    document.querySelector("[data-seek]").click();
    await new Promise((r) => setTimeout(r, 400));
    const i = document.getElementById("seek-q"); if (!i) throw new Error("no search field");
    i.value = "сайбер"; i.dispatchEvent(new Event("input", { bubbles: true }));
  } },
  { name: "home-cookie", page: HOME, fresh: true }
];

for (const w of WIDTHS) {
  for (const st of STEPS) {
    const ctx = await b.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: w, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    if (!st.fresh) await p.evaluateOnNewDocument(() => { try { localStorage.setItem("cookie-choice", JSON.stringify({ v: "2026-11-18", metrika: false, at: "2026-11-18T00:00:00Z" })); } catch (e) {} });
    p.on("pageerror", (e) => say(w, st.name, "page error " + e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) say(w, st.name, "console " + m.text()); });
    p.on("response", (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) say(w, st.name, "http " + r.status() + " " + r.url()); });
    await p.goto(ORIGIN + st.page, { waitUntil: "networkidle0" });
    await sleep(500);
    if (st.run) { await p.evaluate(st.run); await sleep(900); }
    const found = await p.evaluate(() => {
      const out = [], vw = document.documentElement.clientWidth, vh = window.innerHeight;
      const label = (n) => (n.id ? "#" + n.id : n.tagName.toLowerCase() + (n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\s+/).join(".") : "")) + (n.textContent ? " «" + n.textContent.trim().replace(/\s+/g, " ").slice(0, 30) + "»" : "");
      const shown = (n) => { const s = getComputedStyle(n); if (s.visibility === "hidden" || s.display === "none" || +s.opacity === 0) return false; const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !n.closest("[hidden], dialog:not([open])"); };
      if (document.documentElement.scrollWidth > vw + 1) out.push("page scrolls sideways " + document.documentElement.scrollWidth + " > " + vw);
      const all = [...document.querySelectorAll("body *")].filter(shown);
      for (const n of all) {
        const r = n.getBoundingClientRect();
        let q = n.parentElement, clipped = false;
        while (q && q !== document.body) { const o = getComputedStyle(q).overflowX; if (o !== "visible") { clipped = true; break; } q = q.parentElement; }
        if (!clipped && (r.right > vw + 1 || r.left < -1) && getComputedStyle(n).position !== "fixed") out.push("wider than the screen " + label(n) + " " + Math.round(r.left) + ".." + Math.round(r.right));
        // text cut by its own box
        const s = getComputedStyle(n);
        if (n.children.length === 0 && n.textContent.trim() && s.overflowX !== "visible" && s.textOverflow !== "ellipsis" && n.scrollWidth > n.clientWidth + 2 && !/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName)) out.push("text cut " + label(n));
      }
      // finger-size controls: buttons, inputs, and links that are not words inside running text
      for (const n of all.filter((x) => x.matches("button, [role=button], input:not([type=hidden]), select, a[href]"))) {
        const r = n.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh * 3) continue;
        const inText = n.tagName === "A" && n.parentElement && getComputedStyle(n).display === "inline" && /^(P|LI|SPAN|DD|TD|LABEL|SMALL|EM|B|STRONG)$/.test(n.parentElement.tagName) && n.parentElement.textContent.trim().length > n.textContent.trim().length + 3;
        // the card's title link: the whole card is what the finger presses
        if (inText || n.matches("a.card__link")) continue;
        const box = n.matches("input[type=checkbox], input[type=radio]") ? n.closest("label") || n : n;
        const rb = box.getBoundingClientRect();
        if (rb.height < 40 && rb.width < 300 || rb.width < 40) out.push("small to tap " + Math.round(rb.width) + "×" + Math.round(rb.height) + " " + label(n));
      }
      // fixed and sticky bars over one another
      const fixed = all.filter((n) => { const p = getComputedStyle(n).position; return (p === "fixed" || p === "sticky") && n.getBoundingClientRect().height > 20; });
      for (let i = 0; i < fixed.length; i++) for (let j = i + 1; j < fixed.length; j++) {
        if (fixed[i].contains(fixed[j]) || fixed[j].contains(fixed[i])) continue;
        const a = fixed[i].getBoundingClientRect(), c = fixed[j].getBoundingClientRect();
        if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom && getComputedStyle(fixed[i]).position === "fixed" && getComputedStyle(fixed[j]).position === "fixed") out.push("fixed bars overlap " + label(fixed[i]) + " / " + label(fixed[j]));
      }
      return [...new Set(out)].slice(0, 25);
    });
    found.forEach((x) => say(w, st.name, x));
    const out = join(shots, st.name + "-" + w + ".png");
    if (st.full) await p.screenshot({ path: out, captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.min(7000, await p.evaluate(() => document.documentElement.scrollHeight)) } });
    else await p.screenshot({ path: out });
    await ctx.close();
  }
}
console.log(problems ? problems + " problems" : "phone version: no problems found");
await b.close(); srv.close();
