import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeFor, isCacheable } from '../service-worker.js';

const req = (url, mode = 'cors', method = 'GET') => ({ url, mode, method });

test('navigation requests route to navigate', () => {
  assert.equal(routeFor(req('https://x/', 'navigate')), 'navigate');
});

test('hashed asset requests route to asset', () => {
  assert.equal(routeFor(req('https://x/app.deadbeef.js')), 'asset');
});

test('isCacheable returns true for 2xx, false for non-2xx and null', () => {
  assert.equal(isCacheable({ ok: true }), true, '2xx response is cacheable');
  assert.equal(isCacheable({ ok: false }), false, 'non-2xx response is not cacheable');
  assert.equal(isCacheable(null), false, 'null is not cacheable');
});

// Regression: service-worker.js uses ES `export` (shared with these tests), which a
// CLASSIC worker rejects at evaluation time ("Unexpected token 'export'") — so the SW
// silently fails to register and the whole offline/caching layer dies. It must be
// registered as a module worker. (Caught by a browser smoke; unit/Docker tests missed it.)
test('service worker is registered as a module worker', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(
    app,
    /register\(\s*['"]\.\/service-worker\.js['"]\s*,\s*\{\s*type:\s*['"]module['"]\s*\}/,
    "app.js must register service-worker.js with { type: 'module' } (the SW source uses ES export)"
  );
});
