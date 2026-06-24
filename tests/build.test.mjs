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
  await mkdir(join(src, 'src'), { recursive: true });
  await writeFile(join(src, 'src', 'dialogs.js'), 'export function confirmDialog(){}');
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

test('throws when manifest icon src is not in hashes', async () => {
  const src = await mkdtemp(join(tmpdir(), 'cmp-src-'));
  const out = await mkdtemp(join(tmpdir(), 'cmp-out-'));
  await writeFile(join(src, 'app.js'), 'console.log("app");');
  await writeFile(join(src, 'styles.css'), 'body{color:#fff}');
  await writeFile(join(src, 'translations.js'), 'const t={};');
  await mkdir(join(src, 'icons'), { recursive: true });
  await writeFile(join(src, 'icons', 'icon-192.png'), Buffer.from('png192'));
  await writeFile(join(src, 'icons', 'icon-512.png'), Buffer.from('png512'));
  await writeFile(join(src, 'icons', 'icon-maskable-512.png'), Buffer.from('pngmask'));
  // Add an extra icon that is NOT in HASHED_ICONS
  await writeFile(join(src, 'manifest.webmanifest'),
    JSON.stringify({ icons: [{ src: 'icons/icon-192.png' }, { src: 'icons/icon-512.png' }, { src: 'icons/icon-maskable-512.png' }, { src: 'icons/missing.png' }] }));
  await writeFile(join(src, 'service-worker.js'),
    "const CACHE_NAME = 'companero-dev';\nconst APP_SHELL = ['./','./index.html'];\n");
  await writeFile(join(src, 'index.html'),
    '<link rel="stylesheet" href="./styles.css">' +
    '<script src="./translations.js"></script>' +
    '<script src="./app.js" defer></script>');
  await mkdir(join(src, 'src'), { recursive: true });
  await writeFile(join(src, 'src', 'dialogs.js'), 'export function confirmDialog(){}');

  await assert.rejects(
    () => build({ srcDir: src, outDir: out }),
    /manifest icon src not in hashes: icons\/missing\.png/,
    'should throw with message naming missing icon'
  );
});

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
