import { normalizeTimeZone } from '../../../utils/timeUtils.js';

const toBoolean = (value, fallback = false) => {
    if (value == null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const toPositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

let cachedConfig = null;

export function getDemoMeetingConfig() {
    if (cachedConfig) return cachedConfig;

    cachedConfig = Object.freeze({
        tenantId: String(process.env.MS_GRAPH_TENANT_ID || '').trim(),
        clientId: String(process.env.MS_GRAPH_CLIENT_ID || '').trim(),
        clientSecret: String(process.env.MS_GRAPH_CLIENT_SECRET || '').trim(),
        permissionMode: String(process.env.MS_GRAPH_PERMISSION_MODE || 'application').trim().toLowerCase(),
        organizerEmail: String(process.env.MS_GRAPH_ORGANIZER_EMAIL || '').trim().toLowerCase(),
        baseUrl: String(process.env.MS_GRAPH_BASE_URL || 'https://graph.microsoft.com/v1.0').trim().replace(/\/+$/, ''),
        scope: String(process.env.MS_GRAPH_SCOPE || 'https://graph.microsoft.com/.default').trim(),
        defaultTimezone: normalizeTimeZone(process.env.DEMO_MEETING_DEFAULT_TIMEZONE || 'UTC'),
        allowOnlineFallback: toBoolean(process.env.DEMO_MEETING_ALLOW_ONLINE_FALLBACK, true),
        minDurationMinutes: toPositiveInteger(process.env.DEMO_MEETING_MIN_DURATION_MINUTES, 15),
        maxDurationMinutes: toPositiveInteger(process.env.DEMO_MEETING_MAX_DURATION_MINUTES, 120),
    });

    return cachedConfig;
}

export function resetDemoMeetingConfigForTests() {
    cachedConfig = null;
}

