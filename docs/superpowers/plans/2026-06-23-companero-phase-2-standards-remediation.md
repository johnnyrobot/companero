# Companero Phase 2 — Standards Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all 10 gaps from the Phase 1 Gap Analysis — restore PWA installability, eliminate the stale-asset/stale-app bugs via a content-hashing build, harden the nginx/Docker edge, modernize CI, and polish app-level robustness — without breaking the app's local-only, privacy-first behavior.

**Architecture:** Introduce a tiny pure-Node build (`build.mjs`) that content-hashes `app.js`/`styles.css`/`translations.js` + icons into `dist/`, rewrites every reference (HTML, manifest, service worker), and derives the service-worker `CACHE_NAME` from the build hash. The service worker becomes network-first for navigations and cache-first only for content-addressed (immutable) assets. nginx serves hashed assets `immutable` and HTML/SW/manifest `no-cache`, plus a shared security-headers snippet. A multi-stage Dockerfile runs the build then serves `dist/` from a pinned `nginx:1.30-alpine`.

**Tech Stack:** Vanilla JS (ES modules), Node ≥ 20 build/test tooling (`node:test`, `node:crypto`, `node:fs`), `sharp` (dev-only, icon generation), `jsdom` (dev-only, DOM tests), nginx, Docker (multi-stage), GitHub Actions.

## Global Constraints

- **No production dependencies in the served image.** `build.mjs` uses only Node built-ins. `sharp`/`jsdom` are `devDependencies` only.
- **Node floor:** `>=20` (for stable `node:test`). Build stage image: `node:22-alpine`. Runtime image: `nginx:1.30-alpine` (current stable line, confirmed 1.30.3 / Apr 2026 branch).
- **Pin all images by tag AND digest** (resolve digests with the command given in Task 8). Never use a floating bare tag.
- **GitHub Actions versions (off Node 20):** `actions/checkout@v5`, `docker/setup-buildx-action@v4`, `docker/build-push-action@v7`.
- **Privacy invariant:** all data stays on-device. No network calls added for user data. Storage keys preserved for backward-compat: `student_planner.classes.v1`, `course_companion.profile.v1`.
- **Container contract unchanged:** host port `6969 → 80`, `container_name: companero`, healthcheck preserved.
- **Manifest icon `purpose` rule:** separate `any` and `maskable` entries — never the combined `"any maskable"` string.
- **Source files stay runnable/lintable:** the service-worker source keeps valid default `CACHE_NAME`/`APP_SHELL` values that the build overwrites (no opaque placeholder tokens).

---

## File Structure

**Created:**
- `package.json` — scripts (`build`, `test`, `icons`), devDeps, Node engines floor.
- `build.mjs` — content-hashing build → `dist/`. Exports `build({srcDir, outDir})`.
- `scripts/generate-icons.mjs` — renders the "Co" lettermark to PNG icons (run once / on rebrand).
- `scripts/smoke-test.sh` — builds image, runs container, asserts cache + security headers.
- `tests/build.test.mjs` — unit tests for the hashing build.
- `tests/icons.test.mjs` — asserts icon files exist, are valid PNGs, correct dimensions.
- `tests/dialogs.test.mjs` — `confirmDialog`/`alertDialog` behavior (jsdom).
- `tests/store.test.mjs` — IndexedDB store + localStorage migration (jsdom + fake-idb shim).
- `src/dialogs.js` — accessible non-blocking modal helpers.
- `src/store.js` — async storage abstraction (IndexedDB + localStorage migration/fallback).
- `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png` — generated, committed.
- `nginx/security-headers.conf` — shared `add_header` snippet (included per-location).
- `docs/superpowers/plans/2026-06-23-companero-phase-2-standards-remediation.md` — this plan.

**Modified:**
- `index.html` — script/style refs become build-rewritten; footer inline `style=""` moved to a CSS class (for strict CSP); dialog/store wiring.
- `app.js` — consume `src/dialogs.js` + `src/store.js`; async init flow.
- `styles.css` — add `.footer-actions` class (replaces inline style); dialog styles.
- `service-worker.js` — templated `CACHE_NAME`/`APP_SHELL`; network-first navigations.
- `manifest.webmanifest` — split icon purposes; add `id`; refs build-rewritten.
- `nginx.conf` — correct cache rules; include security headers; serve from `dist` layout.
- `Dockerfile` — multi-stage (node build → pinned nginx), copy `dist/`.
- `docker-compose.yml` — unchanged behavior (already modern; confirm no `version:` key).
- `.dockerignore` — exclude `node_modules`, `tests`, `dist` from build context root.
- `.github/workflows/ci.yml` — bump actions; add Node build+test stage.

**Note on independent sub-plans:** Tasks 1–9 form the core (build → assets → SW → edge → CI) and are the shippable spine. Tasks 10–11 (dialogs, IndexedDB) are app-level polish and could be split into a follow-up plan; Task 11 (IndexedDB) is the lowest-value/highest-churn item — see its YAGNI note.

---

### Task 1: Project scaffolding & test harness

**Files:**
- Create: `package.json`
- Create: `tests/smoke.test.mjs`
- Modify: `.gitignore` (add `node_modules/`, `dist/`)

**Interfaces:**
- Produces: npm scripts `npm test` (runs `node --test`), `npm run build` (runs `node build.mjs`), `npm run icons` (runs `node scripts/generate-icons.mjs`). Node engines `>=20`.

- [ ] **Step 1: Write the failing test**

`tests/smoke.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('test harness runs', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 2: Run it to verify it fails (no runner yet)**

Run: `npm test`
Expected: FAIL — `npm error Missing script: "test"` (no `package.json`).

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "companero",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "node build.mjs",
    "test": "node --test",
    "icons": "node scripts/generate-icons.mjs"
  },
  "devDependencies": {
    "jsdom": "^24.1.0",
    "sharp": "^0.33.4"
  }
}
```

- [ ] **Step 4: Add build artifacts + deps to `.gitignore`**

Append to `.gitignore`:
```
node_modules/
dist/
```

- [ ] **Step 5: Install and run the test**

