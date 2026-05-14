import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    IconButton,
    InputAdornment,
    MenuItem,
    TextField,
    Typography,
    useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowBackIosNewOutlined, Visibility, VisibilityOff } from '@mui/icons-material';
import { useRecruiterContextState } from '../../contexts/RecruiterContext';
import MUICreateForm from '../MUI/CommonCRUD/MUICreateForm';
import MUIAlert from '../MUI/commonUI/MUIAlert';
import MUIButton from '../MUI/commonUI/MUIButton';
import countryList from '../../assets/CountryCodes.json';
import { validatePasswordStrength } from '../../AppUtils/passwordValidation';

export default function NewManager() {
    const [recruiterState] = useRecruiterContextState();
    const navigate = useNavigate();
    const theme = useTheme();

    const [initial, setInitial] = useState(
        recruiterState?.recruiterInitialValuesDict || {}
    );
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [alertConfig, setAlertConfig] = useState({
        open: false,
        message: '',
        severity: 'info',
    });
    const handleAlertClose = (_e, reason) => {
        if (reason === 'clickaway') return;
        setAlertConfig(ac => ({ ...ac, open: false }));
    };

    const isEditing = Boolean(initial?._id);
    const formTitle = isEditing ? 'Edit Manager' : 'New Manager';
    const formSubtitle = isEditing ? 'Update manager details' : 'Enter manager details';

    const fields = useMemo(
        () => {
            const inputSx = {
                '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.default,
                    borderRadius: 1,
                },
                '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: alpha(theme.palette.divider, 0.9),
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: alpha(theme.palette.primary.main, 0.6),
                },
                '& .MuiInputBase-input': {
                    fontSize: 14,
                },
            };
            return [
                {
                    getField: () => (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                px: { xs: 2, sm: 3 },
                                py: 2,
                                background: theme.palette.background.default,
                                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                            }}
                        >
                            <IconButton
                                size="small"
                                onClick={() => navigate('/managers')}
                                aria-label="Go back"
                                sx={{ color: theme.palette.text.primary }}
                            >
                                <ArrowBackIosNewOutlined fontSize="small" />
                            </IconButton>
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                    {formTitle}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    {formSubtitle}
                                </Typography>
                            </Box>
                        </Box>
                    ),
                    fieldBoxOptions: { sx: { mb: 0 } },
                },
                {
                    type: 'row',
                    boxRowOptions: {
                        sx: {
                            gap: 2,
                            flexWrap: { xs: 'wrap', md: 'nowrap' },
                        },
                    },
                    rowColFields: [
                        {
                            getField: (data, onChange) => (
                                <TextField
                                    size="small"
                                    fullWidth
                                    name="firstName"
                                    label="First Name"
                                    required
                                    value={data.firstName ?? ''}
                                    onChange={e => {
                                        const cleaned = e.target.value.replace(/[^a-zA-Z\s'-]/g, '');
                                        onChange({
                                            target: {
                                                name: 'firstName',
                                                value: cleaned,
                                            },
                                        });
                                    }}
                                    sx={inputSx}
                                />
                            ),
                            boxColOptions: { sx: { flex: 1 } },
                        },
                        {
                            getField: (data, onChange) => (
                                <TextField
                                    size="small"
                                    fullWidth
                                    name="lastName"
                                    label="Last Name"
                                    required
                                    value={data.lastName ?? ''}
                                    onChange={e => {
                                        const cleaned = e.target.value.replace(/[^a-zA-Z\s'-]/g, '');
                                        onChange({
                                            target: {
                                                name: 'lastName',
                                                value: cleaned,
                                            },
                                        });
                                    }}
                                    sx={inputSx}
                                />
                            ),
                            boxColOptions: { sx: { flex: 1 } },
                        },
                    ],
                    fieldBoxOptions: { sx: { px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 }, mb: 2 } },
                },
                {
                    getField: (data, onChange) => (
                        <TextField
                            size="small"
                            fullWidth
                            type="email"
                            label="Email"
                            name="email"
                            required
                            value={data.email ?? ''}
                            onChange={onChange}
                            sx={inputSx}
                        />
                    ),
                    fieldBoxOptions: { sx: { px: { xs: 2, sm: 3 }, mb: 2 } },
                },
                {
                    getField: (data, onChange) => (
                        <TextField
                            size="small"
                            fullWidth
                            name="phoneNumber"
                            label="Phone"
                            value={data.phoneNumber ?? ''}
                            onChange={onChange}
                            sx={inputSx}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <TextField
                                            size="small"
                                            select
                                            name="countryCode"
                                            value={data.countryCode || '+91'}
                                            onChange={onChange}
                                            sx={{
                                                minWidth: 80,
                                                '& .MuiSelect-select': { padding: '6px 8px' },
                                                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                            }}
                                        >
                                            {countryList.map(c => (
                                                <MenuItem
                                                    key={c.code}
                                                    value={c.dial_code}
                                                    sx={{
                                                        fontSize: '0.9rem',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {c.name} ({c.dial_code})
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    ),
                    fieldBoxOptions: { sx: { px: { xs: 2, sm: 3 }, mb: 2 } },
                },
                ...(!isEditing ? [{
                    getField: (data, onChange) => (
                        <TextField
                            size="small"
                            fullWidth
                            type={showPassword ? 'text' : 'password'}
                            label="Password"
                            name="password"
                            value={data.password ?? ''}
                            onChange={e => {
                                onChange(e);
                                const val = e.target.value;
                                const { message } = validatePasswordStrength(val);
                                setPasswordError(message);
                            }}
                            required
                            error={Boolean(passwordError)}
                            helperText={passwordError}
                            sx={inputSx}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={() => setShowPassword(p => !p)}
                                            edge="end"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    ),
                    fieldBoxOptions: { sx: { px: { xs: 2, sm: 3 }, mb: 2 } },
                }] : []),
                {
                    getField: data => (
                        <input
                            type="hidden"
                            name="role"
                            value={data.role ?? 'manager'}
                        />
                    ),
                },
            ]
        },
        [formSubtitle, formTitle, isEditing, navigate, passwordError, showPassword, theme.palette.background.default, theme.palette.divider, theme.palette.primary.main, theme.palette.text.primary]
    );

    const initialValuesDict = useMemo(
        () => ({
            ...initial,
            role: initial.role ?? 'manager',
            countryCode: initial.countryCode || '+91',
            accessRestrictions: initial.accessRestrictions ?? {
                company: true,
                job: true,
                profile: true,
            },
        }),
        [initial]
    );

    const formKey = JSON.stringify({ id: initial._id || '', email: initial.email || '' });

    const handleSubmitExtended = (_e, apiData) => {
        if (apiData && (apiData._id || apiData.success)) {
            setAlertConfig({
                open: true,
                message: isEditing
                    ? 'Manager updated successfully'
                    : 'Manager added successfully',
                severity: 'success',
            });
            navigate('/managers', { replace: true });
        }
    };

    return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 2, p: { xs: 2, sm: 4 }, background: alpha(theme.palette.primary.main, 0.02) }}>
            <MUIAlert
                open={alertConfig.open}
                message={alertConfig.message}
                severity={alertConfig.severity}
                onClose={handleAlertClose}
            />

            <MUICreateForm
                key={formKey}
                fields={fields}
                initialValuesDict={initialValuesDict}
                submitUrl={
                    initial._id
                        ? `/api/recruiter/${initial._id}`
                        : '/api/recruiter'
                }
                submitMethod={initial._id ? 'PUT' : 'POST'}
                onBeforeSubmit={({ formData }) => {
                    const pw = formData.password;
                    if (!isEditing || pw) {
                        const { valid, message } = validatePasswordStrength(pw);
                        if (!valid) {
                            setPasswordError(message);
                            return false;
                        }
                    }
                    return true;
                }}
                onSubmitExtended={handleSubmitExtended}
                onError={err => {
                    const raw = err?.message || err?.error || JSON.stringify(err);
                    setAlertConfig({
                        open: true,
                        message: String(raw).replace(/^Error:\s*/, ''),
                        severity: 'error',
                    });
                }}
                formCardOptions={{
                    sx: {
                        width: { xs: '100%', sm: '85%', md: '60%', lg: '50%', xl: '40%' },
                        borderRadius: 3,
                        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                        boxShadow: theme.palette.mode === "dark"
                            ? `0 18px 40px ${alpha(theme.palette.common.black, 0.5)}`
                            : `0 18px 40px ${alpha(theme.palette.common.black, 0.12)}`,
                        overflow: "hidden",
                        bgcolor: theme.palette.background.paper,
                    },
                }}
                formBoxOptions={{ sx: { p: 0 } }}
            >
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 1.5,
                        px: { xs: 2, sm: 3 },
                        pb: { xs: 2, sm: 3 },
                        pt: 1,
                        borderTop: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                        background: alpha(theme.palette.background.paper, 0.9),
                    }}
                >
                    <MUIButton onClick={() => navigate('/managers')} sx={{ px: 2 }}>
                        Cancel
                    </MUIButton>
                    <MUIButton
                        type="submit"
                        variant="contained"
                        sx={{
                            px: 2.5,
                            color: theme.palette.primary.contrastText,
                            backgroundColor: theme.palette.primary.main,
                            '&:hover': { backgroundColor: theme.palette.primary.dark },
                        }}
                    >
                        {isEditing ? 'Update Manager' : 'Create Manager'}
                    </MUIButton>
                </Box>
            </MUICreateForm>
        </Box>
    );
}
