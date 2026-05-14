import { useHead } from '@unhead/react';

const fallbackSiteUrl = 'https://hirexit.ai';

const resolveSiteUrl = () => {
    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin.replace(/\/+$/, '');
    }

    const envSiteUrl = (import.meta.env?.VITE_SITE_URL || '').trim();
    return (envSiteUrl || fallbackSiteUrl).replace(/\/+$/, '');
};

const SeoHead = ({
    title,
    description,
    pathname = '/',
    image = '/static/logo.svg',
    structuredData = [],
    noIndex = false,
}) => {
    const siteUrl = resolveSiteUrl();
    const canonicalUrl = new URL(pathname, `${siteUrl}/`).toString();
    const imageUrl = new URL(image, `${siteUrl}/`).toString();

    useHead({
        title,
        meta: [
            { key: 'description', name: 'description', content: description },
            { key: 'robots', name: 'robots', content: noIndex ? 'noindex,nofollow' : 'index,follow' },
            { key: 'og:type', property: 'og:type', content: 'website' },
            { key: 'og:title', property: 'og:title', content: title },
            { key: 'og:description', property: 'og:description', content: description },
            { key: 'og:url', property: 'og:url', content: canonicalUrl },
            { key: 'og:image', property: 'og:image', content: imageUrl },
            { key: 'twitter:card', name: 'twitter:card', content: 'summary_large_image' },
            { key: 'twitter:title', name: 'twitter:title', content: title },
            { key: 'twitter:description', name: 'twitter:description', content: description },
            { key: 'twitter:image', name: 'twitter:image', content: imageUrl },
        ],
        link: [
            { key: 'canonical', rel: 'canonical', href: canonicalUrl },
        ],
        script: structuredData
            .filter(Boolean)
            .map((schema, index) => ({
                key: `structured-data-${index}`,
                type: 'application/ld+json',
                textContent: JSON.stringify(schema),
            })),
    });

    return null;
};

export default SeoHead;