Run: `npm install && npm test`
Expected: PASS — `tests 1 / pass 1 / fail 0`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore tests/smoke.test.mjs
git commit -m "build: add Node test harness and package scaffolding"
```

---

### Task 2: Content-hashing build — assets + index.html

**Files:**
- Create: `build.mjs`
- Create: `tests/build.test.mjs`

**Interfaces:**
- Produces: `export async function build({ srcDir, outDir })` → returns `{ hashes: Map<string,string>, buildHash: string }`. Hashes `app.js`, `styles.css`, `translations.js` into `dist/<name>.<hash8>.<ext>`; writes `dist/index.html` with the three `./name.ext` refs rewritten to hashed names. `hash8` = first 8 hex chars of sha256 of file bytes. `buildHash` = first 8 hex of sha256 over the sorted concatenation of the individual asset hashes.

- [ ] **Step 1: Write the failing test**

`tests/build.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../build.mjs';

async function fixture() {
  const src = await mkdtemp(join(tmpdir(), 'cmp-src-'));
  const out = await mkdtemp(join(tmpdir(), 'cmp-out-'));
  await writeFile(join(src, 'app.js'), 'console.log("app");');
  await writeFile(join(src, 'styles.css'), 'body{color:#fff}');
  await writeFile(join(src, 'translations.js'), 'const t={};');
  await mkdir(join(src, 'icons'), { recursive: true });
  await writeFile(join(src, 'icons', 'icon-192.png'), Buffer.from('png192'));
  await writeFile(join(src, 'icons', 'icon-512.png'), Buffer.from('png512'));
  await writeFile(join(src, 'icons', 'icon-maskable-512.png'), Buffer.from('pngmask'));
  await writeFile(join(src, 'manifest.webmanifest'),
    JSON.stringify({ icons: [{ src: 'icons/icon-192.png' }, { src: 'icons/icon-512.png' }, { src: 'icons/icon-maskable-512.png' }] }));
  await writeFile(join(src, 'service-worker.js'),
    "const CACHE_NAME = 'companero-dev';\nconst APP_SHELL = ['./','./index.html'];\n");
  await writeFile(join(src, 'index.html'),
    '<link rel="stylesheet" href="./styles.css">' +
    '<script src="./translations.js"></script>' +
    '<script src="./app.js" defer></script>');
  return { src, out };
}

