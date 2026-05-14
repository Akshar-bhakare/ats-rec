import Box from '@mui/material/Box';

/**
 * Centers its children both vertically and horizontally in the viewport.
 * Great for login/signup screens.
 */
export default function MUICenterLayout({ children, sx = {}, ...rest }) {
    return (
        <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="85vh"   // fill entire viewport vertically
            width="100%"
            {...rest}
            sx={{
                outline: 'none',
                '&:focus': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                },
                ...sx,
            }}
        >
            {children}
        </Box>
    );
}
