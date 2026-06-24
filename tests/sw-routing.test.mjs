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