test('hashes assets and rewrites index.html refs', async () => {
  const { src, out } = await fixture();
  await build({ srcDir: src, outDir: out });
  const files = await readdir(out);
  assert.ok(files.some(f => /^app\.[0-9a-f]{8}\.js$/.test(f)), 'hashed app.js present');
  assert.ok(files.some(f => /^styles\.[0-9a-f]{8}\.css$/.test(f)), 'hashed styles.css present');
  assert.ok(files.some(f => /^translations\.[0-9a-f]{8}\.js$/.test(f)), 'hashed translations.js present');
  const html = await readFile(join(out, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /\.\/app\.js/, 'raw app.js ref removed');
  assert.match(html, /\.\/app\.[0-9a-f]{8}\.js/, 'hashed app.js ref written');
  assert.match(html, /\.\/styles\.[0-9a-f]{8}\.css/, 'hashed styles.css ref written');
});

test('build hash is deterministic for identical input', async () => {
  const a = await fixture();
  const b = await fixture();
  const r1 = await build({ srcDir: a.src, outDir: a.out });
  const r2 = await build({ srcDir: b.src, outDir: b.out });
  assert.equal(r1.buildHash, r2.buildHash);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../build.mjs'`.

- [ ] **Step 3: Implement `build.mjs` (asset + HTML rewriting)**

```js
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HASHED_ASSETS = ['app.js', 'styles.css', 'translations.js'];
const HASHED_ICONS = ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

const hash8 = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 8);
const hashedName = (path, h) => path.replace(/(\.[^.]+)$/, `.${h}$1`);

export async function build({ srcDir, outDir }) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, 'icons'), { recursive: true });

  const hashes = new Map();         // original path -> hashed path
  const orderedHashes = [];

  for (const rel of [...HASHED_ASSETS, ...HASHED_ICONS]) {
    const bytes = await readFile(join(srcDir, rel));
    const h = hash8(bytes);
    const outRel = hashedName(rel, h);
    hashes.set(rel, outRel);
    orderedHashes.push(`${rel}:${h}`);
    await writeFile(join(outDir, outRel), bytes);
  }

  const buildHash = hash8(Buffer.from(orderedHashes.sort().join('|')));

  // index.html: rewrite the three top-level asset refs
  let html = await readFile(join(srcDir, 'index.html'), 'utf8');
  for (const rel of HASHED_ASSETS) {
    html = html.split(`./${rel}`).join(`./${hashes.get(rel)}`);
  }
  await writeFile(join(outDir, 'index.html'), html);

  return { hashes, buildHash };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = dirname(fileURLToPath(import.meta.url));
  await build({ srcDir: root, outDir: join(root, 'dist') });
  console.log('build: dist/ ready');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — both `tests/build.test.mjs` cases green (smoke test still passes).

- [ ] **Step 5: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "build: content-hash assets and rewrite index.html refs"
```

---

### Task 3: Build — service-worker `CACHE_NAME`/`APP_SHELL` + manifest icon rewriting

**Files:**
- Modify: `build.mjs`
- Modify: `tests/build.test.mjs`

**Interfaces:**
- Consumes: `build()` from Task 2.
- Produces: `dist/service-worker.js` with `CACHE_NAME` replaced by `companero-<buildHash>` and `APP_SHELL` replaced by the hashed shell array; `dist/manifest.webmanifest` with each icon `src` rewritten to its hashed path. Shell = `['./','./index.html', hashed styles, hashed app, hashed translations, './manifest.webmanifest', hashed 192 icon, hashed 512 icon]`.

- [ ] **Step 1: Write the failing test (extend build.test.mjs)**

Append to `tests/build.test.mjs`:
```js
test('templates service worker CACHE_NAME and APP_SHELL', async () => {
  const { src, out } = await fixture();
  const { buildHash } = await build({ srcDir: src, outDir: out });
  const sw = await readFile(join(out, 'service-worker.js'), 'utf8');
  assert.match(sw, new RegExp(`const CACHE_NAME = 'companero-${buildHash}'`));
  assert.match(sw, /APP_SHELL = \[[\s\S]*app\.[0-9a-f]{8}\.js[\s\S]*\]/);
  assert.doesNotMatch(sw, /companero-dev/);
});

test('rewrites manifest icon srcs to hashed paths', async () => {
  const { src, out } = await fixture();
  await build({ srcDir: src, outDir: out });
  const manifest = JSON.parse(await readFile(join(out, 'manifest.webmanifest'), 'utf8'));
  for (const icon of manifest.icons) {
    assert.match(icon.src, /icons\/icon-(192|512|maskable-512)\.[0-9a-f]{8}\.png/);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `service-worker.js` not found in `dist/` (build doesn't emit it yet).

- [ ] **Step 3: Extend `build.mjs`**

Add before the `return` in `build()`:
```js
  // service-worker.js: inject build hash + hashed precache shell
  const shell = [
    './', './index.html',
    `./${hashes.get('styles.css')}`,
    `./${hashes.get('app.js')}`,
    `./${hashes.get('translations.js')}`,
    './manifest.webmanifest',
    `./${hashes.get('icons/icon-192.png')}`,
    `./${hashes.get('icons/icon-512.png')}`,
  ];
  let sw = await readFile(join(srcDir, 'service-worker.js'), 'utf8');
  sw = sw.replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = 'companero-${buildHash}';`);
  sw = sw.replace(/const APP_SHELL = \[[\s\S]*?\];/, `const APP_SHELL = ${JSON.stringify(shell, null, 2)};`);
  await writeFile(join(outDir, 'service-worker.js'), sw);

  // manifest.webmanifest: rewrite icon srcs
  const manifest = JSON.parse(await readFile(join(srcDir, 'manifest.webmanifest'), 'utf8'));
  manifest.icons = manifest.icons.map(icon => ({ ...icon, src: hashes.get(icon.src) || icon.src }));
  await writeFile(join(outDir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all `build.test.mjs` cases green.

- [ ] **Step 5: Commit**

```bash
git add build.mjs tests/build.test.mjs
git commit -m "build: inject hashed CACHE_NAME/APP_SHELL and manifest icon refs"
```

---

### Task 4: Generate PWA icons (Gap #1)

**Files:**
- Create: `scripts/generate-icons.mjs`
- Create: `tests/icons.test.mjs`
- Create (generated, committed): `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`
- Modify: `icons/README.txt` (note files are generated)

**Interfaces:**
- Produces: three PNG files. `icon-192.png` (192×192, full-bleed "Co" mark), `icon-512.png` (512×512, full-bleed), `icon-maskable-512.png` (512×512, mark scaled to ~80% with safe-zone padding on `#111` background).

- [ ] **Step 1: Write the failing test**

`tests/icons.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const dims = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }); // IHDR

async function checkIcon(rel, size) {
  const buf = await readFile(join('icons', rel));
  assert.ok(buf.subarray(0, 8).equals(PNG_SIG), `${rel} is a PNG`);
  assert.deepEqual(dims(buf), { w: size, h: size }, `${rel} is ${size}x${size}`);
}

test('icon-192.png exists and is 192x192', () => checkIcon('icon-192.png', 192));
test('icon-512.png exists and is 512x512', () => checkIcon('icon-512.png', 512));
test('icon-maskable-512.png exists and is 512x512', () => checkIcon('icon-maskable-512.png', 512));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `ENOENT` opening `icons/icon-192.png`.

- [ ] **Step 3: Implement `scripts/generate-icons.mjs`**

```js
import sharp from 'sharp';
import { join } from 'node:path';

const BG = '#111111';
const FG = '#ffffff';
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Full-bleed "Co" lettermark on a rounded-square background.
const svg = (size, inset) => {
  const r = Math.round(size * 0.18);
  const fontSize = Math.round((size - inset * 2) * 0.42);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${r}" fill="${BG}"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
      font-family="${FONT}" font-weight="600" font-size="${fontSize}" fill="${FG}">Co</text>
  </svg>`;
};

async function render(svgStr, size, outRel) {
  await sharp(Buffer.from(svgStr)).resize(size, size).png().toFile(join('icons', outRel));
  console.log('icons:', outRel);
}

await render(svg(192, 0), 192, 'icon-192.png');
await render(svg(512, 0), 512, 'icon-512.png');
// Maskable: extra padding so the mark survives platform mask cropping (safe zone ~80%).
await render(svg(512, 52), 512, 'icon-maskable-512.png');
```

- [ ] **Step 4: Generate the icons and run the tests**

Run: `npm run icons && npm test`
Expected: three `icons:` lines, then PASS — all three icon tests green.

- [ ] **Step 5: Note generation in `icons/README.txt`**

Replace contents of `icons/README.txt`:
```
Icons are generated from the "Co" lettermark by scripts/generate-icons.mjs.
Regenerate after a rebrand with: npm run icons
- icon-192.png         (192x192, purpose "any")
- icon-512.png         (512x512, purpose "any")
- icon-maskable-512.png (512x512, purpose "maskable", padded safe zone)
```

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-icons.mjs tests/icons.test.mjs icons/
git commit -m "feat(pwa): generate any + maskable PWA icons (fixes broken install)"
```

---

### Task 5: Manifest — split icon purposes + add `id` (Gaps #4, #8)

**Files:**
- Modify: `manifest.webmanifest`
- Create: `tests/manifest.test.mjs`

**Interfaces:**
- Consumes: hashed icon files from Task 4; build rewriting from Task 3.
- Produces: manifest with `id: "/"`, separate icon entries (`icon-192.png` + `icon-512.png` as `purpose: "any"`, `icon-maskable-512.png` as `purpose: "maskable"`), no combined `"any maskable"`.

- [ ] **Step 1: Write the failing test**

`tests/manifest.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('manifest has id and split icon purposes', async () => {
  const m = JSON.parse(await readFile('manifest.webmanifest', 'utf8'));
  assert.ok(m.id, 'has id');
  const purposes = m.icons.map(i => i.purpose);
  assert.ok(!purposes.some(p => /any\s+maskable|maskable\s+any/.test(p || '')), 'no combined any+maskable');
  assert.ok(m.icons.some(i => i.purpose === 'any' && i.sizes === '512x512'), 'has a 512 any icon');
  assert.ok(m.icons.some(i => i.purpose === 'maskable'), 'has a maskable icon');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — combined `"any maskable"` still present / no `id`.

- [ ] **Step 3: Update `manifest.webmanifest`**

```json
{
  "name": "Companero",
  "short_name": "Companero",
  "id": "/",
  "description": "Quick reference for your course details. Local-only and offline-capable.",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#0f0f0f",
  "theme_color": "#111111",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — `tests/manifest.test.mjs` green; `build.test.mjs` icon-rewrite test still green (fixture already uses three icons).

- [ ] **Step 5: Commit**

```bash
git add manifest.webmanifest tests/manifest.test.mjs
git commit -m "fix(pwa): split icon purposes and add manifest id"
```

---

### Task 6: Service worker — network-first navigations, cache-first immutable assets (Gap #3)

**Files:**
- Modify: `service-worker.js`
- Create: `tests/sw-routing.test.mjs`

**Interfaces:**
- Consumes: build templating (Task 3).
- Produces: an exported pure helper `routeFor(req)` returning `'navigate'` | `'asset'` (so routing is unit-testable), and a fetch handler that uses network-first for `'navigate'`, cache-first for `'asset'`. Source keeps default `CACHE_NAME = 'companero-dev'` and a minimal default `APP_SHELL` (overwritten by build).

- [ ] **Step 1: Write the failing test**

`tests/sw-routing.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeFor } from '../service-worker.js';

const req = (url, mode = 'cors', method = 'GET') => ({ url, mode, method });

test('navigation requests route to navigate', () => {
  assert.equal(routeFor(req('https://x/', 'navigate')), 'navigate');
});

test('hashed asset requests route to asset', () => {
  assert.equal(routeFor(req('https://x/app.deadbeef.js')), 'asset');
});
```

> The source SW must be importable under Node for this test. Guard the `self.addEventListener` calls so they only run in a service-worker scope.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `routeFor` is not exported.

- [ ] **Step 3: Rewrite `service-worker.js`**

```js
// service-worker.js

const CACHE_NAME = 'companero-dev';            // build overwrites with content hash
const APP_SHELL = ['./', './index.html'];      // build overwrites with hashed shell

// Pure router — unit-testable, no side effects.
export function routeFor(req) {
  if (req.mode === 'navigate') return 'navigate';
  return 'asset';
}

const isSW = typeof self !== 'undefined' && 'ServiceWorkerGlobalScope' in self
  && self instanceof self.ServiceWorkerGlobalScope;

if (isSW) {
  self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL)));
    // No auto-skipWaiting: the page prompts the user (avoids version skew).
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )).then(() => self.clients.claim())
    );
  });

  self.addEventListener('message', (event) => {
    if (!event || !event.data) return;
    if (event.data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
    if (event.data.type === 'GET_VERSION') {
      try { event.source?.postMessage({ type: 'VERSION', version: CACHE_NAME }); } catch {}
    }
  });

  self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== location.origin) return;

    if (routeFor(req) === 'navigate') {
      // Network-first: pick up new deploys immediately; fall back to cache offline.
      event.respondWith(
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        }).catch(() => caches.match('./index.html').then((r) => r || caches.match(req)))
      );
      return;
    }

    // Content-addressed assets are immutable → cache-first.
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => new Response('Offline', { status: 503, statusText: 'Offline' })))
    );
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — `sw-routing.test.mjs` green; `build.test.mjs` SW-templating test still green (regex still matches `const CACHE_NAME = '...'` and `const APP_SHELL = [...]`).

