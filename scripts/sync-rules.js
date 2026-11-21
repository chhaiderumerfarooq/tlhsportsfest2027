#!/usr/bin/env node
/*
 * Copies shared/rules.js to the two places that need it:
 *   assets/js/rules.js  - byte-for-byte ES module copy
 *   backend/Rules.gs    - same code without the ES module export block
 *
 * Usage:
 *   node scripts/sync-rules.js          write the copies
 *   node scripts/sync-rules.js --check  exit 1 if a copy is out of date
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const sourcePath = path.join(root, 'shared', 'rules.js');
const browserPath = path.join(root, 'assets', 'js', 'rules.js');
const backendPath = path.join(root, 'backend', 'Rules.gs');

export function expectedBrowserCopy(source) {
  return source;
}

export function expectedBackendCopy(source) {
  const withoutExports = source.replace(/\nexport\s*\{[\s\S]*?\};\s*$/m, '\n');
  if (withoutExports === source) {
    throw new Error('Could not find the export block at the end of shared/rules.js');
  }
  return [
    '/*',
    ' * AUTO-GENERATED FILE. Do not edit by hand.',
    ' * Source: shared/rules.js',
    ' * Regenerate with: npm run sync',
    ' *',
    ' * This copy has no ES module export block so Apps Script can load it as',
    ' * plain global functions.',
    ' */',
    '',
    withoutExports.trimEnd(),
    ''
  ].join('\n');
}

export function syncRules({ check = false } = {}) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const browserCopy = expectedBrowserCopy(source);
  const backendCopy = expectedBackendCopy(source);

  const targets = [
    { path: browserPath, content: browserCopy, label: 'assets/js/rules.js' },
    { path: backendPath, content: backendCopy, label: 'backend/Rules.gs' }
  ];

  let stale = false;
  for (const target of targets) {
    const current = fs.existsSync(target.path) ? fs.readFileSync(target.path, 'utf8') : null;
    if (current === target.content) continue;
    stale = true;
    if (!check) {
      fs.mkdirSync(path.dirname(target.path), { recursive: true });
      fs.writeFileSync(target.path, target.content);
      console.log('Wrote ' + target.label);
    } else {
      console.error('Out of date: ' + target.label);
    }
  }

  if (check && stale) return 1;
  if (!check && !stale) console.log('Rules copies are already up to date.');
  return 0;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exitCode = syncRules({ check: process.argv.includes('--check') });
}
