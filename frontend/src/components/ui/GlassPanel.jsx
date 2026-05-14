import { forwardRef } from "react";
import { Paper } from "@mui/material";
import { motion } from "framer-motion";
import { alpha, useTheme } from "@mui/material/styles";

const surfaceByVariant = (theme, variant) => {
    const borderColor = alpha(theme.palette.primary.main, 0.18);
    switch (variant) {
        case "outline":
            return {
                background: "transparent",
                border: `1px solid ${borderColor}`,
                boxShadow: "none",
            };
        case "translucent":
            return {
                background: `linear-gradient(150deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(
                    theme.palette.background.default,
                    0.9,
                )} 100%)`,
                border: `1px solid ${borderColor}`,
                boxShadow: theme.shadows[1],
            };
        case "elevated":
        default:
            return {
                background: theme.palette.background.paper,
                border: `1px solid ${borderColor}`,
                boxShadow: theme.shadows[2],
            };
    }
};

const GlassPanel = forwardRef(
    (
        {
            children,
            variant = "elevated",
            hoverMotion = true,
            component = motion.div,
            grid = false,
            sx = {},
            ...rest
        },
        ref,
    ) => {
        const theme = useTheme();
        const surface = surfaceByVariant(theme, variant);

        const motionProps = hoverMotion && component === motion.div
            ? {
                whileHover: { y: -4 },
                whileTap: { scale: 0.98 },
            }
            : {};

        const gridOverlay = `linear-gradient(${alpha(
            theme.palette.divider,
            0.6,
        )} 1px, transparent 1px), linear-gradient(90deg, ${alpha(
            theme.palette.divider,
            0.6,
        )} 1px, transparent 1px)`;

        return (
            <Paper
                ref={ref}
                component={component}
                {...motionProps}
                sx={{
                    borderRadius: theme.shape.borderRadius,
                    backdropFilter: "blur(22px)",
                    padding: { xs: 3, md: 5.5 },
                    position: "relative",
                    overflow: "hidden",
                    "&::before": grid
                        ? {
                            content: '""',
                            position: "absolute",
                            inset: 0,
                            backgroundImage: gridOverlay,
                            backgroundSize: "48px 48px",
                            opacity: 0.18,
                            pointerEvents: "none",
                        }
                        : undefined,
                    ...surface,
                    ...sx,
                }}
                {...rest}
            >
                {children}
            </Paper>
        );
    },
);

export default GlassPanel;
