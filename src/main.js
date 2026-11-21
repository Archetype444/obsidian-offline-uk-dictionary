'use strict';

const {Plugin, Menu, Notice} = require('obsidian');
const {SelectionMenus, addLookupItem} = require('./selection');
const {normaliseQuery} = require('./query');
const {decodeDictionary} = require('./dictionary');
const {DictionaryView, VIEW_TYPE} = require('./view');
const bundled = require('./bundled-data');

class OfflineUKDictionaryPlugin extends Plugin {
  async onload() {
    this.unloaded = false;
    this.dataMeta = bundled.meta;
    this.licenceNotices = bundled.notices;
    this.dictionaryPromise = null;
    this.openQueue = Promise.resolve();
    this.registerView(VIEW_TYPE, leaf => new DictionaryView(leaf, this));
    const lookup = word => this.openLookup(word);
    this.selectionMenus = new SelectionMenus(this, Menu, lookup);
    this.register(() => this.selectionMenus.dispose());
    this.selectionMenus.attach(this.app.workspace.containerEl.ownerDocument);
    this.registerEvent(this.app.workspace.on('window-open', (_workspaceWindow, window) => this.selectionMenus.attach(window.document)));
    this.registerEvent(this.app.workspace.on('window-close', (_workspaceWindow, window) => this.selectionMenus.detach(window.document)));
    // Also cover popouts which were already open when the plugin was enabled.
    this.app.workspace.iterateAllLeaves(leaf => this.selectionMenus.attach(leaf.containerEl?.ownerDocument));
    this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor) => {
      addLookupItem(menu, editor.getSelection(), lookup, this.selectionMenus.menus);
    }));
    // Optional PDF++ integration; the ordinary PDF text layer is covered by DOM selection.
    this.registerEvent(this.app.workspace.on('pdf-menu', (menu, data) => {
      addLookupItem(menu, data?.selection || '', lookup, this.selectionMenus.menus);
    }));
    this.addRibbonIcon('book-open', 'Open offline dictionary', () => { void this.openLookup(''); });
    this.addCommand({id: 'open-dictionary', name: 'Open dictionary', callback: () => this.openLookup('')});
    this.addCommand({
      id: 'look-up-selection', name: 'Look up selected text',
      editorCheckCallback: (checking, editor) => {
        const query = normaliseQuery(editor.getSelection());
        if (!query) return false;
        if (!checking) void this.openLookup(query);
        return true;
      },
    });
  }

  getDictionary() {
    if (!this.dictionaryPromise) {
      this.dictionaryPromise = decodeDictionary(bundled.gzip).catch(error => {
        this.dictionaryPromise = null;
        throw error;
      });
    }
    return this.dictionaryPromise;
  }

  openLookup(raw) {
    const query = normaliseQuery(raw);
    this.openQueue = this.openQueue.catch(() => undefined).then(async () => {
      if (this.unloaded) return;
      const workspace = this.app.workspace;
      let leaf = workspace.getLeavesOfType(VIEW_TYPE).find(candidate => candidate.getRoot() === workspace.rightSplit);
      if (!leaf) {
        leaf = workspace.getRightLeaf(false);
        if (!leaf) throw new Error('The right sidebar is unavailable.');
        await leaf.setViewState({type: VIEW_TYPE, active: true});
      }
      if (this.unloaded) return;
      // Public API: expands a collapsed sidebar, activates its dictionary tab, and loads deferred views.
      await workspace.revealLeaf(leaf);
      if (this.unloaded) return;
      workspace.setActiveLeaf(leaf, {focus: true});
      if (query) await leaf.view.lookup(query);
      else leaf.view.input?.focus();
    }).catch(() => {
      if (!this.unloaded) new Notice('The offline dictionary could not open. Please reload the plugin.');
    });
    return this.openQueue;
  }

  onunload() {
    this.unloaded = true;
    this.selectionMenus?.dispose();
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
    this.dictionaryPromise = null;
  }
}

module.exports = OfflineUKDictionaryPlugin;
