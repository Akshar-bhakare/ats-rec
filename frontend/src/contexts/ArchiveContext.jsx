import { createStateContext } from './createStateContext';

const initialState = {
    archivedCandidates: null,
    archivedClientAdmins: null,
    archivedCompanies: null,
    archivedInterviewers: null,
    archivedInterviews: null,
    archivedJobs: null,
    archivedManagers: null,
    archivedRecruiters: null,
    archivedStages: null,
};

const { Provider: ArchiveProvider, useContextState: useArchiveContextState } = createStateContext(
    'ArchiveContext',
    initialState
);

// eslint-disable-next-line react-refresh/only-export-components
export { ArchiveProvider, useArchiveContextState };
