'use strict';

const {normaliseQuery} = require('./query');

function isPassword(element) {
  return element?.tagName?.toLowerCase() === 'input' && element.type?.toLowerCase() === 'password';
}

function selectionForEvent(event) {
  const path = event.composedPath?.() || [event.target];
  const target = path.find(node => node?.nodeType === 1) || event.target;
  if (!target || isPassword(target)) return '';
  const document = target.ownerDocument;
  if (!document) return '';
  const tag = target.tagName?.toLowerCase();
  if (tag === 'textarea' || tag === 'input') {
    if (typeof target.selectionStart !== 'number' || target.selectionStart === target.selectionEnd) return '';
    return normaliseQuery(target.value.slice(target.selectionStart, target.selectionEnd));
  }
  // Some browser components keep their selection inside a shadow root.
  const root = target.getRootNode?.();
  const selection = root?.getSelection?.() || document.getSelection?.() || document.defaultView?.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return '';
  const range = selection.getRangeAt(0);
  let belongs = false;
  try {
    belongs = range.intersectsNode(target);
    if (!belongs && selection.containsNode) belongs = selection.containsNode(target, true);
  } catch { return ''; }
  if (!belongs) return '';
  // Do not apply a stale selection in another view to an unrelated right-click.
  if ((event.clientX || event.clientY) && typeof range.getClientRects === 'function') {
    const rects = [...range.getClientRects()];
    if (rects.length && !rects.some(rect => event.clientX >= rect.left - 3 && event.clientX <= rect.right + 3 && event.clientY >= rect.top - 3 && event.clientY <= rect.bottom + 3)) return '';
  }
  return normaliseQuery(selection.toString());
}

function addLookupItem(menu, query, lookup, seen) {
  const word = normaliseQuery(query);
  if (!word || seen.has(menu)) return false;
  seen.add(menu);
  // Capture this value now; activating the sidebar can collapse the original selection.
  menu.addItem(item => item.setTitle('Look up').setIcon('book-open').onClick(() => lookup(word)));
  return true;
}

class SelectionMenus {
  constructor(plugin, Menu, lookup) {
    this.plugin = plugin;
    this.Menu = Menu;
    this.lookup = lookup;
    this.documents = new Map();
    this.frames = new Map();
    this.menus = new WeakSet();
    this.closed = false;
  }

  attach(document) {
    if (!document || this.closed || this.documents.has(document)) return;
    const cleanup = [];
    const handler = event => {
      const word = selectionForEvent(event);
      if (!word) return;
      addLookupItem(this.Menu.forEvent(event), word, this.lookup, this.menus);
    };
    document.addEventListener('contextmenu', handler, true);
    cleanup.push(() => document.removeEventListener('contextmenu', handler, true));
    this.documents.set(document, cleanup);

    for (const frame of document.querySelectorAll?.('iframe') || []) this.attachFrame(frame, document);
    const Observer = document.defaultView?.MutationObserver;
    if (Observer && document.documentElement) {
      const observer = new Observer(records => {
        for (const record of records) for (const node of record.removedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.tagName?.toLowerCase() === 'iframe') this.detachFrame(node);
          for (const frame of node.querySelectorAll?.('iframe') || []) this.detachFrame(frame);
        }
        for (const record of records) for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.tagName?.toLowerCase() === 'iframe') this.attachFrame(node, document);
          for (const frame of node.querySelectorAll?.('iframe') || []) this.attachFrame(frame, document);
        }
      });
      observer.observe(document.documentElement, {childList: true, subtree: true});
      cleanup.push(() => observer.disconnect());
    }
  }

  detach(document) {
    for (const [frame, state] of [...this.frames]) if (state.owner === document) this.detachFrame(frame);
    for (const dispose of this.documents.get(document) || []) dispose();
    this.documents.delete(document);
  }

  attachFrame(frame, owner) {
    if (this.frames.has(frame)) return;
    const state = {owner, document: null, load: null};
    state.load = () => {
      let document = null;
      try { document = frame.contentDocument; } catch { /* Cross-origin viewers are isolated. */ }
      if (state.document && state.document !== document) this.detach(state.document);
      state.document = document;
      this.attach(document);
    };
    this.frames.set(frame, state);
    frame.addEventListener('load', state.load);
    state.load();
  }

  detachFrame(frame) {
    const state = this.frames.get(frame);
    if (!state) return;
    this.frames.delete(frame);
    frame.removeEventListener('load', state.load);
    if (state.document) this.detach(state.document);
  }

  dispose() {
    this.closed = true;
    for (const document of [...this.documents.keys()]) this.detach(document);
  }
}

module.exports = {selectionForEvent, addLookupItem, SelectionMenus};
