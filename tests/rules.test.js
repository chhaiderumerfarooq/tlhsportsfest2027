import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  endOfDayPkt,
  isEarlyBirdAt,
  isAfterClose,
  registrationState,
  ageOnCutoff,
  isDobEligible,
  calculateTotals,
  normalizeIdNumber,
  formatIdNumber,
  isValidIdNumber,
  normalizeWhatsapp,
  whatsappInternational,
  whatsappLink,
  sanitizeCell,
  formatPKR,
  groupIban,
  buildRoster,
  playerRoleForIndex,
  formatLabel,
  validateSubmission,
  ageCheckMessage,
  parsePktDateTime,
  formatPktDateTime
} from '../shared/rules.js';
import { parseCsv } from '../scripts/build-seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function seedGames() {
  const rows = parseCsv(fs.readFileSync(path.join(root, 'data', 'games.seed.csv'), 'utf8'));
  return rows.slice(1).map((row) => ({
    id: row[0],
    active: String(row[1] || '').trim().toLowerCase() === 'true',
    sortOrder: Number(row[2]),
    name: row[3],
    category: row[4],
    format: row[5],
    divisions: row[6].split(',').map((s) => s.trim()),
    ageGroups: row[7].split(',').map((s) => s.trim()),
    earlyFee: Number(row[8]),
    regularFee: Number(row[9]),
    minPlayers: Number(row[10]),
    maxPlayers: Number(row[11]),
    maxEntries: row[12] ? Number(row[12]) : null,
    details: row[13],
    prizes: row[14]
  }));
}

const games = seedGames();
const game = (id) => games.find((g) => g.id === id);

const contact = {
  name: 'Ayesha Khan',
  role: 'Parent',
  whatsapp: '+923001234567',
  email: 'ayesha@example.com',
  institution: 'TLH School'
};

function player(index, overrides = {}) {
  return {
    personKey: 'p' + index,
    name: 'Player ' + index,
    dob: '2009-04-12',
    idNumber: '35202' + String(1000000 + index) + '1',
    idFileId: 'idfile-' + index,
    ...overrides
  };
}

function cricketEntry(overrides = {}) {
  return {
    gameId: 'G01',
    ageGroup: 'U19',
    division: 'Boys',
    teamName: 'Tigers',
    institution: '',
    players: Array.from({ length: 7 }, (_, i) => player(i + 1)),
    ...overrides
  };
}

function payload(entries, overrides = {}) {
  return {
    contact,
    entries,
    payment: { proofFileId: 'proof-1', transactionId: 'TX123' },
    consent: true,
    ...overrides
  };
}

const options = {
  games,
  config: {
    RegistrationOpen: true,
    EarlyBirdEndDate: '2026-12-10',
    RegistrationCloseDate: '2026-12-20',
    AgeCutoffDate: '2027-01-30'
  },
  now: new Date('2026-11-21T10:00:00Z'),
  ageCutoffDate: '2027-01-30'
};

/* ------------------------------------------------------------------ *
 * Deadlines
 * ------------------------------------------------------------------ */

test('early bird ends at 23:59:59 PKT on 2026-12-10', () => {
  const lastMoment = endOfDayPkt('2026-12-10');
  assert.equal(formatPktDateTime(lastMoment), '2026-12-10 23:59:59');
  assert.equal(isEarlyBirdAt(lastMoment, '2026-12-10'), true);

  const nextMoment = new Date(lastMoment.getTime() + 1);
  assert.equal(formatPktDateTime(nextMoment), '2026-12-11 00:00:00');
  assert.equal(isEarlyBirdAt(nextMoment, '2026-12-10'), false);
});

test('registration closes at 23:59:59 PKT on 2026-12-20', () => {
  const lastMoment = endOfDayPkt('2026-12-20');
  assert.equal(formatPktDateTime(lastMoment), '2026-12-20 23:59:59');
  assert.equal(isAfterClose(lastMoment, '2026-12-20'), false);

  const nextMoment = new Date(lastMoment.getTime() + 1);
  assert.equal(formatPktDateTime(nextMoment), '2026-12-21 00:00:00');
  assert.equal(isAfterClose(nextMoment, '2026-12-20'), true);

  assert.equal(registrationState(lastMoment, options.config).registrationOpen, true);
  assert.equal(registrationState(nextMoment, options.config).registrationOpen, false);
  assert.equal(registrationState(nextMoment, options.config).status, 'CLOSED');
});

