import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HASHED_ASSETS = ['app.js', 'styles.css', 'translations.js'];
const HASHED_ICONS = ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
const COPIED_MODULES = ['src/dialogs.js']; // stable-named ES modules imported by app.js; bytes folded into buildHash, precached, served no-cache

const hash8 = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 8);
const hashedName = (path, h) => path.replace(/(\.[^.]+)$/, `.${h}$1`);

export async function build({ srcDir, outDir }) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, 'icons'), { recursive: true });
  await mkdir(join(outDir, 'src'), { recursive: true });

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

  // Stable-named modules: copy verbatim, fold bytes into buildHash so any change busts CACHE_NAME.
  for (const rel of COPIED_MODULES) {
    const bytes = await readFile(join(srcDir, rel));
    orderedHashes.push(`${rel}:${hash8(bytes)}`);
    await writeFile(join(outDir, rel), bytes);
  }

  const buildHash = hash8(Buffer.from(orderedHashes.sort().join('|')));

  // index.html: rewrite the three top-level asset refs
  let html = await readFile(join(srcDir, 'index.html'), 'utf8');
  for (const rel of HASHED_ASSETS) {
    html = html.split(`./${rel}`).join(`./${hashes.get(rel)}`);
  }
  await writeFile(join(outDir, 'index.html'), html);

  // service-worker.js: inject build hash + hashed precache shell
  const shell = [
    './', './index.html',
    `./${hashes.get('styles.css')}`,
    `./${hashes.get('app.js')}`,
    `./${hashes.get('translations.js')}`,
    './manifest.webmanifest',
    `./${hashes.get('icons/icon-192.png')}`,
    `./${hashes.get('icons/icon-512.png')}`,
    ...COPIED_MODULES.map((rel) => `./${rel}`),
  ];
  let sw = await readFile(join(srcDir, 'service-worker.js'), 'utf8');
  sw = sw.replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = 'companero-${buildHash}';`);
  sw = sw.replace(/const APP_SHELL = \[[\s\S]*?\];/, `const APP_SHELL = ${JSON.stringify(shell, null, 2)};`);
  await writeFile(join(outDir, 'service-worker.js'), sw);

  // manifest.webmanifest: rewrite icon srcs
  const manifest = JSON.parse(await readFile(join(srcDir, 'manifest.webmanifest'), 'utf8'));
  manifest.icons = manifest.icons.map(icon => {
    const hashed = hashes.get(icon.src);
    if (!hashed) throw new Error(`manifest icon src not in hashes: ${icon.src}`);
    return { ...icon, src: hashed };
  });
  await writeFile(join(outDir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

  return { hashes, buildHash };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = dirname(fileURLToPath(import.meta.url));
  await build({ srcDir: root, outDir: join(root, 'dist') });
  console.log('build: dist/ ready');
}
