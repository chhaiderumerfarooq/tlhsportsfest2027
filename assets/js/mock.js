/*
 * Offline mock API. Enabled by USE_MOCK in config.js or ?mock=1.
 * It simulates latency, uploads and every documented error code.
 */

import { MOCK_GAMES } from './mock-games.js';
import { ApiError } from './errors.js';
import {
  registrationState,
  calculateTotals,
  validateSubmission,
  parsePktDateTime,
  parseDateOnly
} from './rules.js';
import { MOCK_LATENCY_MS } from './config.js';

const CONTROL_KEY = 'tlhsf3_mock_controls_v1';
const COUNTER_KEY = 'tlhsf3_mock_counter_v1';
const FAILED_UPLOAD_KEY = 'tlhsf3_mock_failed_upload_v1';

const DEFAULT_CONTROLS = {
  now: 'real',
  nextError: 'SUCCESS',
  offline: false,
  failFirstUpload: false,
  fullGame: false,
  notOpen: false,
  feeBump: 0
};

function readStorage(key, fallback) {
  try {
    const text = sessionStorage.getItem(key);
    if (!text) return fallback;
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Mock controls are best effort.
  }
}

export function getMockControls() {
  return { ...DEFAULT_CONTROLS, ...(readStorage(CONTROL_KEY, {}) || {}) };
}

export function setMockControls(partial) {
  const next = { ...getMockControls(), ...partial };
  writeStorage(CONTROL_KEY, next);
  return next;
}

export function resetMockControls() {
  try {
    sessionStorage.removeItem(CONTROL_KEY);
    sessionStorage.removeItem(FAILED_UPLOAD_KEY);
  } catch (error) {
    // Ignore.
  }
}

