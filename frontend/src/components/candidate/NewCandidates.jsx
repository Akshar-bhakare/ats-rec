// frontend\src\components\candidate\NewCandidates.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Typography, IconButton, Chip } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCandidateContextState } from '../../contexts/CandidateContext';
import { useUiContextState } from '../../contexts/UiContext';
import MUICreateForm from '../MUI/CommonCRUD/MUICreateForm';
import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import { fetchData } from '../../AppUtils/dataAPI';
import MUIAlert from '../MUI/commonUI/MUIAlert';
import MUIButton from '../MUI/commonUI/MUIButton';
import MUIInput from '../MUI/commonUI/MUIInput';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import countryList from '../../assets/CountryCodes.json';

const isDuplicateErrMsg = (msg = '') => /already exists|already applied/i.test(String(msg));
const getCandidateId = (cand) => String(cand?._id || cand?.id || '');
const normalizeText = (val = '') => String(val || '').trim().toLowerCase();
const parseCandidateList = (res) => (Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []));
const openInNewTab = (path) => {
    if (typeof window === 'undefined') return;
    window.open(path, '_blank', 'noopener,noreferrer');
};
const dedupeCandidates = (items = []) => {
    const map = new Map();
    items.forEach((item) => {
        const id = getCandidateId(item);
        if (!id || map.has(id)) return;
        map.set(id, item);
    });
    return Array.from(map.values());
};

