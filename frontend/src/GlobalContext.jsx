import { useState } from 'react';
import { createContext, useContext, useEffect } from 'react';


const initialState = {
    isAuthenticated: false,
    aiCallDemoBtnState: 0,
    // you can add other global state here later
};

// 1️⃣ Create a single GlobalContext
const RootContext = createContext([
    initialState,
    () => { }
]);

// 2️⃣ Provider component
export function GlobalStateProvider({ children }) {
    const [globalState, setGlobalState_] = useState(initialState);

    const setGlobalState = (objOrFn) => {
        setGlobalState_(prev => {
            if (objOrFn === 'resetGState') {
                return initialState;
            }

            const patch = typeof objOrFn === 'function' ? objOrFn(prev) : objOrFn;
            return { ...prev, ...patch };
        })
    };

    useEffect(() => {
        // read from <meta> or window, whichever you choose
        const metaTag = document.querySelector('meta[name="csrf-token"]')
        if (metaTag) {
            setGlobalState({
                csrfToken: metaTag.content,
                // e.g. user, theme, featureFlags...
            });
            metaTag.remove();

        } else {
            console.warn('CSRF not found...');

        }
    }, []);


    return (
        <RootContext.Provider value={[globalState, setGlobalState]}>
            {children}
        </RootContext.Provider>
    )
}

// 3️⃣ Hook for consuming
// eslint-disable-next-line react-refresh/only-export-components
export function useGlobalContextState() {
    const ctx = useContext(RootContext);

    if (!ctx) {
        throw new Error('useGlobal must be used within <GlobalProvider>');
    }

    return ctx;
}

export default GlobalStateProvider;