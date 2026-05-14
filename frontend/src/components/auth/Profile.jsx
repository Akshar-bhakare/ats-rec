import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    TextField,
    MenuItem,
    Avatar,
    IconButton,
    styled,
    Button,
    Typography
} from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import MUICreateForm from '../MUI/CommonCRUD/MUICreateForm';
import MUIButton from '../MUI/commonUI/MUIButton';
import MUIAlert from '../MUI/commonUI/MUIAlert';
import MUIAccordion from '../MUI/commonUI/MUIAccordion';

import { useAuthContextState } from '../../contexts/AuthContext';
import { useUiContextState } from '../../contexts/UiContext';
import { fetchData } from '../../AppUtils/dataAPI';
import countryList from '../../assets/CountryCodes.json';

const Input = styled('input')({ display: 'none' });

const ROLE_LABELS = Object.freeze({
    ultra_admin: 'Ultra Admin',
    client_admin: 'Client Admin',
    manager: 'Manager',
    recruiter: 'Recruiter',
    job_seeker: 'Student',
    interviewer: 'Interviewer',
    candidate: 'Candidate'
});

const formatUserRoleLabel = role => {
    const normalizedRole = String(role || '').trim().toLowerCase();
    if (!normalizedRole) return '-';
    if (ROLE_LABELS[normalizedRole]) return ROLE_LABELS[normalizedRole];

    return normalizedRole
        .split('_')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export default function Profile() {
    const [authState, setAuthState] = useAuthContextState();
    const [, setUiState] = useUiContextState();
    const me = useMemo(() => authState?.user ?? {}, [authState?.user]);
    const canEditProfile =
        authState?.user?.role === 'recruiter'
            ? authState?.user?.accessRestrictions?.profile !== false
            : true;
    const roleLabel = formatUserRoleLabel(me.role);

    const [data, setData] = useState({
        profileUrl: '',
        profileImageBase64: null,
        firstName: '',
        lastName: '',
        email: '',
        countryCode: '',
        phoneNumber: '',
    });
    const [socialEntries, setSocialEntries] = useState([{ platform: '', url: '' }]);
    const [saving, setSaving] = useState(false);
    const [initialState, setInitialState] = useState(null);
    const [isDirty, setIsDirty] = useState(false);
    const [alert, setAlert] = useState({ open: false, message: '', severity: 'info' });

    // Seed form from DB, ignore any blob: URLs
    useEffect(() => {
        if (!me._id) return;
        const baseData = {
            profileUrl:
                typeof me.profileUrl === 'string' && me.profileUrl.startsWith('http')
                    ? me.profileUrl
                    : '',
            profileImageBase64: null,
            firstName: me.firstName || '',
            lastName: me.lastName || '',
            email: me.email || '',
            countryCode: me.countryCode || '',
            phoneNumber: me.phoneNumber || ''
        };

        const entries = me.socialLinks && typeof me.socialLinks === 'object'
            ? Object.entries(me.socialLinks).map(([platform, url]) => ({ platform, url }))
            : [];
        const social = entries.length ? entries : [{ platform: '', url: '' }];

        setData(baseData);
        setSocialEntries(social);
        setInitialState({ data: baseData, socialEntries: social });
        setIsDirty(false);
    }, [me]);

    const handleAlertClose = (_, reason) => {
        if (reason === 'clickaway') return;
        setAlert(a => ({ ...a, open: false }));
    };

    const setField = key => e => {
        const raw = e.target.value;
        const value = key === 'phoneNumber' ? String(raw || '').replace(/\D/g, '') : raw;
        setData(d => ({ ...d, [key]: value }));
    };

    // Read file into Base64 string
    const handleImageChange = e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const [_, base64] = reader.result.split(',');
            setData(d => ({
                ...d,
                profileUrl: reader.result,
                profileImageBase64: base64
            }));
        };
        reader.readAsDataURL(file);
    };

    const handlePlatformChange = (i, platform) =>
        setSocialEntries(se => se.map((ent, idx) =>
            idx === i ? { ...ent, platform } : ent
        ));

    const handleUrlChange = (i, url) =>
        setSocialEntries(se => se.map((ent, idx) =>
            idx === i ? { ...ent, url } : ent
        ));

    const addSocialEntry = () =>
        setSocialEntries(se => [...se, { platform: '', url: '' }]);

    const removeSocialEntry = i =>
        setSocialEntries(se => se.filter((_, idx) => idx !== i));

    useEffect(() => {
        if (!initialState) return;

        const normalizeSocial = (list = []) =>
            list.map(({ platform = '', url = '' }) => ({ platform, url }));

        const isSameData = ['profileUrl', 'profileImageBase64', 'firstName', 'lastName', 'email', 'countryCode', 'phoneNumber']
            .every(k => (data?.[k] ?? '') === (initialState.data?.[k] ?? ''));

        const currSocial = normalizeSocial(socialEntries);
        const baseSocial = normalizeSocial(initialState.socialEntries);
        const isSameSocial =
            currSocial.length === baseSocial.length &&
            currSocial.every((item, idx) =>
                item.platform === (baseSocial[idx]?.platform ?? '') &&
                item.url === (baseSocial[idx]?.url ?? '')
            );

        setIsDirty(!(isSameData && isSameSocial));
    }, [data, socialEntries, initialState]);

    const saveProfile = async () => {
        if (!me._id) {
            setAlert({ open: true, message: 'Missing user ID.', severity: 'error' });
            return;
        }
        setSaving(true);

        const payload = {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            countryCode: data.countryCode,
            phoneNumber: data.phoneNumber,
            socialLinks: socialEntries.reduce((acc, { platform, url }) => {
                if (platform) acc[platform] = url;
                return acc;
            }, {})
        };
        if (data.profileImageBase64) {
            payload.profileImageBase64 = data.profileImageBase64;
        }

        try {

            setUiState({
                loadingMsg: "Loading, Please wait..."
            });

            const updated = await fetchData(`/api/users/${me._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            setAuthState({ user: updated, booleanSubmitEmail: updated?.email });
            setInitialState({
                data: { ...data, profileImageBase64: null },
                socialEntries: socialEntries.map(s => ({ ...s }))
            });
            setIsDirty(false);
            setAlert({ open: true, message: 'Profile updated!', severity: 'success' });
        } catch (err) {
            setAlert({ open: true, message: err.message || 'Save failed', severity: 'error' });
        } finally {

            setUiState({
                loadingMsg: null,
            });

            setSaving(false);
        }
    };

    const onSubmitExtended = () => {
        if (!canEditProfile) {
            setAlert({ open: true, message: 'Not authorized to update profile.', severity: 'error' });
            return;
        }

        const missing = [];
        if (!data.firstName.trim()) missing.push('First Name');
        if (!data.lastName.trim()) missing.push('Last Name');
        if (!data.email.trim()) missing.push('Email');
        if (!data.countryCode) missing.push('Country Code');
        if (!data.phoneNumber.trim()) missing.push('Phone Number');

        if (missing.length) {
            setAlert({ open: true, message: `Missing: ${missing.join(', ')}`, severity: 'error' });
            return;
        }
        saveProfile();
    };

    const fields = [
        {
            type: 'label',
            variant: 'h4',
            value: 'Edit Profile',
            align: 'center',
            sx: { mb: 3, fontWeight: 600 }
        },
        {
            getField: () => (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                            <Avatar src={data.profileUrl} sx={{ width: 100, height: 100 }} />
                            <label htmlFor="profile-upload">
                                <Input
                                    accept="image/*"
                                    id="profile-upload"
                                    type="file"
                                    onChange={handleImageChange}
                                />
                                <IconButton
                                    component="span"
                                    sx={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 'calc(50% - 20px)',
                                        bgcolor: 'background.paper',
                                        '&:hover': { bgcolor: 'grey.100' }
                                    }}
                                >
                                    <PhotoCamera />
                                </IconButton>
                            </label>
                        </Box>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            <b>{roleLabel}</b>
                        </Typography>
                    </Box>

                    <TextField
                        fullWidth
                        label="First Name*"
                        value={data.firstName}
                        onChange={setField('firstName')}
                    />
                    <TextField
                        fullWidth
                        label="Last Name*"
                        value={data.lastName}
                        onChange={setField('lastName')}
                    />
                    <TextField
                        fullWidth
                        type="email"
                        label="Email*"
                        value={data.email}
                        onChange={setField('email')}
                    />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            select
                            label="Country Code*"
                            value={data.countryCode}
                            onChange={setField('countryCode')}
                            sx={{ width: '30%' }}
                        >
                            {countryList.map(({ name, dial_code, code }) => (
                                <MenuItem
                                    key={code}
                                    value={dial_code}
                                    sx={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}
                                >
                                    {name} ({dial_code})
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            fullWidth
                            label="Phone Number*"
                            value={data.phoneNumber}
                            onChange={setField('phoneNumber')}
                        />
                    </Box>

                    <MUIAccordion title="Social Media URLs" defaultExpanded>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {socialEntries.map((ent, idx) => (
                                <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    <TextField
                                        select
                                        label="Platform"
                                        value={ent.platform}
                                        onChange={e => handlePlatformChange(idx, e.target.value)}
                                        sx={{ width: '30%' }}
                                    >
                                        {['Facebook', 'Instagram', 'LinkedIn', 'Twitter'].map(p => (
                                            <MenuItem key={p} value={p}>{p}</MenuItem>
                                        ))}
                                    </TextField>
                                    <TextField
                                        fullWidth
                                        label="Profile URL"
                                        value={ent.url}
                                        onChange={e => handleUrlChange(idx, e.target.value)}
                                        placeholder="https://…"
                                    />
                                    <IconButton
                                        size="small"
                                        onClick={() => removeSocialEntry(idx)}
                                        aria-label="remove entry"
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            ))}
                            <Button
                                startIcon={<AddIcon />}
                                onClick={addSocialEntry}
                                variant="outlined"
                            >
                                Add More
                            </Button>
                        </Box>
                    </MUIAccordion>

                    <MUIButton
                        variant="contained"
                        disabled={saving || !isDirty || !canEditProfile}
                        type="submit"
                        sx={{ alignSelf: 'flex-end', mt: 1 }}
                    >
                        Save
                    </MUIButton>
                </Box >
            )
        }
    ];

    return (
        <MUICenterLayout>
            <MUIAlert
                open={alert.open}
                message={alert.message}
                severity={alert.severity}
                onClose={handleAlertClose}
            />
            <MUICreateForm
                initialValuesDict={data}
                fields={fields}
                isSubmitting={saving}
                backUrl="/dashboard"
                onSubmitExtended={onSubmitExtended}
                formCardOptions={{
                    sx: { width: { xs: '95%', sm: '80%', md: '60%', lg: '50%' } }
                }}
            />
        </MUICenterLayout>
    );
}
