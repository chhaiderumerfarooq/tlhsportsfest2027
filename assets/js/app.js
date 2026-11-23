/*
 * TLH Sports Fest 3.0 - one-page registration.
 *
 * Everything is rendered from one draft object that is saved on the device.
 * The server remains the authority: fees, ages, capacity and uploads are all
 * checked again by the Apps Script backend.
 */

import { APP_VERSION } from './config.js';
import {
  MOCK_MODE,
  fetchConfig,
  uploadFile,
  submitRegistration,
  getMockControls,
  setMockControls,
  resetMockControls
} from './api.js';
import { ApiError, isApiError } from './errors.js';
import {
  loadDraft,
  saveDraft,
  clearDraft,
  loadConfigCache,
  saveConfigCache,
  newUuid,
  newPersonKey,
  debounce,
  putBlob,
  getBlob,
  deleteBlob,
  clearBlobs
} from './storage.js';
import { prepareFile, blobToBase64, formatBytes, makeObjectUrl, revokeObjectUrl } from './images.js';
import {
  registrationState,
  calculateTotals,
  validateContact,
  validateSubmission,
  ageOnCutoff,
  isDobEligible,
  ageCheckMessage,
  formatPKR,
  formatDateLong,
  formatDateTimeLong,
  formatLabel,
  formatPktDate,
  formatIdNumber,
  normalizeIdNumber,
  isValidIdNumber,
  normalizeDivision,
  gameById,
  feeFor,
  regularFeeFor,
  playerRoleForIndex,
  groupIban,
  parseDateOnly,
  cleanText_
} from './rules.js';
import {
  qs,
  qsa,
  escapeHtml,
  showToast,
  showSavedNote,
  copyText,
  markCopied,
  countUp,
  setBusy,
  focusFirstError,
  showMessageDialog,
  openDialog,
  closeDialog,
  celebrate,
  scrollToTop,
  prefersReducedMotion,
  sleep
} from './ui.js';

const MAX_FILE_MB = () => (state.config && Number(state.config.maxFileMB)) || 5;
const MAX_FILE_BYTES = () => MAX_FILE_MB() * 1024 * 1024;
const MOCK_STORAGE_MODE = MOCK_MODE ? 'mock' : 'live';

const state = {
  config: null,
  configSource: 'live',
  configError: null,
  configLoadedAt: new Date().toISOString(),
  draft: null,
  step: 1,
  totals: null,
  lastAmount: 0,
  busy: false,
  uploads: {},
  entryErrors: {},
  step3General: [],
  feeOverrides: {},
  feeNotice: '',
  personEditor: null,
  personAddAnother: false,
  peoplePicker: null,
  dialogGameId: '',
  submitted: null,
  previewUrl: '',
  countdownTimer: null,
  mockControls: null,
  booted: false
};

const persistDraft = debounce(() => persistNow(false), 350);

/* Uploads retry three times with backoff so a shaky WhatsApp connection does
 * not throw away a completed form. Validation and file errors are not retried. */
async function uploadWithRetry(payload) {
  let lastError = null;
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      return await uploadFile(payload);
    } catch (error) {
      lastError = error;
      const retriable = isApiError(error) && (error.code === 'NETWORK' || error.code === 'BUSY');
      if (!retriable || attempt === 3) throw error;
      await sleep(300 * Math.pow(2, attempt));
    }
  }
  throw lastError || new ApiError('NETWORK', 'The upload failed.');
}

/* ------------------------------------------------------------------ *
 * Draft helpers
 * ------------------------------------------------------------------ */

function createDraft() {
  return {
    version: 1,
    token: newUuid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    step: 1,
    contact: {
      name: '',
      role: 'Student',
      whatsapp: '',
      email: '',
      institution: ''
    },
    entries: [],
    people: {},
    payment: {
      proofFileKey: '',
      proofFileId: '',
      proofFileName: '',
      proofFileType: '',
      proofFileSize: 0,
      transactionId: ''
    },
    consent: false
  };
}

function ensureDraft() {
  if (state.draft) return state.draft;
  const stored = loadDraft();
  if (stored) {
    const base = createDraft();
    state.draft = {
      ...base,
      ...stored,
      contact: { ...base.contact, ...(stored.contact || {}) },
      payment: { ...base.payment, ...(stored.payment || {}) },
      people: stored.people && typeof stored.people === 'object' ? stored.people : {},
      entries: Array.isArray(stored.entries) ? stored.entries.map((entry) => ({
        ...entry,
        playerKeys: Array.isArray(entry.playerKeys) ? entry.playerKeys : []
      })) : []
    };
  } else {
    state.draft = createDraft();
  }
  return state.draft;
}

function persistNow(showNote = true) {
  if (!state.draft) return;
  state.draft.updatedAt = new Date().toISOString();
  const saved = saveDraft(state.draft);
  if (!saved) {
    showToast('This browser could not save the draft. Keep this tab open until you submit.', 'warning', 7000);
    return;
  }
  if (showNote) showSavedNote();
}

function hasDraftContent() {
  if (!state.draft) return false;
  return Boolean(
    state.draft.contact.name ||
    state.draft.contact.email ||
    state.draft.entries.length ||
    Object.keys(state.draft.people).length
  );
}

function gameFor(gameId) {
  return gameById(state.config ? state.config.games : [], gameId);
}

function entryById(entryId) {
  return state.draft ? state.draft.entries.find((entry) => entry.id === entryId) : null;
}

function personByKey(key) {
  return state.draft && state.draft.people ? state.draft.people[key] : null;
}

function peopleInEntry(entry) {
  return (entry.playerKeys || []).map(personByKey).filter(Boolean);
}

function peopleUsedElsewhere(personKey, exceptEntryId) {
  return state.draft.entries.some(
    (entry) => entry.id !== exceptEntryId && (entry.playerKeys || []).includes(personKey)
  );
}

function serverNow() {
  if (state.config && state.config.serverTime) {
    const date = new Date(state.config.serverTime);
    if (!isNaN(date.getTime())) return date;
  }
  return new Date();
}

function rulesConfig() {
  const config = state.config || {};
  return {
    RegistrationOpen: config.registrationStatus === 'NOT_OPEN' ? 'FALSE' : 'TRUE',
    EarlyBirdEndDate: config.earlyBirdEndDate || '',
    RegistrationCloseDate: config.registrationCloseDate || '',
    AgeCutoffDate: config.ageCutoffDate || ''
  };
}

function effectiveState() {
  if (!state.config) return { status: 'NOT_OPEN', registrationOpen: false, earlyBirdActive: false, daysLeftEarlyBird: 0, daysLeftRegistration: 0 };
  return registrationState(serverNow(), rulesConfig());
}

function currentTotals() {
  const entries = state.draft ? state.draft.entries : [];
  const totals = calculateTotals(entries, state.config ? state.config.games : [], effectiveState().earlyBirdActive);
  if (!Object.keys(state.feeOverrides).length) return totals;

  let subtotalRegular = 0;
  let netTotal = 0;
  const lines = totals.lines.map((line) => {
    const override = state.feeOverrides[line.gameId];
    const fee = override && Number.isFinite(Number(override.fee)) ? Number(override.fee) : line.fee;
    const regular = override && Number.isFinite(Number(override.regularFee)) ? Number(override.regularFee) : line.regularFee;
    subtotalRegular += regular;
    netTotal += fee;
    return { ...line, fee, regularFee: regular };
  });
  return {
    ...totals,
    lines,
    subtotalRegular,
    netTotal,
    savings: Math.max(0, subtotalRegular - netTotal)
  };
}

function entryFee(entry) {
  const game = gameFor(entry.gameId);
  if (!game) return 0;
  const override = state.feeOverrides[entry.gameId];
  if (override && Number.isFinite(Number(override.fee))) return Number(override.fee);
  return feeFor(game, effectiveState().earlyBirdActive);
}

/* ------------------------------------------------------------------ *
 * Boot and config
 * ------------------------------------------------------------------ */

function boot() {
  state.configLoadedAt = new Date().toISOString();
  ensureDraft();
  wireGlobalEvents();
  initEmbers();
  initMockPanel();
  const cached = loadConfigCache(MOCK_STORAGE_MODE);
  if (cached) {
    // Paint the last good config immediately, then refresh in the background.
    state.config = cached.config;
    state.configSource = 'cache';
    syncContactInputs();
    renderAll();
  } else {
    renderLandingLoading();
    updateStartButtons();
  }
  loadConfig();
  state.booted = true;
}

function initEmbers() {
  const layer = qs('#embers');
  if (!layer || prefersReducedMotion()) return;
  const count = window.innerWidth < 620 ? 12 : 20;
  for (let i = 0; i < count; i++) {
    const ember = document.createElement('span');
    ember.className = 'ember';
    ember.style.left = (Math.random() * 100).toFixed(2) + '%';
    ember.style.setProperty('--duration', (7 + Math.random() * 7).toFixed(2) + 's');
    ember.style.setProperty('--delay', (Math.random() * 9).toFixed(2) + 's');
    ember.style.setProperty('--drift', Math.round(Math.random() * 100 - 50) + 'px');
    ember.style.width = ember.style.height = (2 + Math.random() * 4).toFixed(1) + 'px';
    layer.appendChild(ember);
  }
}

async function loadConfig({ silent = false } = {}) {
  if (!silent) renderLandingLoading();
  try {
    const config = await fetchConfig();
    if (!config || !Array.isArray(config.games)) {
      throw new ApiError('SERVER_ERROR', 'The event details are incomplete. Please try again.');
    }
    state.config = config;
    state.configSource = 'live';
    state.configError = null;
    saveConfigCache(config, MOCK_STORAGE_MODE);
    syncContactInputs();
    renderAll();
    return true;
  } catch (error) {
    const cached = loadConfigCache(MOCK_STORAGE_MODE);
    if (cached) {
      state.config = cached.config;
      state.configSource = 'cache';
      state.configError = error;
      syncContactInputs();
      renderAll();
      if (!silent) {
        showToast('Showing saved event details. Reconnect for live fees and dates.', 'warning', 6500);
      }
      return true;
    }
    state.config = null;
    state.configSource = 'none';
    state.configError = error;
    renderLandingError();
    renderFormNotice();
    updateStartButtons();
    return false;
  }
}

async function refreshConfigSilently() {
  try {
    const config = await fetchConfig();
    if (config && Array.isArray(config.games)) {
      state.config = config;
      state.configSource = 'live';
      state.configError = null;
      saveConfigCache(config, MOCK_STORAGE_MODE);
      return true;
    }
  } catch (error) {
    state.configError = error;
  }
  return false;
}

function renderAll() {
  renderAnnouncement();
  renderContacts();
  renderLanding();
  renderFormNotice();
  updateStartButtons();
  const done = qs('#done');
  if (state.config && state.draft && (!done || done.hidden)) {
    renderGames();
    renderEntries();
    renderReview();
  }
}

/**
 * A short notice at the top of the form. It covers loading, a failed config
 * request, and a closed registration window.
 */
function renderFormNotice() {
  const notice = qs('#form-notice');
  if (!notice) return;
  if (!state.config) {
    notice.className = 'wizard-alert';
    notice.textContent = state.configError
      ? 'Event details could not load. Check your connection and refresh this page.'
      : 'Loading games and fees…';
    notice.hidden = false;
    return;
  }
  const status = effectiveState();
  if (status.registrationOpen) {
    notice.hidden = true;
    notice.textContent = '';
    notice.className = 'wizard-alert';
    return;
  }
  notice.className = 'wizard-alert is-warning';
  notice.textContent = status.status === 'CLOSED'
    ? 'Registration closed on ' + formatDateLong(state.config.registrationCloseDate) + '. Message the event heads if you need help.'
    : 'Registration has not opened yet. Please check back soon.';
  notice.hidden = false;
}

/* ------------------------------------------------------------------ *
 * Landing
 * ------------------------------------------------------------------ */

function renderLandingLoading() {
  const status = qs('#landing-status');
  if (status) status.textContent = 'Loading event details…';
  const chip = qs('#landing-early-chip .early-chip-text');
  if (chip) chip.textContent = 'Loading dates…';
  const start = qs('#start-btn');
  if (start) start.disabled = true;
  renderFormNotice();
}

function renderLandingError() {
  const status = qs('#landing-status');
  if (!status) return;
  const message = state.configError && state.configError.message
    ? state.configError.message
    : 'The event details could not be loaded. Check your connection and try again.';
  status.innerHTML =
    '<span class="status-warning">' + escapeHtml(message) + '</span> ' +
    '<button class="link-button" type="button" id="retry-config">Try again</button>';
  const chip = qs('#landing-early-chip .early-chip-text');
  if (chip) chip.textContent = 'Not connected';
  const note = qs('#landing-games-note');
  if (note) note.textContent = '';
  const grid = qs('#games-grid');
  if (grid) grid.innerHTML = '<p class="empty-state">Games could not load. Check your connection and try again.</p>';
  renderFormNotice();
  qs('#retry-config')?.addEventListener('click', () => loadConfig());
}

function renderAnnouncement() {
  const banner = qs('#announcement');
  if (!banner) return;
  const text = state.config && state.config.announcementBanner ? String(state.config.announcementBanner).trim() : '';
  if (!text) {
    banner.hidden = true;
    banner.textContent = '';
    return;
  }
  banner.textContent = text;
  banner.hidden = false;
}

