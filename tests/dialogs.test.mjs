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
