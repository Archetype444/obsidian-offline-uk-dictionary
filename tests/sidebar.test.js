'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const calls = [], handlers = {}, leaves = [], notices = [];
  const doc = {addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [], defaultView: {}};
  const rightSplit = {}, leftSplit = {};
  const workspace = {
    containerEl: {ownerDocument: doc}, rightSplit,
    on(name, callback) {handlers[name] = callback; return {};},
    iterateAllLeaves(callback) {leaves.forEach(callback);},
    getLeavesOfType() {return leaves;},
    getRightLeaf(split) {
      calls.push(['create-right', split]);
      const leaf = {
        getRoot: () => rightSplit,
        async setViewState(state) {calls.push(['state', state]); this.view = {input: {focus() {calls.push(['input-focus']);}}, async lookup(word) {calls.push(['lookup', word]);}};},
      };
      leaves.push(leaf); return leaf;
    },
    async revealLeaf(leaf) {calls.push(['reveal', leaf]); this.collapsed = false; this.selected = leaf;},
    setActiveLeaf(leaf, options) {calls.push(['active', leaf, options]); this.active = leaf;},
    detachLeavesOfType(type) {calls.push(['detach', type]); leaves.length = 0;},
    collapsed: true,
  };
  class Plugin {
    constructor(app) {this.app = app; this.disposers = [];}
    registerView(type, factory) {this.factory = factory;}
    register(dispose) {this.disposers.push(dispose);}
    registerEvent() {}
    addRibbonIcon() {}
    addCommand() {}
  }
  const obsidian = {Plugin, ItemView: class {}, Menu: {}, Notice: class {constructor(message) {notices.push(message);}}};
  const cache = {};
  function load(id) {
    if (id === 'obsidian') return obsidian;
    if (id === './bundled-data') return {meta: {headwords: 1, sourceCommit: 'test'}, gzip: '', notices: 'MIT'};
    if (!cache[id]) {
      const module = {exports: {}}; cache[id] = module;
      const source = fs.readFileSync(path.resolve(__dirname, '../src', id.replace('./', '') + '.js'), 'utf8');
      const wrapper = vm.runInThisContext(`(function(module, exports, require) {${source}\n})`);
      wrapper(module, module.exports, load);
    }
    return cache[id].exports;
  }
  const Class = load('./main');
  const plugin = new Class({workspace});
  return {plugin, workspace, rightSplit, leftSplit, leaves, calls, handlers, notices};
}

test('first lookup creates the right sidebar dictionary and reveals it before searching', async () => {
  const value = fixture(); await value.plugin.onload();
  await value.plugin.openLookup('colour');
  assert.equal(value.workspace.collapsed, false);
  assert.equal(value.workspace.active, value.leaves[0]);
  assert.deepEqual(value.calls.map(call => call[0]), ['create-right', 'state', 'reveal', 'active', 'lookup']);
  assert.deepEqual(value.calls[4], ['lookup', 'colour']);
  assert.equal(value.notices.length, 0);
});

test('an existing dictionary tab is activated, rather than making duplicate tabs', async () => {
  const value = fixture(); await value.plugin.onload();
  await value.plugin.openLookup('colour');
  value.workspace.collapsed = true;
  value.workspace.selected = {otherTab: true};
  await value.plugin.openLookup('centre');
  assert.equal(value.calls.filter(call => call[0] === 'create-right').length, 1);
  assert.equal(value.workspace.selected, value.leaves[0]);
  assert.equal(value.workspace.collapsed, false);
  assert.deepEqual(value.calls.at(-1), ['lookup', 'centre']);
});

test('a dictionary dragged elsewhere does not stop right-sidebar creation', async () => {
  const value = fixture();
  value.leaves.push({getRoot: () => value.leftSplit});
  await value.plugin.onload(); await value.plugin.openLookup('colour');
  assert.equal(value.workspace.active.getRoot(), value.rightSplit);
});

test('concurrent lookups reuse one tab and finish on the newest query', async () => {
  const value = fixture(); await value.plugin.onload();
  await Promise.all([value.plugin.openLookup('colour'), value.plugin.openLookup('centre'), value.plugin.openLookup('privacy')]);
  assert.equal(value.leaves.length, 1);
  assert.deepEqual(value.calls.at(-1), ['lookup', 'privacy']);
});

test('opening without a selection focuses manual search without a stored history', async () => {
  const value = fixture(); await value.plugin.onload(); await value.plugin.openLookup('');
  assert.equal(value.calls.at(-1)[0], 'input-focus');
  assert.equal(value.calls.filter(call => call[0] === 'lookup').length, 0);
});

test('unloading detaches plugin views and prevents a pending lookup reopening one', async () => {
  const value = fixture(); await value.plugin.onload();
  const pending = value.plugin.openLookup('colour');
  value.plugin.onunload(); await pending;
  assert.equal(value.leaves.length, 0);
  assert.equal(value.plugin.dictionaryPromise, null);
  assert.equal(value.calls.filter(call => call[0] === 'create-right').length, 0);
});

test('PDF++ and editor hooks capture their own words in one menu item', async () => {
  const value = fixture(); await value.plugin.onload();
  const items = [];
  const menu = {addItem(callback) {const item = {setTitle() {return this;}, setIcon() {return this;}, onClick(click) {this.click = click; return this;}}; callback(item); items.push(item);}};
  value.handlers['editor-menu'](menu, {getSelection: () => 'colour'});
  value.handlers['pdf-menu'](menu, {selection: 'centre'});
  assert.equal(items.length, 1);
  await items[0].click();
  assert.deepEqual(value.calls.at(-1), ['lookup', 'colour']);
});