function renderContacts() {
  const contacts = state.config && Array.isArray(state.config.contacts) ? state.config.contacts : [];
  const landing = qs('#landing-contacts');
  const footer = qs('#footer-contacts');
  if (landing) {
    landing.innerHTML = contacts.length
      ? contacts.map(contactCardHtml).join('')
      : '<p class="muted">Contact details will appear here when the event page loads.</p>';
  }
  if (footer) {
    footer.innerHTML = contacts.length
      ? contacts.map((contact) => (
          '<span class="footer-contact">' +
          '<strong>' + escapeHtml(contact.name) + '</strong> ' +
          '<a href="' + escapeHtml(contact.tel || '#') + '">' + escapeHtml(contact.phone) + '</a>' +
          (contact.whatsapp ? ' <a href="' + escapeHtml(contact.whatsapp) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
          '</span>'
        )).join('')
      : '';
  }
}

function contactCardHtml(contact) {
  const actions = [];
  if (contact.tel) {
    actions.push('<a class="btn btn-secondary btn-small" href="' + escapeHtml(contact.tel) + '">Call</a>');
  }
  if (contact.whatsapp) {
    actions.push('<a class="btn btn-secondary btn-small" href="' + escapeHtml(contact.whatsapp) + '" target="_blank" rel="noopener">WhatsApp</a>');
  }
  return '<div class="contact-card">' +
    '<p class="contact-name">' + escapeHtml(contact.name || 'Event head') + '</p>' +
    '<p class="contact-role">' + escapeHtml(contact.role || 'Event head') + '</p>' +
    '<p class="contact-phone">' + escapeHtml(contact.phone || '') + '</p>' +
    '<div class="contact-actions">' + actions.join('') + '</div>' +
    '</div>';
}

function renderLanding() {
  if (!state.config) return;
  const config = state.config;
  const status = effectiveState();
  const earlyText = qs('#landing-early-chip .early-chip-text');
  const chip = qs('#landing-early-chip');
  if (earlyText) {
    if (status.status === 'NOT_OPEN') earlyText.textContent = 'Registration not open yet';
    else if (status.status === 'CLOSED') earlyText.textContent = 'Registration closed';
    else if (status.earlyBirdActive) {
      const days = status.daysLeftEarlyBird;
      earlyText.textContent = 'Ends ' + formatDateLong(config.earlyBirdEndDate) + ' · ' + (days <= 0 ? 'last day' : days + (days === 1 ? ' day left' : ' days left'));
    } else {
      earlyText.textContent = 'Regular fees now apply';
    }
  }
  if (chip) {
    chip.classList.toggle('is-warning', status.status !== 'OPEN' || !status.earlyBirdActive);
  }

  const statusEl = qs('#landing-status');
  if (statusEl) {
    let text = '';
    if (status.status === 'NOT_OPEN') {
      text = 'Registration is not open yet. Please check back soon.';
    } else if (status.status === 'CLOSED') {
      text = 'Registration closed on ' + formatDateLong(config.registrationCloseDate) + '. Message the event heads if you need help.';
    } else if (status.earlyBirdActive) {
      const days = status.daysLeftEarlyBird;
      text = 'Early bird fees are open until ' + formatDateLong(config.earlyBirdEndDate) + ' (' + (days <= 0 ? 'last day' : days + (days === 1 ? ' day left' : ' days left')) + '). Registration closes ' + formatDateLong(config.registrationCloseDate) + '.';
    } else {
      text = 'Early bird has ended. Regular fees apply. Registration closes ' + formatDateLong(config.registrationCloseDate) + '.';
    }
    if (state.configSource === 'cache') {
      text = 'Showing saved event details. Reconnect for live fees. ' + text;
    }
    statusEl.innerHTML = escapeHtml(text) +
      (hasDraftContent() ? ' <button class="link-button" type="button" id="discard-draft">Discard saved draft</button>' : '');
    qs('#discard-draft')?.addEventListener('click', confirmDiscardDraft);
  }

  const note = qs('#landing-games-note');
  if (note) {
    const games = config.games || [];
    const categories = Array.from(new Set(games.map((game) => game.category).filter(Boolean)));
    note.textContent = games.length + (games.length === 1 ? ' game' : ' games') +
      (categories.length ? ' across ' + joinWords(categories) : '') + '.';
  }

  const socials = qs('#landing-socials');
  if (socials) {
    const notice = config.socialsNotice ? String(config.socialsNotice).trim() : '';
    if (notice) {
      socials.innerHTML = '<strong>Please note:</strong> ' + escapeHtml(notice);
      socials.hidden = false;
    } else {
      socials.hidden = true;
    }
  }
  updateStartButtons();
}

function joinWords(values) {
  if (values.length <= 1) return values.join('');
  if (values.length === 2) return values[0] + ' and ' + values[1];
  return values.slice(0, -1).join(', ') + ' and ' + values[values.length - 1];
}

function updateStartButtons() {
  const start = qs('#start-btn');
  const header = qs('#header-register');
  const label = hasDraftContent() ? 'Continue registration' : 'Register now';
  if (start) {
    start.textContent = label;
    start.disabled = !state.config || !effectiveState().registrationOpen;
  }
  if (header) {
    header.textContent = label;
    header.disabled = !state.config || !effectiveState().registrationOpen;
  }
}

function confirmDiscardDraft() {
  showMessageDialog({
    title: 'Discard saved draft?',
    bodyHtml: '<p>This removes the details and files saved on this device. It cannot be undone.</p>',
    actions: [
      { label: 'Keep draft', style: 'secondary' },
      {
        label: 'Discard draft',
        style: 'danger',
        onClick: async () => {
          await clearBlobs();
          clearDraft();
          state.draft = createDraft();
          state.entryErrors = {};
          state.feeOverrides = {};
          state.feeNotice = '';
          state.uploads = {};
          syncContactInputs();
          renderLanding();
          renderGames();
          renderEntries();
          renderReview();
          updateStartButtons();
          showToast('Saved draft discarded.', 'info');
        }
      }
    ]
  });
}

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

function showLanding() {
  qs('#landing').hidden = false;
  qs('#wizard').hidden = false;
  qs('#help').hidden = false;
  qs('#done').hidden = true;
  qs('#header-register').hidden = false;
  document.body.classList.remove('wizard-open');
  document.title = 'TLH Sports Fest 3.0 — Register | 30–31 January 2027';
  state.submitted = null;
  stopCountdown();
  ensureDraft();
  syncContactInputs();
  renderLanding();
  renderFormNotice();
  renderGames();
  renderEntries();
  renderReview();
  updateStartButtons();
  scrollToTop();
}

/**
 * Opens the registration form at the first section that still needs work. The
 * form is one page, so this is a scroll: a returning family lands exactly
 * where they stopped.
 */
function showWizard() {
  if (!state.config) {
    showToast('The event details are still loading. Try again in a moment.', 'warning');
    return;
  }
  const status = effectiveState();
  if (!status.registrationOpen) {
    showMessageDialog({
      title: status.status === 'CLOSED' ? 'Registration is closed' : 'Registration is not open',
      bodyHtml: '<p>' + (status.status === 'CLOSED'
        ? 'Registration closed on ' + escapeHtml(formatDateLong(state.config.registrationCloseDate)) + '. Message the event heads if you need help.'
        : 'Registration has not opened yet. Please check back soon.') + '</p>',
      actions: [{ label: 'Back to event page', style: 'secondary', onClick: showLanding }]
    });
    return;
  }
  ensureDraft();
  qs('#landing').hidden = false;
  qs('#done').hidden = true;
  qs('#help').hidden = false;
  qs('#wizard').hidden = false;
  qs('#header-register').hidden = false;
  document.body.classList.remove('wizard-open');
  document.title = 'Register · TLH Sports Fest 3.0';
  updateStartButtons();
  syncContactInputs();
  renderGames();
  renderEntries();
  renderReview();
  updateSelectionBar();
  showStep(resumeStep(), { focus: false });
}

function resumeStep() {
  if (!state.draft) return 1;
  if (validateContact(state.draft.contact).length) return 1;
  if (!state.draft.entries.length) return state.draft.contact.name ? 2 : 1;
  if (state.draft.entries.some((entry) => !isEntryLooksComplete(entry))) return 3;
  return 4;
}

function showStep(step, { focus = true } = {}) {
  const sectionNumber = Math.min(4, Math.max(1, Number(step) || 1));
  state.step = sectionNumber;
  if (state.draft) {
    state.draft.step = sectionNumber;
    persistNow(false);
  }
  clearWizardAlert();
  clearSubmitError();
  if (sectionNumber >= 2) renderGames();
  if (sectionNumber >= 3) renderEntries();
  if (sectionNumber >= 4) renderReview();
  const section = qs('#step-' + sectionNumber);
  if (section) {
    section.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }
  if (focus) {
    const heading = qs('#step-' + sectionNumber + '-title');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }
}

function showWizardAlert(message, type = 'error') {
  const alert = qs('#wizard-alert');
  if (!alert) return;
  alert.textContent = message;
  alert.className = 'wizard-alert' + (type === 'warning' ? ' is-warning' : '');
  alert.hidden = false;
}

function clearWizardAlert() {
  const alert = qs('#wizard-alert');
  if (alert) {
    alert.hidden = true;
    alert.textContent = '';
  }
}

function clearSubmitError() {
  const alert = qs('#submit-error');
  if (alert) {
    alert.hidden = true;
    alert.textContent = '';
  }
}

function startCountdown() {
  stopCountdown();
  const button = qs('#submit-btn');
  if (!button) return;
  const readyAt = new Date(state.configLoadedAt).getTime() + 30000;
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((readyAt - Date.now()) / 1000));
    if (remaining > 0) {
      button.disabled = true;
      button.textContent = 'Please wait ' + remaining + 's';
    } else {
      button.disabled = state.busy;
      button.textContent = state.busy ? 'Submitting…' : 'Submit registration';
      stopCountdown();
    }
  };
  tick();
  if (Date.now() < readyAt) state.countdownTimer = window.setInterval(tick, 500);
}

function stopCountdown() {
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
  const button = qs('#submit-btn');
  if (button && !state.busy) {
    button.disabled = false;
    button.textContent = 'Submit registration';
  }
}

/* ------------------------------------------------------------------ *
 * Step 1 - contact
 * ------------------------------------------------------------------ */

function syncContactInputs() {
  if (!state.draft) return;
  qsa('[data-contact]').forEach((input) => {
    const key = input.dataset.contact;
    input.value = state.draft.contact[key] || '';
  });
  const consent = qs('#consent');
  if (consent) consent.checked = Boolean(state.draft.consent);
}

function setFieldError(path, message) {
  const target = qsa('[data-error-for]').find((el) => el.dataset.errorFor === path);
  if (target) target.textContent = message || '';
  const input = fieldForPath(path);
  if (input) {
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
}

function fieldForPath(path) {
  if (path.startsWith('contact.')) {
    return qs('[data-contact="' + path.slice('contact.'.length) + '"]');
  }
  if (path === 'payment.transactionId') return qs('[data-payment="transactionId"]');
  if (path === 'consent') return qs('#consent');
  return null;
}

function clearFieldErrors() {
  qsa('[data-error-for]').forEach((el) => { el.textContent = ''; });
  qsa('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
}

function validateStep1() {
  clearFieldErrors();
  const errors = validateContact(state.draft.contact);
  if (!errors.length) return true;
  errors.forEach((error) => setFieldError(error.path, error.message));
  showWizardAlert('Check the highlighted details before continuing.');
  focusFirstError(qs('#step-1'));
  return false;
}

/* ------------------------------------------------------------------ *
 * Step 2 - games
 * ------------------------------------------------------------------ */

const gamesUi = {
  search: '',
  category: 'All'
};

function renderGames() {
  const grid = qs('#games-grid');
  if (!grid || !state.config) return;
  const games = (state.config.games || []).filter((game) => game && game.active !== false);
  const categories = ['All'].concat(Array.from(new Set(games.map((game) => game.category).filter(Boolean))));
  if (!categories.includes(gamesUi.category)) gamesUi.category = 'All';

  const tabs = qs('#category-tabs');
  if (tabs) {
    tabs.innerHTML = categories.map((category) => {
      const count = category === 'All' ? games.length : games.filter((game) => game.category === category).length;
      return '<button class="category-tab' + (gamesUi.category === category ? ' is-active' : '') + '" type="button" role="tab" aria-selected="' +
        (gamesUi.category === category ? 'true' : 'false') + '" data-category="' + escapeHtml(category) + '">' +
        escapeHtml(category) + ' <span class="tab-count">' + count + '</span></button>';
    }).join('');
  }

  const search = gamesUi.search.trim().toLowerCase();
  const filtered = games.filter((game) => {
    if (gamesUi.category !== 'All' && game.category !== gamesUi.category) return false;
    if (!search) return true;
    return [game.name, game.category, game.format, game.details, (game.ageGroups || []).join(' '), (game.divisions || []).join(' ')]
      .join(' ').toLowerCase().includes(search);
  }).sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));

  grid.innerHTML = filtered.map(gameCardHtml).join('');
  const empty = qs('#games-empty');
  if (empty) empty.hidden = filtered.length !== 0;

  updateSelectionBar();
}

