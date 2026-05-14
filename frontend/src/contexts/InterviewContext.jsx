import { createStateContext } from './createStateContext';

const initialState = {
    interviewRowsList: null,
    interviewListMeta: null,
    interviewListQuery: null,
    interviewListRefreshToken: 0,
};

const { Provider: InterviewProvider, useContextState: useInterviewContextState } = createStateContext(
    'InterviewContext',
    initialState
);

// eslint-disable-next-line react-refresh/only-export-components
export { InterviewProvider, useInterviewContextState };
