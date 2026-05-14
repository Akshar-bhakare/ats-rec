import { useState, useEffect, useMemo } from 'react';
import { Box, TextField, CircularProgress, InputAdornment, MenuItem, IconButton, } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useClientAdminContextState } from '../../contexts/ClientAdminContext';
import { useUiContextState } from '../../contexts/UiContext';
import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import MUICreateForm from '../MUI/CommonCRUD/MUICreateForm';
import { fetchData } from '../../AppUtils/dataAPI';
import MUIAlert from '../MUI/commonUI/MUIAlert';
import countryList from '../../assets/CountryCodes.json';
import { validatePasswordStrength } from '../../AppUtils/passwordValidation';
import { Visibility, VisibilityOff } from '@mui/icons-material';

export default function NewClientAdmin() {
    const [authState] = useAuthContextState();
    const [clientAdminState] = useClientAdminContextState();
    const [, setUiState] = useUiContextState();
    const navigate = useNavigate();
    const [alertCfg, setAlertCfg] = useState({
        open: false,
        message: '',
        severity: 'info',
    });
    const closeAlert = (_e, r) => r !== 'clickaway' && setAlertCfg(a => ({ ...a, open: false }));
    const userInit = clientAdminState.clientAdminInitialValuesDict?.id ? { ...clientAdminState.clientAdminInitialValuesDict, _id: clientAdminState.clientAdminInitialValuesDict.id } : { ...clientAdminState.clientAdminInitialValuesDict || {} };
    const editing = Boolean(userInit._id || userInit.id);
    const tenantId = editing ? userInit.clientId ?? authState?.user?._id : authState?.user?._id;
    const [fieldErrors, setFieldErrors] = useState({});
    const [passwordError, setPasswordError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const validateClientCompany = (value) => {
        if (!value) return 'Client Company is required';
        if (!/^[a-zA-Z0-9_]+$/.test(value))
            return 'Must be alphanumeric (underscores OK)';
        return '';
    };
    const [adminInit, setAdminInit] = useState({});
    const [loadingAdmin, setLoadingAdmin] = useState(editing);

    useEffect(() => {
        if (!editing) return;
        setLoadingAdmin(true);

        setUiState({
            loadingMsg: "Loading, Please wait..."
        });

        fetchData(`/api/admins/${tenantId}`)
            .then(data => setAdminInit(data || {}))
            .catch(() => setAdminInit({}))
            .finally(() => {
                setLoadingAdmin(false);

                setUiState({
                    loadingMsg: null,
                });

            });

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing, tenantId]);

    const initialValues = useMemo(
        () => ({
            firstName: userInit.firstName || '',
            lastName: userInit.lastName || '',
            email: userInit.email || '',
            countryCode: userInit.countryCode || '+91',
            phoneNumber: userInit.phoneNumber || '',
            ...(editing ? {} : { password: '' }),
            role: 'client_admin',
            clientId: tenantId,
            createdBy: userInit.createdBy || authState?.user?._id,
            clientCompany: editing ? adminInit.clientCompany || '' : '',
            aiSelektWaId: adminInit.aiSelektWaId ?? "",
            totalCredit: adminInit.totalCredit ?? 1000,
            videoInterviewCredit: adminInit.videoInterviewCredit ?? 10,
            creditRatePerCall: adminInit.creditRatePerCall ?? 1,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [editing, adminInit, tenantId]
    );

    if (editing && loadingAdmin) {
        return (
            <MUICenterLayout>
                <CircularProgress />
            </MUICenterLayout>
        );
    }

    const fields = [
        {
            type: 'label',
            variant: 'h4',
            value: editing ? 'Edit Client Admin' : 'New Client Admin',
            align: 'center',
            sx: { my: 5, fontWeight: 600 },
        },
        {
            type: 'row',
            rowColFields: [
                {
                    getField: (d, onChange) => (
                        <Box>
                            <TextField size='small' fullWidth name="firstName" label="First Name" value={d.firstName} onChange={onChange} required />
                        </Box>
                    ),
                    boxColOptions: { sx: { flex: 1 } },
                },
                {
                    getField: (d, onChange) => (
                        <Box>
                            {/* <Typography sx={{ fontWeight: 500, mb: 0.5 }}>Last Name*</Typography> */}
                            <TextField size='small' fullWidth name="lastName" label="Last Name" value={d.lastName} onChange={onChange} required />
                        </Box>
                    ),
                    boxColOptions: { sx: { flex: 1 } },
                },
            ],
            sx: { mb: 2, gap: 2 },
        },
        {
            getField: (d, onChange) => (
                <Box sx={{ mb: 2 }}>
                    {/* <Typography sx={{ fontWeight: 500, mb: 0.5 }}>Email*</Typography> */}
                    <TextField size='small' fullWidth type="email" name="email" label="Email" value={d.email} onChange={onChange} required disabled={editing} />
                </Box>
            ),
        },
        {
            getField: (data, onChange) => (
                <Box sx={{ mb: 2 }}>
                    <TextField
                        size='small'
                        fullWidth
                        name="phoneNumber"
                        label="Phone"
                        value={data.phoneNumber ?? ''}
                        onChange={onChange}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <TextField
                                        select
                                        size="small"
                                        name="countryCode"
                                        value={data.countryCode}
                                        onChange={onChange}
                                        sx={{
                                            minWidth: 80,
                                            py: 0,
                                            my: 4,
                                            "& .MuiSelect-select": { padding: "2px 4px" },
                                        }}
                                    >
                                        {countryList.map((c) => (
                                            <MenuItem
                                                key={c.code}
                                                value={c.dial_code}
                                                sx={{ fontSize: "0.9rem", whiteSpace: "nowrap" }}
                                            >
                                                {c.name} ({c.dial_code})
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>
            ),
        },
        {
            getField: (d, onChange) => (
                !editing && <Box sx={{ mb: 2 }}>
                    <TextField
                        size='small'
                        fullWidth
                        name="clientCompany"
                        label="Client Company"
                        value={d.clientCompany}
                        onChange={e => {
                            onChange(e);
                            const err = validateClientCompany(e.target.value);
                            setFieldErrors(fe => ({ ...fe, clientCompany: err }));
                        }}
                        error={Boolean(fieldErrors.clientCompany)}
                        helperText={fieldErrors.clientCompany}
                        required
                    />
                </Box>
            ),
        },
        {
            getField: (d, onChange) => (
                <Box sx={{ mb: 2 }}>
                    {/* <Typography sx={{ fontWeight: 500, mb: 0.5 }}>Total Credit*</Typography> */}
                    <TextField
                        size='small'
                        fullWidth
                        type="tel"
                        label="Hirex REC WhatsApp Number Id"
                        helperText="Get it from Meta bussiness's WhatsApp Account..."
                        name="aiSelektWaId"
                        value={d.aiSelektWaId}
                        onChange={onChange}
                    />
                </Box>
            ),
        },
        {
            getField: (d, onChange) => (
                <Box sx={{ mb: 2 }}>
                    {/* <Typography sx={{ fontWeight: 500, mb: 0.5 }}>Total Credit*</Typography> */}
                    <TextField
                        size='small'
                        fullWidth
                        type="number"
                        label="AI Call Credit"
                        name="totalCredit"
                        value={d.totalCredit}
                        onChange={onChange}
                        required
                    />
                </Box>
            ),
        },
        {
            getField: (d, onChange) => (
                <Box sx={{ mb: 2 }}>
                    <TextField
                        size='small'
                        fullWidth
                        type="number"
                        label="Video Interview Credit"
                        name="videoInterviewCredit"
                        value={d.videoInterviewCredit}
                        onChange={onChange}
                        required
                    />
                </Box>
            ),
        },
        {
            getField: (d, onChange) => (
                <Box sx={{ mb: 2 }}>
                    {/* <Typography sx={{ fontWeight: 500, mb: 0.5 }}>Credit Rate per Call</Typography> */}
                    <TextField
                        size='small'
                        fullWidth
                        type="number"
                        label="Credit Rate per Call"
                        name="creditRatePerCall"
                        value={d.creditRatePerCall}
                        onChange={onChange}
                        required
                    />
                </Box>
            ),
        }, {
            getField: (d, onChange) => (
                <Box sx={{ mb: 2 }}>
                    {/* <Typography sx={{ fontWeight: 500, mb: 0.5 }}>Password*</Typography> */}
                    <TextField
                        size='small'
                        fullWidth
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={d.password}
                        onChange={e => {
                            onChange(e);
                            const val = e.target.value;
                            if (val) {
                                const { message } = validatePasswordStrength(val);
                                setPasswordError(message);
                            } else {
                                setPasswordError('');
                            }
                        }}
                        autoComplete="new-password"
                        required
                        error={Boolean(passwordError)}
                        helperText={passwordError}
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
                </Box>
            ),
        },
        {
            getField: () => (
                <>
                    <input type="hidden" name="role" value="client_admin" />
                    <input type="hidden" name="clientId" value={tenantId} />
                </>
            ),
        },
        {
            label: editing ? 'Update' : 'Save',
            type: 'submit',
            align: 'center',
            disabled: Boolean(fieldErrors.clientCompany),
            sx: { mt: 1 },
        },
    ];

    const handleSubmitExtended = async (ev, userData) => {
        if (!userData?._id) return;
        const cc = ev?.target?.clientCompany?.value;
        const err = validateClientCompany(cc);
        if (cc && err) {
            setFieldErrors(fe => ({ ...fe, clientCompany: err }));
            return;                  // abort until it’s fixed
        }

        try {
            setAlertCfg({
                open: true,
                message: editing
                    ? 'Client admin updated successfully'
                    : 'Client admin added successfully',
                severity: 'success'
            });
            navigate('/admins');
        } catch (err) {
            console.log(
                "Error in client admin creation: ", err,
            );

            setAlertCfg({
                open: true,
                message: err.message || 'Save failed',
                severity: 'error'
            });
        }
    };

    return (
        <MUICenterLayout>
            <MUIAlert {...alertCfg} onClose={closeAlert} />   {/* ★ NEW */}

            <MUICreateForm
                fields={fields}
                initialValuesDict={initialValues}
                submitUrl={editing ? `/api/admins/${userInit._id || userInit.id}` : '/api/admins'}
                submitMethod={editing ? 'PUT' : 'POST'}
                onBeforeSubmit={({ formData }) => {
                    const pw = formData.password;
                    if (pw) {
                        const { valid, message } = validatePasswordStrength(pw);
                        if (!valid) {
                            setPasswordError(message);
                            return false;
                        }
                    }
                    return true;
                }}
                onSubmitExtended={handleSubmitExtended}
                onError={err =>
                    setAlertCfg({
                        open: true,
                        message: err.message?.replace(/^Error:\s*/, '') || 'Something went wrong',
                        severity: 'error',
                    })
                }
                backUrl="/admins"
                formCardOptions={{
                    sx: {
                        width: {
                            xs: (95 - 7) + '%',
                            sm: (75 - 7) + '%',
                            md: (60 - 7) + '%',
                            lg: (50 - 7) + '%',
                            xl: (40 - 7) + '%',
                        },
                    },
                }}
                formBoxOptions={{
                    display: "flex",
                    flexDirection: "column",
                }}
            />
        </MUICenterLayout>
    );
}