function gameCardHtml(game) {
  const selected = state.draft.entries.filter((entry) => entry.gameId === game.id).length;
  const fee = feeFor(game, effectiveState().earlyBirdActive);
  const regular = regularFeeFor(game);
  const early = effectiveState().earlyBirdActive && regular > fee;
  const divisions = (game.divisions || []).join(' · ');
  const ageGroups = (game.ageGroups || []).join(' · ');
  const full = Boolean(game.full);

  return '<article class="game-card' + (selected ? ' is-selected' : '') + (full ? ' is-full' : '') + '" data-game-id="' + escapeHtml(game.id) + '">' +
    '<div class="game-card-top">' +
      '<span class="game-category">' + escapeHtml(game.category || 'Game') + '</span>' +
      (full ? '<span class="badge badge-full">Full</span>' : selected ? '<span class="badge badge-added">Added ×' + selected + '</span>' : '') +
    '</div>' +
    '<h3 class="game-name">' + escapeHtml(game.name) + '</h3>' +
    '<p class="game-meta">' + escapeHtml(formatLabel(game)) + (divisions ? ' · ' + escapeHtml(divisions) : '') + (ageGroups ? ' · ' + escapeHtml(ageGroups) : '') + '</p>' +
    '<p class="game-fee">' + escapeHtml(formatPKR(fee)) +
      (early ? ' <span class="game-fee-regular">' + escapeHtml(formatPKR(regular)) + '</span>' : '') +
    '</p>' +
    '<div class="game-card-actions">' +
      '<button class="btn btn-secondary btn-small" type="button" data-game-action="details" data-game-id="' + escapeHtml(game.id) + '">Details</button>' +
      (full
        ? '<button class="btn btn-primary btn-small" type="button" disabled>Full</button>'
        : '<button class="btn btn-primary btn-small" type="button" data-game-action="add" data-game-id="' + escapeHtml(game.id) + '">' + (selected ? 'Add another' : 'Add game') + '</button>') +
      (selected ? '<button class="btn btn-ghost btn-small" type="button" data-game-action="remove" data-game-id="' + escapeHtml(game.id) + '">Remove one</button>' : '') +
    '</div>' +
    '</article>';
}

function addGame(gameId) {
  const game = gameFor(gameId);
  if (!game) return;
  if (game.full) {
    showToast(game.name + ' is full.', 'warning');
    return;
  }
  const divisions = Array.isArray(game.divisions) ? game.divisions : [];
  const ageGroups = Array.isArray(game.ageGroups) ? game.ageGroups : [];
  const entry = {
    id: 'e_' + newUuid(),
    gameId: game.id,
    ageGroup: ageGroups[0] || 'Open',
    division: normalizeDivision(divisions[0] || '', divisions),
    teamName: '',
    institution: state.draft.contact.institution || '',
    playerKeys: []
  };
  state.draft.entries.push(entry);
  persistNow();
  renderGames();
  renderEntries();
  updateSelectionBar();
  showToast(game.name + ' added. Add another game or continue.', 'success');
}

function removeLastEntryForGame(gameId) {
  const index = state.draft.entries.map((entry) => entry.gameId).lastIndexOf(gameId);
  if (index === -1) return;
  const [entry] = state.draft.entries.splice(index, 1);
  cleanupPeopleAfterEntryRemoved(entry);
  persistNow();
  renderGames();
  renderEntries();
  updateSelectionBar();
  showToast('Entry removed.', 'info');
}

function cleanupPeopleAfterEntryRemoved(entry) {
  (entry.playerKeys || []).forEach((key) => {
    if (!peopleUsedElsewhere(key, entry.id) && personByKey(key)) {
      const person = personByKey(key);
      if (person.idFileKey) deleteBlob(person.idFileKey);
      delete state.draft.people[key];
      delete state.entryErrors[entry.id];
    }
  });
}

function updateSelectionBar() {
  const count = state.draft ? state.draft.entries.length : 0;
  const countEl = qs('#selection-count');
  const totalEl = qs('#selection-total');
  if (countEl) countEl.textContent = count + (count === 1 ? ' entry selected' : ' entries selected');
  if (totalEl) totalEl.textContent = formatPKR(currentTotals().netTotal);
}

function openGameDialog(gameId) {
  const game = gameFor(gameId);
  if (!game) return;
  state.dialogGameId = gameId;
  const early = effectiveState().earlyBirdActive;
  const fee = feeFor(game, early);
  const regular = regularFeeFor(game);
  const title = qs('#game-dialog-title');
  const body = qs('#game-dialog-body');
  if (title) title.textContent = game.name;
  if (body) {
    body.innerHTML =
      '<p class="game-category">' + escapeHtml(game.category || '') + '</p>' +
      '<dl class="detail-list">' +
        '<div><dt>Format</dt><dd>' + escapeHtml(formatLabel(game)) + '</dd></div>' +
        '<div><dt>Age groups</dt><dd>' + escapeHtml((game.ageGroups || []).join(', ')) + '</dd></div>' +
        '<div><dt>Divisions</dt><dd>' + escapeHtml((game.divisions || []).join(', ')) + '</dd></div>' +
        '<div><dt>Entry fee</dt><dd>' + escapeHtml(formatPKR(fee)) + (early && regular > fee ? ' <span class="muted">(regular ' + escapeHtml(formatPKR(regular)) + ')</span>' : '') + '</dd></div>' +
      '</dl>' +
      (game.details ? '<h3 class="card-title">About</h3><p class="game-details">' + escapeHtml(game.details) + '</p>' : '') +
      (game.prizes ? '<h3 class="card-title">Prizes</h3><p class="game-details">' + escapeHtml(game.prizes) + '</p>' : '') +
      (game.full
        ? '<p class="notice notice-warning">This game is full. You cannot add another entry.</p>'
        : '<button class="btn btn-primary btn-block" type="button" data-game-action="dialog-add" data-game-id="' + escapeHtml(game.id) + '">Add to registration</button>');
  }
  openDialog(qs('#game-dialog'));
}

/* ------------------------------------------------------------------ *
 * Step 3 - entries and players
 * ------------------------------------------------------------------ */

function renderEntries() {
  const list = qs('#entries-list');
  if (!list || !state.draft) return;
  if (!state.draft.entries.length) {
    list.innerHTML =
      '<div class="empty-card">' +
      '<h3>No games selected yet</h3>' +
      '<p class="muted">Choose at least one game before adding players.</p>' +
      '<button class="btn btn-primary" type="button" data-entry-action="choose-games">Choose games</button>' +
      '</div>';
    return;
  }
  list.innerHTML = state.draft.entries.map(entryCardHtml).join('');
}

function isEntryLooksComplete(entry) {
  const game = gameFor(entry.gameId);
  if (!game) return false;
  const players = peopleInEntry(entry);
  const minPlayers = Number(game.minPlayers) || 1;
  const maxPlayers = Number(game.maxPlayers) || minPlayers;
  if (players.length < minPlayers || players.length > maxPlayers) return false;
  if (game.format === 'Team' && !String(entry.teamName || '').trim()) return false;
  if (!String(entry.institution || '').trim()) return false;
  const needsId = entry.ageGroup === 'U19' || entry.ageGroup === 'U17';
  return players.every((person) =>
    person.name && person.dob &&
    (!needsId || (person.idNumber && (person.idFileKey || person.idFileId)))
  );
}

function entryCardHtml(entry) {
  const game = gameFor(entry.gameId);
  if (!game) {
    return '<article class="entry-card has-error" data-entry-id="' + escapeHtml(entry.id) + '">' +
      '<div class="entry-head"><div><h3>Game unavailable</h3><p class="muted">This game is no longer open.</p></div>' +
      '<button class="btn btn-ghost btn-small" type="button" data-entry-action="remove-entry" data-entry-id="' + escapeHtml(entry.id) + '">Remove</button></div>' +
      '</article>';
  }
  const players = peopleInEntry(entry);
  const minPlayers = Number(game.minPlayers) || 1;
  const maxPlayers = Number(game.maxPlayers) || minPlayers;
  const ageGroups = game.ageGroups || ['Open'];
  const divisions = game.divisions || ['Open'];
  const errors = state.entryErrors[entry.id] || { fields: {}, players: {}, messages: [] };
  const countText = players.length + ' of ' + (minPlayers === maxPlayers ? minPlayers : minPlayers + '–' + maxPlayers) + (maxPlayers === 1 ? ' player' : ' players');
  const needsId = entry.ageGroup === 'U19' || entry.ageGroup === 'U17';
  const canAdd = players.length < maxPlayers;
  const complete = isEntryLooksComplete(entry);

  const roster = players.length
    ? players.map((person, index) => playerRowHtml(entry, person, index, game, errors)).join('')
    : '<li class="roster-empty">No players yet. ' + (needsId ? 'Have each player’s CNIC or B-Form photo ready.' : 'Add at least ' + minPlayers + ' player' + (minPlayers === 1 ? '' : 's') + '.') + '</li>';

  return '<article class="entry-card' + (errors.messages && errors.messages.length ? ' has-error' : '') + '" data-entry-id="' + escapeHtml(entry.id) + '">' +
    '<div class="entry-head">' +
      '<div>' +
        '<p class="game-category">' + escapeHtml(game.category || '') + (complete ? ' <span class="badge badge-added">Ready ✓</span>' : '') + '</p>' +
        '<h3 class="entry-title">' + escapeHtml(game.name) + '</h3>' +
        '<p class="entry-sub">' + escapeHtml(formatLabel(game)) + ' · ' + escapeHtml(formatPKR(entryFee(entry))) + '</p>' +
      '</div>' +
      '<div class="entry-head-actions">' +
        '<button class="btn btn-ghost btn-small" type="button" data-entry-action="remove-entry" data-entry-id="' + escapeHtml(entry.id) + '">Remove</button>' +
      '</div>' +
    '</div>' +
    '<div class="entry-body">' +
    '<div class="entry-fields">' +
      '<div class="field">' +
        '<label for="age-' + escapeHtml(entry.id) + '">Age group</label>' +
        '<select id="age-' + escapeHtml(entry.id) + '" data-entry-field="ageGroup" data-entry-id="' + escapeHtml(entry.id) + '">' +
          ageGroups.map((group) => '<option value="' + escapeHtml(group) + '"' + (entry.ageGroup === group ? ' selected' : '') + '>' + escapeHtml(group) + '</option>').join('') +
        '</select>' +
        (errors.fields.ageGroup ? '<p class="field-error">' + escapeHtml(errors.fields.ageGroup) + '</p>' : '') +
      '</div>' +
      '<div class="field">' +
        '<label for="division-' + escapeHtml(entry.id) + '">Division</label>' +
        '<select id="division-' + escapeHtml(entry.id) + '" data-entry-field="division" data-entry-id="' + escapeHtml(entry.id) + '"' + (divisions.length <= 1 ? ' disabled' : '') + '>' +
          divisions.map((division) => '<option value="' + escapeHtml(division) + '"' + (entry.division === division ? ' selected' : '') + '>' + escapeHtml(division) + '</option>').join('') +
        '</select>' +
        (errors.fields.division ? '<p class="field-error">' + escapeHtml(errors.fields.division) + '</p>' : '') +
      '</div>' +
      (game.format === 'Team'
        ? '<div class="field field-wide">' +
            '<label for="team-' + escapeHtml(entry.id) + '">Team name</label>' +
            '<input id="team-' + escapeHtml(entry.id) + '" type="text" maxlength="80" value="' + escapeHtml(entry.teamName || '') + '" data-entry-field="teamName" data-entry-id="' + escapeHtml(entry.id) + '" placeholder="e.g. Canal Strikers">' +
            (errors.fields.teamName ? '<p class="field-error">' + escapeHtml(errors.fields.teamName) + '</p>' : '') +
          '</div>'
        : '') +
      '<div class="field field-wide">' +
        '<label for="institution-' + escapeHtml(entry.id) + '">School or college</label>' +
        '<input id="institution-' + escapeHtml(entry.id) + '" type="text" maxlength="120" value="' + escapeHtml(entry.institution || '') + '" data-entry-field="institution" data-entry-id="' + escapeHtml(entry.id) + '" placeholder="School or college for this entry">' +
        (errors.fields.institution ? '<p class="field-error">' + escapeHtml(errors.fields.institution) + '</p>' : '') +
      '</div>' +
    '</div>' +
    (errors.fields.players ? '<p class="field-error entry-error">' + escapeHtml(errors.fields.players) + '</p>' : '') +
    '<div class="roster-head">' +
      '<h4>Players</h4>' +
      '<span class="roster-count' + (players.length < minPlayers ? ' is-short' : '') + '">' + escapeHtml(countText) + '</span>' +
    '</div>' +
    '<ul class="roster">' + roster + '</ul>' +
    (errors.messages && errors.messages.length
      ? '<ul class="entry-error-list">' + Array.from(new Set(errors.messages)).map((message) => '<li>' + escapeHtml(message) + '</li>').join('') + '</ul>'
      : '') +
    '<div class="roster-actions">' +
      (Object.keys(state.draft.people).some((key) => !(entry.playerKeys || []).includes(key))
        ? '<button class="btn btn-secondary btn-small" type="button" data-entry-action="add-existing" data-entry-id="' + escapeHtml(entry.id) + '"' + (canAdd ? '' : ' disabled') + '>Add existing person</button>'
        : '') +
      '<button class="btn btn-primary btn-small" type="button" data-entry-action="add-person" data-entry-id="' + escapeHtml(entry.id) + '"' + (canAdd ? '' : ' disabled') + '>Add new person</button>' +
      (canAdd ? '' : '<span class="muted roster-full">This entry is full.</span>') +
    '</div>' +
    '</div>' +
    '</article>';
}