function delay(ms = MOCK_LATENCY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mockNow(controls = getMockControls()) {
  if (controls.now === 'early-last') return parsePktDateTime('2026-12-10 23:30:00');
  if (controls.now === 'regular') return parsePktDateTime('2026-12-11 10:00:00');
  if (controls.now === 'close-last') return parsePktDateTime('2026-12-20 22:00:00');
  if (controls.now === 'closed') return parsePktDateTime('2026-12-21 09:00:00');
  if (controls.now && controls.now !== 'real') {
    const parsed = parsePktDateTime(controls.now);
    if (parsed) return parsed;
  }
  return new Date();
}

function mockConfigMap(controls) {
  return {
    EventName: 'TLH Sports Fest 3.0',
    EventDates: 'Sat 30 and Sun 31 January 2027',
    Venue: 'TLH Canal Campus',
    RegistrationOpen: controls.notOpen ? 'FALSE' : 'TRUE',
    EarlyBirdEndDate: '2026-12-10',
    RegistrationCloseDate: '2026-12-20',
    AgeCutoffDate: '2027-01-30',
    BankName: 'Bank Alfalah',
    AccountTitle: 'Genesis Educational Service Pvt Ltd.',
    IBAN: 'PK08ALFH0053001010451307',
    Contact1Name: 'Javed Iqbal',
    Contact1Role: 'Event Head',
    Contact1Phone: '+92 301 6884762',
    Contact2Name: 'Hadiqa Mazhar',
    Contact2Role: 'Event Head',
    Contact2Phone: '+92 324 8686769',
    SocialsNotice: 'Socials tickets are sold separately. They are not included in your registration fee.',
    ConsentText: "I confirm that the details are correct, every player meets the age rule for the group entered, and I have a parent or guardian's permission for any player under 18.",
    AnnouncementBanner: '',
    MaxFileMB: 5
  };
}

function publicGames(controls) {
  return MOCK_GAMES.map((game) => ({
    ...game,
    full: controls.fullGame && game.id === 'G01' ? true : false
  }));
}

export async function mockGetConfig() {
  const controls = getMockControls();
  await delay(180 + Math.random() * 260);
  if (controls.offline) {
    throw new ApiError('NETWORK', 'Mock mode: the network is switched off.');
  }
  const now = mockNow(controls);
  const map = mockConfigMap(controls);
  const state = registrationState(now, map);
  const games = publicGames(controls);
  return {
    ok: true,
    generatedAt: now.toISOString(),
    serverTime: now.toISOString(),
    serverTimePkt: now.toISOString(),
    timezone: 'Asia/Karachi',
    event: {
      name: map.EventName,
      dates: map.EventDates,
      venue: map.Venue
    },
    earlyBirdEndDate: '2026-12-10',
    registrationCloseDate: '2026-12-20',
    ageCutoffDate: '2027-01-30',
    earlyBirdActive: state.earlyBirdActive,
    registrationOpen: state.registrationOpen,
    registrationStatus: state.status,
    daysLeftEarlyBird: state.daysLeftEarlyBird,
    daysLeftRegistration: state.daysLeftRegistration,
    bank: {
      bankName: map.BankName,
      accountTitle: map.AccountTitle,
      iban: map.IBAN
    },
    contacts: [
      {
        name: map.Contact1Name,
        role: map.Contact1Role,
        phone: map.Contact1Phone,
        tel: 'tel:+923016884762',
        whatsapp: 'https://wa.me/923016884762'
      },
      {
        name: map.Contact2Name,
        role: map.Contact2Role,
        phone: map.Contact2Phone,
        tel: 'tel:+923248686769',
        whatsapp: 'https://wa.me/923248686769'
      }
    ],
    socialsNotice: map.SocialsNotice,
    announcementBanner: '',
    consentText: map.ConsentText,
    maxFileMB: 5,
    games
  };
}

export async function mockUpload({ token, kind, fileName, mimeType, data, onProgress }) {
  const controls = getMockControls();
  if (controls.offline) {
    throw new ApiError('NETWORK', 'Mock mode: the network is switched off.');
  }
  if (!token) throw new ApiError('VALIDATION_FAILED', 'Missing upload token.');
  if (!['payment', 'id'].includes(kind)) throw new ApiError('FILE_INVALID', 'Unknown file type.');
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mimeType)) {
    throw new ApiError('FILE_INVALID', 'Mock mode only accepts JPEG, PNG, WebP or PDF.');
  }

  if (controls.failFirstUpload) {
    const failed = readStorage(FAILED_UPLOAD_KEY, {}) || {};
    const key = kind + ':' + fileName;
    if (!failed[key]) {
      failed[key] = true;
      writeStorage(FAILED_UPLOAD_KEY, failed);
      throw new ApiError('NETWORK', 'Mock mode: this upload failed on purpose. Retrying should work.');
    }
  }

  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await delay(35);
    if (onProgress) onProgress(i / steps);
  }
  if (!data) throw new ApiError('FILE_INVALID', 'The mock file was empty.');
  return {
    ok: true,
    fileId: 'mockfile_' + kind + '_' + Math.random().toString(36).slice(2, 10)
  };
}

function bumpTotals(totals, bump) {
  if (!bump) return totals;
  const lines = totals.lines.map((line) => ({ ...line }));
  lines[0].fee += bump;
  lines[0].regularFee += bump;
  const netTotal = totals.netTotal + bump;
  const subtotalRegular = totals.subtotalRegular + bump;
  return {
    ...totals,
    lines,
    netTotal,
    subtotalRegular,
    savings: Math.max(0, subtotalRegular - netTotal)
  };
}

function feeChangedError(totals) {
  return new ApiError(
    'FEE_CHANGED',
    'Mock mode: the fee changed while you were filling the form.',
    {},
    {
      total: totals.netTotal,
      regularTotal: totals.subtotalRegular,
      feeType: totals.feeType,
      entries: totals.lines.map((line) => ({
        gameId: line.gameId,
        game: line.game,
        fee: line.fee,
        regularFee: line.regularFee
      }))
    }
  );
}

function nextSubmissionId() {
  let counter = 1;
  try {
    counter = Number(localStorage.getItem(COUNTER_KEY) || '0') + 1;
    localStorage.setItem(COUNTER_KEY, String(counter));
  } catch (error) {
    counter = Math.floor(Math.random() * 9000) + 1;
  }
  return 'TSF3-' + String(counter).padStart(4, '0');
}

