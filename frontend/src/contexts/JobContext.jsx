/* eslint-disable react-refresh/only-export-components */
import { createStateContext } from './createStateContext';

const initialState = {
    jobRowsList: null,
    jobsListViewMode: null,
    jobListMeta: null,
    jobListQuery: null,
    jobFormData: null,
    jobInitialValuesDict: null,
};

const { Provider: JobProvider, useContextState: useJobContextState } = createStateContext(
    'JobContext',
    initialState
);

export { JobProvider, useJobContextState };
