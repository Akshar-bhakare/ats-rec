import { Box, Container, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

const LOGOS = [
    'TechCorp', 'GlobalHealth', 'FinancePlus', 'EduSystems', 'RetailX', 'LogisticsPro', 'DataFlow', 'CloudSys', 'BioGen', 'FutureWorks'
];

const SocialProof = () => {
    const theme = useTheme();

    return (
        <Box sx={{ py: 6, bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#f8fafc', borderBottom: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
            <Container>
                <Typography
                    variant="body2"
                    align="center"
                    color="text.secondary"
                    sx={{ mb: 4, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, fontSize: '0.75rem', opacity: 0.7 }}
                >
                    Trusted by our clients
                </Typography>

                <Box sx={{ display: 'flex', maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
                    <motion.div
                        animate={{ x: ["0%", "-50%"] }}
                        transition={{ duration: 30, ease: "linear", repeat: Infinity }}
                        style={{ display: 'flex', gap: '4rem', whiteSpace: 'nowrap' }}
                    >
                        {[...LOGOS, ...LOGOS].map((logo, index) => (
                            <Typography
                                key={index}
                                variant="h5"
                                sx={{
                                    fontWeight: 800,
                                    color: theme.palette.text.disabled,
                                    opacity: 0.5,
                                    transition: 'color 0.3s',
                                    cursor: 'default',
                                    '&:hover': {
                                        color: theme.palette.primary.main,
                                        opacity: 1
                                    }
                                }}
                            >
                                {logo}
                            </Typography>
                        ))}
                    </motion.div>
                </Box>
            </Container>
        </Box>
    );
};

export default SocialProof;
