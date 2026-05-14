import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.2,
            delayChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            damping: 20,
            stiffness: 100
        }
    }
};

const SectionHeading = ({ title, subtitle, align = 'center', sx = {} }) => {
    return (
        <Box
            component={motion.div}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            sx={{
                mb: 8,
                textAlign: align,
                position: 'relative',
                zIndex: 2,
                ...sx
            }}
        >
            <motion.div variants={itemVariants}>
                <Typography
                    variant="h2"
                    component="h2"
                    sx={{
                        mb: 2,
                        background: '-webkit-linear-gradient(135deg, #EC6727 0%, #3478BC 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        pb: 1
                    }}
                >
                    {title}
                </Typography>
            </motion.div>

            {subtitle && (
                <motion.div variants={itemVariants}>
                    <Typography
                        variant="subtitle1"
                        color="text.secondary"
                        sx={{
                            maxWidth: align === 'center' ? 700 : '100%',
                            mx: align === 'center' ? 'auto' : 0,
                            fontSize: '1.25rem',
                            lineHeight: 1.6,
                            opacity: 0.9
                        }}
                    >
                        {subtitle}
                    </Typography>
                </motion.div>
            )}

            {/* Decorative animated underline */}
            <Box
                component={motion.div}
                initial={{ scaleX: 0, opacity: 0 }}
                whileInView={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4, ease: "circOut" }}
                sx={{
                    width: 80,
                    height: 6,
                    borderRadius: 4,
                    background: 'linear-gradient(90deg, #EC6727 0%, #3478BC 100%)',
                    mx: align === 'center' ? 'auto' : 0,
                    mt: 3,
                    transformOrigin: align === 'left' ? 'left' : 'center'
                }}
            />
        </Box>
    );
};

export default SectionHeading;
