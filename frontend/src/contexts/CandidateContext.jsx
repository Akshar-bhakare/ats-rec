import { createStateContext } from './createStateContext';

const initialState = {
    candidateInitialValuesDict: null,
    candidateListRows: null,
    candidatesListViewMode: null,
    candidateListMeta: null,
    candidateListQuery: null,
    candidateWsSubmit: false,
    candidateEditInitialValues: null,
    candidateUpdateWsSubmit: false,
};

const { Provider: CandidateProvider, useContextState: useCandidateContextState } = createStateContext(
    'CandidateContext',
    initialState
);

// eslint-disable-next-line react-refresh/only-export-components
export { CandidateProvider, useCandidateContextState };
