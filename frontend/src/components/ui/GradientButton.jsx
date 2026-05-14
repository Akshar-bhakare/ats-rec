import { forwardRef } from "react";
import { Button } from "@mui/material";
import { motion } from "framer-motion";
import { alpha, useTheme } from "@mui/material/styles";

const GradientButton = forwardRef(
    (
        {
            children,
            size = "large",
            variant = "contained",
            component,
            endIcon,
            startIcon,
            shimmer = false,
            sx = {},
            ...rest
        },
        ref,
    ) => {
        const theme = useTheme();
        const resolvedComponent = component || motion.button;
        const motionProps = component
            ? {}
            : {
                whileHover: { y: -2 },
                whileTap: { scale: 0.98 },
            };

        return (
            <Button
                ref={ref}
                size={size}
                variant={variant}
                component={resolvedComponent}
                {...motionProps}
                startIcon={startIcon}
                endIcon={endIcon}
                sx={{
                    position: "relative",
                    overflow: "hidden",
                    "&::after": shimmer
                        ? {
                            content: '""',
                            position: "absolute",
                            inset: 0,
                            backgroundImage: `linear-gradient(120deg, transparent, ${alpha(
                                theme.palette.primary.light,
                                0.45,
                            )}, transparent)`,
                            backgroundSize: "200% 100%",
                            animation: "buttonShimmer 2.4s ease-in-out infinite",
                            opacity: 0.65,
                        }
                        : undefined,
                    "@keyframes buttonShimmer": {
                        "0%": { backgroundPosition: "200% 0%" },
                        "100%": { backgroundPosition: "-200% 0%" },
                    },
                    ...sx,
                }}
                {...rest}
            >
                {children}
            </Button>
        );
    },
);

export default GradientButton;
