import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const dims = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }); // IHDR

async function checkIcon(rel, size) {
  const buf = await readFile(new URL(`../icons/${rel}`, import.meta.url));
  assert.ok(buf.subarray(0, 8).equals(PNG_SIG), `${rel} is a PNG`);
  assert.deepEqual(dims(buf), { w: size, h: size }, `${rel} is ${size}x${size}`);
}

test('icon-192.png exists and is 192x192', () => checkIcon('icon-192.png', 192));
test('icon-512.png exists and is 512x512', () => checkIcon('icon-512.png', 512));
test('icon-maskable-512.png exists and is 512x512', () => checkIcon('icon-maskable-512.png', 512));
