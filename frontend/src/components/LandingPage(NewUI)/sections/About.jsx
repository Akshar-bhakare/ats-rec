import { Box, Container, Grid, Typography, Avatar, Link, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { TEAM_MEMBERS } from '../lib/constants';
import SectionHeading from '../components/ui/SectionHeading';
import { Linkedin } from 'lucide-react';

const About = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box
            id="about"
            sx={{
                py: 12,
                backgroundColor: isDark ? '#020617' : '#f8fafc',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Background elements */}
            <Box
                sx={{
                    position: 'absolute',
                    top: '10%',
                    right: '-5%',
                    width: '400px',
                    height: '400px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${theme.palette.primary.main}10 0%, transparent 70%)`,
                    filter: 'blur(80px)',
                    zIndex: 0
                }}
            />

            <Container sx={{ position: 'relative', zIndex: 1 }}>
                <SectionHeading
                    title="The Humans Behind the AI"
                    subtitle="We believe technology should enhance human potential, not replace it. Meet the team bridging the gap between efficiency and empathy."
                    align="center"
                />

                <Grid container spacing={4} sx={{ mt: 4 }}>
                    {TEAM_MEMBERS.map((member, index) => (
                        <Grid item xs={12} md={4} key={index}>
                            <Box
                                component={motion.div}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1, duration: 0.5 }}
                                sx={{
                                    p: 4,
                                    height: '100%',
                                    borderRadius: 6,
                                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : theme.palette.divider}`,
                                    background: isDark ? 'rgba(30, 41, 59, 0.4)' : '#ffffff',
                                    backdropFilter: 'blur(10px)',
                                    textAlign: 'center',
                                    transition: 'transform 0.3s ease',
                                    '&:hover': {
                                        transform: 'translateY(-10px)',
                                        borderColor: theme.palette.primary.main
                                    }
                                }}
                            >
                                <Avatar
                                    src={member.image}
                                    sx={{
                                        width: 120,
                                        height: 120,
                                        mx: 'auto',
                                        mb: 3,
                                        border: `4px solid ${theme.palette.primary.main}20`,
                                        boxShadow: `0 20px 40px ${theme.palette.primary.main}15`
                                    }}
                                />
                                <Typography variant="h5" fontWeight={800} gutterBottom>
                                    {member.name}
                                </Typography>
                                <Typography
                                    variant="subtitle2"
                                    color="primary"
                                    fontWeight={900}
                                    sx={{ letterSpacing: 1.5, mb: 2, textTransform: 'uppercase' }}
                                >
                                    {member.role}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
                                    {member.bio}
                                </Typography>
                                <Link
                                    href={member.linkedin}
                                    target="_blank"
                                    sx={{
                                        color: 'text.secondary',
                                        '&:hover': { color: 'primary.main' },
                                        display: 'inline-flex'
                                    }}
                                >
                                    <Linkedin size={20} />
                                </Link>
                            </Box>
                        </Grid>
                    ))}
                </Grid>

                {/* Mission Statement */}
                <Box
                    component={motion.div}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    sx={{
                        mt: 12,
                        p: { xs: 4, md: 8 },
                        borderRadius: 8,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}15 100%)`,
                        border: `1px solid ${theme.palette.primary.main}20`,
                        textAlign: 'center'
                    }}
                >
                    <Typography variant="h4" fontWeight={900} gutterBottom>
                        "Turning Hiring into a Well-Run System"
                    </Typography>
                    <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 800, mx: 'auto', fontWeight: 500, lineHeight: 1.6 }}>
                        Our mission is to empower recruitment teams with high-speed intelligence while preserving the human connection that defines every great hire.
                    </Typography>
                </Box>
            </Container>
        </Box>
    );
};

export default About;