function playerRowHtml(entry, person, index, game, errors) {
  const minPlayers = Number(game.minPlayers) || 1;
  const role = playerRoleForIndex(game.format, index, minPlayers);
  const age = ageOnCutoff(person.dob, state.config.ageCutoffDate);
  const needsId = entry.ageGroup === 'U19' || entry.ageGroup === 'U17';
  const idText = needsId
    ? (person.idNumber ? formatIdNumber(person.idNumber) : 'ID number missing') +
      ' · ' + (person.idFileId || person.idFileKey ? 'ID photo added' : 'ID photo missing')
    : 'No ID needed for this age group';
  const playerError = errors.players[person.key];
  return '<li class="roster-row' + (playerError ? ' has-error' : '') + '">' +
    '<span class="roster-number">' + (index + 1) + '</span>' +
    '<div class="roster-main">' +
      '<p class="roster-name">' + escapeHtml(person.name || 'Unnamed player') + (role !== 'Player' ? ' <span class="role-tag">' + escapeHtml(role) + '</span>' : '') + '</p>' +
      '<p class="roster-meta">Born ' + escapeHtml(formatDateLong(person.dob) || '—') + (age === null ? '' : ' · ' + age + ' on ' + escapeHtml(formatDateLong(state.config.ageCutoffDate))) + '</p>' +
      '<p class="roster-meta roster-id">' + escapeHtml(idText) + '</p>' +
      (playerError ? '<p class="field-error">' + escapeHtml(playerError) + '</p>' : '') +
    '</div>' +
    '<div class="roster-buttons">' +
      '<button class="icon-button" type="button" data-entry-action="edit-person" data-entry-id="' + escapeHtml(entry.id) + '" data-person-key="' + escapeHtml(person.key) + '" aria-label="Edit ' + escapeHtml(person.name) + '">Edit</button>' +
      '<button class="icon-button icon-danger" type="button" data-entry-action="remove-person" data-entry-id="' + escapeHtml(entry.id) + '" data-person-key="' + escapeHtml(person.key) + '" aria-label="Remove ' + escapeHtml(person.name) + '">Remove</button>' +
    '</div>' +
    '</li>';
}

