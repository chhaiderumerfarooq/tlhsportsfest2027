#!/usr/bin/env node
/*
 * Builds data/games.seed.csv and backend/SeedGames.gs from the original
 * spreadsheet export in data/Games_details_xlsx_-_Games.csv.
 *
 * Usage: node scripts/build-seed.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const inputPath = path.join(root, 'data', 'Games_details_xlsx_-_Games.csv');
const seedCsvPath = path.join(root, 'data', 'games.seed.csv');
const seedGsPath = path.join(root, 'backend', 'SeedGames.gs');
const mockGamesPath = path.join(root, 'assets', 'js', 'mock-games.js');

const HEADERS = [
  'GameID', 'Active', 'SortOrder', 'Name', 'Category', 'Format', 'Divisions',
  'AgeGroups', 'EarlyFee', 'RegularFee', 'MinPlayers', 'MaxPlayers', 'MaxEntries',
  'Details', 'Prizes', 'Coach', 'Head', 'CoHead1', 'CoHead2'
];

/** RFC 4180-ish CSV parser: quotes, escaped quotes and newlines in cells. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

function tidy(text) {
  return String(text || '')
    .replace(/\(\s*boys\s+girls\s*\)/gi, ' ')
    .replace(/\(\s*boys\s*\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function mapFormat(rawFormat, sr) {
  const value = String(rawFormat || '').trim();
  if (/^team\s*game$/i.test(value)) return 'Team';
  if (/^single$/i.test(value)) return 'Single';
  if (/^double$/i.test(value)) return 'Double';
  if (/^individuals?$/i.test(value)) return 'Individual';
  if (!value) return 'Individual';
  // Sr 19 (PUBG Mobile) has "( boys girls)" typed into Format by mistake.
  if (/^\(\s*boys\s+girls\s*\)$/i.test(value)) return 'Individual';
  throw new Error('Unknown format on Sr ' + sr + ': ' + value);
}

function mapCategory(rawCategory) {
  const value = String(rawCategory || '').trim();
  if (!value) return 'Other';
  if (/^ground\s*game$/i.test(value)) return 'Ground Games';
  if (/^indoor\s*games?$/i.test(value)) return 'Indoor Games';
  if (/^e[\s-]*games?$/i.test(value)) return 'E-Games';
  if (/^workshops?$/i.test(value)) return 'Workshops';
  return value;
}

function mapDivisions(rawName, rawFormat, gameName) {
  if (/\(\s*boys\s+girls\s*\)/i.test(rawName)) return 'Boys,Girls';
  if (/\(\s*boys\s*\)/i.test(rawName)) return 'Boys';
  // The PUBG Mobile row has the marker in the Format cell. It still means
  // boys and girls; see IMPORT_NOTES.md.
  if (/^\(\s*boys\s+girls\s*\)$/i.test(String(rawFormat || '').trim())) return 'Boys,Girls';
  return 'Open';
}

function mapPlayers(rawPlayers, format) {
  const value = String(rawPlayers || '').trim();
  const match = value.match(/(\d+)\s*players?\s*\+\s*(\d+)\s*extra/i);
  if (match) {
    const min = Number(match[1]);
    return { minPlayers: min, maxPlayers: min + Number(match[2]) };
  }
  if (format === 'Double') return { minPlayers: 2, maxPlayers: 2 };
  return { minPlayers: 1, maxPlayers: 1 };
}

function mapAgeGroups(rawAgeGroups) {
  const value = String(rawAgeGroups || '').trim();
  if (!value) return 'Open';
  return value.split(',').map((group) => group.trim()).filter(Boolean).join(', ');
}

export function buildSeedRows(csvText) {
  const rows = parseCsv(csvText);
  const header = rows[0].map((cell) => cell.trim());
  const index = {};
  header.forEach((name, i) => { index[name] = i; });
  const required = ['Sr #', 'Game', 'Format', 'Category', 'Age Category', 'Early Reg. Fee', 'Regular Fee', 'Players', 'Rules / Remarks for Invite', 'Prizes'];
  for (const name of required) {
    if (index[name] === undefined) throw new Error('Missing CSV column: ' + name);
  }

  const games = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (name) => (row[index[name]] === undefined ? '' : row[index[name]]);
    const sr = Number(String(get('Sr #')).trim());
    if (!sr) continue;

    const rawName = String(get('Game')).trim();
    const rawFormat = String(get('Format')).trim();
    const format = mapFormat(rawFormat, sr);
    let name = tidy(rawName);
    if (format === 'Single') name += ' (Singles)';
    if (format === 'Double') name += ' (Doubles)';

    let divisions = mapDivisions(rawName, rawFormat, name);
    if (sr === 2) divisions = 'Boys'; // Futsal prizes say "only boys".
    const players = mapPlayers(get('Players'), format);
    const earlyFee = Number(String(get('Early Reg. Fee')).replace(/,/g, '').trim());
    const regularFee = Number(String(get('Regular Fee')).replace(/,/g, '').trim());

    games.push({
      gameId: 'G' + String(sr).padStart(2, '0'),
      active: sr === 35 ? false : true, // Mafia (Hidden Game)
      sortOrder: sr,
      name: name,
      category: mapCategory(get('Category')),
      format: format,
      divisions: divisions,
      ageGroups: mapAgeGroups(get('Age Category')),
      earlyFee: earlyFee,
      regularFee: regularFee,
      minPlayers: players.minPlayers,
      maxPlayers: players.maxPlayers,
      maxEntries: '',
      details: String(get('Rules / Remarks for Invite')).trim(),
      prizes: String(get('Prizes')).trim(),
      coach: String(get('Coach / Teacher') || '').trim(),
      head: String(get('Head') || '').trim(),
      coHead1: String(get('Co-head 1') || '').trim(),
      coHead2: String(get('Co-head 2') || '').trim()
    });
  }
  return games;
}

function seedCsvRows(games) {
  return games.map((game) => [
    game.gameId, game.active ? 'TRUE' : 'FALSE', game.sortOrder, game.name, game.category, game.format,
    game.divisions, game.ageGroups, game.earlyFee, game.regularFee,
    game.minPlayers, game.maxPlayers, game.maxEntries, game.details, game.prizes,
    game.coach, game.head, game.coHead1, game.coHead2
  ]);
}

function seedGs(games) {
  const serialisable = games.map((game) => ({
    gameId: game.gameId,
    active: game.active ? 'TRUE' : 'FALSE',
    sortOrder: game.sortOrder,
    name: game.name,
    category: game.category,
    format: game.format,
    divisions: game.divisions,
    ageGroups: game.ageGroups,
    earlyFee: game.earlyFee,
    regularFee: game.regularFee,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    maxEntries: game.maxEntries,
    details: game.details,
    prizes: game.prizes,
    coach: game.coach,
    head: game.head,
    coHead1: game.coHead1,
    coHead2: game.coHead2
  }));

  return `/*
 * TLH Sports Fest 3.0 - games list seed.
 *
 * AUTO-GENERATED from data/Games_details_xlsx_-_Games.csv by
 * scripts/build-seed.js. The reviewed copy is data/games.seed.csv.
 *
 * Run seedGames() once from the Apps Script editor after setupWorkbook().
 * It only writes when the Games tab has no data rows, so it can never
 * overwrite games you have edited in the Sheet.
 */

