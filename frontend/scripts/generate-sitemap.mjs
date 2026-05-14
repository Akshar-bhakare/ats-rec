import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const publicDir = path.join(projectRoot, 'public');
fs.mkdirSync(publicDir, { recursive: true });
const staticDir = path.join(publicDir, 'static');
fs.mkdirSync(staticDir, { recursive: true });

fs.existsSync(path.join(staticDir, 'sitemap.xml')) && fs.rmSync(path.join(staticDir, 'sitemap.xml'));
fs.existsSync(path.join(publicDir, 'sitemap.xml')) && fs.rmSync(path.join(publicDir, 'sitemap.xml'));

const appFilePath = path.join(projectRoot, 'src', 'App.jsx');
const siteUrl = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://hirexit.ai').replace(/\/+$/, '');
const today = new Date().toISOString().split('T')[0];
const siteHostname = new URL(siteUrl).hostname.toLowerCase();
const isProductionHost = ['hirexit.ai', 'www.hirexit.ai', 'aiselekt.com', 'www.aiselekt.com'].includes(siteHostname);
const allowIndexing = process.env.ALLOW_INDEXING === 'true'
    || (process.env.ALLOW_INDEXING !== 'false' && isProductionHost);

const AUTH_PARENT_ROUTE_PATTERN = /<Route\s+path=['"]auth\/['"][\s\S]*?<\/Route>/;
const PATH_PROP_PATTERN = /path\s*=\s*['"]([^'"]+)['"]/g;
const INDEX_ROUTE_PATTERN = /<Route\s+index\b/;

const normalizeComparablePath = (routePath) => {
    if (!routePath || routePath === '/') return '/';
    const cleaned = routePath.replace(/\/+$/, '');
    return cleaned || '/';
};

const formatRoutePath = (routePath) => {
    if (!routePath) return '/';

    let formatted = routePath.trim();
    if (!formatted.startsWith('/')) {
        formatted = `/${formatted}`;
    }

    formatted = formatted.replace(/\/{2,}/g, '/');
    return formatted || '/';
};

const extractPathProps = (source) => {
    const paths = [];

    for (const match of source.matchAll(PATH_PROP_PATTERN)) {
        paths.push(match[1]);
    }

    return paths;
};

const getRoutePriority = (routePath) => {
    const normalized = normalizeComparablePath(routePath);

    if (normalized === '/') return '1.0';
    if (normalized === '/v1' || normalized === '/v2') return '0.9';
    if (normalized === '/privacypolicy' || normalized === '/termscondition' || normalized === '/unsubscribe') return '0.3';
    if (normalized.startsWith('/auth')) return '0.5';
    if (normalized === '/share/upload') return '0.6';
    return '0.7';
};

const getRouteChangefreq = (routePath) => {
    const normalized = normalizeComparablePath(routePath);

    if (normalized === '/') return 'weekly';
    if (normalized === '/privacypolicy' || normalized === '/termscondition' || normalized === '/unsubscribe') return 'yearly';
    return 'monthly';
};

const shouldIncludeRoute = (routePath) => {
    const normalized = normalizeComparablePath(routePath);

    if (!normalized || normalized === '*' || normalized.includes('*')) return false;
    if (normalized.includes(':')) return false;
    if (normalized.startsWith('/auth')) return false;
    if (normalized === '/loader') return false;
    if (normalized === '/hero') return false;
    if (normalized === '/muinotification') return false;
    if (normalized === '/share/upload') return false;
    if (normalized === '/unsubscribe') return false;
    if (normalized === '/v1') return false;
    if (normalized === '/v2') return false;

    return true;
};

const collectPublicRoutesFromApp = () => {
    const appSource = fs.readFileSync(appFilePath, 'utf8');
    const routesStartIndex = appSource.indexOf('<Routes>');
    const authGateElementIndex = appSource.indexOf('element={authState?.isAuthenticated');
    const authGateRouteStart = appSource.lastIndexOf('<Route', authGateElementIndex);
    const publicAfterAuthGateMatch = appSource.match(/<Route\s+path=['"]\/boolean\/search\/['"]/);
    const publicAfterAuthGateIndex = publicAfterAuthGateMatch ? publicAfterAuthGateMatch.index : -1;

    if (routesStartIndex === -1 || authGateRouteStart === -1 || publicAfterAuthGateIndex === -1) {
        throw new Error('Unable to locate the public route sections in src/App.jsx');
    }

    const publicBeforeAuthGate = appSource.slice(routesStartIndex, authGateRouteStart);
    const publicAfterAuthGate = appSource.slice(publicAfterAuthGateIndex);
    const authParentRouteMatch = publicAfterAuthGate.match(AUTH_PARENT_ROUTE_PATTERN);
    const authParentRouteBlock = authParentRouteMatch?.[0] || '';
    const publicAfterAuthGateWithoutAuthBlock = authParentRouteBlock
        ? publicAfterAuthGate.replace(authParentRouteBlock, '')
        : publicAfterAuthGate;

    const collected = ['/'];

    for (const routePath of extractPathProps(publicBeforeAuthGate)) {
        collected.push(formatRoutePath(routePath));
    }

    for (const routePath of extractPathProps(publicAfterAuthGateWithoutAuthBlock)) {
        collected.push(formatRoutePath(routePath));
    }

    if (authParentRouteBlock) {
        collected.push('/auth/');

        const authChildPaths = extractPathProps(authParentRouteBlock)
            .slice(1)
            .map((childPath) => formatRoutePath(`auth/${childPath}`));

        if (INDEX_ROUTE_PATTERN.test(authParentRouteBlock)) {
            collected.push('/auth/');
        }

        collected.push(...authChildPaths);
    }

    const dedupedRoutes = [];
    const seen = new Set();

    for (const routePath of collected) {
        if (!shouldIncludeRoute(routePath)) continue;

        const comparablePath = normalizeComparablePath(routePath);
        if (seen.has(comparablePath)) continue;

        seen.add(comparablePath);
        dedupedRoutes.push(routePath);
    }

    return dedupedRoutes.map((routePath) => ({
        path: routePath,
        changefreq: getRouteChangefreq(routePath),
        priority: getRoutePriority(routePath),
    }));
};

const routes = collectPublicRoutesFromApp();

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
        .map(
            ({ path: routePath, changefreq, priority }) => `  <url>
    <loc>${new URL(routePath, `${siteUrl}/`).toString()}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
        )
        .join('\n')}
</urlset>
`;

const robots = `User-agent: *
${allowIndexing ? 'Allow: /' : 'Disallow: /'}

Sitemap: ${siteUrl}/sitemap.xml
`;

fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap, 'utf8');
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots, 'utf8');

fs.writeFileSync(path.join(staticDir, 'sitemap.xml'), sitemap, 'utf8');
fs.writeFileSync(path.join(staticDir, 'robots.txt'), robots, 'utf8');
