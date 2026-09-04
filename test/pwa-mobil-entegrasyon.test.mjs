import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

for (const path of [
  "app/manifest.webmanifest/route.ts",
  "app/terminal/page.tsx",
  "app/uygulama/page.tsx",
  "components/pwa/KurulumYakalayici.tsx",
  "public/sw.js",
]) {
  assert.ok(existsSync(join(root, path)), `${path} should exist`);
}

const manifest = read("app/manifest.webmanifest/route.ts");
assert.match(manifest, /start_url:\s*"\/terminal"/);
assert.match(manifest, /display:\s*"standalone"/);
assert.match(manifest, /purpose:\s*"maskable"/);

const install = read("components/pwa/KurulumYakalayici.tsx");
assert.match(install, /beforeinstallprompt/);
assert.match(install, /serviceWorker\.register\('\/sw\.js'\)/);

const worker = read("public/sw.js");
assert.match(worker, /const VERSION = "iyi-pwa-v2\.8\.3"/);
assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
assert.match(worker, /istek\.method !== "GET"/);
assert.match(worker, /url\.origin !== self\.location\.origin/);

const terminal = read("components/terminal/TamEkranTerminal.tsx");
assert.doesNotMatch(terminal, /visualViewport|ResizeObserver|style\.top|style\.left/);
assert.match(terminal, /iPhone\|iPad\|iPod/);
assert.match(terminal, /window\.location\.replace\(terminalUrl\)/);

const terminalCss = read("app/terminal/terminal.css");
assert.match(terminalCss, /\.tm \{ position: fixed; inset: 0;/);
assert.match(terminalCss, /\.tm iframe \{ display: block; width: 100%; height: 100%;/);

console.log("PWA mobile integration contract passed.");