- [ ] **Step 5: Commit**

```bash
git add service-worker.js tests/sw-routing.test.mjs
git commit -m "fix(sw): network-first navigations, cache-first immutable assets"
```

---

### Task 7: nginx — correct caching + security headers (Gaps #2, #6)

**Files:**
- Modify: `nginx.conf`
- Create: `nginx/security-headers.conf`
- Modify: `index.html` (move footer inline `style=""` to a class — enables strict CSP)
- Modify: `styles.css` (add `.footer-actions`)

**Interfaces:**
- Consumes: `dist/` layout (hashed assets, unhashed `index.html`/`service-worker.js`/`manifest.webmanifest`).
- Produces: `immutable` 1y caching ONLY for hashed assets; `no-cache` for `index.html`, `service-worker.js`, `manifest.webmanifest`; security headers applied to every response via the shared snippet.

- [ ] **Step 1: Create the security-headers snippet**

`nginx/security-headers.conf`:
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "geolocation=(), camera=(), microphone=(), interest-cohort=()" always;
add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; manifest-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'" always;
# Enable HSTS only when served over HTTPS (e.g. behind a TLS-terminating proxy):
# add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

- [ ] **Step 2: Move the footer inline style out of `index.html`**

In `index.html`, replace:
```html
    <div class="list-actions" style="justify-content:center; margin-top: 0.5rem; gap: 0.75rem;">
```
with:
```html
    <div class="list-actions footer-actions">
```

Add to `styles.css`:
```css
.footer-actions { justify-content: center; margin-top: 0.5rem; gap: 0.75rem; }
```

- [ ] **Step 3: Rewrite `nginx.conf`**

```nginx
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    include /etc/nginx/conf.d/security-headers.conf;
    try_files $uri /index.html;
  }

  # Content-hashed assets (filenames change on every content change) → immutable.
  location ~* "\.[0-9a-f]{8}\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$" {
    include /etc/nginx/conf.d/security-headers.conf;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    try_files $uri =404;
  }

  # HTML, service worker, manifest are unhashed → must always revalidate.
  location = /index.html {
    include /etc/nginx/conf.d/security-headers.conf;
    add_header Cache-Control "no-cache" always;
  }
  location = /service-worker.js {
    include /etc/nginx/conf.d/security-headers.conf;
    add_header Cache-Control "no-cache" always;
  }
  location = /manifest.webmanifest {
    include /etc/nginx/conf.d/security-headers.conf;
    add_header Cache-Control "no-cache" always;
  }
}
```

