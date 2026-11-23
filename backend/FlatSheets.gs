/*
 * TLH Sports Fest 3.0 - flat registration sheets.
 *
 * Registrations are stored in two easy-to-read tabs:
 *   Team Games - one row per team entry (up to 9 players)
 *   Solo Games - one row per individual/double entry (up to 2 players)
 *
 * Every row contains the contact, game, players, fee and payment status, so
 * nobody has to join Submissions, Entries and Players to review a record.
 */

var TLH_FLAT_COL = {
  registrationId: 0,
  entryId: 1,
  timestamp: 2,
  contactName: 3,
  contactRole: 4,
  whatsapp: 5,
  email: 6,
  institution: 7,
  gameId: 8,
  game: 9,
  category: 10,
  format: 11,
  ageGroup: 12,
  division: 13,
  teamName: 14,
  playerCount: 15,
  fee: 16,
  regularFee: 17,
  feeType: 18,
  paymentStatus: 19,
  transactionId: 20,
  paymentProof: 21,
  verifiedAt: 22,
  ageCheck: 23,
  flags: 24,
  note: 25,
  adminNotes: 26,
  registrationFolder: 27,
  idFolder: 28,
  emailStatus: 29,
  token: 30,
  playerStart: 31
};

var TLH_FLAT_BASE_HEADERS = [
  'RegistrationID', 'EntryID', 'Timestamp (PKT)', 'ContactName', 'ContactRole',
  'WhatsApp', 'Email', 'Institution', 'GameID', 'Game', 'Category', 'Format',
  'AgeGroup', 'Division', 'TeamName', 'PlayerCount', 'FeeCharged', 'RegularFee',
  'FeeType', 'PaymentStatus', 'TransactionID', 'PaymentProof', 'VerifiedAt',
  'AgeCheck', 'Flags', 'NoteToRegistrant', 'AdminNotes', 'RegistrationFolder',
  'IDDocumentsFolder', 'EmailStatus', 'Token'
];

var TLH_FLAT_BASE_WIDTHS = [
  125, 140, 155, 170, 100, 130, 220, 200, 80, 210, 125, 85, 80, 80, 170, 85,
  100, 100, 100, 120, 145, 165, 155, 90, 300, 230, 250, 180, 180, 115, 300
];

function flatSheetDefs_() {
  return [
    { key: 'team', name: 'Team Games', maxPlayers: 9, tabColor: '#C83806' },
    { key: 'solo', name: 'Solo Games', maxPlayers: 2, tabColor: '#F8AA14' }
  ];
}

function flatDefByName_(name) {
  var defs = flatSheetDefs_();
  for (var i = 0; i < defs.length; i++) {
    if (defs[i].name === name) return defs[i];
  }
  return null;
}

function flatDefForKey_(key) {
  var defs = flatSheetDefs_();
  for (var i = 0; i < defs.length; i++) {
    if (defs[i].key === key) return defs[i];
  }
  return null;
}

function flatDefForFormat_(format) {
  return String(format || '') === 'Team' ? flatDefForKey_('team') : flatDefForKey_('solo');
}

function flatDefForGame_(game) {
  return flatDefForFormat_(game && game.format);
}

function isFlatSheetName_(name) {
  return name === 'Team Games' || name === 'Solo Games';
}

function flatHeadersForDef_(def) {
  var headers = TLH_FLAT_BASE_HEADERS.slice();
  for (var i = 1; i <= def.maxPlayers; i++) {
    headers.push('Player' + i + 'Name');
    headers.push('Player' + i + 'DOB');
    headers.push('Player' + i + 'CNIC');
    headers.push('Player' + i + 'Age');
  }
  return headers;
}

function flatWidthsForDef_(def) {
  var widths = TLH_FLAT_BASE_WIDTHS.slice();
  for (var i = 0; i < def.maxPlayers; i++) {
    widths.push(170, 105, 165, 60);
  }
  return widths;
}

function flatRowWidth_(def) {
  return TLH_FLAT_COL.playerStart + (def.maxPlayers * 4);
}

/**
 * Build one flat row. Links are passed as ready-made values (usually
 * =HYPERLINK formulas) so they stay clickable in the Sheet.
 */
