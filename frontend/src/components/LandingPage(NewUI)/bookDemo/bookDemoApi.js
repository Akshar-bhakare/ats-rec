import { fetchData } from '../../../AppUtils/dataAPI';
import { getErrorMessage } from './bookDemoErrorUtils';

const normalizeLeadPayload = (leadForm, demoOf) => ({
    firstName: String(leadForm?.firstName || '').trim(),
    lastName: String(leadForm?.lastName || '').trim(),
    email: String(leadForm?.email || '').trim().toLowerCase(),
    countryCode: String(leadForm?.countryCode || '+91').trim(),
    phoneNumber: String(leadForm?.mobile || '').trim(),
    company: String(leadForm?.company || '').trim(),
    concentToTermsAndConditions: Boolean(leadForm?.terms),
    demoOf,
});

export const sendDemoLeadOtp = async ({ leadForm, flowConfig }) => {
    try {
        return await fetchData('/api/demo/leads/email/send/otp/', {
            method: 'POST',
            body: {
                ...normalizeLeadPayload(leadForm, flowConfig.demoOf),
                jobTitle: flowConfig.jobTitle,
                jobId: flowConfig.jobId,
            },
        });
    } catch (error) {
        throw {
            ...error,
            message: getErrorMessage(error, 'Failed to send OTP. Please try again.'),
        };
    }
};

export const verifyDemoLeadOtp = async ({ leadForm, otp, flowConfig }) => {
    try {
        return await fetchData('/api/demo/leads/email/verify/otp/', {
            method: 'POST',
            body: {
                ...normalizeLeadPayload(leadForm, flowConfig.demoOf),
                otp: String(otp || '').trim(),
                jobTitle: flowConfig.jobTitle,
                jobId: flowConfig.jobId,
            },
        });
    } catch (error) {
        throw {
            ...error,
            message: getErrorMessage(error, 'Invalid OTP. Please try again.'),
        };
    }
};

export const scheduleBookDemoMeeting = async ({
    candidateName,
    candidateEmail,
    startTime,
    endTime,
    timezone,
    idempotencyKey,
}) => fetchData('/api/demo-meetings/schedule', {
    method: 'POST',
    headers: {
        'x-idempotency-key': idempotencyKey,
    },
    body: {
        candidateName,
        candidateEmail,
        meetingType: 'product_demo',
        startTime,
        endTime,
        timezone,
    },
});
