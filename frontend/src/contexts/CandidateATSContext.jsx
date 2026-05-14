import { createStateContext } from './createStateContext';

const initialState = {
    candidateATSListRows: null,
    candidateATSListMeta: null,
    candidateATSListQuery: null,
};

const { Provider: CandidateATSProvider, useContextState: useCandidateATSContextState } = createStateContext(
    'CandidateATSContext',
    initialState
);

// eslint-disable-next-line react-refresh/only-export-components
export { CandidateATSProvider, useCandidateATSContextState };
