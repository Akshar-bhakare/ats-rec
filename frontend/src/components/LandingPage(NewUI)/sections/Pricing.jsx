import { Box, Container, Grid, Typography, Card, CardContent, Button, List, ListItem, ListItemIcon, ListItemText, Accordion, AccordionSummary, AccordionDetails, Divider, useTheme, useMediaQuery } from '@mui/material';
import { PACKAGES } from '../lib/constants';
import SectionHeading from '../components/ui/SectionHeading';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';

const Pricing = () => {
    const theme = useTheme();

    return (
        <Box id="pricing" sx={{ py: 12, position: 'relative', overflow: 'hidden' }}>
            {/* Design Background Gradients */}
            <Box sx={{
                position: 'absolute',
                top: '20%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '80%',
                height: '60%',
                background: theme.palette.mode === 'dark'
                    ? `radial-gradient(circle, ${theme.palette.primary.main}08 0%, transparent 70%)`
                    : `radial-gradient(circle, ${theme.palette.primary.main}03 0%, transparent 70%)`,
                zIndex: 0,
                pointerEvents: 'none'
            }} />

            <Container sx={{ position: 'relative', zIndex: 1 }}>
                <SectionHeading
                    title="Flexible Commercial Packaging for AI Hiring Teams"
                    subtitle="Hirex REC pricing is tailored to your hiring volume, workflow complexity, and deployment needs. Use this page as a planning guide, then contact us for a scoped proposal."
                />

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                        gap: 3,
                        mb: 12,
                        mt: 4
                    }}
                >
                    {PACKAGES.map((plan, index) => {
                        return (
                            <Card
                                key={index}
                                component={motion.div}
                                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                                sx={{
                                    borderRadius: 8,
                                    position: 'relative',
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    border: `1px solid ${plan.popular ? theme.palette.primary.main : theme.palette.divider}`,
                                    background: theme.palette.mode === 'dark'
                                        ? (plan.popular ? 'rgba(236, 103, 39, 0.05)' : 'rgba(10, 10, 12, 0.6)')
                                        : (plan.popular ? 'rgba(236, 103, 39, 0.02)' : 'rgba(255, 255, 255, 0.8)'),
                                    backdropFilter: 'blur(20px)',
                                    overflow: 'visible',
                                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                    '&:hover': {
                                        boxShadow: plan.popular
                                            ? `0 30px 60px -12px ${theme.palette.primary.main}40`
                                            : '0 30px 60px -12px rgba(0, 0, 0, 0.1)',
                                    }
                                }}
                            >
                                {plan.popular && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: -16,
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            bgcolor: 'primary.main',
                                            color: 'white',
                                            px: 3,
                                            py: 0.75,
                                            borderRadius: '20px',
                                            fontSize: '0.7rem',
                                            fontWeight: 900,
                                            letterSpacing: '1.5px',
                                            boxShadow: `0 4px 12px ${theme.palette.primary.main}60`,
                                            zIndex: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5
                                        }}
                                    >
                                        <Sparkles size={12} /> RECOMMENDED
                                    </Box>
                                )}

                                <CardContent sx={{ p: { xs: 4, md: 4 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <Typography
                                        variant="overline"
                                        sx={{
                                            fontWeight: 900,
                                            color: plan.popular ? 'primary.main' : 'text.secondary',
                                            letterSpacing: 2.5,
                                            mb: 3,
                                            display: 'block',
                                            fontSize: '0.7rem'
                                        }}
                                    >
                                        PACKAGE
                                    </Typography>

                                    <Typography variant="h5" fontWeight="900" sx={{ color: 'text.primary', mb: 4, letterSpacing: '-0.02em' }}>
                                        {plan.title}
                                    </Typography>

                                    <Divider sx={{ mb: 4, opacity: 0.5 }} />

                                    <List sx={{ mb: 5, flex: 1, p: 0 }}>
                                        {plan.features.map((feature, i) => (
                                            <ListItem key={i} disableGutters sx={{ alignItems: 'flex-start', py: 1 }}>
                                                <ListItemIcon sx={{ minWidth: 26, mt: 0.5 }}>
                                                    <Check size={16} color={theme.palette.primary.main} strokeWidth={3} />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={feature}
                                                    primaryTypographyProps={{
                                                        fontSize: '0.85rem',
                                                        fontWeight: 600,
                                                        color: 'text.secondary',
                                                        lineHeight: 1.4
                                                    }}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>

                                    <Button
                                        component={RouterLink}
                                        to="/pricing"
                                        variant={plan.popular ? 'contained' : 'outlined'}
                                        fullWidth
                                        size="large"
                                        sx={{
                                            py: 1.5,
                                            borderRadius: 3,
                                            fontWeight: 900,
                                            textTransform: 'none',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                            ...(plan.popular ? {
                                                bgcolor: 'primary.main',
                                                '&:hover': { bgcolor: 'primary.dark', transform: 'translateY(-3px)', boxShadow: `0 10px 20px ${theme.palette.primary.main}30` }
                                            } : {
                                                borderColor: theme.palette.divider,
                                                color: 'text.primary',
                                                '&:hover': { bgcolor: 'rgba(236, 103, 39, 0.05)', borderColor: 'primary.main', transform: 'translateY(-3px)' }
                                            })
                                        }}
                                    >
                                        Contact Us for Pricing
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Box>

                {/* FAQ Section */}
                <Box sx={{ maxWidth: 900, mx: 'auto' }}>
                    <Typography variant="h3" align="center" gutterBottom fontWeight="900" sx={{ mb: 6, letterSpacing: '-0.02em' }}>
                        Platform Knowledge Base
                    </Typography>
                    {[
                        { q: "Can Hirex REC integrate with the enterprise ATS we use?", a: "Hirex REC is designed to support integration planning with modern recruiting workflows and common ATS environments." },
                        { q: "How secure is the candidate data processed by the AI?", a: "Candidate data is protected through GDPR- and DPDP-aligned data handling practices, end-to-end encryption, and strict access controls. Personally identifiable information (PII) is redacted during evaluation phases to support privacy and compliance." },
                        { q: "How are the packages structured?", a: "Our packages are structured around service capability and infrastructure requirements rather than static seat counts, allowing your team to scale fluidly as hiring needs change." }
                    ].map((faq, i) => (
                        <Accordion key={i} sx={{
                            mb: 2,
                            boxShadow: 'none',
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: '16px!important',
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'transparent',
                            '&:before': { display: 'none' }
                        }}>
                            <AccordionSummary expandIcon={<ChevronDown size={20} />}>
                                <Typography variant="h6" fontWeight="800">{faq.q}</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography color="text.secondary" variant="body1" sx={{ lineHeight: 1.7 }}>
                                    {faq.a}
                                </Typography>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Box>
            </Container>
        </Box>
    );
};

export default Pricing;
