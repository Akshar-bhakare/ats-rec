// import React from 'react';
import { Box, Button, Dialog, DialogContent, IconButton, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { alpha, useTheme } from '@mui/material/styles';
import MUIButton from './MUIButton';

const LogoutConfirmDialog = ({
    open,
    onClose,
    onConfirm,
    title = 'Are you sure you want to log out?',
    description = 'You will be logged out from your session.',
    confirmLabel = 'Log Out',
    cancelLabel = 'Cancel',
}) => {
    const theme = useTheme();

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    overflow: 'visible',
                    backgroundColor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: theme.shadows[3],
                },
            }}
        >
            <DialogContent sx={{ pt: 6, pb: 4, px: { xs: 3, sm: 4 }, textAlign: 'center' }}>
                <IconButton
                    aria-label="Close"
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        bgcolor: 'action.hover',
                        color: 'text.secondary',
                        '&:hover': { bgcolor: 'action.selected' },
                    }}
                >
                    <CloseRoundedIcon fontSize="small" />
                </IconButton>

                <Box
                    sx={{
                        width: 92,
                        height: 92,
                        borderRadius: '50%',
                        mx: 'auto',
                        mb: 2.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                        border: '1px solid',
                        borderColor: 'divider',
                        boxShadow: theme.shadows[1],
                    }}
                >
                    <LockRoundedIcon sx={{ fontSize: 44, color: 'primary.main' }} />
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {title}
                </Typography>
                {description ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                        {description}
                    </Typography>
                ) : null}

                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 2,
                        mt: 3,
                        flexWrap: { xs: 'wrap', sm: 'nowrap' },
                    }}
                >
                    <MUIButton
                        variant="outlined"
                        onClick={onClose}
                        sx={{
                            minWidth: 140,
                            borderRadius: 2,
                        }}
                    >
                        {cancelLabel}
                    </MUIButton>
                    <MUIButton
                        variant="contained"
                        onClick={onConfirm}
                        sx={{
                            minWidth: 140,
                            borderRadius: 2,
                        }}
                    >
                        {confirmLabel}
                    </MUIButton>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default LogoutConfirmDialog;
