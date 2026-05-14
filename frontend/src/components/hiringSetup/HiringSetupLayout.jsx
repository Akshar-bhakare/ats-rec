import React, { useMemo } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { useAuthContextState } from '../../contexts/AuthContext';

const TAB_ITEMS = [
    {
        key: 'managers',
        label: 'Managers',
        to: '/managers/',
        roles: ['client_admin'],
        match: ['/managers'],
    },
    {
        key: 'companies',
        label: 'Companies',
        to: '/companies/',
        roles: ['ultra_admin', 'client_admin', 'manager', 'recruiter'],
        match: ['/companies'],
    },
    {
        key: 'jobs',
        label: 'Jobs',
        to: '/jobs/',
        roles: ['ultra_admin', 'client_admin', 'manager', 'recruiter'],
        match: ['/jobs'],
    },
    {
        key: 'stages',
        label: 'Hiring Stages',
        to: '/stages/',
        roles: ['ultra_admin', 'client_admin', 'manager'],
        match: ['/stages'],
    },
    {
        key: 'interviewers',
        label: 'Interviewers',
        to: '/interviewers',
        roles: ['ultra_admin', 'client_admin', 'manager', 'recruiter'],
        match: ['/interviewers'],
    },
    {
        key: 'recruiters',
        label: 'Recruiters',
        to: '/recruiters/',
        roles: ['client_admin', 'manager'],
        match: ['/recruiters'],
    },
];

const HiringSetupLayout = ({ children }) => {
    const [authState] = useAuthContextState();
    const role = authState?.user?.role;
    const location = useLocation();

    const visibleTabs = useMemo(() => {
        if (!role) return TAB_ITEMS;
        return TAB_ITEMS.filter((tab) => !tab.roles || tab.roles.includes(role));
    }, [role]);

    const activeTab = useMemo(() => {
        const path = (location?.pathname || '').toLowerCase();
        const match = visibleTabs.find((tab) =>
            tab.match.some((prefix) => path.startsWith(prefix))
        );
        return match?.to || visibleTabs[0]?.to || false;
    }, [location?.pathname, visibleTabs]);

    return (
        <Box
            sx={{
                px: { xs: 2, sm: 3, md: 4 },
                pt: { xs: 1, sm: 1.5, md: 2 },
                pb: { xs: 2, sm: 3, md: 4 },
                mx: { xs: 0, sm: "1vw" },
                my: { xs: 0, sm: 0.5 },
                minHeight: "80vh"
            }}
        >
            <Box sx={{ mx: { xs: 0, sm: 2, md: 5 }, mt: { xs: 0.5, sm: 1.5, md: 2 } }}>
                <Typography variant="h4" sx={{ fontWeight: 700, mt: 0, fontSize: { xs: "1.5rem", sm: "2rem" } }}>
                    Hiring Setup
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, maxWidth: 720 }}>
                    Manage managers, recruiters, companies, jobs, hiring stages, and interviewers from one place.
                </Typography>

            </Box>
            <Box sx={{ mx: { xs: 0, sm: 2, md: 4 }, mt: { xs: 1.25, sm: 2, md: 2.5 }, pt: { xs: 0.5, sm: 1 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <Tabs
                        value={activeTab}
                        onChange={() => { }}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                        sx={(theme) => ({
                            minHeight: 36,
                            '& .MuiTabs-flexContainer': {
                                gap: { xs: 0.25, sm: 0.5 },
                            },
                            '& .MuiTabs-scrollButtons': {
                                color: 'text.secondary',
                            },
                            '& .MuiTabs-indicator': {
                                height: 3,
                                borderRadius: 3,
                                bgcolor: theme.palette.mode === 'dark'
                                    ? 'rgba(148, 163, 184, 0.55)'
                                    : 'rgba(51, 65, 85, 0.45)',
                            },
                            '& .MuiTab-root': {
                                textTransform: 'none',
                                minHeight: 36,
                                minWidth: 'auto',
                                px: { xs: 1.25, sm: 2 },
                                py: 0.75,
                                fontWeight: 600,
                                fontSize: { xs: '0.9rem', sm: '1rem' },
                                color: 'text.secondary',
                            },
                            '& .MuiTab-root.Mui-selected': {
                                color: 'text.primary',
                            },
                        })}
                    >
                        {visibleTabs.map((tab) => {
                            return (
                                <Tab
                                    key={tab.key}
                                    label={tab.label}
                                    value={tab.to}
                                    component={Link}
                                    to={tab.to}
                                    sx={{
                                        whiteSpace: 'nowrap',
                                    }}
                                />
                            );
                        })}
                    </Tabs>
                </Box>
                <Box
                    sx={(theme) => ({
                        bgcolor: 'background.paper',
                        border: 1,
                        borderRadius: 2,
                        borderColor: theme.palette.divider,
                        overflow: 'hidden',
                        mt: 1.25,
                    })}
                >
                    {children}
                </Box>
            </Box>
        </Box>
    );
};

export default HiringSetupLayout;
