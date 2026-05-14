import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export const RESET_CONTEXT = 'resetContext';

export const createStateContext = (name, initialState = {}) => {
    const Context = createContext([initialState, () => {}]);

    const Provider = ({ children }) => {
        const [state, setStateInternal] = useState(initialState);

        const setState = useCallback((objOrFn) => {
            setStateInternal((prev) => {
                if (objOrFn === RESET_CONTEXT || objOrFn === 'resetGState') {
                    return initialState;
                }

                const patch = typeof objOrFn === 'function' ? objOrFn(prev) : objOrFn;
                return { ...prev, ...patch };
            });
        }, [initialState]);

        const value = useMemo(() => [state, setState], [state, setState]);

        return <Context.Provider value={value}>{children}</Context.Provider>;
    };

    const useContextState = () => {
        const ctx = useContext(Context);

        if (!ctx) {
            throw new Error(`${name} must be used within ${name}Provider`);
        }

        return ctx;
    };

    return { Context, Provider, useContextState };
};
