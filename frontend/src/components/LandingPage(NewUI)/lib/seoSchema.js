const fallbackSiteUrl = 'https://hirexit.ai';
const supportEmail = 'support@hirexit.com';
const logoPath = '/static/logo.svg';

export const resolveSiteOrigin = () => {
    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin.replace(/\/+$/, '');
    }

    const envSiteUrl = String(import.meta.env?.VITE_SITE_URL || '').trim();
    return (envSiteUrl || fallbackSiteUrl).replace(/\/+$/, '');
};

export const buildOrganizationSchema = (siteOrigin) => ({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Hirex REC',
    url: siteOrigin,
    logo: `${siteOrigin}${logoPath}`,
    email: supportEmail,
    address: {
        '@type': 'PostalAddress',
        streetAddress: 'G06, The Exchange Tower, Business Bay',
        addressLocality: 'Dubai',
        addressCountry: 'UAE',
    },
});

export const buildWebsiteSchema = (siteOrigin) => ({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Hirex REC',
    url: siteOrigin,
});

export const buildSoftwareApplicationSchema = ({
    siteOrigin,
    title = 'Hirex REC',
    description,
    pathname = '/',
    featureList = [],
}) => ({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: title,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description,
    url: new URL(pathname, `${siteOrigin}/`).toString(),
    image: `${siteOrigin}${logoPath}`,
    ...(featureList.length ? { featureList } : {}),
    provider: {
        '@type': 'Organization',
        name: 'Hirex REC',
        url: siteOrigin,
    },
});

export const buildWebPageSchema = ({
    siteOrigin,
    pathname,
    title,
    description,
}) => ({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: new URL(pathname, `${siteOrigin}/`).toString(),
    isPartOf: {
        '@type': 'WebSite',
        name: 'Hirex REC',
        url: siteOrigin,
    },
});

export const buildFaqSchema = (faq = []) => {
    if (!faq.length) return null;

    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
    };
};

export const buildBlogSchema = (siteOrigin) => ({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Hirex REC Blog',
    url: new URL('/blog', `${siteOrigin}/`).toString(),
    publisher: {
        '@type': 'Organization',
        name: 'Hirex REC',
        url: siteOrigin,
        logo: {
            '@type': 'ImageObject',
            url: `${siteOrigin}${logoPath}`,
        },
    },
});

export const buildBlogPostingSchema = ({
    siteOrigin,
    pathname,
    title,
    description,
}) => ({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    mainEntityOfPage: new URL(pathname, `${siteOrigin}/`).toString(),
    publisher: {
        '@type': 'Organization',
        name: 'Hirex REC',
        url: siteOrigin,
        logo: {
            '@type': 'ImageObject',
            url: `${siteOrigin}${logoPath}`,
        },
    },
    author: {
        '@type': 'Organization',
        name: 'Hirex REC',
    },
});