function buildFlatRow_(data) {
  var def = flatDefForFormat_(data.format);
  var row = [];
  for (var i = 0; i < flatRowWidth_(def); i++) row.push('');

  row[TLH_FLAT_COL.registrationId] = sanitizeCell(data.registrationId || '');
  row[TLH_FLAT_COL.entryId] = sanitizeCell(data.entryId || '');
  row[TLH_FLAT_COL.timestamp] = data.timestamp || '';
  row[TLH_FLAT_COL.contactName] = sanitizeCell(data.contact && data.contact.name || '');
  row[TLH_FLAT_COL.contactRole] = sanitizeCell(data.contact && data.contact.role || '');
  row[TLH_FLAT_COL.whatsapp] = sanitizeCell(data.contact && data.contact.whatsapp || '');
  row[TLH_FLAT_COL.email] = sanitizeCell(data.contact && data.contact.email || '');
  row[TLH_FLAT_COL.institution] = sanitizeCell(data.contact && data.contact.institution || '');
  row[TLH_FLAT_COL.gameId] = sanitizeCell(data.gameId || '');
  row[TLH_FLAT_COL.game] = sanitizeCell(data.game || '');
  row[TLH_FLAT_COL.category] = sanitizeCell(data.category || '');
  row[TLH_FLAT_COL.format] = sanitizeCell(data.format || '');
  row[TLH_FLAT_COL.ageGroup] = sanitizeCell(data.ageGroup || '');
  row[TLH_FLAT_COL.division] = sanitizeCell(data.division || '');
  row[TLH_FLAT_COL.teamName] = sanitizeCell(data.teamName || '');
  row[TLH_FLAT_COL.playerCount] = Number(data.players ? data.players.length : (data.playerCount || 0));
  row[TLH_FLAT_COL.fee] = Number(data.fee || 0);
  row[TLH_FLAT_COL.regularFee] = Number(data.regularFee || data.fee || 0);
  row[TLH_FLAT_COL.feeType] = sanitizeCell(data.feeType || '');
  row[TLH_FLAT_COL.paymentStatus] = sanitizeCell(data.paymentStatus || 'Pending');
  row[TLH_FLAT_COL.transactionId] = sanitizeCell(data.transactionId || '');
  row[TLH_FLAT_COL.paymentProof] = data.paymentProof || '';
  row[TLH_FLAT_COL.verifiedAt] = data.verifiedAt || '';
  row[TLH_FLAT_COL.ageCheck] = sanitizeCell(data.ageCheck || 'OK');
  row[TLH_FLAT_COL.flags] = sanitizeCell(data.flags || '');
  row[TLH_FLAT_COL.note] = sanitizeCell(data.note || '');
  row[TLH_FLAT_COL.adminNotes] = sanitizeCell(data.adminNotes || '');
  row[TLH_FLAT_COL.registrationFolder] = data.registrationFolder || '';
  row[TLH_FLAT_COL.idFolder] = data.idFolder || '';
  row[TLH_FLAT_COL.emailStatus] = sanitizeCell(data.emailStatus || 'PENDING');
  row[TLH_FLAT_COL.token] = sanitizeCell(data.token || '');

  var players = Array.isArray(data.players) ? data.players : [];
  for (var p = 0; p < def.maxPlayers; p++) {
    var player = players[p] || {};
    var offset = TLH_FLAT_COL.playerStart + (p * 4);
    row[offset] = sanitizeCell(player.name || '');
    row[offset + 1] = parseDateOnly(player.dob || '');
    row[offset + 2] = sanitizeCell(player.idNumber || '');
    row[offset + 3] = player.age === null || player.age === undefined
      ? (data.ageCutoffDate ? ageOnCutoff(player.dob, data.ageCutoffDate) : '')
      : player.age;
    if (row[offset + 3] === null) row[offset + 3] = '';
  }

  return { def: def, row: row };
}

