import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useJobContextState } from '../../contexts/JobContext';
import { useUiContextState } from '../../contexts/UiContext';

import collegeListJson from '../../assets/CollegeLists.json';
import educationListJson from '../../assets/EducationLists.json';

import MUICreateForm from '../MUI/CommonCRUD/MUICreateForm';
import { fetchData, performDeploySafeFetch } from '../../AppUtils/dataAPI';
import { fetchJobDescription } from './fetchJobDescription';
import { fetchGeneratedScript } from './fetchGeneratedScript';
import MUIAlert from '../MUI/commonUI/MUIAlert';
import { Box, Chip, IconButton, Step, StepLabel, Stepper, Typography, useTheme, Dialog, DialogContent, DialogTitle, Grow, DialogActions, Button, Checkbox, FormControlLabel, TextField, Collapse } from '@mui/material';
import { alpha } from '@mui/material/styles';
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete';
import MUIButton from '../MUI/commonUI/MUIButton';
import CollegeModal from './CollegeModal';
import MUIInput from '../MUI/commonUI/MUIInput';
import BooleanBuilder from './BooleanBuilder';
import { useNavigate, useParams } from 'react-router-dom';
import { Close as CloseIcon, ArrowBackIosNewOutlined, GraphicEq as GraphicEqIcon, Done as DoneIcon } from '@mui/icons-material';
import OpenAIFM_UI from './OpenAIFM_UI';
import { currencyOptions } from '../../assets/currencyList';


const steps = ['Job Details', 'Review AI Content'];

const levelOpts = educationListJson.educationLevels.map((educationLevel) => educationLevel.level);
const degreeOpts = educationListJson.educationLevels.reduce((accum, educationLevel) => {
    accum[educationLevel.level] = educationLevel.degrees;
    return accum;
}, {});
const jobTypeOpts = ['Full-time', 'Part-time', 'Permanent', 'Fresher', 'Contractual/Temporary', 'Internship'];
const workModeOpts = ['On-site(Work From Office)', 'Hybrid', 'Remote(Work From Home)', 'Field-based', 'Not specified'];
const scriptTypeOpts = [{ label: 'AI Screening Call', value: "aicall" }];

const getScriptTypeLabel = (scriptType) => {
    if (!scriptType) return '';
    if (typeof scriptType === 'string') {
        const matched = (scriptTypeOpts || []).find((opt) => opt.value === scriptType);
        return matched?.label || scriptType;
    }
    if (typeof scriptType === 'object') {
        return scriptType?.label || scriptType?.value || '';
    }
    return '';
};

const buildDynamicScriptName = (jobTitle, scriptType) => {
    const title = String(jobTitle || '').trim();
    const typeLabel = String(getScriptTypeLabel(scriptType) || '').trim();

    if (!title && !typeLabel) return '';
    if (!title) return `${typeLabel} Script`.trim();
    if (!typeLabel) return `${title} Script`.trim();
    return `${title} ${typeLabel} Script`.trim();
};

const normalizeAutoCompleteId = (c) => {
    if (!c) return '';
    if (typeof c === 'string') return c;
    if (c?._id) return c._id;
    if (c?.value) return c.value;
    return '';
};

const getSafeVal = (v) => (!v ? '' : String(v));

const extractErrorMessage = (err) => {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (typeof err === 'object') {
        if (Array.isArray(err.details) && err.details.length > 0) {
            return String(err.details[0]);
        }
        if (err.message) return String(err.message);
        if (err.error) return String(err.error);
        if (err.detail) return String(err.detail);
    }
    try {
        return JSON.stringify(err);
    } catch {
        return '';
    }
};

const getFriendlyErrorMessage = (err, fallback) => {
    const raw = extractErrorMessage(err).trim();
    if (!raw) return fallback;
    if (/^please\\b/i.test(raw) || /^failed\\b/i.test(raw)) return raw;
    const lower = raw.toLowerCase();
    if (lower.includes('salary') && lower.includes('min') && lower.includes('max')) {
        return 'Minimum salary cannot be greater than maximum salary.';
    }
    if (lower.includes('experience') && lower.includes('min') && lower.includes('max')) {
        return 'Minimum experience cannot be greater than maximum experience.';
    }
    if (lower.includes('location')) return 'Please add at least one location before continuing.';
    if (lower.includes('skill')) return 'Please add at least 3 primary skills before continuing.';
    if (lower.includes('script')) return 'Please complete the script details before continuing.';
    if (lower.includes('company')) return 'Please select a valid company.';
    return fallback;
};

const getLocations = (data) =>
    Array.isArray(data?.locations) ? data.locations.filter(Boolean) : [];

const getSkills = (data) => {
    if (Array.isArray(data?.skills)) return data.skills;
    if (Array.isArray(data?.primarySkills)) return data.primarySkills;
    return [];
};

const normalizeText = (value) => String(value ?? '').trim();

const normalizeNumberLike = (value) => {
    const clean = normalizeText(value);
    if (!clean) return '';
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? parsed : clean;
};

const normalizeStringArray = (arr) =>
    [...new Set((Array.isArray(arr) ? arr : []).map((item) => normalizeText(item)).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));

const normalizeEducationRows = (rows) => {
    const normalized = (Array.isArray(rows) ? rows : []).map((row) => {
        const degree = Array.isArray(row?.degree)
            ? row.degree
            : row?.degree
                ? [row.degree]
                : [];

        const institute = Array.isArray(row?.institute)
            ? row.institute
            : normalizeText(row?.institute || row?.college)
                .split(';')
                .map((item) => item.trim())
                .filter(Boolean);

        return {
            level: normalizeText(row?.level),
            degree: normalizeStringArray(degree),
            institute: normalizeStringArray(institute),
            field: normalizeText(row?.field),
            yearOfCompletion: normalizeText(row?.yearOfCompletion),
            score: normalizeText(row?.score),
        };
    });

    return normalized.sort((a, b) =>
        JSON.stringify(a).localeCompare(JSON.stringify(b))
    );
};

const getStepOneSignature = (formData = {}) => {
    const workMode = normalizeText(formData?.workMode);
    return {
        title: normalizeText(formData?.title),
        internalTitle: normalizeText(formData?.internalTitle),
        company: normalizeAutoCompleteId(formData?.company),
        positions: normalizeNumberLike(formData?.positions),
        jobType: normalizeText(formData?.jobType),
        workMode,
        hybridDetails: workMode === 'Hybrid' ? normalizeText(formData?.hybridDetails) : '',
        locations: normalizeStringArray(getLocations(formData)),
        minExp: normalizeNumberLike(formData?.minExp),
        maxExp: normalizeNumberLike(formData?.maxExp),
        minSalary: normalizeNumberLike(formData?.minSalary),
        maxSalary: normalizeNumberLike(formData?.maxSalary),
        salaryCurrency: normalizeText(formData?.salaryCurrency || 'INR'),
        skills: normalizeStringArray(getSkills(formData)),
        educations: normalizeEducationRows(formData?.educations),
    };
};
const getWalkInSignature = (formData = {}) => ({
    isWalkIn: Boolean(formData?.isWalkIn),
    walkInDateFrom: normalizeText(formData?.walkInDateFrom),
    walkInDateTo: normalizeText(formData?.walkInDateTo),
    walkInTimeStart: normalizeText(formData?.walkInTimeStart),
    walkInTimeEnd: normalizeText(formData?.walkInTimeEnd),
});

