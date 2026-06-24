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
