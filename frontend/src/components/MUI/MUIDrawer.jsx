import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import MuiDrawer from '@mui/material/Drawer';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
// import Tooltip from '@mui/material/Tooltip';

import {
    DashboardRounded as DashboardRoundedIcon,
    BusinessRounded as BusinessRoundedIcon,
    AutoAwesomeRounded,
    ChecklistRounded as ChecklistRoundedIcon,
    SettingsRounded as SettingsRoundedIcon,
    LoginRounded as LoginRoundedIcon,
    LogoutRounded as LogoutRoundedIcon,
    PersonSearchRounded as PersonSearchRoundedIcon,
    TrackChangesOutlined as TrackChangesIcon,
    BadgeRounded as BadgeRoundedIcon,
    DescriptionRounded as DescriptionRoundedIcon,
} from '@mui/icons-material';
import RecentActorsIcon from '@mui/icons-material/RecentActors';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useResetAllContexts } from '../../contexts/ResetContext';
import { useUiContextState } from '../../contexts/UiContext';
import { Link } from 'react-router-dom';
import { Backdrop, Box, useMediaQuery } from '@mui/material';
import LogoutConfirmDialog from './commonUI/LogoutConfirmDialog';

export const drawerWidth = 100;

// Mixins for mini variant
const openedMixin = (theme) => ({
    minWidth: drawerWidth,
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: 'hidden',
});

const closedMixin = (theme) => ({
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    overflowX: 'hidden',
    boxShadow: 'none',
    width: `calc(${theme.spacing(7)} + 1px)`, // mini width
    [theme.breakpoints.up('sm')]: {
        width: `calc(${theme.spacing(7)} + 1px)`, // slightly wider on larger screens
    },
});

// Styled mini variant Drawer
const MuiDrawerStyled = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
    ({ theme, open }) => ({
        width: drawerWidth,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        ...(open && {
            ...openedMixin(theme),
            '& .MuiDrawer-paper': openedMixin(theme),
        }),
        ...(!open && {
            ...closedMixin(theme),
            '& .MuiDrawer-paper': closedMixin(theme),
        }),
    })
);


