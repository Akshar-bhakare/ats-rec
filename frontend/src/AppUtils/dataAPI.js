// frontend/src/AppUtils/dataAPI.js

/**
 * Read a cookie by name from document.cookie
 * @param {string} name
 * @returns {string|null}
 */
export function getCookie(name) {
    const nameEQ = name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=';
    return document.cookie
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith(nameEQ))
        ?.substring(nameEQ.length) ?? null;
}

/**
 * A drop-in fetch wrapper that:
 *  - always includes cookies
 *  - auto-attaches JWT + CSRF headers
 *  - stringifies JSON bodies
 *  - throws on HTTP errors
 *
 * @param {string} url
 * @param {object} [options]
 * @param {object} [options.headers]
 * @param {'GET'|'POST'|...} [options.method]
 * @param {object} [options.body]  // this will be JSON-stringified
 */
export async function fetchData(url, options = {}) {
    const {
        body,
        headers: userHeaders = {},
        method = 'GET',
        ...rest
    } = options;

    const jwt = getCookie('token') || localStorage.getItem('token');
    const csrfToken = getCookie('csrftoken');
    const clientTimezone = getClientTimeZone();
    const clientTimezoneOffset = String(new Date().getTimezoneOffset());

    // detect FormData so we don't override Content-Type
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    const hasHeader = (headers, name) =>
        Object.keys(headers || {}).some(
            (key) => key.toLowerCase() === String(name || '').toLowerCase()
        );

    // build headers: userHeaders first so we can override auth if needed
    const headers = {
        ...userHeaders,
        // only JSON-stringify non-FormData bodies
        ...(body != null && !isFormData && { 'Content-Type': 'application/json' }),
        ...(jwt && { Authorization: `Bearer ${jwt}` }),
        ...(csrfToken && { 'x-csrf-token': csrfToken }),
        ...(clientTimezone && !hasHeader(userHeaders, 'x-timezone') && { 'x-timezone': clientTimezone }),
        ...(!hasHeader(userHeaders, 'x-timezone-offset') && { 'x-timezone-offset': clientTimezoneOffset })
    };

    // assemble fetch init
    const init = {
        method,
        credentials: 'include',
        headers,
        ...rest
    };

    // attach body
    if (body != null) {
        init.body = isFormData || typeof body === 'string' ? body : JSON.stringify(body);
    }

    let res = await fetch(url, init);

    let resOutput;

    const contentType = res.headers.get('Content-Type') || '';

    if (contentType.includes('application/pdf')) {
        return await res.blob();
    }

    if (contentType.includes('application/json')) {
        resOutput = await res.json();

    } else if (
        contentType.includes('application/pdf') ||
        contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        resOutput = await res.blob();

    } else {
        resOutput = await res.text();

    }

    if (!res.ok) {
        throw resOutput || res;
    }

    return resOutput;
}

export function getClientTimeZone() {
    const cached = localStorage.getItem('client_timezone');
    if (cached) return cached;
    const tz =
        Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone ||
        'UTC';
    try {
        localStorage.setItem('client_timezone', tz);
    } catch (err) {
        // ignore storage errors
        console.error('Failed to set client timezone in localStorage:', err);
    }
    return tz;
}

/**
 * Utilites for Deploy-Safe fetching
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (err) => {
    // Check if it is a fetch error (network) or a 5xx response
    const status = err?.status || err?.code;

    // 5xx Server Errors
    if (typeof status === 'number' && status >= 500 && status < 600) return true;

    // Network errors (often have no status or specific messages)
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('upstream') || status === 'ECONNRESET') {
        return true;
    }

    return false;
};

/**
 * Wrapper to retry requests during deployments/restarts
 * @param {string} operationName - Name for logging
 * @param {Function} fetchFn - Async function to execute
 * @param {Function|null} setUiState - Context setter for loading messages (optional)
 * @param {string} loadingMessageBase - Message to show during retry (optional)
 */
export async function performDeploySafeFetch(operationName, fetchFn, setUiState = null, loadingMessageBase = '') {
    const MAX_RETRIES = 10;
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0 && setUiState && loadingMessageBase) {
                setUiState({
                    loadingMsg: `${loadingMessageBase} (Retrying ${attempt}/${MAX_RETRIES} due to server update)...`
                });
            } else if (setUiState && loadingMessageBase) {
                setUiState({ loadingMsg: `${loadingMessageBase}...` });
            }

            return await fetchFn();

        } catch (err) {
            lastError = err;
            if (!isRetryableError(err)) {
                throw err;
            }

            if (attempt === MAX_RETRIES - 1) {
                break;
            }

            const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s...
            console.warn(`[DeploySafe] ${operationName} failed (Attempt ${attempt + 1}). Retrying in ${delay / 1000}s...`, err);
            await wait(delay);
        }
    }
    throw lastError;
}
