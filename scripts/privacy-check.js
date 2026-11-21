'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const rules = [
  ['network API', /\b(?:fetch|requestUrl|XMLHttpRequest|WebSocket|EventSource|sendBeacon|openExternal)\s*\(/],
  ['external assets or dynamic HTML', /\b(?:innerHTML|outerHTML)\s*=|createElement\(['"](?:script|img|audio|video|link|iframe)['"]\)/],
  ['persistent searches or clipboard', /\b(?:saveData|loadData|localStorage|indexedDB|clipboard|writeClipboard|readClipboard)\s*[.(]/],
  ['vault access', /\b(?:this\.)?app\s*\.\s*vault\b|\.adapter\b/],
  ['runtime logging', /\bconsole\s*\./],
  ['dynamic code execution', /\beval\s*\(|\bnew\s+Function\s*\(/],
  ['forbidden Node import', /require\(['"](?:node:)?(?:https?|net|tls|dns|fs|child_process|electron)['"]\)/],
];
const failures = [];
for (const name of fs.readdirSync(path.join(root, 'src'))) {
  if (!name.endsWith('.js')) continue;
  const source = fs.readFileSync(path.join(root, 'src', name), 'utf8');
  for (const [description, pattern] of rules) if (pattern.test(source)) failures.push(`${name}: ${description}`);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (Object.keys(pkg.dependencies || {}).length || Object.keys(pkg.devDependencies || {}).length) failures.push('Unexpected npm dependencies');
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log('Runtime privacy checks passed: no network, history storage, clipboard, vault access, dynamic code or logging APIs found.');
}