test('RegistrationOpen FALSE closes the form immediately', () => {
  const state = registrationState(new Date('2026-11-21T10:00:00Z'), {
    ...options.config,
    RegistrationOpen: 'FALSE'
  });
  assert.equal(state.registrationOpen, false);
  assert.equal(state.status, 'NOT_OPEN');
});

test('TestNowOverride dates parse as Pakistan time', () => {
  const parsed = parsePktDateTime('2026-12-10 23:59:59');
  assert.equal(formatPktDateTime(parsed), '2026-12-10 23:59:59');
  assert.equal(parsed.toISOString(), '2026-12-10T18:59:59.000Z');
});

/* ------------------------------------------------------------------ *
 * Ages
 * ------------------------------------------------------------------ */

test('U19 accepts 2008-01-31 and rejects 2008-01-30', () => {
  assert.equal(isDobEligible('2008-01-31', 'U19', '2027-01-30'), true);
  assert.equal(isDobEligible('2008-01-30', 'U19', '2027-01-30'), false);
  assert.equal(ageOnCutoff('2008-01-31', '2027-01-30'), 18);
  assert.equal(ageOnCutoff('2008-01-30', '2027-01-30'), 19);
});

test('U17 accepts 2010-01-31 and rejects 2010-01-30', () => {
  assert.equal(isDobEligible('2010-01-31', 'U17', '2027-01-30'), true);
  assert.equal(isDobEligible('2010-01-30', 'U17', '2027-01-30'), false);
});

test('U15 accepts 2012-01-31 and rejects 2012-01-30', () => {
  assert.equal(isDobEligible('2012-01-31', 'U15', '2027-01-30'), true);
  assert.equal(isDobEligible('2012-01-30', 'U15', '2027-01-30'), false);
});

test('Open has no age limit but still needs a valid date of birth', () => {
  assert.equal(isDobEligible('1990-05-01', 'Open', '2027-01-30'), true);
  assert.equal(isDobEligible('', 'Open', '2027-01-30'), false);
});

test('age check message is in plain words and names the player', () => {
  const message = ageCheckMessage('Ali', '2008-03-02', '2027-01-30', 'U19');
  assert.match(message, /Ali was born on 2 March 2008/);
  assert.match(message, /18 on 30 January 2027/);
  assert.match(message, /U19/);

  const over = ageCheckMessage('Ali', '2007-03-02', '2027-01-30', 'U19');
  assert.match(over, /19 on 30 January 2027/);
  assert.match(over, /over the limit/);
});

/* ------------------------------------------------------------------ *
 * Fees
 * ------------------------------------------------------------------ */

test('Cricket + Chess + Badminton (Doubles) totals', () => {
  const entries = [{ gameId: 'G01' }, { gameId: 'G15' }, { gameId: 'G10' }];
  const early = calculateTotals(entries, games, true);
  assert.equal(early.netTotal, 8700);
  assert.equal(early.subtotalRegular, 10200);
  assert.equal(early.savings, 1500);
  assert.equal(early.feeType, 'EARLY_BIRD');

  const regular = calculateTotals(entries, games, false);
  assert.equal(regular.netTotal, 10200);
  assert.equal(regular.savings, 0);
  assert.equal(regular.feeType, 'REGULAR');
});

test('Chess has equal fees, so there is no strikethrough', () => {
  const totals = calculateTotals([{ gameId: 'G15' }], games, true);
  assert.equal(totals.lines[0].fee, 700);
  assert.equal(totals.lines[0].regularFee, 700);
  assert.equal(totals.savings, 0);
});

test('PKR formatting and IBAN grouping', () => {
  assert.equal(formatPKR(6000), 'Rs 6,000');
  assert.equal(formatPKR(13500), 'Rs 13,500');
  assert.equal(groupIban('PK08ALFH0053001010451307'), 'PK08 ALFH 0053 0010 1045 1307');
});

/* ------------------------------------------------------------------ *
 * ID numbers and phone numbers
 * ------------------------------------------------------------------ */

test('13-digit CNIC/B-Form numbers are valid with or without dashes', () => {
  assert.equal(isValidIdNumber('3520212345671'), true);
  assert.equal(isValidIdNumber('35202-1234567-1'), true);
  assert.equal(isValidIdNumber('352021234567'), false);
  assert.equal(formatIdNumber('3520212345671'), '35202-1234567-1');
  assert.equal(normalizeIdNumber('35202-1234567-1'), '3520212345671');
});

