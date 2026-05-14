import { createTheme, responsiveFontSizes, alpha } from "@mui/material/styles";

export const getTheme = (mode = 'light') => {
    const isDark = mode === 'dark';

    const palette = {
        mode,
        primary: {
            main: "#E76F00",
            light: "#FEF1E5",
            dark: "#C65C00",
            contrastText: "#FFFFFF",
        },
        secondary: {
            main: "#7A7A7A",
            light: "#F1F1F1",
            dark: "#5D5D5D",
            contrastText: "#FFFFFF",
        },
        background: {
            default: isDark ? "#0F172A" : "#F6F6F6",
            paper: isDark ? "#1E293B" : "#FFFFFF",
        },
        text: {
            primary: isDark ? "#F1F5F9" : "#2B2F36",
            secondary: isDark ? "#94A3B8" : "#667080",
        },
        divider: isDark ? "#334155" : "#CDD3DB",
        success: {
            main: "#13A34A",
            light: "#DEEEE1",
            dark: "#0E7A37",
            contrastText: "#FFFFFF",
        },
        info: {
            main: "#5F6E86",
            light: "#EEF2F7",
            dark: "#4C5A6F",
            contrastText: "#FFFFFF",
        },
        warning: {
            main: "#DB610E",
            light: "#FFF4E5",
            dark: "#B3520C",
            contrastText: "#FFFFFF",
        },
        error: {
            main: "#D32F2F",
            light: "#FDEDED",
            dark: "#B42929",
            contrastText: "#FFFFFF",
        },
        grey: {
            50: "#FFFFFF",
            100: "#F3F4F6",
            200: "#E3E8F1",
            300: "#CBD5E1",
            400: "#94A3B8",
            500: "#65748B",
            600: "#334155",
            700: "#232943",
            800: "#1C233A",
            900: "#111827",
        },
    };

    const theme = createTheme({
        palette,
        typography: {
            fontFamily: '"Manrope","IBM Plex Sans","Segoe UI","Helvetica Neue",sans-serif',
            h1: {
                fontFamily: '"Space Grotesk","IBM Plex Sans","Segoe UI",sans-serif',
                fontWeight: 700,
                letterSpacing: "-0.02em",
            },
            h2: {
                fontFamily: '"Space Grotesk","IBM Plex Sans","Segoe UI",sans-serif',
                fontWeight: 700,
                letterSpacing: "-0.015em",
            },
            h3: {
                fontFamily: '"Space Grotesk","IBM Plex Sans","Segoe UI",sans-serif',
                fontWeight: 700,
                letterSpacing: "-0.01em",
            },
            h4: { fontWeight: 600 },
            h5: { fontWeight: 600 },
            h6: { fontWeight: 600 },
            body1: { lineHeight: 1.65 },
            body2: { lineHeight: 1.65 },
            subtitle1: { fontWeight: 600 },
            subtitle2: { fontWeight: 600 },
            caption: { letterSpacing: "0.02em" },
            overline: { letterSpacing: "0.14em" },
            button: {
                textTransform: "none",
                letterSpacing: "0.02em",
                fontWeight: 600,
                fontSize: "0.9rem",
            },
        },
        shape: {
            borderRadius: 6,
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        backgroundColor: palette.background.default,
                        backgroundImage: "none",
                        color: palette.text.primary,
                    },
                    "::selection": {
                        backgroundColor: "rgba(203, 213, 225, 0.65)",
                        color: palette.text.primary,
                    },
                    "::-moz-selection": {
                        backgroundColor: "rgba(203, 213, 225, 0.65)",
                        color: palette.text.primary,
                    },
                },
            },
            MuiButton: {
                defaultProps: {
                    disableElevation: true,
                },
                styleOverrides: {
                    root: {
                        borderRadius: 6,
                        fontWeight: 600,
                        paddingInline: 18,
                        paddingBlock: 8,
                    },
                    containedPrimary: {
                        color: palette.primary.contrastText,
                        backgroundImage:
                            "linear-gradient(135deg, #C65C00 0%, #E76F00 55%, #F2943C 100%)",
                    },
                    containedSecondary: {
                        color: palette.secondary.contrastText,
                        backgroundImage:
                            "linear-gradient(135deg, #5D5D5D 0%, #7A7A7A 55%, #9A9A9A 100%)",
                    },
                    outlinedPrimary: {
                        color: palette.primary.dark,
                        borderColor: "rgba(231, 111, 0, 0.45)",
                        backgroundColor: "rgba(231, 111, 0, 0.06)",
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        borderRadius: 6,
                        backgroundImage: "none",
                        backgroundColor: palette.background.paper,
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        borderRadius: 6,
                        border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(203, 213, 225, 0.95)"}`,
                        boxShadow:
                            "0 14px 28px rgba(35, 41, 67, 0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
                    },
                },
            },
            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        borderRadius: 6,
                        fontSize: "0.75rem",
                        color: "#F8FAFC",
                        backgroundColor: "rgba(35, 41, 67, 0.92)",
                    },
                },
            },
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        backgroundImage: "none",
                        backgroundColor: isDark ? alpha(palette.background.paper, 0.9) : "rgba(255,255,255,0.97)",
                        borderBottom: `1px solid ${palette.divider}`,
                    },
                },
            },
            MuiDivider: {
                styleOverrides: {
                    root: {
                        borderColor: palette.divider,
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        borderRadius: 6,
                        backgroundColor: isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(148, 163, 184, 0.12)",
                        color: palette.text.primary,
                        border: isDark ? "1px solid rgba(148, 163, 184, 0.24)" : "1px solid rgba(148, 163, 184, 0.24)",
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: palette.divider,
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: palette.grey[400],
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderColor: palette.primary.main,
                            borderWidth: 1.5,
                        },
                    },
                },
            },
            MuiSwitch: {
                styleOverrides: {
                    switchBase: {
                        '&.Mui-checked': {
                            color: palette.primary.main,
                            '& + .MuiSwitch-track': {
                                backgroundColor: palette.primary.main,
                            },
                        },
                    },
                    track: {
                        backgroundColor: palette.grey[300],
                    },
                },
            },
            MuiTabs: {
                styleOverrides: {
                    indicator: {
                        background: "linear-gradient(90deg, #E76F00 0%, #7A7A7A 100%)",
                        height: 3,
                        borderRadius: 3,
                    },
                },
            },
            MuiTab: {
                styleOverrides: {
                    root: {
                        textTransform: "none",
                        fontWeight: 600,
                        color: palette.text.secondary,
                        '&:hover': {
                            color: palette.primary.dark,
                            backgroundColor: "rgba(231, 111, 0, 0.08)",
                        },
                        '&.Mui-selected': {
                            color: palette.primary.main,
                        },
                    },
                },
            },
        },
    });

    return responsiveFontSizes(theme);
};
