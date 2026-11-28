// node pdf_pages.mjs <pdf> <out dir> <node_modules parent> [scale] [first-last]
// Every page of a PDF as a PNG, drawn by pdf.js in headless Chrome (the catalogues keep their text as outlines,
// so the pages have to be looked at). The PDF is only read, as data; pdf.js comes from cdnjs.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const [pdf, out, nm, scaleArg, range] = process.argv.slice(2);
const scale = Number(scaleArg || 1.5);
mkdirSync(out, { recursive: true });
const puppeteer = (await import(pathToFileURL(join(nm, "node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")).href)).default;
const V = "3.11.174";
// degenerate gradient meshes ask the canvas for a 0-pixel image; give them one pixel instead of failing the page
const page = `<!doctype html><meta charset="utf-8"><script>
for (const C of [window.CanvasRenderingContext2D, window.OffscreenCanvasRenderingContext2D]) {
  if (!C) continue;
  const f = C.prototype.createImageData;
  C.prototype.createImageData = function (w, h, o) {
    if (typeof w === "number") return f.call(this, Math.max(1, Math.round(w) || 1), Math.max(1, Math.round(h) || 1), o);
    return f.apply(this, arguments);
  };
}
</script><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${V}/pdf.min.js"></script>
<canvas id="c"></canvas><script>
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${V}/pdf.worker.min.js";
window.doc = pdfjsLib.getDocument("/doc.pdf").promise;
window.draw = async (n, scale) => {
  const d = await window.doc, p = await d.getPage(n), v = p.getViewport({ scale });
  const c = document.getElementById("c"); c.width = Math.round(v.width); c.height = Math.round(v.height);
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  await p.render({ canvasContext: ctx, viewport: v }).promise;
  return c.toDataURL("image/png");
};
window.count = async () => (await window.doc).numPages;
</script>`;
const body = readFileSync(pdf);
const srv = createServer((q, r) => {
  if (q.url.startsWith("/doc.pdf")) { r.writeHead(200, { "content-type": "application/pdf" }); return r.end(body); }
  r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); r.end(page);
}).listen(0);
const b = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "shell", args: ["--no-sandbox"] });
const p = await b.newPage();
p.on("pageerror", (e) => console.log("page error", e.message));
await p.goto("http://127.0.0.1:" + srv.address().port + "/", { waitUntil: "networkidle0", timeout: 120000 });
const n = await p.evaluate(() => window.count());
let [a, z] = range ? range.split("-").map(Number) : [1, n];
z = Math.min(z || a, n);
console.log("pages", n, "drawing", a, "to", z);
for (let i = a; i <= z; i++) {
  // a page pdf.js cannot draw at this scale (huge gradient meshes) is retried smaller, then skipped
  for (const s of [scale, scale / 2, 0.5]) {
    try {
      const url = await p.evaluate((i, s) => window.draw(i, s), i, s);
      writeFileSync(join(out, "p-" + String(i).padStart(2, "0") + ".png"), Buffer.from(url.split(",")[1], "base64"));
      if (s !== scale) console.log("page", i, "drawn at scale", s);
      break;
    } catch (e) {
      console.log("page", i, "failed at scale", s, String(e.message || e).slice(0, 80));
    }
  }
}
await b.close(); srv.close();
console.log("done");
