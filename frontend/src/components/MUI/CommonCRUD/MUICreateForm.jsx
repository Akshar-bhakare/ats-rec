import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Card, IconButton, Typography } from '@mui/material';

import MUIButton from '../commonUI/MUIButton';
import MUIInput from '../commonUI/MUIInput';
import { fetchData, performDeploySafeFetch } from '../../../AppUtils/dataAPI';
import { syncTrimmedValuesToForm, trimFormStrings } from '../../../AppUtils/formUtils';
import KeyboardBackspaceRoundedIcon from '@mui/icons-material/KeyboardBackspaceRounded';
import { useNavigate } from 'react-router-dom';
import MUIFileInput from '../commonUI/MUIFileInput';
import MUICheckBox from '../commonUI/MUICheckBox';
import { useUiContextState } from '../../../contexts/UiContext';
import MUIAlert from '../commonUI/MUIAlert';
import { ArrowBackIosNewOutlined } from '@mui/icons-material';

const DECIMAL_NUMERIC_FIELDS = new Set(['minExp', 'maxExp', 'minSalary', 'maxSalary']);
const INTEGER_NUMERIC_FIELDS = new Set(['positions', 'phoneNumber']);
const NUMERIC_ONLY_FIELDS = new Set([...DECIMAL_NUMERIC_FIELDS, ...INTEGER_NUMERIC_FIELDS]);

const isFileLikeValue = (value) => {
    if (!value || typeof value !== 'object') return false;
    if (typeof File !== 'undefined' && value instanceof File) return true;
    if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
    return false;
};

const sanitizeNumericInput = (name, val) => {
    if (typeof val !== 'string') return val;

    if (DECIMAL_NUMERIC_FIELDS.has(name)) {
        const cleaned = val.replace(/[^\d.]/g, '');
        const [whole = '', ...fractionalParts] = cleaned.split('.');
        const fractional = fractionalParts.join('');
        return fractionalParts.length ? `${whole}.${fractional}` : whole;
    }

    if (INTEGER_NUMERIC_FIELDS.has(name)) {
        return val.replace(/\D/g, '');
    }

    return val;
};


