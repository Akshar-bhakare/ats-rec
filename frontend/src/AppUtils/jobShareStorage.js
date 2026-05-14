const SHARE_SUBMISSIONS_KEY = 'jobShareSubmissions';

const allowedQueryParams = ['token', 'jobId', 'jobSharer', 'defaultSource', 'source'];

const getStore = () => {
    if (typeof window === 'undefined' || !window?.localStorage) return null;
    return window.localStorage;
};

const safeParse = (value, fallback) => {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch (err) {
        console.warn('Failed to parse localStorage payload', err);
        return fallback;
    }
};

const readArray = (key) => {
    const store = getStore();
    if (!store) return [];
    return safeParse(store.getItem(key), []);
};

const writeArray = (key, value) => {
    const store = getStore();
    if (!store) return;
    store.setItem(key, JSON.stringify(value));
};

const safeStr = (value) => {
    if (value === undefined || value === null) return '';
    return String(value)
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f<>]/g, '')
        .trim();
};

const pickAllowed = (obj = {}, whitelist = []) =>
    whitelist.reduce((acc, key) => {
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
            acc[key] = safeStr(obj[key]);
        }
        return acc;
    }, {});

const base64Encode = (value) => {
    if (typeof window === 'undefined') {
        // eslint-disable-next-line no-undef
        return Buffer.from(value, 'utf-8').toString('base64');
    }
    if (typeof TextEncoder !== 'undefined') {
        const bytes = new TextEncoder().encode(value);
        let binary = '';
        bytes.forEach((b) => {
            binary += String.fromCharCode(b);
        });
        return window.btoa(binary);
    }
    return window.btoa(unescape(encodeURIComponent(value)));
};

