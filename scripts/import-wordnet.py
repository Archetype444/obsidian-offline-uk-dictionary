#!/usr/bin/env python3
"""Rebuild the vendored dictionary from an exact Open English Wordnet checkout.

Build-time requirement: PyYAML 6.0.3. The installed plugin has no Python or npm
dependencies. No downloads or upstream scripts are executed by this converter.
"""
import argparse
import difflib
import gzip
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import unicodedata
import yaml

SOURCE_COMMIT = '9b6aca775ae10ad3d2dc9956e8ad42a4ce1e076b'
ROOT = Path(__file__).resolve().parent.parent
BRITISH = {'86712636-n', '82423757-n'}
AMERICAN = {'87027384-n', '06960241-n'}


def key(text):
    text = unicodedata.normalize('NFKC', text)
    text = re.sub('[\u2018\u2019\u02bc]', "'", text)
    text = re.sub('[\u2010-\u2015\u2212]', '-', text)
    return ' '.join(text.lower().split())


def convert(upstream):
    actual = subprocess.check_output(['git', '-C', str(upstream), 'rev-parse', 'HEAD'], text=True).strip()
    if actual != SOURCE_COMMIT:
        raise SystemExit(f'Expected upstream revision {SOURCE_COMMIT}; got {actual}')
    source = upstream / 'src/yaml'
    loader = getattr(yaml, 'CSafeLoader', yaml.SafeLoader)
    synsets = {}
    for path in sorted(source.glob('*.yaml')):
        if not path.name.startswith(('noun.', 'verb.', 'adj.', 'adv.')):
            continue
        synsets.update(yaml.load(path.read_text(encoding='utf-8'), Loader=loader))
    ids = sorted(synsets)
    indices = {identity: index for index, identity in enumerate(ids)}
    senses = []
    for identity in ids:
        raw = synsets[identity]
        definitions = raw.get('definition', [])
        if not definitions:
            raise ValueError(f'Synset without a definition: {identity}')
        examples = [value if isinstance(value, str) else value.get('text', '') for value in raw.get('example', [])]
        senses.append(['; '.join(definitions), [value for value in examples if value], raw.get('members', [])])
    entries = {}
    forms = {}
    missing = []
    for path in sorted(source.glob('entries-*.yaml')):
        words = yaml.load(path.read_text(encoding='utf-8'), Loader=loader)
        for word, positions in words.items():
            word_key = key(word)
            for position, raw in positions.items():
                sense_ids = [sense['synset'] for sense in raw.get('sense', [])]
                missing.extend(identity for identity in sense_ids if identity not in indices)
                if not sense_ids:
                    continue
                tags = {identity for sense in raw['sense'] for identity in sense.get('exemplifies', [])}
                pronunciations = raw.get('pronunciation', [])
                preferred = [item for item in pronunciations if item.get('variety') == 'GB']
                if not preferred:
                    preferred = [item for item in pronunciations if not item.get('variety')]
                ipa = list(dict.fromkeys((item['value'], item.get('variety', '')) for item in preferred if item.get('value')))
                record = {'w': word, 'p': position.split('-')[0], 's': list(dict.fromkeys(indices[identity] for identity in sense_ids if identity in indices))}
                if ipa:
                    record['i'] = ipa
                if tags & BRITISH:
                    record['b'] = True
                if tags & AMERICAN:
                    record['u'] = True
                entries.setdefault(word_key, []).append(record)
                for form in raw.get('form', []):
                    if isinstance(form, str):
                        forms.setdefault(key(form), set()).add(word_key)
    if missing:
        raise ValueError(f'Unresolved dictionary references: {missing[:10]}')
    british_words = {record['w'] for records in entries.values() for record in records if record.get('b')}
    for records in entries.values():
        for record in records:
            if not record.get('u'):
                continue
            alternatives = set()
            for index in record['s']:
                for candidate in senses[index][2]:
                    if candidate in british_words and key(candidate) != key(record['w']) and difflib.SequenceMatcher(None, key(candidate), key(record['w'])).ratio() >= .72:
                        alternatives.add(candidate)
            if alternatives:
                record['k'] = sorted(alternatives)
    supplement = json.loads((ROOT / 'data/function-words.json').read_text(encoding='utf-8'))
    for word, (position, definition) in supplement.items():
        index = len(senses)
        senses.append([definition, [], []])
        entries.setdefault(key(word), []).append({'w': word, 'p': position, 's': [index]})
    meta = {
        'schema': 1,
        'name': 'Open English Wordnet with an original function-word supplement',
        'sourceCommit': SOURCE_COMMIT,
        'sourceRepository': 'https://github.com/globalwordnet/english-wordnet',
        'sourceVersion': 'Pinned source snapshot, 21 November 2026',
        'locale': 'en-GB',
        'headwords': len(entries),
        'lexicalEntries': sum(len(value) for value in entries.values()),
        'synsets': len(synsets),
        'supplementEntries': len(supplement),
        'licences': ['CC-BY-4.0', 'Princeton-WordNet', 'MIT (function-word supplement)'],
    }
    payload = {'meta': meta, 'entries': dict(sorted(entries.items())), 'forms': {word: sorted(values) for word, values in sorted(forms.items())}, 'synsets': senses}
    raw = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    (ROOT / 'data/dictionary.json.gz').write_bytes(compressed)
    (ROOT / 'data/metadata.json').write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'data/provenance.json').write_text(json.dumps({**meta, 'uncompressedBytes': len(raw), 'compressedBytes': len(compressed), 'sha256': hashlib.sha256(compressed).hexdigest()}, indent=2) + '\n', encoding='utf-8')
    licences = ROOT / 'licences'
    licences.mkdir(exist_ok=True)
    shutil.copyfile(upstream / 'LICENSE.md', licences / 'Open-English-Wordnet-CC-BY-4.0.txt')
    shutil.copyfile(upstream / 'WNDB_License.txt', licences / 'Princeton-WordNet.txt')
    print(json.dumps({**meta, 'compressedBytes': len(compressed), 'uncompressedBytes': len(raw)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('upstream', type=Path)
    convert(parser.parse_args().upstream.resolve())
