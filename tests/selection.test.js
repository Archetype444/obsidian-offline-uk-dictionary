'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {selectionForEvent, addLookupItem, SelectionMenus} = require('../src/selection');

function fixture(text = 'colour') {
  const range = {intersectsNode: () => true, getClientRects: () => [{left: 10, right: 80, top: 10, bottom: 40}]};
  const selection = {isCollapsed: false, rangeCount: 1, getRangeAt: () => range, toString: () => text};
  const document = {getSelection: () => selection};
  const target = {nodeType: 1, tagName: 'SPAN', ownerDocument: document, closest: () => null};
  const event = {target, clientX: 20, clientY: 20, composedPath: () => [target]};
  return {range, selection, document, target, event};
}

for (const kind of ['Markdown Reading view', 'PDF text layer', 'Canvas text', 'custom selectable view']) {
  test(`${kind} uses the selected DOM text`, () => assert.equal(selectionForEvent(fixture().event), 'colour'));
}

test('a right-click outside a previous selection does not offer an unrelated lookup', () => {
  const value = fixture();
  value.event.clientX = 300;
  assert.equal(selectionForEvent(value.event), '');
  value.event.clientX = 20;
  value.range.intersectsNode = () => false;
  assert.equal(selectionForEvent(value.event), '');
});

test('collapsed, empty and oversized selections are ignored', () => {
  const value = fixture(); value.selection.isCollapsed = true;
  assert.equal(selectionForEvent(value.event), '');
  assert.equal(selectionForEvent(fixture('x'.repeat(600)).event), '');
});

test('a selected text input is supported, a password input is excluded', () => {
  const value = fixture();
  Object.assign(value.target, {tagName: 'INPUT', type: 'text', value: 'some colour here', selectionStart: 5, selectionEnd: 11});
  assert.equal(selectionForEvent(value.event), 'colour');
  value.target.type = 'password';
  assert.equal(selectionForEvent(value.event), '');
});

test('selection inside an accessible shadow root uses that root', () => {
  const value = fixture();
  value.target.getRootNode = () => ({getSelection: () => value.selection});
  value.document.getSelection = () => null;
  assert.equal(selectionForEvent(value.event), 'colour');
});

test('the menu captures its word before focus changes, and duplicate hooks add one item', () => {
  const items = [], lookedUp = [], seen = new WeakSet();
  const menu = {addItem(callback) {
    const item = {setTitle(title) {this.title = title; return this;}, setIcon() {return this;}, onClick(click) {this.click = click; return this;}};
    callback(item); items.push(item);
  }};
  let query = 'colour';
  assert.equal(addLookupItem(menu, query, word => lookedUp.push(word), seen), true);
  query = '';
  assert.equal(addLookupItem(menu, 'other', word => lookedUp.push(word), seen), false);
  items[0].click();
  assert.equal(items[0].title, 'Look up');
  assert.deepEqual(lookedUp, ['colour']);
  assert.equal(items.length, 1);
});

function documentDouble() {
  const listeners = new Map();
  return {
    listeners, defaultView: {}, documentElement: {}, querySelectorAll: () => [],
    addEventListener(name, callback) {listeners.set(name, callback);},
    removeEventListener(name, callback) {if (listeners.get(name) === callback) listeners.delete(name);},
  };
}

test('document registration is idempotent and listeners are removed on unload', () => {
  const manager = new SelectionMenus({}, {}, () => {});
  const doc = documentDouble();
  manager.attach(doc); manager.attach(doc);
  assert.equal(manager.documents.size, 1);
  assert.equal(doc.listeners.size, 1);
  manager.dispose();
  assert.equal(doc.listeners.size, 0);
  manager.attach(doc);
  assert.equal(doc.listeners.size, 0);
});

test('same-origin frame navigation and removal release the old document', () => {
  const manager = new SelectionMenus({}, {}, () => {});
  const owner = documentDouble(), first = documentDouble(), second = documentDouble();
  const frame = {contentDocument: first, addEventListener(_name, callback) {this.load = callback;}, removeEventListener() {this.load = null;}};
  manager.attach(owner); manager.attachFrame(frame, owner); manager.attachFrame(frame, owner);
  assert.equal(manager.frames.size, 1);
  assert.ok(first.listeners.has('contextmenu'));
  frame.contentDocument = second; frame.load();
  assert.equal(first.listeners.size, 0);
  assert.ok(second.listeners.has('contextmenu'));
  manager.detach(owner);
  assert.equal(second.listeners.size, 0);
  assert.equal(manager.frames.size, 0);
});

test('cross-origin frames are skipped without attempting access workarounds', () => {
  const manager = new SelectionMenus({}, {}, () => {});
  const frame = {get contentDocument() {throw new Error('SecurityError');}, addEventListener() {}, removeEventListener() {}};
  assert.doesNotThrow(() => manager.attachFrame(frame, documentDouble()));
  assert.equal(manager.documents.size, 0);
  manager.dispose();
});
