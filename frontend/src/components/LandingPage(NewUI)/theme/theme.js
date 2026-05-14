import { createTheme, alpha, responsiveFontSizes } from '@mui/material/styles';

// Palette definitions
const getPalette = (mode) => ({
    mode,
    primary: {
        main: '#EC6727',
        light: '#FEF1E9',
        contrastText: '#FFFFFF',
    },
    secondary: {
        main: '#3478BC',
        light: '#F0F4FC',
        contrastText: '#FFFFFF',
    },
    info: {
        main: '#3354A1',
        light: '#EEF5FC',
        bg: '#94A3B8',
    },
    success: {
        main: '#13A34A',
        light: '#DEEEE1',
    },
    warning: {
        main: '#DB610E',
        light: '#FFF4E5',
    },
    error: {
        main: '#D32F2F',
        light: '#FDEDED',
    },
    ...(mode === 'light'
        ? {
            text: {
                primary: '#232943',
                secondary: '#65748B',
                disabled: '#94A3B8',
            },
            background: {
                default: '#F3F4F6',
                paper: '#FFFFFF',
            },
            divider: '#E3E8F1',
        }
        : {
            text: {
                primary: '#F1F5F9',
                secondary: '#94A3B8',
                disabled: '#64748B',
            },
            background: {
                default: '#0F172A',
                paper: '#1E293B',
            },
            divider: '#334155',
        }),
});

export const createAppTheme = (mode) => {
    let theme = createTheme({
        palette: getPalette(mode),
        typography: {
            fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
            h1: {
                fontFamily: '"Manrope", "Inter", sans-serif',
                fontWeight: 800,
                fontSize: '3.5rem',
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
            },
            h2: {
                fontFamily: '"Manrope", "Inter", sans-serif',
                fontWeight: 700,
                fontSize: '2.5rem',
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
            },
            h3: {
                fontFamily: '"Manrope", "Inter", sans-serif',
                fontWeight: 700,
                fontSize: '2rem',
                lineHeight: 1.3,
            },
            h4: {
                fontFamily: '"Manrope", "Inter", sans-serif',
                fontWeight: 600,
                fontSize: '1.5rem',
            },
            h5: {
                fontFamily: '"Manrope", "Inter", sans-serif',
                fontWeight: 600,
                fontSize: '1.25rem',
            },
            h6: {
                fontFamily: '"Manrope", "Inter", sans-serif',
                fontWeight: 600,
                fontSize: '1rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
            },
            subtitle1: {
                fontSize: '1.125rem',
                lineHeight: 1.6,
            },
            subtitle2: {
                fontWeight: 600,
            },
            body1: {
                fontSize: '1rem',
                lineHeight: 1.6,
            },
            button: {
                fontWeight: 600,
                textTransform: 'none',
            },
        },
        shape: {
            borderRadius: 8,
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: `
          body {
            scroll-behavior: smooth;
          }
        `,
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: '8px',
                        padding: '10px 24px',
                        fontSize: '1rem',
                        boxShadow: 'none',
                        '&:hover': {
                            boxShadow: '0px 4px 12px rgba(236, 103, 39, 0.2)',
                        },
                    },
                    containedPrimary: {
                        '&:hover': {
                            backgroundColor: '#D8551B',
                        },
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        borderRadius: '16px',
                        border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.05)',
                        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                        '&:hover': {
                            transform: 'translateY(-4px)',
                        },
                    },
                },
            },
            MuiContainer: {
                defaultProps: {
                    maxWidth: 'lg',
                },
            },
        },
    });

    theme = responsiveFontSizes(theme);
    return theme;
};
