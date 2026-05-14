import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanyContextState } from '../../contexts/CompanyContext';
import MUICreateForm from '../MUI/CommonCRUD/MUICreateForm';
import { Box, IconButton, TextField, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowBackIosNewOutlined } from '@mui/icons-material';
import MUIButton from '../MUI/commonUI/MUIButton';



const getCompanyId = (data) => {
    const raw = data?._id ?? data?.id;
    if (!raw) return '';
    const asString =
        typeof raw === 'string'
            ? raw
            : (raw?.$oid ? raw.$oid : String(raw));
    return /^[0-9a-fA-F]{24}$/.test(asString) ? asString : '';
};

const isValidHttpUrl = (value = '') => {
    if (!value || typeof value !== 'string') return false;
    try {
        const url = new URL(value.trim());
        const protocolOk = ['http:', 'https:'].includes(url.protocol);
        const hostnameOk = Boolean(url.hostname) && (url.hostname.includes('.') || ['localhost', '127.0.0.1'].includes(url.hostname));
        return protocolOk && hostnameOk;
    } catch {
        return false;
    }
};

export const NewCompany = () => {
    const [gState, setGState] = useCompanyContextState();
    const navigate = useNavigate();
    const theme = useTheme();

    const renderRef = useRef(0);
    renderRef.current += 1;
    // console.log('[NewCompany] render #', renderRef.current, {
    //     gState_companyInitialValuesDict: gState?.companyInitialValuesDict
    // });

    const allCompanyStateSetters = {};
    const getGlobalStateSetterFunc = (gStateKey) => {
        // console.log('[NewCompany] getGlobalStateSetterFunc created for key =', gStateKey);
        const stateSetter = (val) => {
            // console.log('[NewCompany] setGState called for key =', gStateKey, {
            //     incomingVal: val,
            //     typeofVal: typeof val
            // });
            return setGState(
                typeof val === 'function'
                    ? (prev) => {
                        const nextVal = val?.(prev?.[gStateKey]);
                        // console.log('[NewCompany] functional setGState for key =', gStateKey, {
                        //     prev: prev?.[gStateKey],
                        //     next: nextVal
                        // });
                        return { [gStateKey]: nextVal };
                    }
                    : { [gStateKey]: val }
            );
        };
        allCompanyStateSetters[gStateKey] = stateSetter;
        return stateSetter;
    };

    const setCompanyInitialValues = getGlobalStateSetterFunc('companyInitialValuesDict');

    useEffect(() => {
        // console.log('[NewCompany] useEffect watch: companyInitialValuesDict changed →', gState?.companyInitialValuesDict);
    }, [gState?.companyInitialValuesDict]);

    useEffect(() => {
        const dumpStorage = (storage, label) => {
            try {
                const snapshot = {};
                for (let i = 0; i < storage.length; i++) {
                    const k = storage.key(i);
                    if (!k) continue;
                    if (k.includes('/api/companies')) {
                        snapshot[k] = storage.getItem(k);
                    }
                }
                // console.log(`[NewCompany] ${label} keys containing "/api/companies" →`, snapshot);
            } catch (e) {
                console.warn(`[NewCompany] failed reading ${label}:`, e);
            }
        };
        dumpStorage(window.localStorage, 'localStorage');
        dumpStorage(window.sessionStorage, 'sessionStorage');
    }, []);

    useEffect(() => {
        if (gState?.companyWsSubmit) {
            try {
                const formEl = document.querySelector('form');
                if (formEl && typeof formEl.requestSubmit === 'function') {
                    formEl.requestSubmit();
                } else if (formEl) {
                    // Older fallback
                    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
            } catch (e) {
                console.warn('[NewCompany] programmatic submit failed:', e);
            } finally {
                setGState({ companyWsSubmit: false });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gState?.companyWsSubmit]);


    const onChangeExtended = (e) => {
        const { name, value } = e?.target || {};
        // console.log('[NewCompany] onChangeExtended', { name, value });
        if (!name) return;
        setCompanyInitialValues((prev) => {
            const next = { ...(prev || {}), [name]: value };
            // console.log('[NewCompany] onChange → merged state', { prev, next });
            return next;
        });
    };
    // ----------------------------------------------------------------

    const companyId = getCompanyId(gState?.companyInitialValuesDict);
    const submitUrl = companyId ? `/api/companies/${companyId}` : '/api/companies';
    const submitMethod = companyId ? 'PUT' : 'POST';
    const isEditing = Boolean(companyId);
    const formTitle = isEditing ? 'Update Company' : 'Add Company';
    const formSubtitle = isEditing
        ? 'Update company details'
        : 'Enter company details';

    const fieldPadding = { px: { xs: 2, sm: 3 }, mb: 2 };
    const firstFieldPadding = { px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 }, mb: 2 };
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
    // console.log('[NewCompany] submit config', { submitUrl, submitMethod });

    const validateWebsite = useCallback((formEl, valueRaw) => {
        const websiteInput = formEl?.querySelector?.('input[name="website"]');
        const val = (valueRaw || '').trim();
        const valid = isValidHttpUrl(val);

        if (websiteInput?.setCustomValidity) {
            websiteInput.setCustomValidity(valid ? '' : 'Website must be a valid http(s) URL (e.g., https://example.com)');
        }
        if (!valid && websiteInput?.reportValidity) {
            websiteInput.reportValidity();
        }

        if (valid && websiteInput) {
            // Normalize + sync back to state by dispatching an input event
            websiteInput.value = val;
            websiteInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        return valid;
    }, []);

    const formInitialValues = useMemo(() => {
        const src = gState?.companyInitialValuesDict || {};
        const allowedKeys = [
            'name',
            'industry',
            'size',
            'description',
            'website',
            'logoUrl',
            'about',
            'policyBenefits',
            'faqs',
        ];
        return allowedKeys.reduce((acc, key) => {
            if (src[key] != null) acc[key] = src[key];
            return acc;
        }, {});
    }, [gState?.companyInitialValuesDict]);

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "center",
                pt: 2,
                p: { xs: 2, sm: 4 },
                background: alpha(theme.palette.primary.main, 0.02),
                minHeight: "calc(100vh - 120px)",
            }}
        >
            <MUICreateForm
                initialValuesDict={formInitialValues}
                onChangeExtended={onChangeExtended}
                onBeforeSubmit={({ formEl, formData }) => {
                    const ok = validateWebsite(formEl, formData?.website);
                    if (!ok) return false;
                    return true;
                }}
                formCardOptions={{
                    sx: {
                        width: { xs: '100%', sm: '85%', md: '70%', lg: '60%', xl: '50%' },
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
                fields={[
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
                                    onClick={() => navigate("/companies/")}
                                    aria-label="Go back"
                                    sx={{ color: theme.palette.text.primary }}
                                >
                                    <ArrowBackIosNewOutlined fontSize="small" />
                                </IconButton>
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {formTitle}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                        {formSubtitle}
                                    </Typography>
                                </Box>
                            </Box>
                        ),
                        fieldBoxOptions: { sx: { mb: 0 } },
                    },
                    {
                        AutocompleteInputProps: {
                            name: "name",
                            label: "Company Name",
                            type: "text",
                            required: true,
                            sx: inputSx,
                        },
                        fieldBoxOptions: { sx: firstFieldPadding },
                    },
                    {
                        type: "row",
                        boxRowOptions: { sx: fieldPadding },
                        rowColFields: [
                            {
                                AutocompleteInputProps: {
                                    name: "industry",
                                    label: "Industry",
                                    type: "text",
                                    sx: inputSx,
                                }
                            },
                            {
                                getField: (data, onChange) => (
                                    <TextField
                                        size="small"
                                        fullWidth
                                        name="size"
                                        label="Company Size"
                                        placeholder="11-25"
                                        value={data.size ?? ''}
                                        onChange={(e) => {
                                            const raw = e.target.value || '';
                                            const cleaned = raw.replace(/[^0-9-]/g, '');
                                            const parts = cleaned.split('-');
                                            const next =
                                                parts.length <= 1
                                                    ? parts[0]
                                                    : `${parts[0]}-${parts.slice(1).join('').replace(/-/g, '')}`;
                                            onChange({
                                                target: {
                                                    name: 'size',
                                                    value: next,
                                                },
                                            });
                                        }}
                                        inputProps={{
                                            inputMode: "text",
                                            pattern: "^\\d+(?:-\\d+)?$",
                                        }}
                                        sx={inputSx}
                                    />
                                )
                            },
                        ],
                        fieldBoxOptions: { sx: { mb: 0 } },
                    },
                    {
                        AutocompleteInputProps: {
                            name: "website",
                            label: "Website",
                            type: "url",
                            required: true,
                            inputProps: {
                                pattern: "https?://.*",
                                title: "Enter a valid http(s) URL, e.g., https://example.com"
                            },
                            sx: inputSx,
                        },
                        fieldBoxOptions: { sx: fieldPadding },
                    },
                    {
                        AutocompleteInputProps: {
                            name: "description",
                            label: "Description",
                            type: "text",
                            multiline: true,
                            rows: 3,
                            sx: inputSx,
                        },
                        fieldBoxOptions: { sx: fieldPadding },
                    },
                    // {
                    //     AutocompleteInputProps: {
                    //         name: "logoUrl",
                    //         label: "Logo URL",
                    //         type: "url",
                    //         sx: inputSx,
                    //     },
                    //     fieldBoxOptions: { sx: fieldPadding },
                    // },
                    {
                        AutocompleteInputProps: {
                            name: "about",
                            label: "About Company",
                            type: "text",
                            multiline: true,
                            rows: 3,
                            required: true,
                            sx: inputSx,
                        },
                        fieldBoxOptions: { sx: fieldPadding },
                    },
                    {
                        AutocompleteInputProps: {
                            name: "policyBenefits",
                            label: "Policy & Benefits",
                            type: "text",
                            multiline: true,
                            rows: 3,
                            sx: inputSx,
                        },
                        fieldBoxOptions: { sx: fieldPadding },
                    },
                    {
                        AutocompleteInputProps: {
                            name: "faqs",
                            label: "FAQs",
                            type: "text",
                            multiline: true,
                            rows: 3,
                            sx: inputSx,
                        },
                        fieldBoxOptions: { sx: fieldPadding },
                    },
                ]}
                submitUrl={submitUrl}
                submitMethod={submitMethod}
                onSubmitExtended={() => {
                    navigate('/companies/');
                    setGState({
                        companyInitialValuesDict: null,
                        companyRowsList: null,
                        companyListMeta: null,
                    });
                }}
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
                    <MUIButton onClick={() => navigate('/companies/')} sx={{ px: 2 }}>
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
                        {isEditing ? 'Update Company' : 'Create Company'}
                    </MUIButton>
                </Box>
            </MUICreateForm>
        </Box>
    )
}

export default NewCompany;
