import { DEFAULT_TIMEZONE, getTimeZoneOffsetMs, normalizeTimeZone } from '../../utils/timeUtils.js';
import { getDemoMeetingConfig } from './config/demoMeetingConfig.js';
import MicrosoftGraphAuthClient from './providers/microsoftGraphAuthClient.js';
import MicrosoftGraphCalendarClient, { extractSafeProviderSummary } from './providers/microsoftGraphCalendarClient.js';
import DemoScheduledMeetingRepository from './repositories/demoScheduledMeetingRepository.js';
import DemoTeamMemberRepository from './repositories/demoTeamMemberRepository.js';
import { sortMembersByFairness } from './strategies/leastRecentlyAssignedStrategy.js';
import { buildDemoMeetingContent } from './utils/demoMeetingBodyBuilder.js';
import { ErrorCodes, createDemoMeetingError } from './utils/demoMeetingErrors.js';

const DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME;

const ACTIVE_MEETING_STATUSES = new Set(['pending_provider', 'scheduled']);

const noopLogger = {
    info: () => { },
    warn: () => { },
    error: () => { },
};

const toPlainObject = (value) => typeof value?.toObject === 'function' ? value.toObject() : value;

const buildDateParts = (date, timeZone) => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    const parts = {};
    for (const part of formatter.formatToParts(date)) {
        if (part.type !== 'literal') parts[part.type] = part.value;
    }

    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
    };
};

const formatGraphLocalDateTime = (date, timeZone) => {
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

    return parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute + ':' + parts.second;
};