export const MUIDrawer = () => {
    const [uiState, setUiState] = useUiContextState();
    const [authState] = useAuthContextState();
    const resetAllContexts = useResetAllContexts();
    const me = authState?.user ?? {};
    const role = me.role;
    const [logoutOpen, setLogoutOpen] = useState(false);
    const [sectionCollapseOpen, setSectionCollapseOpen] = useState({
        hiringHub: false,
        teamManagement: false,
        automation: false,
    });
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

    const onSectionOpenChange = (keyName, keyVal = null) => {
        if (keyVal === null) {
            !uiState?.drawerOpen && setUiState({
                drawerOpen: true
            });

            keyVal = !sectionCollapseOpen?.[keyName];
        }
        setSectionCollapseOpen((prev) => ({ ...prev, [keyName]: keyVal }));
    };

    const closeDrawer = useCallback(() => {
        setUiState({ drawerOpen: false });
    }, [setUiState]);

    useEffect(() => {
        if (!uiState?.drawerOpen) {
            setSectionCollapseOpen({
                hiringHub: false,
                teamManagement: false,
                automation: false,
            });
        }
    }, [uiState?.drawerOpen]);

    const showHiringSetup = ['ultra_admin', 'client_admin', 'manager', 'recruiter'].includes(role);

    const navItems = useMemo(() => {
        const items = [{ text: 'Dashboard', icon: <DashboardRoundedIcon />, to: '/dashboard/', onClick: closeDrawer }];

        if (showHiringSetup) {
            items.push({
                text: 'Hiring Hub',
                icon: <BusinessRoundedIcon />,
                collapseKey: 'hiringHub',
                children: [
                    { text: 'Jobs', icon: <WorkOutlineRoundedIcon />, to: '/jobs/', onClick: closeDrawer },
                    { text: 'Companies', icon: <ApartmentRoundedIcon />, to: '/companies/', onClick: closeDrawer },
                    { text: 'Interviews', icon: <EventAvailableRoundedIcon />, to: '/interviews', onClick: closeDrawer },
                    ...(['ultra_admin', 'client_admin', 'manager'].includes(role) ? [
                        { text: 'Hiring Stages', icon: <ChecklistRoundedIcon />, to: '/stages/', onClick: closeDrawer },
                    ] : []),
                ],
            });
            items.push({ text: 'Pipeline', icon: <TrackChangesIcon />, to: '/hiring-pipeline/', onClick: closeDrawer });
            items.push({ text: 'Talent Pool', icon: <RecentActorsIcon />, to: '/candidates/', onClick: closeDrawer });
            items.push({
                text: 'Team Management',
                icon: <Groups2RoundedIcon />,
                collapseKey: 'teamManagement',
                children: [
                    ...(role === 'ultra_admin' ? [{ text: 'Client Admins', icon: <AdminPanelSettingsIcon />, to: '/admins/', onClick: closeDrawer }] : []),
                    ...(['client_admin', 'manager'].includes(role) ? [
                        { text: 'Managers', icon: <BadgeRoundedIcon />, to: '/managers/', onClick: closeDrawer },
                        { text: 'Recruiters', icon: <PersonSearchRoundedIcon />, to: '/recruiters/', onClick: closeDrawer },
                    ] : []),
                    { text: 'Interviewers', icon: <BadgeRoundedIcon />, to: '/interviewers/', onClick: closeDrawer },
                ],
            });
            items.push({
                text: 'Automation',
                icon: <AccountTreeRoundedIcon />,
                collapseKey: 'automation',
                children: [
                    ...(['client_admin', 'manager'].includes(role) ? [{ text: 'Templates', icon: <DescriptionRoundedIcon />, to: '/templates/', onClick: closeDrawer }] : []),
                    { text: 'AI Tool', icon: <AutoAwesomeRounded />, to: '/ai/tools/', onClick: closeDrawer },
                ],
            });
            items.push({ text: 'Settings', icon: <SettingsRoundedIcon />, to: '/settings/', onClick: closeDrawer });
        }

        if (role === 'interviewer') {
            items.push({ text: 'My Interviews', icon: <EventAvailableRoundedIcon />, to: '/my-interviews', onClick: closeDrawer });
        }

        return items;
    }, [closeDrawer, role, showHiringSetup]);

    const handleSignOut = () => {
        setLogoutOpen(false);
        resetAllContexts();
        localStorage.removeItem('token');
        // navigate('/auth/login');
    };

    const authItems = authState.isAuthenticated
        ? [{
            text: 'Sign Out', icon: <LogoutRoundedIcon />, onClick: () => {
                setLogoutOpen(true);
                setUiState({ drawerOpen: false });
            }
        }
        ]
        : [
            { text: 'Sign In', icon: <LoginRoundedIcon />, to: '/auth/login' },
            // { text: 'Sign Up', icon: <PersonAddRoundedIcon />, to: '/auth/register' },
        ];


    const MUI_Drawer = isDesktop ? MuiDrawerStyled : MuiDrawer


    return (
        <>
            {isDesktop && <Backdrop
                open={uiState.drawerOpen}
                onClick={() => setUiState((s) => ({ ...s, drawerOpen: false }))}
                sx={{
                    zIndex: theme.zIndex.drawer - 1,
                    backdropFilter: 'blur(6px)',
                }}
            />}
            <MUI_Drawer
                variant={isDesktop ? "permanent" : "temporary"}
                open={uiState.drawerOpen}
                ModalProps={{ keepMounted: true }}
                onClose={
                    isDesktop
                        ? undefined
                        : () => setUiState((s) => ({ ...s, drawerOpen: false }))
                }
                onMouseEnter={
                    isDesktop
                        ? () => uiState.drawerOpen !== true && setUiState({ drawerOpen: true })
                        : undefined
                }
                onMouseLeave={
                    isDesktop
                        ? () => uiState.drawerOpen !== false && setUiState({ drawerOpen: false })
                        : undefined
                }
                sx={{
                    boxShadow: "none",
                }}
            >
                <Toolbar />
                <Divider />
                <List component="nav">
                    <ListSubheader component="div" align={uiState?.drawerOpen ? "" : "center"}>
                        <b>{uiState.drawerOpen ? 'AI Recruiter' : 'AI'}</b>
                    </ListSubheader>

                    {navItems.map(({ text, icon, to, index, ...navItem }) => {
                        const isCollapsible = Boolean(navItem?.children?.length);
                        const listItemButtonProps = {
                            onClick: isCollapsible ? () => onSectionOpenChange(navItem.collapseKey) : (navItem?.onClick ? navItem?.onClick : () => { }),
                            "aria-expanded": isCollapsible ? sectionCollapseOpen?.[navItem?.collapseKey] : undefined,
                            "aria-controls": isCollapsible ? `${navItem?.collapseKey}-submenu` : undefined,
                        };

                        if (!isCollapsible) {
                            listItemButtonProps['component'] = Link;
                            listItemButtonProps['to'] = to;
                        }

                        return (
                            <div key={"main_nav_dropdown" + text + index}>
                                {/* <Tooltip
                                    title={text}
                                    placement="right"
                                    arrow
                                > */}
                                <ListItemButton
                                    key={"main_nav" + text + index}
                                    {...listItemButtonProps}
                                    sx={{ pl: uiState.drawerOpen ? 2 : 1.8 }}
                                >
                                    <ListItemIcon>{icon}</ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Box component="b" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                                <Box component="span">{text}</Box>
                                                {isCollapsible ? (sectionCollapseOpen?.[navItem?.collapseKey] ? <ExpandLess /> : <ExpandMore />) : null}
                                            </Box>
                                        }
                                        sx={{ opacity: uiState.drawerOpen ? 1 : 0 }}
                                    >
                                    </ListItemText>
                                </ListItemButton>
                                {/* </Tooltip> */}
                                {isCollapsible && <Collapse in={sectionCollapseOpen?.[navItem?.collapseKey]} sx={{ pl: 3 }} timeout="auto" unmountOnExit>
                                    <List component="div" disablePadding id={`${navItem?.collapseKey}-submenu`}>

                                        {navItem?.children?.map?.(({ text, icon, to, onClick, index }) => (
                                            // <Tooltip
                                            //     key={"sub_nav_tt" + text + index}
                                            //     title={text}
                                            //     placement="right"
                                            //     arrow
                                            // >
                                            <ListItemButton
                                                key={"sub_nav" + text + index}
                                                component={to ? Link : 'button'}
                                                to={to}
                                                onClick={onClick}
                                                sx={{ pl: uiState.drawerOpen ? 2 : 1.8 }}
                                            >
                                                <ListItemIcon>{icon}</ListItemIcon>
                                                <ListItemText
                                                    primary={text}
                                                    sx={{ opacity: uiState.drawerOpen ? 1 : 0 }}
                                                />
                                            </ListItemButton>
                                            // </Tooltip>
                                        ))}

                                    </List>
                                </Collapse>}
                            </div>
                        )
                    })}


                    <ListSubheader component="div" align={uiState?.drawerOpen ? "" : "center"} sx={{ mt: 5 }}>
                        <b>{uiState.drawerOpen ? 'Authentication' : 'Auth'}</b>
                    </ListSubheader>

                    {authItems.map(({ text, icon, to, onClick }) => (
                        // <Tooltip
                        //     key={"auth_tt_" + idx}
                        //     title={text}
                        //     placement="right"
                        //     arrow
                        // >
                        <ListItemButton
                            key={text}
                            component={to ? Link : 'button'}
                            to={to}
                            onClick={onClick}
                            sx={{ pl: uiState.drawerOpen ? 2 : 1.8 }}
                        >
                            <ListItemIcon>{icon}</ListItemIcon>
                            <ListItemText
                                primary={<Box component="b" sx={{ display: 'flex' }}>{text}</Box>}
                                sx={{ opacity: uiState.drawerOpen ? 1 : 0 }}
                            />
                        </ListItemButton>
                        // </Tooltip>
                    ))}

                </List>
            </MUI_Drawer>
            <LogoutConfirmDialog
                open={logoutOpen}
                onClose={() => setLogoutOpen(false)}
                onConfirm={handleSignOut}
            />
        </>
    );
};
export default MUIDrawer;
