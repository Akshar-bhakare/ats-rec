export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
    if (!error) {
        return fallback;
    }

    if (typeof error === 'string') {
        return error;
    }

    return error?.message || error?.error || fallback;
};

export const mapScheduleError = (error) => {
    const code = String(error?.error || error?.code || '').trim().toUpperCase();

    switch (code) {
        case 'NO_ELIGIBLE_MEMBERS':
            return 'No demo hosts are configured right now. Please try again later.';
        case 'NO_AVAILABLE_MEMBERS':
            return 'That time slot is unavailable. Please choose a different time.';
        case 'DUPLICATE_SLOT_CONFLICT':
            return 'That slot was just taken. Please pick another time.';
        case 'OTP_NOT_VERIFIED':
            return 'Your verification session expired. Please verify your email again.';
        case 'PROVIDER_AUTH_ERROR':
        case 'PROVIDER_CONFIG_ERROR':
        case 'PROVIDER_CREATE_FAILED':
        case 'PROVIDER_SCHEDULE_FAILED':
            return 'Demo scheduling is temporarily unavailable. Please try again in a few minutes.';
        default:
            return getErrorMessage(error, 'We could not schedule your demo. Please try again.');
    }
};
