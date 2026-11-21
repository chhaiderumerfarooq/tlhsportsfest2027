/*
 * TLH Sports Fest 3.0 - shared Apps Script helpers.
 *
 * All private helpers end with an underscore. Public entry points are the
 * functions named in SETUP.md and the menu.
 */

var TLH_CONFIG_CACHE_KEY = 'tlh_public_config_v1';
var TLH_CONFIG_CACHE_SECONDS = 60;
var TLH_SPREADSHEET_ID_PROPERTY = 'TLH_SPREADSHEET_ID';
var TLH_COUNTER_PROPERTY = 'TLH_SUBMISSION_COUNTER';

var TLH_ROOT_FOLDERS = {
  payment: 'TLH SF3 Payment Proofs',
  id: 'TLH SF3 ID Documents'
};

var TLH_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/* ------------------------------------------------------------------ *
 * Spreadsheet access
 * ------------------------------------------------------------------ */

/**
 * Works in a bound script and in the web app. If getActiveSpreadsheet() is
 * unavailable, setupWorkbook() stores the Sheet ID in Script Properties.
 */
function getSpreadsheet_() {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (error) {
    ss = null;
  }
  if (ss) return ss;

  var id = PropertiesService.getScriptProperties().getProperty(TLH_SPREADSHEET_ID_PROPERTY);
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('Cannot find the Google Sheet. Run setupWorkbook() once from the Apps Script editor.');
}

function getSheet_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) {
    throw new Error('Missing tab "' + name + '". Run TLH Sports Fest > Set up or repair workbook.');
  }
  return sheet;
}

/* ------------------------------------------------------------------ *
 * Logs and errors
 * ------------------------------------------------------------------ */

function truncate_(value, limit) {
  var text = String(value === null || value === undefined ? '' : value);
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1) + '…';
}

function logEvent_(level, action, message, details) {
  try {
    var sheet = getSpreadsheet_().getSheetByName('Logs');
    if (!sheet) return;
    var detailText = '';
    if (details !== undefined && details !== null && details !== '') {
      detailText = typeof details === 'string' ? details : JSON.stringify(details);
    }
    sheet.appendRow([
      new Date(),
      String(level || 'INFO').toUpperCase(),
      truncate_(action, 120),
      truncate_(message, 500),
      truncate_(detailText, 900)
    ]);
  } catch (error) {
    // Logging must never break the API.
  }
}

function tlhError_(code, message, fields, extra) {
  var error = new Error(message);
  error.tlh = {
    code: code,
    message: message,
    fields: fields || {},
    extra: extra || {}
  };
  return error;
}

function errorPayload_(code, message, fields, extra) {
  var payload = {
    ok: false,
    code: code,
    message: message,
    fields: fields || {}
  };
  if (extra) {
    Object.keys(extra).forEach(function (key) {
      payload[key] = extra[key];
    });
  }
  return payload;
}

function jsonOut_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseJsonBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw tlhError_('VALIDATION_FAILED', 'The request was empty.');
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw tlhError_('VALIDATION_FAILED', 'The request was not valid JSON.');
  }
}

/* ------------------------------------------------------------------ *
 * Config and games readers (never cached here; the public API caches)
 * ------------------------------------------------------------------ */

function readConfigMap_() {
  var sheet = getSheet_('Config');
  var lastRow = sheet.getLastRow();
  var map = {};
  if (lastRow < 2) return map;
  var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    var key = String(values[i][0] === null || values[i][0] === undefined ? '' : values[i][0]).trim();
    if (!key) continue;
    map[key] = values[i][1];
  }
  return map;
}

function configText_(map, key, fallback) {
  var value = map ? map[key] : '';
  if (value === null || value === undefined || String(value).trim() === '') {
    return fallback === undefined ? '' : fallback;
  }
  return String(value).trim();
}

function configNumber_(map, key, fallback) {
  var value = map ? map[key] : '';
  var number = Number(String(value === null || value === undefined ? '' : value).replace(/,/g, '').trim());
  return isFinite(number) && number > 0 ? number : fallback;
}

function configBool_(map, key, fallback) {
  return parseBool_(map ? map[key] : undefined, fallback);
}

