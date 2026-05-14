import { useMemo } from 'react';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { useUiContextState } from '../../../../contexts/UiContext';
import { createAppTheme } from '../../theme/theme';
import Footer from '../../sections/Footer';



const RootLayout = ({ children }) => {
    const [uiState,] = useUiContextState();
    const mode = uiState?.muiThemeMode || 'light';

    // Create theme based on global UI state
    const theme = useMemo(() => createAppTheme(mode), [mode]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {/* Header is now handled by MUIAppBar in the parent Layout */}

            <Box component="main">
                {children}
            </Box>

            <Footer />
        </ThemeProvider>
    );
};

export default RootLayout;
