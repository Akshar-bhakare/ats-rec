import { createStateContext } from './createStateContext';

const initialState = {
    stageInitialValuesDict: null,
    stageRowsList: null,
    stageListDirty: false,
};

const { Provider: StageProvider, useContextState: useStageContextState } = createStateContext(
    'StageContext',
    initialState
);

export { StageProvider, useStageContextState };