test('WhatsApp numbers normalize to 03XXXXXXXXX', () => {
  assert.equal(normalizeWhatsapp('+923001234567'), '03001234567');
  assert.equal(normalizeWhatsapp('0300-1234567'), '03001234567');
  assert.equal(normalizeWhatsapp('0300 123 4567'), '03001234567');
  assert.equal(normalizeWhatsapp('923001234567'), '03001234567');
  assert.equal(normalizeWhatsapp('0300123456'), '');
  assert.equal(whatsappInternational('03001234567'), '923001234567');
  assert.equal(whatsappLink('0300-1234567'), 'https://wa.me/923001234567');
});

/* ------------------------------------------------------------------ *
 * Sheet safety and rosters
 * ------------------------------------------------------------------ */

test('formula injection is stored as text', () => {
  assert.equal(sanitizeCell('=HYPERLINK("https://evil.example","click")'), '\'=HYPERLINK("https://evil.example","click")');
  assert.equal(sanitizeCell('+923001234567'), "'+923001234567");
  assert.equal(sanitizeCell('-5'), "'-5");
  assert.equal(sanitizeCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(sanitizeCell('Ali Khan'), 'Ali Khan');
  assert.equal(sanitizeCell(6000), 6000);
});

test('team roles and roster text', () => {
  assert.equal(playerRoleForIndex('Team', 0, 7), 'Captain');
  assert.equal(playerRoleForIndex('Team', 6, 7), 'Player');
  assert.equal(playerRoleForIndex('Team', 7, 7), 'Extra');
  assert.equal(playerRoleForIndex('Single', 0, 1), 'Player');
  assert.equal(
    buildRoster([{ name: 'Ali', dob: '2009-04-12' }, { name: 'Sara', dob: '2010-01-01' }]),
    '1. Ali (2009-04-12)\n2. Sara (2010-01-01)'
  );
});

test('format labels read naturally on cards', () => {
  assert.equal(formatLabel(game('G01')), 'Team of 7 to 9');
  assert.equal(formatLabel(game('G02')), 'Team of 5 to 7');
  assert.equal(formatLabel(game('G04')), 'Singles');
  assert.equal(formatLabel(game('G05')), 'Doubles');
  assert.equal(formatLabel(game('G08')), 'Individual');
});

/* ------------------------------------------------------------------ *
 * Submission validation
 * ------------------------------------------------------------------ */

test('a complete U19 team entry passes validation', () => {
  const result = validateSubmission(payload([cricketEntry()]), options);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.totals.netTotal, 6000);
  assert.equal(result.contact.whatsapp, '03001234567');
  assert.equal(result.entries[0].players.length, 7);
  assert.equal(result.entries[0].players[0].role, 'Captain');
  assert.equal(result.entries[0].players[6].role, 'Player');
});

test('an over-age player blocks the entry and the message names them', () => {
  const players = Array.from({ length: 7 }, (_, i) => player(i + 1));
  players[3] = player(4, { name: 'Bilal Ahmed', dob: '2008-01-30' });
  const result = validateSubmission(payload([cricketEntry({ players })]), options);
  assert.equal(result.ok, false);
  const error = result.errors.find((e) => e.path === 'entries[0].players[3].dob');
  assert.ok(error);
  assert.match(error.message, /Bilal Ahmed/);
  assert.match(error.message, /U19/);
});

test('U19 and U17 need an ID number and an ID file for every player', () => {
  const players = Array.from({ length: 7 }, (_, i) => player(i + 1));
  players[2] = player(3, { idNumber: '123', idFileId: '' });
  const result = validateSubmission(payload([cricketEntry({ players })]), options);
  assert.equal(result.ok, false);
  assert.ok(result.fields['entries[0].players[2].idNumber']);
  assert.ok(result.fields['entries[0].players[2].idFile']);
});

