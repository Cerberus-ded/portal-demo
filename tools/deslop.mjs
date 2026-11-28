// node tools/deslop.mjs [node_modules parent]
// The deslop-please linter (https://github.com/Bor4brn/deslop-please, the JavaScript/TypeScript port of
// deterministic-machines/deslop-please): module cycles, tangles, fields known outside their class, shallow modules,
// wide directories, long files. Two projects: the root scripts (tools/*.mjs, src31/*.js, r31/*.js, as tsconfig.json
// at the root lists them) and the Svelte app in app/ (its .ts and .js; .svelte files are not read: the indexer,
// scip-typescript, sees only what the TypeScript compiler reads).
// The indexer is taken from PATH, or from <node_modules parent>/node_modules/.bin when given, as puppeteer-core is.
// app/ is checked only once its packages are installed (npm ci in app/): its tsconfig extends one svelte-kit sync writes there.
// Exit status: 0 no errors, 1 errors, 2 the linter could not run.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [nm] = process.argv.slice(2);
const env = { ...process.env };
if (nm) {
  const key = Object.keys(env).find((k) => k.toUpperCase() === "PATH") || "PATH";
  env[key] = join(nm, "node_modules", ".bin") + delimiter + (env[key] || "");
}
const args = [];
if (!existsSync(join(ROOT, "app", "node_modules", "$app", "tsconfig.json"))) {
  console.log("deslop: app/ left out, its packages are not installed: run npm ci in app/ first");
  args.push("--language", "javascript");
}
const run = spawnSync(process.env.DESLOP || "deslop-please", args, { cwd: ROOT, env, stdio: "inherit" });
if (run.error) {
  console.log("deslop: cannot run deslop-please (" + run.error.code + "). Install it and its indexer:");
  console.log("  cargo install --git https://github.com/Bor4brn/deslop-please --rev acb918de --locked deslop-please");
  console.log("  npm i --prefix /tmp/nm @sourcegraph/scip-typescript@0.5.2   then: node tools/deslop.mjs /tmp/nm");
  process.exit(2);
}
process.exit(run.status ?? 2);
