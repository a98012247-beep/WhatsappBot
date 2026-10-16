// Robust API helper with retry logic and sensible timeouts (2026-10-14).
// Use this for all external API calls to handle flaky networks gracefully.

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RETRIES = 2;

/**
 * Fetch JSON with retry and timeout.
 * @param {string} url
 * @param {object} opts - { timeout, retries, headers }
 * @returns {Promise<any>} parsed JSON
 */
export async function fetchJsonRetry(url, opts = {}) {
  const timeout = opts.timeout || DEFAULT_TIMEOUT;
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const headers = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)', ...(opts.headers || {}) };

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        // Exponential backoff: 1s, 2s
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

/**
 * Fetch text with retry and timeout.
 */
export async function fetchTextRetry(url, opts = {}) {
  const timeout = opts.timeout || DEFAULT_TIMEOUT;
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const headers = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)', ...(opts.headers || {}) };

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

export default { fetchJsonRetry, fetchTextRetry };
