/* Test host only. Not included in the installable plugin. */
'use strict';
(() => {
window.outboundAttempts = 0;
window.fetch = () => {window.outboundAttempts++; throw new Error('Network forbidden in runtime test');};
window.XMLHttpRequest = class {constructor() {window.outboundAttempts++; throw new Error('Network forbidden');}};
window.WebSocket = class {constructor() {window.outboundAttempts++; throw new Error('Network forbidden');}};
window.module = {exports: {}};
const eventMenus = new WeakMap();
class Menu {
  constructor(document) {this.document = document; this.items = [];}
  static forEvent(event) {
    event.preventDefault();
    if (!eventMenus.has(event)) {
      const menu = new Menu(event.target.ownerDocument);
      eventMenus.set(event, menu);
      setTimeout(() => menu.show(event), 0);
    }
    return eventMenus.get(event);
  }
  addItem(callback) {
    const item = {setTitle(title) {this.title = title; return this;}, setIcon() {return this;}, onClick(click) {this.click = click; return this;}};
    callback(item); this.items.push(item); return this;
  }
  show(event) {
    for (const old of this.document.querySelectorAll('.test-context-menu')) old.remove();
    const element = this.document.createElement('div'); element.className = 'test-context-menu';
    element.style.left = `${event.clientX}px`; element.style.top = `${event.clientY}px`;
    for (const item of this.items) {
      const button = this.document.createElement('button'); button.textContent = item.title;
      button.addEventListener('click', () => {element.remove(); void item.click();}); element.append(button);
    }
    this.document.body.append(element);
  }
}
const callbacks = new Map(), leaves = [], factories = new Map();
function selectDictionary() {
  document.getElementById('right').classList.remove('collapsed');
  document.getElementById('dictionary-host').classList.add('active');
  document.getElementById('other-host').classList.remove('active');
  document.getElementById('dictionary-tab').classList.add('active');
  document.getElementById('other-tab').classList.remove('active');
}
const workspace = {
  containerEl: document.body, rightSplit: {},
  on(name, callback) {if (!callbacks.has(name)) callbacks.set(name, new Set()); callbacks.get(name).add(callback); return {name, callback};},
  trigger(name, ...args) {for (const callback of callbacks.get(name) || []) callback(...args);},
  iterateAllLeaves(callback) {leaves.forEach(callback);},
  getLeavesOfType(type) {return leaves.filter(leaf => leaf.type === type);},
  getRightLeaf() {
    const leaf = {
      containerEl: document.getElementById('dictionary-host'),
      getRoot: () => workspace.rightSplit,
      async setViewState(state) {this.type = state.type; this.view = factories.get(state.type)(this); await this.view.onOpen();},
    };
    leaves.push(leaf); return leaf;
  },
  async revealLeaf(leaf) {this.selected = leaf; selectDictionary();},
  setActiveLeaf(leaf) {this.active = leaf;},
  detachLeavesOfType(type) {for (const leaf of leaves.filter(leaf => leaf.type === type)) void leaf.view.onClose(); leaves.splice(0);},
};
class Plugin {
  constructor(app) {this.app = app; this.cleanups = [];}
  registerView(type, factory) {factories.set(type, factory);}
  register(callback) {this.cleanups.push(callback);}
  registerEvent(reference) {this.cleanups.push(() => callbacks.get(reference.name)?.delete(reference.callback));}
  addCommand() {}
  addRibbonIcon(_icon, label, callback) {const button = document.createElement('button'); button.textContent = label; button.className = 'lookup-ribbon'; button.addEventListener('click', callback); document.querySelector('header').append(button);}
  saveData() {throw new Error('Persistence forbidden');}
}
class ItemView {
  constructor(leaf) {this.leaf = leaf; this.contentEl = document.createElement('div'); this.contentEl.className = 'view-content'; leaf.containerEl.append(this.contentEl);}
}
const hostApi = {Plugin, ItemView, Menu, Notice: class {constructor(text) {window.lastNotice = text;}}};
window.require = name => {if (name === 'obsidian') return hostApi; throw new Error(`Unexpected browser dependency: ${name}`);};
window.fixture = {
  workspace, leaves,
  async start(Class) {this.plugin = new Class({workspace}); await this.plugin.onload(); window.fixtureReady = true;},
  stop() {this.plugin.onunload(); for (const dispose of this.plugin.cleanups) dispose();},
};
document.getElementById('collapse').addEventListener('click', () => document.getElementById('right').classList.toggle('collapsed'));
for (const name of ['other', 'other-tab']) document.getElementById(name).addEventListener('click', () => {
  document.getElementById('right').classList.remove('collapsed');
  document.getElementById('dictionary-host').classList.remove('active');
  document.getElementById('other-host').classList.add('active');
  document.getElementById('dictionary-tab').classList.remove('active');
  document.getElementById('other-tab').classList.add('active');
});
document.getElementById('dictionary-tab').addEventListener('click', selectDictionary);
})();
