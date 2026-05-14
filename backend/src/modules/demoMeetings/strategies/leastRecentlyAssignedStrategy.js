const timestampOrZero = (value) => {
    if (!(value instanceof Date)) return 0;
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : 0;
};

export function sortMembersByFairness(members = []) {
    return [...members].sort((left, right) => {
        const lastAssignedDiff = timestampOrZero(left.lastAssignedAt) - timestampOrZero(right.lastAssignedAt);
        if (lastAssignedDiff !== 0) return lastAssignedDiff;

        const dailyCountDiff = Number(left.dailyMeetingCount || 0) - Number(right.dailyMeetingCount || 0);
        if (dailyCountDiff !== 0) return dailyCountDiff;

        const priorityDiff = Number(left.priority || 0) - Number(right.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;

        return String(left.email || '').localeCompare(String(right.email || ''));
    });
}
