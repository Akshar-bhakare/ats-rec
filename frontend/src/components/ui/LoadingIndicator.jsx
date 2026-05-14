import { Box, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { alpha, useTheme } from "@mui/material/styles";

const barVariants = {
    animate: {
        height: [14, 34, 18, 44, 20],
        transition: {
            duration: 1.8,
            repeat: Infinity,
            ease: "easeInOut",
        },
    },
};

const LoadingIndicator = ({ label = "Analyzing", tone = "primary" }) => {
    const theme = useTheme();
    const palette = theme.palette[tone] || theme.palette.primary;

    return (
        <Box
            sx={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                px: 2.2,
                py: 1.6,
                borderRadius: theme.shape.borderRadius * 1.2,
                backgroundColor: alpha(theme.palette.background.paper, 0.88),
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                backdropFilter: "blur(16px)",
            }}
        >
            <Box
                sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: palette.main,
                    opacity: 0.9,
                }}
            />
            <Box
                sx={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 0.5,
                    height: 44,
                }}
            >
                {Array.from({ length: 5 }).map((_, idx) => (
                    <Box
                        key={idx}
                        component={motion.div}
                        variants={barVariants}
                        animate="animate"
                        transition={{ delay: idx * 0.12 }}
                        sx={{
                            width: 4.5,
                            borderRadius: theme.shape.borderRadius,
                            background: `linear-gradient(180deg, ${alpha(
                                palette.light || theme.palette.primary.light,
                                0.9,
                            )}, ${palette.main || theme.palette.primary.main})`,
                            opacity: idx === 2 ? 1 : 0.85,
                        }}
                    />
                ))}
            </Box>
            <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 2 }}>
                {label}
            </Typography>
        </Box>
    );
};

export default LoadingIndicator;
