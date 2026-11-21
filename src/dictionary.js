'use strict';

const {normaliseQuery, keyOf, lemmaCandidates} = require('./query');
const POS_NAMES = {n: 'Noun', v: 'Verb', a: 'Adjective', s: 'Adjective', r: 'Adverb', other: 'Word'};
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

class Dictionary {
  constructor(data) {
    if (data?.meta?.schema !== 1 || !data.entries || !Array.isArray(data.synsets) || !data.forms) {
      throw new Error('The bundled dictionary has an unsupported format.');
    }
    this.meta = data.meta;
    this.entries = data.entries;
    this.synsets = data.synsets;
    this.forms = data.forms;
    this.keys = Object.keys(data.entries).sort();
  }

  lookup(raw) {
    const query = normaliseQuery(raw);
    if (!query) return {query: '', matches: [], suggestions: []};
    const exact = keyOf(query);
    let keys = own(this.entries, exact) ? [exact] : [];
    if (own(this.forms, exact)) keys.push(...this.forms[exact]);
    if (!keys.length) {
      for (const candidate of lemmaCandidates(query)) {
        if (own(this.forms, candidate)) keys.push(...this.forms[candidate]);
        if (own(this.entries, candidate)) keys.push(candidate);
      }
    } else {
      // A plural can also have a specialised entry of its own (for example, "colours").
      // Retain it and include marked British base forms without reinterpreting ordinary
      // exact words through speculative stemming ("water" must not become "wat").
      for (const candidate of lemmaCandidates(query).slice(1)) {
        if (own(this.entries, candidate) && this.entries[candidate].some(entry => entry.b)) keys.push(candidate);
      }
    }
    keys = [...new Set(keys)].filter(key => own(this.entries, key)).slice(0, 8);
    const matches = keys.flatMap(key => this.entries[key].map(entry => ({
      word: entry.w,
      pos: POS_NAMES[entry.p] || entry.p || POS_NAMES.other,
      ipa: entry.i || [],
      british: Boolean(entry.b),
      american: Boolean(entry.u),
      alternatives: entry.k || [],
      senses: entry.s.map(index => this.synsets[index]).filter(Boolean).map(sense => ({
        definition: sense[0], examples: sense[1] || [], synonyms: sense[2] || [],
      })),
    })));
    return {query, matches, suggestions: matches.length ? [] : this.suggest(exact)};
  }

  suggest(query, limit = 8) {
    const first = query.charAt(0);
    if (!first || query.length > 32) return [];
    let lo = 0, hi = this.keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.keys[mid] < query) lo = mid + 1; else hi = mid;
    }
    const choices = [];
    for (let i = lo; i < this.keys.length && choices.length < limit; i++) {
      const key = this.keys[i];
      if (!key.startsWith(query)) break;
      choices.push({key, distance: 0});
    }
    if (choices.length < limit && query.length <= 24) {
      // Limit both the candidate set and edit distance, rather than scanning every definition.
      let tested = 0;
      for (const key of this.keys) {
        if (key[0] < first) continue;
        if (key[0] > first || tested >= 12000) break;
        if (Math.abs(key.length - query.length) > 2 || key.includes(' ')) continue;
        tested++;
        const distance = boundedDistance(query, key, 2);
        if (distance <= 2 && !choices.some(item => item.key === key)) choices.push({key, distance});
      }
    }
    choices.sort((a, b) => a.distance - b.distance || Number(this.isBritish(b.key)) - Number(this.isBritish(a.key)) || a.key.localeCompare(b.key, 'en-GB'));
    return choices.slice(0, limit).map(item => this.entries[item.key][0].w);
  }

  isBritish(key) { return own(this.entries, key) && this.entries[key].some(entry => entry.b); }
}

function boundedDistance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let minimum = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      minimum = Math.min(minimum, row[j]);
    }
    if (minimum > limit) return limit + 1;
    previous = row;
  }
  return previous[b.length];
}

async function decodeDictionary(base64) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  let text;
  if (typeof DecompressionStream === 'function') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else {
    // Desktop-only fallback for older WebViews. This reads no files and uses no network.
    text = require('zlib').gunzipSync(bytes).toString('utf8');
  }
  return new Dictionary(JSON.parse(text));
}

module.exports = {Dictionary, decodeDictionary, boundedDistance};
