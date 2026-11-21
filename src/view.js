'use strict';

const {ItemView} = require('obsidian');
const {normaliseQuery} = require('./query');
const VIEW_TYPE = 'offline-uk-dictionary-view';

function element(document, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

class DictionaryView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.generation = 0;
    this.closed = false;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Dictionary'; }
  getIcon() { return 'book-open'; }
  // Explicitly exclude the search term and result from workspace layout persistence.
  getState() { return {}; }

  async onOpen() {
    this.closed = false;
    const root = this.contentEl;
    root.replaceChildren();
    root.classList.add('offline-uk-dictionary');
    const document = root.ownerDocument;
    const heading = element(document, 'div', 'ouk-heading');
    const title = element(document, 'div', 'ouk-title-group');
    title.append(element(document, 'h2', 'ouk-title', 'Dictionary'));
    title.append(element(document, 'div', 'ouk-language', 'ENGLISH · UK'));
    heading.append(title, element(document, 'span', 'ouk-offline', 'Offline'));
    root.append(heading);

    const form = element(document, 'form', 'ouk-search');
    this.input = element(document, 'input', 'ouk-search-input');
    this.input.type = 'search';
    this.input.placeholder = 'Search a word or short phrase';
    this.input.setAttribute('aria-label', 'Search the offline English dictionary');
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;
    this.input.maxLength = 120;
    const submit = element(document, 'button', 'ouk-search-button mod-cta', 'Look up');
    submit.type = 'submit';
    form.append(this.input, submit);
    form.addEventListener('submit', event => {
      event.preventDefault();
      void this.lookup(this.input.value);
    });
    root.append(form);

    const tools = element(document, 'div', 'ouk-tools');
    const privacy = element(document, 'span', 'ouk-private-note', 'On your device. No search history.');
    const clear = element(document, 'button', 'ouk-text-button', 'Clear');
    clear.type = 'button';
    clear.addEventListener('click', () => this.clear());
    tools.append(privacy, clear);
    root.append(tools);
    this.status = element(document, 'div', 'ouk-status');
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    root.append(this.status);
    this.results = element(document, 'div', 'ouk-results');
    this.results.tabIndex = -1;
    this.results.setAttribute('aria-label', 'Dictionary definitions');
    root.append(this.results);
    this.renderWelcome();

    const credits = element(document, 'details', 'ouk-credits');
    credits.append(element(document, 'summary', '', 'Dictionary & licences'));
    credits.append(element(document, 'p', '', 'Open English Wordnet, derived from Princeton WordNet. Data: CC BY 4.0 and the Princeton WordNet licence. Plugin: MIT.'));
    credits.append(element(document, 'p', '', 'British spelling and UK pronunciation are preferred where supplied. International variants are retained. Pronunciation symbols are text; no audio service is used.'));
    credits.append(element(document, 'p', '', `Bundled source revision: ${this.plugin.dataMeta.sourceCommit}. No dictionary downloads are needed.`));
    const full = element(document, 'details', 'ouk-full-licences');
    full.append(element(document, 'summary', '', 'Complete licence texts'));
    full.append(element(document, 'pre', '', this.plugin.licenceNotices));
    credits.append(full);
    root.append(credits);
  }

  renderWelcome() {
    if (!this.results) return;
    const document = this.results.ownerDocument;
    this.results.replaceChildren();
    const empty = element(document, 'div', 'ouk-empty');
    empty.append(element(document, 'div', 'ouk-empty-symbol', 'Aa'));
    empty.append(element(document, 'h3', '', 'A word away'));
    empty.append(element(document, 'p', '', 'Highlight text, right-click and choose “Look up”. Your dictionary opens here.'));
    empty.append(element(document, 'p', 'ouk-coverage', `${this.plugin.dataMeta.headwords.toLocaleString('en-GB')} bundled headwords · Works without an internet connection`));
    this.results.append(empty);
    this.status.textContent = '';
  }

  clear() {
    this.generation++;
    if (this.input) this.input.value = '';
    this.renderWelcome();
    this.input?.focus();
  }

  async lookup(raw) {
    const query = normaliseQuery(raw);
    if (!query) {
      this.clear();
      this.status.textContent = 'Select a word or a short phrase of up to eight words.';
      return;
    }
    const generation = ++this.generation;
    this.input.value = query;
    this.status.textContent = 'Opening the bundled dictionary…';
    this.results.replaceChildren();
    try {
      const dictionary = await this.plugin.getDictionary();
      if (this.closed || generation !== this.generation) return;
      this.renderResult(dictionary.lookup(query));
      this.results.focus({preventScroll: true});
    } catch {
      if (this.closed || generation !== this.generation) return;
      this.status.textContent = 'The bundled dictionary could not be opened. Reinstall the complete plugin package.';
    }
  }

  renderResult(result) {
    const document = this.results.ownerDocument;
    this.results.replaceChildren();
    this.results.scrollTop = 0;
    if (!result.matches.length) {
      this.status.textContent = `No entry for “${result.query}” in the bundled dictionary.`;
      this.results.append(element(document, 'p', 'ouk-not-found', 'No online fallback is used. Try a base form or a different spelling.'));
      if (result.suggestions.length) {
        this.results.append(element(document, 'h3', 'ouk-suggestions-title', 'Did you mean?'));
        const suggestions = element(document, 'div', 'ouk-suggestions');
        for (const word of result.suggestions) suggestions.append(this.wordButton(word));
        this.results.append(suggestions);
      }
      return;
    }
    const count = result.matches.reduce((total, match) => total + match.senses.length, 0);
    this.status.textContent = `${count} ${count === 1 ? 'definition' : 'definitions'} · Offline`;
    for (const match of result.matches) {
      const section = element(document, 'section', 'ouk-entry');
      const heading = element(document, 'div', 'ouk-entry-heading');
      heading.append(element(document, 'h3', 'ouk-headword', match.word));
      heading.append(element(document, 'span', 'ouk-pos', match.pos));
      section.append(heading);
      if (match.word.toLocaleLowerCase('en-GB') !== result.query.toLocaleLowerCase('en-GB')) {
        section.append(element(document, 'p', 'ouk-lemma', `Base form of “${result.query}”`));
      }
      if (match.ipa.length) section.append(element(document, 'p', 'ouk-ipa', `${match.ipa.some(item => item[1] === 'GB') ? 'UK ' : ''}/${match.ipa.map(item => item[0]).join('/, /')}/`));
      if (match.american && match.alternatives.length) {
        const variants = element(document, 'div', 'ouk-variants');
        variants.append(element(document, 'span', '', 'British spelling: '));
        for (const word of match.alternatives) variants.append(this.wordButton(word));
        section.append(variants);
      }
      const senses = element(document, 'ol', 'ouk-senses');
      for (const sense of match.senses) {
        const item = element(document, 'li', 'ouk-sense');
        item.append(element(document, 'p', 'ouk-definition', sense.definition));
        for (const example of sense.examples) item.append(element(document, 'p', 'ouk-example', `“${example}”`));
        const synonyms = sense.synonyms.filter(word => word.toLocaleLowerCase('en-GB') !== match.word.toLocaleLowerCase('en-GB')).slice(0, 8);
        if (synonyms.length) {
          const list = element(document, 'div', 'ouk-synonyms');
          list.append(element(document, 'span', 'ouk-synonym-label', 'Related: '));
          for (const word of synonyms) list.append(this.wordButton(word));
          item.append(list);
        }
        senses.append(item);
      }
      section.append(senses);
      this.results.append(section);
    }
  }

  wordButton(word) {
    const button = element(this.results.ownerDocument, 'button', 'ouk-word-button', word);
    button.type = 'button';
    button.addEventListener('click', () => { void this.lookup(word); });
    return button;
  }

  async onClose() {
    this.closed = true;
    this.generation++;
    this.contentEl.replaceChildren();
    this.input = this.results = this.status = null;
  }
}

module.exports = {DictionaryView, VIEW_TYPE};
