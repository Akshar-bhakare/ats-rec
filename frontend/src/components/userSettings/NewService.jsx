import React, { useEffect, useMemo, useState } from 'react';
import { Box, Switch, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import MUICreateForm from '../MUI/CommonCRUD/MUICreateForm';
import { fetchData } from '../../AppUtils/dataAPI';
import { useUiContextState } from '../../contexts/UiContext';


const getClientId = (loc) => loc.state?.clientId || null;
const normalizeEmailSettingKeys = (data = {}) => {
    const next = { ...data };
    const type = Array.isArray(next?.serviceType) ? next.serviceType[0] : next?.serviceType;
    if (type !== 'Email') return next;

    if (next.SMTP_PORT === undefined && next.smtpPort !== undefined) {
        next.SMTP_PORT = next.smtpPort;
    }
    if (next.SMTP_SECURE === undefined && next.smtpSecure !== undefined) {
        next.SMTP_SECURE = next.smtpSecure;
    }
    if (next.SMTP_SENDER === undefined && next.smtpSender !== undefined) {
        next.SMTP_SENDER = next.smtpSender;
    }
    if (next.SMTP_SECURE !== undefined && next.SMTP_SECURE !== null && next.SMTP_SECURE !== '') {
        const secureVal = String(next.SMTP_SECURE).trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(secureVal)) next.SMTP_SECURE = 'true';
        else if (['false', '0', 'no', 'off'].includes(secureVal)) next.SMTP_SECURE = 'false';
    }

    return next;
};


