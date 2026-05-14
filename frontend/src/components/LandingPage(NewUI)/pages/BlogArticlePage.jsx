import { useEffect, useRef, useState } from 'react';
import {
    Box,
    Breadcrumbs,
    Container,
    Divider,
    Link,
    List,
    ListItemButton,
    ListItemText,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    alpha,
    useTheme,
} from '@mui/material';
import { ArrowRight, CheckCircle2, ChevronRight, ExternalLink } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import SeoHead from '../components/ui/SeoHead';
import GradientButton from '../../ui/GradientButton';
import {
    buildBlogPostingSchema,
    buildWebPageSchema,
    resolveSiteOrigin,
} from '../lib/seoSchema';

const ARTICLE_FONT = '"Inter", "Segoe UI", sans-serif';

const toSectionId = (value = '') =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const buildSourceHref = (source = '') =>
    `https://www.google.com/search?q=${encodeURIComponent(source)}`;

const normalizeSourceItem = (source) =>
    typeof source === 'string'
        ? { label: source, href: buildSourceHref(source) }
        : {
            label: source?.label || '',
            href: source?.href || buildSourceHref(source?.label || ''),
        };

const BlogArticlePage = ({ article }) => {
    const theme = useTheme();
    const [activeTab, setActiveTab] = useState('');
    const scrollContainerRef = useRef(null);

    if (!article) return null;

    const siteOrigin = resolveSiteOrigin();
    const structuredData = [
        buildWebPageSchema({
            siteOrigin,
            pathname: article.pathname,
            title: article.seo.title,
            description: article.seo.description,
        }),
        buildBlogPostingSchema({
            siteOrigin,
            pathname: article.pathname,
            title: article.seo.title,
            description: article.seo.description,
        }),
    ];

    const sections = [
        {
            id: 'overview',
            title: 'Overview',
            intro: article.intro,
            paragraphs: [],
            bullets: article.keyTakeaways || [],
        },
        ...article.sections.map((section) => ({
            ...section,
            id: toSectionId(section.title),
        })),
        ...(article.sources?.length
            ? [{
                id: 'sources',
                title: 'Sources & Further Reading',
                paragraphs: article.sources,
            }]
            : []),
    ];

    useEffect(() => {
        setActiveTab(sections[0]?.id || '');
    }, [article.pathname]);

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;

        const container = scrollContainerRef.current;
        const scrollPosition = container.scrollTop + 120;

        for (const section of sections) {
            const element = document.getElementById(section.id);
            if (!element) continue;

            const { offsetTop, offsetHeight } = element;
            if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
                setActiveTab(section.id);
                break;
            }
        }
    };

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element && scrollContainerRef.current) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
            setActiveTab(id);
        }
    };

    return (
        <>
            <SeoHead
                title={article.seo.title}
                description={article.seo.description}
                pathname={article.pathname}
                structuredData={structuredData}
            />

            <Box
                sx={{
                    width: '100%',
                    minHeight: '100vh',
                    background: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <Box
                    sx={{
                        px: { xs: 2, md: 4 },
                        py: { xs: 2, md: 2.2 },
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        bgcolor: alpha(theme.palette.background.paper, 0.82),
                        backdropFilter: 'blur(20px)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 2,
                        zIndex: 10,
                    }}
                >
                    <Box sx={{ minWidth: 0 }}>
                        <Breadcrumbs separator={<ChevronRight size={14} />} sx={{ mb: 0.7 }}>
                            <Link component={RouterLink} underline="hover" color="inherit" to="/" sx={{ fontSize: '0.85rem' }}>
                                Home
                            </Link>
                            <Link component={RouterLink} underline="hover" color="inherit" to="/blog" sx={{ fontSize: '0.85rem' }}>
                                Blog
                            </Link>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'primary.main' }}>
                                {article.hero.title}
                            </Typography>
                        </Breadcrumbs>
                        <Typography
                            sx={{
                                fontFamily: ARTICLE_FONT,
                                fontSize: { xs: '1.55rem', md: '1.95rem' },
                                fontWeight: 800,
                                letterSpacing: '-0.04em',
                                color: '#182033',
                                lineHeight: 1.08,
                                maxWidth: 980,
                            }}
                        >
                            {article.hero.title}
                        </Typography>
                    </Box>

                    <Stack direction="row" spacing={2} alignItems="center" sx={{ flexShrink: 0, pt: 0.5, display: { xs: 'none', md: 'flex' } }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                            HIREXIT BLOG
                        </Typography>
                    </Stack>
                </Box>

                <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
                    <Box
                        sx={{
                            display: { xs: 'none', md: 'block' },
                            width: 360,
                            flexShrink: 0,
                            borderRight: `1px solid ${theme.palette.divider}`,
                            bgcolor: alpha('#ffffff', 0.72),
                            overflowY: 'auto',
                            px: 2.5,
                            py: 3,
                        }}
                    >
                        <Typography
                            sx={{
                                fontFamily: ARTICLE_FONT,
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                letterSpacing: '0.12em',
                                color: '#64748b',
                                textTransform: 'uppercase',
                                mb: 2.4,
                            }}
                        >
                            Document Sections
                        </Typography>

                        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.7 }}>
                            {sections.map((section) => {
                                const isActive = activeTab === section.id || (!activeTab && section.id === 'overview');

                                return (
                                    <ListItemButton
                                        key={section.id}
                                        component="button"
                                        onClick={() => scrollToSection(section.id)}
                                        sx={{
                                            borderRadius: '18px',
                                            px: 2,
                                            py: 1.5,
                                            bgcolor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                                            border: `1px solid ${isActive ? alpha(theme.palette.primary.main, 0.16) : 'transparent'}`,
                                        }}
                                    >
                                        <ListItemText
                                            primary={section.title}
                                            primaryTypographyProps={{
                                                fontFamily: ARTICLE_FONT,
                                                fontSize: '0.88rem',
                                                lineHeight: 1.45,
                                                color: isActive ? 'primary.main' : '#51627d',
                                                fontWeight: isActive ? 800 : 600,
                                            }}
                                        />
                                    </ListItemButton>
                                );
                            })}
                        </List>
                    </Box>

                    <Box
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        sx={{
                            flexGrow: 1,
                            overflowY: 'auto',
                            px: { xs: 2, md: 4 },
                            py: { xs: 2.5, md: 3.5 },
                        }}
                    >
                        <Container sx={{ maxWidth: '1180px !important', px: 0 }}>
                            <Stack spacing={3.2}>
                                <Paper
                                    id="overview"
                                    elevation={0}
                                    sx={{
                                        p: { xs: 2.2, md: 3 },
                                        borderRadius: '24px',
                                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                        bgcolor: '#ffffff',
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontFamily: ARTICLE_FONT,
                                            fontSize: { xs: '1.25rem', md: '1.45rem' },
                                            fontWeight: 800,
                                            color: '#182033',
                                            mb: 1.4,
                                            letterSpacing: '-0.03em',
                                        }}
                                    >
                                        Overview
                                    </Typography>
                                    <Typography
                                        sx={{
                                            color: '#51627d',
                                            fontFamily: ARTICLE_FONT,
                                            fontSize: { xs: '0.92rem', md: '0.98rem' },
                                            lineHeight: 1.85,
                                            mb: article.keyTakeaways?.length ? 1.8 : 0,
                                        }}
                                    >
                                        {article.intro}
                                    </Typography>
                                    {!!article.keyTakeaways?.length && (
                                        <Stack spacing={1}>
                                            {article.keyTakeaways.map((point) => (
                                                <Stack key={point} direction="row" spacing={1.1} alignItems="flex-start">
                                                    <Box sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }}>
                                                        <CheckCircle2 size={16} />
                                                    </Box>
                                                    <Typography
                                                        sx={{
                                                            color: '#51627d',
                                                            fontFamily: ARTICLE_FONT,
                                                            fontSize: { xs: '0.9rem', md: '0.95rem' },
                                                            lineHeight: 1.72,
                                                        }}
                                                    >
                                                        {point}
                                                    </Typography>
                                                </Stack>
                                            ))}
                                        </Stack>
                                    )}
                                </Paper>

                                {article.sections.map((section) => {
                                    const sectionId = toSectionId(section.title);

                                    return (
                                        <Paper
                                            key={sectionId}
                                            id={sectionId}
                                            elevation={0}
                                            sx={{
                                                p: { xs: 2.2, md: 3 },
                                                borderRadius: '24px',
                                                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                                                bgcolor: '#ffffff',
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontFamily: ARTICLE_FONT,
                                                    fontSize: { xs: '1.22rem', md: '1.42rem' },
                                                    fontWeight: 800,
                                                    color: '#182033',
                                                    mb: 1.4,
                                                    letterSpacing: '-0.03em',
                                                }}
                                            >
                                                {section.title}
                                            </Typography>

                                            {section.paragraphs.map((paragraph) => (
                                                <Typography
                                                    key={paragraph}
                                                    sx={{
                                                        color: '#51627d',
                                                        fontFamily: ARTICLE_FONT,
                                                        fontSize: { xs: '0.92rem', md: '0.98rem' },
                                                        lineHeight: 1.85,
                                                        mb: 1.5,
                                                    }}
                                                >
                                                    {paragraph}
                                                </Typography>
                                            ))}

                                            {!!section.table && (
                                                <TableContainer
                                                    sx={{
                                                        mt: 1.2,
                                                        mb: 1.6,
                                                        border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
                                                        borderRadius: '18px',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                                                                {section.table.columns.map((column) => (
                                                                    <TableCell
                                                                        key={column}
                                                                        sx={{
                                                                            fontFamily: ARTICLE_FONT,
                                                                            fontSize: '0.82rem',
                                                                            fontWeight: 800,
                                                                            color: '#182033',
                                                                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
                                                                        }}
                                                                    >
                                                                        {column}
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {section.table.rows.map((row, rowIndex) => (
                                                                <TableRow key={`${section.id || section.title}-row-${rowIndex}`}>
                                                                    {row.map((cell, cellIndex) => (
                                                                        <TableCell
                                                                            key={`${section.id || section.title}-cell-${rowIndex}-${cellIndex}`}
                                                                            sx={{
                                                                                fontFamily: ARTICLE_FONT,
                                                                                fontSize: '0.84rem',
                                                                                lineHeight: 1.6,
                                                                                color: '#51627d',
                                                                                verticalAlign: 'top',
                                                                                borderBottom: rowIndex === section.table.rows.length - 1
                                                                                    ? 'none'
                                                                                    : `1px solid ${alpha(theme.palette.divider, 0.75)}`,
                                                                            }}
                                                                        >
                                                                            {cell}
                                                                        </TableCell>
                                                                    ))}
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            )}

                                            {!!section.bullets?.length && (
                                                <Stack spacing={1.05} sx={{ mt: 0.4 }}>
                                                    {section.bullets.map((bullet) => (
                                                        <Stack key={bullet} direction="row" spacing={1.1} alignItems="flex-start">
                                                            <Box sx={{ color: 'primary.main', mt: 0.25, flexShrink: 0 }}>
                                                                <CheckCircle2 size={16} />
                                                            </Box>
                                                            <Typography
                                                                sx={{
                                                                    color: '#51627d',
                                                                    fontFamily: ARTICLE_FONT,
                                                                    fontSize: { xs: '0.9rem', md: '0.95rem' },
                                                                    lineHeight: 1.72,
                                                                }}
                                                            >
                                                                {bullet}
                                                            </Typography>
                                                        </Stack>
                                                    ))}
                                                </Stack>
                                            )}
                                        </Paper>
                                    );
                                })}

                                {!!article.sources?.length && (
                                    <Paper
                                        id="sources"
                                        elevation={0}
                                        sx={{
                                            p: { xs: 2.2, md: 3 },
                                            borderRadius: '24px',
                                            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                                            bgcolor: '#ffffff',
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                fontFamily: ARTICLE_FONT,
                                                fontSize: { xs: '1.15rem', md: '1.3rem' },
                                                fontWeight: 800,
                                                color: '#182033',
                                                mb: 1.4,
                                                letterSpacing: '-0.03em',
                                            }}
                                        >
                                            Sources & Further Reading
                                        </Typography>
                                        <Stack spacing={1}>
                                            {article.sources.map((source) => {
                                                const sourceItem = normalizeSourceItem(source);

                                                return (
                                                <Link
                                                    key={sourceItem.label}
                                                    href={sourceItem.href}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    underline="hover"
                                                    sx={{
                                                        color: 'primary.main',
                                                        fontFamily: ARTICLE_FONT,
                                                        fontSize: { xs: '0.9rem', md: '0.95rem' },
                                                        lineHeight: 1.72,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 0.8,
                                                        width: 'fit-content',
                                                        fontWeight: 600,
                                                        textDecorationColor: alpha(theme.palette.primary.main, 0.38),
                                                        textUnderlineOffset: '0.16em',
                                                        '&:hover': {
                                                            color: theme.palette.primary.dark,
                                                            textDecorationColor: theme.palette.primary.dark,
                                                        },
                                                    }}
                                                >
                                                    <ExternalLink size={14} />
                                                    {sourceItem.label}
                                                </Link>
                                                );
                                            })}
                                        </Stack>
                                    </Paper>
                                )}

                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: { xs: 2.2, md: 3 },
                                        borderRadius: '24px',
                                        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                                        bgcolor: '#ffffff',
                                    }}
                                >
                                    <Stack spacing={1.6}>
                                        <Typography
                                            sx={{
                                                fontFamily: ARTICLE_FONT,
                                                fontSize: { xs: '1.2rem', md: '1.4rem' },
                                                fontWeight: 800,
                                                color: '#182033',
                                                letterSpacing: '-0.03em',
                                            }}
                                        >
                                            {article.cta.title}
                                        </Typography>
                                        <Typography
                                            sx={{
                                                color: '#51627d',
                                                fontFamily: ARTICLE_FONT,
                                                fontSize: { xs: '0.9rem', md: '0.95rem' },
                                                lineHeight: 1.72,
                                            }}
                                        >
                                            {article.cta.description}
                                        </Typography>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                            <GradientButton component={RouterLink} to={article.cta.primary.to} endIcon={<ArrowRight size={18} />} shimmer>
                                                {article.cta.primary.label}
                                            </GradientButton>
                                            <GradientButton component={RouterLink} to={article.cta.secondary.to} variant="outlined">
                                                {article.cta.secondary.label}
                                            </GradientButton>
                                        </Stack>
                                    </Stack>
                                </Paper>
                            </Stack>
                        </Container>
                    </Box>
                </Box>
            </Box>
        </>
    );
};

export default BlogArticlePage;
