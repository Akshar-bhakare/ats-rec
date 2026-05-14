
export const loadRecaptchaScript = () => new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
        reject(new Error('reCAPTCHA is not available in this environment.'));
        return;
    }

    if (window.grecaptcha?.render) {
        resolve(window.grecaptcha);
        return;
    }

    const existingScript = document.querySelector('script[src^="https://www.google.com/recaptcha/api.js"]');
    if (existingScript) {
        const handleLoad = () => resolve(window.grecaptcha);
        const handleError = () => reject(new Error('Failed to load reCAPTCHA script.'));

        existingScript.addEventListener('load', handleLoad, { once: true });
        existingScript.addEventListener('error', handleError, { once: true });
        return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.grecaptcha);
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA script.'));
    document.body.appendChild(script);
});

