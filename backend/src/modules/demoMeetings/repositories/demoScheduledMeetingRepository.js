import { isDuplicateKeyError } from '../utils/demoMeetingErrors.js';

const toPlainObject = (value) => typeof value?.toObject === 'function' ? value.toObject() : value;

export default class DemoScheduledMeetingRepository {
    constructor(conn) {
        this.conn = conn;
    }

    get Model() {
        return this.conn.models['DemoScheduledMeeting'];
    }

    async findByIdempotencyKey(idempotencyKey) {
        return this.Model.findOne({ idempotencyKey }).lean().exec();
    }

    async createSchedulingPlaceholder(payload) {
        try {
            const created = await this.Model.create(payload);
            return { meeting: toPlainObject(created), created: true };
        } catch (error) {
            if (!isDuplicateKeyError(error)) throw error;
            const existing = await this.findByIdempotencyKey(payload.idempotencyKey);
            return { meeting: existing, created: false };
        }
    }

    async claimSlotForMeeting({
        meetingId,
        assignedMemberName,
        assignedMemberEmail,
        organizerEmail,
        attendeeEmails,
    }) {
        try {
            const updated = await this.Model.findOneAndUpdate(
                { _id: meetingId, status: 'scheduling' },
                {
                    $set: {
                        assignedMemberName,
                        assignedMemberEmail,
                        organizerEmail,
                        attendeeEmails,
                        status: 'pending_provider',
                        slotClaimedAt: new Date(),
                    },
                },
                { new: true }
            ).exec();

            return toPlainObject(updated);
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                return null;
            }
            throw error;
        }
    }

    async markScheduled({
        meetingId,
        graphEventId,
        changeKey,
        providerRequestId,
        joinUrl,
        rawProviderResponse,
    }) {
        const updated = await this.Model.findOneAndUpdate(
            { _id: meetingId },
            {
                $set: {
                    graphEventId,
                    changeKey,
                    providerRequestId,
                    joinUrl,
                    rawProviderResponse,
                    providerError: null,
                    status: 'scheduled',
                    scheduledAt: new Date(),
                },
            },
            { new: true }
        ).exec();

        return toPlainObject(updated);
    }

    async markFailure({ meetingId, code, message, details = null, providerRequestId = null }) {
        const updated = await this.Model.findOneAndUpdate(
            { _id: meetingId },
            {
                $set: {
                    status: 'provider_failed',
                    providerRequestId,
                    providerError: {
                        code,
                        message,
                        details,
                        failedAt: new Date(),
                    },
                },
            },
            { new: true }
        ).exec();

        return toPlainObject(updated);
    }
}

