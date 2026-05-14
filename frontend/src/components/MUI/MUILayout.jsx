import Box from '@mui/material/Box';
import MUIAppBar from './MUIAppBar';
import MUIDrawer from './MUIDrawer';
import Toolbar from '@mui/material/Toolbar';
import { useMediaQuery, useTheme } from '@mui/material';
import AiAgentAssistant from '../aiAgent/aiAgentAssistant';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useUiContextState } from '../../contexts/UiContext';
import { useLocation } from 'react-router-dom';
import FooterV2 from '../landingPage/FooterV2';
import { drawerWidth } from './MUIDrawer';
import NetworkQualityNotice from './commonUI/NetworkQualityNotice';
import JourneyFloatingWidget from '../journey/JourneyFloatingWidget';
import JourneyResumeModal from '../journey/JourneyResumeModal';

export function Layout({ children }) {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    const [authState] = useAuthContextState();
    const [uiState] = useUiContextState();
    const location = useLocation();

    const isAuthed = !!authState?.isAuthenticated; // ✅ define this
    const path = location.pathname.toLowerCase();
    const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
    const isInterviewRoute = path.startsWith('/webrtcai');
    const marketingPaths = new Set([
        '/v1',
        '/v2',
        '/privacypolicy',
        '/termscondition',
        '/unsubscribe',
        '/webrtcai',
    ]);
    const showFooter = !isAuthed && (marketingPaths.has(normalizedPath));

    // eslint-disable-next-line no-unused-vars
    const showJourneyGuide =
        !uiState?.hideJourneyGuide &&
        !normalizedPath.startsWith('/journey-map') &&
        (
            isAuthed ||
            normalizedPath.startsWith('/share/upload') ||
            normalizedPath.startsWith('/webrtcai')
        );
    const showAssistant = isAuthed && !isInterviewRoute;

    const closedWidth = theme.spacing(7);
    const closedOffset = `calc(${closedWidth} + 1px)`;
    const desktopOffset = isAuthed && isDesktop
        ? (uiState?.drawerOpen ? `${drawerWidth}px` : closedOffset)
        : 0;
    const desktopWidth = uiState?.drawerOpen
        ? `calc(100% - ${drawerWidth}px)`
        : `calc(100% - ${closedWidth} - 1px)`;

    return (
        <>
            <NetworkQualityNotice />
            <MUIAppBar />

            {isAuthed && <MUIDrawer />}

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    width: isAuthed && isDesktop ? desktopWidth : "100%",
                    minWidth: 0,
                    overflowX: "hidden",
                    // p: 3,
                    ml: isAuthed && isDesktop ? desktopOffset : 0,
                    marginBottom: showFooter ? "18vh" : 0,
                }}
            >
                {path !== '/' && <Toolbar sx={{ minHeight: { xs: 64, md: 72 } }} />} {/* offset for compact AppBar, hide on landing page */}

                {children}

                {/* 
                {showJourneyGuide && <JourneyFloatingWidget assistantPresent={showAssistant} />}
                {isAuthed && <JourneyResumeModal />}
                */}

                {showAssistant && <Box sx={{ py: 5, my: 5 }}>
                    <AiAgentAssistant />
                </Box>} {/* ✅ now works */}
            </Box>

            {/* {isLandingV2 ? <FooterV2 /> : <Footer />} */}
            {showFooter && <FooterV2 />}

        </>
    );
}

export default Layout;
