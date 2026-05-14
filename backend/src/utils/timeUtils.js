import dotenv from 'dotenv';

dotenv.config();

/**
 * TEMPORARY (TESTING):
 * Always allow calling hours, regardless of IST time.
 *
 * This bypasses the 8 AM – 8 PM IST restriction so that
 * AiCallManager.init() and scheduling logic will NOT block calls.
 *
 * ⚠ WARNING: Do NOT keep this in production.
 */
export function isAllowedCallingHourIST() {
    return true;

    // // Previous production logic (kept here for reference):

    // if (['development', 'local']?.includes(process?.env?.NODE_ENV)) {
    //     return true;
    // }
    // const now = new Date();
    // const nowIST = new Date(
    //     now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    // );
    // const hour = nowIST.getHours();
    // // 8 AM to 8 PM IST
    // return hour >= 8 && hour < 20;
}

/**
 * Get the equivalent IST Date object for a given datetime string or Date.
 * This is still useful for logs / schedule display and does NOT affect the call restriction anymore.
 */
export const getISTTime = (dateTimeStr = null) => {
    const original = dateTimeStr instanceof Date
        ? dateTimeStr
        : dateTimeStr
            ? new Date(dateTimeStr)
            : new Date();

    const istString = original.toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
    });

    return new Date(istString);
};

export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata';

export function normalizeTimeZone(timeZone, fallback = DEFAULT_TIMEZONE) {
    const candidates = [timeZone, fallback, DEFAULT_TIMEZONE, 'UTC'];
    for (const tz of candidates) {
        if (!tz) continue;
        try {
            Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
            return tz;
        } catch (err) {
            continue;
        }
    }
    return 'UTC';
}

export function getRequestTimeZone(req, fallback = DEFAULT_TIMEZONE) {
    const headers = req?.headers || {};
    const tz =
        headers['x-timezone'] ||
        headers['x-time-zone'] ||
        headers['x-client-timezone'] ||
        headers['x-client-time-zone'] ||
        headers['timezone'];
    return normalizeTimeZone(tz, fallback);
}

export function getTimeZoneOffsetMs(timeZone, date) {
    const tz = normalizeTimeZone(timeZone);
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const parts = dtf.formatToParts(date);
    const values = {};
    for (const part of parts) {
        if (part.type !== 'literal') values[part.type] = part.value;
    }
    const asUtc = new Date(
        `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}Z`
    );
    return asUtc.getTime() - date.getTime();
}

export function localDateTimeToUtc(dateStr, timeStr, timeZone) {
    const tz = normalizeTimeZone(timeZone);
    const [y, m, d] = String(dateStr || '').split('-').map(Number);
    const [hh, mm, ss = '0'] = String(timeStr || '').split(':');
    const H = Number(hh);
    const M = Number(mm);
    const S = Number(ss);
    if (!y || !m || !d || Number.isNaN(H) || Number.isNaN(M) || Number.isNaN(S)) {
        return new Date(NaN);
    }
    const utcDate = new Date(Date.UTC(y, m - 1, d, H, M, S, 0));
    const offsetMs = getTimeZoneOffsetMs(tz, utcDate);
    return new Date(utcDate.getTime() - offsetMs);
}