> Note: nginx `add_header` does not inherit into locations that declare their own `add_header`, so the snippet is `include`d in each block (DRY via the shared file). The Dockerfile (Task 8) copies `security-headers.conf` next to `default.conf`.

- [ ] **Step 4: Verify config syntax with a throwaway container**

Run:
```bash
docker run --rm -v "$PWD/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$PWD/nginx/security-headers.conf:/etc/nginx/conf.d/security-headers.conf:ro" \
  nginx:1.30-alpine nginx -t
```
Expected: `syntax is ok` / `test is successful`.

- [ ] **Step 5: Commit**

```bash
git add nginx.conf nginx/security-headers.conf index.html styles.css
git commit -m "fix(nginx): immutable only for hashed assets; add security headers"
```

---

### Task 8: Multi-stage Dockerfile + pinned images (Gap #5)

**Files:**
- Modify: `Dockerfile`
- Modify: `.dockerignore`
- Create: `scripts/smoke-test.sh`

**Interfaces:**
- Consumes: `build.mjs`, `nginx.conf`, `nginx/security-headers.conf`.
- Produces: an image that runs `npm ci && npm run build` in a `node:22-alpine` stage, then serves `dist/` from `nginx:1.30-alpine`. Smoke test asserts a hashed asset returns `immutable` and `index.html` returns `no-cache` + CSP.

- [ ] **Step 1: Resolve and record image digests**

Run:
```bash
docker buildx imagetools inspect node:22-alpine | grep -i digest | head -1
docker buildx imagetools inspect nginx:1.30-alpine | grep -i digest | head -1
```
Use the printed `sha256:...` values in the next step (replace `<NODE_DIGEST>` / `<NGINX_DIGEST>`).

- [ ] **Step 2: Rewrite `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

# --- build stage: content-hash assets into dist/ ---
FROM node:22-alpine@<NODE_DIGEST> AS build
WORKDIR /app
COPY package.json package-lock.json ./
# build.mjs uses only Node built-ins; sharp/jsdom are dev-only (icon-gen/tests).
# --omit=dev avoids compiling native sharp in the Alpine build stage.
RUN npm ci --omit=dev
COPY . .
RUN npm run build

# --- runtime stage: serve dist/ via pinned nginx ---
FROM nginx:1.30-alpine@<NGINX_DIGEST>
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/conf.d/security-headers.conf
RUN apk add --no-cache curl
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -fsS http://localhost/ || exit 1
```

- [ ] **Step 3: Update `.dockerignore`**

```
node_modules
dist
tests
.git
.github
docs
```

- [ ] **Step 4: Write the smoke test**

`scripts/smoke-test.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
IMG=companero:smoke
docker build -t "$IMG" .
docker run -d --rm -p 8099:80 --name companero_smoke "$IMG"
trap 'docker stop companero_smoke >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 20); do curl -fsS http://localhost:8099/ >/dev/null 2>&1 && break; sleep 0.5; done

# index.html must be no-cache + carry CSP
idx=$(curl -sI http://localhost:8099/index.html)
echo "$idx" | grep -iq 'cache-control: no-cache' || { echo "FAIL: index.html not no-cache"; exit 1; }
echo "$idx" | grep -iq 'content-security-policy' || { echo "FAIL: missing CSP"; exit 1; }
echo "$idx" | grep -iq 'x-content-type-options: nosniff' || { echo "FAIL: missing nosniff"; exit 1; }

# a hashed asset must be immutable
asset=$(curl -s http://localhost:8099/index.html | grep -oE '\./[a-z]+\.[0-9a-f]{8}\.(js|css)' | head -1)
[ -n "$asset" ] || { echo "FAIL: no hashed asset ref in index.html"; exit 1; }
hdr=$(curl -sI "http://localhost:8099/${asset#./}")
echo "$hdr" | grep -iq 'cache-control: public, max-age=31536000, immutable' || { echo "FAIL: asset not immutable"; exit 1; }

# service worker must be no-cache
curl -sI http://localhost:8099/service-worker.js | grep -iq 'cache-control: no-cache' || { echo "FAIL: SW not no-cache"; exit 1; }
echo "SMOKE OK"
```

- [ ] **Step 5: Run the smoke test**

Run: `chmod +x scripts/smoke-test.sh && ./scripts/smoke-test.sh`
Expected: ends with `SMOKE OK`.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore scripts/smoke-test.sh
git commit -m "build(docker): multi-stage build, pinned images, header smoke test"
```

---

### Task 9: CI — bump actions off Node 20 + add build/test stage (Gap #7)

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm test`, `npm run build`, the Docker build.
- Produces: a CI run on current (Node 24) action majors that runs unit tests, then builds + smoke-tests the image.

- [ ] **Step 1: Rewrite `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [ main, master ]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - name: Install
        run: npm ci
      - name: Unit tests
        run: npm test
      - name: Build
        run: npm run build

  build-and-smoke-test:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - name: Checkout
        uses: actions/checkout@v5
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v4
      - name: Build image
        uses: docker/build-push-action@v7
        with:
          context: .
          file: ./Dockerfile
          push: false
          load: true
          tags: companero:test
      - name: Smoke test (cache + security headers)
        run: |
          docker run -d --rm -p 8080:80 --name cc companero:test
          for i in $(seq 1 20); do curl -fsS http://localhost:8080/ >/dev/null 2>&1 && break; sleep 0.5; done
          curl -sI http://localhost:8080/index.html | grep -iq 'cache-control: no-cache'
          curl -sI http://localhost:8080/index.html | grep -iq 'content-security-policy'
      - name: Stop container
        if: always()
        run: docker stop cc || true
```

