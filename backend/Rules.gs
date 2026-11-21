/*
 * AUTO-GENERATED FILE. Do not edit by hand.
 * Source: shared/rules.js
 * Regenerate with: npm run sync
 *
 * This copy has no ES module export block so Apps Script can load it as
 * plain global functions.
 */

/*
 * TLH Sports Fest 3.0 - shared pricing and eligibility rules.
 *
 * This file is the single source of truth. It must stay free of browser and
 * Apps Script APIs so that it can run in Node (tests), in the browser, and in
 * Google Apps Script.
 *
 * Do not edit assets/js/rules.js or backend/Rules.gs by hand.
 * Run: npm run sync
 */

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const AGE_GROUPS = ['U19', 'U17', 'U15', 'Open'];
const FORMATS = ['Team', 'Single', 'Double', 'Individual'];
const DIVISIONS = ['Boys', 'Girls', 'Open'];
const ROLES = ['Student', 'Parent', 'Teacher'];

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

function pad2_(value) {
  return String(value).length === 1 ? '0' + value : String(value);
}

function isDateObject_(value) {
  return Object.prototype.toString.call(value) === '[object Date]';
}

function cleanText_(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function parseBool_(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim().toLowerCase();
  if (['true', 'yes', 'y', '1', 'on'].indexOf(text) !== -1) return true;
  if (['false', 'no', 'n', '0', 'off'].indexOf(text) !== -1) return false;
  return fallback;
}

/* ------------------------------------------------------------------ *
 * Dates and Pakistan time (UTC+5, no daylight saving)
 * ------------------------------------------------------------------ */

function pktParts(date) {
  const shifted = new Date(date.getTime() + PKT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds()
  };
}

function formatPktDate(date) {
  const p = pktParts(date);
  return p.year + '-' + pad2_(p.month) + '-' + pad2_(p.day);
}

function formatPktDateTime(date) {
  const p = pktParts(date);
  return formatPktDate(date) + ' ' + pad2_(p.hour) + ':' + pad2_(p.minute) + ':' + pad2_(p.second);
}

/**
 * Accepts a real Date, a yyyy-mm-dd string (optionally with a time), or an
 * ISO timestamp. Returns a normalised yyyy-mm-dd string, or '' if invalid.
 */
function parseDateOnly(value) {
  if (value === null || value === undefined || value === '') return '';
  if (isDateObject_(value)) {
    if (isNaN(value.getTime())) return '';
    return formatPktDate(value);
  }
  const text = String(value).trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (!match) match = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return '';
  return year + '-' + pad2_(month) + '-' + pad2_(day);
}

/** End of a yyyy-mm-dd day in Pakistan time, as an absolute Date. */
function endOfDayPkt(value) {
  const date = parseDateOnly(value);
  if (!date) return null;
  const parts = date.split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999) - PKT_OFFSET_MS);
}

/** Start of a yyyy-mm-dd day in Pakistan time, as an absolute Date. */
function startOfDayPkt(value) {
  const date = parseDateOnly(value);
  if (!date) return null;
  const parts = date.split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0) - PKT_OFFSET_MS);
}

/**
 * Accepts a Date, yyyy-mm-dd, yyyy-mm-dd HH:mm[:ss] (Pakistan time) or an ISO
 * timestamp with an offset. Used for TestNowOverride.
 */
function parsePktDateTime(value) {
  if (value === null || value === undefined || value === '') return null;
  if (isDateObject_(value)) return isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    const date = parseDateOnly(match[1] + '-' + match[2] + '-' + match[3]);
    if (!date) return null;
    const hour = match[4] === undefined ? 0 : Number(match[4]);
    const minute = match[5] === undefined ? 0 : Number(match[5]);
    const second = match[6] === undefined ? 0 : Number(match[6]);
    if (hour > 23 || minute > 59 || second > 59) return null;
    const parts = date.split('-').map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], hour, minute, second) - PKT_OFFSET_MS);
  }
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** Same calendar date, minus whole years. Feb 29 becomes Feb 28. */
function subtractYears(dateValue, years) {
  const date = parseDateOnly(dateValue);
  if (!date) return '';
  const parts = date.split('-').map(Number);
  const year = parts[0] - years;
  const month = parts[1];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(parts[2], lastDay);
  return year + '-' + pad2_(month) + '-' + pad2_(day);
}

function formatDateLong(value) {
  const date = parseDateOnly(value);
  if (!date) return '';
  const parts = date.split('-').map(Number);
  return parts[2] + ' ' + MONTHS[parts[1] - 1] + ' ' + parts[0];
}