test('U15 entries do not ask for ID', () => {
  const result = validateSubmission(payload([{
    gameId: 'G18',
    ageGroup: 'U15',
    division: 'Boys',
    players: [{ personKey: 'p1', name: 'Sara Ali', dob: '2013-02-01' }]
  }]), options);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test('the same ID number twice in one entry is rejected', () => {
  const result = validateSubmission(payload([{
    gameId: 'G10',
    ageGroup: 'U19',
    division: 'Girls',
    players: [
      player(1, { name: 'Sara One', idNumber: '3520212345671' }),
      player(2, { name: 'Sara Two', idNumber: '35202-1234567-1' })
    ]
  }]), options);
  assert.equal(result.ok, false);
  assert.match(result.fields['entries[0].players[1].idNumber'], /already used/);
});

test('player counts must fit the game', () => {
  const result = validateSubmission(payload([cricketEntry({ players: Array.from({ length: 6 }, (_, i) => player(i + 1)) })]), options);
  assert.equal(result.ok, false);
  assert.match(result.fields['entries[0].players'], /at least 7/);

  const tooMany = validateSubmission(payload([cricketEntry({ players: Array.from({ length: 10 }, (_, i) => player(i + 1)) })]), options);
  assert.equal(tooMany.ok, false);
  assert.match(tooMany.fields['entries[0].players'], /at most 9/);
});

test('team games need a team name and a division when there is a choice', () => {
  const noTeam = validateSubmission(payload([cricketEntry({ teamName: '' })]), options);
  assert.equal(noTeam.ok, false);
  assert.ok(noTeam.fields['entries[0].teamName']);

  const noDivision = validateSubmission(payload([cricketEntry({ division: '' })]), options);
  assert.equal(noDivision.ok, false);
  assert.ok(noDivision.fields['entries[0].division']);

  const futsalWrongDivision = validateSubmission(payload([{
    gameId: 'G02',
    ageGroup: 'U19',
    division: 'Girls',
    teamName: 'Falcons',
    players: Array.from({ length: 5 }, (_, i) => player(i + 1))
  }]), options);
  assert.equal(futsalWrongDivision.ok, true, JSON.stringify(futsalWrongDivision.errors));
  assert.equal(futsalWrongDivision.entries[0].division, 'Boys');
});

test('age group must be one the game offers', () => {
  const result = validateSubmission(payload([cricketEntry({ ageGroup: 'Open' })]), options);
  assert.equal(result.ok, false);
  assert.ok(result.fields['entries[0].ageGroup']);

  const futsalU17 = validateSubmission(payload([{
    gameId: 'G02',
    ageGroup: 'U17',
    division: 'Boys',
    teamName: 'Falcons',
    players: Array.from({ length: 5 }, (_, i) => player(i + 1, { dob: '2011-01-01' }))
  }]), options);
  assert.equal(futsalU17.ok, false);
  assert.ok(futsalU17.fields['entries[0].ageGroup']);
});

test('contact details are validated', () => {
  const result = validateSubmission(payload([cricketEntry()], {
    contact: { name: '', role: 'Coach', whatsapp: '123', email: 'nope', institution: '' }
  }), options);
  assert.equal(result.ok, false);
  assert.ok(result.fields['contact.name']);
  assert.ok(result.fields['contact.role']);
  assert.ok(result.fields['contact.whatsapp']);
  assert.ok(result.fields['contact.email']);
  assert.ok(result.fields['contact.institution']);
});

test('payment proof and consent are required', () => {
  const noProof = validateSubmission(payload([cricketEntry()], {
    payment: { proofFileId: '', transactionId: '' }
  }), options);
  assert.equal(noProof.ok, false);
  assert.ok(noProof.fields['payment.proofFile']);

  const noConsent = validateSubmission(payload([cricketEntry()], { consent: false }), options);
  assert.equal(noConsent.ok, false);
  assert.ok(noConsent.fields.consent);
});

test('inactive games cannot be submitted', () => {
  const result = validateSubmission(payload([{
    gameId: 'G35',
    ageGroup: 'Open',
    division: 'Boys',
    players: [{ personKey: 'p1', name: 'Sara Ali', dob: '2010-01-01' }]
  }]), options);
  assert.equal(result.ok, false);
  assert.match(result.fields['entries[0].gameId'], /not open/);
});

test('Open entries accept an adult date of birth without ID', () => {
  const result = validateSubmission(payload([{
    gameId: 'G34',
    ageGroup: 'Open',
    division: 'Girls',
    players: [{ personKey: 'p1', name: 'Hina Ali', dob: '1995-06-01' }]
  }]), options);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});