- [ ] **Step 2: Validate the workflow locally**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('yaml ok')"`
Expected: `yaml ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: bump actions to Node-24 majors; add unit-test + build stage"
```

---

### Task 10: Accessible non-blocking dialogs (Gap #10)

**Files:**
- Create: `src/dialogs.js`
- Create: `tests/dialogs.test.mjs`
- Modify: `app.js` (convert to ES module; replace ALL 9 `confirm()`/`alert()` call sites)
- Modify: `index.html` (load `app.js` as `<script type="module">`)
- Modify: `styles.css` (dialog styling)
- Modify: `build.mjs` (register `src/` ES modules: copy verbatim + fold bytes into `buildHash` + add to SW `APP_SHELL`)
- Modify: `tests/build.test.mjs` (fixtures must create `src/dialogs.js`; add regression tests)
- Modify: `nginx.conf` (add `^~ /src/` no-cache location)
- Modify: `scripts/smoke-test.sh` (assert `/src/dialogs.js` serves `no-cache`)

**Interfaces:**
- Produces: `export function confirmDialog(message)` → `Promise<boolean>` and `export function alertDialog(message)` → `Promise<void>`, rendering an accessible modal (`role="dialog"`, `aria-modal="true"`, focus moved to the dialog, `Escape`/backdrop = cancel). Consumed by `app.js` in place of native blocking dialogs.

- [ ] **Step 1: Write the failing test**

`tests/dialogs.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { confirmDialog } from '../src/dialogs.js';

test('confirmDialog resolves true when confirmed', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  const p = confirmDialog('Delete?');
  document.querySelector('[data-dialog-confirm]').click();
  assert.equal(await p, true);
  assert.equal(document.querySelector('[role="dialog"]'), null, 'dialog removed after close');
});

test('confirmDialog resolves false when cancelled', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  const p = confirmDialog('Delete?');
  document.querySelector('[data-dialog-cancel]').click();
  assert.equal(await p, false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/dialogs.js'`.

- [ ] **Step 3: Implement `src/dialogs.js`**

```js
// src/dialogs.js — accessible, non-blocking replacements for confirm()/alert().

function openDialog({ message, confirmLabel, cancelLabel }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const text = document.createElement('p');
    text.className = 'dialog-message';
    text.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn primary';
    confirmBtn.type = 'button';
    confirmBtn.textContent = confirmLabel;
    confirmBtn.setAttribute('data-dialog-confirm', '');

    let cancelBtn = null;
    if (cancelLabel != null) {
      cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn';
      cancelBtn.type = 'button';
      cancelBtn.textContent = cancelLabel;
      cancelBtn.setAttribute('data-dialog-cancel', '');
    }

    function close(value) {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    }
    function onKey(e) { if (e.key === 'Escape' && cancelLabel != null) close(false); }

    confirmBtn.addEventListener('click', () => close(cancelLabel != null ? true : undefined));
    cancelBtn?.addEventListener('click', () => close(false));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop && cancelLabel != null) close(false); });
    document.addEventListener('keydown', onKey);

    actions.append(confirmBtn);
    if (cancelBtn) actions.prepend(cancelBtn);
    dialog.append(text, actions);
    backdrop.append(dialog);
    document.body.append(backdrop);
    confirmBtn.focus();
  });
}

export function confirmDialog(message, { confirmLabel = 'OK', cancelLabel = 'Cancel' } = {}) {
  return openDialog({ message, confirmLabel, cancelLabel });
}

export function alertDialog(message, { confirmLabel = 'OK' } = {}) {
  return openDialog({ message, confirmLabel, cancelLabel: null });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — both `dialogs.test.mjs` cases green.

- [ ] **Step 5: Register `src/` modules in `build.mjs` (caching fix — do NOT `cp` verbatim)**

`src/dialogs.js` is imported by the content-hashed `app.js`. A naive verbatim copy would (a) fall to nginx `location /` with no `Cache-Control` and (b) not affect `buildHash`/`CACHE_NAME` — reintroducing Gaps #2/#3 for that module. **Resolution (decided):** keep a **stable filename**, **fold its bytes into `buildHash`** (so any change busts `CACHE_NAME`), **precache it in `APP_SHELL`**, and serve it **`no-cache`** from nginx (Step 8). Do not content-hash its filename and do not rewrite import specifiers — `app.js`'s `import './src/dialogs.js'` is relative to `app.js`'s directory and is unaffected by `app.js`'s own hashing.

Edit `build.mjs`:

After the `HASHED_ICONS` constant, add:
```js
const COPIED_MODULES = ['src/dialogs.js']; // stable-named ES modules imported by app.js; bytes folded into buildHash, precached, served no-cache
```
After `await mkdir(join(outDir, 'icons'), { recursive: true });` add:
```js
  await mkdir(join(outDir, 'src'), { recursive: true });
```
Immediately AFTER the `for (const rel of [...HASHED_ASSETS, ...HASHED_ICONS]) { ... }` loop and BEFORE `const buildHash = ...`, add:
```js
  // Stable-named modules: copy verbatim, fold bytes into buildHash so any change busts CACHE_NAME.
  for (const rel of COPIED_MODULES) {
    const bytes = await readFile(join(srcDir, rel));
    orderedHashes.push(`${rel}:${hash8(bytes)}`);
    await writeFile(join(outDir, rel), bytes);
  }
```
In the `shell` array, add a final entry so the module is precached:
```js
    `./${hashes.get('icons/icon-512.png')}`,
    ...COPIED_MODULES.map((rel) => `./${rel}`),
  ];
```

- [ ] **Step 6: Build regression tests (`tests/build.test.mjs`)**

The shared `fixture()` AND the inline fixture inside the "throws when manifest icon src is not in hashes" test must now also create `src/dialogs.js`, or `build()` throws `ENOENT`. In BOTH fixtures, after the icons are written, add:
```js
  await mkdir(join(src, 'src'), { recursive: true });
  await writeFile(join(src, 'src', 'dialogs.js'), 'export function confirmDialog(){}');
