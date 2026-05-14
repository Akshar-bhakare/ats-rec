export const baseTokens = {
    fontFamilies: {
        display: '"Poppins","Manrope","Inter",sans-serif',
        body: '"Inter","Nunito Sans","Segoe UI",sans-serif',
        code: '"DM Mono","Fira Code","SFMono-Regular",monospace',
    },
    radius: {
        xs: "0.2rem",
        sm: "0.2rem",
        md: "0.2rem",
        lg: "0.2rem",
        xl: "0.2rem",
        pill: 999,
    },
    spacing: 4,
    transitions: {
        duration: {
            shortest: 90,
            shorter: 140,
            short: 200,
            standard: 260,
            complex: 360,
        },
        easing: {
            easeOut: 'cubic-bezier(0.33,1,0.68,1)',
            easeIn: 'cubic-bezier(0.64,0,0.78,0)',
            easeInOut: 'cubic-bezier(0.76,0,0.24,1)',
            anticipation: 'cubic-bezier(0.45,0.05,0.55,0.95)',
        },
    },
    shadowColor: {
        dark: 'rgba(1,14,55,0.55)',
        light: 'rgba(18,104,251,0.18)',
    },
    grid: {
        column: 72,
        gutter: 28,
    },
};

export const modeTokens = {
    light: {
        palette: {
            background: {
                base: '#F7F9FD',
                surface: '#FFFFFF',
                elevated: 'rgba(255,255,255,0.96)',
                glass: 'rgba(244,248,255,0.82)',
            },
            primary: {
                main: '#2C3E97',
                light: '#5A6ACB',
                dark: '#18245F',
            },
            secondary: {
                main: '#1268FB',
                emphasis: '#4D8CFF',
            },
            accent: {
                highlight: '#D9F1FF',
                navy: '#2C3E97',
                black: '#000000',
            },
            neutral: {
                50: '#FFFFFF',
                100: '#F2F4F8',
                200: '#E4E8F0',
                300: '#CBD2E0',
                400: '#9DA7BB',
                500: '#6E7688',
                600: '#4D4D4D',
                700: '#2F3656',
                800: '#1B2540',
                900: '#000000',
            },
        },
        gradients: {
            primary: 'linear-gradient(135deg,#E9F3FF 0%,#D4E1FF 60%,#B8CAF5 100%)',
            secondary: 'linear-gradient(135deg,rgba(44,62,151,0.14) 0%,rgba(18,104,251,0.18) 100%)',
        },
        glassBorder: 'rgba(44,62,151,0.18)',
        gridOverlay: null,
    },
    dark: {
        palette: {
            background: {
                base: '#010E37',
                surface: '#07164F',
                elevated: 'rgba(7,22,79,0.85)',
                glass: 'rgba(4,18,63,0.7)',
            },
            primary: {
                main: '#4D8CFF',
                light: '#8BB2FF',
                dark: '#0F47B6',
            },
            secondary: {
                main: '#D9F1FF',
                emphasis: '#8ED1FC',
            },
            accent: {
                highlight: '#1268FB',
                navy: '#2C3E97',
                black: '#000000',
            },
            neutral: {
                50: '#010E37',
                100: '#07164F',
                200: '#0C1F66',
                300: '#142A80',
                400: '#1E3A99',
                500: '#3051B5',
                600: '#5A7AD6',
                700: '#9AB5F2',
                800: '#D9E6FF',
                900: '#F6FAFF',
            },
        },
        gradients: {
            primary: 'linear-gradient(135deg,#1A2A60 0%,#2C3E97 60%,#1268FB 100%)',
            secondary: 'linear-gradient(135deg,rgba(44,62,151,0.3) 0%,rgba(18,104,251,0.24) 100%)',
        },
        glassBorder: 'rgba(18,104,251,0.28)',
        gridOverlay: null,
    },
};

export const motionTokens = {
    hoverLift: {
        y: -3,
        opacity: 1,
        scale: 1.01,
        transition: { duration: 0.2, ease: [0.33, 1, 0.68, 1] },
    },
    tap: {
        scale: 0.98,
        transition: { duration: 0.12, ease: [0.66, 0, 0.8, 0] },
    },
    shimmer: {
        duration: 2.4,
        gradient: 'linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.5) 45%, transparent 90%)',
    },
    pulse: {
        scaleRange: [1, 1.015, 1],
        transition: { duration: 2, repeat: Infinity, ease: [0.42, 0, 0.58, 1] },
    },
};
