'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const compressed = fs.readFileSync(path.join(root, 'data/dictionary.json.gz'));
const meta = JSON.parse(fs.readFileSync(path.join(root, 'data/metadata.json'), 'utf8'));
const provenance = JSON.parse(fs.readFileSync(path.join(root, 'data/provenance.json'), 'utf8'));
const hash = crypto.createHash('sha256').update(compressed).digest('hex');
if (hash !== provenance.sha256) throw new Error('The vendored dictionary does not match its provenance checksum.');
const names = ['query', 'dictionary', 'selection', 'view', 'main'];
const modules = names.map(name => `${JSON.stringify('./' + name)}: function(module, exports, require) {\n${fs.readFileSync(path.join(root, 'src', name + '.js'), 'utf8')}\n}`);
const notices = ['LICENSE', 'THIRD-PARTY-NOTICES.md', 'licences/Open-English-Wordnet-CC-BY-4.0.txt', 'licences/Princeton-WordNet.txt'].map(name => fs.readFileSync(path.join(root, name), 'utf8')).join('\n\n');
modules.push(`"./bundled-data": function(module) { module.exports = ${JSON.stringify({meta, gzip: compressed.toString('base64'), notices})}; }`);
const banner = '/* Offline UK Dictionary 1.0.0 | MIT code | CC BY 4.0 / Princeton WordNet data.\n * Complete source, notices and data provenance accompany this plugin.\n * No network access, telemetry, search-history persistence or vault writes. */\n';
const bundle = banner + `'use strict';\nconst externalRequire = require;\nconst factories = {\n${modules.join(',\n')}\n};\nconst cache = Object.create(null);\nfunction load(id) {\n  if (id === 'obsidian' || id === 'zlib') return externalRequire(id);\n  if (!Object.prototype.hasOwnProperty.call(factories, id)) throw new Error('Unknown bundled module');\n  if (!cache[id]) {\n    cache[id] = {exports: {}};\n    factories[id](cache[id], cache[id].exports, load);\n  }\n  return cache[id].exports;\n}\nmodule.exports = load('./main');\n`;
fs.mkdirSync(output, {recursive: true});
fs.writeFileSync(path.join(output, 'main.js'), bundle);
for (const name of ['manifest.json', 'styles.css', 'LICENSE', 'README.md', 'PRIVACY.md', 'THIRD-PARTY-NOTICES.md', 'TESTING.md']) {
  fs.copyFileSync(path.join(root, name), path.join(output, name));
}
fs.cpSync(path.join(root, 'licences'), path.join(output, 'licences'), {recursive: true});
fs.copyFileSync(path.join(root, 'data/provenance.json'), path.join(output, 'dictionary-provenance.json'));
const checksums = ['main.js', 'manifest.json', 'styles.css'].map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(output, name))).digest('hex')}  ${name}`).join('\n') + '\n';
fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), checksums);
console.log(`Built complete offline plugin: ${meta.headwords.toLocaleString('en-GB')} headwords; ${(Buffer.byteLength(bundle) / 1048576).toFixed(2)} MiB main.js.`);