/** Append a list of {def, row} objects, grouped by tab. */
function appendFlatRows_(items) {
  var groups = {};
  (items || []).forEach(function (item) {
    if (!item || !item.def || !item.row) return;
    if (!groups[item.def.name]) groups[item.def.name] = [];
    groups[item.def.name].push(item.row);
  });
  Object.keys(groups).forEach(function (name) {
    var sheet = getSheet_(name);
    appendRows_(sheet, groups[name]);
  });
}

function readFlatSheetRows_(def, columns) {
  var sheet = getSpreadsheet_().getSheetByName(def.name);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var width = columns || flatRowWidth_(def);
  var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    if (!String(values[i][TLH_FLAT_COL.registrationId] || '').trim()) continue;
    rows.push({
      def: def,
      sheet: sheet,
      rowNumber: i + 2,
      values: values[i]
    });
  }
  return rows;
}

function flatRowToObject_(item) {
  var values = item.values;
  var def = item.def;
  var players = [];
  for (var i = 0; i < def.maxPlayers; i++) {
    var offset = TLH_FLAT_COL.playerStart + (i * 4);
    var name = String(values[offset] || '').trim();
    if (!name) continue;
    players.push({
      name: name,
      dob: parseDateOnly(values[offset + 1]),
      idNumber: String(values[offset + 2] || '').trim(),
      age: values[offset + 3] === '' ? null : Number(values[offset + 3])
    });
  }
  return {
    registrationId: String(values[TLH_FLAT_COL.registrationId] || '').trim(),
    entryId: String(values[TLH_FLAT_COL.entryId] || '').trim(),
    timestamp: values[TLH_FLAT_COL.timestamp],
    contact: {
      name: String(values[TLH_FLAT_COL.contactName] || '').trim(),
      role: String(values[TLH_FLAT_COL.contactRole] || '').trim(),
      whatsapp: String(values[TLH_FLAT_COL.whatsapp] || '').trim(),
      email: String(values[TLH_FLAT_COL.email] || '').trim(),
      institution: String(values[TLH_FLAT_COL.institution] || '').trim()
    },
    gameId: String(values[TLH_FLAT_COL.gameId] || '').trim(),
    game: String(values[TLH_FLAT_COL.game] || '').trim(),
    category: String(values[TLH_FLAT_COL.category] || '').trim(),
    format: String(values[TLH_FLAT_COL.format] || '').trim(),
    ageGroup: String(values[TLH_FLAT_COL.ageGroup] || '').trim(),
    division: String(values[TLH_FLAT_COL.division] || '').trim(),
    teamName: String(values[TLH_FLAT_COL.teamName] || '').trim(),
    playerCount: Number(values[TLH_FLAT_COL.playerCount]) || players.length,
    fee: Number(values[TLH_FLAT_COL.fee]) || 0,
    regularFee: Number(values[TLH_FLAT_COL.regularFee]) || 0,
    feeType: String(values[TLH_FLAT_COL.feeType] || '').trim(),
    paymentStatus: String(values[TLH_FLAT_COL.paymentStatus] || '').trim(),
    transactionId: String(values[TLH_FLAT_COL.transactionId] || '').trim(),
    paymentProof: values[TLH_FLAT_COL.paymentProof],
    verifiedAt: values[TLH_FLAT_COL.verifiedAt],
    ageCheck: String(values[TLH_FLAT_COL.ageCheck] || '').trim(),
    flags: String(values[TLH_FLAT_COL.flags] || '').trim(),
    note: String(values[TLH_FLAT_COL.note] || '').trim(),
    adminNotes: String(values[TLH_FLAT_COL.adminNotes] || '').trim(),
    registrationFolder: values[TLH_FLAT_COL.registrationFolder],
    idFolder: values[TLH_FLAT_COL.idFolder],
    emailStatus: String(values[TLH_FLAT_COL.emailStatus] || '').trim(),
    token: String(values[TLH_FLAT_COL.token] || '').trim(),
    players: players,
    sheet: item.sheet,
    rowNumber: item.rowNumber
  };
}

function allFlatRows_() {
  var rows = [];
  flatSheetDefs_().forEach(function (def) {
    readFlatSheetRows_(def).forEach(function (item) {
      rows.push(flatRowToObject_(item));
    });
  });
  return rows;
}

