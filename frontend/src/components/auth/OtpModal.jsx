import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
} from '@mui/material';
import MUIButton from '../MUI/commonUI/MUIButton';

const OtpModal = ({ open, onClose, onSubmit, label = 'OTP' }) => {
    const [otp, setOtp] = useState('');

    const handleSubmit = () => {
        onSubmit(otp);
        setOtp('');
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Enter {label}</DialogTitle>

            <DialogContent>
                <TextField
                    fullWidth
                    autoFocus
                    margin="normal"
                    label={`${label} Code`}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                />
            </DialogContent>

            <DialogActions sx={{ gap: 1, p: 2 }}>
                <MUIButton onClick={onClose}>Cancel</MUIButton>
                <MUIButton onClick={handleSubmit}>Submit</MUIButton>
            </DialogActions>
        </Dialog>
    );
};

export default OtpModal;