function formatDateTimeLong(value) {
  if (isDateObject_(value)) {
    const p = pktParts(value);
    return p.day + ' ' + MONTHS[p.month - 1] + ' ' + p.year + ', ' + pad2_(p.hour) + ':' + pad2_(p.minute) + ' PKT';
  }
  return formatDateLong(value);
}

function daysLeftPkt(now, endDate) {
  const end = endOfDayPkt(endDate);
  if (!end) return 0;
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_DAY);
}

function isEarlyBirdAt(now, earlyBirdEndDate) {
  const end = endOfDayPkt(earlyBirdEndDate);
  if (!end) return false;
  return now.getTime() <= end.getTime();
}

function isAfterClose(now, registrationCloseDate) {
  const end = endOfDayPkt(registrationCloseDate);
  if (!end) return true;
  return now.getTime() > end.getTime();
}

function registrationState(now, config) {
  const source = config || {};
  const openFlag = parseBool_(source.RegistrationOpen, true);
  const closeDate = source.RegistrationCloseDate;
  const earlyDate = source.EarlyBirdEndDate;
  let status = 'OPEN';
  if (!openFlag) status = 'NOT_OPEN';
  else if (isAfterClose(now, closeDate)) status = 'CLOSED';
  return {
    status: status,
    registrationOpen: status === 'OPEN',
    earlyBirdActive: isEarlyBirdAt(now, earlyDate),
    earlyBirdEndDate: parseDateOnly(earlyDate),
    registrationCloseDate: parseDateOnly(closeDate),
    daysLeftEarlyBird: daysLeftPkt(now, earlyDate),
    daysLeftRegistration: daysLeftPkt(now, closeDate)
  };
}

/* ------------------------------------------------------------------ *
 * Age groups
 * ------------------------------------------------------------------ */

function ageOnCutoff(dob, cutoffDate) {
  const birth = parseDateOnly(dob);
  const cutoff = parseDateOnly(cutoffDate);
  if (!birth || !cutoff) return null;
  const b = birth.split('-').map(Number);
  const c = cutoff.split('-').map(Number);
  let age = c[0] - b[0];
  if (c[1] < b[1] || (c[1] === b[1] && c[2] < b[2])) age -= 1;
  return age;
}

/**
 * U19 means the player has not turned 19 on the cutoff date. Their date of
 * birth must be after (cutoff minus 19 years). Open has no age limit.
 */
function isDobEligible(dob, ageGroup, cutoffDate) {
  const birth = parseDateOnly(dob);
  if (!birth) return false;
  if (ageGroup === 'Open') return true;
  const limitMatch = String(ageGroup || '').match(/^U(\d{2})$/);
  if (!limitMatch) return false;
  const cutoff = parseDateOnly(cutoffDate);
  if (!cutoff) return false;
  const youngestAllowed = subtractYears(cutoff, Number(limitMatch[1]));
  return birth > youngestAllowed;
}

function ageCheckMessage(name, dob, cutoffDate, ageGroup) {
  const safeName = cleanText_(name) || 'This player';
  const age = ageOnCutoff(dob, cutoffDate);
  if (age === null) return 'Enter a valid date of birth to check the age.';
  const born = formatDateLong(dob);
  const cutoff = formatDateLong(cutoffDate);
  const base = safeName + ' was born on ' + born + ', so is ' + age + ' on ' + cutoff + '.';
  if (ageGroup === 'Open') return base + ' Open entries have no age limit.';
  if (isDobEligible(dob, ageGroup, cutoffDate)) return base + ' This entry is ' + ageGroup + '.';
  return base + ' That is over the limit for ' + ageGroup + '.';
}

/* ------------------------------------------------------------------ *
 * Fees
 * ------------------------------------------------------------------ */