function validateStep3() {
  clearFieldErrors();
  state.entryErrors = {};
  state.step3General = [];
  if (!state.draft.entries.length) {
    showWizardAlert('Choose at least one game before adding players.');
    return false;
  }
  const payload = buildPayload();
  const result = validateSubmission(payload, {
    games: state.config.games,
    config: rulesConfig(),
    now: serverNow(),
    ageCutoffDate: state.config.ageCutoffDate,
    requireIdFiles: true,
    requirePaymentProof: false,
    requireConsent: false
  });

  const general = [];
  result.errors.forEach((error) => {
    if (error.path.startsWith('contact.')) return;
    if (error.path === 'entries') {
      general.push(error.message);
      return;
    }
    const match = /^entries\[(\d+)\](?:\.players\[(\d+)\])?\.([A-Za-z0-9_]+)$/.exec(error.path);
    if (!match) return;
    const entry = state.draft.entries[Number(match[1])];
    if (!entry) return;
    const bucket = state.entryErrors[entry.id] || (state.entryErrors[entry.id] = { fields: {}, players: {}, messages: [] });
    if (match[2] !== undefined) {
      const personKey = entry.playerKeys[Number(match[2])];
      if (personKey) {
        bucket.players[personKey] = error.message;
        bucket.messages.push(error.message);
      }
    } else {
      bucket.fields[match[3]] = error.message;
      bucket.messages.push(error.message);
    }
  });
  state.step3General = general;
  renderEntries();

  const hasErrors = general.length || Object.keys(state.entryErrors).length;
  if (hasErrors) {
    showWizardAlert('Some player or team details still need attention.');
    const firstErrorEntry = qs('#entries-list .entry-card.has-error');
    if (firstErrorEntry) {
      firstErrorEntry.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      firstErrorEntry.querySelector('input, select, button')?.focus({ preventScroll: true });
    }
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * Person dialog
 * ------------------------------------------------------------------ */

function createEmptyPerson() {
  return {
    key: newPersonKey(),
    name: '',
    dob: '',
    idNumber: '',
    idFileKey: '',
    idFileId: '',
    idFileName: '',
    idFileType: '',
    idFileSize: 0
  };
}

function openPersonEditor(entryId, personKey) {
  const entry = entryById(entryId);
  if (!entry) return;
  const existing = personKey ? personByKey(personKey) : null;
  const person = existing ? { ...existing } : createEmptyPerson();
  state.personEditor = {
    entryId,
    personKey: personKey || '',
    isNew: !existing,
    person,
    newFileKeys: []
  };
  state.personAddAnother = false;
  const dialog = qs('#person-dialog');
  const title = qs('#person-dialog-title');
  const context = qs('#person-dialog-context');
  const game = gameFor(entry.gameId);
  const maxPlayers = Number(game && game.maxPlayers) || 1;
  if (title) {
    title.textContent = existing
      ? 'Edit player'
      : 'Add player' + ((entry.playerKeys || []).length ? ' ' + (entry.playerKeys.length + 1) : '');
  }
  if (context) {
    context.textContent = (game ? game.name : 'This entry') + ' · ' + entry.ageGroup + (entry.division ? ' · ' + entry.division : '') +
      '. This person can be reused in another game without re-entering their details.';
  }
  qs('#person-name').value = person.name || '';
  qs('#person-dob').value = person.dob || '';
  const maxDob = formatPktDate(serverNow());
  qs('#person-dob').max = maxDob;
  qs('#person-id').value = person.idNumber || '';
  qsa('#person-name-error, #person-dob-error, #person-id-error, #person-file-error').forEach((el) => { el.textContent = ''; });
  qsa('#person-dialog [aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
  const formError = qs('#person-form-error');
  if (formError) {
    formError.hidden = true;
    formError.textContent = '';
  }
  const saveAnother = qs('#person-save-another');
  if (saveAnother) saveAnother.hidden = Boolean(existing) || maxPlayers <= 1;
  updatePersonDialogFields();
  renderPersonFileArea();
  openDialog(dialog);
  window.setTimeout(() => qs('#person-name').focus(), 60);
}

function updatePersonDialogFields() {
  const editor = state.personEditor;
  if (!editor) return;
  const entry = entryById(editor.entryId);
  if (!entry) return;
  const needsId = entry.ageGroup === 'U19' || entry.ageGroup === 'U17';
  qs('#person-id-wrap').hidden = !needsId;
  qs('#person-file-wrap').hidden = !needsId;
  updatePersonAgeHint();
}

function updatePersonAgeHint() {
  const editor = state.personEditor;
  if (!editor) return;
  const entry = entryById(editor.entryId);
  const hint = qs('#person-age-hint');
  const dob = qs('#person-dob').value;
  if (!entry || !hint) return;
  if (!dob) {
    hint.textContent = entry.ageGroup === 'Open' ? 'Open entries have no age limit.' : 'We check the age against ' + formatDateLong(state.config.ageCutoffDate) + '.';
    hint.classList.remove('is-error');
    return;
  }
  const message = ageCheckMessage(qs('#person-name').value, dob, state.config.ageCutoffDate, entry.ageGroup);
  hint.textContent = message;
  hint.classList.toggle('is-error', !isDobEligible(dob, entry.ageGroup, state.config.ageCutoffDate));
}

function renderPersonFileArea() {
  const editor = state.personEditor;
  const area = qs('#person-file-area');
  if (!editor || !area) return;
  const person = editor.person;
  if (!person.idFileKey && !person.idFileId) {
    area.innerHTML =
      '<label class="file-pick">' +
      '<input id="person-file-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden>' +
      '<span class="upload-icon" aria-hidden="true">+</span>' +
      '<span class="upload-title">Choose a photo or PDF</span>' +
      '<span class="upload-hint">JPEG, PNG, WebP or PDF · max ' + MAX_FILE_MB() + ' MB</span>' +
      '</label>';
    return;
  }
  const upload = state.uploads[person.idFileKey];
  const status = person.idFileId
    ? '<span class="upload-ok">Uploaded ✓</span>'
    : upload && upload.status === 'uploading'
      ? '<span class="upload-pending">Uploading…</span>'
      : '<span class="upload-pending">Saved on this device. We will retry when you submit.</span>';
  area.innerHTML =
    '<div class="file-card">' +
      '<span class="file-icon" aria-hidden="true">' + (String(person.idFileType).indexOf('pdf') !== -1 ? 'PDF' : 'IMG') + '</span>' +
      '<div class="file-main">' +
        '<p class="file-name">' + escapeHtml(person.idFileName || 'ID document') + '</p>' +
        '<p class="file-meta">' + escapeHtml(formatBytes(person.idFileSize || 0)) + ' · ' + status + '</p>' +
      '</div>' +
      '<div class="file-actions">' +
        '<label class="link-button">Replace<input id="person-file-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden></label>' +
        '<button class="link-button danger" type="button" id="person-file-remove">Remove</button>' +
      '</div>' +
    '</div>';
}

async function handlePersonFile(file) {
  const editor = state.personEditor;
  if (!editor || !file) return;
  const fileError = qs('#person-file-error');
  if (fileError) fileError.textContent = '';
  try {
    const prepared = await prepareFile(file, MAX_FILE_BYTES());
    const key = 'id_' + newUuid();
    await putBlob(key, prepared.blob, {
      name: prepared.name,
      type: prepared.mimeType,
      size: prepared.size
    });
    if (editor.person.idFileKey) deleteBlob(editor.person.idFileKey);
    editor.person.idFileKey = key;
    editor.person.idFileId = '';
    editor.person.idFileName = prepared.name;
    editor.person.idFileType = prepared.mimeType;
    editor.person.idFileSize = prepared.size;
    editor.newFileKeys.push(key);
    state.uploads[key] = { status: 'uploading', progress: 0.05, error: '' };
    const formError = qs('#person-form-error');
    if (formError) {
      formError.hidden = true;
      formError.textContent = '';
    }
    renderPersonFileArea();
    await uploadPersonFile(editor, key);
  } catch (error) {
    if (fileError) fileError.textContent = error.message || 'This file could not be used.';
    showToast(error.message || 'This file could not be used.', 'error');
    renderPersonFileArea();
  }
}

async function uploadPersonFile(editor, key) {
  const person = editor.person;
  try {
    const stored = await getBlob(key);
    if (!stored || !stored.blob) throw new Error('The saved file is missing from this device. Choose it again.');
    const data = await blobToBase64(stored.blob);
    const result = await uploadWithRetry({
      token: state.draft.token,
      kind: 'id',
      fileName: person.idFileName,
      mimeType: person.idFileType,
      data,
      onProgress: (value) => {
        if (state.uploads[key]) state.uploads[key].progress = value;
        const status = qs('#person-file-area .upload-pending');
        if (status) status.textContent = 'Uploading… ' + Math.round(value * 100) + '%';
      }
    });
    if (!result || !result.fileId) throw new Error('The upload did not finish. Please try again.');
    person.idFileId = result.fileId;
    state.uploads[key] = { status: 'done', progress: 1, error: '' };
    if (state.draft && state.draft.people[person.key] === person) persistNow(false);
    renderPersonFileArea();
  } catch (error) {
    state.uploads[key] = { status: 'failed', progress: 0, error: error.message || 'Upload failed.' };
    renderPersonFileArea();
    if (isApiError(error) && error.code === 'NETWORK') {
      showToast('ID photo saved on this device. It will upload when you submit.', 'warning', 5000);
    } else {
      showToast(error.message || 'The ID photo could not be uploaded yet. It will retry when you submit.', 'warning', 5000);
    }
  }
}

function removePersonFile() {
  const editor = state.personEditor;
  if (!editor) return;
  const person = editor.person;
  if (person.idFileKey) deleteBlob(person.idFileKey);
  person.idFileKey = '';
  person.idFileId = '';
  person.idFileName = '';
  person.idFileType = '';
  person.idFileSize = 0;
  renderPersonFileArea();
}

function savePerson(event) {
  event.preventDefault();
  const editor = state.personEditor;
  if (!editor) return;
  const addAnother = state.personAddAnother === true;
  state.personAddAnother = false;
  const entry = entryById(editor.entryId);
  if (!entry) return;
  const person = editor.person;
  const name = cleanText_(qs('#person-name').value);
  const dob = parseDateOnly(qs('#person-dob').value);
  const idNumber = qs('#person-id').value;
  const needsId = entry.ageGroup === 'U19' || entry.ageGroup === 'U17';
  let valid = true;

  qsa('#person-name-error, #person-dob-error, #person-id-error, #person-file-error').forEach((el) => { el.textContent = ''; });
  qsa('#person-dialog [aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
  const formError = qs('#person-form-error');
  if (formError) {
    formError.hidden = true;
    formError.textContent = '';
  }

  if (!name || name.length < 2) {
    qs('#person-name-error').textContent = 'Enter the player’s full name.';
    qs('#person-name').setAttribute('aria-invalid', 'true');
    valid = false;
  }
  if (!dob) {
    qs('#person-dob-error').textContent = 'Enter a date of birth.';
    qs('#person-dob').setAttribute('aria-invalid', 'true');
    valid = false;
  } else if (dob > formatPktDate(serverNow())) {
    qs('#person-dob-error').textContent = 'Date of birth cannot be in the future.';
    qs('#person-dob').setAttribute('aria-invalid', 'true');
    valid = false;
  } else if (!isDobEligible(dob, entry.ageGroup, state.config.ageCutoffDate)) {
    qs('#person-dob-error').textContent = ageCheckMessage(name, dob, state.config.ageCutoffDate, entry.ageGroup);
    qs('#person-dob').setAttribute('aria-invalid', 'true');
    valid = false;
  }

  if (needsId) {
    if (!isValidIdNumber(idNumber)) {
      qs('#person-id-error').textContent = 'Enter the 13-digit CNIC or B-Form number.';
      qs('#person-id').setAttribute('aria-invalid', 'true');
      valid = false;
    } else {
      const normalized = normalizeIdNumber(idNumber);
      const duplicate = (entry.playerKeys || [])
        .filter((key) => key !== editor.personKey)
        .map(personByKey)
        .find((other) => other && normalizeIdNumber(other.idNumber) === normalized);
      if (duplicate) {
        qs('#person-id-error').textContent = 'This ID number is already used by ' + duplicate.name + ' in this entry.';
        qs('#person-id').setAttribute('aria-invalid', 'true');
        valid = false;
      }
    }
    if (!person.idFileKey && !person.idFileId) {
      qs('#person-file-error').textContent = 'Upload the CNIC or B-Form photo for this player.';
      valid = false;
    }
  }

  if (!valid) {
    if (formError) {
      formError.textContent = 'Check the highlighted fields.';
      formError.hidden = false;
    }
    focusFirstError(qs('#person-dialog'));
    return;
  }

  person.name = name;
  person.dob = dob;
  person.idNumber = needsId ? formatIdNumber(idNumber) : cleanText_(idNumber);
  if (!editor.isNew) {
    state.draft.people[person.key] = person;
  } else {
    state.draft.people[person.key] = person;
    if (!entry.playerKeys.includes(person.key)) entry.playerKeys.push(person.key);
  }
  if (state.entryErrors[entry.id]) {
    delete state.entryErrors[entry.id].players[person.key];
  }
  persistNow();
  renderEntries();
  renderReview();

  const game = gameFor(entry.gameId);
  const maxPlayers = Number(game && game.maxPlayers) || 1;
  const hasRoom = (entry.playerKeys || []).length < maxPlayers;
  if (addAnother && editor.isNew && hasRoom) {
    showToast('Player added. Add the next player.', 'success');
    openPersonEditor(entry.id, '');
    return;
  }

  closeDialog(qs('#person-dialog'));
  state.personEditor = null;
  showToast(editor.isNew ? 'Player added.' : 'Player updated.', 'success');
}

function closePersonDialog() {
  const editor = state.personEditor;
  if (editor) {
    editor.newFileKeys.forEach((key) => {
      const original = editor.personKey ? personByKey(editor.personKey) : null;
      if (!original || original.idFileKey !== key) {
        deleteBlob(key);
        delete state.uploads[key];
      }
    });
  }
  state.personEditor = null;
  closeDialog(qs('#person-dialog'));
}

function removePerson(entryId, personKey) {
  const entry = entryById(entryId);
  if (!entry) return;
  entry.playerKeys = (entry.playerKeys || []).filter((key) => key !== personKey);
  if (!peopleUsedElsewhere(personKey, entry.id)) {
    const person = personByKey(personKey);
    if (person && person.idFileKey) deleteBlob(person.idFileKey);
    delete state.draft.people[personKey];
  }
  if (state.entryErrors[entry.id]) delete state.entryErrors[entry.id].players[personKey];
  persistNow();
  renderEntries();
  renderReview();
  updateSelectionBar();
}

/* ------------------------------------------------------------------ *
 * People picker
 * ------------------------------------------------------------------ */

function openPeoplePicker(entryId) {
  const entry = entryById(entryId);
  if (!entry) return;
  const game = gameFor(entry.gameId);
  const maxPlayers = Number(game && game.maxPlayers) || 1;
  const slots = maxPlayers - (entry.playerKeys || []).length;
  if (slots <= 0) {
    showToast('This entry already has the maximum number of players.', 'warning');
    return;
  }
  state.peoplePicker = { entryId };
  const list = qs('#people-list');
  const context = qs('#people-dialog-context');
  const error = qs('#people-error');
  if (error) error.textContent = '';
  if (context) {
    context.textContent = 'Add people already entered in this form. They keep the same date of birth and ID. You can add ' + slots + ' more.';
  }
  const people = Object.values(state.draft.people || {}).filter((person) => !(entry.playerKeys || []).includes(person.key));
  if (!list) return;
  if (!people.length) {
    list.innerHTML = '<p class="muted">Everyone saved so far is already in this entry.</p>';
  } else {
    list.innerHTML = people.map((person) => {
      const eligible = isDobEligible(person.dob, entry.ageGroup, state.config.ageCutoffDate);
      const age = ageOnCutoff(person.dob, state.config.ageCutoffDate);
      const needsId = entry.ageGroup === 'U19' || entry.ageGroup === 'U17';
      const missingId = needsId && (!person.idNumber || (!person.idFileKey && !person.idFileId));
      return '<label class="people-row' + (eligible ? '' : ' is-disabled') + '">' +
        '<input type="checkbox" value="' + escapeHtml(person.key) + '"' + (eligible ? '' : ' disabled') + '>' +
        '<span class="people-main">' +
          '<span class="people-name">' + escapeHtml(person.name) + '</span>' +
          '<span class="people-meta">Born ' + escapeHtml(formatDateLong(person.dob)) + (age === null ? '' : ' · ' + age + ' on cutoff') + '</span>' +
          (eligible ? '' : '<span class="people-warning">Not eligible for ' + escapeHtml(entry.ageGroup) + '</span>') +
          (missingId ? '<span class="people-warning">ID details needed — you can add them next</span>' : '') +
        '</span>' +
        '</label>';
    }).join('');
  }
  openDialog(qs('#people-dialog'));
}

function addSelectedPeople(event) {
  event.preventDefault();
  const picker = state.peoplePicker;
  if (!picker) return;
  const entry = entryById(picker.entryId);
  if (!entry) return;
  const game = gameFor(entry.gameId);
  const maxPlayers = Number(game && game.maxPlayers) || 1;
  const selected = qsa('#people-list input[type="checkbox"]:checked').map((input) => input.value);
  const error = qs('#people-error');
  if (!selected.length) {
    if (error) error.textContent = 'Select at least one person, or add a new person.';
    return;
  }
  const slots = maxPlayers - (entry.playerKeys || []).length;
  if (selected.length > slots) {
    if (error) error.textContent = 'This entry only has room for ' + slots + ' more player' + (slots === 1 ? '' : 's') + '.';
    return;
  }
  selected.forEach((key) => {
    if (!entry.playerKeys.includes(key)) entry.playerKeys.push(key);
  });
  persistNow();
  closeDialog(qs('#people-dialog'));
  state.peoplePicker = null;
  renderEntries();
  renderReview();
  showToast(selected.length + (selected.length === 1 ? ' player added.' : ' players added.'), 'success');

  const needsId = entry.ageGroup === 'U19' || entry.ageGroup === 'U17';
  if (needsId) {
    const incomplete = selected.map(personByKey).find((person) => person && (!person.idNumber || (!person.idFileKey && !person.idFileId)));
    if (incomplete) {
      window.setTimeout(() => openPersonEditor(entry.id, incomplete.key), 180);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Step 4 - review, payment and submit
 * ------------------------------------------------------------------ */

function renderReview() {
  if (!state.draft || !state.config) return;
  renderReviewEntries();
  renderTotals();
  renderBank();
  renderPaymentUpload();
  renderConsent();
  const transaction = qs('#transaction-id');
  if (transaction && document.activeElement !== transaction) {
    transaction.value = state.draft.payment.transactionId || '';
  }
  updateAmountCard();
}

function renderReviewEntries() {
  const target = qs('#review-entries');
  if (!target) return;
  if (!state.draft.entries.length) {
    target.innerHTML = '<p class="muted">No entries yet.</p>';
    return;
  }
  target.innerHTML = state.draft.entries.map((entry) => {
    const game = gameFor(entry.gameId);
    if (!game) return '';
    const players = peopleInEntry(entry);
    return '<div class="review-entry">' +
      '<div class="review-entry-head">' +
        '<div>' +
          '<p class="game-category">' + escapeHtml(game.category || '') + '</p>' +
          '<h4>' + escapeHtml(game.name) + '</h4>' +
          '<p class="muted">' + escapeHtml(entry.ageGroup) + (entry.division ? ' · ' + escapeHtml(entry.division) : '') + (entry.teamName ? ' · ' + escapeHtml(entry.teamName) : '') + '</p>' +
        '</div>' +
        '<strong class="review-fee">' + escapeHtml(formatPKR(entryFee(entry))) + '</strong>' +
      '</div>' +
      '<p class="review-players">' + (players.length ? players.map((person) => escapeHtml(person.name)).join(', ') : 'No players') + '</p>' +
      '<p class="review-inst">' + escapeHtml(entry.institution || state.draft.contact.institution || '') + '</p>' +
      '</div>';
  }).join('');
}

function renderTotals() {
  const target = qs('#review-totals');
  if (!target) return;
  const totals = currentTotals();
  const rows = [];
  if (state.feeNotice) {
    rows.push('<p class="notice notice-warning">' + escapeHtml(state.feeNotice) + ' Check the new total below before paying.</p>');
  }
  if (totals.savings > 0) {
    rows.push('<div class="total-row muted"><span>Regular total</span><span class="strike">' + escapeHtml(formatPKR(totals.subtotalRegular)) + '</span></div>');
    rows.push('<div class="total-row saving"><span>Early bird saving</span><span>− ' + escapeHtml(formatPKR(totals.savings)) + '</span></div>');
  }
  rows.push('<div class="total-row total-final"><span>Total</span><span>' + escapeHtml(formatPKR(totals.netTotal)) + '</span></div>');
  target.innerHTML = rows.join('');
}

function renderBank() {
  const list = qs('#bank-list');
  if (!list || !state.config) return;
  const totals = currentTotals();
  const rawIban = String(state.config.bank.iban || '').replace(/\s+/g, '');
  const groupedIban = groupIban(rawIban);
  const rows = [
    ['Bank', state.config.bank.bankName || '', state.config.bank.bankName || ''],
    ['Account title', state.config.bank.accountTitle || '', state.config.bank.accountTitle || ''],
    ['IBAN', groupedIban, rawIban],
    ['Amount', formatPKR(totals.netTotal), formatPKR(totals.netTotal)]
  ];
  list.innerHTML = rows.map(([label, displayValue, copyValue]) =>
    '<div class="bank-row">' +
      '<dt>' + escapeHtml(label) + '</dt>' +
      '<dd><span class="bank-value">' + escapeHtml(displayValue) + '</span>' +
      '<button class="copy-button" type="button" data-copy-value="' + escapeHtml(copyValue) + '" aria-label="Copy ' + escapeHtml(label) + '">Copy</button></dd>' +
    '</div>'
  ).join('');
}

function updateAmountCard() {
  const totals = currentTotals();
  const amount = qs('#amount-value');
  const note = qs('#amount-note');
  const save = qs('#amount-save');
  if (amount) {
    countUp(amount, state.lastAmount, totals.netTotal, formatPKR, 480);
    state.lastAmount = totals.netTotal;
  }
  if (note) {
    note.textContent = effectiveState().earlyBirdActive
      ? 'Early bird price'
      : 'Regular price · early bird ended ' + formatDateLong(state.config.earlyBirdEndDate);
  }
  if (save) {
    if (totals.savings > 0) {
      save.textContent = 'You save ' + formatPKR(totals.savings) + ' with early bird.';
      save.hidden = false;
    } else {
      save.hidden = true;
    }
  }
}

function renderConsent() {
  const label = qs('#consent-label');
  const consent = qs('#consent');
  if (consent) consent.checked = Boolean(state.draft.consent);
  if (!label) return;
  const text = state.config && state.config.consentText
    ? state.config.consentText
    : "I confirm that the details are correct, every player meets the age rule for the group entered, and I have a parent or guardian's permission for any player under 18.";
  label.textContent = text;
}

function renderPaymentUpload() {
  const area = qs('#payment-upload');
  if (!area) return;
  const payment = state.draft.payment;
  if (!payment.proofFileKey && !payment.proofFileId) {
    area.innerHTML =
      '<label class="file-pick" id="payment-drop">' +
        '<input id="payment-file-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden>' +
        '<span class="upload-icon" aria-hidden="true">+</span>' +
        '<span class="upload-title">Choose a screenshot or PDF</span>' +
        '<span class="upload-hint">Bank transfer proof · max ' + MAX_FILE_MB() + ' MB after compression</span>' +
      '</label>' +
      '<p class="upload-privacy">The file is stored in a private Drive folder. Only the registration team can open it.</p>';
    return;
  }
  const upload = state.uploads[payment.proofFileKey];
  const status = payment.proofFileId
    ? '<span class="upload-ok">Uploaded ✓</span>'
    : upload && upload.status === 'uploading'
      ? '<span class="upload-pending">Uploading…</span>'
      : '<span class="upload-pending">Saved on this device. We will retry when you submit.</span>';
  area.innerHTML =
    '<div class="file-card">' +
      '<span class="file-icon" aria-hidden="true">' + (String(payment.proofFileType).indexOf('pdf') !== -1 ? 'PDF' : 'IMG') + '</span>' +
      '<div class="file-main">' +
        '<p class="file-name">' + escapeHtml(payment.proofFileName || 'Payment proof') + '</p>' +
        '<p class="file-meta">' + escapeHtml(formatBytes(payment.proofFileSize || 0)) + ' · ' + status + '</p>' +
      '</div>' +
      '<div class="file-actions">' +
        '<label class="link-button">Replace<input id="payment-file-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden></label>' +
        '<button class="link-button danger" type="button" id="payment-file-remove">Remove</button>' +
      '</div>' +
    '</div>' +
    '<div class="upload-privacy">The file is stored in a private Drive folder. Only the registration team can open it.</div>';
  if (payment.proofFileType && payment.proofFileType.indexOf('image/') === 0) {
    loadPaymentPreview(payment.proofFileKey);
  }
}

async function loadPaymentPreview(key) {
  const area = qs('#payment-upload');
  if (!area) return;
  try {
    const stored = await getBlob(key);
    if (!stored || !stored.blob) return;
    if (state.previewUrl) revokeObjectUrl(state.previewUrl);
    state.previewUrl = makeObjectUrl(stored.blob);
    const fileCard = area.querySelector('.file-card');
    if (!fileCard || !area.querySelector('.file-icon')) return;
    const image = document.createElement('img');
    image.className = 'file-thumb';
    image.alt = 'Payment proof preview';
    image.src = state.previewUrl;
    fileCard.insertBefore(image, fileCard.firstChild);
  } catch (error) {
    // A preview is a nice extra, never a blocker.
  }
}

async function handlePaymentFile(file) {
  if (!file) return;
  const error = qs('[data-error-for="payment.proofFile"]');
  if (error) error.textContent = '';
  try {
    const prepared = await prepareFile(file, MAX_FILE_BYTES());
    const oldKey = state.draft.payment.proofFileKey;
    const key = 'pay_' + newUuid();
    await putBlob(key, prepared.blob, {
      name: prepared.name,
      type: prepared.mimeType,
      size: prepared.size
    });
    if (oldKey) deleteBlob(oldKey);
    state.draft.payment = {
      ...state.draft.payment,
      proofFileKey: key,
      proofFileId: '',
      proofFileName: prepared.name,
      proofFileType: prepared.mimeType,
      proofFileSize: prepared.size
    };
    state.uploads[key] = { status: 'uploading', progress: 0.05, error: '' };
    persistNow();
    renderPaymentUpload();
    await uploadPaymentProof();
  } catch (error) {
    if (error && error.message) {
      showToast(error.message, 'error', 6000);
      const target = qs('[data-error-for="payment.proofFile"]');
      if (target) target.textContent = error.message;
    }
  }
}

async function uploadPaymentProof() {
  const payment = state.draft.payment;
  if (!payment.proofFileKey || payment.proofFileId) return;
  const key = payment.proofFileKey;
  state.uploads[key] = state.uploads[key] || { status: 'uploading', progress: 0.05, error: '' };
  state.uploads[key].status = 'uploading';
  updatePaymentUploadStatus();
  try {
    const stored = await getBlob(key);
    if (!stored || !stored.blob) throw new Error('The saved payment proof is missing from this device. Choose it again.');
    const data = await blobToBase64(stored.blob);
    const result = await uploadWithRetry({
      token: state.draft.token,
      kind: 'payment',
      fileName: payment.proofFileName,
      mimeType: payment.proofFileType,
      data,
      onProgress: (value) => {
        state.uploads[key].progress = value;
        updatePaymentUploadStatus();
      }
    });
    if (!result || !result.fileId) throw new Error('The upload did not finish. Please try again.');
    payment.proofFileId = result.fileId;
    state.uploads[key] = { status: 'done', progress: 1, error: '' };
    persistNow(false);
    renderPaymentUpload();
  } catch (error) {
    state.uploads[key] = { status: 'failed', progress: 0, error: error.message || 'Upload failed.' };
    updatePaymentUploadStatus();
    showToast(error.message || 'The payment proof could not be uploaded yet. It will retry when you submit.', 'warning', 6000);
  }
}

function updatePaymentUploadStatus() {
  const area = qs('#payment-upload');
  const payment = state.draft && state.draft.payment;
  if (!area || !payment) return;
  const upload = state.uploads[payment.proofFileKey];
  const status = area.querySelector('.file-meta');
  if (!upload || !status) return;
  if (upload.status === 'uploading') {
    status.innerHTML = escapeHtml(formatBytes(payment.proofFileSize || 0)) + ' · <span class="upload-pending">Uploading… ' + Math.round((upload.progress || 0) * 100) + '%</span>';
  } else if (upload.status === 'failed') {
    status.innerHTML = escapeHtml(formatBytes(payment.proofFileSize || 0)) + ' · <span class="upload-pending">Saved on this device. We will retry when you submit.</span>';
  }
}

function removePaymentFile() {
  const payment = state.draft.payment;
  if (payment.proofFileKey) deleteBlob(payment.proofFileKey);
  state.draft.payment = {
    ...payment,
    proofFileKey: '',
    proofFileId: '',
    proofFileName: '',
    proofFileType: '',
    proofFileSize: 0
  };
  persistNow();
  renderPaymentUpload();
}

function buildPayload() {
  const totals = currentTotals();
  return {
    token: state.draft.token,
    configLoadedAt: state.configLoadedAt,
    website: qs('#hp-website') ? qs('#hp-website').value : '',
    contact: { ...state.draft.contact },
    entries: state.draft.entries.map((entry) => ({
      gameId: entry.gameId,
      ageGroup: entry.ageGroup,
      division: entry.division,
      teamName: entry.teamName || '',
      institution: entry.institution || state.draft.contact.institution || '',
      players: peopleInEntry(entry).map((person) => ({
        personKey: person.key,
        name: person.name,
        dob: person.dob,
        idNumber: person.idNumber || '',
        idFileId: person.idFileId || '',
        idFileKey: person.idFileKey || ''
      }))
    })),
    payment: {
      proofFileId: state.draft.payment.proofFileId || '',
      proofFileKey: state.draft.payment.proofFileKey || '',
      expectedTotal: totals.netTotal,
      transactionId: state.draft.payment.transactionId || ''
    },
    consent: Boolean(state.draft.consent)
  };
}

function validateEverything() {
  clearFieldErrors();
  const result = validateSubmission(buildPayload(), {
    games: state.config.games,
    config: rulesConfig(),
    now: serverNow(),
    ageCutoffDate: state.config.ageCutoffDate,
    requireIdFiles: true,
    requirePaymentProof: true,
    requireConsent: true
  });
  if (result.ok) return true;
  applyValidation(result.errors);
  return false;
}

function applyValidation(errors) {
  clearFieldErrors();
  const contactErrors = [];
  const entryErrors = [];
  const paymentErrors = [];
  const general = [];

  errors.forEach((error) => {
    if (error.path.startsWith('contact.')) contactErrors.push(error);
    else if (error.path.startsWith('entries')) entryErrors.push(error);
    else if (error.path.startsWith('payment.') || error.path === 'consent') paymentErrors.push(error);
    else general.push(error);
  });

  if (contactErrors.length) {
    contactErrors.forEach((error) => setFieldError(error.path, error.message));
    showStep(1);
    showWizardAlert('Check the highlighted details before continuing.');
    focusFirstError(qs('#step-1'));
    return;
  }

  if (entryErrors.length) {
    state.entryErrors = {};
    state.step3General = [];
    entryErrors.forEach((error) => {
      if (error.path === 'entries') {
        state.step3General.push(error.message);
        return;
      }
      const match = /^entries\[(\d+)\](?:\.players\[(\d+)\])?\.([A-Za-z0-9_]+)$/.exec(error.path);
      if (!match) {
        general.push(error);
        return;
      }
      const entry = state.draft.entries[Number(match[1])];
      if (!entry) return;
      const bucket = state.entryErrors[entry.id] || (state.entryErrors[entry.id] = { fields: {}, players: {}, messages: [] });
      if (match[2] !== undefined) {
        const personKey = entry.playerKeys[Number(match[2])];
        if (personKey) {
          bucket.players[personKey] = error.message;
          bucket.messages.push(error.message);
        }
      } else {
        bucket.fields[match[3]] = error.message;
        bucket.messages.push(error.message);
      }
    });
    renderEntries();
    showStep(3);
    showWizardAlert('Some player or team details still need attention.');
    const first = qs('#entries-list .entry-card.has-error');
    if (first) {
      first.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      first.querySelector('input, select, button')?.focus({ preventScroll: true });
    }
    return;
  }

  if (paymentErrors.length) {
    paymentErrors.forEach((error) => {
      if (error.path === 'payment.proofFile') {
        const target = qs('[data-error-for="payment.proofFile"]');
        if (target) target.textContent = error.message;
      } else {
        setFieldError(error.path, error.message);
      }
    });
    showStep(4);
    showSubmitError('Check the payment details before submitting.');
    const upload = qs('#payment-upload');
    if (upload) upload.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    return;
  }

  showStep(4);
  showSubmitError(general.length ? general.map((error) => error.message).join(' ') : 'Please check the form and try again.');
}

function showSubmitError(message) {
  const alert = qs('#submit-error');
  if (!alert) return;
  alert.textContent = message;
  alert.hidden = false;
}

/* ------------------------------------------------------------------ *
 * Uploads and submit
 * ------------------------------------------------------------------ */

async function uploadStoredFile({ kind, blobKey, fileName, mimeType, onProgress }) {
  const stored = await getBlob(blobKey);
  if (!stored || !stored.blob) {
    throw new ApiError('FILE_INVALID', 'A saved file is missing from this device. Choose it again.');
  }
  const data = await blobToBase64(stored.blob);
  const result = await uploadWithRetry({
    token: state.draft.token,
    kind,
    fileName,
    mimeType,
    data,
    onProgress
  });
  if (!result || !result.fileId) {
    throw new ApiError('FILE_INVALID', 'An upload did not finish. Please try again.');
  }
  return result.fileId;
}

async function ensureAllUploads() {
  const jobs = [];
  const payment = state.draft.payment;
  if (payment.proofFileKey && !payment.proofFileId) {
    jobs.push({
      label: 'payment proof',
      run: async () => {
        const id = await uploadStoredFile({
          kind: 'payment',
          blobKey: payment.proofFileKey,
          fileName: payment.proofFileName,
          mimeType: payment.proofFileType
        });
        payment.proofFileId = id;
        state.uploads[payment.proofFileKey] = { status: 'done', progress: 1, error: '' };
        persistNow(false);
      }
    });
  }

  const usedKeys = new Set();
  state.draft.entries.forEach((entry) => {
    if (entry.ageGroup !== 'U19' && entry.ageGroup !== 'U17') return;
    (entry.playerKeys || []).forEach((key) => {
      const person = personByKey(key);
      if (!person || !person.idFileKey || person.idFileId || usedKeys.has(person.idFileKey)) return;
      usedKeys.add(person.idFileKey);
      jobs.push({
        label: person.name + '’s ID',
        run: async () => {
          const id = await uploadStoredFile({
            kind: 'id',
            blobKey: person.idFileKey,
            fileName: person.idFileName,
            mimeType: person.idFileType
          });
          person.idFileId = id;
          state.uploads[person.idFileKey] = { status: 'done', progress: 1, error: '' };
          persistNow(false);
        }
      });
    });
  });

  if (!jobs.length) return;
  const progress = qs('#submit-progress');
  const text = qs('#submit-progress-text');
  const bar = qs('#upload-progress-bar');
  if (progress) progress.hidden = false;
  for (let i = 0; i < jobs.length; i++) {
    if (text) text.textContent = 'Uploading ' + jobs[i].label + '… (' + (i + 1) + ' of ' + jobs.length + ')';
    if (bar) bar.style.width = Math.round((i / jobs.length) * 100) + '%';
    try {
      await jobs[i].run();
    } catch (error) {
      if (progress) progress.hidden = true;
      throw error;
    }
  }
  if (bar) bar.style.width = '100%';
  if (text) text.textContent = 'Uploads complete. Submitting…';
}

async function handleSubmit() {
  if (state.busy) return;
  clearSubmitError();
  clearWizardAlert();
  if (!state.config) {
    showSubmitError('The event details are still loading. Try again in a moment.');
    return;
  }
  if (!validateEverything()) return;
  const elapsed = Date.now() - new Date(state.configLoadedAt).getTime();
  if (elapsed < 30000) {
    showMessageDialog({
      title: 'One moment',
      bodyHtml: '<p>Please take at least 30 seconds to check your details before submitting.</p>',
      actions: [{ label: 'Back to review', style: 'secondary' }]
    });
    startCountdown();
    return;
  }

  state.busy = true;
  const button = qs('#submit-btn');
  setBusy(button, true, 'Submitting…');
  try {
    await ensureAllUploads();
    // Uploads can change file IDs, so validate once more before sending.
    const payload = buildPayload();
    const finalCheck = validateSubmission(payload, {
      games: state.config.games,
      config: rulesConfig(),
      now: serverNow(),
      ageCutoffDate: state.config.ageCutoffDate,
      requireIdFiles: true,
      requirePaymentProof: true,
      requireConsent: true
    });
    if (!finalCheck.ok) {
      applyValidation(finalCheck.errors);
      return;
    }
    const success = await submitRegistration(payload);
    handleSuccess(success);
  } catch (error) {
    handleSubmitError(error);
  } finally {
    state.busy = false;
    setBusy(button, false);
    stopCountdown();
    const progress = qs('#submit-progress');
    if (progress) progress.hidden = true;
  }
}

function handleSubmitError(error) {
  const apiError = isApiError(error) ? error : new ApiError('SERVER_ERROR', error && error.message ? error.message : 'Something went wrong.');
  const code = apiError.code;
  if (code === 'VALIDATION_FAILED') {
    applyValidation(Object.entries(apiError.fields || {}).map(([path, message]) => ({ path, message })));
    if (!Object.keys(apiError.fields || {}).length) showSubmitError(apiError.message);
    return;
  }
  if (code === 'FEE_CHANGED') {
    handleFeeChanged(apiError);
    return;
  }
  if (code === 'GAME_FULL') {
    handleGameFull(apiError);
    return;
  }
  if (code === 'FILE_INVALID') {
    handleFileInvalid(apiError);
    return;
  }
  if (code === 'RATE_LIMITED') {
    showMessageDialog({
      title: 'Too many attempts',
      bodyHtml: '<p>' + escapeHtml(apiError.message) + '</p><p>Please try again later, or contact an event head on WhatsApp.</p>',
      actions: [{ label: 'Close', style: 'secondary' }]
    });
    return;
  }
  if (code === 'BUSY') {
    showSubmitError(apiError.message + ' Press Submit again in a moment.');
    return;
  }
  if (code === 'NOT_OPEN' || code === 'CLOSED') {
    refreshConfigSilently().then(() => {
      renderLanding();
      updateStartButtons();
    });
    showMessageDialog({
      title: code === 'CLOSED' ? 'Registration is closed' : 'Registration is not open',
      bodyHtml: '<p>' + escapeHtml(apiError.message) + '</p>',
      actions: [
        { label: 'Back to event page', style: 'secondary', onClick: showLanding }
      ]
    });
    return;
  }
  if (code === 'NETWORK') {
    showSubmitError(apiError.message + ' Your draft is saved. Press Submit again when you are back online.');
    showToast('Connection problem. Your draft is safe on this device.', 'warning', 6000);
    return;
  }
  showSubmitError(apiError.message || 'Something went wrong. Please try again.');
}

async function handleFeeChanged(apiError) {
  await refreshConfigSilently();
  const entries = Array.isArray(apiError.extra.entries) ? apiError.extra.entries : [];
  state.feeOverrides = {};
  entries.forEach((item) => {
    if (!item || !item.gameId) return;
    state.feeOverrides[item.gameId] = {
      fee: Number(item.fee),
      regularFee: Number(item.regularFee)
    };
  });
  const totals = currentTotals();
  state.feeNotice = 'The event team updated the fees while you were filling the form.';
  renderAll();
  showMessageDialog({
    title: 'Fee updated',
    bodyHtml: '<p>' + escapeHtml(apiError.message) + '</p>' +
      '<p>The new total is <strong>' + escapeHtml(formatPKR(totals.netTotal)) + '</strong>. Transfer the new amount if you have not paid yet.</p>',
    actions: [
      { label: 'Review new total', style: 'primary' },
      {
        label: 'Go to payment',
        style: 'secondary',
        onClick: () => {
          showStep(4);
          qs('#bank-card')?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        }
      }
    ]
  });
  showSubmitError('The fee changed. Check the new total, then press Submit again.');
}

async function handleGameFull(apiError) {
  await refreshConfigSilently();
  renderAll();
  const gameIds = Array.isArray(apiError.extra.games) ? apiError.extra.games : [];
  const names = gameIds.map((id) => (gameFor(id) ? gameFor(id).name : id)).join(', ');
  showMessageDialog({
    title: 'Game full',
    bodyHtml: '<p>' + escapeHtml(apiError.message) + '</p>' +
      (names ? '<p><strong>' + escapeHtml(names) + '</strong> is now full.</p>' : '') +
      '<p>Remove that entry or choose another game.</p>',
    actions: [
      { label: 'Choose games', style: 'primary', onClick: () => showStep(2) },
      { label: 'Stay on review', style: 'secondary' }
    ]
  });
  showSubmitError(apiError.message);
}

function handleFileInvalid(apiError) {
  const fields = apiError.fields || {};
  const touchesPayment = Object.keys(fields).some((key) => key === 'payment' || key.startsWith('payment.'));
  const touchesIds = Object.keys(fields).some((key) => key === 'idFiles' || key.startsWith('idFiles'));
  if (touchesPayment) {
    state.draft.payment.proofFileId = '';
    if (state.draft.payment.proofFileKey) state.uploads[state.draft.payment.proofFileKey] = { status: 'failed', progress: 0, error: '' };
    renderPaymentUpload();
  }
  if (touchesIds) {
    Object.values(state.draft.people).forEach((person) => { person.idFileId = ''; });
    renderEntries();
  }
  persistNow(false);
  showSubmitError(apiError.message + ' We will retry the saved uploads when you press Submit again.');
  showMessageDialog({
    title: 'Upload problem',
    bodyHtml: '<p>' + escapeHtml(apiError.message) + '</p><p>The file is still saved on this device, so pressing Submit again will upload it again.</p>',
    actions: [{ label: 'Back to review', style: 'secondary' }]
  });
}

function handleSuccess(success) {
  const snapshot = JSON.parse(JSON.stringify(state.draft));
  state.submitted = { success, snapshot, submittedAt: new Date().toISOString() };
  clearDraft();
  clearBlobs();
  state.draft = null;
  state.feeOverrides = {};
  state.feeNotice = '';
  state.entryErrors = {};
  stopCountdown();
  renderDone();
}

/* ------------------------------------------------------------------ *
 * Done screen
 * ------------------------------------------------------------------ */

function renderDone() {
  const submitted = state.submitted;
  if (!submitted) return;
  const { success, snapshot } = submitted;
  const contact = snapshot.contact || {};
  const firstName = String(contact.name || '').trim().split(/\s+/)[0] || 'there';
  const entries = snapshot.entries || [];
  const total = Number(success.total) || 0;
  const emailFailed = success.emailStatus === 'FAILED' || success.emailStatus === 'SKIPPED';
  const contacts = state.config && state.config.contacts ? state.config.contacts : [];

  qs('#landing').hidden = true;
  qs('#wizard').hidden = true;
  qs('#help').hidden = true;
  qs('#done').hidden = false;
  qs('#header-register').hidden = true;
  document.body.classList.remove('wizard-open');
  document.title = 'Registration received · TLH Sports Fest 3.0';
  scrollToTop();

  const entriesHtml = entries.map((entry, index) => {
    const game = gameFor(entry.gameId);
    const people = (entry.playerKeys || []).map((key) => snapshot.people[key]).filter(Boolean);
    const successEntry = (success.entries || [])[index] || {};
    return '<li class="done-entry">' +
      '<div><strong>' + escapeHtml(game ? game.name : 'Game') + '</strong>' +
      '<p class="muted">' + escapeHtml(entry.ageGroup) + (entry.division ? ' · ' + escapeHtml(entry.division) : '') + (entry.teamName ? ' · ' + escapeHtml(entry.teamName) : '') + '</p>' +
      '<p class="done-players">' + escapeHtml(people.map((person) => person.name).join(', ')) + '</p></div>' +
      '<div class="done-entry-right"><span class="entry-code">' + escapeHtml(successEntry.entryId || '') + '</span>' +
      '<strong>' + escapeHtml(formatPKR(successEntry.fee || 0)) + '</strong></div>' +
      '</li>';
  }).join('');

  const contactHtml = contacts.map((contactItem) =>
    '<div class="done-contact">' +
      '<strong>' + escapeHtml(contactItem.name) + '</strong> · ' + escapeHtml(contactItem.role) +
      '<br><a href="' + escapeHtml(contactItem.tel || '#') + '">' + escapeHtml(contactItem.phone) + '</a>' +
      (contactItem.whatsapp ? ' · <a href="' + escapeHtml(contactItem.whatsapp) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') +
    '</div>'
  ).join('');

  qs('#done-content').innerHTML =
    '<div class="done-card">' +
      '<div class="done-top">' +
        '<p class="eyebrow">Registration received</p>' +
        '<h1 id="done-title">You’re in, ' + escapeHtml(firstName) + '!</h1>' +
        '<p class="done-intro">Thank you. Your registration is <strong>pending verification</strong>. ' +
          (emailFailed
            ? 'We could not send the confirmation email, but your place is saved. Keep the submission ID below.'
            : 'We emailed a confirmation to <strong>' + escapeHtml(contact.email || '') + '</strong>.') +
        '</p>' +
      '</div>' +
      '<div class="submission-id-card">' +
        '<p class="submission-id-label">Your submission ID</p>' +
        '<p class="submission-id-value">' + escapeHtml(success.submissionId) + '</p>' +
        '<button class="btn btn-secondary btn-small" type="button" id="copy-submission-id">Copy ID</button>' +
      '</div>' +
      '<div class="done-stats">' +
        '<div class="done-stat"><span>Status</span><strong>Pending verification</strong></div>' +
        '<div class="done-stat"><span>Entries</span><strong>' + entries.length + '</strong></div>' +
        '<div class="done-stat"><span>Total paid</span><strong>' + escapeHtml(formatPKR(total)) + '</strong></div>' +
      '</div>' +
      '<div class="notice notice-soft">' +
        '<strong>What happens next</strong>' +
        '<ol class="next-steps">' +
          '<li>We check your payment proof and player details by hand.</li>' +
          '<li>You get an email when your payment is verified or if we need something.</li>' +
          '<li>Keep your submission ID handy on event day.</li>' +
        '</ol>' +
      '</div>' +
      '<h2 class="section-title">Your entries</h2>' +
      '<ul class="done-entries">' + entriesHtml + '</ul>' +
      '<h2 class="section-title">Need help?</h2>' +
      '<div class="done-contacts">' + contactHtml + '</div>' +
      '<div class="done-actions">' +
        '<button class="btn btn-primary" type="button" id="another-btn">Register another team</button>' +
        '<button class="btn btn-secondary" type="button" id="print-btn">Download summary</button>' +
        '<button class="btn btn-ghost" type="button" id="done-home">Back to event page</button>' +
      '</div>' +
      '<p class="footer-note">Socials tickets are sold separately and are not included in the registration fee.</p>' +
    '</div>';

  qs('#copy-submission-id')?.addEventListener('click', async () => {
    const copied = await copyText(success.submissionId);
    showToast(copied ? 'Submission ID copied.' : 'Copy failed. Select the ID and copy it manually.', copied ? 'success' : 'warning');
  });
  qs('#another-btn')?.addEventListener('click', registerAnotherTeam);
  qs('#print-btn')?.addEventListener('click', printSummary);
  qs('#done-home')?.addEventListener('click', showLanding);
  celebrate(qs('#done-content'));
  fillPrintSummary(submitted);
}

function registerAnotherTeam() {
  const status = effectiveState();
  if (!status.registrationOpen) {
    showMessageDialog({
      title: 'Registration is closed',
      bodyHtml: '<p>You can no longer add another team. Message the event heads if you need help.</p>',
      actions: [{ label: 'OK', style: 'secondary' }]
    });
    return;
  }
  const previous = state.submitted ? state.submitted.snapshot.contact : null;
  const draft = createDraft();
  if (previous) draft.contact = { ...draft.contact, ...previous };
  draft.step = 2;
  state.draft = draft;
  state.submitted = null;
  state.configLoadedAt = new Date().toISOString();
  state.feeOverrides = {};
  state.lastAmount = 0;
  persistNow(false);
  showWizard();
  showToast('Your contact details are kept. Choose the next team’s games.', 'info', 5000);
}

function printSummary() {
  if (!state.submitted) return;
  fillPrintSummary(state.submitted);
  window.print();
}

function fillPrintSummary(submitted) {
  const target = qs('#print-summary');
  if (!target) return;
  const { success, snapshot } = submitted;
  const contact = snapshot.contact || {};
  const entries = (snapshot.entries || []).map((entry) => {
    const game = gameFor(entry.gameId);
    const people = (entry.playerKeys || []).map((key) => snapshot.people[key]).filter(Boolean);
    return '<tr><td>' + escapeHtml(game ? game.name : '') + '<br><span>' + escapeHtml(entry.ageGroup) + (entry.division ? ' · ' + escapeHtml(entry.division) : '') + (entry.teamName ? ' · ' + escapeHtml(entry.teamName) : '') + '</span></td>' +
      '<td>' + people.map((person) => escapeHtml(person.name)).join('<br>') + '</td></tr>';
  }).join('');
  target.innerHTML =
    '<div class="print-head">' +
      '<h1>TLH Sports Fest 3.0</h1>' +
      '<p>Registration summary · ' + escapeHtml(formatDateTimeLong(submitted.submittedAt)) + '</p>' +
    '</div>' +
    '<p><strong>Submission ID:</strong> ' + escapeHtml(success.submissionId) + '</p>' +
    '<p><strong>Name:</strong> ' + escapeHtml(contact.name) + '<br>' +
    '<strong>Email:</strong> ' + escapeHtml(contact.email) + '<br>' +
    '<strong>WhatsApp:</strong> ' + escapeHtml(contact.whatsapp) + '<br>' +
    '<strong>Institution:</strong> ' + escapeHtml(contact.institution) + '</p>' +
    '<table><thead><tr><th>Entry</th><th>Players</th></tr></thead><tbody>' + entries + '</tbody></table>' +
    '<p><strong>Total paid:</strong> ' + escapeHtml(formatPKR(success.total)) + '<br>' +
    '<strong>Status:</strong> Pending verification</p>' +
    '<p class="print-note">Sat 30 and Sun 31 January 2027 · TLH Canal Campus. Socials tickets are sold separately.</p>';
}

/* ------------------------------------------------------------------ *
 * Global events
 * ------------------------------------------------------------------ */

function wireGlobalEvents() {
  qs('#start-btn')?.addEventListener('click', showWizard);
  qs('#header-register')?.addEventListener('click', () => {
    if (state.submitted && !state.draft) {
      registerAnotherTeam();
      return;
    }
    showWizard();
  });
  qs('#step1-next')?.addEventListener('click', () => {
    if (validateStep1()) {
      persistNow(false);
      showStep(2);
    }
  });
  qs('#step2-next')?.addEventListener('click', () => {
    if (!state.draft.entries.length) {
      showWizardAlert('Choose at least one game to continue.');
      showToast('Choose at least one game first.', 'warning');
      qs('#games-grid')?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    persistNow(false);
    showStep(3);
  });
  qs('#step3-next')?.addEventListener('click', () => {
    if (validateStep3()) {
      persistNow(false);
      showStep(4);
    }
  });
  qs('#submit-btn')?.addEventListener('click', handleSubmit);

  qsa('[data-contact]').forEach((input) => {
    const key = input.dataset.contact;
    input.addEventListener('input', () => {
      if (!state.draft) return;
      state.draft.contact[key] = input.value;
      setFieldError('contact.' + key, '');
      persistDraft();
    });
    input.addEventListener('blur', () => {
      if (!state.draft) return;
      const errors = validateContact(state.draft.contact).filter((error) => error.path === 'contact.' + key);
      if (errors.length && input.value.trim()) setFieldError(errors[0].path, errors[0].message);
    });
  });

  qs('#game-search')?.addEventListener('input', debounce((event) => {
    gamesUi.search = event.target.value;
    renderGames();
  }, 180));
  qs('#category-tabs')?.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-category]');
    if (!tab) return;
    gamesUi.category = tab.dataset.category;
    renderGames();
  });
  qs('#games-grid')?.addEventListener('click', (event) => {
    const action = event.target.closest('[data-game-action]');
    if (!action) return;
    const gameId = action.dataset.gameId;
    if (action.dataset.gameAction === 'details') openGameDialog(gameId);
    else if (action.dataset.gameAction === 'add') addGame(gameId);
    else if (action.dataset.gameAction === 'remove') removeLastEntryForGame(gameId);
  });
  qs('#game-dialog')?.addEventListener('click', (event) => {
    const action = event.target.closest('[data-game-action="dialog-add"]');
    if (!action) return;
    addGame(action.dataset.gameId);
    closeDialog(qs('#game-dialog'));
  });

  qs('#entries-list')?.addEventListener('input', (event) => {
    const field = event.target.dataset.entryField;
    if (!field || field === 'ageGroup' || field === 'division') return;
    const entry = entryById(event.target.dataset.entryId);
    if (!entry) return;
    entry[field] = event.target.value;
    if (state.entryErrors[entry.id] && state.entryErrors[entry.id].fields[field]) {
      delete state.entryErrors[entry.id].fields[field];
      const error = event.target.parentElement.querySelector('.field-error');
      if (error) error.textContent = '';
      const card = event.target.closest('.entry-card');
      if (card && !state.entryErrors[entry.id].messages.length) card.classList.remove('has-error');
    }
    persistDraft();
  });
  qs('#entries-list')?.addEventListener('change', (event) => {
    const field = event.target.dataset.entryField;
    if (!field || (field !== 'ageGroup' && field !== 'division')) return;
    const entry = entryById(event.target.dataset.entryId);
    if (!entry) return;
    entry[field] = event.target.value;
    persistNow(false);
    renderEntries();
    renderReview();
  });
  qs('#entries-list')?.addEventListener('click', (event) => {
    const action = event.target.closest('[data-entry-action]');
    if (!action) return;
    const entryId = action.dataset.entryId;
    const personKey = action.dataset.personKey;
    switch (action.dataset.entryAction) {
      case 'choose-games':
        showStep(2);
        break;
      case 'add-person':
        openPersonEditor(entryId, '');
        break;
      case 'add-existing':
        openPeoplePicker(entryId);
        break;
      case 'edit-person':
        openPersonEditor(entryId, personKey);
        break;
      case 'remove-person':
        removePerson(entryId, personKey);
        break;
      case 'remove-entry':
        confirmRemoveEntry(entryId);
        break;
      default:
        break;
    }
  });

  qs('#person-form')?.addEventListener('submit', savePerson);
  qs('#person-save-another')?.addEventListener('click', () => {
    state.personAddAnother = true;
    qs('#person-form').requestSubmit();
  });
  qs('#person-dob')?.addEventListener('input', updatePersonAgeHint);
  qs('#person-name')?.addEventListener('input', updatePersonAgeHint);
  qs('#person-id')?.addEventListener('blur', () => {
    const value = qs('#person-id').value;
    if (isValidIdNumber(value)) qs('#person-id').value = formatIdNumber(value);
  });
  qs('#person-file-area')?.addEventListener('change', (event) => {
    if (event.target.id === 'person-file-input' && event.target.files && event.target.files[0]) {
      handlePersonFile(event.target.files[0]);
    }
  });
  qs('#person-file-area')?.addEventListener('click', (event) => {
    if (event.target.id === 'person-file-remove') removePersonFile();
  });
  qsa('[data-close-person]').forEach((button) => button.addEventListener('click', closePersonDialog));
  qs('#person-dialog')?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closePersonDialog();
  });

  qs('#people-form')?.addEventListener('submit', addSelectedPeople);
  qsa('[data-close-people]').forEach((button) => button.addEventListener('click', () => {
    state.peoplePicker = null;
    closeDialog(qs('#people-dialog'));
  }));
  qs('#people-new')?.addEventListener('click', () => {
    const picker = state.peoplePicker;
    closeDialog(qs('#people-dialog'));
    state.peoplePicker = null;
    if (picker) openPersonEditor(picker.entryId, '');
  });

  qsa('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => closeDialog(button.closest('dialog')));
  });

  qs('#payment-upload')?.addEventListener('change', (event) => {
    if (event.target.id === 'payment-file-input' && event.target.files && event.target.files[0]) {
      handlePaymentFile(event.target.files[0]);
    }
  });
  qs('#payment-upload')?.addEventListener('click', (event) => {
    if (event.target.id === 'payment-file-remove') removePaymentFile();
  });
  qs('#payment-upload')?.addEventListener('dragover', (event) => {
    if (!event.target.closest('#payment-drop')) return;
    event.preventDefault();
    event.target.closest('#payment-drop').classList.add('is-dragover');
  });
  qs('#payment-upload')?.addEventListener('dragleave', (event) => {
    const drop = event.target.closest('#payment-drop');
    if (drop) drop.classList.remove('is-dragover');
  });
  qs('#payment-upload')?.addEventListener('drop', (event) => {
    if (!event.target.closest('#payment-drop')) return;
    event.preventDefault();
    const drop = event.target.closest('#payment-drop');
    if (drop) drop.classList.remove('is-dragover');
    const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
    if (file) handlePaymentFile(file);
  });

  qs('#transaction-id')?.addEventListener('input', (event) => {
    if (!state.draft) return;
    state.draft.payment.transactionId = event.target.value;
    setFieldError('payment.transactionId', '');
    persistDraft();
  });
  qs('#consent')?.addEventListener('change', (event) => {
    if (!state.draft) return;
    state.draft.consent = event.target.checked;
    setFieldError('consent', '');
    persistDraft();
  });

  qs('#bank-list')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy-value]');
    if (!button) return;
    const copied = await copyText(button.dataset.copyValue);
    if (copied) markCopied(button);
    else showToast('Copy failed. Press and hold the value to copy it.', 'warning');
  });
  qsa('[data-action="copy-all"]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!state.config) return;
      const totals = currentTotals();
      const text = [
        'Bank: ' + (state.config.bank.bankName || ''),
        'Account title: ' + (state.config.bank.accountTitle || ''),
        'IBAN: ' + String(state.config.bank.iban || '').replace(/\s+/g, ''),
        'Amount: ' + formatPKR(totals.netTotal)
      ].join('\n');
      const copied = await copyText(text);
      showToast(copied ? 'Bank details copied.' : 'Copy failed. Press and hold the details to copy.', copied ? 'success' : 'warning');
    });
  });

  window.addEventListener('beforeunload', () => {
    if (state.draft) persistNow(false);
  });
}

