import React, { lazy, Suspense, useState } from 'react';
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';

import { useAuthContextState } from '../../contexts/AuthContext';
import MUISpinner from '../MUI/commonUI/MUISpinner';

const BooleanSearch = lazy(() => import('../job/BooleanSearch'));
const FakePlivoCall = lazy(() => import('../CallSimulation/FakePlivoCall'));

const DEMO_CALL_DBNAMES = [
    'applycup',
    'aiselektv2',
    'aiselecktdev',
    'aiselekt',
    'ai_selekt',
    'nikhilbatraaiselekt',
    'applycupdevelopment',
];

function TabPanel({ children, value, index, keepMounted = false }) {
    if (!keepMounted && value !== index) return null;

    return (
        <Box
            role="tabpanel"
            hidden={value !== index}
            id={`ai-tools-tabpanel-${index}`}
            aria-labelledby={`ai-tools-tab-${index}`}
            sx={{ pt: 1 }}
        >
            {children}
        </Box>
    );
}


export default function AITools() {
    const [authState] = useAuthContextState();
    const [tab, setTab] = useState(0);
    const theme = useTheme();

    const role = authState?.user?.role;
    const dbName = (authState?.user?.dbName || '').toLowerCase();
    const canAccessDemoCall =
        ['ultra_admin', 'client_admin', 'manager'].includes(role) &&
        DEMO_CALL_DBNAMES.includes(dbName);



    return (
        <Box
            sx={{
                px: { xs: 2, sm: 3, md: 5 },
                pt: { xs: 0.5, sm: 0.75, md: 1 },
                pb: { xs: 1.5, sm: 2, md: 3 },
                mx: { xs: 0, sm: "1vw" },
                my: { xs: 0, sm: 0.5 },
                minHeight: "80vh"
            }}
        >
            <Box
                sx={{
                    px: { xs: 2, md: 3 },
                    pt: { xs: 1.5, md: 2 },
                    pb: { xs: 1.25, md: 1.5 },
                    backgroundColor: theme.palette.background.default,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                }}
            >
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 700,
                        color: theme.palette.text.primary,
                        letterSpacing: 0.2,
                    }}
                >
                    AI Tools
                </Typography>
                <Typography
                    variant="body1"
                    sx={{
                        mt: 0.5,
                        color: theme.palette.text.secondary,
                    }}
                >
                    Let AI make your candidate search and screening faster.
                </Typography>

                <Box sx={{ mt: 1 }}>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 0.6,
                            display: 'inline-flex',
                            alignItems: 'center',
                            borderRadius: 2.2,
                            background: alpha(theme.palette.background.paper, 0.85),
                            boxShadow: 'none',
                            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                        }}
                    >
                        <Tabs
                            value={tab}
                            onChange={(_event, newValue) => setTab((!canAccessDemoCall && tab === 1 ? 0 : newValue))}
                            variant="scrollable"
                            scrollButtons={false}
                            aria-label="AI tools tabs"
                            TabIndicatorProps={{ style: { display: 'none' } }}
                            sx={{
                                minHeight: 0,
                                '& .MuiTabs-flexContainer': {
                                    gap: 0.4,
                                },
                            }}
                        >
                            <Tab
                                id="ai-tools-tab-0"
                                aria-controls="ai-tools-tabpanel-0"
                                icon={<ManageSearchRoundedIcon fontSize="small" />}
                                iconPosition="start"
                                label="Boolean Search Builder"
                                sx={{
                                    textTransform: 'none',
                                    minHeight: 38,
                                    px: 2,
                                    borderRadius: 1.6,
                                    fontWeight: 600,
                                    fontSize: 14,
                                    color: tab === 0 ? theme.palette.primary.contrastText : theme.palette.text.primary,
                                    bgcolor: tab === 0
                                        ? theme.palette.primary.main
                                        : alpha(theme.palette.primary.main, 0.12),
                                    '&.Mui-selected': {
                                        color: theme.palette.primary.contrastText,
                                    },
                                    '& .MuiTab-iconWrapper': {
                                        color: 'inherit',
                                    },
                                    '&:hover': {
                                        bgcolor: tab === 0
                                            ? theme.palette.primary.dark
                                            : alpha(theme.palette.primary.main, 0.2),
                                    },
                                }}
                            />
                            <Tab
                                id="ai-tools-tab-1"
                                aria-controls="ai-tools-tabpanel-1"
                                icon={<SupportAgentRoundedIcon fontSize="small" />}
                                iconPosition="start"
                                label="AI Screening Voice Call"
                                disabled={!canAccessDemoCall}
                                sx={{
                                    textTransform: 'none',
                                    minHeight: 38,
                                    px: 2,
                                    borderRadius: 1.6,
                                    fontWeight: 600,
                                    fontSize: 14,
                                    color:
                                        tab === 1
                                            ? theme.palette.primary.contrastText
                                            : !canAccessDemoCall
                                                ? alpha(theme.palette.text.secondary, 0.7)
                                                : theme.palette.text.primary,
                                    bgcolor:
                                        tab === 1
                                            ? theme.palette.primary.main
                                            : !canAccessDemoCall
                                                ? alpha(theme.palette.primary.main, 0.08)
                                                : alpha(theme.palette.primary.main, 0.12),
                                    '&.Mui-selected': {
                                        color: theme.palette.primary.contrastText,
                                    },
                                    '& .MuiTab-iconWrapper': {
                                        color: 'inherit',
                                    },
                                    '&:hover': {
                                        bgcolor: tab === 1
                                            ? theme.palette.primary.dark
                                            : alpha(theme.palette.primary.main, 0.2),
                                    },
                                }}
                            />
                        </Tabs>
                    </Paper>
                </Box>
            </Box>

            <Box sx={{ px: { xs: 1, md: 2 }, pt: 0.5 }}>
                <Suspense fallback={<MUISpinner text="Loading AI tools..." />}>
                    <TabPanel value={tab} index={0} keepMounted>
                        <BooleanSearch />
                    </TabPanel>
                    <TabPanel value={tab} index={1}>
                        {canAccessDemoCall ? (
                            <FakePlivoCall centerLayoutSx={{ minHeight: 'auto', alignItems: 'flex-start', pt: 0.5 }} />
                        ) : (
                            <Box sx={{ px: 1 }}>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Demo AI Call is not available for this account.
                                </Typography>
                            </Box>
                        )}
                    </TabPanel>
                </Suspense>
            </Box>

        </Box>
    );
}