function formatNumber(value) {
  const number = Number(value);
  if (!isFinite(number)) return '0';
  const rounded = Math.round(number);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatPKR(value) {
  return 'Rs ' + formatNumber(value);
}

function feeTypeLabel(earlyBirdActive) {
  return earlyBirdActive ? 'Early Bird' : 'Regular';
}

function feeTypeCode(earlyBirdActive) {
  return earlyBirdActive ? 'EARLY_BIRD' : 'REGULAR';
}

function gameById(games, gameId) {
  if (!games) return null;
  if (Array.isArray(games)) {
    for (let i = 0; i < games.length; i++) {
      if (games[i] && games[i].id === gameId) return games[i];
    }
    return null;
  }
  return games[gameId] || null;
}

function feeFor(game, earlyBirdActive) {
  if (!game) return 0;
  const early = Number(game.earlyFee);
  const regular = Number(game.regularFee);
  if (earlyBirdActive && isFinite(early)) return early;
  if (isFinite(regular)) return regular;
  return isFinite(early) ? early : 0;
}

function regularFeeFor(game) {
  if (!game) return 0;
  const regular = Number(game.regularFee);
  const early = Number(game.earlyFee);
  if (isFinite(regular)) return regular;
  return isFinite(early) ? early : 0;
}

function calculateTotals(entries, games, earlyBirdActive) {
  const list = Array.isArray(entries) ? entries : [];
  let subtotalRegular = 0;
  let netTotal = 0;
  const lines = [];
  for (let i = 0; i < list.length; i++) {
    const entry = list[i] || {};
    const game = gameById(games, entry.gameId);
    const fee = feeFor(game, earlyBirdActive);
    const regular = regularFeeFor(game);
    subtotalRegular += regular;
    netTotal += fee;
    lines.push({
      gameId: entry.gameId,
      game: game ? game.name : '',
      fee: fee,
      regularFee: regular
    });
  }
  return {
    feeType: feeTypeCode(earlyBirdActive),
    feeTypeLabel: feeTypeLabel(earlyBirdActive),
    subtotalRegular: subtotalRegular,
    netTotal: netTotal,
    savings: Math.max(0, subtotalRegular - netTotal),
    lines: lines
  };
}

/* ------------------------------------------------------------------ *
 * Contact details
 * ------------------------------------------------------------------ */

function normalizeWhatsapp(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).replace(/[^\d+]/g, '');
  if (text.indexOf('+92') === 0) text = '0' + text.slice(3);
  else if (text.indexOf('0092') === 0) text = '0' + text.slice(4);
  else if (text.indexOf('92') === 0 && text.length === 12) text = '0' + text.slice(2);
  else if (text.indexOf('3') === 0 && text.length === 10) text = '0' + text;
  text = text.replace(/\D/g, '');
  return /^03\d{9}$/.test(text) ? text : '';
}

function isValidWhatsapp(value) {
  return normalizeWhatsapp(value) !== '';
}

function whatsappInternational(value) {
  const local = normalizeWhatsapp(value);
  return local ? '92' + local.slice(1) : '';
}

function whatsappLink(value) {
  const international = whatsappInternational(value);
  return international ? 'https://wa.me/' + international : '';
}

function isValidEmail(value) {
  const text = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text);
}

/* ------------------------------------------------------------------ *
 * CNIC / B-Form
 * ------------------------------------------------------------------ */

function normalizeIdNumber(value) {
  return String(value === null || value === undefined ? '' : value).replace(/\D/g, '');
}

function formatIdNumber(value) {
  const digits = normalizeIdNumber(value);
  if (digits.length !== 13) return digits;
  return digits.slice(0, 5) + '-' + digits.slice(5, 12) + '-' + digits.slice(12);
}

function isValidIdNumber(value) {
  return /^\d{13}$/.test(normalizeIdNumber(value));
}

/* ------------------------------------------------------------------ *
 * Sheet safety
 * ------------------------------------------------------------------ */

/** Prefix dangerous leading characters so Sheets stores the value as text. */
function sanitizeCell(value) {
  if (typeof value !== 'string') return value;
  if (/^[=+\-@\t\r]/.test(value)) return "'" + value;
  return value;
}

function groupIban(value) {
  const text = String(value || '').replace(/\s+/g, '').toUpperCase();
  const chunks = [];
  for (let i = 0; i < text.length; i += 4) chunks.push(text.slice(i, i + 4));
  return chunks.join(' ');
}

/* ------------------------------------------------------------------ *
 * Players, rosters and divisions
 * ------------------------------------------------------------------ */

function playerRoleForIndex(format, index, minPlayers) {
  if (format !== 'Team') return 'Player';
  if (index === 0) return 'Captain';
  if (index < Math.max(1, Number(minPlayers) || 1)) return 'Player';
  return 'Extra';
}

function buildRoster(players) {
  const list = Array.isArray(players) ? players : [];
  return list.map(function (player, index) {
    const name = cleanText_(player && player.name);
    const dob = parseDateOnly(player && player.dob);
    return (index + 1) + '. ' + name + ' (' + dob + ')';
  }).join('\n');
}