export default function NewService() {
    const navigate = useNavigate();
    const location = useLocation();
    const [, setUiState] = useUiContextState()
    const editing = Boolean(location.state?.editService);

    const existing = location.state?.editService || {};
    const prefill = location.state?.prefillService;

    const clientId = getClientId(location);

    const [saving, setSaving] = useState(false);
    const defaultServiceType = location.state?.defaultServiceType;


    const providersMap = {
        AI: ['OpenAI', 'Anthropic', 'Google', 'Azure'],
        Telephony: ['Plivo', 'Exotel', 'Twilio'],
        Video: ['Zoom', 'Jitsi', 'Daily.co'],
        Document: ['ILovePDFAPI', 'Adobe PDF Services'],
        Email: ['SMTP', 'SendGrid', 'Amazon SES', 'Mailgun'],
        Messaging: ['Twilio', 'Nexmo', 'MessageBird'],
        Maps: ['Google Maps', 'Mapbox', 'OpenStreetMap'],
        Other: ['CustomProvider1', 'CustomProvider2'],
    };
    const fieldsMap = {
        AI: ['apiKey', 'model', 'temperature'],
        Telephony: ['apiKey', 'authId', 'authToken', 'callerId'],
        Video: ['apiKey', 'maxParticipants', 'recordingEnabled'],
        Document: ['apiKey', 'secretKey', 'maxFileSizeMb', 'ocrEnabled'],
        Email: ['smtpHost', 'SMTP_PORT', 'SMTP_SECURE', 'username', 'password', 'SMTP_SENDER'],
        Messaging: ['apiKey', 'senderNumber', 'fallbackEnabled'],
        Maps: ['apiKey', 'defaultLocation'],
        Other: ['customField1', 'customField2'],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const serviceTypes = useMemo(() => Object.keys(fieldsMap), []);


    const [formValues, setFormValues] = useState(() => {
        if (editing && existing) return normalizeEmailSettingKeys({
            serviceType: existing.serviceType?.[0] || defaultServiceType || 'AI',
            serviceProvider: existing.serviceProvider || providersMap[existing.serviceType?.[0]]?.[0] || 'OpenAI',
            configName: existing.configurationName || '',
            description: existing.description || '',
            active: existing.isActive || false,
            setDefault: existing.isDefault || false,
            id: existing._id || '',
            ...(existing.configurationDetails || {}),
        });
        if (prefill) return normalizeEmailSettingKeys({
            serviceType: prefill.serviceType?.[0] || defaultServiceType || 'AI',
            serviceProvider: prefill.serviceProvider,
            configName: prefill.configurationName,
            description: prefill.description,
            active: prefill.isActive,
            setDefault: prefill.isDefault,
            id: '',
            ...(prefill.configurationDetails || {}),
        });

        return {
            serviceType: defaultServiceType || 'AI',
            serviceProvider: providersMap[defaultServiceType]?.[0] || 'OpenAI',
            configName: '', description: '',
            apiKey: '', secretKey: '', model: '', temperature: '',
            active: false, setDefault: false, id: '',
        };
    });


    const serviceProviders = useMemo(
        () => providersMap[formValues.serviceType] || [],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [formValues.serviceType]
    );
    useEffect(() => {
        if (!serviceProviders.includes(formValues.serviceProvider)) {
            setFormValues(v => ({ ...v, serviceProvider: serviceProviders[0] || '' }));
        }
    }, [serviceProviders, formValues.serviceProvider]);


    const allDynamic = {
        apiKey: { AutocompleteInputProps: { name: 'apiKey', label: 'API Key' } },
        secretKey: { AutocompleteInputProps: { name: 'secretKey', label: 'Secret Key', type: 'password' } },
        model: { AutocompleteInputProps: { name: 'model', label: 'Model' } },
        temperature: { AutocompleteInputProps: { name: 'temperature', label: 'Temperature' } },
        authId: { AutocompleteInputProps: { name: 'authId', label: 'Auth ID' } },
        authToken: { AutocompleteInputProps: { name: 'authToken', label: 'Auth Token', type: 'password' } },
        callerId: { AutocompleteInputProps: { name: 'callerId', label: 'Caller ID' } },
        maxParticipants: { AutocompleteInputProps: { name: 'maxParticipants', label: 'Max Participants', type: 'number' } },
        recordingEnabled: { AutocompleteInputProps: { name: 'recordingEnabled', label: 'Enable Recording', type: 'checkbox' } },
        maxFileSizeMb: { AutocompleteInputProps: { name: 'maxFileSizeMb', label: 'Max File Size (MB)', type: 'number' } },
        ocrEnabled: { AutocompleteInputProps: { name: 'ocrEnabled', label: 'Enable OCR', type: 'checkbox' } },
        smtpHost: { AutocompleteInputProps: { name: 'smtpHost', label: 'SMTP Host' } },
        // smtpPort: { AutocompleteInputProps: { name: 'smtpPort', label: 'SMTP Port', type: 'number' } },
        SMTP_PORT: { AutocompleteInputProps: { name: 'SMTP_PORT', label: 'SMTP_PORT', type: 'number' } },
        SMTP_SECURE: { AutocompleteInputProps: { name: 'SMTP_SECURE', label: 'SMTP_SECURE (true/false)' } },
        username: { AutocompleteInputProps: { name: 'username', label: 'Username' } },
        password: { AutocompleteInputProps: { name: 'password', label: 'Password', type: 'password' } },
        SMTP_SENDER: { AutocompleteInputProps: { name: 'SMTP_SENDER', label: 'SMTP_SENDER' } },
        senderNumber: { AutocompleteInputProps: { name: 'senderNumber', label: 'Sender Number' } },
        fallbackEnabled: { AutocompleteInputProps: { name: 'fallbackEnabled', label: 'Fallback Enabled', type: 'checkbox' } },
        defaultLocation: { AutocompleteInputProps: { name: 'defaultLocation', label: 'Default Location' } },
        customField1: { AutocompleteInputProps: { name: 'customField1', label: 'Custom Field 1' } },
        customField2: { AutocompleteInputProps: { name: 'customField2', label: 'Custom Field 2' } },
    };

    const emailDynamicFields = [
        {
            type: 'row',
            rowColFields: [
                {
                    ...allDynamic.smtpHost,
                    AutocompleteInputProps: {
                        ...allDynamic.smtpHost.AutocompleteInputProps,
                        label: 'Host',
                    },
                },
                {
                    ...allDynamic.SMTP_PORT,
                    AutocompleteInputProps: {
                        ...allDynamic.SMTP_PORT.AutocompleteInputProps,
                        label: 'Port',
                    },
                },
            ],
            boxRowOptions: { sx: { mb: 2 } },
        },
        {
            type: 'row',
            rowColFields: [
                {
                    ...allDynamic.SMTP_SECURE,
                    type: 'select',
                    AutocompleteProps: {
                        options: ['true', 'false'],
                        freeSolo: false,
                        getOptionValue: (option) => String(option).toLowerCase(),
                    },
                    AutocompleteInputProps: {
                        ...allDynamic.SMTP_SECURE.AutocompleteInputProps,
                        label: 'Secure (true/false)',
                    },
                },
                {
                    ...allDynamic.SMTP_SENDER,
                    AutocompleteInputProps: {
                        ...allDynamic.SMTP_SENDER.AutocompleteInputProps,
                        label: 'Sender',
                    },
                },
            ],
            boxRowOptions: { sx: { mb: 2 } },
        },
        {
            type: 'row',
            rowColFields: [
                {
                    ...allDynamic.username,
                    AutocompleteInputProps: {
                        ...allDynamic.username.AutocompleteInputProps,
                        label: 'Username/Email',
                    },
                },
                {
                    ...allDynamic.password,
                    AutocompleteInputProps: {
                        ...allDynamic.password.AutocompleteInputProps,
                        label: 'Password',
                    },
                },
            ],
        },
    ];
    const dynamicFields = formValues.serviceType === 'Email'
        ? emailDynamicFields
        : (fieldsMap[formValues.serviceType]?.map(k => allDynamic[k]) || []);


    const baseFields = [
        {
            type: 'label', variant: 'h5', align: 'center',
            value: editing ? 'Edit Service Configuration' : 'Add Service Configuration',
            sx: { mb: 3, fontWeight: 600 }
        },
        {
            type: 'row', rowColFields: [
                {
                    ...(formValues.serviceType === 'Email' ? {
                        type: 'select',
                        AutocompleteProps: {
                            options: serviceTypes,
                            freeSolo: false,
                            disableClearable: true,
                            getOptionValue: (option) => String(option || ''),
                        },
                    } : {}),
                    AutocompleteInputProps: {
                        name: 'serviceType', label: 'Service Type', required: true,
                        options: serviceTypes
                    }, boxColOptions: { sx: { flex: 1 } }
                },
                {
                    ...(formValues.serviceType === 'Email' ? {
                        type: 'select',
                        AutocompleteProps: {
                            options: serviceProviders,
                            freeSolo: false,
                            disableClearable: true,
                            getOptionValue: (option) => String(option || ''),
                        },

                    } : {}),
                    AutocompleteInputProps: {
                        name: 'serviceProvider', label: 'Service Provider', required: true,
                        options: serviceProviders
                    }, boxColOptions: { sx: { flex: 1 } }
                },
            ], sx: { mb: 2, gap: 2 }
        },
        {
            type: 'row', rowColFields: [
                {
                    AutocompleteInputProps: {
                        name: 'configName', label: 'Configuration Name', required: true,
                        placeholder: 'e.g., Production OpenAI'
                    }, boxColOptions: { sx: { flex: 1 } }
                },
                {
                    AutocompleteInputProps: {
                        name: 'description', label: 'Description (Optional)',
                        placeholder: 'e.g., GPT‑4 prod'
                    }, boxColOptions: { sx: { flex: 1 } }
                },
            ], sx: { mb: 2, gap: 2 }
        },
        {
            getField: (_d, onChange) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Switch name='active' checked={formValues.active} onChange={onChange} /><Typography>Active</Typography>
                    <Switch name='setDefault' checked={formValues.setDefault} onChange={onChange} sx={{ ml: 3 }} /><Typography>Set as Default</Typography>
                </Box>
            )
        },
        { type: 'label', value: 'Configuration Details', sx: { mt: 2, mb: 1, fontWeight: 600 } },
    ];
    const fields = [...baseFields, ...dynamicFields,
    { label: editing ? 'Update' : 'Save', type: 'submit', align: 'center', sx: { mt: 3 } }];


    const handleChangeExtended = (e) => {
        const { name, type, value, checked } = e.target;
        setFormValues(v => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
    };


    const handleSubmit = async () => {
        setSaving(true);
        try {
            const recordId = formValues.id || existing._id || '';


            let url = '/api/settings';
            let method = 'POST';
            if (clientId) {
                url = editing ? `/api/settings/client/${clientId}/${recordId}`
                    : `/api/settings/client/${clientId}`;
                method = editing ? 'PUT' : 'POST';
            } else if (editing) {
                url = `/api/settings/${recordId}`;
                method = 'PUT';
            }


            const allowed = [
                'apiKey', 'secretKey', 'model', 'temperature', 'authId', 'authToken', 'callerId',
                'maxParticipants', 'recordingEnabled', 'maxFileSizeMb', 'ocrEnabled', 'smtpHost',
                'SMTP_PORT', 'SMTP_SECURE', 'username', 'password', 'SMTP_SENDER', 'senderNumber',
                'fallbackEnabled', 'defaultLocation',
                'customField1', 'customField2'
            ];
            const configurationDetails = Object.fromEntries(
                allowed.map(k => [k, formValues[k]]).filter(([, v]) => v !== undefined)
            );
            const payload = {
                serviceType: [formValues.serviceType],
                serviceProvider: formValues.serviceProvider,
                configurationName: formValues.configName,
                description: formValues.description,
                isActive: formValues.active,
                isDefault: formValues.setDefault,
                configurationDetails,
            };

            console.log('🛰️  Submitting', method, url, payload);
            let data;
            setUiState({ loadingMsg: "Loading recruiter details..." });
            try {
                data = await fetchData(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                });
            } catch (err) {
                const needsFallback =
                    editing && !clientId &&
                    String(err).includes('404') &&
                    existing.client;

                if (!needsFallback) throw err;

                const fbUrl = `/api/settings/client/${existing.client}/${recordId}`;
                console.log('🛰️  Fallback PUT', fbUrl);
                data = await fetchData(fbUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                });
            } finally {
                setUiState({ loadingMsg: null });
            }

            if (clientId || existing.client && !location.state?.clientId) {
                navigate(-1);
            } else {
                const key = `${editing ? 'edited' : 'new'}${data.serviceType[0]}Service`;
                navigate('/settings/', { state: { [key]: data } });
            }
        } catch (e) {
            console.error('Fetch failed:', e);
            alert(`Failed to save: ${e.message}`);
        } finally { setSaving(false); }
    };

    return (
        <MUICenterLayout>
            <MUICreateForm
                fields={fields}
                initialValuesDict={formValues}
                formCardOptions={{
                    sx: {
                        minWidth: { xs: '92vw', sm: '70vw', md: '50vw' },
                        maxWidth: { xs: '92vw', md: '60vw' },
                    },
                }}
                onChangeExtended={handleChangeExtended}
                onSubmitExtended={handleSubmit}
                backUrl="/settings/"
                isSubmitting={saving}
            />
        </MUICenterLayout>
    );
}