function findFlatRowsByRegistrationId_(registrationId) {
  var wanted = String(registrationId || '').trim();
  if (!wanted) return [];
  return allFlatRows_().filter(function (row) {
    return row.registrationId === wanted;
  });
}

function findFlatRowsByToken_(token) {
  var wanted = String(token || '').trim();
  if (!wanted) return [];
  return allFlatRows_().filter(function (row) {
    return row.token === wanted;
  });
}

function submissionSuccessFromFlatRows_(rows) {
  var list = rows || [];
  if (!list.length) return null;
  var first = list[0];
  var entries = [];
  var seen = {};
  list.forEach(function (row) {
    if (seen[row.entryId]) return;
    seen[row.entryId] = true;
    entries.push({
      entryId: row.entryId,
      game: row.game,
      fee: row.fee
    });
  });
  var total = list.reduce(function (sum, row) { return sum + row.fee; }, 0);
  return {
    ok: true,
    submissionId: first.registrationId,
    feeType: first.feeType === 'Early Bird' ? 'EARLY_BIRD' : 'REGULAR',
    total: total,
    entries: entries,
    emailStatus: first.emailStatus || 'PENDING'
  };
}

function uniqueFlatPlayerCount_(rows) {
  var seen = {};
  var count = 0;
  (rows || []).forEach(function (row) {
    (row.players || []).forEach(function (player, index) {
      var key = row.entryId + '|' + index;
      if (seen[key]) return;
      seen[key] = true;
      count++;
    });
  });
  return count;
}

/**
 * Duplicate flags. Never blocks a registration. Reads the flat player columns
 * and compares name + DOB and ID number within the same game.
 */
function computeDuplicateFlags_(entries, entryIds) {
  var existing = {};
  flatSheetDefs_().forEach(function (def) {
    var sheet = getSpreadsheet_().getSheetByName(def.name);
    if (!sheet || sheet.getLastRow() < 2) return;
    var last = sheet.getLastRow();
    var ids = sheet.getRange(2, TLH_FLAT_COL.entryId + 1, last - 1, 1).getValues();
    var games = sheet.getRange(2, TLH_FLAT_COL.gameId + 1, last - 1, 1).getValues();
    var players = sheet.getRange(2, TLH_FLAT_COL.playerStart + 1, last - 1, def.maxPlayers * 4).getValues();
    for (var i = 0; i < players.length; i++) {
      var gameId = String(games[i][0] || '').trim();
      if (!gameId) continue;
      if (!existing[gameId]) existing[gameId] = [];
      for (var p = 0; p < def.maxPlayers; p++) {
        var offset = p * 4;
        var name = String(players[i][offset] || '').trim();
        if (!name) continue;
        existing[gameId].push({
          entryId: String(ids[i][0] || '').trim(),
          nameKey: nameKey_(name),
          dob: parseDateOnly(players[i][offset + 1]),
          id: normalizeIdNumber(players[i][offset + 2])
        });
      }
    }
  });

  var flags = {};
  var addedThisSubmission = {};

  entries.forEach(function (entry, index) {
    var entryId = entryIds[index];
    var list = [];
    var seen = {};

    function addFlag(text) {
      if (seen[text]) return;
      seen[text] = true;
      list.push(text);
    }

    entry.players.forEach(function (player) {
      var playerId = normalizeIdNumber(player.idNumber);
      var playerName = nameKey_(player.name);
      var playerDob = parseDateOnly(player.dob);
      var pool = (existing[entry.gameId] || []).concat(addedThisSubmission[entry.gameId] || []);
      pool.forEach(function (other) {
        if (playerId && other.id && playerId === other.id) {
          addFlag('Possible duplicate ID number (also in ' + other.entryId + ')');
        }
        if (playerName && playerDob && playerName === other.nameKey && playerDob === other.dob) {
          addFlag('Possible duplicate name and date of birth (also in ' + other.entryId + ')');
        }
      });
    });

    if (!addedThisSubmission[entry.gameId]) addedThisSubmission[entry.gameId] = [];
    entry.players.forEach(function (player) {
      addedThisSubmission[entry.gameId].push({
        entryId: entryId,
        nameKey: nameKey_(player.name),
        dob: parseDateOnly(player.dob),
        id: normalizeIdNumber(player.idNumber)
      });
    });

    flags[entryId] = list.slice(0, 5).join('; ');
  });

  return flags;
}

