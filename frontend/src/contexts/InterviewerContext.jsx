import { createStateContext } from './createStateContext';

const initialState = {
    interviewerInitialValuesDict: null,
};

const { Provider: InterviewerProvider, useContextState: useInterviewerContextState } = createStateContext(
    'InterviewerContext',
    initialState
);

export { InterviewerProvider, useInterviewerContextState };
