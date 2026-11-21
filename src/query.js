'use strict';

const MAX_QUERY_LENGTH = 120;
const MAX_QUERY_WORDS = 8;

function normaliseQuery(value) {
  if (typeof value !== 'string' || value.length > 512) return '';
  const result = value.normalize('NFKC')
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, '')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ').trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (!result || result.length > MAX_QUERY_LENGTH || result.split(' ').length > MAX_QUERY_WORDS) return '';
  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '\-]*$/u.test(result)) return '';
  return result;
}

function keyOf(value) {
  return value.normalize('NFKC').toLocaleLowerCase('en-GB').replace(/\s+/g, ' ').trim();
}

function lemmaCandidates(query) {
  const value = keyOf(normaliseQuery(query));
  if (!value) return [];
  const result = new Set([value]);
  if (value.endsWith("'s")) result.add(value.slice(0, -2));
  if (value.endsWith("s'")) result.add(value.slice(0, -1));
  if (value.includes('- ')) {
    result.add(value.replace(/- /g, ''));
    result.add(value.replace(/- /g, '-'));
  }
  if (value.includes(' ')) return [...result];
  const add = (suffix, replacement = '') => {
    if (value.endsWith(suffix) && value.length > suffix.length + 2) {
      result.add(value.slice(0, -suffix.length) + replacement);
    }
  };
  add('ies', 'y'); add('ied', 'y'); add('ves', 'f'); add('ves', 'fe');
  add('es'); add('s'); add('ing'); add('ing', 'e'); add('ed'); add('ed', 'e');
  add('ier', 'y'); add('iest', 'y'); add('er'); add('er', 'e'); add('est'); add('est', 'e');
  for (const suffix of ['ing', 'ed', 'er', 'est']) {
    if (!value.endsWith(suffix)) continue;
    const stem = value.slice(0, -suffix.length);
    if (stem.length > 2 && /([bcdfghjklmnpqrstvwxyz])\1$/.test(stem)) result.add(stem.slice(0, -1));
  }
  return [...result];
}

module.exports = {normaliseQuery, keyOf, lemmaCandidates, MAX_QUERY_LENGTH};
