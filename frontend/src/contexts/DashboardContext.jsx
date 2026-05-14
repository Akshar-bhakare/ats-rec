import { createStateContext } from './createStateContext';

const initialState = {
    dashboardCandidates: null,
    dashboardJobs: null,
    dashboardCompanies: null,
    dashboardUaAdmins: null,
    dashboardRecruiters: null,
};

const { Provider: DashboardProvider, useContextState: useDashboardContextState } = createStateContext(
    'DashboardContext',
    initialState
);

export { DashboardProvider, useDashboardContextState };