function splitList_(value) {
  var text = String(value === null || value === undefined ? '' : value).trim();
  if (!text) return [];
  return text.split(',').map(function (part) {
    return String(part).trim();
  }).filter(function (part) {
    return part !== '';
  });
}

function getGames_() {
  var sheet = getSheet_('Games');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, 19).getValues();
  var games = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var id = String(row[0] === null || row[0] === undefined ? '' : row[0]).trim();
    if (!id) continue;
    var format = String(row[5] || '').trim() || 'Individual';
    var divisions = splitList_(row[6]);
    if (!divisions.length) divisions = ['Open'];
    var ageGroups = splitList_(row[7]);
    if (!ageGroups.length) ageGroups = ['Open'];
    var minPlayers = Number(row[10]);
    if (!isFinite(minPlayers) || minPlayers < 1) minPlayers = 1;
    var maxPlayers = Number(row[11]);
    if (!isFinite(maxPlayers) || maxPlayers < minPlayers) maxPlayers = minPlayers;
    var maxEntriesValue = row[12];
    var maxEntries = null;
    if (maxEntriesValue !== '' && maxEntriesValue !== null && maxEntriesValue !== undefined) {
      var parsedMax = Number(maxEntriesValue);
      if (isFinite(parsedMax) && parsedMax > 0) maxEntries = Math.floor(parsedMax);
    }
    games.push({
      id: id,
      active: parseBool_(row[1], false),
      sortOrder: isFinite(Number(row[2])) ? Number(row[2]) : i + 1,
      name: String(row[3] === null || row[3] === undefined ? '' : row[3]).trim(),
      category: String(row[4] || '').trim() || 'Other',
      format: format,
      divisions: divisions,
      ageGroups: ageGroups,
      earlyFee: Number(row[8]) || 0,
      regularFee: Number(row[9]) || 0,
      minPlayers: minPlayers,
      maxPlayers: maxPlayers,
      maxEntries: maxEntries,
      details: String(row[13] === null || row[13] === undefined ? '' : row[13]).trim(),
      prizes: String(row[14] === null || row[14] === undefined ? '' : row[14]).trim(),
      coach: String(row[15] || '').trim(),
      head: String(row[16] || '').trim(),
      coHead1: String(row[17] || '').trim(),
      coHead2: String(row[18] || '').trim()
    });
  }
  games.sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  return games;
}

function getEntryCounts_() {
  var sheet = getSheet_('Entries');
  var lastRow = sheet.getLastRow();
  var counts = {};
  if (lastRow < 2) return counts;
  var values = sheet.getRange(2, 4, lastRow - 1, 13).getValues();
  for (var i = 0; i < values.length; i++) {
    var gameId = String(values[i][0] || '').trim();
    if (!gameId) continue;
    var status = String(values[i][12] || '').trim();
    if (status === 'Rejected') continue;
    counts[gameId] = (counts[gameId] || 0) + 1;
  }
  return counts;
}

function getPublicGames_() {
  var counts = getEntryCounts_();
  return getGames_().filter(function (game) {
    return game.active;
  }).map(function (game) {
    return {
      id: game.id,
      name: game.name,
      category: game.category,
      format: game.format,
      divisions: game.divisions,
      ageGroups: game.ageGroups,
      earlyFee: game.earlyFee,
      regularFee: game.regularFee,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      details: game.details,
      prizes: game.prizes,
      sortOrder: game.sortOrder,
      full: game.maxEntries ? (counts[game.id] || 0) >= game.maxEntries : false
    };
  });
}

function getEffectiveNow_(map) {
  var config = map || readConfigMap_();
  var override = config.TestNowOverride;
  if (override !== null && override !== undefined && String(override).trim() !== '') {
    var parsed = parsePktDateTime(override);
    if (parsed) return { date: parsed, testMode: true, config: config };
  }
  return { date: new Date(), testMode: false, config: config };
}

/* ------------------------------------------------------------------ *
 * Cache
 * ------------------------------------------------------------------ */

function clearConfigCache_() {
  try {
    CacheService.getScriptCache().remove(TLH_CONFIG_CACHE_KEY);
  } catch (error) {
    // Cache failures are not fatal.
  }
}

