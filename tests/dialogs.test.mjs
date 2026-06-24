import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { confirmDialog, alertDialog } from '../src/dialogs.js';

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

test('alertDialog resolves when confirmed and removes dialog', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  const p = alertDialog('Notice!');
  assert.equal(document.querySelector('[data-dialog-cancel]'), null, 'no cancel button for alert');
  document.querySelector('[data-dialog-confirm]').click();
  await p; // resolves (void)
  assert.equal(document.querySelector('[role="dialog"]'), null, 'dialog removed after close');
});

test('dialog has aria-labelledby pointing at message element', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  const p = confirmDialog('Are you sure?');
  const dialogEl = document.querySelector('[role="dialog"]');
  const labelledBy = dialogEl.getAttribute('aria-labelledby');
  assert.ok(labelledBy, 'dialog has aria-labelledby attribute');
  const messageEl = document.getElementById(labelledBy);
  assert.ok(messageEl, 'aria-labelledby id resolves to an element');
  assert.equal(messageEl.textContent, 'Are you sure?', 'labelling element contains the message');
  // clean up
  document.querySelector('[data-dialog-cancel]').click();
  await p;
});

test('confirmDialog focus trap wraps Tab from last to first button', async () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  const p = confirmDialog('Delete?');
  const cancelBtn = document.querySelector('[data-dialog-cancel]');
  const confirmBtn = document.querySelector('[data-dialog-confirm]');
  // confirmBtn is last in DOM order (cancelBtn prepended); initial focus is on confirmBtn
  assert.equal(document.activeElement, confirmBtn, 'focus starts on confirmBtn (last)');
  // dispatch Tab — trap should wrap focus to first (cancelBtn)
  const tabEvent = new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tabEvent);
  assert.equal(document.activeElement, cancelBtn, 'Tab from last wraps focus to first (cancelBtn)');
  // clean up
  confirmBtn.click();
  await p;
});

test('restores focus to the previously-focused element on close', async () => {
  const dom = new JSDOM('<!doctype html><body><button id="trigger">Open</button></body>');
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  const trigger = document.getElementById('trigger');
  trigger.focus();
  assert.equal(document.activeElement, trigger, 'trigger focused before dialog opens');
  const p = confirmDialog('Delete?');
  assert.notEqual(document.activeElement, trigger, 'focus moves into the dialog');
  document.querySelector('[data-dialog-confirm]').click();
  await p;
  assert.equal(document.activeElement, trigger, 'focus restored to trigger after close');
});
