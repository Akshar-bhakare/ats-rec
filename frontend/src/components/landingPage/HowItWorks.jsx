import React from 'react';
import { Box, Container, Typography, Stack } from '@mui/material';
import { motion } from 'framer-motion';
import LogoDevIcon from '@mui/icons-material/LogoDev';

const steps = [
    { number: "01", title: "Material as a Metaphor" },
    { number: "02", title: "Bold, Intentional Graphics" },
    { number: "03", title: "Responsive Design" },
    { number: "04", title: "Motion with Purpose" },
    { number: "05", title: "Maintains Visual Continuity" },
];

const fanMotion = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.6 }
};

const DesignPrinciples = () => {
    return (
        <Box
            sx={{
                py: { xs: 8, md: 12 },
                background: 'linear-gradient(180deg, #F8FAFF, #EEF4FF)',
                position: 'relative',
            }}
        >
            <Container maxWidth="lg" sx={{ textAlign: 'center' }}>

                <Typography
                    component={motion.h2}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    sx={{
                        fontSize: { xs: 26, sm: 34, md: 42 },
                        fontWeight: 800,
                        mb: 6,
                        color: '#0A1320',
                    }}
                >
                    Material Design Principles
                </Typography>

                {/* Fan Layout Wrapper */}
                <Box
                    sx={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: 650,
                        mx: 'auto',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                    }}
                >

                    {/* Center Logo Circle */}
                    <Box
                        sx={{
                            width: 120,
                            height: 120,
                            borderRadius: '50%',
                            background: '#fff',
                            boxShadow: '0 6px 26px rgba(0,0,0,0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2,
                            position: 'relative',
                            mb: { xs: 4, md: 0 },
                        }}
                        component={motion.div}
                        {...fanMotion}
                    >
                        <LogoDevIcon sx={{ fontSize: 60, color: '#1976d2' }} />
                    </Box>

                    {/* Steps Positioned around the Logo */}
                    <Box
                        sx={{
                            width: '100%',
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            mt: { xs: 5, md: -9 },
                            px: { xs: 0, sm: 2 },
                        }}
                    >
                        {steps.map((step, index) => (
                            <Stack
                                key={step.number}
                                component={motion.div}
                                {...fanMotion}
                                transition={{ duration: 0.6, delay: index * 0.05 }}
                                alignItems="center"
                                sx={{
                                    flexBasis: { xs: '50%', md: '20%' },
                                    pb: { xs: 3, md: 0 },
                                }}
                            >
                                <Box
                                    sx={{
                                        background: '#fff',
                                        borderRadius: 3,
                                        px: 3,
                                        py: 2,
                                        textAlign: 'center',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                                        minWidth: 110,
                                    }}
                                >
                                    <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#1976d2' }}>
                                        {step.number}
                                    </Typography>
                                    <Typography sx={{ fontSize: 13, mt: 0.5 }}>
                                        {step.title}
                                    </Typography>
                                </Box>
                            </Stack>
                        ))}
                    </Box>
                </Box>
            </Container>
        </Box>
    );
};

export default DesignPrinciples;
