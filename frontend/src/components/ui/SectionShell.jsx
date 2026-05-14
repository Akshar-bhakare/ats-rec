import { forwardRef } from "react";
import { Box, Container } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

const SectionShell = forwardRef(
    (
        {
            children,
            id,
            gradient = false,
            maxWidth = "lg",
            padded = true,
            grid = false,
            tone = "default",
            containerProps = {},
            sx = {},
            ...rest
        },
        ref,
    ) => {
        const theme = useTheme();
        const background =
            gradient && tone === "default"
                ? `linear-gradient(135deg, ${alpha(
                    theme.palette.primary.main,
                    0.12,
                )} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`
                : gradient && tone === "surface"
                    ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.96)} 0%, ${alpha(
                        theme.palette.background.default,
                        0.9,
                    )} 100%)`
                    : "transparent";

        const gridOverlay = `linear-gradient(${alpha(
            theme.palette.divider,
            0.6,
        )} 1px, transparent 1px), linear-gradient(90deg, ${alpha(
            theme.palette.divider,
            0.6,
        )} 1px, transparent 1px)`;

        return (
            <Box
                ref={ref}
                component="section"
                id={id}
                sx={{
                    position: "relative",
                    py: padded ? { xs: 9, md: 13 } : 0,
                    overflow: "hidden",
                    background,
                    "&::before": gradient
                        ? {
                            content: '""',
                            position: "absolute",
                            inset: 0,
                            opacity: tone === "surface" ? 0.55 : theme.palette.mode === "dark" ? 0.65 : 0.42,
                            background: gradient ? background : "transparent",
                            filter: tone === "surface" ? "blur(40px)" : "blur(70px)",
                            transform: "scale(1.02)",
                        }
                        : undefined,
                    "&::after": grid
                        ? {
                            content: '""',
                            position: "absolute",
                            inset: 0,
                            backgroundImage: gridOverlay,
                            backgroundSize: "56px 56px",
                            opacity: 0.15,
                            pointerEvents: "none",
                        }
                        : undefined,
                    ...sx,
                }}
                {...rest}
            >
                <Container
                    maxWidth={maxWidth}
                    sx={{ position: "relative", zIndex: 1 }}
                    {...containerProps}
                >
                    {children}
                </Container>
            </Box>
        );
    },
);

export default SectionShell;