function normalizeDivision(value, allowedDivisions) {
  const allowed = Array.isArray(allowedDivisions) ? allowedDivisions : [];
  if (allowed.length === 0) return 'Open';
  if (allowed.length === 1) return allowed[0];
  if (allowed.indexOf('Open') !== -1) return 'Open';
  const wanted = cleanText_(value);
  for (let i = 0; i < allowed.length; i++) {
    if (String(allowed[i]).toLowerCase() === wanted.toLowerCase()) return allowed[i];
  }
  return '';
}

function formatLabel(game) {
  if (!game) return '';
  const format = game.format || 'Individual';
  if (format === 'Team') {
    const min = Number(game.minPlayers) || 0;
    const max = Number(game.maxPlayers) || min;
    if (min && max && min !== max) return 'Team of ' + min + ' to ' + max;
    if (min) return 'Team of ' + min;
    return 'Team';
  }
  if (format === 'Single') return 'Singles';
  if (format === 'Double') return 'Doubles';
  return 'Individual';
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

function pushError_(errors, path, message) {
  errors.push({ path: path, message: message });
}

function hasFile_(object, field) {
  if (!object) return false;
  return Boolean(
    object[field + 'FileId'] ||
    object[field + 'FileKey'] ||
    object[field + 'File']
  );
}

function validateContact(contact) {
  const errors = [];
  const value = contact || {};
  const name = cleanText_(value.name);
  if (!name) pushError_(errors, 'contact.name', 'Enter your full name.');
  else if (name.length < 3) pushError_(errors, 'contact.name', 'Enter your full name, at least 3 letters.');

  const role = cleanText_(value.role);
  if (ROLES.indexOf(role) === -1) pushError_(errors, 'contact.role', 'Choose Student, Parent or Teacher.');

  if (!isValidWhatsapp(value.whatsapp)) {
    pushError_(errors, 'contact.whatsapp', 'Enter a Pakistani mobile number, for example 0300 1234567.');
  }

  const email = cleanText_(value.email);
  if (!email) pushError_(errors, 'contact.email', 'Enter your email address.');
  else if (!isValidEmail(email)) pushError_(errors, 'contact.email', 'Enter a valid email address, for example name@gmail.com.');

  const institution = cleanText_(value.institution);
  if (!institution) pushError_(errors, 'contact.institution', 'Enter your school or college.');

  return errors;
}

function validateSubmission(payload, options) {
  const opts = options || {};
  const games = opts.games || [];
  const config = opts.config || {};
  const now = opts.now || new Date();
  const cutoff = parseDateOnly(opts.ageCutoffDate || config.AgeCutoffDate);
  const requireIdFiles = opts.requireIdFiles !== false;
  const requirePaymentProof = opts.requirePaymentProof !== false;
  const requireConsent = opts.requireConsent !== false;
  const data = payload || {};
  const errors = [];

  errors.push.apply(errors, validateContact(data.contact));

  const contact = data.contact || {};
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const normalizedEntries = [];

  if (entries.length === 0) {
    pushError_(errors, 'entries', 'Choose at least one game.');
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] || {};
    const prefix = 'entries[' + i + ']';
    const game = gameById(games, entry.gameId);
    if (!game) {
      pushError_(errors, prefix + '.gameId', 'This game is not available. Choose another game.');
      continue;
    }
    if (game.active === false) {
      pushError_(errors, prefix + '.gameId', game.name + ' is not open for registration.');
    }

    const allowedGroups = Array.isArray(game.ageGroups) && game.ageGroups.length ? game.ageGroups : ['Open'];
    const ageGroup = cleanText_(entry.ageGroup);
    if (allowedGroups.indexOf(ageGroup) === -1) {
      pushError_(errors, prefix + '.ageGroup', 'Choose an age group for ' + game.name + '.');
    }

    const allowedDivisions = Array.isArray(game.divisions) && game.divisions.length ? game.divisions : ['Open'];
    const division = normalizeDivision(entry.division, allowedDivisions);
    if (!division) {
      pushError_(errors, prefix + '.division', 'Choose Boys or Girls for ' + game.name + '.');
    }

    const format = game.format || 'Individual';
    const minPlayers = Number(game.minPlayers) || 1;
    const maxPlayers = Number(game.maxPlayers) || minPlayers;
    const teamName = cleanText_(entry.teamName);
    if (format === 'Team' && !teamName) {
      pushError_(errors, prefix + '.teamName', 'Enter a team name.');
    }

    const entryInstitution = cleanText_(entry.institution) || cleanText_(contact.institution);
    if (!entryInstitution) {
      pushError_(errors, prefix + '.institution', 'Enter the school or college for this entry.');
    }

    const players = Array.isArray(entry.players) ? entry.players : [];
    if (players.length < minPlayers) {
      pushError_(errors, prefix + '.players', game.name + ' needs at least ' + minPlayers + ' player' + (minPlayers === 1 ? '' : 's') + '. Add ' + (minPlayers - players.length) + ' more.');
    } else if (players.length > maxPlayers) {
      pushError_(errors, prefix + '.players', game.name + ' allows at most ' + maxPlayers + ' players. Remove ' + (players.length - maxPlayers) + '.');
    }

    const seenIds = {};
    const normalizedPlayers = [];
    for (let p = 0; p < players.length; p++) {
      const player = players[p] || {};
      const playerPrefix = prefix + '.players[' + p + ']';
      const name = cleanText_(player.name);
      const dob = parseDateOnly(player.dob);
      const playerLabel = name || 'Player ' + (p + 1);

      if (!name) pushError_(errors, playerPrefix + '.name', 'Enter the full name for player ' + (p + 1) + '.');
      else if (name.length < 2) pushError_(errors, playerPrefix + '.name', 'Enter the full name for ' + playerLabel + '.');

      if (!dob) {
        pushError_(errors, playerPrefix + '.dob', 'Enter a date of birth for ' + playerLabel + '.');
      } else {
        if (dob > formatPktDate(now)) {
          pushError_(errors, playerPrefix + '.dob', 'Date of birth cannot be in the future.');
        }
        if (ageGroup && ageGroup !== 'Open' && !isDobEligible(dob, ageGroup, cutoff)) {
          const age = ageOnCutoff(dob, cutoff);
          pushError_(errors, playerPrefix + '.dob', playerLabel + ' is ' + age + ' on ' + formatDateLong(cutoff) + ' and does not meet the ' + ageGroup + ' age rule.');
        }
      }

      let idNumber = '';
      if (ageGroup === 'U19' || ageGroup === 'U17') {
        idNumber = formatIdNumber(player.idNumber);
        if (!isValidIdNumber(player.idNumber)) {
          pushError_(errors, playerPrefix + '.idNumber', 'Enter the 13-digit CNIC or B-Form number for ' + playerLabel + '.');
        } else {
          const key = normalizeIdNumber(player.idNumber);
          if (seenIds[key]) {
            pushError_(errors, playerPrefix + '.idNumber', 'This ID number is already used by ' + seenIds[key] + ' in this entry.');
          } else {
            seenIds[key] = playerLabel;
          }
        }
        if (requireIdFiles && !hasFile_(player, 'id')) {
          pushError_(errors, playerPrefix + '.idFile', 'Upload the CNIC or B-Form image for ' + playerLabel + '.');
        }
      }

      normalizedPlayers.push({
        personKey: cleanText_(player.personKey),
        name: name,
        dob: dob,
        idNumber: idNumber,
        idFileId: player.idFileId || '',
        idFileKey: player.idFileKey || '',
        role: playerRoleForIndex(format, p, minPlayers)
      });
    }

    normalizedEntries.push({
      gameId: game.id,
      game: game.name,
      category: game.category,
      format: format,
      ageGroup: ageGroup,
      division: division || '',
      teamName: teamName,
      institution: entryInstitution,
      players: normalizedPlayers
    });
  }

  const payment = data.payment || {};
  if (requirePaymentProof && !hasFile_(payment, 'proof')) {
    pushError_(errors, 'payment.proofFile', 'Upload your payment proof.');
  }
  const transactionId = cleanText_(payment.transactionId);
  if (transactionId.length > 120) {
    pushError_(errors, 'payment.transactionId', 'Keep the transaction ID under 120 characters.');
  }
  if (requireConsent && data.consent !== true) {
    pushError_(errors, 'consent', 'Tick the confirmation box before submitting.');
  }

  const earlyBirdActive = opts.earlyBirdActive !== undefined
    ? Boolean(opts.earlyBirdActive)
    : registrationState(now, config).earlyBirdActive;
  const totals = calculateTotals(normalizedEntries, games, earlyBirdActive);

  const fields = {};
  for (let e = 0; e < errors.length; e++) {
    if (!fields[errors[e].path]) fields[errors[e].path] = errors[e].message;
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    fields: fields,
    totals: totals,
    contact: {
      name: cleanText_(contact.name),
      role: cleanText_(contact.role),
      whatsapp: normalizeWhatsapp(contact.whatsapp),
      email: cleanText_(contact.email),
      institution: cleanText_(contact.institution)
    },
    entries: normalizedEntries,
    payment: {
      transactionId: transactionId
    }
  };
}
