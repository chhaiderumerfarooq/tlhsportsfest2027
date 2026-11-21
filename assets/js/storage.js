/*
 * Local draft storage: text in localStorage, file blobs in IndexedDB.
 * Nothing is sent to a server until the person presses Submit.
 */

const DRAFT_KEY = 'tlhsf3_draft_v1';
const CONFIG_KEY = 'tlhsf3_config_v1';
const DB_NAME = 'tlhsf3_files_v1';
const STORE = 'files';

function readJson(key) {
  try {
    const text = localStorage.getItem(key);
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

export function loadDraft() {
  const draft = readJson(DRAFT_KEY);
  if (!draft || typeof draft !== 'object') return null;
  if (!draft.token || !draft.contact || !Array.isArray(draft.entries)) return null;
  return draft;
}

export function saveDraft(draft) {
  return writeJson(DRAFT_KEY, draft);
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    // Ignore storage failures.
  }
}

export function loadConfigCache(mode) {
  const cached = readJson(CONFIG_KEY);
  if (!cached || !cached.config || !Array.isArray(cached.config.games)) return null;
  if (mode && cached.mode && cached.mode !== mode) return null;
  return cached;
}

export function saveConfigCache(config, mode) {
  return writeJson(CONFIG_KEY, {
    config,
    mode: mode || 'live',
    fetchedAt: Date.now(),
    localTime: Date.now()
  });
}

export function clearConfigCache() {
  try {
    localStorage.removeItem(CONFIG_KEY);
  } catch (error) {
    // Ignore.
  }
}

export function newUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
}

export function newPersonKey() {
  return 'p_' + newUuid();
}

export function debounce(fn, wait) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* ------------------------------------------------------------------ *
 * IndexedDB file store
 * ------------------------------------------------------------------ */

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local file storage.'));
    request.onblocked = () => reject(new Error('Local file storage is blocked. Close other tabs and try again.'));
  });
}

export async function putBlob(key, blob, meta) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ blob, meta: meta || {} }, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error('Could not save the file on this device.'));
    tx.onabort = () => reject(tx.error || new Error('Could not save the file on this device.'));
  });
}

export async function getBlob(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Could not read the saved file.'));
  });
}

export async function deleteBlob(key) {
  if (!key) return;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    // Orphaned blobs are cleaned when the draft is cleared.
  }
}

export async function clearBlobs() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    // Ignore.
  }
}
