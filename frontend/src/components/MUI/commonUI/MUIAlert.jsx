import React from 'react';
import PropTypes from 'prop-types';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert from '@mui/material/Alert';
import { useTheme } from '@mui/material';

// Wrap MUI’s Alert so it works inside a Snackbar
const Alert = React.forwardRef(function Alert(props, ref) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

/**
 * MUIAlert
 *
 * Props:
 *  - open:         boolean, controls visibility
 *  - message:      string, text to display
 *  - severity:     one of 'error'|'warning'|'info'|'success' (defaults 'info')
 *  - autoHideDuration: number in ms before auto‑close (defaults 6000)
 *  - onClose:      fn(event, reason) to call when dismissed
 *  - anchorOrigin: { vertical, horizontal } override position (defaults top‑right)
 */
const MUIAlert = ({
    open,
    message,
    severity = 'info',
    autoHideDuration = 6000,
    onClose,
    anchorOrigin = { vertical: 'top', horizontal: 'right' }
}) => {
    const theme = useTheme();

    return (
        <Snackbar
            open={open}
            autoHideDuration={autoHideDuration}
            onClose={onClose}
            anchorOrigin={anchorOrigin}
            sx={{
                zIndex: theme.zIndex.drawer + 2,
            }}
        >
            <Alert
                onClose={onClose}
                severity={severity}
                sx={{
                    zIndex: theme.zIndex.drawer + 2,
                }}
            >
                {message}
            </Alert>
        </Snackbar>
    )
};

MUIAlert.propTypes = {
    open: PropTypes.bool.isRequired,
    message: PropTypes.string.isRequired,
    severity: PropTypes.oneOf(['error', 'warning', 'info', 'success']),
    autoHideDuration: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]),
    onClose: PropTypes.func.isRequired,
    anchorOrigin: PropTypes.shape({
        vertical: PropTypes.oneOf(['top', 'bottom']).isRequired,
        horizontal: PropTypes.oneOf(['left', 'center', 'right']).isRequired
    })
};

export default MUIAlert;