const localDateToUtc = ({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone) => {
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
    const offset = getTimeZoneOffsetMs(timeZone, utcDate);
    return new Date(utcDate.getTime() - offset);
};

const addDays = ({ year, month, day }, daysToAdd) => {
    const next = new Date(Date.UTC(year, month - 1, day + daysToAdd, 0, 0, 0, 0));
    return {
        year: next.getUTCFullYear(),
        month: next.getUTCMonth() + 1,
        day: next.getUTCDate(),
    };
};

const getUtcDayRange = (date, timeZone) => {
    const localParts = buildDateParts(date, timeZone);
    return {
        start: localDateToUtc(localParts, timeZone),
        end: localDateToUtc(addDays(localParts, 1), timeZone),
    };
};

const toDurationMinutes = (startTime, endTime) => Math.round((endTime.getTime() - startTime.getTime()) / 60000);

export default class DemoMeetingService {
    constructor({
        conn = null,
        meetingRepository = null,
        teamMemberRepository = null,
        graphCalendarClient = null,
        config = getDemoMeetingConfig(),
        logger = noopLogger,
    } = {}) {
        this.conn = conn;
        this.meetingRepository = meetingRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.graphCalendarClient = graphCalendarClient;
        this.config = config;
        this.logger = logger;
        this.authClient = null;
    }

    async scheduleMeeting({ body, headers }, { logger = null, requestId = null } = {}) {
        const requestLogger = logger || this.logger || noopLogger;
        const conn = await this.#getConn();
        const meetingRepository = this.meetingRepository || new DemoScheduledMeetingRepository(conn);
        const teamMemberRepository = this.teamMemberRepository || new DemoTeamMemberRepository(conn);
        const graphCalendarClient = this.graphCalendarClient || this.#buildGraphCalendarClient();

        const timezone = normalizeTimeZone(body.timezone, this.config.defaultTimezone || DEFAULT_TIMEZONE);
        const organizerEmail = String(this.config.organizerEmail || '').trim().toLowerCase();
        const durationMinutes = toDurationMinutes(body.startTime, body.endTime);

        if (durationMinutes < this.config.minDurationMinutes || durationMinutes > this.config.maxDurationMinutes) {
            throw createDemoMeetingError(
                ErrorCodes.VALIDATION_ERROR,
                `Meeting duration must be between ${this.config.minDurationMinutes} and ${this.config.maxDurationMinutes} minutes`,
                400
            );
        }

        const idempotencyKey = headers['x-idempotency-key'];
        const existingMeeting = await meetingRepository.findByIdempotencyKey(idempotencyKey);
        if (existingMeeting) {
            return this.#resolveExistingMeeting(existingMeeting);
        }

        const demoLead = await conn.models['DemoLeads']
            .findOne({
                email: body.candidateEmail,
                verifyEmailOtpVerified: true,
                isArchived: false,
            })
            .sort({ updatedAt: -1 })
            .lean()
            .exec();

        if (!demoLead) {
            throw createDemoMeetingError(
                ErrorCodes.OTP_NOT_VERIFIED,
                'Demo lead email OTP verification is required before scheduling',
                403
            );
        }

        const placeholderResult = await meetingRepository.createSchedulingPlaceholder({
            idempotencyKey,
            demoLeadId: demoLead._id,
            candidateName: body.candidateName,
            candidateEmail: body.candidateEmail,
            attendeeEmails: [body.candidateEmail],
            meetingType: body.meetingType,
            requestedRole: body.role || '',
            startTime: body.startTime,
            endTime: body.endTime,
            timezone,
            organizerEmail,
            provider: 'microsoft_graph',
            status: 'scheduling',
        });

        if (!placeholderResult.created) {
            return this.#resolveExistingMeeting(placeholderResult.meeting);
        }

        const placeholderMeeting = placeholderResult.meeting;

        try {
            const eligibleMembers = await teamMemberRepository.findEligibleMembers({
                meetingType: body.meetingType,
                role: body.role || null,
            });

            if (!eligibleMembers.length) {
                await meetingRepository.markFailure({
                    meetingId: placeholderMeeting._id,
                    code: ErrorCodes.NO_ELIGIBLE_MEMBERS,
                    message: 'No eligible demo meeting team members are configured for this request',
                });
                throw createDemoMeetingError(
                    ErrorCodes.NO_ELIGIBLE_MEMBERS,
                    'No eligible demo meeting team members are configured for this request',
                    422
                );
            }

            const bypassHost = eligibleMembers.find((member) => member.byPassFairness === true) || null;
            const standardMembers = eligibleMembers.filter((member) => member.byPassFairness !== true);
            let bypassScheduleResult = null;
            let standardScheduleResult = null;
            let claimedMeeting = null;
            let selectedMember = null;

            const capabilities = await graphCalendarClient.getCalendarCapabilities({ organizerEmail });
            requestLogger.info({
                requestId,
                organizerEmail: capabilities.organizerEmail,
                eligibleMembers: eligibleMembers.length,
                standardMembers: standardMembers.length,
                bypassHostEmail: bypassHost?.email || null,
            }, '[DemoMeeting] Retrieved organizer capabilities');

            if (bypassHost) {
                requestLogger.info({
                    requestId,
                    bypassHostEmail: bypassHost.email,
                    startTime: body.startTime.toISOString(),
                    endTime: body.endTime.toISOString(),
                }, '[DemoMeeting] Checking bypass host first');

                bypassScheduleResult = await graphCalendarClient.getSchedules({
                    organizerEmail,
                    scheduleEmails: [bypassHost.email],
                    startTime: body.startTime,
                    endTime: body.endTime,
                    timezone,
                    intervalMinutes: Math.max(5, durationMinutes),
                });

                const bypassAvailability = bypassScheduleResult.schedules.get(String(bypassHost.email || '').toLowerCase());
                const isBypassHostAvailable = bypassAvailability?.isAvailable === true;

                requestLogger.info({
                    requestId,
                    bypassHostEmail: bypassHost.email,
                    isAvailable: isBypassHostAvailable,
                }, '[DemoMeeting] Bypass host availability resolved');

                if (isBypassHostAvailable) {
                    const updatedMeeting = await meetingRepository.claimSlotForMeeting({
                        meetingId: placeholderMeeting._id,
                        assignedMemberName: bypassHost.name,
                        assignedMemberEmail: bypassHost.email,
                        organizerEmail,
                        attendeeEmails: [body.candidateEmail, bypassHost.email],
                    });

                    if (updatedMeeting) {
                        claimedMeeting = updatedMeeting;
                        selectedMember = bypassHost;
                        requestLogger.info({
                            requestId,
                            bypassHostEmail: bypassHost.email,
                        }, '[DemoMeeting] Selected bypass host');
                    } else {
                        requestLogger.warn({
                            requestId,
                            bypassHostEmail: bypassHost.email,
                            startTime: body.startTime.toISOString(),
                            endTime: body.endTime.toISOString(),
                        }, '[DemoMeeting] Bypass host slot claim lost, falling back to fairness flow');
                    }
                } else {
                    requestLogger.info({
                        requestId,
                        bypassHostEmail: bypassHost.email,
                    }, '[DemoMeeting] Bypass host unavailable, falling back to fairness flow');
                }
            }

            if (!claimedMeeting || !selectedMember) {
                const dayRange = getUtcDayRange(body.startTime, timezone);
                const dailyCountMap = await teamMemberRepository.getDailyMeetingCounts({
                    memberEmails: standardMembers.map((member) => member.email),
                    dayStart: dayRange.start,
                    dayEnd: dayRange.end,
                });

                const filteredMembers = standardMembers
                    .map((member) => ({
                        ...member,
                        dailyMeetingCount: Number(dailyCountMap.get(member.email) || 0),
                    }))
                    .filter((member) => {
                        if (!Number.isFinite(Number(member.maxMeetingsPerDay))) return true;
                        return Number(member.dailyMeetingCount || 0) < Number(member.maxMeetingsPerDay);
                    });

                if (!filteredMembers.length) {
                    await meetingRepository.markFailure({
                        meetingId: placeholderMeeting._id,
                        code: bypassHost ? ErrorCodes.NO_AVAILABLE_MEMBERS : ErrorCodes.NO_ELIGIBLE_MEMBERS,
                        message: bypassHost
                            ? 'No demo meeting team member is free for the requested time slot'
                            : 'No eligible demo meeting team members are configured for this request',
                        providerRequestId: bypassScheduleResult?.providerRequestId || null,
                    });
                    throw createDemoMeetingError(
                        bypassHost ? ErrorCodes.NO_AVAILABLE_MEMBERS : ErrorCodes.NO_ELIGIBLE_MEMBERS,
                        bypassHost
                            ? 'No demo meeting team member is free for the requested time slot'
                            : 'No eligible demo meeting team members are configured for this request',
                        bypassHost ? 409 : 422
                    );
                }

                standardScheduleResult = await graphCalendarClient.getSchedules({
                    organizerEmail,
                    scheduleEmails: filteredMembers.map((member) => member.email),
                    startTime: body.startTime,
                    endTime: body.endTime,
                    timezone,
                    intervalMinutes: Math.max(5, durationMinutes),
                });

                const availableMembers = filteredMembers.filter((member) => {
                    const schedule = standardScheduleResult.schedules.get(String(member.email || '').toLowerCase());
                    return schedule?.isAvailable === true;
                });

                if (!availableMembers.length) {
                    await meetingRepository.markFailure({
                        meetingId: placeholderMeeting._id,
                        code: ErrorCodes.NO_AVAILABLE_MEMBERS,
                        message: 'No demo meeting team member is free for the requested time slot',
                        providerRequestId: standardScheduleResult.providerRequestId || bypassScheduleResult?.providerRequestId || null,
                    });
                    throw createDemoMeetingError(
                        ErrorCodes.NO_AVAILABLE_MEMBERS,
                        'No demo meeting team member is free for the requested time slot',
                        409
                    );
                }

                const sortedMembers = sortMembersByFairness(availableMembers);

                for (const member of sortedMembers) {
                    const updatedMeeting = await meetingRepository.claimSlotForMeeting({
                        meetingId: placeholderMeeting._id,
                        assignedMemberName: member.name,
                        assignedMemberEmail: member.email,
                        organizerEmail,
                        attendeeEmails: [body.candidateEmail, member.email],
                    });

                    if (updatedMeeting) {
                        claimedMeeting = updatedMeeting;
                        selectedMember = member;
                        break;
                    }

                    requestLogger.warn({
                        requestId,
                        memberEmail: member.email,
                        startTime: body.startTime.toISOString(),
                        endTime: body.endTime.toISOString(),
                    }, '[DemoMeeting] Slot claim lost due to race, trying next member');
                }
            }

            if (!claimedMeeting || !selectedMember) {
                await meetingRepository.markFailure({
                    meetingId: placeholderMeeting._id,
                    code: ErrorCodes.DUPLICATE_SLOT_CONFLICT,
                    message: 'The requested time slot was claimed by another booking request',
                });
                throw createDemoMeetingError(
                    ErrorCodes.DUPLICATE_SLOT_CONFLICT,
                    'The requested time slot was claimed by another booking request',
                    409
                );
            }

            const content = buildDemoMeetingContent({
                firstName: demoLead.firstName,
                customerName: body.candidateName,
                customerEmail: body.candidateEmail,
                companyName: demoLead.company,
                assignedMemberName: selectedMember.name,
                timezone,
                startTime: body.startTime,
                endTime: body.endTime,
            });

            const attendees = [
                {
                    emailAddress: {
                        address: body.candidateEmail,
                        name: body.candidateName,
                    },
                    type: 'required',
                },
                {
                    emailAddress: {
                        address: selectedMember.email,
                        name: selectedMember.name,
                    },
                    type: 'required',
                },
            ];

            const eventResult = await graphCalendarClient.createEvent({
                organizerEmail,
                allowOnlineFallback: this.config.allowOnlineFallback,
                payload: {
                    subject: content.subject,
                    body: content.body,
                    start: {
                        dateTime: formatGraphLocalDateTime(body.startTime, timezone),
                        timeZone: timezone,
                    },
                    end: {
                        dateTime: formatGraphLocalDateTime(body.endTime, timezone),
                        timeZone: timezone,
                    },
                    attendees,
                    isOnlineMeeting: true,
                    onlineMeetingProvider: 'teamsForBusiness',
                },
            });

            const safeProviderSummary = extractSafeProviderSummary(eventResult.event);
            const scheduledMeeting = await meetingRepository.markScheduled({
                meetingId: claimedMeeting._id,
                graphEventId: eventResult.event.id || null,
                changeKey: eventResult.event.changeKey || null,
                providerRequestId: eventResult.providerRequestId,
                joinUrl: eventResult.event?.onlineMeeting?.joinUrl || eventResult.event?.onlineMeeting?.joinWebUrl || eventResult.event?.webLink || null,
                rawProviderResponse: safeProviderSummary,
            });

            await teamMemberRepository.updateLastAssignedAt(selectedMember.email, new Date());

            requestLogger.info({
                requestId,
                meetingId: scheduledMeeting?._id?.toString?.() || String(scheduledMeeting?._id || ''),
                assignedMemberEmail: selectedMember.email,
                graphEventId: scheduledMeeting?.graphEventId || null,
            }, '[DemoMeeting] Scheduled successfully');

            return {
                httpStatus: 201,
                body: this.#formatSuccessResponse(scheduledMeeting, false),
            };
        } catch (error) {
            if (
                error?.code === ErrorCodes.PROVIDER_CREATE_FAILED ||
                error?.code === ErrorCodes.PROVIDER_AUTH_ERROR ||
                error?.code === ErrorCodes.PROVIDER_SCHEDULE_FAILED ||
                error?.code === ErrorCodes.PROVIDER_CONFIG_ERROR
            ) {
                await meetingRepository.markFailure({
                    meetingId: placeholderMeeting._id,
                    code: error.code,
                    message: error.message,
                    details: error.details,
                });
            }

            requestLogger.error({
                requestId,
                errorCode: error?.code || 'UNKNOWN_ERROR',
                message: error?.message || 'Unknown scheduling error',
            }, '[DemoMeeting] Scheduling failed');
            throw error;
        }
    }

    async #getConn() {
        if (this.conn) return this.conn;
        const { getClientDbConn } = await import('../../utils/clientDbUtils.js');
        this.conn = await getClientDbConn(DEFAULT_DB_NAME);
        return this.conn;
    }

    #buildGraphCalendarClient() {
        if (!this.authClient) {
            this.authClient = new MicrosoftGraphAuthClient({ config: this.config });
        }

        return new MicrosoftGraphCalendarClient({
            authClient: this.authClient,
            config: this.config,
        });
    }

    #formatSuccessResponse(meeting, isReplay) {
        const startTime = meeting?.startTime instanceof Date ? meeting.startTime : new Date(meeting?.startTime);
        const endTime = meeting?.endTime instanceof Date ? meeting.endTime : new Date(meeting?.endTime);

        return {
            success: true,
            meetingId: meeting?._id?.toString?.() || String(meeting?._id || ''),
            status: meeting?.status || 'scheduled',
            assignedMember: {
                name: meeting?.assignedMemberName || '',
                email: meeting?.assignedMemberEmail || '',
            },
            organizerEmail: meeting?.organizerEmail || '',
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            joinUrl: meeting?.joinUrl || null,
            provider: meeting?.provider || 'microsoft_graph',
            ...(isReplay ? { isReplay: true } : {}),
        };
    }

    #resolveExistingMeeting(meeting) {
        const existing = toPlainObject(meeting);

        if (existing?.status === 'scheduled') {
            return {
                httpStatus: 200,
                body: this.#formatSuccessResponse(existing, true),
            };
        }

        if (ACTIVE_MEETING_STATUSES.has(existing?.status)) {
            throw createDemoMeetingError(
                ErrorCodes.IDEMPOTENCY_IN_PROGRESS,
                'Scheduling is already in progress for this idempotency key',
                409
            );
        }

        if (existing?.providerError?.code) {
            const statusCode = existing.providerError.code === ErrorCodes.NO_ELIGIBLE_MEMBERS
                ? 422
                : existing.providerError.code === ErrorCodes.OTP_NOT_VERIFIED
                    ? 403
                    : 409;

            throw createDemoMeetingError(
                existing.providerError.code,
                existing.providerError.message || 'Demo meeting scheduling previously failed',
                statusCode,
                existing.providerError.details || null
            );
        }

        throw createDemoMeetingError(
            ErrorCodes.IDEMPOTENCY_IN_PROGRESS,
            'Scheduling is already in progress for this idempotency key',
            409
        );
    }
}










