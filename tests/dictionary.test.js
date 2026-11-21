'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const {Dictionary, decodeDictionary, boundedDistance} = require('../src/dictionary');
const {normaliseQuery, lemmaCandidates} = require('../src/query');
const root = path.resolve(__dirname, '..');
const compressed = fs.readFileSync(path.join(root, 'data/dictionary.json.gz'));
const payload = JSON.parse(zlib.gunzipSync(compressed));
const dictionary = new Dictionary(payload);

test('vendored data matches the published provenance and has substantial coverage', () => {
  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'data/provenance.json'), 'utf8'));
  assert.equal(crypto.createHash('sha256').update(compressed).digest('hex'), provenance.sha256);
  assert.equal(dictionary.meta.headwords, dictionary.keys.length);
  assert.ok(dictionary.keys.length > 125000);
  assert.ok(dictionary.synsets.length > 100000);
  assert.equal(dictionary.meta.supplementEntries, 110);
});

for (const word of ['colour', 'centre', 'analyse', 'organise', 'defence', 'favourite', 'aluminium', 'theatre', 'serendipity', 'dictionary', 'privacy', 'the', 'and', 'you', 'would', "can't"]) {
  test(`bundled dictionary defines ${word}`, () => {
    const result = dictionary.lookup(word);
    assert.ok(result.matches.length, word);
    assert.ok(result.matches.every(match => match.senses.every(sense => typeof sense.definition === 'string' && sense.definition.length > 0)));
  });
}

for (const [word, lemma] of [['went', 'go'], ['children', 'child'], ['mice', 'mouse'], ['running', 'run'], ['colours', 'colour'], ['brighter', 'bright']]) {
  test(`inflection ${word} includes ${lemma}`, () => assert.ok(dictionary.lookup(word).matches.some(match => match.word.toLowerCase() === lemma)));
}

test('British IPA never contains an explicitly American-only transcription', () => {
  const result = dictionary.lookup('organize');
  assert.ok(result.matches.some(match => match.ipa.some(item => item[1] === 'GB')));
  for (const match of result.matches) for (const ipa of match.ipa) assert.ok(ipa[1] === '' || ipa[1] === 'GB');
});

test('American spellings provide a local British alternative', () => {
  assert.ok(dictionary.lookup('color').matches.some(match => match.alternatives.includes('colour')));
});

test('curly apostrophes, punctuation and PDF hyphenation are normalised', () => {
  assert.equal(normaliseQuery('  “colour.”  '), 'colour');
  assert.equal(normaliseQuery('can’t'), "can't");
  assert.ok(dictionary.lookup('colour-\nful').matches.some(match => match.word === 'colourful'));
  assert.ok(lemmaCandidates('reader’s').includes('reader'));
});

test('large selections and non-word content are rejected without executing anything', () => {
  for (const text of ['x'.repeat(513), 'a b c d e f g h i', 'https://example.com', 'hello@example.com', '<script>alert(1)</script>', null]) {
    assert.equal(normaliseQuery(text), '');
  }
});

test('a missing word gets local spelling suggestions, not a remote fallback', () => {
  const result = dictionary.lookup('colur');
  assert.equal(result.matches.length, 0);
  assert.ok(result.suggestions.includes('colour'));
});

test('prototype-like queries are handled as data', () => {
  for (const word of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.doesNotThrow(() => dictionary.lookup(word));
});

test('all bundled sense and form references resolve', () => {
  for (const [word, entries] of Object.entries(dictionary.entries)) for (const entry of entries) {
    for (const index of entry.s) assert.ok(dictionary.synsets[index]?.[0], `${word}: ${index}`);
    for (const ipa of entry.i || []) assert.ok(ipa[1] === '' || ipa[1] === 'GB');
  }
  for (const entries of Object.values(dictionary.forms)) for (const key of entries) assert.ok(Object.hasOwn(dictionary.entries, key));
});

test('real Web Streams decompression opens the complete bundled dictionary', async () => {
  const loaded = await decodeDictionary(compressed.toString('base64'));
  assert.equal(loaded.meta.headwords, dictionary.meta.headwords);
  assert.ok(loaded.lookup('colour').matches.length);
});

test('bounded edit distance respects its cap', () => {
  assert.equal(boundedDistance('colour', 'colur', 2), 1);
  assert.ok(boundedDistance('colour', 'completelydifferent', 2) > 2);
});
