import { useState } from 'react';
import { AppBar, Box, Button, Container, Drawer, IconButton, List, ListItemButton, ListItemText, Stack, Toolbar, Typography, alpha } from '@mui/material';
import { Menu as MenuIcon, X } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { NAV_LINKS } from '../../lib/constants';

const Header = () => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const navItems = NAV_LINKS;

    const handleDrawerToggle = () => {
        setMobileOpen((current) => !current);
    };

    return (
        <>
            <AppBar
                position="sticky"
                elevation={0}
                sx={{
                    bgcolor: alpha('#ffffff', 0.96),
                    color: '#1f2937',
                    borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
                    backdropFilter: 'blur(18px)'
                }}
            >
                <Container sx={{ maxWidth: '1540px !important', px: { xs: 2.25, md: 4 } }}>
                    <Toolbar disableGutters sx={{ minHeight: { xs: 72, md: 88 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box
                            component={RouterLink}
                            to="/"
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'flex-start',
                                gap: 0.1,
                                textDecoration: 'none',
                                color: 'inherit',
                                minWidth: { md: 220 }
                            }}
                        >
                            <Typography
                                sx={{
                                    fontSize: { xs: '2rem', md: '2.2rem' },
                                    fontWeight: 900,
                                    letterSpacing: '-0.055em',
                                    lineHeight: 0.95,
                                    color: '#f97316'
                                }}
                            >
                                HIREX
                            </Typography>
                            <Typography
                                sx={{
                                    pt: { xs: 0.24, md: 0.32 },
                                    fontSize: { xs: '0.9rem', md: '0.96rem' },
                                    fontWeight: 800,
                                    letterSpacing: '-0.02em',
                                    color: alpha('#111827', 0.58),
                                    lineHeight: 1
                                }}
                            >
                                REC
                            </Typography>
                        </Box>

                        <Box sx={{ display: { xs: 'none', md: 'flex' }, flex: 1, justifyContent: 'center' }}>
                            <Stack direction="row" spacing={1}>
                                {navItems.map((item) => (
                                    <Button
                                        key={item.label}
                                        component={RouterLink}
                                        to={item.href}
                                        sx={{
                                            minWidth: 'auto',
                                            px: 2,
                                            py: 1,
                                            borderRadius: 2.5,
                                            textTransform: 'none',
                                            fontSize: '0.98rem',
                                            fontWeight: 700,
                                            color: '#334155',
                                            '&:hover': {
                                                bgcolor: alpha('#f97316', 0.06),
                                                color: '#111827'
                                            }
                                        }}
                                    >
                                        {item.label}
                                    </Button>
                                ))}
                            </Stack>
                        </Box>

                        <Box sx={{ display: { xs: 'none', md: 'flex' }, minWidth: 220, justifyContent: 'flex-end' }}>
                            <Button
                                component={RouterLink}
                                to="/auth/login/"
                                variant="outlined"
                                sx={{
                                    px: 3.2,
                                    py: 1.2,
                                    minWidth: 120,
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    fontSize: '0.98rem',
                                    fontWeight: 800,
                                    color: '#111827',
                                    borderColor: '#f97316',
                                    '&:hover': {
                                        borderColor: '#ea580c',
                                        bgcolor: alpha('#f97316', 0.05)
                                    }
                                }}
                            >
                                Sign In
                            </Button>
                        </Box>

                        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
                            <IconButton
                                aria-label="open navigation"
                                onClick={handleDrawerToggle}
                                sx={{ 
                                    p: 1.25,
                                    color: '#111827',
                                    borderRadius: '12px',
                                    bgcolor: alpha('#f97316', 0.05),
                                    '&:hover': {
                                        bgcolor: alpha('#f97316', 0.1)
                                    }
                                }}
                            >
                                <MenuIcon size={24} />
                            </IconButton>
                        </Box>
                    </Toolbar>
                </Container>
            </AppBar>

            <Drawer
                anchor="right"
                open={mobileOpen}
                onClose={handleDrawerToggle}
                ModalProps={{ keepMounted: true }}
                PaperProps={{
                    sx: {
                        width: 310,
                        px: 2.5,
                        py: 3,
                        bgcolor: '#ffffff',
                        boxShadow: 'none',
                        borderLeft: '1px solid rgba(15, 23, 42, 0.08)'
                    }
                }}
                sx={{
                    zIndex: (theme) => theme.zIndex.drawer + 100
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4.5 }}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 900, color: 'text.secondary', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Navigation
                    </Typography>
                    <IconButton 
                        onClick={handleDrawerToggle}
                        sx={{ 
                            color: '#111827',
                            bgcolor: alpha('#111827', 0.05),
                            '&:hover': { bgcolor: alpha('#111827', 0.1) }
                        }}
                    >
                        <X size={24} strokeWidth={2.5} />
                    </IconButton>
                </Box>

                <List sx={{ p: 0 }}>
                    {navItems.map((item) => (
                        <ListItemButton
                            key={item.label}
                            component={RouterLink}
                            to={item.href}
                            onClick={handleDrawerToggle}
                            sx={{
                                borderRadius: 2,
                                mb: 0.5
                            }}
                        >
                            <ListItemText
                                primary={item.label}
                                primaryTypographyProps={{
                                    fontSize: '0.98rem',
                                    fontWeight: 700,
                                    color: '#1f2937'
                                }}
                            />
                        </ListItemButton>
                    ))}
                </List>

                <Box sx={{ mt: 'auto', pt: 3.5 }}>
                    <Button
                        component={RouterLink}
                        to="/auth/login/"
                        variant="contained"
                        fullWidth
                        onClick={handleDrawerToggle}
                        sx={{
                            py: 1.5,
                            borderRadius: '12px',
                            textTransform: 'none',
                            fontSize: '1rem',
                            fontWeight: 800,
                            bgcolor: '#f97316',
                            color: '#ffffff',
                            boxShadow: `0 8px 20px -6px ${alpha('#f97316', 0.45)}`,
                            '&:hover': {
                                bgcolor: '#ea580c',
                                boxShadow: `0 10px 24px -6px ${alpha('#f97316', 0.55)}`
                            }
                        }}
                    >
                        Sign In
                    </Button>
                </Box>
            </Drawer>
        </>
    );
};

export default Header;
