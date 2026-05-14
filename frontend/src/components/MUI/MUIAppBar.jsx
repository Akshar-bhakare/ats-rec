import { useMemo, useState, useEffect } from "react";
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
// import MenuIcon from '@mui/icons-material/Menu'; // Replaced by lucide-react
import Avatar from '@mui/material/Avatar';
import MenuItem from '@mui/material/MenuItem';
import { Box, Chip, Tooltip, Container, Button, Drawer, List, ListItem, ListItemText, useMediaQuery, useScrollTrigger } from '@mui/material';
import { X, Menu as MenuIcon } from 'lucide-react';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useResetAllContexts } from '../../contexts/ResetContext';
import { useUiContextState } from '../../contexts/UiContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { alpha, useTheme } from '@mui/material/styles';
import MUIButton from "./commonUI/MUIButton";
import MuiNotification from "./commonUI/MuiNotification";
import LogoutConfirmDialog from "./commonUI/LogoutConfirmDialog";
// import hirexLogo from '../../assets/HomePage/hirex_rec_1.svg'; // Replaced by logo.svg
import { NAV_LINKS } from '../LandingPage(NewUI)/lib/constants';



export function MUIAppBar() {
    const [uiState, setUiState] = useUiContextState();
    const [authState] = useAuthContextState();
    const resetAllContexts = useResetAllContexts();
    const [anchorEl, setAnchorEl] = useState(null);
    const [logoutOpen, setLogoutOpen] = useState(false);
    const [avatarImgError, setAvatarImgError] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const navigate = useNavigate();
    const location = useLocation();
    const trigger = useScrollTrigger({ disableHysteresis: true, threshold: 50 });

    const usedCredits = useMemo(
        () =>
            authState?.user?.totalCallCount && authState?.user?.creditRatePerCall
                ? authState?.user?.totalCallCount * authState?.user?.creditRatePerCall
                : 0,
        [authState?.user?.creditRatePerCall, authState?.user?.totalCallCount]
    );
    const usedVideoCredits = authState?.user?.videoInterviewCount ?? 0;
    const totalVideoCredits = authState?.user?.videoInterviewCredit ?? 0;

    const isAuthed = !!authState?.isAuthenticated;
    const user = authState?.user;
    const profileName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'User';
    const profileInitials = useMemo(() => {
        const words = profileName.split(' ').filter(Boolean);
        if (words.length >= 2) {
            return `${words[0][0]}${words[1][0]}`.toUpperCase();
        }
        return (words[0]?.slice(0, 2) || 'U').toUpperCase();
    }, [profileName]);
    const profileBadgeInitial = profileInitials?.[0] || 'U';
    const rawProfileUrl = typeof user?.profileUrl === 'string' ? user.profileUrl.trim() : '';
    const normalizedProfileUrl = rawProfileUrl.toLowerCase();
    const isAbsoluteImageUrl = /^https?:\/\//i.test(rawProfileUrl) || rawProfileUrl.startsWith('data:image/');
    const isLikelyPlaceholderImage =
        /(^|\/)(avatar|default[_-]?avatar|placeholder|blank-user)(\.|\/|$)/i.test(normalizedProfileUrl)
        || normalizedProfileUrl.includes('gravatar.com/avatar');
    const avatarSrc = (!avatarImgError && isAbsoluteImageUrl && !isLikelyPlaceholderImage) ? rawProfileUrl : undefined;

    useEffect(() => {
        setAvatarImgError(false);
    }, [user?.profileUrl]);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    // Profile menu handlers
    const handleProfileOpen = (event) => setAnchorEl(event.currentTarget);
    const handleProfileClose = () => setAnchorEl(null);
    const handleSignOut = () => {
        handleProfileClose();
        setLogoutOpen(true);
    };

    const handleConfirmSignOut = () => {
        setLogoutOpen(false);
        resetAllContexts();
        localStorage?.removeItem('token');
        // navigate("/auth/login");
    };

    const handleProfile = () => {
        navigate("/profile/");
    };

    const handleAvatarClick = (event) => {
        if (isAuthed) {
            handleProfileOpen(event);
        } else {
            navigate('/auth/login/');
        }
    };

    const navItems = NAV_LINKS || [];

    const isAuthPage = location.pathname.includes('/auth/');
    const normalizedPathname = location.pathname.replace(/\/+$/, '') || '/';
    const isActiveNavItem = (href) => {
        const normalizedHref = href.replace(/\/+$/, '') || '/';
        return normalizedPathname === normalizedHref;
    };

    return (
        <AppBar
            position="fixed"
            elevation={trigger ? 4 : 0}
            color="default"
            sx={{
                zIndex: theme.zIndex.drawer + 1,
                width: '100%',
                backgroundColor: (trigger || isAuthed) ? (theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)') : 'transparent',
                backdropFilter: (trigger || isAuthed) ? 'blur(12px)' : 'none',
                borderBottom: trigger || isAuthed ? `1px solid ${theme.palette.divider}` : 'none',
                transition: 'all 0.3s ease',
                py: 0.5,
                boxShadow: (trigger || isAuthed) ? `0 4px 20px -5px ${alpha(theme.palette.common.black, 0.1)}` : 'none',
            }}
        >
            <Container maxWidth={false} sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
                <Toolbar disableGutters sx={{ minHeight: { xs: 56, md: 64 } }}>
                    {/* Left Side: Sidebar Toggle (Authed) & Logo */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                        <Box
                            component={Link}
                            to='/'
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                textDecoration: 'none',
                            }}
                        >
                            <Box
                                component="img"
                                src="/static/logo.svg"
                                alt="Hirex REC logo"
                                sx={{
                                    height: { xs: 24, md: 28 },
                                    width: 'auto',
                                    filter: theme.palette.mode === 'dark' ? 'brightness(1.2)' : 'none'
                                }}
                            />
                        </Box>
                    </Box>

                    {/* Center: Navigation Links (Unauthed only) */}
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, flex: 1, justifyContent: 'center', gap: 1 }}>
                        {!isAuthed && !isAuthPage && navItems.map((item) => (
                            <Button
                                key={item.label}
                                component={Link}
                                to={item.href}
                                sx={{
                                    color: isActiveNavItem(item.href) ? 'primary.main' : 'text.primary',
                                    fontWeight: isActiveNavItem(item.href) ? 700 : 600,
                                    fontSize: '0.9rem',
                                    px: 2,
                                    borderRadius: '999px',
                                    bgcolor: isActiveNavItem(item.href) ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                                    '&:hover': {
                                        color: 'primary.main',
                                        bgcolor: isActiveNavItem(item.href)
                                            ? alpha(theme.palette.primary.main, 0.14)
                                            : 'transparent'
                                    }
                                }}
                            >
                                {item.label}
                            </Button>
                        ))}
                    </Box>

                    {/* Spacer to push content to right on mobile or when authed */}
                    {(isMobile || isAuthed) && <Box sx={{ flexGrow: 1 }} />}

                    {/* Right Side: Theme Toggle & Actions */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 } }}>

                        {/* Credits Display (Authed) */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
                            {authState?.user?.totalCredit != null && (
                                <Tooltip title={'AI Call Credits Used'}>
                                    <Chip
                                        sx={{
                                            maxHeight: "1.5rem",
                                            cursor: 'pointer',
                                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                                            display: { xs: 'none', sm: 'inline-flex' },
                                            fontWeight: 600
                                        }}
                                        color={
                                            usedCredits >= authState.user.totalCredit
                                                ? "error"
                                                : (usedCredits >= authState.user.totalCredit - 10 ? "warning" : "default")
                                        }
                                        label={`AI ${usedCredits} / ${authState.user.totalCredit}`}
                                        onClick={() => navigate('/ai-call-logs')}
                                    />
                                </Tooltip>
                            )}
                            {authState?.user?.videoInterviewCredit != null && (
                                <Tooltip title={'Video Interview Credits Used'}>
                                    <Chip
                                        sx={{
                                            maxHeight: "1.5rem",
                                            cursor: 'pointer',
                                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                                            display: { xs: 'none', sm: 'inline-flex' },
                                            fontWeight: 600
                                        }}
                                        color={
                                            usedVideoCredits >= totalVideoCredits
                                                ? "error"
                                                : (usedVideoCredits >= totalVideoCredits - 2 ? "warning" : "default")
                                        }
                                        label={`Video ${usedVideoCredits} / ${totalVideoCredits}`}
                                        onClick={() => navigate('/video-interview-logs')}
                                    />
                                </Tooltip>
                            )}
                        </Box>

                        {isAuthed ? (
                            <>
                                <MuiNotification ariaLabel="Notifications" />
                                <IconButton color="inherit" onClick={handleAvatarClick} sx={{ ml: 0.5 }}>
                                    <Box sx={{ position: 'relative', lineHeight: 0 }}>
                                        <Avatar
                                            title={`${profileName}'s Profile`}
                                            alt={profileName}
                                            src={avatarSrc}
                                            onError={() => setAvatarImgError(true)}
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                fontSize: 14,
                                                fontWeight: 600,
                                                border: `1px solid ${alpha(theme.palette.grey[500], 0.3)}`,
                                                backgroundColor: avatarSrc
                                                    ? theme.palette.background.paper
                                                    : alpha(theme.palette.grey[400], 0.22),
                                                color: theme.palette.text.primary
                                            }}
                                        >
                                            {!avatarSrc ? profileInitials : null}
                                        </Avatar>
                                        {avatarSrc && (
                                            <Box
                                                component="span"
                                                sx={{
                                                    position: 'absolute',
                                                    right: -2,
                                                    bottom: -2,
                                                    width: 15,
                                                    height: 15,
                                                    borderRadius: '50%',
                                                    border: `1px solid ${theme.palette.background.paper}`,
                                                    backgroundColor: theme.palette.grey[700],
                                                    color: theme.palette.common.white,
                                                    fontSize: 9,
                                                    fontWeight: 700,
                                                    display: 'grid',
                                                    placeItems: 'center'
                                                }}
                                            >
                                                {profileBadgeInitial}
                                            </Box>
                                        )}
                                    </Box>
                                </IconButton>

                                {/* Mobile Menu Toggle (Authed) */}
                                <Box sx={{ display: { md: 'none' } }}>
                                    <IconButton
                                        color="inherit"
                                        aria-label="open drawer"
                                        onClick={() => setUiState({ drawerOpen: !uiState?.drawerOpen })}
                                        sx={{ 
                                            p: 1.2,
                                            color: 'text.primary',
                                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                                            borderRadius: '12px',
                                            ml: 1,
                                            '&:hover': {
                                                bgcolor: alpha(theme.palette.primary.main, 0.1)
                                            }
                                        }}
                                    >
                                        <MenuIcon size={24} />
                                    </IconButton>
                                </Box>
                            </>
                        ) : (
                            <>
                                <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
                                    <MUIButton
                                        size="small"
                                        variant="text"
                                        component={Link}
                                        to="/auth/login/"
                                        sx={{
                                            px: 2,
                                            py: 1,
                                            textTransform: "none",
                                            fontWeight: 600,
                                            fontSize: "0.9rem",
                                            color: 'text.primary',
                                            '&:hover': {
                                                color: 'primary.main',
                                                bgcolor: alpha(theme.palette.primary.main, 0.08)
                                            }
                                        }}
                                    >
                                        Sign In
                                    </MUIButton>

                                    {/* <Button
                                        variant="contained"
                                        color="primary"
                                        component={Link}
                                        to="/auth/register"
                                        sx={{
                                            px: 3,
                                            py: 1,
                                            borderRadius: '10px',
                                            textTransform: 'none',
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            boxShadow: `0 10px 20px -5px ${theme.palette.primary.main}44`
                                        }}
                                    >
                                        Book a Demo
                                    </Button> */}
                                </Box>

                                {/* Mobile Menu Toggle (Unauthed) - Pushed to right end */}
                                <Box sx={{ display: { md: 'none' }, ml: 'auto' }}>
                                    <IconButton
                                        color="inherit"
                                        aria-label="open drawer"
                                        edge="start"
                                        onClick={handleDrawerToggle}
                                        sx={{ 
                                            p: 1.2,
                                            color: 'text.primary',
                                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                                            borderRadius: '12px',
                                            ml: 1,
                                            '&:hover': {
                                                bgcolor: alpha(theme.palette.primary.main, 0.1)
                                            }
                                        }}
                                    >
                                        <MenuIcon size={24} />
                                    </IconButton>
                                </Box>
                            </>
                        )}
                    </Box>

                    {/* Profile Menu */}
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl) && isAuthed}
                        onClose={handleProfileClose}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        disableScrollLock
                        PaperProps={{
                            sx: {
                                mt: 1.5,
                                borderRadius: 3,
                                border: `1px solid ${theme.palette.divider}`,
                                boxShadow: theme.shadows[10],
                            }
                        }}
                    >
                        <MenuItem onClick={handleProfile} sx={{ px: 3, py: 1.5, fontWeight: 500 }}>Profile</MenuItem>
                        <MenuItem onClick={handleSignOut} sx={{ px: 3, py: 1.5, fontWeight: 500, color: 'error.main' }}>Sign Out</MenuItem>
                    </Menu>
                </Toolbar>
            </Container>

            {/* Mobile Drawer (Unauthed) */}
            {!isAuthed && (
                <Drawer
                    anchor="right"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    PaperProps={{ 
                        sx: { 
                            width: 300, 
                            p: 2.5, 
                            backgroundColor: theme.palette.background.default,
                            boxShadow: `-10px 0 30px ${alpha(theme.palette.common.black, 0.15)}`,
                            borderLeft: `1px solid ${theme.palette.divider}`
                        } 
                    }}
                    sx={{
                        zIndex: (theme) => theme.zIndex.modal + 1
                    }}
                    slotProps={{
                        backdrop: {
                            sx: {
                                backdropFilter: 'blur(4px)',
                                backgroundColor: alpha(theme.palette.common.black, 0.4)
                            }
                        }
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3.5 }}>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                            Navigation
                        </Typography>
                        <IconButton 
                            onClick={handleDrawerToggle}
                            sx={{
                                color: 'text.primary',
                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                                '&:hover': { 
                                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                                    transform: 'rotate(90deg)'
                                },
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <X size={22} strokeWidth={2.5} />
                        </IconButton>
                    </Box>
                    <List>
                        {navItems.map((item) => (
                            <ListItem
                                key={item.label}
                                component={Link}
                                to={item.href}
                                onClick={handleDrawerToggle}
                                sx={{
                                    borderRadius: 2,
                                    mb: 0.5,
                                    color: isActiveNavItem(item.href) ? 'primary.main' : 'text.primary',
                                    bgcolor: isActiveNavItem(item.href) ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                                }}
                            >
                                <ListItemText
                                    primary={item.label}
                                    primaryTypographyProps={{ fontWeight: isActiveNavItem(item.href) ? 700 : 600 }}
                                />
                            </ListItem>
                        ))}
                        {/* <ListItem sx={{ mt: 2 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                color="primary"
                                component={Link}
                                to="/auth/register"
                                onClick={handleDrawerToggle}
                                sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}
                            >
                                Book a Demo
                            </Button>
                        </ListItem> */}
                        <ListItem>
                            <Button
                                fullWidth
                                variant="outlined"
                                color="inherit"
                                component={Link}
                                to="/auth/login"
                                onClick={handleDrawerToggle}
                                sx={{ py: 1.5, borderRadius: 2, fontWeight: 600 }}
                            >
                                Sign In
                            </Button>
                        </ListItem>
                    </List>
                </Drawer>
            )}

            <LogoutConfirmDialog
                open={logoutOpen}
                onClose={() => setLogoutOpen(false)}
                onConfirm={handleConfirmSignOut}
            />
        </AppBar>
    );
}

export default MUIAppBar;
