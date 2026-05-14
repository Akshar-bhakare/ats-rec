export const DEFAULT_STAGE_PROGRESS_STATUS = 'Not Initiated';

export const normalizeStageProgressStatus = (
    status,
    defaultStatus = DEFAULT_STAGE_PROGRESS_STATUS
) => {
    const value = String(status || '').trim();
    return value || defaultStatus;
};

export const getActiveStageIndex = (
    items = [],
    getStatus = (item) => item?.stageStatus,
    defaultStatus = DEFAULT_STAGE_PROGRESS_STATUS
) => {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return -1;

    const nextIndex = list.findIndex((item) => {
        const status = normalizeStageProgressStatus(getStatus(item), defaultStatus).toLowerCase();
        return status !== 'completed' && status !== 'not applicable';
    });

    return nextIndex >= 0 ? nextIndex : list.length - 1;
};

export const getActiveStageItem = (
    items = [],
    getStatus = (item) => item?.stageStatus,
    defaultStatus = DEFAULT_STAGE_PROGRESS_STATUS
) => {
    const list = Array.isArray(items) ? items : [];
    const index = getActiveStageIndex(list, getStatus, defaultStatus);
    return index >= 0 ? list[index] : null;
};
