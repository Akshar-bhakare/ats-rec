import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';

import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import MUICreateForm from '../MUI/CommonCRUD/MUICreateForm.jsx';
import MUIButton from '../MUI/commonUI/MUIButton';

import { fetchData } from '../../AppUtils/dataAPI';
import { useCandidateContextState } from '../../contexts/CandidateContext';
import { useUiContextState } from '../../contexts/UiContext';




const ACCEPTED_FILE_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];


export default function EditCandidate() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [candidateState, setCandidateState] = useCandidateContextState();
    const [, setUiState] = useUiContextState();

    const [loading, setLoading] = useState(true);

    const [candidateData, setCandidateData] = useState({
        job: '',
        firstName: '',
        lastName: '',
        countryCode: '+91',
        phoneNumber: '',
        email: '',
        skills: '',
    });

    useEffect(() => {
        (async () => {
            // 1) Prefer merged initial values (from agent)
            const override =
                (location?.state && location.state.editCandidate) ||
                candidateState?.candidateEditInitialValues;

            if (override && String(override._id || override.id) === String(id)) {
                const skillsStr = Array.isArray(override.skills)
                    ? override.skills.map(o => (typeof o === 'string' ? o : Object.keys(o)[0] || '')).filter(Boolean).join(', ')
                    : (override.skills || '');
                setCandidateData({
                    job: override.job || '',
                    firstName: override.firstName || '',
                    lastName: override.lastName || '',
                    countryCode: override.countryCode || '+91',
                    phoneNumber: override.phoneNumber || '',
                    email: override.email || '',
                    skills: skillsStr,
                    experience: override.experience ?? '',
                });
                setLoading(false);
                return;
            }

            // 2) Otherwise fetch from API
            try {
                setUiState({ loadingMsg: 'Loading, Please wait...' });
                const cand = await fetchData(`/api/candidates/${id}`);
                setCandidateData({
                    job: cand.job || '',
                    firstName: cand.firstName || '',
                    lastName: cand.lastName || '',
                    countryCode: cand.countryCode || '+91',
                    phoneNumber: cand.phoneNumber || '',
                    email: cand.email || '',
                    skills: Array.isArray(cand.skills)
                        ? cand.skills.map(o => (typeof o === 'string' ? o : Object.keys(o)[0] || '')).filter(Boolean).join(', ')
                        : '',
                    experience: cand.experience ?? '',
                });
            } catch (err) {
                console.error('Error fetching candidate', err);
            } finally {
                setUiState({ loadingMsg: null });
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const initialValuesDict = useMemo(
        () => ({
            firstName: candidateData.firstName,
            lastName: candidateData.lastName,
            countryCode: candidateData.countryCode,
            phoneNumber: candidateData.phoneNumber,
            email: candidateData.email,
            skills: candidateData.skills,
            experience: candidateData.experience,
        }),
        [candidateData]
    );

    useEffect(() => {
        if (candidateState?.candidateUpdateWsSubmit) {
            document?.getElementById?.("id_cand_upd_submit_btn")?.click?.();
            setCandidateState({
                candidateUpdateWsSubmit: false
            });
        }
    }, [candidateState?.candidateUpdateWsSubmit, setCandidateState])

    if (loading) return <MUICenterLayout />;

    return (
        <MUICenterLayout>
            <MUICreateForm
                submitUrl={`/api/candidates/${id}`}
                submitMethod={"PUT"}
                onSubmitExtended={(_, data) => {
                    if ("_id" in data) {
                        setCandidateState({
                            candidateEditInitialValues: null,
                            candidateListRows: null
                        })
                        navigate(-1);
                    }
                }}
                backUrl="/candidates"
                initialValuesDict={initialValuesDict}
                formCardOptions={{ sx: { width: { xs: '95%', sm: '85%', md: '70%', lg: '55%', xl: '45%' } } }}
                fields={[
                    {
                        type: 'label',
                        variant: 'h5',
                        value: 'Edit Candidate',
                        align: 'center',
                        sx: { my: 5, fontWeight: 600 }
                    },

                    { AutocompleteInputProps: { type: 'text', name: 'firstName', label: 'First Name', required: true, sx: { mb: 2 } } },
                    { AutocompleteInputProps: { type: 'text', name: 'lastName', label: 'Last Name', required: true, sx: { mb: 2 } } },

                    {
                        type: 'row',
                        rowColFields: [
                            { AutocompleteInputProps: { type: 'text', name: 'countryCode', required: true, label: 'Country Code' } },
                            { AutocompleteInputProps: { type: 'text', name: 'phoneNumber', required: true, label: 'Phone Number' } }
                        ],
                        boxRowOptions: { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2, mb: 2 } }
                    },

                    { AutocompleteInputProps: { type: 'text', name: 'email', required: true, label: 'Email', sx: { mb: 2 } } },
                    { AutocompleteInputProps: { type: 'text', name: 'skills', required: true, label: 'Skills (comma separated)', sx: { mb: 2 } } },
                    {
                        name: 'resumes',
                        label: 'Drag & drop resume',
                        type: 'file',
                        maxFiles: 1,
                        acceptedTypes: ACCEPTED_FILE_TYPES,
                        align: 'center',
                        sx: { mb: 3 }
                    },

                    {
                        getField: () => (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                <MUIButton type="button" onClick={() => navigate(-1)}>
                                    Cancel
                                </MUIButton>
                                <MUIButton id="id_cand_upd_submit_btn" type="submit">
                                    Save Changes
                                </MUIButton>
                            </Box>
                        )
                    }
                ]}
            />
        </MUICenterLayout>
    );
}