const base64Decode = (value) => {
    if (typeof window === 'undefined') {
        // eslint-disable-next-line no-undef
        return Buffer.from(value, 'base64').toString('utf-8');
    }
    const binary = window.atob(value);
    if (typeof TextDecoder !== 'undefined') {
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(escape(binary));
};

const base64UrlEncode = (input) =>
    base64Encode(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const base64UrlDecode = (input) => {
    let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return base64Decode(base64);
};

const encodeShareToken = (payload) => base64UrlEncode(JSON.stringify(payload));
const decodeShareToken = (token) => JSON.parse(base64UrlDecode(token));

/** Normalize a decoded token to a consistent shape, supporting both old (full) and new (slim) formats. */
const normalizeDecodedToken = (decoded) => {
    // New slim format uses abbreviated keys: j, e, d
    if (decoded.j) {
        return {
            jobId: decoded.j,
            sharerEmail: decoded.e || '',
            defaultSource: decoded.d || 'Custom',
        };
    }
    // Old format has full keys
    return {
        jobId: decoded.jobId || '',
        sharerEmail: decoded.jobSharer?.email || '',
        defaultSource: decoded.defaultSource || 'Custom',
        // Carry forward display fields from old tokens for backward compat
        jobTitle: decoded.jobTitle,
        companyName: decoded.companyName,
        jobSnippet: decoded.jobSnippet,
        jobSharer: decoded.jobSharer,
        _isLegacy: true,
    };
};

const buildShareUrl = (token) => {
    if (!token) return '';
    if (typeof window === 'undefined') return `/share/upload/?token=${encodeURIComponent(token)}`;
    const origin = window.location?.origin || '';
    return `${origin}/share/upload/?token=${encodeURIComponent(token)}`;
};

const sanitizeSharer = (sharer = {}) => ({
    id: safeStr(sharer?._id || sharer?.id),
    name:
        safeStr(
            sharer?.fullName ||
            [sharer?.firstName, sharer?.lastName].filter(Boolean).join(' ') ||
            sharer?.name ||
            sharer?.email ||
            'Hiring Team'
        ) || 'Hiring Team',
    role: safeStr(sharer?.role),
    email: safeStr(sharer?.email),
});

const sanitizeJobSnippet = (job) => {
    const base =
        job?.description ||
        job?.summary ||
        job?.notes ||
        job?.jobObjective ||
        job?.title ||
        '';
    const cleaned = safeStr(base).replace(/\s+/g, ' ');
    return cleaned.slice(0, 280);
};

// eslint-disable-next-line no-unused-vars
const sanitizeLinkRecord = (record = {}) => ({
    token: safeStr(record.token),
    jobId: safeStr(record.jobId),
    jobTitle: safeStr(record.jobTitle) || 'Job opening',
    companyName: safeStr(record.companyName),
    jobSnippet: safeStr(record.jobSnippet),
    jobSharer: sanitizeSharer(record.jobSharer),
    defaultSource: safeStr(record.defaultSource) || 'Custom',
    createdAt: safeStr(record.createdAt),
});

export const sanitizeShareParams = (query = {}) =>
    pickAllowed(query, allowedQueryParams);

export const createShareLinkRecord = ({ job, sharer = {}, defaultSource = 'LinkedIn' }) => {
    if (!job?._id) throw new Error('Missing job details to create share link.');

    const sharerObj = sanitizeSharer(sharer);

    // Slim payload: only essential identifiers with abbreviated keys
    const slimPayload = {
        j: safeStr(job._id),
        e: safeStr(sharerObj.email),
        d: safeStr(defaultSource) || 'Custom',
    };

    const token = encodeShareToken(slimPayload);

    return {
        jobId: slimPayload.j,
        sharerEmail: slimPayload.e,
        defaultSource: slimPayload.d,
        // Keep display fields from caller context (not encoded in URL)
        jobTitle: job.title || 'Job opening',
        companyName: job?.company?.name || job?.company || '',
        jobSharer: sharerObj,
        token,
        shareUrl: buildShareUrl(token),
    };
};

export const verifyShareRequest = (rawParams = {}) => {
    const params = sanitizeShareParams(rawParams);
    const token = params.token;
    if (!token) {
        return { status: 'error', reason: 'missing_token' };
    }
    try {
        const raw = decodeShareToken(token);
        const normalized = normalizeDecodedToken(raw);
        if (!normalized.jobId) {
            return { status: 'error', reason: 'token_missing_job' };
        }
        if (params.jobId && params.jobId !== normalized.jobId) {
            return { status: 'error', reason: 'job_mismatch' };
        }
        return { status: 'ok', link: normalized, params };
    } catch (err) {
        console.error('Failed to decode share token', err);
        return { status: 'error', reason: 'invalid_token' };
    }
};

/** Fetch full job context from the backend (used by the candidate upload page). */
export const fetchShareContext = async (jobId, sharerEmail, fetchFn) => {
    const url = `/api/candidates/job/social/share/context/${encodeURIComponent(jobId)}?email=${encodeURIComponent(sharerEmail)}`;
    const fetcher = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetcher) throw new Error('No fetch function available');
    const res = await fetcher(url);
    if (!res.ok) throw new Error(`Failed to fetch share context: ${res.status}`);
    return res.json();
};

export const storeCandidateSubmission = ({ token, payload, id }) => {
    if (!token) throw new Error('Missing submission token.');
    const submissions = readArray(SHARE_SUBMISSIONS_KEY);
    const entry = {
        id,
        token: safeStr(token),
        payload: payload,
        createdAt: new Date().toISOString(),
    };
    submissions.push(entry);
    writeArray(SHARE_SUBMISSIONS_KEY, submissions);
    return entry;
};

export const getSubmissionsForToken = (token) =>
    readArray(SHARE_SUBMISSIONS_KEY).filter((entry) => entry.token === safeStr(token));

export const getSubmissionsForJob = (jobId) =>
    readArray(SHARE_SUBMISSIONS_KEY).filter((entry) => {
        try {
            const payload = decodeShareToken(entry.token);
            return payload.jobId === safeStr(jobId);
        } catch {
            return false;
        }
    });

export const __internal = {
    safeStr,
    buildShareUrl,
    sanitizeSharer,
    sanitizeJobSnippet,
    encodeShareToken,
    decodeShareToken,
    normalizeDecodedToken,
};
