/*
 * TLH Sports Fest 3.0 - frontend configuration.
 *
 * API_URL is the only place the web app URL lives. Paste the /exec URL from
 * Apps Script between the quotes, then set USE_MOCK to false.
 *
 * While USE_MOCK is true (or the page is opened with ?mock=1) the whole site
 * runs offline with a simulated backend. Use ?mock=1 to force preview mode.
 */

export const API_URL = 'https://script.google.com/macros/s/AKfycbzjtocV9rjjufVoslgTH-OtnGonNaSjzM4P4HjoSXB_/exec';

export const USE_MOCK = false;

export const APP_VERSION = '3.0.0';

export const MOCK_LATENCY_MS = 420;
