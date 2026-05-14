import { createStateContext } from './createStateContext';

const initialState = {
    isAuthenticated: false,
    user: null,
    booleanSubmitEmail: null,
};

const { Provider: AuthProvider, useContextState: useAuthContextState } = createStateContext(
    'AuthContext',
    initialState
);

export { AuthProvider, useAuthContextState };
