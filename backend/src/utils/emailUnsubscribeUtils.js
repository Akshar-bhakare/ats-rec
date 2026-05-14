import crypto from 'crypto';

const DEFAULT_TOKEN_TTL_DAYS = 3650;

const base64UrlEncode = (input) =>
    Buffer.from(String(input || ''), 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

const base64UrlDecode = (input) => {
    const raw = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
};

const getUnsubscribeSecret = () =>
    process.env.EMAIL_UNSUBSCRIBE_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    'aiselekt-email-unsubscribe-secret';

const signPayload = (encodedPayload) =>
    crypto
        .createHmac('sha256', getUnsubscribeSecret())
        .update(String(encodedPayload || ''))
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

export const getFrontendOriginForEmails = () => {
    const explicit =
        process.env.FRONTEND_ORIGIN ||
        process.env.WEB_ORIGIN ||
        process.env.APP_ORIGIN;
    if (explicit) return String(explicit).replace(/\/+$/, '');

    const backendOrigin = process.env.BACKEND_ORIGIN;
    if (backendOrigin) {
        try {
            const parsed = new URL(backendOrigin);
            if (parsed.port === '8080') parsed.port = '3000';
            return parsed.origin.replace(/\/+$/, '');
        } catch {
            // fall through
        }
    }

    return 'https://hirexit.ai';
};

export const createEmailUnsubscribeToken = ({
    email,
    dbName,
    clientId = null,
    ttlDays = DEFAULT_TOKEN_TTL_DAYS,
}) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedDbName = String(dbName || '').trim();
    if (!normalizedEmail || !normalizedDbName) return null;

    const now = Date.now();
    const payload = {
        email: normalizedEmail,
        dbName: normalizedDbName,
        clientId: clientId ? String(clientId) : null,
        iat: now,
        exp: now + Number(ttlDays || DEFAULT_TOKEN_TTL_DAYS) * 24 * 60 * 60 * 1000,
        v: 1,
    };

    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = signPayload(encodedPayload);
    return `${encodedPayload}.${signature}`;
};

export const verifyEmailUnsubscribeToken = (token) => {
    const raw = String(token || '').trim();
    if (!raw.includes('.')) {
        throw new Error('Invalid unsubscribe token');
    }

    const [encodedPayload, signature] = raw.split('.');
    const expectedSignature = signPayload(encodedPayload);
    if (signature !== expectedSignature) {
        throw new Error('Invalid unsubscribe token signature');
    }

    let parsed;
    try {
        parsed = JSON.parse(base64UrlDecode(encodedPayload));
    } catch {
        throw new Error('Invalid unsubscribe token payload');
    }

    const email = String(parsed?.email || '').trim().toLowerCase();
    const dbName = String(parsed?.dbName || '').trim();
    const exp = Number(parsed?.exp || 0);
    const now = Date.now();
    if (!email || !dbName || !exp || now > exp) {
        throw new Error('Unsubscribe link is invalid or expired');
    }

    return {
        email,
        dbName,
        clientId: parsed?.clientId ? String(parsed.clientId) : null,
        iat: Number(parsed?.iat || 0),
        exp,
    };
};

export const maskEmailForDisplay = (email) => {
    const normalized = String(email || '').trim().toLowerCase();
    const [localPart, domainPart] = normalized.split('@');
    if (!localPart || !domainPart) return normalized;
    if (localPart.length <= 2) return `${localPart[0] || '*'}*@${domainPart}`;
    const start = localPart.slice(0, 2);
    return `${start}${'*'.repeat(Math.max(1, localPart.length - 2))}@${domainPart}`;
};

export const EMAIL_UNSUBSCRIBE_REASONS = Object.freeze([
    'I receive too many emails',
    'The emails are not relevant to me',
    'I no longer use this service',
    'I did not sign up for these emails',
    'Other',
]);