function getPublicConfigJson_() {
  var cache = CacheService.getScriptCache();
  try {
    var cached = cache.get(TLH_CONFIG_CACHE_KEY);
    if (cached) return cached;
  } catch (error) {
    // Ignore cache read errors.
  }

  var json = JSON.stringify(buildPublicConfig_());
  try {
    cache.put(TLH_CONFIG_CACHE_KEY, json, TLH_CONFIG_CACHE_SECONDS);
  } catch (error) {
    // If the value is too large or the cache is down, serve it uncached.
  }
  return json;
}

function getContactList_(map) {
  function contact(nameKey, roleKey, phoneKey) {
    var phone = configText_(map, phoneKey, '');
    var international = whatsappInternational(phone);
    return {
      name: configText_(map, nameKey, ''),
      role: configText_(map, roleKey, 'Event Head'),
      phone: phone,
      tel: international ? 'tel:+' + international : '',
      whatsapp: international ? 'https://wa.me/' + international : ''
    };
  }
  return [
    contact('Contact1Name', 'Contact1Role', 'Contact1Phone'),
    contact('Contact2Name', 'Contact2Role', 'Contact2Phone')
  ].filter(function (item) { return item.name || item.phone; });
}

function buildPublicConfig_() {
  var map = readConfigMap_();
  var nowInfo = getEffectiveNow_(map);
  var now = nowInfo.date;
  var state = registrationState(now, map);

  return {
    ok: true,
    generatedAt: now.toISOString(),
    serverTime: now.toISOString(),
    serverTimePkt: formatPktDateTime(now),
    timezone: 'Asia/Karachi',
    event: {
      name: configText_(map, 'EventName', 'TLH Sports Fest 3.0'),
      dates: configText_(map, 'EventDates', 'Sat 30 and Sun 31 January 2027'),
      venue: configText_(map, 'Venue', 'TLH Canal Campus')
    },
    earlyBirdEndDate: parseDateOnly(map.EarlyBirdEndDate),
    registrationCloseDate: parseDateOnly(map.RegistrationCloseDate),
    ageCutoffDate: parseDateOnly(map.AgeCutoffDate),
    earlyBirdActive: state.earlyBirdActive,
    registrationOpen: state.registrationOpen,
    registrationStatus: state.status,
    daysLeftEarlyBird: state.daysLeftEarlyBird,
    daysLeftRegistration: state.daysLeftRegistration,
    bank: {
      bankName: configText_(map, 'BankName', 'Bank Alfalah'),
      accountTitle: configText_(map, 'AccountTitle', 'Genesis Educational Service Pvt Ltd.'),
      iban: configText_(map, 'IBAN', '')
    },
    contacts: getContactList_(map),
    socialsNotice: configText_(map, 'SocialsNotice', 'Socials tickets are sold separately. They are not included in your registration fee.'),
    announcementBanner: configText_(map, 'AnnouncementBanner', ''),
    consentText: configText_(map, 'ConsentText', ''),
    maxFileMB: configNumber_(map, 'MaxFileMB', 5),
    games: getPublicGames_()
  };
}

/* ------------------------------------------------------------------ *
 * Drive
 * ------------------------------------------------------------------ */

function getDriveRoot_(kind) {
  var name = TLH_ROOT_FOLDERS[kind];
  if (!name) throw new Error('Unknown file kind: ' + kind);
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function findSubfolder_(parent, name) {
  var folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : null;
}

function getPendingFolder_(kind, token, create) {
  var root = getDriveRoot_(kind);
  var pending = findSubfolder_(root, 'pending');
  if (!pending) {
    if (!create) return null;
    pending = root.createFolder('pending');
  }
  var tokenFolder = findSubfolder_(pending, token);
  if (!tokenFolder) {
    if (!create) return null;
    tokenFolder = pending.createFolder(token);
  }
  return tokenFolder;
}

function countFilesInFolder_(folder) {
  var files = folder.getFiles();
  var count = 0;
  while (files.hasNext()) {
    files.next();
    count++;
  }
  return count;
}

function findFileInPending_(kind, token, fileId) {
  var folder = getPendingFolder_(kind, token, false);
  if (!folder) return null;
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    if (file.getId() === fileId) return file;
  }
  return null;
}

