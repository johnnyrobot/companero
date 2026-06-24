import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
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
