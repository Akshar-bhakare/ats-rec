import { Modal, Box, useTheme } from '@mui/material';

const MUIModal = ({ children, contentSx = {}, ...props }) => {
    const theme = useTheme();


    return <Modal
        {...props}
        sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}
        slotProps={{
            backdrop: {
                sx: {
                    backdropFilter: "blur(20px)",       // increase blur strength here
                }
            }
        }}
    >
        <Box
            sx={{
                bgcolor: 'background.paper',
                p: 3,
                borderRadius: 2,
                width: { xs: '92vw', sm: '85vw', md: '60vw', lg: '40vw' },
                maxWidth: '900px',
                maxHeight: "90vh",
                overflow: "auto",
                ...contentSx,
                border: theme.palette.mode === "dark" ? 1 : contentSx?.border || "none",
            }}
        >
            {children}
        </Box>
    </Modal>
};

export default MUIModal;
