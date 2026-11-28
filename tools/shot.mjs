// node shot.mjs <site dir> <node_modules parent> <page> <css selector> <out.png> [width]: a picture of one part of a page.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
const [site, nm, page, sel, out, width] = process.argv.slice(2);
const puppeteer = (await import(pathToFileURL(join(nm, "node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")).href)).default;
const T = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".webp": "image/webp" };
const srv = createServer((q, r) => { const p = join(site, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "shell", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: Number(width || 1280), height: 900 });
await p.goto("http://127.0.0.1:" + srv.address().port + "/" + page, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 700));
const el = await p.$(sel);
if (!el) { console.log("no element", sel); } else { await el.screenshot({ path: out }); console.log("ok"); }
await b.close(); srv.close();
