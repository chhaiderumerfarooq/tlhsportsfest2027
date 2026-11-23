import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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

test('the registration page is one page with all sections visible', () => {
  const html = read('index.html');
  const sectionIds = ['step-1', 'step-2', 'step-3', 'step-4'];
  sectionIds.forEach((id) => {
    const match = html.match(new RegExp('<section[^>]*id="' + id + '"[^>]*>'));
    assert.ok(match, 'missing section ' + id);
    assert.ok(!/hidden/.test(match[0]), id + ' must not be hidden');
  });
  const formIds = [
    'contact-name', 'contact-role', 'contact-whatsapp', 'contact-email',
    'contact-institution', 'game-search', 'games-grid', 'games-empty',
    'entries-list', 'review-entries', 'review-totals', 'amount-value',
    'transaction-id', 'consent', 'submit-btn'
  ];
  formIds.forEach((id) => assert.ok(html.includes('id="' + id + '"'), 'missing ' + id));
  ['wizard-form', 'games-toolbar', 'step1-next', 'step2-next', 'step3-next', 'submit-btn'].forEach((id) => {
    const needle = id === 'games-toolbar' ? 'class="games-toolbar"' : 'id="' + id + '"';
    assert.ok(html.includes(needle), 'missing ' + id);
  });
});

test('the page has no step wizard or progress navigation', () => {
  const html = read('index.html');
  assert.ok(!html.includes('step2-back'), 'the old back-to-details button must be gone');
  assert.ok(!html.includes('step3-back'), 'the old back-to-games button must be gone');
  assert.ok(!html.includes('step4-back'), 'the old back-to-people button must be gone');
  assert.ok(!html.includes('id="progress-bar"'), 'there is no step progress bar');
  assert.ok(!html.includes('class="progress-item"'), 'there are no step progress items');
  assert.ok(!html.includes('data-step='), 'step data attributes were removed');
  assert.ok(html.includes('id="wizard-form"'), 'the one form wraps all sections');
});

test('FlatSheets.gs defines the two registration tabs', () => {
  const flat = read('backend/FlatSheets.gs');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(flat, sandbox);

  const defs = sandbox.flatSheetDefs_();
  assert.equal(defs.length, 2);
  assert.equal(defs[0].name, 'Team Games');
  assert.equal(defs[1].name, 'Solo Games');
  assert.equal(defs[0].maxPlayers, 9);
  assert.equal(defs[1].maxPlayers, 2);

  const col = sandbox.TLH_FLAT_COL;
  const teamHeaders = sandbox.flatHeadersForDef_(defs[0]);
  assert.equal(teamHeaders.length, col.playerStart + 9 * 4);
  assert.equal(teamHeaders[col.paymentStatus], 'PaymentStatus');
  assert.equal(teamHeaders[col.playerStart], 'Player1Name');
  assert.equal(teamHeaders[col.playerStart + 8 * 4], 'Player9Name');
  const soloHeaders = sandbox.flatHeadersForDef_(defs[1]);
  assert.equal(soloHeaders[col.playerStart + 4], 'Player2Name');
  assert.equal(soloHeaders[col.playerStart + 3], 'Player1Age');
  assert.ok(read('backend/Workbook.gs').includes('setNumberFormat(\'yyyy-mm-dd\')'), 'DOB cells are date formatted');
  assert.ok(read('backend/Workbook.gs').includes('setNumberFormat(\'@\')'), 'text cells keep strings');
});

test('workbook setup and upgrade logic repairs legacy tabs safely', () => {
  const workbook = read('backend/Workbook.gs');
  const utils = read('backend/Utils.gs');
  assert.ok(workbook.includes('function removeDefaultSheet_'), 'default Sheet1 cleanup exists');
  assert.ok(workbook.includes('migrateLegacySheets_'), 'legacy migration entry point');
  assert.ok(workbook.includes('archiveLegacySheets_'), 'legacy tabs are archived');
  assert.ok(workbook.includes('applyPaymentStatusToRegistration_'), 'payment status propagation exists');
  assert.ok(utils.includes("ss.getSheetByName('Team Games') && ss.getSheetByName('Solo Games')"), 'upgrade detection');
});