const MUICreateForm = ({
    fields = [],
    initialValuesDict = {},
    formCardOptions,
    formBoxOptions,
    onChangeExtended,
    onBeforeSubmit,
    onSubmitExtended,
    onSubmitErrorExtended,
    submitUrl,
    submitMethod = 'POST',
    onBackExtended,
    onError,
    backUrl,
    children,
    ...restFormProps
}) => {

    const initVals = useMemo(() => initialValuesDict, [initialValuesDict]);

    const leafFields = useMemo(() => {
        const flatten = (arr) =>
            arr.reduce((acc, f) => {
                if (f.type === 'row') return acc.concat(flatten(f.fields || []));
                return acc.concat(f);
            }, []);
        return flatten(fields);
    }, [fields]);

    const getFormDataState = useCallback(() =>
        leafFields.reduce((a, f) => {
            if (f.name) a[f.name] = f.type === 'checkbox' ? false : '';
            return a;
        }, {}), [leafFields]);

    const [, setUiState] = useUiContextState();
    const [createFormData, setCreateFormData] = useState({
        ...getFormDataState(),
        ...initVals,
    });
    const [alertMsg, setAlertMsg] = useState();

    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name = undefined, type = undefined, checked = undefined, value = undefined } = e.target || {};
        if (!name) return;

        let val = type === 'checkbox' ? checked : value;

        if (NUMERIC_ONLY_FIELDS.has(name)) {
            val = sanitizeNumericInput(name, val);
        }

        setCreateFormData((prev) => ({ ...prev, [name]: val }));

        if (NUMERIC_ONLY_FIELDS.has(name)) {
            onChangeExtended?.({
                ...e,
                target: { ...e.target, name, value: val, type },
            });
            return;
        }

        onChangeExtended?.(e);
    };

    const onFormSubmit = useCallback(
        async (ev = null) => {
            ev?.preventDefault();

            const formEl = ev?.target?.closest?.('form') || document.getElementById('id_mui_creation_form');
            const trimmedFormData = trimFormStrings(createFormData);
            syncTrimmedValuesToForm(formEl, trimmedFormData);
            setCreateFormData(trimmedFormData);
            if (onBeforeSubmit) {
                const shouldContinue = await onBeforeSubmit({
                    ev,
                    formEl,
                    formData: { ...trimmedFormData },
                    leafFields,
                });
                if (shouldContinue === false) return;
            }

            if (formEl?.reportValidity && !formEl.reportValidity()) {
                return;
            }

            const onSubmitExtendedProps = { ev };
            const hasFile = leafFields.some((f) => f.type === 'file');
            const shouldManageLoading = Boolean(submitUrl);

            shouldManageLoading && setUiState({ loadingMsg: 'Submitting, Please wait...' });

            try {
                if (submitUrl) {
                    const body = hasFile && formEl ? new FormData(formEl) : trimmedFormData;
                    if (hasFile && body instanceof FormData) {
                        Object.entries(trimmedFormData || {}).forEach(([key, val]) => {
                            if (Array.isArray(val) && val.every(isFileLikeValue)) {
                                body.delete(key);
                                val.forEach((file) => body.append(key, file));
                                return;
                            }

                            if (isFileLikeValue(val)) {
                                body.set(key, val);
                                return;
                            }

                            if (typeof val === 'string' && body.has(key)) {
                                body.set(key, val);
                            }
                        });
                    }

                    onSubmitExtendedProps.data = await performDeploySafeFetch(
                        "Form Submission",
                        async () => await fetchData(submitUrl, {
                            method: submitMethod || 'POST',
                            body,
                        }),
                        setUiState,
                        'Submitting, Please wait'
                    );

                    localStorage.removeItem(`${submitMethod} ${submitUrl}`);
                } else {
                    onSubmitExtendedProps.data = { ...trimmedFormData };
                }

                if (submitUrl && !onSubmitExtendedProps.data) return;

                const maybePromise = onSubmitExtended?.(
                    ev,
                    onSubmitExtendedProps.data || {},
                    { ...trimmedFormData }
                );

                if (maybePromise instanceof Promise) await maybePromise;
            } catch (err) {
                console.error('Error in form submission...\n', err);
                setAlertMsg({
                    severity: 'error',
                    msg: 'Error: ' + (err?.message || JSON.stringify(err)),
                });
                onError?.(err);
                onSubmitErrorExtended?.(err);
            } finally {
                shouldManageLoading && setUiState({ loadingMsg: null });
            }
        },

        [
            createFormData,
            leafFields,
            onBeforeSubmit,
            onSubmitExtended,
            onSubmitErrorExtended,
            setUiState,
            submitMethod,
            submitUrl,
            onError,
        ]
    );

    const getMappedField = useCallback(
        (fieldOptions, formData = {}, onFieldChange = () => { }) => {
            if (!Object.keys(fieldOptions || {}).length) return null;

            if ('getField' in fieldOptions)
                return fieldOptions.getField?.(formData, onFieldChange);

            const { getOptionValue, ...restFieldOptionsAutocompleteProps } = fieldOptions?.AutocompleteProps || {};

            const onChangeFunc = (ev = null, newVal = null) => {
                const fieldName = fieldOptions?.AutocompleteInputProps?.name;
                if (newVal && getOptionValue) {
                    onFieldChange?.({
                        ...ev,
                        target: {
                            value: getOptionValue(newVal),
                            ...fieldOptions.AutocompleteInputProps,
                            ...(ev?.target || {}),
                        },
                    });
                    return;
                }

                if (newVal === null && fieldName) {
                    onFieldChange?.({
                        target: {
                            name: fieldName,
                            value: '',
                            type: fieldOptions?.AutocompleteInputProps?.type,
                        },
                    });
                    return;
                }

                onFieldChange?.(ev);
            };

            const stableKey =
                fieldOptions.name ||
                fieldOptions.id ||
                fieldOptions?.AutocompleteInputProps?.name;

            switch (
            fieldOptions.type ||
            fieldOptions?.AutocompleteInputProps?.type ||
            'text'
            ) {
                case 'label':
                    return (
                        <Typography key={stableKey} {...fieldOptions}>
                            {fieldOptions.value}
                        </Typography>
                    );

                case 'row':
                    return (
                        <Box
                            key={stableKey}
                            {...(fieldOptions.boxRowOptions || {})}
                            sx={{ display: 'flex', gap: 2, ...(fieldOptions.boxRowOptions?.sx || {}) }}
                        >
                            {(fieldOptions.rowColFields || []).map((child, idx) => (
                                <Box
                                    key={child.name || child.id || `col-${idx}`}
                                    {...(child.boxColOptions || {})}
                                    sx={{ flex: 1, ...(child.boxColOptions?.sx || {}) }}
                                >
                                    {getMappedField(child, formData, onFieldChange)}
                                </Box>
                            ))}
                        </Box>
                    );

                case 'tel':
                case 'url':
                case 'email':
                case 'password':
                case 'text':
                case 'number':
                case 'hidden':
                    return (
                        <MUIInput
                            key={stableKey}
                            {...fieldOptions}
                            formData={formData}
                            AutocompleteProps={{
                                ...(restFieldOptionsAutocompleteProps || {}),
                                value:
                                    formData[fieldOptions.AutocompleteInputProps?.name] ?? '',
                            }}
                            AutocompleteInputProps={{
                                ...(fieldOptions.AutocompleteInputProps || {}),
                                value:
                                    formData[fieldOptions.AutocompleteInputProps?.name] ?? '',
                                onChange: (ev) => onFieldChange?.(ev),
                                sx: {
                                    width: '100%',
                                    ...(fieldOptions?.AutocompleteInputProps?.sx || {}),
                                },
                            }}
                        />
                    );

                case 'select':
                    return (
                        <MUIInput
                            key={stableKey}
                            {...fieldOptions}
                            formData={formData}
                            AutocompleteProps={{
                                ...(restFieldOptionsAutocompleteProps || {}),
                                value:
                                    formData[fieldOptions.AutocompleteInputProps?.name] ?? '',
                                onChange: onChangeFunc,
                            }}
                            AutocompleteInputProps={{
                                ...(fieldOptions.AutocompleteInputProps || {}),
                                value:
                                    formData[fieldOptions.AutocompleteInputProps?.name] ?? '',
                                sx: {
                                    width: '100%',
                                    ...(fieldOptions?.AutocompleteInputProps?.sx || {}),
                                },
                            }}
                        />
                    );

                case 'checkbox':
                    return (
                        <MUICheckBox
                            key={stableKey}
                            onChange={(ev) => onFieldChange?.(ev)}
                            {...fieldOptions}
                            checked={!!formData[fieldOptions.name]}
                        />
                    );

                case 'button':
                case 'submit':
                case 'reset':
                    return <MUIButton key={stableKey} {...fieldOptions}>{fieldOptions?.children}</MUIButton>;

                case 'file':
                    return (
                        <MUIFileInput
                            key={stableKey}
                            {...fieldOptions}
                            onChange={(payload) => {
                                const files = Array.isArray(payload)
                                    ? payload
                                    : Array.from(payload?.target?.files || []);
                                const fieldName = fieldOptions.name;

                                if (fieldName) {
                                    onFieldChange?.({
                                        target: {
                                            name: fieldName,
                                            value: files,
                                            type: 'file',
                                            files,
                                        },
                                    });
                                }

                                fieldOptions.onChange?.(payload);
                            }}
                        />
                    );

                default:
                    return null;
            }
        },
        []
    );

    const onBack = useCallback(() => {
        backUrl && backUrl !== "-1" ? navigate(backUrl) : navigate(-1);
        if (submitUrl) localStorage.removeItem(`${submitMethod} ${submitUrl}`);
        onBackExtended?.();
    }, [backUrl, navigate, onBackExtended, submitMethod, submitUrl]);

    useEffect(() => {
        setCreateFormData(prev => {
            const merged = { ...prev, ...initVals };
            // Only skip keys whose new value is explicitly undefined;
            // preserve 0, false, '', null — they are valid form value
            const finDt = {};
            for (const keyEle of Object.keys(merged)) {
                if (merged[keyEle] !== undefined) finDt[keyEle] = merged[keyEle];
            }

            return finDt;

        });
    }, [initVals]);



    return (
        <>
            <Box
                component={"noCardUIEffect" in restFormProps ? undefined : Card}
                elevation={2}
                {...formCardOptions}
                sx={{
                    minWidth: { xs: '92vw', sm: '70vw', md: '40vw' },
                    maxWidth: '100%',
                    borderRadius: "noCardUIEffect" in restFormProps ? "0.8rem" : '0.4rem',
                    border: "noCardUIEffect" in restFormProps ? 1 : undefined,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    ...(formCardOptions?.sx || {}),
                }}
            >
                {backUrl && (
                    <IconButton
                        sx={{ m: 3, mx: 1, position: 'absolute', zIndex: 5 }}
                        aria-label="Go back"
                        onClick={onBack}
                    >
                        <ArrowBackIosNewOutlined />
                    </IconButton>
                )}

                <Box
                    component="form"
                    id="id_mui_creation_form"
                    onSubmit={onFormSubmit}
                    {...formBoxOptions}
                    sx={{
                        width: '100%',
                        color: 'inherit',
                        p: { xs: 2, sm: 3, md: 5 },
                        ...(formBoxOptions?.sx || {}),
                    }}
                >
                    {fields.map((fieldOpts, i) => (
                        <Box
                            key={fieldOpts.name || fieldOpts.id || `field-${i}`}
                            {...(fieldOpts.fieldBoxOptions || {})}
                            sx={{
                                mb: i === fields.length - 1 ? 0 : 2,
                                ...(fieldOpts.fieldBoxOptions?.sx || {}),
                            }}
                        >
                            {getMappedField(fieldOpts, createFormData, handleChange)}
                        </Box>
                    ))}

                    {children &&
                        (typeof children === 'function'
                            ? children({ formData: createFormData, handleChange })
                            : children)}
                </Box>


            </Box>
            <MUIAlert
                open={Boolean(alertMsg)}
                message={alertMsg?.msg}
                severity={alertMsg?.severity}
                onClose={() => setAlertMsg(null)}
            />
        </>
    );
};

export default MUICreateForm;
