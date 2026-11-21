import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSeedRows, parseCsv, toCsv, HEADERS, seedCsvRows } from '../scripts/build-seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const sourceCsv = fs.readFileSync(path.join(root, 'data', 'Games_details_xlsx_-_Games.csv'), 'utf8');
const seedCsv = fs.readFileSync(path.join(root, 'data', 'games.seed.csv'), 'utf8');
const games = buildSeedRows(sourceCsv);
const byId = (id) => games.find((game) => game.gameId === id);

test('the seed has 35 games with unique names and sequential IDs', () => {
  assert.equal(games.length, 35);
  assert.equal(new Set(games.map((game) => game.name)).size, 35);
  games.forEach((game, index) => {
    assert.equal(game.gameId, 'G' + String(index + 1).padStart(2, '0'));
    assert.equal(game.sortOrder, index + 1);
  });
});

test('data/games.seed.csv is the reviewed, regenerated output', () => {
  assert.equal(seedCsv, toCsv([HEADERS, ...seedCsvRows(games)]));
});

test('names drop the division markers and keep platform tags', () => {
  assert.equal(byId('G01').name, 'Cricket');
  assert.equal(byId('G16').name, 'Foosball');
  assert.equal(byId('G20').name, 'Tekken 8 (PS)');
  assert.equal(byId('G23').name, 'Free Fire Custom (Mobile)');
  assert.equal(byId('G25').name, 'Minecraft PVP (PC)');
  assert.equal(byId('G35').name, 'Mafia (Hidden Game)');
});

test('Single and Double names get a unique suffix', () => {
  assert.equal(byId('G04').name, 'Paddle Tennis (Singles)');
  assert.equal(byId('G05').name, 'Paddle Tennis (Doubles)');
  assert.equal(byId('G10').name, 'Badminton (Doubles)');
  assert.equal(byId('G12').name, 'Table Tennis (Doubles)');
  assert.equal(byId('G07').name, 'Pickle Ball (Doubles)');
});

test('divisions follow the marker, with the documented overrides', () => {
  assert.equal(byId('G01').divisions, 'Boys,Girls');
  assert.equal(byId('G16').divisions, 'Boys');
  assert.equal(byId('G20').divisions, 'Open');
  assert.equal(byId('G02').divisions, 'Boys'); // Futsal prizes say only boys
  assert.equal(byId('G19').divisions, 'Boys,Girls'); // marker typed in Format
});

test('formats map from the spreadsheet wording', () => {
  assert.equal(byId('G01').format, 'Team');
  assert.equal(byId('G04').format, 'Single');
  assert.equal(byId('G05').format, 'Double');
  assert.equal(byId('G08').format, 'Individual');
  assert.equal(byId('G19').format, 'Individual'); // Format cell mistake
  assert.equal(byId('G35').format, 'Individual');
});

test('categories are normalized', () => {
  assert.equal(byId('G01').category, 'Ground Games');
  assert.equal(byId('G09').category, 'Indoor Games');
  assert.equal(byId('G19').category, 'E-Games');
  assert.equal(byId('G26').category, 'Workshops');
  assert.equal(byId('G08').category, 'Other');
  assert.equal(byId('G35').category, 'Other');
});

test('fees are numbers with commas removed', () => {
  assert.equal(byId('G01').earlyFee, 6000);
  assert.equal(byId('G01').regularFee, 7000);
  assert.equal(byId('G23').earlyFee, 500);
  assert.equal(byId('G23').regularFee, 700);
});

test('player counts are derived from the players column and format', () => {
  assert.deepEqual([byId('G01').minPlayers, byId('G01').maxPlayers], [7, 9]);
  assert.deepEqual([byId('G02').minPlayers, byId('G02').maxPlayers], [5, 7]);
  assert.deepEqual([byId('G04').minPlayers, byId('G04').maxPlayers], [1, 1]);
  assert.deepEqual([byId('G05').minPlayers, byId('G05').maxPlayers], [2, 2]);
  assert.deepEqual([byId('G08').minPlayers, byId('G08').maxPlayers], [1, 1]);
});

test('age groups are copied and blanks become Open', () => {
  assert.equal(byId('G01').ageGroups, 'U19, U17, U15');
  assert.equal(byId('G34').ageGroups, 'Open');
  assert.equal(byId('G35').ageGroups, 'Open');
});

test('the documented overrides are applied', () => {
  assert.equal(byId('G02').divisions, 'Boys');
  assert.equal(byId('G35').active, false);
  assert.equal(byId('G01').active, true);
});

test('the seed CSV keeps the internal columns but the public API will not', () => {
  const rows = parseCsv(seedCsv);
  assert.deepEqual(rows[0], HEADERS);
  assert.ok(HEADERS.includes('Coach'));
  assert.ok(HEADERS.includes('Head'));
  assert.ok(HEADERS.includes('CoHead1'));
  assert.ok(HEADERS.includes('CoHead2'));
});

test('SeedGames.gs embeds every game and only writes when empty', () => {
  const source = fs.readFileSync(path.join(root, 'backend', 'SeedGames.gs'), 'utf8');
  assert.match(source, /var TLH_SEED_GAMES = \[/);
  assert.match(source, /sheet\.getLastRow\(\) > 1/);
  for (const game of games) {
    assert.ok(source.includes(JSON.stringify(game.name)), 'missing ' + game.name);
  }
});