function confirmRemoveEntry(entryId) {
  const entry = entryById(entryId);
  if (!entry) return;
  const game = gameFor(entry.gameId);
  showMessageDialog({
    title: 'Remove this entry?',
    bodyHtml: '<p>Remove <strong>' + escapeHtml(game ? game.name : 'this entry') + '</strong> and its players from your registration?</p>',
    actions: [
      { label: 'Keep entry', style: 'secondary' },
      {
        label: 'Remove entry',
        style: 'danger',
        onClick: () => {
          state.draft.entries = state.draft.entries.filter((item) => item.id !== entryId);
          cleanupPeopleAfterEntryRemoved(entry);
          delete state.entryErrors[entryId];
          persistNow();
          renderGames();
          renderEntries();
          renderReview();
          updateSelectionBar();
          showToast('Entry removed.', 'info');
        }
      }
    ]
  });
}

/* ------------------------------------------------------------------ *
 * Mock panel
 * ------------------------------------------------------------------ */

async function initMockPanel() {
  if (!MOCK_MODE) return;
  const panel = qs('#mock-panel');
  if (panel) panel.hidden = false;
  try {
    state.mockControls = await getMockControls();
  } catch (error) {
    state.mockControls = null;
  }
  syncMockPanel();
  panel?.addEventListener('change', async (event) => {
    const target = event.target;
    if (target.dataset.mock === 'now') {
      await setMockControls({ now: target.value });
      await applyMockRefresh();
    } else if (target.dataset.mock === 'nextError') {
      await setMockControls({ nextError: target.value });
    } else if (target.type === 'checkbox') {
      await setMockControls({ [target.dataset.mock]: target.checked });
      if (target.dataset.mock === 'offline') {
        showToast(target.checked ? 'Mock network is off. Submit will show a connection error.' : 'Mock network is back on.', 'info');
      } else {
        await applyMockRefresh();
      }
    }
  });
  qs('#mock-reset')?.addEventListener('click', async () => {
    await resetMockControls();
    state.feeOverrides = {};
    state.feeNotice = '';
    state.lastAmount = 0;
    await loadConfig({ silent: true });
    state.mockControls = await getMockControls();
    syncMockPanel();
    showToast('Mock preview reset.', 'info');
  });
}

function syncMockPanel() {
  const controls = state.mockControls;
  if (!controls) return;
  const now = qs('[data-mock="now"]');
  const nextError = qs('[data-mock="nextError"]');
  if (now) now.value = controls.now || 'real';
  if (nextError) nextError.value = controls.nextError || 'SUCCESS';
  qsa('#mock-panel input[type="checkbox"]').forEach((input) => {
    input.checked = Boolean(controls[input.dataset.mock]);
  });
}

async function applyMockRefresh() {
  state.feeOverrides = {};
  state.feeNotice = '';
  state.lastAmount = 0;
  await loadConfig({ silent: true });
  if (state.draft) {
    renderGames();
    renderEntries();
    renderReview();
  }
}

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Exposed for debugging in the browser console. Not used by the app.
window.tlhSportsFest = { state, version: APP_VERSION };