export const NewCandidates = () => {
    const [candidateState, setCandidateState] = useCandidateContextState();
    const [, setUiState] = useUiContextState();
    const location = useLocation();
    const preselectJobId = location.state?.preselectJobId || '';
    const preselectStageId = location.state?.preselectStageId || '';
    const [activeStep, setActiveStep] = useState(0);
    const [allJobs, setAllJobs] = useState([]);
    const [alertCfg, setAlertCfg] = useState({ open: false, message: '', severity: 'info' });
    const navigate = useNavigate();
    const [selectedResumes, setSelectedResumes] = useState([]);
    const [jobError, setJobError] = useState('');
    const [duplicateLookupByIndex, setDuplicateLookupByIndex] = useState({});
    const ACCEPTED_FILE_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const handleResumeSelection = useCallback(
        (payload) => {
            const files = Array.isArray(payload) ? payload : Array.from(payload?.target?.files || []);
            setSelectedResumes(files);
        },
        []
    );

    const removeResumeAt = useCallback((idx) => {
        setSelectedResumes(prev => prev.filter((_, i) => i !== idx));
    }, []);

    /* ───────── fetch jobs once ───────── */
    useEffect(() => {

        setUiState({
            loadingMsg: "Loading, Please wait..."
        });

        fetchData('/api/jobs/?resolveCompanies=true')
            .then(list => list && setAllJobs(list))
            .catch(err => console.error('Error fetching jobs for upload candidates:', err))
            .finally(() => {

                setUiState({
                    loadingMsg: null,
                });

            });
        return () => setAllJobs(null);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setCandidateState({ candidateInitialValuesDict: null });
        setActiveStep(0);
        setSelectedResumes([]);
        setJobError('');
        setDuplicateLookupByIndex({});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const jobOptions = useMemo(
        () => (allJobs || []).map(j => ({
            label: j.title ? `${j.title} - ${j?.company?.name || ''}` : 'Job',
            value: j._id
        })),
        [allJobs]
    );

    const defaultJobId = useMemo(
        () => jobOptions.find(o => o.value === preselectJobId)?.value || '',
        [jobOptions, preselectJobId]
    );

    const multipleSubmitUrl = useMemo(() => {
        if (!preselectStageId) return '/api/candidates/multiple/';
        const params = new URLSearchParams({ targetStageId: String(preselectStageId) });
        return `/api/candidates/multiple/?${params.toString()}`;
    }, [preselectStageId]);


    const candidateIndexes = useMemo(() => {
        if (!candidateState?.candidateInitialValuesDict) return [];
        return Object.keys(candidateState.candidateInitialValuesDict)
            .filter(k => k.includes('email of Candidate'))
            .map(k => {
                const match = k.match(/Candidate\s+(\d+)/);
                return match ? Number(match[1]) : null;
            })
            .filter((v) => Number.isFinite(v))
            .sort((a, b) => a - b);
    }, [candidateState?.candidateInitialValuesDict]);

    const removeCandidateAt = useCallback((idx) => {
        const cur = candidateState?.candidateInitialValuesDict || {};
        const nd = {};

        const emailKeys = Object.keys(cur)
            .filter(k => k.includes('email of Candidate'));

        emailKeys.forEach((__, secIdx) => {
            if (secIdx === idx) return;

            const dst = secIdx > idx ? secIdx - 1 : secIdx;

            const baseKeys = [
                'firstName',
                'lastName',
                'email',
                'countryCode',
                'phoneNumber',
                'skills',
                'resumeUrl',
                'resumeText'
            ];

            baseKeys.forEach(key => {
                const srcKey = `${key} of Candidate ${secIdx}`;
                if (srcKey in cur) {
                    nd[`${key} of Candidate ${dst}`] = cur[srcKey];
                }
            });

            const approvedSrc = `Approved Candidate ${secIdx}`;
            if (approvedSrc in cur) {
                nd[`Approved Candidate ${dst}`] = cur[approvedSrc];
            }

            const errorSrc = `error ${secIdx}`;
            if (errorSrc in cur) {
                nd[`error ${dst}`] = cur[errorSrc];
            }
        });

        const globalFields = {};
        ['jobId', 'approveAllCandidates', 'validated'].forEach(k => {
            if (k in cur) globalFields[k] = cur[k];
        });

        const isValidNd = nd && Object.keys(nd)?.length > 0;
        const finalDict = isValidNd ? { ...globalFields, ...nd } : null;

        setCandidateState({ candidateInitialValuesDict: finalDict });
        setDuplicateLookupByIndex((prev) => {
            const next = {};
            Object.entries(prev || {}).forEach(([rawIndex, value]) => {
                const secIdx = Number(rawIndex);
                if (!Number.isFinite(secIdx) || secIdx === idx) return;
                const dst = secIdx > idx ? secIdx - 1 : secIdx;
                next[dst] = value;
            });
            return next;
        });

        if (!isValidNd) {
            setActiveStep(0);
        }
    }, [candidateState?.candidateInitialValuesDict, setCandidateState]);

    useEffect(() => {
        if (candidateState?.candidateWsSubmit) {
            try {
                const formEl = document.querySelector('form');
                if (formEl?.requestSubmit) formEl.requestSubmit();
                else if (formEl) formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            } finally {
                setCandidateState({ candidateWsSubmit: false });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [candidateState?.candidateWsSubmit]);

    useEffect(() => {
        if (activeStep === 1 && defaultJobId) {
            const cur = candidateState?.candidateInitialValuesDict || {};
            if (!cur.jobId) {
                setCandidateState({ candidateInitialValuesDict: { ...cur, jobId: defaultJobId } });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeStep, defaultJobId]);

    const handleAlertClose = (_e, reason) => {
        if (reason === 'clickaway') return;
        setAlertCfg(a => ({ ...a, open: false }));
        if (alertCfg.severity === 'success') {
            navigate(-1);
            setCandidateState({ candidateInitialValuesDict: null });
        }
    };

    const firstErr = d => (d ? Object.entries(d).find(([k]) => k.startsWith('error'))?.[1] || '' : '');
    const resolveDuplicateCandidates = useCallback(async (sourceData = {}) => {
        const duplicateErrors = Object.entries(sourceData || {}).filter(
            ([k, v]) => k.startsWith('error ') && isDuplicateErrMsg(v)
        );
        if (!duplicateErrors.length) {
            setDuplicateLookupByIndex({});
            return;
        }

        const emailCache = new Map();
        const phoneCache = new Map();

        const fetchByField = async (field, value, cache) => {
            const cleaned = field === 'email'
                ? normalizeText(value)
                : String(value || '').trim();
            if (!cleaned) return [];
            if (cache.has(cleaned)) return cache.get(cleaned);

            const params = new URLSearchParams({
                page: '1',
                pageSize: '50',
                filterField: field,
                filterValue: cleaned,
            });

            const promise = fetchData(`/api/candidates/?${params.toString()}`)
                .then(parseCandidateList)
                .catch((err) => {
                    console.error(`[NewCandidates] Duplicate lookup failed for ${field}:`, err);
                    return [];
                });

            cache.set(cleaned, promise);
            return promise;
        };

        const entries = await Promise.all(duplicateErrors.map(async ([k, errorMessage]) => {
            const m = k.match(/error\s+(\d+)/i);
            const index = m ? Number(m[1]) : null;
            if (!Number.isFinite(index)) return null;

            const email = normalizeText(sourceData[`email of Candidate ${index}`]);
            const phoneNumber = String(sourceData[`phoneNumber of Candidate ${index}`] || '').trim();

            const [byEmail, byPhone] = await Promise.all([
                fetchByField('email', email, emailCache),
                fetchByField('phoneNumber', phoneNumber, phoneCache),
            ]);

            return [
                index,
                {
                    errorMessage: String(errorMessage || ''),
                    email,
                    phoneNumber,
                    matches: dedupeCandidates([...(byEmail || []), ...(byPhone || [])]),
                }
            ];
        }));

        setDuplicateLookupByIndex(Object.fromEntries(entries.filter(Boolean)));
    }, []);

    const openDuplicateCandidate = useCallback((candidateId) => {
        if (!candidateId) return;
        openInNewTab(`/candidates/${candidateId}/`);
    }, []);

    const MAX_RESUME_SIZE_BYTES = 25 * 1024 * 1024;

    useEffect(() => {
        if (candidateState?.candidateInitialValuesDict && activeStep === 1) {
            const cur = candidateState.candidateInitialValuesDict;

            const approvalKeys = Object.keys(cur).filter(k =>
                k.includes('Approved Candidate')
            );

            if (approvalKeys.length > 0) {
                const allApproved = approvalKeys.every(k => cur[k] === true);

                if (cur.approveAllCandidates !== allApproved) {
                    setCandidateState({
                        candidateInitialValuesDict: {
                            ...cur,
                            approveAllCandidates: allApproved
                        }
                    });
                }
            }
        }
    }, [candidateState?.candidateInitialValuesDict, activeStep, setCandidateState]);

    const formatFileSize = (file) => {
        if (!file?.size) return '';
        const kb = Math.round(file.size / 1024);
        if (kb < 1024) return `${kb} KB`;
        return `${(kb / 1024).toFixed(1)} MB`;
    };

    const jobSelectField = {
        AutocompleteProps: {
            options: jobOptions,
            isOptionEqualToValue: (opt, val) =>
                (typeof val === 'string' ? opt.value === val : opt.value === val.value),
            getOptionLabel: opt =>
                typeof opt === 'string'
                    ? jobOptions.find(o => o.value === opt)?.label || ''
                    : opt.label || '',
            getOptionValue: opt => (typeof opt === 'string' ? opt : opt.value)
        },
        AutocompleteInputProps: {
            name: 'jobId',
            type: 'select',
            label: 'Job Role',
            required: true,
            error: Boolean(jobError),
            helperText: jobError || '',
            sx: { mb: 1 }
        }
    };

    const countryOptions = useMemo(
        () => (countryList || []).map((c) => ({
            label: `${c.dial_code} ${c.name}`,
            value: c.dial_code,
            name: c.name,
            code: c.code,
        })),
        []
    );

    const phoneRuleForCountry = (countryCode) => {
        const code = String(countryCode || '').trim();
        if (code === '+91') {
            return { pattern: '^[0-9]{10}$', helper: '10-digit number' };
        }
        if (code === '+1') {
            return { pattern: '^[0-9]{10}$', helper: '10-digit number' };
        }
        return { pattern: '^[0-9]{6,15}$', helper: '6–15 digits' };
    };

    useEffect(() => {
        if (activeStep !== 1 || !candidateState?.candidateInitialValuesDict) return;
        const cur = candidateState.candidateInitialValuesDict;
        let changed = false;
        const next = { ...cur };
        candidateIndexes.forEach((index) => {
            const key = `countryCode of Candidate ${index}`;
            if (!next[key]) {
                next[key] = '+91';
                changed = true;
            }
        });
        if (changed) {
            setCandidateState({ candidateInitialValuesDict: next });
        }
    }, [activeStep, candidateIndexes, candidateState?.candidateInitialValuesDict, setCandidateState]);

    const fields = useMemo(() => {
        const headerField = {
            getField: () => (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Add Candidates
                    </Typography>
                    <IconButton
                        onClick={() => {
                            setCandidateState({ candidateInitialValuesDict: null });
                            navigate(-1);
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
            )
        };

        const stepHeader = activeStep === 0
            ? {
                getField: () => (
                    <Box sx={{ textAlign: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                            <Box
                                sx={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: '50%',
                                    bgcolor: '#6366f1',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                }}
                            >
                                1
                            </Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                Upload CVs / Resumes
                            </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ color: '#6b7280' }}>
                            Bulk upload CVs (max 50) and specify the job role. We&apos;ll parse the resumes using AI to
                            extract candidate information. You can approve and validate the details in the next step.
                        </Typography>
                    </Box>
                )
            }
            : {
                getField: () => (
                    <Box sx={{ textAlign: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                            <Box
                                sx={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: '50%',
                                    bgcolor: '#6366f1',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                }}
                            >
                                2
                            </Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                Approve &amp; Validate
                            </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ color: '#6b7280' }}>
                            Review and approve the extracted candidate information before adding them to the job. Ensure
                            accuracy and completeness.
                        </Typography>
                    </Box>
                )
            };

        const uploadField = {
            name: 'resumes',
            label: 'Upload or drop CV files here (PDF,DOCX)',
            type: 'file',
            files: selectedResumes,
            maxFiles: 50,
            acceptedTypes: ACCEPTED_FILE_TYPES,
            onChange: handleResumeSelection,
            sx: {
                borderRadius: 2,
                borderColor: '#c7c2ff',
                bgcolor: '#f6f3ff',
                py: 3,
                px: 2,
            },
            renderContent: ({ open }) => (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1.5,
                        textAlign: 'center',
                    }}
                >
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <Box
                            sx={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                bgcolor: '#ede9fe',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <UploadFileIcon sx={{ color: '#6366f1' }} />
                        </Box>
                        <Box>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                Upload or drop CV files here (PDF,DOCX)
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#6b7280' }}>
                                Max file size 25MB per CV | Max 50 CVs / upload | Supported file types: PDF, DOCX
                            </Typography>
                        </Box>
                    </Box>
                    <MUIButton
                        variant="outlined"
                        onClick={(event) => {
                            event.stopPropagation();
                            open();
                        }}
                    >
                        Browse Files
                    </MUIButton>
                </Box>
            )
        };

        const uploadListField = {
            getField: () => (
                selectedResumes.length ? (
                    <Box
                        sx={{
                            border: '1px solid #e4ddff',
                            borderRadius: 2,
                            bgcolor: '#f6f3ff',
                            overflow: 'hidden',
                        }}
                    >
                        {selectedResumes.map((file, idx) => (
                            <Box
                                key={`${file.name}-${idx}`}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    px: 2,
                                    py: 1.2,
                                    borderBottom: idx === selectedResumes.length - 1 ? 'none' : '1px solid #e4ddff',
                                }}
                            >
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {file.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                                        {formatFileSize(file)}
                                    </Typography>
                                </Box>
                                <IconButton size="small" onClick={() => removeResumeAt(idx)}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>
                ) : null
            )
        };

        const stepFooter = activeStep === 0
            ? {
                getField: () => (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                        <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            Step 1: Upload Resume &nbsp;|&nbsp; Step 2: Approve &amp; Validate
                        </Typography>
                        <MUIButton
                            type="submit"
                            variant="contained"
                            sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
                        >
                            Next
                        </MUIButton>
                    </Box>
                )
            }
            : {
                getField: () => (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                        <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            Step 1: Upload Resume &nbsp;|&nbsp; Step 2: Approve &amp; Validate
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.5 }}>
                            <MUIButton
                                variant="outlined"
                                type="button"
                                onClick={() => setActiveStep(0)}
                            >
                                Previous
                            </MUIButton>
                            <MUIButton
                                type="submit"
                                variant="contained"
                                sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
                            >
                                Add Candidates ({candidateIndexes.length})
                            </MUIButton>
                        </Box>
                    </Box>
                )
            };

        const approveListField = {
            getField: (formData, onFieldChange) => {
                const duplicateIndexes = candidateIndexes.filter(
                    (idx) => isDuplicateErrMsg(formData?.[`error ${idx}`])
                );
                const duplicateErrorCount = duplicateIndexes.length;
                const duplicateCandidateIds = Array.from(
                    new Set(
                        duplicateIndexes.flatMap((idx) =>
                            (duplicateLookupByIndex[idx]?.matches || [])
                                .map((cand) => getCandidateId(cand))
                                .filter(Boolean)
                        )
                    )
                );

                const openAllDuplicatesInTalentPool = () => {
                    const params = new URLSearchParams();
                    params.set('viewMode', 'all');
                    if (duplicateCandidateIds.length) {
                        params.set('ids', duplicateCandidateIds.join(','));
                    }
                    const query = params.toString();
                    openInNewTab(`/candidates/${query ? `?${query}` : ''}`);
                };

                return (
                    <Box
                        sx={{
                            border: '1px solid #e4ddff',
                            borderRadius: 2,
                            overflow: 'hidden',
                            bgcolor: '#f6f3ff',
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                px: 2,
                                py: 1.2,
                                bgcolor: '#ede9fe',
                                borderBottom: '1px solid #e4ddff',
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                Name &amp; Contact Info
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {Boolean(duplicateErrorCount) && <MUIButton
                                    size="small"
                                    variant="outlined"
                                    onClick={openAllDuplicatesInTalentPool}
                                    disabled={!duplicateErrorCount}
                                >
                                    Show all duplicates in Talent Pool
                                </MUIButton>}
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                    Approver
                                </Typography>
                                <MUIButton
                                    size="small"
                                    variant="outlined"
                                    onClick={() => {
                                        const allApproved = candidateIndexes.length > 0
                                            && candidateIndexes.every((idx) => Boolean(formData[`Approved Candidate ${idx}`]));
                                        const nextChecked = !allApproved;
                                        candidateIndexes.forEach((idx) => {
                                            onFieldChange({
                                                target: {
                                                    name: `Approved Candidate ${idx}`,
                                                    type: 'checkbox',
                                                    checked: nextChecked
                                                }
                                            });
                                        });
                                    }}
                                    disabled={!candidateIndexes.length}
                                >
                                    {candidateIndexes.length > 0
                                        && candidateIndexes.every((idx) => Boolean(formData[`Approved Candidate ${idx}`]))
                                        ? 'Unapprove All'
                                        : 'Approve All'}
                                </MUIButton>
                            </Box>
                        </Box>
                        {candidateIndexes.map((index) => {
                            const approvedKey = `Approved Candidate ${index}`;
                            const approved = Boolean(formData[approvedKey]);
                            const errorMsg = formData[`error ${index}`];
                            const duplicateLookup = duplicateLookupByIndex[index];
                            const duplicateMatches = duplicateLookup?.matches || [];
                            const singleDuplicateId = duplicateMatches.length === 1
                                ? getCandidateId(duplicateMatches[0])
                                : '';
                            return (
                                <Box
                                    key={`candidate-${index}`}
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        gap: 2,
                                        px: 2,
                                        py: 1.5,
                                        borderBottom: index === candidateIndexes.length - 1 ? 'none' : '1px solid #e4ddff',
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 240,
                                            display: 'grid',
                                            gridTemplateColumns: '1fr auto',
                                            columnGap: 2,
                                            rowGap: 1,
                                            alignItems: 'start',
                                        }}
                                    >
                                        {errorMsg ? (
                                            <Box
                                                sx={{
                                                    gridColumn: '1 / -1',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <Typography
                                                    variant="caption"
                                                    sx={{ color: '#f59e0b' }}
                                                >
                                                    {errorMsg}
                                                </Typography>

                                                {singleDuplicateId ? (
                                                    <MUIButton
                                                        size="small"
                                                        variant="text"
                                                        onClick={() => openDuplicateCandidate(singleDuplicateId)}
                                                    >
                                                        View Candidate Details
                                                    </MUIButton>
                                                ) : null}
                                            </Box>
                                        ) : null}
                                        <Box
                                            sx={{
                                                display: 'grid',
                                                gridTemplateColumns: {
                                                    xs: 'repeat(auto-fit, minmax(140px, 1fr))',
                                                    md: '1.2fr 1.2fr 1fr 1.2fr 1.6fr 1.4fr',
                                                },
                                                gap: 1,
                                                alignItems: 'flex-start',
                                            }}
                                        >
                                            <MUIInput
                                                formData={formData}
                                                AutocompleteInputProps={{
                                                    name: `firstName of Candidate ${index}`,
                                                    label: 'First Name',
                                                    size: 'small',
                                                    onChange: onFieldChange,
                                                }}
                                                sx={{ minWidth: 120 }}
                                            />
                                            <MUIInput
                                                formData={formData}
                                                AutocompleteInputProps={{
                                                    name: `lastName of Candidate ${index}`,
                                                    label: 'Last Name',
                                                    size: 'small',
                                                    onChange: onFieldChange,
                                                }}
                                                sx={{ minWidth: 120 }}
                                            />
                                            <MUIInput
                                                formData={formData}
                                                AutocompleteProps={{
                                                    freeSolo: false,
                                                    options: countryOptions,
                                                    value:
                                                        countryOptions.find(
                                                            (opt) =>
                                                                opt.value ===
                                                                (formData[`countryCode of Candidate ${index}`] || '+91')
                                                        ) ||
                                                        countryOptions.find((opt) => opt.value === '+91') ||
                                                        null,
                                                    isOptionEqualToValue: (opt, val) => opt.value === val.value,
                                                    onChange: (_event, val) => {
                                                        onFieldChange({
                                                            target: {
                                                                name: `countryCode of Candidate ${index}`,
                                                                value: val?.value || '',
                                                            },
                                                        });
                                                    },
                                                }}
                                                AutocompleteInputProps={{
                                                    name: `countryCode of Candidate ${index}`,
                                                    label: 'Country Code',
                                                    size: 'small',
                                                }}
                                                sx={{ minWidth: 120 }}
                                            />
                                            <MUIInput
                                                formData={formData}
                                                AutocompleteInputProps={{
                                                    name: `phoneNumber of Candidate ${index}`,
                                                    label: 'Number',
                                                    size: 'small',
                                                    onChange: onFieldChange,
                                                    inputProps: {
                                                        inputMode: 'numeric',
                                                        pattern: phoneRuleForCountry(
                                                            formData[`countryCode of Candidate ${index}`] || '+91'
                                                        ).pattern,
                                                    },
                                                    helperText: phoneRuleForCountry(
                                                        formData[`countryCode of Candidate ${index}`] || '+91'
                                                    ).helper,
                                                }}
                                                sx={{
                                                    minWidth: 140,
                                                    '& .MuiFormHelperText-root': {
                                                        marginLeft: 0,
                                                        marginRight: 0,
                                                        minHeight: '1em',
                                                    },
                                                }}
                                            />
                                            <MUIInput
                                                formData={formData}
                                                AutocompleteInputProps={{
                                                    name: `email of Candidate ${index}`,
                                                    label: 'Email',
                                                    size: 'small',
                                                    onChange: onFieldChange,
                                                }}
                                                sx={{ minWidth: 180 }}
                                            />
                                            <MUIInput
                                                formData={formData}
                                                AutocompleteInputProps={{
                                                    name: `skills of Candidate ${index}`,
                                                    label: 'Skills',
                                                    size: 'small',
                                                    onChange: onFieldChange,
                                                }}
                                                sx={{ minWidth: 160 }}
                                            />
                                        </Box>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                                justifySelf: 'end',
                                                alignSelf: 'start',
                                                mt: 0.6,
                                            }}
                                        >
                                            <MUIButton
                                                variant={approved ? 'contained' : 'outlined'}
                                                onClick={() => onFieldChange({
                                                    target: { name: approvedKey, type: 'checkbox', checked: !approved }
                                                })}
                                                sx={approved ? { bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } } : {}}
                                            >
                                                {approved ? 'Approved' : 'Approve'}
                                            </MUIButton>
                                            <IconButton size="small" onClick={() => removeCandidateAt(index)}>
                                                <CloseIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                        {formData?.validated === 'successful' && (
                                            <Chip
                                                label="Validated"
                                                size="small"
                                                sx={{
                                                    bgcolor: '#e0f2fe',
                                                    color: '#0284c7',
                                                    width: 'fit-content',
                                                    gridColumn: '1 / -1',
                                                }}
                                            />
                                        )}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                );
            }
        };

        if (activeStep === 0) {
            return [
                headerField,
                stepHeader,
                uploadField,
                uploadListField,
                stepFooter,
            ];
        }

        return [
            headerField,
            stepHeader,
            {
                getField: () => (
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: 2,
                            bgcolor: '#fef3c7',
                            border: '1px dashed #fcd34d',
                        }}
                    >
                        <Typography variant="body2" sx={{ color: '#92400e' }}>
                            Please carefully review the extracted information. Edit inaccurate details and click
                            &quot;Approve&quot; to add candidates.
                        </Typography>
                    </Box>
                )
            },
            jobSelectField,
            approveListField,
            stepFooter,
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        activeStep,
        jobError,
        jobOptions,
        handleResumeSelection,
        selectedResumes,
        removeResumeAt,
        candidateIndexes,
        navigate,
        removeCandidateAt,
        setCandidateState,
        duplicateLookupByIndex,
        openDuplicateCandidate,
    ]);

    return (
        <>
            <MUICenterLayout>
                <MUIAlert {...alertCfg} onClose={handleAlertClose} />

                <MUICreateForm
                    key={JSON.stringify(candidateState?.candidateInitialValuesDict) + activeStep}
                    initialValuesDict={candidateState?.candidateInitialValuesDict || {}}
                    formCardOptions={{
                        sx: {
                            my: 5,
                            minWidth: 'min(900px, 92vw)',
                            maxWidth: '92vw',
                            borderRadius: 3,
                            position: 'relative',
                            background: 'linear-gradient(180deg, #f4f2ff 0%, #f6f3ff 100%)',
                            boxShadow: '0 18px 40px rgba(67, 56, 202, 0.18)',
                        }
                    }}
                    formBoxOptions={{
                        sx: { p: 3 }
                    }}
                    fields={fields}
                    submitUrl={activeStep === 1 ? multipleSubmitUrl : '/api/candidates/upload/'}
                    onChangeExtended={(ev) => {
                        if (ev?.target?.name === 'jobId') {
                            setJobError('');
                        }
                    }}
                    onBeforeSubmit={({ formData }) => {
                        if (activeStep === 0) {
                            const files = selectedResumes.length
                                ? selectedResumes
                                : Array.from(formData?.resumes || []);
                            if (!files.length) {
                                setAlertCfg({
                                    open: true,
                                    severity: 'warning',
                                    message: 'Please select one or more resume files before continuing.',
                                });
                                return false;
                            }
                            const oversized = files.find((file) => file?.size > MAX_RESUME_SIZE_BYTES);
                            if (oversized) {
                                setAlertCfg({
                                    open: true,
                                    severity: 'warning',
                                    message: `${oversized.name} exceeds 25 MB. Please upload files under 25 MB.`,
                                });
                                return false;
                            }
                        }
                        if (activeStep === 1 && !formData?.jobId) {
                            const msg = 'Please select a Job Role before adding candidates.';
                            setJobError('Please select a Job Role.');
                            setAlertCfg({ open: true, message: msg, severity: 'warning' });
                            return false;
                        }
                        return true;
                    }}
                    onSubmitExtended={async (ev, data, formData) => {
                        ev?.preventDefault?.();
                        let candidateInitialValues = null;
                        if (data && Object.keys(data).length > 0) {
                            const hasJobId = Object.prototype.hasOwnProperty.call(formData || {}, 'jobId');
                            const jobId = hasJobId
                                ? (formData?.jobId || '')
                                : (candidateState?.candidateInitialValuesDict?.jobId || '');
                            const nextData = { ...data };
                            if (hasJobId && !jobId) delete nextData.jobId;
                            candidateInitialValues = jobId ? { ...nextData, jobId } : nextData;
                            setCandidateState({
                                candidateInitialValuesDict: candidateInitialValues
                            });
                        }

                        if (activeStep === 0) {
                            setDuplicateLookupByIndex({});
                            setActiveStep(1);
                            return;
                        }

                        const fatalMsg = data?.error || firstErr(data);
                        const isSuccess = !fatalMsg;

                        if (isSuccess) {
                            setAlertCfg({ open: true, message: 'Candidate(s) added successfully', severity: 'success' });
                            setDuplicateLookupByIndex({});

                            setCandidateState({
                                candidateInitialValuesDict: null,
                                candidateListRows: null
                            });

                            navigate(-1);
                        } else {
                            setAlertCfg({ open: true, message: fatalMsg || 'Validation failed', severity: 'warning' });
                            await resolveDuplicateCandidates(candidateInitialValues || data || {});
                        }

                    }}
                    onError={err =>
                        setAlertCfg({
                            open: true,
                            message: err?.message?.replace(/^Error:\s*/, '') || 'Something went wrong',
                            severity: 'error'
                        })
                    }
                />
            </MUICenterLayout>
        </>
    );
};

export default NewCandidates;
