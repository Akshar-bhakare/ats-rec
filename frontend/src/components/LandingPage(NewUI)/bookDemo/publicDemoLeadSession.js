const STORAGE_KEY = 'hirexit_public_demo_lead_session_v1';

const isBrowser = () => typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

const normalizeString = (value) => String(value || '').trim();

const sanitizeLeadForm = (leadForm = {}) => ({
    firstName: normalizeString(leadForm.firstName),
    lastName: normalizeString(leadForm.lastName),
    mobile: normalizeString(leadForm.mobile),
    countryCode: normalizeString(leadForm.countryCode || '+91'),
    email: normalizeString(leadForm.email).toLowerCase(),
    company: normalizeString(leadForm.company),
    terms: Boolean(leadForm.terms),
});

export const buildVerifiedLeadSession = ({ leadForm, sourceFlow, verifiedAt = null }) => {
    const sanitizedLeadForm = sanitizeLeadForm(leadForm);

    return {
        sourceFlow: normalizeString(sourceFlow || 'book-demo'),
        verifiedAt: verifiedAt || new Date().toISOString(),
        leadForm: sanitizedLeadForm,
        candidateName: `${sanitizedLeadForm.firstName} ${sanitizedLeadForm.lastName}`.trim(),
        candidateEmail: sanitizedLeadForm.email,
    };
};

export const getPublicDemoLeadSession = () => {
    if (!isBrowser()) {
        return null;
    }

    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);
        if (!parsed?.leadForm?.email) {
            return null;
        }

        return buildVerifiedLeadSession({
            leadForm: parsed.leadForm,
            sourceFlow: parsed.sourceFlow,
            verifiedAt: parsed.verifiedAt,
        });
    } catch (error) {
        console.error('Failed to parse public demo lead session:', error);
        return null;
    }
};

export const setPublicDemoLeadSession = (session) => {
    if (!isBrowser()) {
        return null;
    }

    const payload = buildVerifiedLeadSession(session);

    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.error('Failed to store public demo lead session:', error);
    }

    return payload;
};

export const clearPublicDemoLeadSession = () => {
    if (!isBrowser()) {
        return;
    }

    try {
        window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear public demo lead session:', error);
    }
};