```
Then add these tests:
```js
test('copies src modules verbatim with stable names', async () => {
  const { src, out } = await fixture();
  await build({ srcDir: src, outDir: out });
  const mod = await readFile(join(out, 'src', 'dialogs.js'), 'utf8');
  assert.equal(mod, 'export function confirmDialog(){}', 'src/dialogs.js copied byte-for-byte');
});

test('src module changes bust the build hash (CACHE_NAME)', async () => {
  const a = await fixture();
  const r1 = await build({ srcDir: a.src, outDir: a.out });
  await writeFile(join(a.src, 'src', 'dialogs.js'), 'export function confirmDialog(){ return 1; }');
  const r2 = await build({ srcDir: a.src, outDir: a.out });
  assert.notEqual(r1.buildHash, r2.buildHash, 'changing a src module must change buildHash');
});

test('precaches src modules in APP_SHELL', async () => {
  const { src, out } = await fixture();
  await build({ srcDir: src, outDir: out });
  const sw = await readFile(join(out, 'service-worker.js'), 'utf8');
  assert.match(sw, /\.\/src\/dialogs\.js/, 'src module present in APP_SHELL');
});
```
Run: `npm test` — expected PASS (existing build tests still green + 3 new).

- [ ] **Step 7: Wire dialogs into `app.js` + `index.html` + `styles.css`**

In `index.html`, make `app.js` a module (translations.js stays a classic script — it runs at parse time, before the deferred module, so its globals stay available; verified there are no inline `on*=` handlers depending on `app.js` globals):
```html
  <script src="./translations.js"></script>
  <script type="module" src="./app.js"></script>
