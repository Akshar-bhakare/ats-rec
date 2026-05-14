import { Grid, Stack, Typography } from '@mui/material';
import { ArrowRight } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import SeoHead from '../components/ui/SeoHead';
import SectionHeading from '../components/ui/SectionHeading';
import GlassPanel from '../../ui/GlassPanel';
import GradientButton from '../../ui/GradientButton';
import { blogIndexPage } from './marketingContent';
import SectionShell from '../../ui/SectionShell';
import {
    buildBlogSchema,
    buildWebPageSchema,
    resolveSiteOrigin,
} from '../lib/seoSchema';

const BlogIndexPage = () => {
    const page = blogIndexPage;
    const siteOrigin = resolveSiteOrigin();
    const structuredData = [
        buildWebPageSchema({
            siteOrigin,
            pathname: page.pathname,
            title: page.seo.title,
            description: page.seo.description,
        }),
        buildBlogSchema(siteOrigin),
    ];

    return (
        <>
            <SeoHead
                title={page.seo.title}
                description={page.seo.description}
                pathname={page.pathname}
                structuredData={structuredData}
            />

            <SectionShell gradient grid maxWidth="xl" sx={{ pt: { xs: 14, md: 18 }, pb: { xs: 10, md: 12 } }}>
                <Stack spacing={3} maxWidth={860}>
                    <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 900, letterSpacing: 2 }}>
                        {page.hero.eyebrow}
                    </Typography>
                    <Typography component="h1" variant="h1">
                        {page.hero.title}
                    </Typography>
                    <Typography variant="h5" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {page.hero.description}
                    </Typography>
                </Stack>
            </SectionShell>

            <SectionShell>
                <SectionHeading title="Featured articles" align="left" />
                <Grid container spacing={3}>
                    {page.featuredPosts.map((post) => (
                        <Grid item xs={12} md={6} key={post.to}>
                            <GlassPanel
                                component={RouterLink}
                                to={post.to}
                                variant="translucent"
                                sx={{
                                    display: 'block',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    height: '100%',
                                }}
                            >
                                <Typography variant="h4" sx={{ mb: 1.5, fontWeight: 800 }}>
                                    {post.title}
                                </Typography>
                                <Typography color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.8 }}>
                                    {post.description}
                                </Typography>
                                <Typography sx={{ color: 'primary.main', fontWeight: 800 }}>
                                    Read article
                                </Typography>
                            </GlassPanel>
                        </Grid>
                    ))}
                </Grid>
            </SectionShell>

            <SectionShell gradient>
                <Stack spacing={2} alignItems="center" textAlign="center">
                    <Typography variant="h3" sx={{ fontWeight: 900 }}>
                        Looking for commercial use cases too?
                    </Typography>
                    <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 760 }}>
                        Move from educational content into platform pages for AI ATS workflows, automated recruitment, and AI talent acquisition.
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <GradientButton component={RouterLink} to="/features" endIcon={<ArrowRight size={18} />} shimmer>
                            View features
                        </GradientButton>
                        <GradientButton component={RouterLink} to="/ai-talent-acquisition" variant="outlined">
                            Explore AI talent acquisition
                        </GradientButton>
                    </Stack>
                </Stack>
            </SectionShell>
        </>
    );
};

export default BlogIndexPage;