const NewJob = () => {
    const [gState, setGState] = useJobContextState();
    const [, setUiState] = useUiContextState();
    const [companiesList, setCompaniesList] = useState([]);

    const navigate = useNavigate();
    const { id: urlJobId } = useParams();
    const theme = useTheme();

    // If navigated to /jobs/edit/:id, seed the context so the data-loading effect picks it up
    useEffect(() => {
        if (!urlJobId) return;
        const alreadySet =
            gState?.jobInitialValuesDict?._id === urlJobId ||
            gState?.jobFormData?._id === urlJobId;
        if (alreadySet) return;
        setGState((prev = {}) => ({
            ...prev,
            jobFormData: null,
            jobInitialValuesDict: { _id: urlJobId },
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlJobId]);

    const formInputSx = {
        '& .MuiOutlinedInput-root': {
            backgroundColor: theme.palette.background.default,
            borderRadius: 1,
        },
        '& .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(theme.palette.divider, 0.9),
        },
        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(theme.palette.primary.main, 0.6),
        },
        '& .MuiInputBase-input': {
            fontSize: 14,
        },
    };

    const [openaiModalOpen, setOpenaiModalOpen] = useState(false);

    const sanitizeDigits = (value) => String(value ?? '').replace(/[^\d]/g, '');
    const handleChangeExtended = useCallback((e) => {
        const name = e?.target?.name;
        const rawValue = e?.target?.value;
        const value =
            name === 'minSalary' || name === 'maxSalary'
                ? sanitizeDigits(rawValue)
                : rawValue;
        setGState((prev) => ({
            ...prev,
            jobFormData: { ...(prev.jobFormData || {}), [name]: value }
        }));
    }, [setGState]);

    const activeStep = useMemo(() => {
        const rawStep = Number.isInteger(gState?.jobFormData?.activeStep)
            ? gState?.jobFormData?.activeStep
            : 0;
        return Math.max(0, Math.min(rawStep, steps.length - 1));
    }, [gState?.jobFormData?.activeStep]);

    const editJobId = gState?.jobFormData?._id || gState?.jobInitialValuesDict?._id || '';
    const isEditMode = Boolean(editJobId);
    const initialStepOneSignatureRef = useRef(null);
    const initialWalkInSignatureRef = useRef(null);
    const lastGeneratedStepOneSignatureRef = useRef(null);
    const stepOneSignature = useMemo(
        () => getStepOneSignature(gState?.jobFormData || {}),
        [gState?.jobFormData]
    );
    const walkInSignature = useMemo(
        () => getWalkInSignature(gState?.jobFormData || {}),
        [gState?.jobFormData]
    );

    useEffect(() => {
        initialStepOneSignatureRef.current = null;
        initialWalkInSignatureRef.current = null;
        lastGeneratedStepOneSignatureRef.current = null;
    }, [editJobId]);

    useEffect(() => {
        if (!isEditMode || initialStepOneSignatureRef.current) return;

        const formData = gState?.jobFormData || {};
        const hasStepOneDataLoaded =
            [
                formData?.title,
                formData?.internalTitle,
                normalizeAutoCompleteId(formData?.company),
                formData?.positions,
                formData?.jobType,
                formData?.workMode,
                formData?.minExp,
                formData?.maxExp,
                formData?.minSalary,
                formData?.maxSalary,
            ].some((value) => normalizeText(value) !== '') ||
            getLocations(formData).length > 0 ||
            getSkills(formData).length > 0 ||
            (Array.isArray(formData?.educations) && formData.educations.length > 0);

        if (!hasStepOneDataLoaded) return;
        initialStepOneSignatureRef.current = stepOneSignature;
        lastGeneratedStepOneSignatureRef.current = stepOneSignature;
        initialWalkInSignatureRef.current = walkInSignature;
    }, [gState?.jobFormData, isEditMode, stepOneSignature, walkInSignature]);

    const hasStepOneChangesInEdit = useMemo(() => {
        if (!isEditMode || !initialStepOneSignatureRef.current) return false;
        return JSON.stringify(initialStepOneSignatureRef.current) !== JSON.stringify(stepOneSignature);
    }, [isEditMode, stepOneSignature]);

    const hasStepOneChangesSinceLastGeneration = useMemo(() => {
        if (!lastGeneratedStepOneSignatureRef.current) return false;
        return JSON.stringify(lastGeneratedStepOneSignatureRef.current) !== JSON.stringify(stepOneSignature);
    }, [stepOneSignature]);

    const hasWalkInChangesInEdit = useMemo(() => {
        if (!isEditMode || !initialWalkInSignatureRef.current) return false;
        return JSON.stringify(initialWalkInSignatureRef.current) !== JSON.stringify(walkInSignature);
    }, [isEditMode, walkInSignature]);
    const getGlobalStateSetterFunc = useCallback((gStateKey) => {
        const stateSetter = (val) =>
            setGState((prev) => {
                const prevSafe = prev || {};
                if (typeof val === 'function') {
                    const nextVal = val(prevSafe[gStateKey]);
                    return { ...prevSafe, [gStateKey]: nextVal };
                }
                return { ...prevSafe, [gStateKey]: val };
            });

        return stateSetter;
    }, [setGState]);

    const setJobFormData = useMemo(() => getGlobalStateSetterFunc("jobFormData"), [getGlobalStateSetterFunc]);

    const showAlert = useCallback((message, severity = 'error') => {
        setJobFormData((prev = {}) => ({
            ...prev,
            alert: { open: true, message, severity }
        }));
    }, [setJobFormData]);

    // ------------------------------------- College Model -------------------------------------
    const openCollege = useCallback((educationIndex) => handleChangeExtended({
        target: {
            name: "collegeModal",
            value: { ...gState?.jobFormData?.collegeModal, open: true, row: educationIndex, picks: {} },
        }
    }), [gState?.jobFormData?.collegeModal, handleChangeExtended]);

    const toggleCollege = useCallback((collegeName) => handleChangeExtended({
        target: {
            name: "collegeModal",
            value: {
                open: true,
                row: gState?.jobFormData?.collegeModal?.row,
                picks: {
                    ...gState?.jobFormData?.collegeModal?.picks,
                    [collegeName]: !gState?.jobFormData?.collegeModal?.picks[collegeName]
                }
            }
        }
    }), [gState?.jobFormData?.collegeModal?.picks, gState?.jobFormData?.collegeModal?.row, handleChangeExtended]);

    const confirmCollege = useCallback(() => {
        const selected = Object.keys(gState?.jobFormData?.collegeModal?.picks || {})
            .filter((key) => gState?.jobFormData?.collegeModal?.picks?.[key]);
        const joined = selected.join(';');

        setJobFormData((prev = {}) => ({
            ...prev,
            educations: gState?.jobFormData?.educations?.map?.((education, educationIndex) =>
                educationIndex === (gState?.jobFormData?.collegeModal?.row ?? -1)
                    ? { ...education, college: joined, institute: joined }
                    : education
            ),
            collegeModal: { open: false, row: -1, picks: {} },
        }));

    }, [gState?.jobFormData?.collegeModal?.picks, gState?.jobFormData?.collegeModal?.row, gState?.jobFormData?.educations, setJobFormData]);

    const onCollegeModelChange = useCallback((keyName, val) => {
        setJobFormData((prev) => ({ ...prev, collegeModal: { ...(prev?.collegeModal || {}), [keyName]: val } }));
    }, [setJobFormData]);

    // ------------------------------------- End College Model -------------------------------------

    const handleGenerateJD = useCallback(async () => {
        const skills = getSkills(gState?.jobFormData);
        const locations = getLocations(gState?.jobFormData);
        if (!gState?.jobFormData?.title?.trim?.() || skills.length < 3) {
            showAlert('Please enter a job title and at least 3 skills before generating the JD.');
            return;
        }
        if (!locations.length) {
            showAlert('Please add at least one location and press Enter to add it.');
            return;
        }

        try {
            setUiState({ loadingMsg: 'Generating Job Description by AI, Please wait...' });
            await fetchJobDescription(gState?.jobFormData, setJobFormData, setUiState);
            lastGeneratedStepOneSignatureRef.current = getStepOneSignature(gState?.jobFormData || {});
            showAlert('Job Description generated!', 'success');
        } catch (err) {
            console.error('[NewJob] JD generation failed:', err);
            showAlert(getFriendlyErrorMessage(err, 'Failed to generate the job description. Please try again.'));
        } finally {
            setUiState({ loadingMsg: null });
        }
    }, [gState?.jobFormData, setJobFormData, setUiState, showAlert]);

    const handleGenerateScript = useCallback(async () => {
        const locations = getLocations(gState?.jobFormData);
        if (!locations.length) {
            showAlert('Please add at least one location and press Enter to add it.');
            return;
        }

        try {
            setUiState({ loadingMsg: 'Generating Script by AI, Please wait...' });
            await fetchGeneratedScript(gState?.jobFormData, setJobFormData, setUiState);
            lastGeneratedStepOneSignatureRef.current = getStepOneSignature(gState?.jobFormData || {});
            showAlert('Script generated!', 'success');
        } catch (err) {
            console.error('[NewJob] Script generation failed:', err);
            showAlert(getFriendlyErrorMessage(err, 'Failed to generate the script. Please try again.'));
        } finally {
            setUiState({ loadingMsg: null });
        }
    }, [gState?.jobFormData, setJobFormData, setUiState, showAlert]);


    const getCollegeFields = useCallback(() => (
        <Box>
            {gState?.jobFormData?.educations?.map?.((education, educationIndex) => {
                const rowFormData = {
                    [`edu_institute_${educationIndex}`]: education.institute || '',
                    [`edu_field_${educationIndex}`]: education.field || '',
                    [`edu_passout_${educationIndex}`]: education.yearOfCompletion || '',
                    [`edu_score_${educationIndex}`]: education.score || '',
                };

                return (
                    <Box
                        key={educationIndex}
                        sx={{
                            mb: 3,
                            p: 2,
                            border: '1px solid #ccc',
                            borderRadius: 2,
                            position: 'relative',
                            pt: 4,
                            backgroundColor: 'background.paper'
                        }}
                    >
                        {gState?.jobFormData?.educations.length > 0 && (
                            <IconButton
                                size="small"
                                onClick={() => handleChangeExtended({
                                    target: {
                                        name: "educations",
                                        value: [
                                            ...(gState?.jobFormData?.educations || [])
                                                .filter((_, idx) => idx !== educationIndex)
                                        ]
                                    }
                                })}
                                sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    color: 'error.main',
                                    bgcolor: 'background.paper',
                                    '&:hover': { bgcolor: 'background.paper' }
                                }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        )}

                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                gap: 2,
                                mb: 2
                            }}
                        >
                            <MUIInput
                                formData={{}}
                                AutocompleteProps={{
                                    disableClearable: true,
                                    options: levelOpts.map((level) => ({ label: level, value: level })),
                                    isOptionEqualToValue: (option, value) =>
                                    (typeof value === 'string'
                                        ? option.value === value
                                        : option?.value === value?.value),
                                    getOptionLabel: (option) =>
                                        (typeof option === 'string' ? option : option?.label || ''),
                                    getOptionValue: (option) =>
                                        (typeof option === 'string' ? option : option?.value),
                                    value: education.level || '',
                                    onChange: (_event, newValue) => {
                                        const levelValue =
                                            typeof newValue === 'string'
                                                ? newValue
                                                : newValue?.value || '';
                                        setJobFormData((draft) => ({
                                            ...draft,
                                            educations: draft?.educations?.map?.((row, rowIndex) =>
                                                rowIndex === educationIndex
                                                    ? { ...row, level: levelValue, degree: '' }
                                                    : row
                                            ),
                                        }));
                                    },
                                }}
                                AutocompleteInputProps={{
                                    type: 'select',
                                    name: `edu_level_${educationIndex}`,
                                    label: 'Level'
                                }}
                            />
                            <MUIInput
                                formData={{}}
                                AutocompleteProps={{
                                    disableClearable: true,
                                    multiple: true,
                                    options: (degreeOpts[education.level] || [])
                                        .map((degree) => ({ label: degree, value: degree })),
                                    isOptionEqualToValue: (option, value) =>
                                    (typeof value === 'string'
                                        ? option.value === value
                                        : option?.value === value?.value),
                                    getOptionLabel: (option) =>
                                        (typeof option === 'string' ? option : option?.label || ''),
                                    getOptionValue: (option) =>
                                        (typeof option === 'string' ? option : option?.value),
                                    value: Array.isArray(education.degree)
                                        ? education.degree.map((v) => ({ label: v, value: v }))
                                        : education.degree
                                            ? [{ label: education.degree, value: education.degree }]
                                            : [],
                                    onChange: (_event, newValues) => {
                                        const selected = (newValues || []).map((v) =>
                                            typeof v === 'string' ? v : v?.value
                                        );
                                        setJobFormData((draft) => ({
                                            ...draft,
                                            educations: draft?.educations?.map?.((row, rowIndex) =>
                                                rowIndex === educationIndex
                                                    ? { ...row, degree: selected }
                                                    : row
                                            ),
                                        }));
                                    },
                                    renderTags: () => null,
                                }}
                                AutocompleteInputProps={{
                                    type: 'select',
                                    name: `edu_degree_${educationIndex}`,
                                    label: 'Degree'
                                }}
                            />
                        </Box>

                        {Array.isArray(education.degree) && education.degree.length > 0 && (
                            <Box sx={{ mt: 1, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {education.degree.map((degreeItem, degreeIndex) => (
                                    <Chip
                                        key={degreeIndex}
                                        label={degreeItem}
                                        size="small"
                                        onDelete={() => {
                                            const updated = education.degree.filter(
                                                (item) => item !== degreeItem
                                            );
                                            setJobFormData((draft) => ({
                                                ...draft,
                                                educations: draft?.educations?.map?.(
                                                    (row, rowIndex) =>
                                                        rowIndex === educationIndex
                                                            ? { ...row, degree: updated }
                                                            : row
                                                ),
                                            }));
                                        }}
                                    />
                                ))}
                            </Box>
                        )}

                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
                                gap: 2,
                                mb: 2
                            }}
                        >
                            <MUIInput
                                formData={rowFormData}
                                AutocompleteInputProps={{
                                    type: 'text',
                                    name: `edu_institute_${educationIndex}`,
                                    label: education.level === 'Schooling' ? 'School' : 'Institute',
                                    onChange: (e) => {
                                        const value = e.target.value;
                                        setJobFormData((draft) => ({
                                            ...draft,
                                            educations: draft?.educations?.map?.(
                                                (row, rowIndex) =>
                                                    rowIndex === educationIndex
                                                        ? { ...row, institute: value }
                                                        : row
                                            ),
                                        }));
                                    },
                                }}
                            />
                            <MUIButton type="button" onClick={() => openCollege(educationIndex)}>
                                Pick College
                            </MUIButton>
                        </Box>
                        {education.college && (
                            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {education.college.split(';').map((college, collegeIndex) => (
                                    <Chip
                                        key={collegeIndex}
                                        label={college}
                                        onDelete={() => {
                                            const updated = education.college
                                                .split(';')
                                                .filter((col) => col !== college)
                                                .join(';');
                                            setJobFormData((draft) => ({
                                                ...draft,
                                                educations: draft?.educations?.map?.(
                                                    (row, rowIndex) =>
                                                        rowIndex === educationIndex
                                                            ? {
                                                                ...row,
                                                                college: updated,
                                                                institute: updated
                                                            }
                                                            : row
                                                ),
                                            }));
                                        }}
                                    />
                                ))}
                            </Box>
                        )}

                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    sm: '1fr 1fr',
                                    md: '1fr 1fr 1fr'
                                },
                                gap: 2,
                                mb: 2,
                            }}
                        >
                            <MUIInput
                                formData={rowFormData}
                                AutocompleteInputProps={{
                                    type: 'text',
                                    name: `edu_field_${educationIndex}`,
                                    label: 'Field/Stream',
                                    onChange: (e) => {
                                        const value = e.target.value;
                                        setJobFormData((draft) => ({
                                            ...draft,
                                            educations: draft?.educations?.map?.(
                                                (row, rowIndex) =>
                                                    rowIndex === educationIndex
                                                        ? { ...row, field: value }
                                                        : row
                                            ),
                                        }));
                                    },
                                    sx: { mb: 2 },
                                }}
                            />

                            <MUIInput
                                formData={rowFormData}
                                AutocompleteInputProps={{
                                    type: 'text',
                                    name: `edu_passout_${educationIndex}`,
                                    label: 'Passout Year',
                                    onChange: (e) => {
                                        const value = e.target.value;
                                        setJobFormData((draft) => ({
                                            ...draft,
                                            educations: draft?.educations?.map?.(
                                                (row, rowIndex) =>
                                                    rowIndex === educationIndex
                                                        ? { ...row, yearOfCompletion: value }
                                                        : row
                                            ),
                                        }));
                                    },
                                    sx: { mb: 2 },
                                }}
                            />

                            <MUIInput
                                formData={rowFormData}
                                AutocompleteInputProps={{
                                    type: 'text',
                                    name: `edu_score_${educationIndex}`,
                                    label: '% / CGPA',
                                    onChange: (e) => {
                                        const value = e.target.value;
                                        setJobFormData((draft) => ({
                                            ...draft,
                                            educations: draft?.educations?.map?.(
                                                (row, rowIndex) =>
                                                    rowIndex === educationIndex
                                                        ? { ...row, score: value }
                                                        : row
                                            ),
                                        }));
                                    },
                                    sx: { mb: 2 },
                                }}
                            />
                        </Box>
                    </Box>
                );
            })}

            <MUIButton
                type="button"
                onClick={() =>
                    setJobFormData((draft) => ({
                        ...draft,
                        educations: [
                            ...(draft?.educations || []),
                            {
                                level: '',
                                degree: [],
                                institute: '',
                                field: '',
                                score: '',
                                college: '',
                                yearOfCompletion: ''
                            }
                        ],
                    }))
                }
            >
                Add Education
            </MUIButton>
            <CollegeModal
                open={gState?.jobFormData?.collegeModal?.open || false}
                onClose={() => onCollegeModelChange("open", false)}
                colleges={gState?.jobFormData?.collegesTiers || {}}
                picks={gState?.jobFormData?.collegeModal?.picks || {}}
                toggleCollege={toggleCollege}
                confirmCollege={confirmCollege}
                newName={gState?.jobFormData?.collegeModal?.newName || ''}
                setNewName={(name) => onCollegeModelChange("newName", name)}
                newCity={gState?.jobFormData?.collegeModal?.newCity || ''}
                setNewCity={(city) => onCollegeModelChange("newCity", city)}
                newState={gState?.jobFormData?.collegeModal?.newState || ''}
                setNewState={(stateName) => onCollegeModelChange("newState", stateName)}
                newTier={gState?.jobFormData?.collegeModal?.newTier || 'tier3'}
                setNewTier={(tier) => onCollegeModelChange("newTier", tier)}
            />
        </Box>
    ), [confirmCollege, gState?.jobFormData, handleChangeExtended, onCollegeModelChange, openCollege, setJobFormData, toggleCollege]);

    const onCancelOrBack = useCallback(() => {
        if (!Number.isFinite(activeStep) || activeStep <= 0) {
            setJobFormData(null);
            navigate(-1);
            return;
        }

        setJobFormData((prev = {}) => ({
            ...prev,
            activeStep: Math.max(0, activeStep - 1),
        }));
    }, [activeStep, navigate, setJobFormData]);

    const onNextOrSave = useCallback(async () => {
        const formData = gState?.jobFormData || {};
        const currentStep = Number.isInteger(formData?.activeStep) ? formData.activeStep : 0;
        const clampedStep = Math.max(0, Math.min(currentStep, steps.length - 1));

        if (clampedStep === 0) {
            const locs = getLocations(formData);
            if (!locs.length) {
                setJobFormData((prev = {}) => ({
                    ...prev,
                    alert: {
                        open: true,
                        message: 'Please add at least one location and press Enter to add it.',
                        severity: 'error'
                    }
                }));
                return;
            }
            // Walk-in drive validation
            if (formData?.isWalkIn) {
                const walkInDateFrom = String(formData?.walkInDateFrom || '').trim();
                const walkInDateTo = String(formData?.walkInDateTo || '').trim();
                const walkInTimeStart = String(formData?.walkInTimeStart || '').trim();
                const walkInTimeEnd = String(formData?.walkInTimeEnd || '').trim();
                if (!walkInDateFrom || !walkInDateTo || !walkInTimeStart || !walkInTimeEnd) {
                    setJobFormData((prev = {}) => ({
                        ...prev,
                        alert: {
                            open: true,
                            message: 'Please fill out all Walk-in Drive fields (Date From, Date To, Time Start, Time End).',
                            severity: 'error'
                        }
                    }));
                    return;
                }
                if (walkInDateFrom > walkInDateTo) {
                    setJobFormData((prev = {}) => ({
                        ...prev,
                        alert: {
                            open: true,
                            message: 'Walk-in Drive "Date From" cannot be after "Date To".',
                            severity: 'error'
                        }
                    }));
                    return;
                }
                if (walkInDateFrom === walkInDateTo && walkInTimeStart >= walkInTimeEnd) {
                    setJobFormData((prev = {}) => ({
                        ...prev,
                        alert: {
                            open: true,
                            message: 'For a single-day Walk-in Drive, "Time Start" must be before "Time End".',
                            severity: 'error'
                        }
                    }));
                    return;
                }

                const walkInStartDate = new Date(`${walkInDateFrom}T${walkInTimeStart}`);
                if (walkInStartDate <= new Date()) {
                    setJobFormData((prev = {}) => ({
                        ...prev,
                        alert: {
                            open: true,
                            message: 'Walk-in Drive start date and time must be in the future.',
                            severity: 'error'
                        }
                    }));
                    return;
                }
            }

            const skills = getSkills(formData);
            if (skills.length < 3) {
                setJobFormData((prev = {}) => ({
                    ...prev,
                    alert: {
                        open: true,
                        message: 'Please add at least 3 primary skills before continuing.',
                        severity: 'error'
                    }
                }));
                return;
            }

            const hasDescription = String(formData?.description || '').trim() !== '';
            const hasScriptContent = String(formData?.scriptContent || '').trim() !== '';
            const shouldAutoGenerateJDAndScript =
                (!hasDescription && !hasScriptContent) ||
                hasStepOneChangesInEdit ||
                hasStepOneChangesSinceLastGeneration;

            const shouldAutoGenerateScriptOnly = !shouldAutoGenerateJDAndScript && hasWalkInChangesInEdit;

            if (shouldAutoGenerateJDAndScript) {
                try {
                    setUiState({ loadingMsg: 'Generating AI content, Please wait...' });

                    const generatedDescription =
                        await fetchJobDescription(formData, setJobFormData, setUiState);

                    await fetchGeneratedScript(
                        {
                            ...formData,
                            description: generatedDescription || formData?.description || '',
                        },
                        setJobFormData,
                        setUiState
                    );
                    lastGeneratedStepOneSignatureRef.current = getStepOneSignature({
                        ...formData,
                        description: generatedDescription || formData?.description || '',
                    });
                    setJobFormData((prev = {}) => ({
                        ...prev,
                        activeStep: 1,
                        alert: {
                            open: true,
                            message: 'AI content generated successfully. Review and edit before saving.',
                            severity: 'success'
                        }
                    }));
                } catch (err) {
                    setJobFormData((prev = {}) => ({
                        ...prev,
                        alert: {
                            open: true,
                            message: getFriendlyErrorMessage(err, 'Failed to generate AI content. Please try again.'),
                            severity: 'error'
                        }
                    }));
                } finally {
                    setUiState({ loadingMsg: null });
                }
                return;
            }
            if (shouldAutoGenerateScriptOnly) {
                try {
                    setUiState({ loadingMsg: 'Regenerating Script for walk-in updates, Please wait...' });

                    await fetchGeneratedScript(
                        {
                            ...formData,
                            description: formData?.description || '',
                        },
                        setJobFormData,
                        setUiState
                    );

                    setJobFormData((prev = {}) => ({
                        ...prev,
                        activeStep: 1,
                        alert: {
                            open: true,
                            message: 'Script regenerated successfully for walk-in updates.',
                            severity: 'success'
                        }
                    }));
                } catch (err) {
                    setJobFormData((prev = {}) => ({
                        ...prev,
                        alert: {
                            open: true,
                            message: getFriendlyErrorMessage(err, 'Failed to regenerate the script. Please try again.'),
                            severity: 'error'
                        }
                    }));
                } finally {
                    setUiState({ loadingMsg: null });
                }
                return;
            }
            setJobFormData((prev = {}) => ({
                ...prev,
                activeStep: 1,
            }));
            return;
        }

        setJobFormData((prev = {}) => ({
            ...prev,
            activeStep: clampedStep < steps.length - 1 ? clampedStep + 1 : clampedStep
        }));
    }, [gState?.jobFormData, hasStepOneChangesInEdit, hasStepOneChangesSinceLastGeneration, setJobFormData, hasWalkInChangesInEdit, setUiState]);

    const handleSubmit = useCallback(async (ev = null) => {
        ev?.preventDefault();
        let currentJobId = gState?.jobFormData?._id || gState?.jobInitialValuesDict?._id;

        // Hybrid detail check (existing)
        if (
            gState?.jobFormData?.workMode === 'Hybrid' &&
            (!gState?.jobFormData?.hybridDetails ||
                gState?.jobFormData?.hybridDetails.trim() === '')
        ) {
            setJobFormData((prev = {}) => ({
                ...prev, alert: {
                    open: true,
                    message: 'Please specify WFO/WFH details for Hybrid work mode.',
                    severity: 'error'
                }
            }));

            return;
        }

        // enforce at least one location before posting
        const locs = Array.isArray(gState?.jobFormData?.locations)
            ? gState?.jobFormData?.locations.filter(Boolean)
            : [];
        if (locs.length < 1) {
            setJobFormData((prev = {}) => ({
                ...prev, alert: {
                    open: true,
                    message: 'Please add at least one location and press Enter to add it.',
                    severity: 'error'
                }
            }));

            return;
        }
        // Walk-in drive validation on final save
        if (gState?.jobFormData?.isWalkIn) {
            const wdf = String(gState?.jobFormData?.walkInDateFrom || '').trim();
            const wdt = String(gState?.jobFormData?.walkInDateTo || '').trim();
            const wts = String(gState?.jobFormData?.walkInTimeStart || '').trim();
            const wte = String(gState?.jobFormData?.walkInTimeEnd || '').trim();
            if (!wdf || !wdt || !wts || !wte) {
                setJobFormData((prev = {}) => ({
                    ...prev, alert: {
                        open: true,
                        message: 'Please fill out all Walk-in Drive fields (Date From, Date To, Time Start, Time End).',
                        severity: 'error'
                    }
                }));
                return;
            }
            if (wdf > wdt) {
                setJobFormData((prev = {}) => ({
                    ...prev, alert: {
                        open: true,
                        message: 'Walk-in Drive "Date From" cannot be after "Date To".',
                        severity: 'error'
                    }
                }));
                return;
            }
            if (wdf === wdt && wts >= wte) {
                setJobFormData((prev = {}) => ({
                    ...prev, alert: {
                        open: true,
                        message: 'For a single-day Walk-in Drive, "Time Start" must be before "Time End".',
                        severity: 'error'
                    }
                }));
                return;
            }
            const walkInStartDateSave = new Date(`${wdf}T${wts}`);
            if (walkInStartDateSave <= new Date()) {
                setJobFormData((prev = {}) => ({
                    ...prev, alert: {
                        open: true,
                        message: 'Walk-in Drive start date and time must be in the future.',
                        severity: 'error'
                    }
                }));
                return;
            }
        }
        // normalize and validate company id
        const companyId = normalizeAutoCompleteId(gState?.jobFormData?.company);
        if (!companyId) {
            setJobFormData((prev = {}) => ({
                ...prev, alert: {
                    open: true,
                    message: 'Please select a valid Company.',
                    severity: 'error'
                }
            }));

            return;
        }

        const rawMinExp = gState?.jobFormData?.minExp;
        const rawMaxExp = gState?.jobFormData?.maxExp;
        const hasMinExp = rawMinExp != null && String(rawMinExp).trim() !== '';
        const hasMaxExp = rawMaxExp != null && String(rawMaxExp).trim() !== '';
        const minExp = Number(rawMinExp);
        const maxExp = Number(rawMaxExp);
        if (
            hasMinExp &&
            hasMaxExp &&
            Number.isFinite(minExp) &&
            Number.isFinite(maxExp) &&
            minExp > maxExp
        ) {
            setJobFormData((prev = {}) => ({
                ...prev, alert: {
                    open: true,
                    message: 'Minimum experience cannot be greater than maximum experience.',
                    severity: 'error'
                }
            }));
            return;
        }

        const rawMinSalary = gState?.jobFormData?.minSalary;
        const rawMaxSalary = gState?.jobFormData?.maxSalary;
        const hasMinSalary = rawMinSalary != null && String(rawMinSalary).trim() !== '';
        const hasMaxSalary = rawMaxSalary != null && String(rawMaxSalary).trim() !== '';
        const minSalary = Number(rawMinSalary);
        const maxSalary = Number(rawMaxSalary);
        if (
            hasMinSalary &&
            hasMaxSalary &&
            Number.isFinite(minSalary) &&
            Number.isFinite(maxSalary) &&
            minSalary > maxSalary
        ) {
            setJobFormData((prev = {}) => ({
                ...prev, alert: {
                    open: true,
                    message: 'Minimum salary cannot be greater than maximum salary.',
                    severity: 'error'
                }
            }));
            return;
        }

        if (
            [
                gState?.jobFormData?.scriptName,
                gState?.jobFormData?.scriptType?.value,
                gState?.jobFormData?.scriptContent,
                gState?.jobFormData?.scriptLang,
                gState?.jobFormData?.scriptGender,
                gState?.jobFormData?.scriptVoice
            ].some((v) => v == null || String(v).trim() === '')
        ) {
            setJobFormData((prev = {}) => ({
                ...prev, alert: {
                    open: true,
                    message: 'Please fill all required Script fields before saving.',
                    severity: 'error'
                },
            }));
            return;
        }

        try {
            const {
                salaryCurrency: _stripCurrency,
                walkInDateFrom: _stripWDF,
                walkInDateTo: _stripWDT,
                walkInTimeStart: _stripWTS,
                walkInTimeEnd: _stripWTE,
                ...restFormData
            } = gState?.jobFormData || {};
            const jobPayload = {
                ...restFormData,
                company: companyId,
                positions: Number(gState?.jobFormData?.positions) || 1,
                experience: {
                    min: Number(gState?.jobFormData?.minExp) || 0,
                    max: Number(gState?.jobFormData?.maxExp) || 0
                },
                workMode: gState?.jobFormData?.workMode,
                hybridDetails:
                    gState?.jobFormData?.workMode === 'Hybrid'
                        ? (gState?.jobFormData?.hybridDetails?.trim() || '')
                        : '',
                isRemote: gState?.jobFormData?.isRemote,
                locations: locs,
                salary: {
                    min: Number(gState?.jobFormData?.minSalary) || 0,
                    max: Number(gState?.jobFormData?.maxSalary) || 0,
                    currency: gState?.jobFormData?.salaryCurrency || 'INR'
                },
                educationDetails: gState?.jobFormData?.educations?.map?.(
                    (education) => ({
                        level: education.level,
                        qualification: Array.isArray(education.degree)
                            ? education.degree.flat().filter(Boolean)
                            : [education.degree].filter(Boolean),
                        streamOrSpecialization: education.field,
                        boardOrInstitute:
                            typeof education.institute === 'string'
                                ? education.institute
                                    .split(';')
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                : Array.isArray(education.institute)
                                    ? education.institute
                                    : [],
                        yearOfCompletion: education.yearOfCompletion,
                        gradeType: 'Score',
                        gradeValue: education.score
                    })
                ),
                primarySkills: gState?.jobFormData?.skills,
                secondarySkills: [],
                description: gState?.jobFormData?.description,
                recruiterNotes: gState?.jobFormData?.notes,
                enableAICall: true,
                isWalkIn: Boolean(gState?.jobFormData?.isWalkIn),
                walkInDetails: gState?.jobFormData?.isWalkIn
                    ? {
                        dateRange: {
                            from: gState?.jobFormData?.walkInDateFrom || null,
                            to: gState?.jobFormData?.walkInDateTo || null,
                        },
                        timeRange: {
                            start: gState?.jobFormData?.walkInTimeStart || null,
                            end: gState?.jobFormData?.walkInTimeEnd || null,
                        },
                    }
                    : {},
                status: 'active',
                unit: null
            };

            if (!currentJobId) {
                const saved = await performDeploySafeFetch(
                    "Create Job",
                    async () => await fetchData('/api/jobs', {
                        method: 'POST',
                        body: JSON.stringify(jobPayload)
                    }),
                    setUiState,
                    "Saving Job"
                );
                currentJobId = saved?._id;
                if (!currentJobId) throw new Error('Job created but no _id returned');
            } else {
                try {
                    await performDeploySafeFetch(
                        "Update Job",
                        async () => await fetchData(`/api/jobs/${currentJobId}`, {
                            method: 'PUT',
                            body: JSON.stringify(jobPayload)
                        }),
                        setUiState,
                        "Saving Job"
                    );
                } catch (err) {
                    if (String(err).includes('404')) {
                        const saved = await performDeploySafeFetch(
                            "Re-create Job",
                            async () => await fetchData('/api/jobs', {
                                method: 'POST',
                                body: JSON.stringify(jobPayload)
                            }),
                            setUiState,
                            "Saving Job"
                        );
                        currentJobId = saved._id;
                    } else {
                        throw err;
                    }
                }
            }

            const scriptPayload = {
                jobId: currentJobId,
                scriptName: gState?.jobFormData?.scriptName,
                scriptType: gState?.jobFormData?.scriptType?.value,
                extraQuestion: gState?.jobFormData?.scriptExtra || '',
                content: gState?.jobFormData?.scriptContent,
                language: gState?.jobFormData?.scriptLang,
                gender: gState?.jobFormData?.scriptGender,
                voiceModel: gState?.jobFormData?.openaiVoice || gState?.jobFormData?.scriptVoice,
                openaiVoice: gState?.jobFormData?.openaiVoice,
                openaiInstructions: gState?.jobFormData?.openaiInstructions
            };

            if (!currentJobId) {
                await performDeploySafeFetch(
                    "Create Script",
                    async () => await fetchData('/api/scripts', {
                        method: 'POST',
                        body: JSON.stringify(scriptPayload)
                    }),
                    setUiState,
                    "Saving Script"
                );
            } else {
                const list = await performDeploySafeFetch(
                    "Fetch Scripts",
                    async () => await fetchData(`/api/scripts?jobId=${currentJobId}`),
                    null,
                    "Checking Scripts"
                );
                if (Array.isArray(list) && list.length) {
                    await performDeploySafeFetch(
                        "Update Script",
                        async () => await fetchData(`/api/scripts/${list[0]._id}`, {
                            method: 'PUT',
                            body: JSON.stringify(scriptPayload)
                        }),
                        setUiState,
                        "Saving Script"
                    );
                } else {
                    await performDeploySafeFetch(
                        "Create Script",
                        async () => await fetchData('/api/scripts', {
                            method: 'POST',
                            body: JSON.stringify(scriptPayload)
                        }),
                        setUiState,
                        "Saving Script"
                    );
                }
            }

            setGState({
                jobFormData: null,
                jobRowsList: null,
                jobInitialValuesDict: null,
            });

            navigate(-1);
        } catch (err) {
            console.error('[NewJob] Save error:', err);
            setJobFormData((prev = {}) => ({
                ...prev,
                alert: {
                    open: true,
                    message: getFriendlyErrorMessage(err, 'Save failed. Please try again.'),
                    severity: 'error'
                },
            }));
        } finally {
            setUiState({
                loadingMsg: null,
            });
        }

    }, [gState?.jobFormData, gState?.jobInitialValuesDict?._id, navigate, setGState, setJobFormData, setUiState]);

    const createFormOpts = useMemo(() => {
        const formOpts = {};

        if (activeStep < steps?.length - 1) {
            formOpts["onSubmit"] = (ev = null) => {
                ev?.preventDefault();
                onNextOrSave();
            };
        } else {
            formOpts["onSubmit"] = handleSubmit;
        }

        return formOpts;
    }, [activeStep, handleSubmit, onNextOrSave]);

    useEffect(() => {
        (async () => {
            try {
                if (!Array.isArray(companiesList) || companiesList.length === 0) {
                    const list = await fetchData('/api/companies');
                    setCompaniesList(
                        (Array.isArray(list) ? list : list.companies || []).map((company) => ({
                            label: company.name || company._id,
                            value: company._id
                        }))
                    );
                }

                if (!gState?.jobFormData?.collegesTiers?.tier1) {
                    const tier1 = ([...new Set(collegeListJson.tier_1_colleges)])
                        .map((college) => college.institute + " - " + college?.city + ", " + college?.state);
                    const tier2 = ([...new Set(collegeListJson.tier_2_colleges)])
                        .map((college) => college.institute + " - " + college?.city + ", " + college?.state);
                    setJobFormData((prev = {}) => ({
                        ...prev,
                        collegesTiers: {
                            tier1,
                            tier2,
                            tier3: ['Local University', 'Open University', 'State College']
                        }
                    }));
                    console.log(
                        "\n Collage option setup...\n\n",
                    );
                }

            } catch (err) {
                console.error(
                    "Error in getting required data for job form: ", err
                );
            }
        })();
    }, [companiesList, gState?.jobFormData?.collegesTiers, setJobFormData]);

    useEffect(() => {
        if (
            gState?.jobFormData?.company &&
            typeof gState?.jobFormData?.company === "string" &&
            (companiesList || [])?.length > 0
        ) {
            setJobFormData((prev = {}) => ({
                ...prev,
                company: companiesList?.find?.(
                    (ele) => ele?.value === normalizeAutoCompleteId(gState?.jobFormData?.company)
                ) || '',
            }));
        }

        if (
            gState?.jobFormData?.scriptType &&
            typeof gState?.jobFormData?.scriptType === "string" &&
            (scriptTypeOpts || [])?.length > 0
        ) {
            setJobFormData((prev = {}) => ({
                ...prev,
                scriptType: scriptTypeOpts?.find?.(
                    (ele) => ele?.value === normalizeAutoCompleteId(gState?.jobFormData?.scriptType)
                ) || '',
            }));
        }

    }, [companiesList, gState?.jobFormData?.company, gState?.jobFormData?.scriptType, setJobFormData]);

    useEffect(() => {
        const nextScriptName = buildDynamicScriptName(
            gState?.jobFormData?.title,
            gState?.jobFormData?.scriptType
        );

        if ((gState?.jobFormData?.scriptName || '') !== nextScriptName) {
            setJobFormData((prev = {}) => ({
                ...prev,
                scriptName: nextScriptName,
            }));
        }
    }, [gState?.jobFormData?.title, gState?.jobFormData?.scriptType, gState?.jobFormData?.scriptName, setJobFormData]);

    useEffect(() => {
        (async () => {

            const currentJobId = gState?.jobFormData?._id || gState?.jobInitialValuesDict?._id;

            let list = [{}];
            if (currentJobId) {
                try {
                    let list_ = await fetchData(`/api/scripts/and/jobs/?jobId=${currentJobId}`);
                    if (!Array.isArray(list_) || (list_ || [])?.length <= 0) {
                        throw new Error("Records not found...");
                    }

                    if (Array.isArray(list_) && (list_ || [])?.length > 0) {
                        list = list_;
                    }

                } catch {
                    list = [{
                        jobId: await fetchData(`/api/jobs/${currentJobId}`),
                    }];
                }
            }

            const { jobId = {}, ...restSrcData } = (list?.[0] || {});

            const initVal = {
                ...(gState?.jobFormData || {}),
                ...restSrcData,
                ...jobId,
                ...(gState?.jobInitialValuesDict || {}),
            };

            initVal.hybridDetails =
                initVal?.hybridDetails || gState?.jobInitialValuesDict?.hybridDetails;

            initVal.educations = [
                ...(initVal?.educations || []),
                ...(initVal?.educationDetails && Array.isArray(initVal?.educationDetails)
                    ? (initVal?.educationDetails?.map?.((ed) => ({
                        level: ed.level || '',
                        degree: Array.isArray(ed.qualification)
                            ? ed.qualification
                            : [ed.qualification].filter(Boolean),
                        institute: Array.isArray(ed.boardOrInstitute)
                            ? ed.boardOrInstitute.join(';')
                            : ed.boardOrInstitute || '',
                        field: ed.streamOrSpecialization || '',
                        score: ed.gradeValue || '',
                        college: Array.isArray(ed.boardOrInstitute)
                            ? ed.boardOrInstitute.join(';')
                            : ed.boardOrInstitute || '',
                        yearOfCompletion: getSafeVal(ed.yearOfCompletion),
                    })) || [])
                    : [])
            ];

            initVal.skills = [...new Set([
                ...((Array.isArray(initVal?.skills) && initVal?.skills) || []),
                ...((Array.isArray(initVal?.primarySkills) && initVal?.primarySkills) || []),
            ])];

            if (initVal?.minExp == null && initVal?.experience?.min != null) initVal.minExp = initVal.experience.min;
            if (initVal?.maxExp == null && initVal?.experience?.max != null) initVal.maxExp = initVal.experience.max;

            if (initVal?.minSalary == null && initVal?.salary?.min != null) initVal.minSalary = initVal.salary.min;
            if (initVal?.maxSalary == null && initVal?.salary?.max != null) initVal.maxSalary = initVal.salary.max;
            if (!initVal?.salaryCurrency && initVal?.salary?.currency) initVal.salaryCurrency = initVal.salary.currency;

            // Map walk-in drive fields for editing
            if (initVal?.isWalkIn) {
                const dr = initVal?.walkInDetails?.dateRange;
                const tr = initVal?.walkInDetails?.timeRange;
                if (dr?.from && !initVal.walkInDateFrom) initVal.walkInDateFrom = new Date(dr.from).toISOString().slice(0, 10);
                if (dr?.to && !initVal.walkInDateTo) initVal.walkInDateTo = new Date(dr.to).toISOString().slice(0, 10);
                if (tr?.start && !initVal.walkInTimeStart) initVal.walkInTimeStart = tr.start;
                if (tr?.end && !initVal.walkInTimeEnd) initVal.walkInTimeEnd = tr.end;
            }

            if (!initVal?.scriptContent && initVal?.content) initVal.scriptContent = initVal?.content;

            // Map existing script fields into form-specific fields when editing
            if (!initVal?.scriptExtra && initVal?.extraQuestion) initVal.scriptExtra = initVal.extraQuestion;
            if (!initVal?.scriptLang && initVal?.language) initVal.scriptLang = initVal.language;
            if (!initVal?.scriptGender && initVal?.gender) initVal.scriptGender = initVal.gender;
            if (!initVal?.scriptVoice && initVal?.voiceModel) initVal.scriptVoice = initVal.voiceModel;

            // Apply defaults only if still not set
            if (!initVal?.scriptLang) initVal.scriptLang = 'en-IN';
            if (!initVal?.scriptGender) initVal.scriptGender = 'FEMALE';
            if (!initVal?.scriptVoice) initVal.scriptVoice = `${initVal.scriptLang}-Chirp-HD-F`;
            if (!initVal?.scriptType && Array.isArray(scriptTypeOpts) && scriptTypeOpts.length > 0) {
                initVal.scriptType = scriptTypeOpts[0];
            }

            setJobFormData((prev = {}) => ({
                ...prev,
                ...initVal
            }));

        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gState?.jobInitialValuesDict]);

    useEffect(() => {
        const handleBack = () => {
            setGState({
                jobFormData: null,
                jobInitialValuesDict: null,
            });
        };
        window.addEventListener("popstate", handleBack);

        return () => {
            window.removeEventListener("popstate", handleBack);
        };
    }, [setGState]);

    const initialJobFormValues = useMemo(() => {
        const initVal = {
            ...(gState?.jobInitialValuesDict || {}),
            ...(gState?.jobFormData || {}),
        };

        return initVal;
    }, [gState?.jobFormData, gState?.jobInitialValuesDict]);

    return (
        <>
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
                    initialValuesDict={initialJobFormValues}
                    onChangeExtended={handleChangeExtended}
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
                            pt: 0,
                        }
                    }}
                    formBoxOptions={{ ...createFormOpts, sx: { p: { xs: 2, sm: 3, md: 3 }, pt: 0, ...formInputSx } }}
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
                                        borderRadius: 3,
                                        borderBottomLeftRadius: 0,
                                        borderBottomRightRadius: 0,
                                        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                                    }}
                                >
                                    <IconButton
                                        size="small"
                                        onClick={() => navigate(-1)}
                                        aria-label="Go back"
                                        sx={{ color: theme.palette.text.primary }}
                                    >
                                        <ArrowBackIosNewOutlined fontSize="small" />
                                    </IconButton>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                            {gState?.jobInitialValuesDict?._id ? 'Edit Job' : 'Create Job'}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                            Enter job details
                                        </Typography>
                                    </Box>
                                </Box>
                            ),
                            fieldBoxOptions: {
                                sx: {
                                    mb: 0,
                                    mx: { xs: -2, sm: -3, md: -3 },
                                    mt: { xs: -2, sm: -3, md: -3 },
                                },
                            },
                        },
                        {
                            getField: () => (
                                <Box sx={{ mt: { xs: 2, sm: 3 }, mb: 2 }}>
                                    <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 0 }}>
                                        {steps.map((label, stepIndex) => (
                                            <Step key={label}>
                                                <StepLabel
                                                    onClick={() =>
                                                        !gState?.jobInitialValuesDict?._id
                                                            ? document
                                                                ?.getElementById?.("id_job_form_submit")
                                                                ?.click?.()
                                                            : handleChangeExtended({
                                                                target: {
                                                                    name: "activeStep",
                                                                    value: stepIndex
                                                                }
                                                            })
                                                    }
                                                >
                                                    {label}
                                                </StepLabel>
                                            </Step>
                                        ))}
                                    </Stepper>
                                </Box>
                            )
                        },
                        ...(activeStep === 0
                            ? [
                                {
                                    AutocompleteInputProps: {
                                        type: 'text',
                                        name: 'title',
                                        label: 'Job Title',
                                        required: true,
                                        sx: { mb: 2 }
                                    },
                                    fieldBoxOptions: { sx: { mb: 2 } },
                                },
                                {
                                    AutocompleteInputProps: {
                                        type: 'text',
                                        name: 'internalTitle',
                                        label: 'Internal Job Title',
                                        sx: { mb: 2 }
                                    }
                                },
                                {
                                    getField: () => (
                                        <Box sx={{ mb: 2 }}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={Boolean(gState?.jobFormData?.isWalkIn)}
                                                        onChange={(e) =>
                                                            handleChangeExtended({
                                                                target: {
                                                                    name: 'isWalkIn',
                                                                    value: e.target.checked,
                                                                },
                                                            })
                                                        }
                                                        color="primary"
                                                    />
                                                }
                                                label={
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                        Walk-in Drive
                                                    </Typography>
                                                }
                                            />
                                            <Collapse in={Boolean(gState?.jobFormData?.isWalkIn)} timeout="auto">
                                                <Box
                                                    sx={{
                                                        display: 'grid',
                                                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                                        gap: 2,
                                                        mt: 1,
                                                        p: 2,
                                                        borderRadius: 2,
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                        bgcolor: 'background.default',
                                                    }}
                                                >
                                                    <TextField
                                                        label="Date From"
                                                        type="date"
                                                        size="small"
                                                        value={gState?.jobFormData?.walkInDateFrom || ''}
                                                        onChange={(e) =>
                                                            handleChangeExtended({
                                                                target: { name: 'walkInDateFrom', value: e.target.value },
                                                            })
                                                        }
                                                        InputLabelProps={{ shrink: true }}
                                                        fullWidth
                                                        required={Boolean(gState?.jobFormData?.isWalkIn)}
                                                    />
                                                    <TextField
                                                        label="Date To"
                                                        type="date"
                                                        size="small"
                                                        value={gState?.jobFormData?.walkInDateTo || ''}
                                                        onChange={(e) =>
                                                            handleChangeExtended({
                                                                target: { name: 'walkInDateTo', value: e.target.value },
                                                            })
                                                        }
                                                        InputLabelProps={{ shrink: true }}
                                                        fullWidth
                                                        required={Boolean(gState?.jobFormData?.isWalkIn)}
                                                    />
                                                    <TextField
                                                        label="Time Start"
                                                        type="time"
                                                        size="small"
                                                        value={gState?.jobFormData?.walkInTimeStart || ''}
                                                        onChange={(e) =>
                                                            handleChangeExtended({
                                                                target: { name: 'walkInTimeStart', value: e.target.value },
                                                            })
                                                        }
                                                        InputLabelProps={{ shrink: true }}
                                                        fullWidth
                                                        required={Boolean(gState?.jobFormData?.isWalkIn)}
                                                    />
                                                    <TextField
                                                        label="Time End"
                                                        type="time"
                                                        size="small"
                                                        value={gState?.jobFormData?.walkInTimeEnd || ''}
                                                        onChange={(e) =>
                                                            handleChangeExtended({
                                                                target: { name: 'walkInTimeEnd', value: e.target.value },
                                                            })
                                                        }
                                                        InputLabelProps={{ shrink: true }}
                                                        fullWidth
                                                        required={Boolean(gState?.jobFormData?.isWalkIn)}
                                                    />
                                                </Box>
                                            </Collapse>
                                        </Box>
                                    ),
                                },
                                {
                                    type: 'row',
                                    rowColFields: [
                                        {
                                            AutocompleteProps: {
                                                options: companiesList,
                                                isOptionEqualToValue: (option, value) =>
                                                (typeof value === 'string'
                                                    ? option.value === value
                                                    : option?.value === value?.value),
                                                getOptionLabel: (option) =>
                                                    typeof option === 'string'
                                                        ? companiesList.find(
                                                            (o) => o.value === option
                                                        )?.label || ''
                                                        : option?.label || '',
                                                getOptionValue: (option) =>
                                                    typeof option === 'string'
                                                        ? option
                                                        : option?.value,
                                            },
                                            AutocompleteInputProps: {
                                                type: 'select',
                                                name: 'company',
                                                label: 'Company',
                                                required: true,
                                            },
                                            boxColOptions: { sx: { minWidth: 0 } },
                                        },
                                        {
                                            AutocompleteInputProps: {
                                                type: 'text',
                                                name: 'positions',
                                                label: 'No. of Positions',
                                                inputMode: 'numeric',
                                                pattern: '\\d*',
                                            },
                                            boxColOptions: { sx: { minWidth: 0 } },
                                        },
                                    ],
                                    boxRowOptions: {
                                        sx: {
                                            display: 'grid',
                                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                            gap: 2,
                                            mb: 2
                                        }
                                    },
                                },
                                {
                                    type: 'row',
                                    rowColFields: [
                                        {
                                            AutocompleteProps: {
                                                options: jobTypeOpts,
                                                getOptionValue: (option) =>
                                                (typeof option === 'string'
                                                    ? option
                                                    : option?.value),
                                            },
                                            AutocompleteInputProps: {
                                                type: 'select',
                                                name: 'jobType',
                                                label: 'Job Type',
                                                required: true,
                                            },
                                            boxColOptions: { sx: { minWidth: 0 } },
                                        },
                                        {
                                            AutocompleteProps: {
                                                options: workModeOpts,
                                                getOptionValue: (option) =>
                                                (typeof option === 'string'
                                                    ? option
                                                    : option?.value),
                                            },
                                            AutocompleteInputProps: {
                                                type: 'select',
                                                name: 'workMode',
                                                label: 'Work Mode',
                                                required: true
                                            },
                                            boxColOptions: { sx: { minWidth: 0 } },
                                        }
                                    ],
                                    boxRowOptions: {
                                        sx: {
                                            display: 'grid',
                                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                            gap: 2,
                                            mb: 2
                                        }
                                    },
                                },
                                ...(gState?.jobFormData?.workMode === 'Hybrid'
                                    ? [
                                        {
                                            AutocompleteInputProps: {
                                                type: 'text',
                                                name: 'hybridDetails',
                                                label: 'Hybrid Details (WFO/WFH split)',
                                                helperText:
                                                    "E.g., '3 days WFO, 2 days WFH' or 'WFH on Fridays'",
                                                required: true,
                                                sx: { mb: 2 },
                                            },
                                        },
                                    ]
                                    : []),
                                {
                                    getField: () => (
                                        <GooglePlacesAutocomplete
                                            label="Add Location and press Enter *"
                                            onSelect={(val) => {
                                                if (val)
                                                    handleChangeExtended({
                                                        target: {
                                                            name: "locations",
                                                            value: [
                                                                ...new Set([
                                                                    ...(gState?.jobFormData?.locations || []),
                                                                    val
                                                                ])
                                                            ]
                                                        }
                                                    });
                                            }}
                                            sx={{ mb: 1 }}
                                        />
                                    ),
                                },
                                {
                                    getField: () => (
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: 1,
                                                mb: 2
                                            }}
                                        >
                                            {gState?.jobFormData?.locations?.map?.((val) => (
                                                <Chip
                                                    key={val}
                                                    label={val}
                                                    onDelete={() =>
                                                        handleChangeExtended({
                                                            target: {
                                                                name: "locations",
                                                                value: [
                                                                    ...(gState?.jobFormData?.locations ||
                                                                        []
                                                                    ).filter((x) => x !== val)
                                                                ]
                                                            }
                                                        })
                                                    }
                                                    sx={{
                                                        textWrap: "wrap",
                                                        maxWidth: "30vw"
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    ),
                                },
                                {
                                    type: 'row',
                                    rowColFields: [
                                        {
                                            AutocompleteInputProps: {
                                                type: 'text',
                                                name: 'minExp',
                                                label: 'Min Exp (yrs)',
                                                required: true,
                                                inputMode: 'decimal',
                                                pattern: '^\\d*(\\.\\d+)?$'
                                            },
                                            boxColOptions: { sx: { minWidth: 0 } }
                                        },
                                        {
                                            AutocompleteInputProps: {
                                                type: 'text',
                                                name: 'maxExp',
                                                label: 'Max Exp (yrs)',
                                                required: true,
                                                inputMode: 'decimal',
                                                pattern: '^\\d*(\\.\\d+)?$'
                                            },
                                            boxColOptions: { sx: { minWidth: 0 } }
                                        },
                                    ],
                                    boxRowOptions: {
                                        sx: {
                                            display: 'grid',
                                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                            gap: 2,
                                            mb: 2
                                        }
                                    },
                                },
                                {
                                    getField: () => (
                                        <Box
                                            sx={{
                                                display: 'grid',
                                                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
                                                gap: 2,
                                                mb: 2
                                            }}
                                        >
                                            <MUIInput
                                                formData={{}}
                                                AutocompleteProps={{
                                                    freeSolo: false,
                                                    options: currencyOptions,
                                                    groupBy: (option) => option.group || 'All Currencies',
                                                    noOptionsText: 'No currency found',
                                                    filterOptions: (options, state) => {
                                                        const input = (state.inputValue || '').trim().toLowerCase();
                                                        if (!input) return options;
                                                        return options
                                                            .filter(o => o.group === 'All Currencies')
                                                            .filter(o => o.label.toLowerCase().includes(input));
                                                    },
                                                    slotProps: {
                                                        popper: { sx: { minWidth: 320 } },
                                                    },
                                                    isOptionEqualToValue: (option, value) => {
                                                        if (!value) return false;
                                                        const valCode = typeof value === 'string' ? value : value?.value;
                                                        return option?.value === valCode;
                                                    },
                                                    getOptionLabel: (option) => {
                                                        if (!option) return '';
                                                        if (typeof option === 'string') {
                                                            const found = currencyOptions.find(c => c.value === option);
                                                            return found ? found.label : option;
                                                        }
                                                        return option?.label || '';
                                                    },
                                                    value: gState?.jobFormData?.salaryCurrency || null,
                                                    onChange: (_event, newValue) => {
                                                        const currencyVal =
                                                            typeof newValue === 'string'
                                                                ? newValue
                                                                : newValue?.value || '';
                                                        handleChangeExtended({
                                                            target: {
                                                                name: 'salaryCurrency',
                                                                value: currencyVal,
                                                            },
                                                        });
                                                    },
                                                }}
                                                AutocompleteInputProps={{
                                                    type: 'select',
                                                    name: 'salaryCurrency',
                                                    label: 'Currency',
                                                }}
                                            />
                                            <MUIInput
                                                formData={{ minSalary: '', maxSalary: '', ...(gState?.jobFormData || {}) }}
                                                AutocompleteInputProps={{
                                                    type: 'text',
                                                    name: 'minSalary',
                                                    label: 'Min Salary',
                                                    inputMode: 'decimal',
                                                    pattern: '^\\d*(\\.\\d+)?$',
                                                    onChange: handleChangeExtended,
                                                    InputLabelProps: {
                                                        shrink: Boolean(gState?.jobFormData?.minSalary != null && String(gState?.jobFormData?.minSalary).trim() !== ''),
                                                    },
                                                }}
                                            />
                                            <MUIInput
                                                formData={{ minSalary: '', maxSalary: '', ...(gState?.jobFormData || {}) }}
                                                AutocompleteInputProps={{
                                                    type: 'text',
                                                    name: 'maxSalary',
                                                    label: 'Max Salary',
                                                    inputMode: 'decimal',
                                                    pattern: '^\\d*(\\.\\d+)?$',
                                                    onChange: handleChangeExtended,
                                                    InputLabelProps: {
                                                        shrink: Boolean(gState?.jobFormData?.maxSalary != null && String(gState?.jobFormData?.maxSalary).trim() !== ''),
                                                    },
                                                }}
                                            />
                                        </Box>
                                    ),
                                },
                            ]
                            : []),
                        ...(activeStep === 0
                            ? [
                                {
                                    getField: getCollegeFields,
                                },
                            ]
                            : []),

                        ...(activeStep === 0
                            ? [
                                {
                                    getField: () => (
                                        <Box>
                                            <BooleanBuilder
                                                label="Enter 3 Primary Skills *"
                                                skills={
                                                    Array.isArray(gState?.jobFormData?.skills)
                                                        ? gState?.jobFormData?.skills
                                                        : Array.isArray(
                                                            gState?.jobFormData?.primarySkills
                                                        )
                                                            ? gState?.jobFormData?.primarySkills
                                                            : []
                                                }
                                                onChange={(skills) =>
                                                    setJobFormData((draft) => ({
                                                        ...draft,
                                                        skills: Array.isArray(skills)
                                                            ? skills
                                                            : typeof skills === 'string'
                                                                ? skills
                                                                    .split(/[;,]/)
                                                                    .map((s) => s.trim())
                                                                    .filter(Boolean)
                                                                : [],
                                                    }))
                                                }
                                                onAlert={({ message, severity }) =>
                                                    setJobFormData((prev = {}) => ({
                                                        ...prev,
                                                        alert: {
                                                            open: true,
                                                            message,
                                                            severity
                                                        }
                                                    }))
                                                }
                                                usedIn="NewJob"
                                            />
                                        </Box>
                                    ),
                                },
                            ]
                            : []),

                        ...(activeStep === 1
                            ? [
                                {
                                    AutocompleteInputProps: {
                                        type: 'text',
                                        name: 'description',
                                        label: 'Job Description',
                                        value: gState?.jobFormData?.description,
                                        multiline: true,
                                        required: true,
                                        rows: Math.max(
                                            4,
                                            parseInt(
                                                ((gState?.jobFormData?.description || '').split('\n')
                                                    .length) / 4
                                            )
                                        ),
                                        sx: { mb: 2 }
                                    }
                                },
                                {
                                    getField: () => (
                                        <MUIButton
                                            type="button"
                                            onClick={handleGenerateJD}
                                            sx={{ mb: 2 }}
                                        >
                                            Regenerate JD by AI
                                        </MUIButton>
                                    )
                                },
                                {
                                    AutocompleteInputProps: {
                                        type: 'text',
                                        name: 'notes',
                                        label: 'Recruiter Notes (private)',
                                        multiline: true,
                                        rows: 2,
                                        sx: { mb: 2 }
                                    }
                                },
                                {
                                    AutocompleteInputProps: {
                                        type: 'text',
                                        name: 'scriptName',
                                        label: 'Script Name',
                                        required: true,
                                        InputProps: { readOnly: true },
                                        sx: { mb: 2 }
                                    }
                                },
                                {
                                    AutocompleteProps: {
                                        options: scriptTypeOpts,
                                        getOptionLabel: (option) =>
                                        (typeof option === 'string'
                                            ? option
                                            : option?.label || ''),
                                        getOptionValue: (option) =>
                                        (typeof option === 'string'
                                            ? option
                                            : option?.value),
                                    },
                                    AutocompleteInputProps: {
                                        type: 'select',
                                        name: 'scriptType',
                                        label: 'Script Type',
                                        required: true,
                                        sx: { mb: 2 }
                                    }
                                },
                                {
                                    AutocompleteInputProps: {
                                        type: 'text',
                                        name: 'scriptExtra',
                                        label: 'Extra Question',
                                        sx: { mb: 2 }
                                    }
                                },
                                {
                                    AutocompleteInputProps: {
                                        type: 'text',
                                        name: 'scriptContent',
                                        label: 'Content',
                                        required: true,
                                        multiline: true,
                                        InputProps: { readOnly: true },
                                        rows: Math.max(
                                            4,
                                            parseInt(
                                                ((gState?.jobFormData?.scriptContent || '').split('\n')
                                                    .length) / 4
                                            )
                                        ),
                                        sx: { mb: 2 },
                                    },
                                },
                                {
                                    getField: () => (
                                        <MUIButton
                                            type="button"
                                            sx={{ mb: 2 }}
                                            onClick={handleGenerateScript}
                                        >
                                            Regenerate Script by AI
                                        </MUIButton>
                                    )
                                },
                                // {
                                //     getField: () => (
                                //         <MUIButton
                                //             type="button"
                                //             variant="outlined"
                                //             startIcon={<GraphicEqIcon />}
                                //             onClick={() => setOpenaiModalOpen(true)}
                                //             sx={{ mb: 2, ml: 1 }}
                                //         >
                                //             Open Script Designer (Premium)
                                //         </MUIButton>
                                //     )
                                // },
                                // {
                                //     type: 'row',
                                //     rowColFields: [
                                //         {
                                //             AutocompleteProps: {
                                //                 options: (languages || [])
                                //                     .map((item) => {
                                //                         if (typeof item === "string") {
                                //                             return { label: item, value: item };
                                //                         }
                                //                         if (item && typeof item === "object") {
                                //                             const label = item.label ?? item.value ?? "";
                                //                             const value = item.value ?? item.label ?? "";
                                //                             return { label, value };
                                //                         }
                                //                         return null;
                                //                     })
                                //                     .filter(Boolean)
                                //                     .sort((a, b) =>
                                //                         a.label
                                //                             .toLowerCase()
                                //                             .localeCompare(b.label.toLowerCase())
                                //                     )
                                //                     .map((o) => ({
                                //                         label: o.label.toUpperCase(),
                                //                         value: o.value,
                                //                     })),

                                //                 isOptionEqualToValue: (option, value) => {
                                //                     const optVal = option?.value;
                                //                     const val =
                                //                         typeof value === "string"
                                //                             ? value
                                //                             : value?.value ?? value?.label;
                                //                     return optVal === val;
                                //                 },

                                //                 getOptionLabel: (option) =>
                                //                     typeof option === "string"
                                //                         ? option
                                //                         : option?.label || "",

                                //                 getOptionValue: (option) =>
                                //                     typeof option === "string"
                                //                         ? option
                                //                         : option?.value,
                                //             },

                                //             AutocompleteInputProps: {
                                //                 type: "select",
                                //                 name: "scriptLang",
                                //                 label: "Language",
                                //                 required: true,
                                //             },
                                //         },
                                //         {
                                //             AutocompleteProps: {
                                //                 options: Array.from(
                                //                     new Set(
                                //                         (voiceModels || []).map((m) => m.gender)
                                //                     )
                                //                 ).map((v) => ({ label: v, value: v })),
                                //                 isOptionEqualToValue: (option, value) =>
                                //                 (typeof value === 'string'
                                //                     ? option.value === value
                                //                     : option?.value === value?.value),
                                //                 getOptionLabel: (option) =>
                                //                 (typeof option === 'string'
                                //                     ? option
                                //                     : option?.label || ''),
                                //                 getOptionValue: (option) =>
                                //                 (typeof option === 'string'
                                //                     ? option
                                //                     : option?.value),
                                //             },
                                //             AutocompleteInputProps: {
                                //                 type: 'select',
                                //                 name: 'scriptGender',
                                //                 label: 'Voice Gender',
                                //                 required: true
                                //             },
                                //         },
                                //     ],
                                //     boxRowOptions: {
                                //         sx: {
                                //             display: 'grid',
                                //             gridTemplateColumns: {
                                //                 xs: '1fr',
                                //                 sm: '1fr 1fr'
                                //             },
                                //             gap: 2,
                                //             mb: 2
                                //         }
                                //     },
                                // },
                                // {
                                //     AutocompleteProps: {
                                //         options: voicesFor(
                                //             gState?.jobFormData?.scriptLang,
                                //             gState?.jobFormData?.scriptGender
                                //         ).map((m) => ({ label: m.name, value: m.name })),
                                //         isOptionEqualToValue: (option, value) =>
                                //         (typeof value === 'string'
                                //             ? option.value === value
                                //             : option?.value === value?.value),
                                //         getOptionLabel: (option) =>
                                //         (typeof option === 'string'
                                //             ? option
                                //             : option?.label || ''),
                                //         getOptionValue: (option) =>
                                //         (typeof option === 'string'
                                //             ? option
                                //             : option?.value),
                                //     },
                                //     AutocompleteInputProps: {
                                //         type: 'select',
                                //         name: 'scriptVoice',
                                //         label: 'Voice Model',
                                //         required: true,
                                //         sx: { mb: 2 }
                                //     },
                                // },
                                // {
                                //     getField: () => (
                                //         <Box
                                //             sx={{
                                //                 display: 'flex',
                                //                 justifyContent: "center",
                                //                 gap: 1,
                                //                 mb: 2
                                //             }}
                                //         >
                                //             <MUIButton
                                //                 variant="outlined"
                                //                 onClick={() =>
                                //                     previewVoice({
                                //                         text: gState?.jobFormData?.scriptContent
                                //                             ?.slice?.(0, 200),
                                //                         languageCode:
                                //                             gState?.jobFormData?.scriptLang,
                                //                         voiceName:
                                //                             gState?.jobFormData?.scriptVoice,
                                //                         ssmlGender:
                                //                             gState?.jobFormData?.scriptGender,

                                //                         scriptLang:
                                //                             gState?.jobFormData?.scriptLang,
                                //                         scriptGender:
                                //                             gState?.jobFormData?.scriptGender,
                                //                         scriptVoice:
                                //                             gState?.jobFormData?.scriptVoice,
                                //                         setGState: setUiState,
                                //                     })
                                //                 }
                                //                 sx={{
                                //                     border: "none",
                                //                     borderBottom: 1,
                                //                 }}
                                //                 disabled={
                                //                     isPlaying ||
                                //                     !gState?.jobFormData?.scriptVoice
                                //                 }
                                //             >
                                //                 Preview Voice
                                //             </MUIButton>
                                //             <MUIButton
                                //                 variant="text"
                                //                 onClick={pauseVoice}
                                //                 sx={{
                                //                     border: "none",
                                //                     borderBottom: 1,
                                //                     borderRadius: 1,
                                //                     py: 1
                                //                 }}
                                //                 disabled={!isPlaying}
                                //             >
                                //                 Stop
                                //             </MUIButton>
                                //         </Box>
                                //     ),
                                // },
                                {
                                    getField: () => (
                                        <Box sx={{ mt: 2, mb: 4, display: 'flex', justifyContent: 'center' }}>
                                            <MUIButton
                                                variant="outlined"
                                                onClick={() => setOpenaiModalOpen(true)}
                                                startIcon={<GraphicEqIcon />}
                                                sx={{
                                                    height: 54,
                                                    px: 4,
                                                    borderRadius: 3,
                                                    borderWidth: 2,
                                                    fontWeight: 800,
                                                    letterSpacing: 1,
                                                    borderColor: theme.palette.primary.main,
                                                    color: theme.palette.primary.main,
                                                    '&:hover': {
                                                        borderWidth: 2,
                                                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                                                        borderColor: theme.palette.primary.dark
                                                    }
                                                }}
                                            >
                                                {gState?.jobFormData?.openaiVoice ? `CONFIGURED: ${gState?.jobFormData?.openaiVoice?.toUpperCase()}` : 'PREVIEW VOICE MODEL'}
                                            </MUIButton>
                                        </Box>
                                    ),
                                },
                            ]
                            : []),
                        {
                            type: 'row',
                            rowColFields: [
                                {
                                    type: "button",
                                    label: activeStep === 0 ? "Cancel" : "Back",
                                    onClick: onCancelOrBack,
                                    variant: "outlined",
                                    sx: { px: 2 },
                                },
                                {
                                    type: "submit",
                                    label: activeStep < steps.length - 1 ? "Next" : "Save",
                                    id: "id_job_form_submit",
                                    variant: "contained",
                                    boxColOptions: {
                                        sx: {
                                            width: "100%",
                                            display: "flex",
                                            justifyContent: "flex-end"
                                        }
                                    },
                                    sx: {
                                        px: 2.5,
                                        color: theme.palette.primary.contrastText,
                                        backgroundColor: theme.palette.primary.main,
                                        '&:hover': { backgroundColor: theme.palette.primary.dark },
                                    },
                                },
                            ],
                            boxRowOptions: {
                                sx: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 1.5,
                                    mx: { xs: -2, sm: -3, md: -3 },
                                    px: { xs: 2, sm: 3 },
                                    py: { xs: 2, sm: 3 },
                                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                                    background: alpha(theme.palette.background.paper, 0.9),
                                },
                            },
                            fieldBoxOptions: { sx: { mb: 0 } },
                        }

                    ]}
                />

                <MUIAlert
                    open={Boolean(gState?.jobFormData?.alert?.open)}
                    message={gState?.jobFormData?.alert?.message}
                    severity={gState?.jobFormData?.alert?.severity || 'info'}
                    onClose={(_, reason) => {
                        (reason !== 'clickaway') &&
                            setJobFormData((prev = {}) => ({
                                ...prev,
                                alert: { ...(prev?.alert || {}), open: false }
                            }))
                    }}
                />
                <OpenAIFM_UI
                    open={openaiModalOpen}
                    onClose={() => setOpenaiModalOpen(false)}
                    initialVoice={gState?.jobFormData?.openaiVoice}
                    initialInstructions={gState?.jobFormData?.openaiInstructions}
                    initialScript={gState?.jobFormData?.scriptContent}
                    onConfirm={(config) => {
                        setJobFormData(prev => ({
                            ...prev,
                            openaiVoice: config.voice,
                            openaiInstructions: config.instructions,
                            openaiVibeId: config.vibeId,
                            scriptContent: config.script
                        }));
                    }}
                />
            </Box >
        </>
    );
};

export default NewJob;