export async function mockSubmit(payload) {
  const controls = getMockControls();
  await delay(420 + Math.random() * 480);
  if (controls.offline) {
    throw new ApiError('NETWORK', 'Mock mode: the network is switched off.');
  }

  const now = mockNow(controls);
  const map = mockConfigMap(controls);
  const state = registrationState(now, map);

  if (controls.nextError === 'NOT_OPEN' || state.status === 'NOT_OPEN') {
    setMockControls({ nextError: 'SUCCESS' });
    throw new ApiError('NOT_OPEN', 'Mock mode: registration is switched off.');
  }
  if (controls.nextError === 'CLOSED' || state.status === 'CLOSED') {
    setMockControls({ nextError: 'SUCCESS' });
    throw new ApiError('CLOSED', 'Mock mode: registration is closed.');
  }

  if (controls.nextError === 'VALIDATION_FAILED') {
    setMockControls({ nextError: 'SUCCESS' });
    throw new ApiError('VALIDATION_FAILED', 'Mock mode: one field was rejected.', {
      'contact.email': 'Mock mode rejected this email. Change it and try again.'
    });
  }
  if (controls.nextError === 'GAME_FULL') {
    setMockControls({ nextError: 'SUCCESS' });
    const gameId = payload.entries && payload.entries[0] ? payload.entries[0].gameId : 'G01';
    throw new ApiError('GAME_FULL', 'Mock mode: that game is full.', {
      'entries[0].gameId': 'Mock mode: this game just became full.'
    }, { games: [gameId] });
  }
  if (controls.nextError === 'FILE_INVALID') {
    setMockControls({ nextError: 'SUCCESS' });
    throw new ApiError('FILE_INVALID', 'Mock mode: the payment proof was rejected.', {
      payment: 'Upload the payment proof again.'
    });
  }
  if (controls.nextError === 'RATE_LIMITED') {
    setMockControls({ nextError: 'SUCCESS' });
    throw new ApiError('RATE_LIMITED', 'Mock mode: too many submissions from this number.');
  }
  if (controls.nextError === 'BUSY') {
    setMockControls({ nextError: 'SUCCESS' });
    throw new ApiError('BUSY', 'Mock mode: the server is busy.');
  }
  if (controls.nextError === 'SERVER_ERROR') {
    setMockControls({ nextError: 'SUCCESS' });
    throw new ApiError('SERVER_ERROR', 'Mock mode: the server failed.');
  }

  const validation = validateSubmission(payload, {
    games: MOCK_GAMES,
    config: map,
    now,
    ageCutoffDate: '2027-01-30',
    requireIdFiles: true,
    requirePaymentProof: true,
    requireConsent: true
  });
  if (!validation.ok) {
    throw new ApiError('VALIDATION_FAILED', 'Please fix the highlighted fields.', validation.fields);
  }

  if (controls.fullGame && validation.entries.some((entry) => entry.gameId === 'G01')) {
    throw new ApiError('GAME_FULL', 'Cricket is full.', {
      'entries[0].gameId': 'Cricket is full. Remove it or choose another game.'
    }, { games: ['G01'] });
  }

  const totals = bumpTotals(validation.totals, Number(controls.feeBump) || 0);
  const expected = Number(payload.payment && payload.payment.expectedTotal);

  if (controls.nextError === 'FEE_CHANGED') {
    setMockControls({ nextError: 'SUCCESS', feeBump: 500 });
    throw feeChangedError(bumpTotals(validation.totals, 500));
  }

  if (!Number.isFinite(expected) || expected !== totals.netTotal) {
    setMockControls({ feeBump: 500 });
    throw feeChangedError(bumpTotals(validation.totals, 500));
  }

  const submissionId = nextSubmissionId();
  const success = {
    ok: true,
    submissionId,
    feeType: totals.feeType,
    total: totals.netTotal,
    entries: validation.entries.map((entry, index) => ({
      entryId: submissionId + '-' + String(index + 1).padStart(2, '0'),
      game: entry.game,
      fee: totals.lines[index].fee
    })),
    emailStatus: 'SENT'
  };
  setMockControls({ feeBump: 0, nextError: 'SUCCESS' });
  return success;
}

export function mockFormatNow(controls = getMockControls()) {
  return mockNow(controls).toISOString();
}

export function mockParseDate(value) {
  return parseDateOnly(value);
}
