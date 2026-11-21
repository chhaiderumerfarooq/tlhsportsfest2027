import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { MOCK_GAMES } from '../assets/js/mock-games.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function parseGappsScript(filePath) {
  const temp = path.join(root, '.tmp-node-check-' + path.basename(filePath).replace(/\.gs$/, '') + '.js');
  fs.writeFileSync(temp, read(filePath));
  try {
    const result = spawnSync(process.execPath, ['--check', temp], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || 'GAS syntax failed');
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

test('mock games are generated from the seed and exclude inactive games', () => {
  assert.ok(MOCK_GAMES.length >= 1);
  MOCK_GAMES.forEach((game) => {
    assert.equal(typeof game.id, 'string');
    assert.equal(typeof game.name, 'string');
    assert.equal(typeof game.category, 'string');
    assert.equal(typeof game.format, 'string');
    assert.ok(Array.isArray(game.divisions));
    assert.ok(Array.isArray(game.ageGroups));
    assert.ok(Number.isFinite(game.earlyFee));
    assert.ok(Number.isFinite(game.regularFee));
    assert.ok(game.earlyFee > 0 && game.regularFee > 0);
    assert.ok(['Team', 'Single', 'Double', 'Individual'].includes(game.format));
    game.divisions.forEach((division) => {
      assert.ok(['Open', 'Boys', 'Girls'].includes(division) || division.length > 0);
    });
  });
  const ids = MOCK_GAMES.map((game) => game.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(MOCK_GAMES.map((game) => game.name)).size, MOCK_GAMES.length);
  assert.equal(MOCK_GAMES.some((game) => String(game.active) === 'false'), false);
});

test('Apps Script files pass a Node syntax check', () => {
  fs.readdirSync(path.join(root, 'backend'))
    .filter((file) => file.endsWith('.gs'))
    .forEach((file) => parseGappsScript('backend/' + file));
});

test('appsscript.json has the required deployment settings', () => {
  const config = JSON.parse(read('backend/appsscript.json'));
  assert.equal(config.timeZone, 'Asia/Karachi');
  assert.equal(config.runtimeVersion, 'V8');
  assert.deepEqual(config.webapp, { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' });
  [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/script.send_mail',
    'https://www.googleapis.com/auth/script.scriptapp',
    'https://www.googleapis.com/auth/userinfo.email'
  ].forEach((scope) => assert.ok(config.oauthScopes.includes(scope), 'missing scope ' + scope));
});

test('game seed CSV exists and includes the fallback games', () => {
  const csv = read('data/games.seed.csv').trim().split(/\r?\n/);
  const header = csv[0].split(',').map((column) => column.replace(/"/g, ''));
  assert.equal(header[0], 'GameID');
  assert.equal(header[1], 'Active');
  assert.equal(header.length, 19);
  const rows = csv.slice(1).map((line) => {
    const columns = line.split(',');
    return { id: columns[0], active: columns[1] };
  });
  assert.equal(rows.length, 35);
  assert.equal(rows[0].id, 'G01');
  assert.equal(rows[0].active, 'TRUE');
  assert.equal(rows[34].id, 'G35');
  assert.equal(rows[34].active, 'FALSE');
  const ids = rows.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('documentation files exist', () => {
  ['README.md', 'SETUP.md', 'ADMIN_GUIDE.md', 'TESTING.md', 'TROUBLESHOOTING.md', 'DECISIONS.md', 'IMPORT_NOTES.md']
    .forEach((file) => assert.ok(fs.existsSync(path.join(root, file)), 'missing ' + file));
  ['README.md', 'SETUP.md', 'ADMIN_GUIDE.md', 'TESTING.md', 'TROUBLESHOOTING.md', 'DECISIONS.md', 'IMPORT_NOTES.md']
    .forEach((file) => {
      const text = read(file);
      assert.ok(text.trim().length > 100, file + ' looks empty');
    });
});

test('index.html includes a11y and share metadata, no remote scripts', () => {
  const html = read('index.html');
  assert.ok(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1'));
  assert.ok(html.includes('<meta property="og:image" content="assets/img/og-image.png">'));
  assert.ok(html.includes('<meta property="og:image:width" content="1200">'));
  assert.ok(html.includes('role="alert"'));
  assert.ok(html.includes('<dialog'));
  assert.ok(html.includes('name="website"'));
  assert.match(html, /<script[^>]+src="assets\/js\/app\.js"/);
  assert.ok(html.indexOf('src="/') === -1);
  assert.ok(!html.includes('src="http'));
  assert.ok(!html.includes('src="https'));
});

test('package.json exposes the required scripts', () => {
  const pkg = JSON.parse(read('package.json'));
  ['test', 'sync', 'seed', 'serve'].forEach((script) => assert.ok(pkg.scripts[script], 'missing script ' + script));
});
