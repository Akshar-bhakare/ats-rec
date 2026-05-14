import { z } from 'zod';
import { normalizeTimeZone } from '../../utils/timeUtils.js';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeSlug = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const parseDate = (fieldName) => z.string()
    .trim()
    .min(1, `${fieldName} is required`)
    .transform((value) => new Date(value))
    .refine((value) => Number.isFinite(value.getTime()), `${fieldName} must be a valid ISO date-time`);

const timezoneSchema = z.string()
    .trim()
    .min(1, 'timezone is required')
    .transform((value) => {
        const normalized = normalizeTimeZone(value);
        if (!normalized) {
            throw new Error('timezone is invalid');
        }
        return normalized;
    });

export const scheduleDemoMeetingHeadersSchema = z.object({
    'x-idempotency-key': z.string().trim().min(8).max(128),
});

export const scheduleDemoMeetingBodySchema = z.object({
    candidateName: z.string().trim().min(1).max(160),
    candidateEmail: z.string().trim().email().transform(normalizeEmail),
    meetingType: z.string().trim().min(1).max(80).transform(normalizeSlug),
    startTime: parseDate('startTime'),
    endTime: parseDate('endTime'),
    timezone: timezoneSchema,
    role: z.string().trim().min(1).max(120).transform(normalizeSlug).optional(),
}).superRefine((value, ctx) => {
    if (value.endTime <= value.startTime) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['endTime'],
            message: 'endTime must be after startTime',
        });
    }
});

export function normalizeScheduleDemoMeetingRequest({ body, headers }) {
    return {
        body: scheduleDemoMeetingBodySchema.parse(body),
        headers: scheduleDemoMeetingHeadersSchema.parse({
            'x-idempotency-key': headers?.['x-idempotency-key'],
        }),
    };
}