function folderSafeName_(value) {
  var text = String(value === null || value === undefined ? '' : value)
    .replace(/[\\/:*?"<>|#%{}~&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) text = 'Registration';
  return text.slice(0, 80);
}

function extensionForMime_(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'bin';
}

function detectMimeFromBytes_(bytes) {
  if (!bytes || bytes.length < 4) return '';
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
      bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
    return 'image/png';
  }
  if (bytes.length >= 12 &&
      String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF' &&
      String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP') {
    return 'image/webp';
  }
  if (bytes.length >= 5 &&
      String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) === '%PDF-') {
    return 'application/pdf';
  }
  return '';
}

function normalizeMime_(value) {
  var mime = String(value || '').trim().toLowerCase();
  if (mime === 'image/jpg') return 'image/jpeg';
  if (mime === 'application/x-pdf') return 'application/pdf';
  return mime;
}

/* ------------------------------------------------------------------ *
 * Sheets helpers
 * ------------------------------------------------------------------ */

function ensureRows_(sheet, neededRows) {
  if (sheet.getMaxRows() < neededRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), neededRows - sheet.getMaxRows());
  }
}

function appendRows_(sheet, rows) {
  if (!rows || !rows.length) return;
  var start = sheet.getLastRow() + 1;
  ensureRows_(sheet, start + rows.length - 1);
  sheet.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
}

function padNumber_(value, width) {
  var text = String(value);
  while (text.length < width) text = '0' + text;
  return text;
}

function hashText_(value) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  );
  return digest.map(function (byte) {
    var value = byte < 0 ? byte + 256 : byte;
    var hex = value.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function isValidToken_(token) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(token || ''));
}

/* ------------------------------------------------------------------ *
 * Rate limits (CacheService, best effort)
 * ------------------------------------------------------------------ */

function rateLimitKey_(kind, value) {
  return 'tlh_rl_' + kind + '_' + hashText_(value).slice(0, 40);
}

function rateLimitCount_(kind, value) {
  if (!value) return 0;
  try {
    return Number(CacheService.getScriptCache().get(rateLimitKey_(kind, value)) || 0);
  } catch (error) {
    return 0;
  }
}

function rateLimitHit_(kind, value) {
  if (!value) return;
  try {
    var cache = CacheService.getScriptCache();
    var key = rateLimitKey_(kind, value);
    var next = Number(cache.get(key) || 0) + 1;
    cache.put(key, String(next), 3600);
  } catch (error) {
    // Rate limiting is best effort.
  }
}

/* ------------------------------------------------------------------ *
 * Submission lookups
 * ------------------------------------------------------------------ */

function findSubmissionRowByToken_(token) {
  var sheet = getSheet_('Submissions');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var values = sheet.getRange(2, 20, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '') === String(token)) return i + 2;
  }
  return 0;
}

function findSubmissionRowById_(submissionId) {
  var sheet = getSheet_('Submissions');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '') === String(submissionId)) return i + 2;
  }
  return 0;
}

function submissionSuccessFromRow_(rowNumber) {
  var sheet = getSheet_('Submissions');
  var row = sheet.getRange(rowNumber, 1, 1, 20).getValues()[0];
  var submissionId = String(row[0] || '');
  var entriesSheet = getSheet_('Entries');
  var lastRow = entriesSheet.getLastRow();
  var entries = [];
  if (lastRow >= 2) {
    var values = entriesSheet.getRange(2, 1, lastRow - 1, 14).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][1] || '') !== submissionId) continue;
      entries.push({
        entryId: String(values[i][0] || ''),
        game: String(values[i][4] || ''),
        fee: Number(values[i][12]) || 0
      });
    }
  }
  return {
    ok: true,
    submissionId: submissionId,
    feeType: String(row[8] || '') === 'Early Bird' ? 'EARLY_BIRD' : 'REGULAR',
    total: Number(row[10]) || 0,
    entries: entries,
    emailStatus: String(row[18] || 'PENDING')
  };
}

function cacheSubmissionResult_(token, payload) {
  try {
    CacheService.getScriptCache().put(
      'tlh_submit_' + hashText_(token).slice(0, 40),
      JSON.stringify(payload),
      21600
    );
  } catch (error) {
    // Not fatal.
  }
}

function getCachedSubmissionResult_(token) {
  try {
    var cached = CacheService.getScriptCache().get('tlh_submit_' + hashText_(token).slice(0, 40));
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    return null;
  }
}
