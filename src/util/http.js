// Centralised JSON-GET helper with timeout. Wraps the global `fetch` with
// an AbortController so a slow upstream can't hang the polling loop forever.

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * GET a URL and parse the response as JSON. Throws on non-2xx, malformed
 * JSON, or timeout. The error message includes the URL and (for non-2xx) a
 * truncated response body — useful for log diagnostics, never logs anything
 * we wouldn't already see in the URL.
 *
 * @param {string|URL} url
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.headers]
 * @param {number} [opts.timeoutMs] - Per-request timeout. Default 10s.
 * @returns {Promise<any>}
 */
export async function fetchJson(url, { headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { headers, signal: ctrl.signal });
  } catch (err) {
    // AbortError is the timeout case; surface a clear message.
    if (err && err.name === 'AbortError') {
      throw new Error(`Timeout after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`);
  }
  try {
    return await res.json();
  } catch (err) {
    throw new Error(`Invalid JSON from ${url}: ${err.message}`);
  }
}
