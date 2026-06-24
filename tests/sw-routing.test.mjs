import { test } from 'node:test';
import assert from 'node:assert/strict';
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
