import axios from 'axios';
import { localDateTimeToUtc } from '../../../utils/timeUtils.js';
import { ErrorCodes, createDemoMeetingError } from '../utils/demoMeetingErrors.js';

const extractRequestId = (headers = {}) =>
    headers['request-id'] ||
    headers['client-request-id'] ||
    headers['x-ms-request-id'] ||
    null;

const normalizeGraphErrorMessage = (error, fallback) =>
    error?.response?.data?.error?.message ||
    error?.response?.data?.error_description ||
    error?.message ||
    fallback;

const formatGraphDateTime = (date, timeZone) => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const parts = {};
    for (const part of formatter.formatToParts(date)) {
        if (part.type !== 'literal') parts[part.type] = part.value;
    }

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
};

const parseGraphDateTime = (value = {}, fallbackTimeZone) => {
    const dateTime = String(value?.dateTime || '').trim();
    if (!dateTime) return new Date(NaN);
    const [datePart, rawTimePart = '00:00:00'] = dateTime.replace(/Z$/i, '').split('T');
    const timePart = rawTimePart.split('.')[0] || '00:00:00';
    return localDateTimeToUtc(datePart, timePart, value?.timeZone || fallbackTimeZone);
};

const hasOverlap = (itemStart, itemEnd, requestedStart, requestedEnd) =>
    itemStart < requestedEnd && itemEnd > requestedStart;

const shouldRetryWithoutOnlineMeeting = (error) => {
    const status = Number(error?.statusCode || error?.response?.status || 0);
    const message = String(error?.message || '').toLowerCase();
    return (
        status === 400 &&
        (
            message.includes('online meeting') ||
            message.includes('teamsforbusiness') ||
            message.includes('allowedonlinemeetingproviders') ||
            message.includes('isonlinemeeting') ||
            message.includes('onlinemeetingprovider')
        )
    );
};

export function extractSafeProviderSummary(event = {}) {
    return {
        id: event.id || null,
        changeKey: event.changeKey || null,
        webLink: event.webLink || null,
        isOnlineMeeting: Boolean(event.isOnlineMeeting),
        onlineMeetingProvider: event.onlineMeetingProvider || null,
        joinUrl: event?.onlineMeeting?.joinUrl || event?.onlineMeeting?.joinWebUrl || null,
        attendees: Array.isArray(event.attendees)
            ? event.attendees.map((attendee) => ({
                type: attendee?.type || null,
                email: attendee?.emailAddress?.address || null,
                name: attendee?.emailAddress?.name || null,
            }))
            : [],
        organizer: event?.organizer?.emailAddress
            ? {
                email: event.organizer.emailAddress.address || null,
                name: event.organizer.emailAddress.name || null,
            }
            : null,
        start: event.start || null,
        end: event.end || null,
    };
}

export default class MicrosoftGraphCalendarClient {
    constructor({ authClient, config, httpClient = axios }) {
        this.authClient = authClient;
        this.config = config;
        this.httpClient = httpClient;
    }

    async getCalendarCapabilities({ organizerEmail }) {
        if (!organizerEmail) {
            throw createDemoMeetingError(
                ErrorCodes.PROVIDER_CONFIG_ERROR,
                'Microsoft Graph organizer mailbox is not configured',
                503
            );
        }

        return {
            organizerEmail,
            permissionMode: this.config.permissionMode,
            supportsTeamsMeetings: true,
        };
    }

    async getSchedules({ organizerEmail, scheduleEmails, startTime, endTime, timezone, intervalMinutes }) {
        const response = await this.#request({
            method: 'POST',
            path: `/users/${encodeURIComponent(organizerEmail)}/calendar/getSchedule`,
            errorCode: ErrorCodes.PROVIDER_SCHEDULE_FAILED,
            errorMessage: 'Failed to retrieve Microsoft Graph schedules',
            data: {
                schedules: scheduleEmails,
                startTime: {
                    dateTime: formatGraphDateTime(startTime, timezone),
                    timeZone: timezone,
                },
                endTime: {
                    dateTime: formatGraphDateTime(endTime, timezone),
                    timeZone: timezone,
                },
                availabilityViewInterval: intervalMinutes,
            },
        });

        const byEmail = new Map();
        for (const entry of response?.data?.value || []) {
            const email = String(entry?.scheduleId || '').trim().toLowerCase();
            const scheduleItems = Array.isArray(entry?.scheduleItems) ? entry.scheduleItems : [];
            const blockingItem = scheduleItems.find((item) => {
                const itemStart = parseGraphDateTime(item?.start, timezone);
                const itemEnd = parseGraphDateTime(item?.end, timezone);
                const status = String(item?.status || '').trim().toLowerCase();
                if (!Number.isFinite(itemStart.getTime()) || !Number.isFinite(itemEnd.getTime())) return false;
                return status !== 'free' && hasOverlap(itemStart, itemEnd, startTime, endTime);
            });

            byEmail.set(email, {
                email,
                isAvailable: !blockingItem && !entry?.error,
                scheduleItems,
                error: entry?.error || null,
            });
        }

        return {
            providerRequestId: extractRequestId(response?.headers || {}),
            schedules: byEmail,
        };
    }

    async createEvent({ organizerEmail, payload, allowOnlineFallback }) {
        let response;

        try {
            response = await this.#request({
                method: 'POST',
                path: `/users/${encodeURIComponent(organizerEmail)}/events`,
                errorCode: ErrorCodes.PROVIDER_CREATE_FAILED,
                errorMessage: 'Failed to create Microsoft Graph calendar event',
                data: payload,
            });
        } catch (error) {
            if (!allowOnlineFallback || !payload?.isOnlineMeeting || !shouldRetryWithoutOnlineMeeting(error)) {
                throw error;
            }

            response = await this.#request({
                method: 'POST',
                path: `/users/${encodeURIComponent(organizerEmail)}/events`,
                errorCode: ErrorCodes.PROVIDER_CREATE_FAILED,
                errorMessage: 'Failed to create Microsoft Graph calendar event',
                data: {
                    ...payload,
                    isOnlineMeeting: false,
                    onlineMeetingProvider: undefined,
                },
            });
        }

        return {
            providerRequestId: extractRequestId(response?.headers || {}),
            event: response?.data || {},
        };
    }

    async #request({ method, path, data, errorCode, errorMessage }) {
        const token = await this.authClient.getAccessToken();
        const url = `${this.config.baseUrl}${path}`;

        try {
            return await this.httpClient.request({
                method,
                url,
                data,
                timeout: 20000,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
        } catch (error) {
            const status = Number(error?.response?.status || 0);
            const message = normalizeGraphErrorMessage(error, errorMessage);

            if (status === 401 || status === 403) {
                throw createDemoMeetingError(
                    ErrorCodes.PROVIDER_AUTH_ERROR,
                    message,
                    status,
                    { provider: 'microsoft_graph', status }
                );
            }

            throw createDemoMeetingError(
                errorCode,
                message,
                502,
                {
                    provider: 'microsoft_graph',
                    status,
                }
            );
        }
    }
}

