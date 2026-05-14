const resolveAppName = () => {
    if (typeof window === 'undefined') return 'Hirex REC — AI Recruitment Software for Recruiters | hirexit.ai';

    const hostname = String(window.location?.hostname || '').toLowerCase();
    if (hostname.includes('hirexit.ai')) return 'Hirex REC — AI Recruitment Software for Recruiters | hirexit.ai';
    if (hostname.includes('aiselekt.com')) return 'Hirex REC — AI Recruitment Software for Recruiters | hirexit.ai';
    return 'Hirex REC — AI Recruitment Software for Recruiters | hirexit.ai';
};

export const APP_NAME = resolveAppName();

export const composeDocumentTitle = (pageTitle) => {
    const cleanTitle = String(pageTitle || '').trim();
    if (!cleanTitle || cleanTitle === APP_NAME) return APP_NAME;
    return `${cleanTitle} | ${APP_NAME}`;
};

export const setDocumentTitle = (pageTitle) => {
    if (typeof document === 'undefined') return;
    document.title = composeDocumentTitle(pageTitle);
};
