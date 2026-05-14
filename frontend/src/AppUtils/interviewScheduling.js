import dayjs from 'dayjs';

const MONGO_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const DEFAULT_DURATION_MINUTES = 45;

const splitCandidateName = (item = {}) => {
    const firstName = String(item?.firstName || '').trim();
    const lastName = String(item?.lastName || '').trim();

    if (firstName || lastName) {
        return { firstName, lastName };
    }

    const fullName = String(item?.fullName || item?.candidateName || '').trim();
    if (!fullName) {
        return { firstName: '', lastName: '' };
    }

    const nameParts = fullName.split(/\s+/).filter(Boolean);
    return {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' '),
    };
};

export const buildInterviewScheduleDrafts = (itemsToSchedule = [], scheduleAt) => (
    (itemsToSchedule || []).map((item) => {
        const { firstName, lastName } = splitCandidateName(item);
        return {
            id: String(item?.id || item?._id || item?.candidateId || item?.atsId || ''),
            atsId: String(item?.atsId || ''),
            firstName,
            lastName,
            email: String(item?.email || ''),
            phoneNumber: String(item?.phoneNumber || item?.mobile || ''),
            scheduleAt,
            durationMinutes: Number(item?.durationMinutes) || DEFAULT_DURATION_MINUTES,
        };
    })
);

export const buildInterviewScheduleParams = ({
    drafts = [],
    jobId = '',
    fallbackScheduleAt = null,
} = {}) => {
    const params = new URLSearchParams();
    const validDrafts = (drafts || []).filter((item) =>
        MONGO_ID_PATTERN.test(String(item?.atsId || ''))
    );

    validDrafts.forEach((item) => {
        params.append('atsids', String(item.atsId));
    });

    if (MONGO_ID_PATTERN.test(String(jobId || ''))) {
        params.set('jid', String(jobId));
    }

    const scheduleMap = {};
    validDrafts.forEach((item) => {
        const dt = dayjs(item?.scheduleAt);
        if (!dt.isValid()) return;

        scheduleMap[String(item.atsId)] = {
            scheduleAt: dt.toISOString(),
            durationMinutes: Number(item?.durationMinutes) || DEFAULT_DURATION_MINUTES,
        };
    });

    const fallback = dayjs(fallbackScheduleAt);

    try {
        if (Object.keys(scheduleMap).length) {
            const key = `interview_schedule_${Date.now()}`;
            sessionStorage.setItem(key, JSON.stringify(scheduleMap));
            params.set('scheduleKey', key);
        } else if (fallback.isValid()) {
            params.set('scheduleAt', fallback.toISOString());
        }
    } catch {
        if (fallback.isValid()) {
            params.set('scheduleAt', fallback.toISOString());
        }
    }

    return params;
};
