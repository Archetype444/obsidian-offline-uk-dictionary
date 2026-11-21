'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(document, tag) {
    this.ownerDocument = document; this.tagName = tag.toUpperCase(); this.children = [];
    this.className = ''; this.attributes = {}; this.listeners = {}; this.value = ''; this._text = '';
    this.classList = {add: name => {this.className += ` ${name}`;}};
  }
  append(...children) {this.children.push(...children);}
  replaceChildren(...children) {this.children = children; this._text = '';}
  setAttribute(name, value) {this.attributes[name] = value;}
  addEventListener(name, callback) {this.listeners[name] = callback;}
  focus() {this.ownerDocument.activeElement = this;}
  get textContent() {return this._text + this.children.map(child => child.textContent).join('');}
  set textContent(value) {this.children = []; this._text = String(value);}
  set innerHTML(_value) {throw new Error('Dynamic HTML is forbidden');}
}

function fixture() {
  const document = {createElement(tag) {return new Element(this, tag);}};
  const container = document.createElement('div');
  const fake = {ItemView: class {constructor() {this.contentEl = container;}}};
  const source = fs.readFileSync(path.resolve(__dirname, '../src/view.js'), 'utf8');
  const module = {exports: {}};
  vm.runInThisContext(`(function(module, exports, require) {${source}\n})`)(module, module.exports, id => id === 'obsidian' ? fake : require('../src/query'));
  const plugin = {
    dataMeta: {headwords: 127436, sourceCommit: 'test-revision'}, licenceNotices: 'MIT and data licence text',
    getDictionary: async () => ({lookup: query => ({query, suggestions: [], matches: [{word: query, pos: 'Noun', ipa: [], alternatives: [], senses: [{definition: 'A useful definition.', examples: [], synonyms: []}]}]})}),
  };
  const view = new module.exports.DictionaryView({}, plugin);
  function all(node = container) {return [node, ...node.children.flatMap(child => all(child))];}
  return {document, container, plugin, view, all};
}

test('view opens with local search controls, attribution and a clear offline state', async () => {
  const value = fixture(); await value.view.onOpen();
  assert.ok(value.container.textContent.includes('Offline'));
  assert.ok(value.container.textContent.includes('127,436'));
  assert.ok(value.container.textContent.includes('MIT and data licence text'));
  assert.equal(value.view.input.autocomplete, 'off');
  assert.equal(value.view.input.spellcheck, false);
});

test('lookup renders definitions as text and excludes the query from saved state', async () => {
  const value = fixture(); await value.view.onOpen(); await value.view.lookup('colour');
  assert.equal(value.view.input.value, 'colour');
  assert.ok(value.view.results.textContent.includes('A useful definition.'));
  assert.deepEqual(value.view.getState(), {});
  assert.equal(value.document.activeElement, value.view.results);
});

test('hostile dictionary values are inert text rather than HTML or remote assets', async () => {
  const value = fixture();
  value.plugin.getDictionary = async () => ({lookup: query => ({query, suggestions: [], matches: [{word: query, pos: 'Noun', ipa: [], alternatives: [], senses: [{definition: '<img src="https://invalid.example/track" onerror="x()">', examples: ['<script>bad()</script>'], synonyms: []}]}]})});
  await value.view.onOpen(); await value.view.lookup('colour');
  assert.ok(value.view.results.textContent.includes('<img'));
  assert.equal(value.all().some(element => ['IMG', 'SCRIPT', 'IFRAME'].includes(element.tagName)), false);
});

test('the newest query wins if the dictionary loads while the user changes searches', async () => {
  const value = fixture(); let resolve;
  const pending = new Promise(done => {resolve = done;});
  value.plugin.getDictionary = () => pending;
  await value.view.onOpen();
  const first = value.view.lookup('colour'), second = value.view.lookup('centre');
  resolve({lookup: query => ({query, matches: [], suggestions: [query + 'word']})});
  await Promise.all([first, second]);
  assert.equal(value.view.input.value, 'centre');
  assert.ok(value.view.results.textContent.includes('centreword'));
  assert.equal(value.view.results.textContent.includes('colourword'), false);
});

test('clear releases the active query and definitions', async () => {
  const value = fixture(); await value.view.onOpen(); await value.view.lookup('colour');
  value.view.clear();
  assert.equal(value.view.input.value, '');
  assert.equal(value.view.results.textContent.includes('A useful definition.'), false);
  assert.ok(value.view.results.textContent.includes('A word away'));
});

test('closing the view during dictionary loading does not restore a discarded query', async () => {
  const value = fixture(); let resolve;
  value.plugin.getDictionary = () => new Promise(done => {resolve = done;});
  await value.view.onOpen();
  const lookup = value.view.lookup('colour');
  await value.view.onClose();
  resolve({lookup() {throw new Error('A closed view must not perform its old search');}});
  await lookup;
  assert.equal(value.container.children.length, 0);
  assert.equal(value.view.input, null);
});

test('a missing word offers clickable local suggestions', async () => {
  const value = fixture();
  value.plugin.getDictionary = async () => ({lookup: query => ({query, matches: [], suggestions: query === 'colur' ? ['colour'] : []})});
  await value.view.onOpen(); await value.view.lookup('colur');
  const suggestion = value.all().find(element => element.tagName === 'BUTTON' && element.textContent === 'colour');
  assert.ok(suggestion);
  suggestion.listeners.click();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(value.view.input.value, 'colour');
});
