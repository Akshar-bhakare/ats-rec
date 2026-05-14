import { createStateContext } from './createStateContext';

const initialState = {
    recruiterInitialValuesDict: null,
};

const { Provider: RecruiterProvider, useContextState: useRecruiterContextState } = createStateContext(
    'RecruiterContext',
    initialState
);

export { RecruiterProvider, useRecruiterContextState };
