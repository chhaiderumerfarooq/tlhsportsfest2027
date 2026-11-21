import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expectedBackendCopy, expectedBrowserCopy } from '../scripts/sync-rules.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('assets/js/rules.js is an exact copy of shared/rules.js', () => {
  assert.equal(read('assets/js/rules.js'), expectedBrowserCopy(read('shared/rules.js')));
});

test('backend/Rules.gs is the generated Apps Script copy', () => {
  assert.equal(read('backend/Rules.gs'), expectedBackendCopy(read('shared/rules.js')));
});

test('the backend copy has no ES module syntax', () => {
  const backend = read('backend/Rules.gs');
  assert.doesNotMatch(backend, /^\s*export\s/m);
  assert.doesNotMatch(backend, /^\s*import\s/m);
  assert.match(backend, /function validateSubmission/);
  assert.match(backend, /function calculateTotals/);
});