/* ------------------------------------------------------------------ *
 * Payment status and age check helpers
 * ------------------------------------------------------------------ */

function guardPaymentStatusUpdate_(registrationId) {
  try {
    CacheService.getScriptCache().put('tlh_pay_guard_' + registrationId, '1', 20);
  } catch (error) {
    // A guard is a nicety, not a requirement.
  }
}

function paymentStatusUpdateGuarded_(registrationId) {
  try {
    return CacheService.getScriptCache().get('tlh_pay_guard_' + registrationId) === '1';
  } catch (error) {
    return false;
  }
}

/**
 * Writes a payment status to every row in a registration (all games in the
 * same submission) and optionally emails the registrant.
 */
function applyPaymentStatusToRegistration_(registrationId, status, note, options) {
  var opts = options || {};
  var wanted = String(status || '').trim();
  if (['Pending', 'Verified', 'Rejected'].indexOf(wanted) === -1) {
    return { ok: false, message: 'Choose Pending, Verified or Rejected.' };
  }
  guardPaymentStatusUpdate_(registrationId);
  var rows = findFlatRowsByRegistrationId_(registrationId);
  if (!rows.length) return { ok: false, message: 'No rows found for ' + registrationId + '.' };

  var verifiedAt = wanted === 'Verified' ? new Date() : '';
  flatSheetDefs_().forEach(function (def) {
    var sheet = getSpreadsheet_().getSheetByName(def.name);
    if (!sheet || sheet.getLastRow() < 2) return;
    var last = sheet.getLastRow();
    var ids = sheet.getRange(2, TLH_FLAT_COL.registrationId + 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || '').trim() !== registrationId) continue;
      sheet.getRange(i + 2, TLH_FLAT_COL.paymentStatus + 1).setValue(wanted);
      sheet.getRange(i + 2, TLH_FLAT_COL.verifiedAt + 1).setValue(verifiedAt);
      if (note !== undefined && note !== null && String(note).trim() !== '') {
        sheet.getRange(i + 2, TLH_FLAT_COL.note + 1).setValue(sanitizeCell(String(note)));
      }
    }
  });
  SpreadsheetApp.flush();
  clearConfigCache_();

  var emailSent = false;
  if (opts.sendEmail !== false && (wanted === 'Verified' || wanted === 'Rejected')) {
    try {
      var map = readConfigMap_();
      if (configBool_(map, 'SendStatusEmails', true)) {
        var data = buildEmailDataFromSheet_(registrationId);
        if (data) {
          var resolvedNote = note;
          if (resolvedNote === undefined || resolvedNote === null || String(resolvedNote).trim() === '') {
            resolvedNote = data.note || '';
          }
          sendStatusEmail_(data, wanted, resolvedNote);
          emailSent = true;
        }
      }
    } catch (error) {
      logEvent_('ERROR', 'paymentEmail', 'Status email failed for ' + registrationId, String(error.message || error));
    }
  }

  logEvent_('INFO', 'paymentStatus', registrationId + ' marked ' + wanted + (emailSent ? ' (email sent)' : ''), { rows: rows.length });
  return { ok: true, rows: rows.length, emailSent: emailSent };
}

function applyAgeCheckToRows_(sheet, rowNumbers, value) {
  var wanted = String(value || '').trim();
  if (['OK', 'Review'].indexOf(wanted) === -1) {
    return { ok: false, message: 'Choose OK or Review.' };
  }
  var changed = 0;
  (rowNumbers || []).forEach(function (rowNumber) {
    if (rowNumber < 2) return;
    sheet.getRange(rowNumber, TLH_FLAT_COL.ageCheck + 1).setValue(wanted);
    changed++;
  });
  SpreadsheetApp.flush();
  clearConfigCache_();
  logEvent_('INFO', 'ageCheck', 'Set ' + changed + ' row(s) to ' + wanted + '.', sheet.getName());
  return { ok: true, changed: changed };
}
