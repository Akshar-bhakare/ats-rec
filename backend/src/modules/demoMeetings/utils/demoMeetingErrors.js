export class DemoMeetingError extends Error {
    constructor({ code, message, statusCode = 500, details = null }) {
        super(message);
        this.name = 'DemoMeetingError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}

export const ErrorCodes = Object.freeze({
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    OTP_NOT_VERIFIED: 'OTP_NOT_VERIFIED',
    IDEMPOTENCY_IN_PROGRESS: 'IDEMPOTENCY_IN_PROGRESS',
    NO_ELIGIBLE_MEMBERS: 'NO_ELIGIBLE_MEMBERS',
    NO_AVAILABLE_MEMBERS: 'NO_AVAILABLE_MEMBERS',
    DUPLICATE_SLOT_CONFLICT: 'DUPLICATE_SLOT_CONFLICT',
    PROVIDER_CONFIG_ERROR: 'PROVIDER_CONFIG_ERROR',
    PROVIDER_AUTH_ERROR: 'PROVIDER_AUTH_ERROR',
    PROVIDER_SCHEDULE_FAILED: 'PROVIDER_SCHEDULE_FAILED',
    PROVIDER_CREATE_FAILED: 'PROVIDER_CREATE_FAILED',
});

export function createDemoMeetingError(code, message, statusCode, details = null) {
    return new DemoMeetingError({ code, message, statusCode, details });
}

export function isDuplicateKeyError(error) {
    return Number(error?.code) === 11000;
}

export function toHttpResponse(error) {
    if (error instanceof DemoMeetingError) {
        return {
            statusCode: error.statusCode || 500,
            body: {
                success: false,
                error: error.code,
                message: error.message,
                ...(error.details ? { details: error.details } : {}),
            },
        };
    }

    return {
        statusCode: 500,
        body: {
            success: false,
            error: 'INTERNAL_SERVER_ERROR',
            message: error?.message || 'Internal Server Error',
        },
    };
}
