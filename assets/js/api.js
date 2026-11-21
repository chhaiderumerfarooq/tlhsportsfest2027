/*
 * API client. Talks to the Apps Script web app, or to the offline mock when
 * USE_MOCK is true or the page is opened with ?mock=1.
 *
 * Apps Script only accepts simple requests, so every POST is sent as
 * text/plain with a JSON body.
 */

import { API_URL, USE_MOCK } from './config.js';
import { ApiError } from './errors.js';

const params = new URLSearchParams(window.location.search);
export const MOCK_MODE = USE_MOCK || params.get('mock') === '1';

const CONFIG_TIMEOUT = 25000;
const UPLOAD_TIMEOUT = 120000;
const SUBMIT_TIMEOUT = 90000;

function endpoint(action) {
  if (!API_URL) return '';
  const base = API_URL.replace(/\/+$/, '');
  return base + (base.indexOf('?') === -1 ? '?' : '&') + 'action=' + encodeURIComponent(action);
}

async function readJson(response) {
  const text = await response.text();
  if (!text) throw new ApiError('SERVER_ERROR', 'The server sent an empty reply. Please try again.');
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new ApiError('SERVER_ERROR', 'The server reply could not be read. Please try again.');
  }
  if (!data || typeof data !== 'object') {
    throw new ApiError('SERVER_ERROR', 'The server reply could not be read. Please try again.');
  }
  return data;
}

function timeoutSignal(ms) {
  if (typeof AbortController === 'undefined') return { signal: undefined, cancel: () => {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer)
  };
}

async function postJson(payload, timeoutMs) {
  if (!API_URL) {
    throw new ApiError(
      'CONFIG',
      'The registration service is not connected yet. Add the Apps Script web app URL in assets/js/config.js.'
    );
  }
  const timer = timeoutSignal(timeoutMs);
  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: timer.signal
    });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new ApiError('NETWORK', 'The server took too long to answer. Check your connection and try again.');
    }
    throw new ApiError('NETWORK', 'You appear to be offline. Check your connection and try again.');
  } finally {
    timer.cancel();
  }
  if (!response.ok) {
    throw new ApiError('NETWORK', 'The server could not be reached (error ' + response.status + '). Please try again.');
  }
  return readJson(response);
}

function raiseIfError(data) {
  if (data && data.ok) return data;
  const error = new ApiError(
    data && data.code ? data.code : 'SERVER_ERROR',
    data && data.message ? data.message : 'Something went wrong. Please try again.',
    data && data.fields ? data.fields : {},
    data || {}
  );
  if (data) {
    Object.keys(data).forEach((key) => {
      if (!(key in error.extra)) error.extra[key] = data[key];
    });
  }
  throw error;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export async function fetchConfig() {
  if (MOCK_MODE) {
    const mock = await import('./mock.js');
    return mock.mockGetConfig();
  }
  const url = endpoint('config');
  if (!url) {
    throw new ApiError(
      'CONFIG',
      'The registration service is not connected yet. Add the Apps Script web app URL in assets/js/config.js.'
    );
  }
  const timer = timeoutSignal(CONFIG_TIMEOUT);
  let response;
  try {
    response = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'follow', signal: timer.signal });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new ApiError('NETWORK', 'The event details took too long to load. Check your connection and try again.');
    }
    throw new ApiError('NETWORK', 'You appear to be offline. Check your connection and try again.');
  } finally {
    timer.cancel();
  }
  if (!response.ok) {
    throw new ApiError('NETWORK', 'The event details could not be loaded (error ' + response.status + '). Please try again.');
  }
  return raiseIfError(await readJson(response));
}

export async function uploadFile({ token, kind, fileName, mimeType, data, onProgress }) {
  if (MOCK_MODE) {
    const mock = await import('./mock.js');
    return mock.mockUpload({ token, kind, fileName, mimeType, data, onProgress });
  }
  if (onProgress) onProgress(0.08);
  const result = await postJson(
    {
      action: 'upload',
      token,
      kind,
      fileName,
      mimeType,
      data
    },
    UPLOAD_TIMEOUT
  );
  if (onProgress) onProgress(1);
  return raiseIfError(result);
}

export async function submitRegistration(payload) {
  if (MOCK_MODE) {
    const mock = await import('./mock.js');
    return mock.mockSubmit(payload);
  }
  const result = await postJson({ ...payload, action: 'submit' }, SUBMIT_TIMEOUT);
  return raiseIfError(result);
}

export async function getMockControls() {
  if (!MOCK_MODE) return null;
  const mock = await import('./mock.js');
  return mock.getMockControls();
}

export async function setMockControls(partial) {
  if (!MOCK_MODE) return null;
  const mock = await import('./mock.js');
  return mock.setMockControls(partial);
}

export async function resetMockControls() {
  if (!MOCK_MODE) return;
  const mock = await import('./mock.js');
  mock.resetMockControls();
}
