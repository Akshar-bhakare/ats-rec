import { createStateContext } from './createStateContext';

const initialState = {
    loadingMsg: null,
    muiThemeMode: null,
    drawerOpen: undefined,
    alert: null,
    showJourneyResumeModal: false,
    hideJourneyGuide: false,
};

const { Provider: UiProvider, useContextState: useUiContextState } = createStateContext(
    'UiContext',
    initialState
);

export { UiProvider, useUiContextState };