```
At the top of `app.js` add:
```js
import { confirmDialog, alertDialog } from './src/dialogs.js';
```
Replace **all 9** call sites (grep `\b(confirm|alert)\s*\(` to confirm none are missed). `confirm(x)` → `await confirmDialog(x)`, `alert(x)` → `await alertDialog(x)`, and the enclosing function must be `async`:
- L184 (`deleteAllBtn` handler — already `async`): `const ok = await confirmDialog(message);`
- L272 (`delBtn` handler — make `async`): `delBtn.addEventListener('click', async () => { if (await confirmDialog(t('confirmDelete'))) deleteItem(item.id); });`
- L340/353/355 (`reader.onload` — make `async`): `if (!(await confirmDialog(t('importReplaceConfirm')))) return;` … `await alertDialog(t('importComplete'));` … `await alertDialog(t('importFailed'));` (the `finally { importInput.value=''; }` stays)
- L509 (`checkUpdatesBtn` handler — already `async`): `await alertDialog(msg);`
- L539 (inside `setTimeout(() => {...}, 400)` — make the callback `async`): `setTimeout(async () => { … await alertDialog(msg); … }, 400);`
- L546 (catch block of the already-`async` handler): `await alertDialog(msg);`
- L577 (iOS install handler — make `async`): `installBtn.addEventListener('click', async () => { await alertDialog(t('installIosHint')); });`

Add to `styles.css`:
```css
.dialog-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: grid; place-items: center; z-index: 1000; }
.dialog { background: #1a1a1a; color: #fff; padding: 1.25rem; border-radius: 12px; max-width: 90vw; width: 22rem; }
.dialog-message { margin: 0 0 1rem; }
.dialog-actions { display: flex; gap: .5rem; justify-content: flex-end; }
```

- [ ] **Step 8: nginx — serve `/src/` modules `no-cache`**

In `nginx.conf`, after the content-hashed `location ~* "..."` block, add:
```nginx
  # Stable-named ES modules under /src/ (no content hash) → must always revalidate.
  location ^~ /src/ {
    include /etc/nginx/conf.d/security-headers.conf;
    add_header Cache-Control "no-cache" always;
    try_files $uri =404;
  }
```
In `scripts/smoke-test.sh`, mirror the existing `index.html` no-cache assertion for the module (match the script's existing variable names / assertion style), e.g.:
```sh
curl -sI "$BASE/src/dialogs.js" | grep -qi 'cache-control: no-cache' || { echo "FAIL: /src/dialogs.js not no-cache"; exit 1; }
```

- [ ] **Step 9: Verify build + dialogs reachable**

Run: `npm test && npm run build`
Expected: PASS; `dist/src/dialogs.js` exists; `dist/service-worker.js` `APP_SHELL` contains `./src/dialogs.js`; `dist/index.html` loads `app.<hash>.js` as a module.

- [ ] **Step 10: Commit**

```bash
git add src/dialogs.js tests/dialogs.test.mjs tests/build.test.mjs app.js index.html styles.css build.mjs nginx.conf scripts/smoke-test.sh
git commit -m "feat(a11y): non-blocking accessible confirm/alert dialogs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: IndexedDB storage with localStorage migration (Gap #9) — OPTIONAL/LAST — ❌ CLOSED (not implemented)

> **DECISION (2026-06-24):** Gap #9 closed as **accepted — `localStorage` is sufficient for this scope**. The dataset is a handful of class records; the local-only privacy invariant is already satisfied by `localStorage`, and the IndexedDB migration (sync → async across every `app.js` call site) is a large refactor with no current payoff. The steps below are retained for reference only and are **NOT to be executed**. Revisit only if data growth or cross-tab/resilience needs emerge.

> **YAGNI note:** The dataset is a handful of class records; `localStorage` is adequate. This task is the lowest-value item and the largest refactor (sync → async). Implement only if data growth or resilience is genuinely anticipated; otherwise close Gap #9 as "accepted — localStorage sufficient for scope." Keep the `student_planner.classes.v1` / `course_companion.profile.v1` keys for one-time migration.

**Files:**
- Create: `src/store.js`
- Create: `tests/store.test.mjs`
- Modify: `app.js` (await store reads/writes), `build.mjs` (already copies `src/`)

**Interfaces:**
- Produces: `export const store` with `await store.getClasses()`, `await store.setClasses(arr)`, `await store.getProfile()`, `await store.setProfile(obj)`. Backed by IndexedDB (`companero` DB, `kv` object store), migrating once from the legacy `localStorage` keys, with a `localStorage` fallback when IndexedDB is unavailable.

- [ ] **Step 1: Write the failing test**

`tests/store.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

async function freshStore({ seedLocal } = {}) {
  const dom = new JSDOM('', { url: 'https://localhost/' });
  global.window = dom.window;
  global.localStorage = dom.window.localStorage;
  global.indexedDB = dom.window.indexedDB; // jsdom ships a structured-clone IDB shim
  if (seedLocal) localStorage.setItem('student_planner.classes.v1', JSON.stringify(seedLocal));
  const mod = await import(`../src/store.js?${Math.random()}`);
  return mod.store;
}

test('round-trips classes', async () => {
  const store = await freshStore();
  await store.setClasses([{ id: '1', name: 'Calc' }]);
  assert.deepEqual(await store.getClasses(), [{ id: '1', name: 'Calc' }]);
});

test('migrates legacy localStorage classes once', async () => {
  const store = await freshStore({ seedLocal: [{ id: 'x', name: 'Legacy' }] });
  assert.deepEqual(await store.getClasses(), [{ id: 'x', name: 'Legacy' }]);
});
```

> If the installed jsdom build lacks an IndexedDB implementation, add `fake-indexeddb` as a devDependency and `import 'fake-indexeddb/auto'` at the top of the test instead of using `dom.window.indexedDB`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/store.js'`.

- [ ] **Step 3: Implement `src/store.js`**

```js
// src/store.js — async key/value store on IndexedDB with localStorage migration/fallback.

const DB = 'companero';
const STORE = 'kv';
const LEGACY = { 'classes': 'student_planner.classes.v1', 'profile': 'course_companion.profile.v1' };

function idb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in (typeof window !== 'undefined' ? window : globalThis))) return resolve(null);
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null); // fall back to localStorage
  });
}

async function idbGet(db, key) {
  return new Promise((resolve) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(undefined);
  });
}
async function idbSet(db, key, val) {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function get(key) {
  const db = await idb();
  if (db) {
    let val = await idbGet(db, key);
    if (val === undefined && LEGACY[key]) {        // one-time migration
      const raw = localStorage.getItem(LEGACY[key]);
      if (raw != null) { val = JSON.parse(raw); await idbSet(db, key, val); }
    }
    return val;
  }
  const raw = localStorage.getItem(LEGACY[key] || key); // fallback
  return raw == null ? undefined : JSON.parse(raw);
}

async function set(key, val) {
  const db = await idb();
  if (db) return idbSet(db, key, val);
  localStorage.setItem(LEGACY[key] || key, JSON.stringify(val));
}

export const store = {
  async getClasses() { return (await get('classes')) || []; },
  async setClasses(arr) { return set('classes', arr); },
  async getProfile() { return (await get('profile')) || { studentId: '', studentEmail: '' }; },
  async setProfile(obj) { return set('profile', obj); },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — both `store.test.mjs` cases green. (If they error on missing IDB, add `fake-indexeddb` per the Step 1 note and re-run.)

- [ ] **Step 5: Adopt in `app.js`**

Replace `loadClasses`/`saveClasses`/`loadProfile`/`saveProfile` bodies with calls to `store`, and make initialization async:
```js
import { store } from './src/store.js';
// ...
let state = { classes: [], query: '' };
async function init() {
  state.classes = await store.getClasses();
  renderList();
  const profile = await store.getProfile();
  if (studentIdInput) studentIdInput.value = profile.studentId || '';
  if (studentEmailInput) studentEmailInput.value = profile.studentEmail || '';
}
// replace direct saveClasses(...) calls with: store.setClasses(state.classes)
// replace saveProfile(next) with: store.setProfile(next)
init();
```
Remove the now-unused synchronous `localStorage` helpers and the top-level synchronous `loadClasses()` call.

- [ ] **Step 6: Verify**

Run: `npm test && npm run build`
Expected: PASS; build copies `dist/src/store.js`.

- [ ] **Step 7: Commit**

```bash
git add src/store.js tests/store.test.mjs app.js
git commit -m "feat(storage): IndexedDB store with one-time localStorage migration"
```

---

## Self-Review

**Spec coverage (10 gaps → tasks):**
- #1 missing icons → Task 4 (generate) + Task 5 (manifest refs). ✓
- #2 immutable on un-hashed assets → Task 2/3 (hashing) + Task 7 (nginx immutable only on hashed). ✓
- #3 SW cache-first staleness → Task 3 (build-derived CACHE_NAME) + Task 6 (network-first navigations). ✓
- #4 `any maskable` combined → Task 4 (separate maskable icon) + Task 5 (split purposes). ✓
- #5 unpinned `nginx:alpine` → Task 8 (pin `nginx:1.30-alpine` + digest, multi-stage). ✓
- #6 missing security headers → Task 7 (`security-headers.conf`). ✓
- #7 outdated GitHub Actions on Node 20 → Task 9 (checkout@v5, setup-buildx@v4, build-push@v7). ✓
- #8 manifest missing `id` → Task 5. ✓
- #9 localStorage → Gap CLOSED 2026-06-24 as "accepted — localStorage sufficient for scope" (Task 11 not implemented; YAGNI). ✓
- #10 blocking confirm()/alert() → Task 10 (accessible dialogs). ✓
- Already-compliant `docker-compose.yml` (no `version:` key) → left unchanged by design. ✓

**Placeholder scan:** No `TBD`/"add error handling"/"similar to Task N". Image digests in Task 8 are resolved by an exact command (Step 1), not left as prose placeholders.

**Type/name consistency:** `build({ srcDir, outDir })` and its `{ hashes, buildHash }` return are used consistently (Tasks 2, 3, 10, 11). SW `routeFor(req)` defined and consumed in Task 6. `store.getClasses/setClasses/getProfile/setProfile` names match between Task 11 definition and `app.js` adoption. Manifest icon filenames (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`) match across Tasks 4/5 and `build.mjs` `HASHED_ICONS`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-23-companero-phase-2-standards-remediation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task with two-stage review between tasks; fast iteration, each task gated independently.

**2. Inline Execution** — execute tasks in this session via executing-plans, batched with review checkpoints.

Which approach?
