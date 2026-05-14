import { Box, Dialog, DialogContent, IconButton, alpha, useTheme } from '@mui/material';
import { X } from 'lucide-react';
import DemoLeadCaptureForm from './DemoLeadCaptureForm';

const LiveDemoModal = ({ open, flow, onClose, onVerified }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth={false}
            PaperProps={{
                sx: {
                    width: 'min(1180px, calc(100vw - 32px))',
                    maxWidth: '1180px',
                    m: { xs: 2, md: 3 },
                    borderRadius: { xs: 4, md: 5 },
                    overflow: 'hidden',
                    bgcolor: isDark ? '#0f172a' : '#ffffff',
                    backgroundImage: 'none',
                    boxShadow: isDark
                        ? '0 36px 120px -44px rgba(2, 6, 23, 0.92)'
                        : '0 36px 120px -44px rgba(15, 23, 42, 0.3)'
                }
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    px: { xs: 2, md: 3 },
                    py: { xs: 1.2, md: 1.4 },
                    borderBottom: `1px solid ${alpha(isDark ? '#f8fafc' : '#cbd5e1', isDark ? 0.1 : 0.85)}`
                }}
            >
                <IconButton
                    onClick={onClose}
                    sx={{
                        color: 'text.secondary',
                        border: `1px solid ${alpha(isDark ? '#f8fafc' : '#cbd5e1', isDark ? 0.1 : 0.85)}`
                    }}
                >
                    <X size={18} />
                </IconButton>
            </Box>

            <DialogContent sx={{ p: { xs: 1.25, md: 2 }, bgcolor: 'transparent' }}>
                <DemoLeadCaptureForm
                    flow={flow}
                    open={open}
                    onVerified={onVerified}
                />
            </DialogContent>
        </Dialog>
    );
};

export default LiveDemoModal;
