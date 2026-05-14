import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AppProviders } from './contexts/AppProviders';
import { getClientTimeZone } from './AppUtils/dataAPI';
import '@fontsource/inter';
import '@fontsource/manrope';

if (typeof window !== 'undefined' && window.fetch) {
    const originalFetch = window.fetch.bind(window);
    const isSameOriginRequest = (input) => {
        try {
            const url =
                typeof input === 'string'
                    ? input
                    : typeof URL !== 'undefined' && input instanceof URL
                        ? input.toString()
                        : typeof Request !== 'undefined' && input instanceof Request
                            ? input.url
                            : input?.url;
            if (!url) return true;
            const resolved = new URL(url, window.location.href);
            return resolved.origin === window.location.origin;
        } catch {
            return true;
        }
    };
    window.fetch = (input, init = {}) => {
        if (!isSameOriginRequest(input)) {
            return originalFetch(input, init);
        }
        const baseHeaders =
            init?.headers ||
            (typeof Request !== 'undefined' && input instanceof Request
                ? input.headers
                : {});
        const headers = new Headers(baseHeaders);
        if (!headers.has('x-timezone')) {
            headers.set('x-timezone', getClientTimeZone());
        }
        if (!headers.has('x-timezone-offset')) {
            headers.set('x-timezone-offset', String(new Date().getTimezoneOffset()));
        }
        return originalFetch(input, { ...init, headers });
    };
}



const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <AppProviders>
            <App />
        </AppProviders>
    </React.StrictMode>
);
