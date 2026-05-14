import { createStateContext } from './createStateContext';

const initialState = {
    clientAdminInitialValuesDict: null,
};

const { Provider: ClientAdminProvider, useContextState: useClientAdminContextState } = createStateContext(
    'ClientAdminContext',
    initialState
);

export { ClientAdminProvider, useClientAdminContextState };
