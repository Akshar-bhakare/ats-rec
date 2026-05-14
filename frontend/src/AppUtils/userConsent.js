export const COOKIE_CONSENT_STORAGE_KEY = 'aiselekt_cookie_consent_v1';
export const COOKIE_CONSENT_VERSION = 2;

export const COOKIE_CATEGORIES = Object.freeze({
    ESSENTIAL: 'essential',
});

export const DEFAULT_COOKIE_PREFERENCES = Object.freeze({
    [COOKIE_CATEGORIES.ESSENTIAL]: true,
});

export const normalizeCookiePreferences = () => ({
    [COOKIE_CATEGORIES.ESSENTIAL]: true,
});

export const readCookieConsent = () => {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const parsedVersion = Number(parsed.version);
        if (!Number.isFinite(parsedVersion) || parsedVersion !== COOKIE_CONSENT_VERSION) {
            return null;
        }

        return {
            version: parsedVersion,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
            source: typeof parsed.source === 'string' ? parsed.source : 'saved_preferences',
            preferences: normalizeCookiePreferences(parsed.preferences),
        };
    } catch {
        return null;
    }
};

export const writeCookieConsent = ({ preferences, source = 'saved_preferences' }) => {
    if (typeof window === 'undefined') return null;

    const payload = {
        version: COOKIE_CONSENT_VERSION,
        updatedAt: new Date().toISOString(),
        source,
        preferences: normalizeCookiePreferences(preferences),
    };

    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(payload));
    window.__aiselektCookieConsent = payload;
    window.dispatchEvent(
        new CustomEvent('aiselekt-cookie-consent-changed', {
            detail: payload,
        }),
    );

    return payload;
};

export const clearCookieConsent = () => {
    if (typeof window === 'undefined') return null;

    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    window.__aiselektCookieConsent = null;
    window.dispatchEvent(
        new CustomEvent('aiselekt-cookie-consent-changed', {
            detail: null,
        }),
    );

    return null;
};

export const hasCookieConsentDecision = () => Boolean(readCookieConsent());

export const isCookieCategoryAllowed = (category) => {
    return category === COOKIE_CATEGORIES.ESSENTIAL;
};