var TLH_SEED_GAMES = ${JSON.stringify(serialisable, null, 2)};

function seedGames() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName('Games');
  if (!sheet) {
    throw new Error('Run TLH Sports Fest > Set up or repair workbook first.');
  }
  if (sheet.getLastRow() > 1) {
    logEvent_('INFO', 'SeedGames', 'Games tab already has data; seed skipped.');
    return { written: 0 };
  }

  var rows = TLH_SEED_GAMES.map(function (game) {
    return [
      game.gameId, game.active ? 'TRUE' : 'FALSE', game.sortOrder, game.name, game.category,
      game.format, game.divisions, game.ageGroups, game.earlyFee,
      game.regularFee, game.minPlayers, game.maxPlayers, game.maxEntries,
      game.details, game.prizes, game.coach, game.head, game.coHead1, game.coHead2
    ];
  });

  if (sheet.getMaxRows() < rows.length + 1) {
    sheet.insertRowsAfter(sheet.getMaxRows(), rows.length + 1 - sheet.getMaxRows());
  }
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(2, 9, rows.length, 2).setNumberFormat('#,##0');
  sheet.getRange(2, 2, rows.length, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['TRUE', 'FALSE'], true).setAllowInvalid(false).build()
  );
  clearConfigCache_();
  logEvent_('INFO', 'SeedGames', 'Wrote ' + rows.length + ' games from the seed list.');
  return { written: rows.length };
}
`;
}

function mockGamesJs(games) {
  const publicGames = games.filter((game) => game.active).map((game) => ({
    id: game.gameId,
    name: game.name,
    category: game.category,
    format: game.format,
    divisions: game.divisions.split(',').map((value) => value.trim()),
    ageGroups: game.ageGroups.split(',').map((value) => value.trim()),
    earlyFee: game.earlyFee,
    regularFee: game.regularFee,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    maxEntries: game.maxEntries === '' ? null : Number(game.maxEntries),
    details: game.details,
    prizes: game.prizes,
    sortOrder: game.sortOrder
  }));
  return `/*
 * AUTO-GENERATED by scripts/build-seed.js from data/games.seed.csv.
 * Used only by the offline mock API (assets/js/mock.js). Do not edit.
 */
export const MOCK_GAMES = ${JSON.stringify(publicGames, null, 2)};
`;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const csvText = fs.readFileSync(inputPath, 'utf8');
  const games = buildSeedRows(csvText);
  if (games.length !== 35) throw new Error('Expected 35 games, got ' + games.length);
  const names = new Set(games.map((g) => g.name));
  if (names.size !== games.length) throw new Error('Game names are not unique');
  fs.writeFileSync(seedCsvPath, toCsv([HEADERS, ...seedCsvRows(games)]));
  fs.writeFileSync(seedGsPath, seedGs(games));
  fs.writeFileSync(mockGamesPath, mockGamesJs(games));
  console.log('Wrote data/games.seed.csv, backend/SeedGames.gs and assets/js/mock-games.js (' + games.length + ' games)');
}

export { HEADERS, toCsv, seedCsvRows };
