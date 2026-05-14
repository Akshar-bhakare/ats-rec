import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Divider,
    CircularProgress,
    Tooltip,
    Tabs,
    Tab,
    IconButton,
    LinearProgress,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { fetchData } from '../../AppUtils/dataAPI';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import MUIButton from '../MUI/commonUI/MUIButton';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useJobContextState } from '../../contexts/JobContext';
import { useUiContextState } from '../../contexts/UiContext';
import { Call, RefreshRounded, WhatsApp, ArrowBackIos, Edit, Archive } from '@mui/icons-material';
import MUIModal from '../MUI/commonUI/MUIModal';
import MUIInput from '../MUI/commonUI/MUIInput';
import { getLongDateTimeStr } from '../../AppUtils/dateFormatters';
import JobShareLinkModal from '../jobShare/ShareCvLinkModal';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import CandidateFlowSection from './CandidateFlowSection';
import { setDocumentTitle } from '../../AppUtils/documentTitle';



function TabPanel({ children, value, index }) {
    return (
        <div role="tabpanel" hidden={value !== index}>
            {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
        </div>
    );
}

function PipelineActionsMenu({
    row,
    onChangeSchedule,
    onCall,
    onWhatsApp,
    onTrack,
}) {
    const [anchorEl, setAnchorEl] = useState(null);
    const menuOpen = Boolean(anchorEl);

    const handleOpen = (event) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };

    const handleClose = (event) => {
        if (event?.stopPropagation) event.stopPropagation();
        setAnchorEl(null);
    };

    return (
        <>
            <IconButton
                size="small"
                onClick={handleOpen}
                aria-label="candidate actions"
                sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                }}
            >
                <MoreHorizRoundedIcon fontSize="small" />
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        minWidth: 200,
                    },
                }}
            >
                {row?.scheduleTime !== "N/A" && (
                    <MenuItem
                        onClick={(event) => {
                            handleClose(event);
                            onChangeSchedule?.();
                        }}
                    >
                        <ListItemText primary="Change Schedule" />
                    </MenuItem>
                )}
                <MenuItem
                    onClick={(event) => {
                        handleClose(event);
                        onCall?.();
                    }}
                >
                    <ListItemIcon>
                        <Call fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                        primary={`AI Call${row?.aiCallStatus === 'pending' ? '' : ' Again'}`}
                    />
                </MenuItem>
                <MenuItem
                    onClick={(event) => {
                        handleClose(event);
                        onWhatsApp?.();
                    }}
                >
                    <ListItemIcon>
                        <WhatsApp fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="WhatsApp" />
                </MenuItem>
                <MenuItem
                    onClick={(event) => {
                        handleClose(event);
                        onTrack?.();
                    }}
                >
                    <ListItemIcon>
                        <TrackChangesIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Track" />
                </MenuItem>
            </Menu>
        </>
    );
}

export default function JobDetail() {
    const { id } = useParams();
    const [serachParams,] = useSearchParams();
    const navigate = useNavigate();
    const theme = useTheme();

    const [authState] = useAuthContextState();
    const [, setJobState] = useJobContextState();
    const [, setUiState] = useUiContextState();

    const [job, setJob] = useState(null);
    const [companyName, setCompanyName] = useState('');
    const [script, setScript] = useState(null);
    const [candidateATSs, setCandidateATSs] = useState([]);
    const [filteredCandId, setFilteredCandId] = useState(serachParams?.get("candidate"));
    const [filteredRelevantCandId, setFilteredRelevantCandId] = useState(serachParams?.get("relevantCandidate"));
    const [relevantCandidates, setRelevantCandidates] = useState([]);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [jobDetailsModalOpen, setJobDetailsModalOpen] = useState(() => {
        const tab = serachParams?.get("openTab");
        return tab === 'JobDetails' || tab === 'ScriptDetails';
    });
    const [jobDetailsModalTab, setJobDetailsModalTab] = useState(() => (
        serachParams?.get("openTab") === 'ScriptDetails' ? 1 : 0
    ));
    const TAB_MAP = useMemo(() => ({
        Candidates: 2,
        RelevantCandidates: 3,
    }), []);

    const REVERSE_TAB_MAP = useMemo(() => ({
        2: 'Candidates',
        3: 'RelevantCandidates',
    }), []);

    const [tabIndex, setTabIndex] = useState(() => {
        const tab = serachParams?.get("openTab");
        if (tab && TAB_MAP[tab] !== undefined) return TAB_MAP[tab];
        return 3;
    });

    useEffect(() => {
        const tabName = REVERSE_TAB_MAP[tabIndex];
        if (tabName && serachParams.get('openTab') !== tabName) {
            const newParams = new URLSearchParams(serachParams);
            newParams.set('openTab', tabName);
            navigate({ search: newParams.toString() }, { replace: true });
        }
    }, [tabIndex, navigate, serachParams, REVERSE_TAB_MAP]);
    const [shareModalOpen, setShareModalOpen] = useState(false);

    const [relevancyModalOpen, setRelevancyModalOpen] = useState(false);
    const [selectedRelevancy, setSelectedRelevancy] = useState(null); // ★
    const [relevancyLoading, setRelevancyLoading] = useState(false);

    const renderJobDetailsContent = () => (
        <Box sx={{ display: 'grid', gap: 2 }}>
            <Card variant="outlined" sx={{ boxShadow: "none" }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5 }, boxShadow: "none" }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                        Overview
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                            gap: 2,
                        }}
                    >
                        {[
                            ['Company', companyName || 'â€”'],
                            ['Type', displayVal(job.jobType)],
                            ['Mode', displayVal(job.workMode)],
                            ['Walk-in', job.isWalkIn ? 'Yes' : 'No'],
                            ['Locations', displayArray(job.locations)],
                            ['Primary Skills', displayArray(job.primarySkills)],
                        ].map(([lbl, val]) => (
                            <Box key={lbl}>
                                <Typography color="text.secondary" variant="caption">{lbl}</Typography>
                                <Typography sx={{ mt: 0.4, whiteSpace: 'pre-line' }}>{val}
                                    {lbl === 'Primary Skills' &&
                                        <Tooltip title="Copy content to clipboard">
                                            <IconButton
                                                onClick={() =>
                                                    navigator.clipboard.writeText(val || '')
                                                }
                                            >
                                                <ContentCopyIcon />
                                            </IconButton>
                                        </Tooltip>}</Typography>
                            </Box>
                        ))}
                    </Box>
                </CardContent>
            </Card>

            <Card variant="outlined" sx={{ boxShadow: "none" }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5 }, boxShadow: "none" }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                        Compensation & Experience
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                            gap: 2,
                        }}
                    >
                        <Box>
                            <Typography color="text.secondary" variant="caption">Experience</Typography>
                            <Typography sx={{ mt: 0.4 }}>
                                {`${job.experience?.min || 0}-${job.experience?.max || 0} yrs`}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography color="text.secondary" variant="caption">Salary</Typography>
                            <Typography sx={{ mt: 0.4 }}>
                                {`${job.salary?.min || 0}-${job.salary?.max || 0} ${job.salary?.currency || ''}`}
                            </Typography>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            <Card variant="outlined" sx={{ boxShadow: "none" }}>
                <CardContent sx={{ p: { xs: 2, sm: 2.5 }, boxShadow: "none" }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                        Notes
                    </Typography>
                    <Typography sx={{ whiteSpace: 'pre-line', color: 'text.secondary', mb: 2 }}>
                        {displayVal(job.recruiterNotes)}
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                        Description
                        <Tooltip title="Copy content to clipboard">
                            <IconButton
                                onClick={() =>
                                    navigator.clipboard.writeText(job.description || '')
                                }
                            >
                                <ContentCopyIcon />
                            </IconButton>
                        </Tooltip>
                    </Typography>
                    <Typography sx={{
                        whiteSpace: 'pre-line',
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'grey.50',
                        maxHeight: 420,
                        overflow: 'auto',
                    }}>
                        {displayVal(job.description)}
                    </Typography>
                </CardContent>
            </Card>
        </Box>
    );

    const renderScriptDetailsContent = () => {
        if (!script) {
            return (
                <Card variant="outlined" sx={{ boxShadow: "none" }}>
                    <CardContent
                        sx={{
                            py: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 1.5,
                            boxShadow: "none"
                        }}
                    >
                        <Typography color="text.secondary">
                            No script generated for this job yet.
                        </Typography>
                        <MUIButton
                            variant="outlined"
                            disabled={generating}
                            onClick={fetchGeneratedScript}
                            startIcon={generating ? <CircularProgress size={18} /> : null}
                        >
                            {generating ? 'Generating...' : 'Generate AI Script'}
                        </MUIButton>
                    </CardContent>
                </Card>
            );
        }

        return (
            <Box sx={{ display: 'grid', gap: 2 }}>
                <Card variant="outlined" sx={{ boxShadow: "none" }}>
                    <CardContent sx={{ p: { xs: 2, sm: 2.5 }, boxShadow: "none" }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                            Script Configuration
                        </Typography>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                gap: 2,
                            }}
                        >
                            {[
                                ['Script Name', displayVal(script.scriptName)],
                                ['Script Type', displayVal(script.scriptType)],
                                ['Language', displayVal(script.language)],
                                ['Voice Model', displayVal(script.voiceModel)],
                                ['Extra Question', displayVal(script.extraQuestion)],
                            ].map(([lbl, val]) => (
                                <Box key={lbl}>
                                    <Typography color="text.secondary" variant="caption">{lbl}</Typography>
                                    <Typography sx={{ mt: 0.4, whiteSpace: 'pre-line' }}>{val}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </CardContent>
                </Card>

                <Card variant="outlined" sx={{ boxShadow: "none" }}>
                    <CardContent sx={{ p: { xs: 2, sm: 2.5 }, boxShadow: "none" }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                            Script Content
                            <Tooltip title="Copy content to clipboard">
                                <IconButton
                                    onClick={() =>
                                        navigator.clipboard.writeText(script.content || '')
                                    }
                                >
                                    <ContentCopyIcon />
                                </IconButton>
                            </Tooltip>
                        </Typography>
                        <Box
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                bgcolor: 'grey.50',
                                maxHeight: 420,
                                overflow: 'auto',
                            }}
                        >
                            <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                {displayVal(script.content)}
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        );
    };

    const buildRelevancyPayload = (source, fallbackName) => {
        const pctNum = Number(source?.candidateRelevancyToJob ?? source?.relevancy);
        const pct = Number.isFinite(pctNum) ? Math.round(pctNum) : 0;
        return {
            name: fallbackName || source?.name || 'Candidate',
            candidateRelevancyToJob: pct,
            experienceRelevancy: source?.experienceRelevancy ?? 0,
            skillsRelevancy: source?.skillsRelevancy ?? 0,
            responsibilitiesRelevancy: source?.responsibilitiesRelevancy ?? 0,
            designationRelevancy: source?.designationRelevancy ?? 0,
            salaryRelevancy: source?.salaryRelevancy ?? 0,
            noticePeriodRelevancy: source?.noticePeriodRelevancy ?? 0,
            interestRelevancy: source?.interestRelevancy ?? 0,
            communicationRelevancy: source?.communicationRelevancy ?? 0,
            reason: source?.reason || '—',
        };
    };

    const fetchLatestRelevancy = async (candidateId, fallbackName) => {
        if (!candidateId || !job?._id) return;
        setRelevancyLoading(true);
        try {
            const res = await fetchData(
                `/api/relevancy?candidateId=${encodeURIComponent(candidateId)}&jobId=${encodeURIComponent(job._id)}&limit=5`
            );
            const list = Array.isArray(res) ? res : [];
            if (!list.length) return;
            const latest = [...list].sort((a, b) => {
                const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
                const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
                return bTime - aTime;
            })[0];
            if (latest) {
                setSelectedRelevancy(buildRelevancyPayload(latest, fallbackName));
            }
        } catch (err) {
            console.error('[JobDetail] Failed to refresh relevancy:', err);
        } finally {
            setRelevancyLoading(false);
        }
    };

    const openCandidateDetails = (event, candidateId) => {
        if (event && typeof event.stopPropagation === 'function') {
            event.stopPropagation();
        }
        if (!candidateId) return;
        navigate(`/candidates/${candidateId}`);
    };

    const openRelevancyDetails = (event, row) => {
        if (event && typeof event.stopPropagation === 'function') {
            event.stopPropagation();
        }
        if (!row?.id) return;

        const name =
            `${row?.firstName || ''} ${row?.lastName || ''}`.trim() ||
            row?.email ||
            'Candidate';

        setSelectedRelevancy(buildRelevancyPayload(row, name));
        setRelevancyModalOpen(true);
        fetchLatestRelevancy(row.id, name);
    };

    const getRelevancyBand = (score) => {
        if (typeof score !== 'number' || Number.isNaN(score)) {
            return {
                label: 'N/A',
                color: theme.palette.text.secondary,
                bg: alpha(theme.palette.text.secondary, 0.12),
                border: alpha(theme.palette.text.secondary, 0.28),
            };
        }
        if (score < 33) {
            return {
                label: 'Low',
                color: theme.palette.error.main,
                bg: alpha(theme.palette.error.main, 0.14),
                border: alpha(theme.palette.error.main, 0.36),
            };
        }
        if (score < 67) {
            return {
                label: 'Medium',
                color: theme.palette.warning.main,
                bg: alpha(theme.palette.warning.main, 0.14),
                border: alpha(theme.palette.warning.main, 0.36),
            };
        }
        return {
            label: 'High',
            color: theme.palette.success.main,
            bg: alpha(theme.palette.success.main, 0.14),
            border: alpha(theme.palette.success.main, 0.36),
        };
    };

    const renderRelevancyCell = (params) => {
        const raw = Number(params.row?.relevancy);
        if (!Number.isFinite(raw)) return '—';

        const value = Math.round(raw);
        const band = getRelevancyBand(value);

        return (
            <Typography
                variant="body2"
                onClick={e => openRelevancyDetails(e, params.row)}
                sx={{
                    fontWeight: 700,
                    color: band.color,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                    textDecorationColor: alpha(band.color, 0.5),
                    '&:hover': {
                        color: band.color,
                        textDecorationColor: band.color,
                    },
                }}
            >
                {`${value}%`}
            </Typography>
        );
    };

    const downloadTracker = async () => {
        try {
            const candidateIds = candidateATSs
                .filter(
                    cATS =>
                        /^[0-9a-fA-F]{24}$/.test(cATS?.candidate._id)
                )
                .map(canATS => canATS.candidate._id);

            if (!candidateIds.length) {
                alert('No valid candidates to export.');
                return;
            }

            const uniqueCandidateIds = [...new Set(candidateIds)];

            const idsParam = uniqueCandidateIds.join(',');
            const jobParam = job?._id
                ? `&jobId=${encodeURIComponent(job?._id)}`
                : '';

            setUiState({ loadingMsg: 'Generating, Please wait...' });

            const blob = await fetchData(
                `/api/candidates/tracker/?ids=${encodeURIComponent(idsParam)}${jobParam}`,
                {
                    method: 'GET',
                    headers: {
                        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    },
                }
            );

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Tracker_job__${job.title}__${job.internalTitle}__${job._id}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[Tracker] downloadTracker failed:', err);
            alert('Could not download tracker - please try again.');
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const loadData = async () => {
        try {
            // setUiState({
            //     loadingMsg: "Loading, please wait..."
            // });
            const j = await fetchData(`/api/jobs/${id}`);
            setJob(j);
            // console.log('[JobDetail] Loaded job:', j);

            if (j.company) {
                fetchData(`/api/companies/${j.company}`)
                    .then(c => setCompanyName(c.name))
                    .catch(() => setCompanyName(''));
            }

            const scripts = await fetchData(`/api/scripts?jobId=${j._id}`);
            setScript(Array.isArray(scripts) && scripts.length ? scripts[0] : null);
            // console.log('[JobDetail] Script response:', scripts);

            const all = await fetchData('/api/candidates/ats/filter/job/' + j._id + '/');
            setCandidateATSs(all || []);
            // console.log('[JobDetail] candidateATSs response:', all);

            // ★ Include applied candidates too so pipeline can show relevancy
            const relevant = await fetchData(`/api/jobs/${j._id}/relevant-candidates?includeApplied=true`);
            // console.log('[JobDetail] relevant-candidates(includeApplied=true) response:', relevant);
            setRelevantCandidates(Array.isArray(relevant) ? relevant : []);
        } catch (err) {
            console.error('[JobDetail] load error', err);

        } finally {

            setUiState({
                loadingMsg: null
            });
        }
    }

    useEffect(() => {
        loadData();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const jobName = (job?.title || job?.internalTitle || '').trim();

    useEffect(() => {
        setDocumentTitle(jobName || 'Job Detail');
    }, [jobName]);

    const displayArray = arr => (arr?.length ? arr.join(', ') : '—');
    const displayVal = v => (v || '—');

    const handleEdit = () => {
        setJobState((prev = {}) => ({
            ...prev,
            jobFormData: null,
            jobInitialValuesDict: {
                _id: job?._id,
            },
        }));
        navigate(`/jobs/edit/${job?._id}/`);
    }

    const handleArchive = () =>
        fetchData(`/api/jobs/${id}`, { method: 'DELETE' })
            .then(() => {
                // ✅ pass success toast to JobsList (one-time)
                navigate('/jobs', {
                    state: {
                        toast: {
                            open: true,
                            message: 'Job archived successfully',
                            severity: 'success',
                        }
                    }
                });
            })
            .catch(console.error);

    const fetchGeneratedScript = async () => {
        if (!job?._id) return;
        setGenerating(true);
        try {
            const res = await fetchData('/api/scripts/generate-script', {
                method: 'POST',
                body: JSON.stringify({ job }),
            });

            if (res.success && res.content) {
                setScript({
                    scriptName: res.scriptName || `${job.title}-script`,
                    scriptType: res.scriptType || 'aicall',
                    language: res.language || 'English (US)',
                    voiceModel: res.voiceModel || '',
                    extraQuestion: res.extraQuestion || '',
                    content: res.content
                });
            } else {
                alert(res.message || 'Script generation failed');
            }
        } catch (err) {
            console.error(err);
            alert('Something went wrong while generating the script.');
        } finally {
            setGenerating(false);
        }
    };

    const candidateColumns = [
        {
            field: '__serial',
            headerName: 'No.',
            maxWidth: 80,
            headerAlign: 'center',
            align: 'center',
            sortable: false,
            filterable: false,
            renderCell: (params) => {
                const idx = params.api.getAllRowIds().indexOf(params.id);
                return idx + 1;
            },
        },
        {
            field: 'firstName',
            headerName: 'Name',
            minWidth: 180,
            flex: 1,
            flexGrow: 1,
            headerAlign: 'left',
            align: 'left',
            renderCell: (params) => {
                const fullName = [params.row?.firstName, params.row?.lastName]
                    .filter(Boolean)
                    .join(' ')
                    .trim() || '-';
                return (
                    <Typography
                        variant="subtitle2"
                        onClick={e => openCandidateDetails(e, params.row?.id)}
                        noWrap
                        title={fullName}
                        sx={{
                            fontWeight: 600,
                            color: 'text.primary',
                            cursor: 'pointer',
                            textDecoration: 'none',
                            width: 'fit-content',
                            maxWidth: '100%',
                            '&:hover': {
                                color: 'text.primary',
                                textDecoration: 'none',
                            },
                        }}
                    >
                        {fullName}
                    </Typography>
                );
            },
        },
        // { field: 'lastName', headerName: 'Last Name', minWidth: 150, flex: 1, flexGrow: 1, headerAlign: 'center' },
        {
            field: 'email', headerName: 'Contact', minWidth: 220, flex: 1, flexGrow: 1, headerAlign: 'left', align: 'left',
            renderCell: (params) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {params.row?.email || '-'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {params.row?.phoneNumber || ''}
                    </Typography>
                </Box>
            ),
        },
        // { field: 'phoneNumber', headerName: 'Phone', minWidth: 150, flex: 1, flexGrow: 1, headerAlign: 'center' },
        // { field: 'skills', headerName: 'Skills', minWidth: 220, flex: 1, flexGrow: 1, headerAlign: 'center' },
        {
            field: 'relevancy',
            headerName: 'Relevancy',
            minWidth: 140,
            flex: 1,
            flexGrow: 1,
            headerAlign: 'left',
            align: 'left',
            renderCell: renderRelevancyCell
        },
        {
            field: 'aiCallStatus', headerName: 'AI Call Status', minWidth: 140, flex: 1, flexGrow: 1, headerAlign: 'center',
            renderCell: (params) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {params.row?.aiCallStatus || '-'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {params.row?.callAudioDuration || ''}
                    </Typography>
                </Box>
            ),
        },
        // { field: 'callAudioDuration', headerName: 'Call Duration', minWidth: 140, flex: 1, flexGrow: 1, headerAlign: 'center' },
        {
            field: 'aiCallHangUpCause', headerName: 'Call Ended on', minWidth: 140, flex: 1, flexGrow: 1, headerAlign: 'center',
            renderCell: (params) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {params.row?.aiCallHangUpCause || '-'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        by {params.row?.aiCallHangUpSource || '-'}
                    </Typography>
                </Box>
            ),
        },
        // { field: 'aiCallHangUpSource', headerName: 'Hang-Up By', minWidth: 140, flex: 1, flexGrow: 1, headerAlign: 'center' },
        { field: 'interested', headerName: 'Interested', minWidth: 40, flex: 1, flexGrow: 1, align: "center", headerAlign: 'center' },
        { field: 'scheduleTime', headerName: 'Schedule', minWidth: 100, flex: 1, flexGrow: 1, align: "center", headerAlign: 'center' },
    ];

    const candidateRows = useMemo(() => {

        let filCan = (candidateATSs || []);

        // Minimal fix to prevent DataGrid crash + exclude archived candidates
        filCan = filCan.filter(c => c?.candidate?._id && !c?.candidate?.isArchived);

        if (filteredCandId) {
            filCan = filCan.filter((ele) => ele?.candidate?._id === filteredCandId);
        }

        const res = filCan.map(c => {
            let frmtdDte;
            if (c?.schedule?.scheduleTime) {
                frmtdDte = new Date(c?.schedule?.scheduleTime);
                frmtdDte = getLongDateTimeStr(frmtdDte);
            } else {
                frmtdDte = "N/A";
            }

            const rel = (relevantCandidates || []).find(r => {
                const cid = String(r.id || r.candidateId || r.candidate?._id || '');
                return cid === String(c?.candidate?._id || '');
            });

            const relNum = rel ? Number(rel.candidateRelevancyToJob ?? rel.relevancy) : NaN;
            const relevancy = Number.isFinite(relNum) ? Math.round(relNum) : null;

            const stageResultsRaw = Array.isArray(c?.stageResults) ? c.stageResults : [];
            const stageResults = stageResultsRaw
                .filter(sr => sr?.stage)
                .sort((a, b) => {
                    const aTime = a?.stage?.createdAt ? new Date(a.stage.createdAt).getTime() : 0;
                    const bTime = b?.stage?.createdAt ? new Date(b.stage.createdAt).getTime() : 0;
                    return aTime - bTime;
                });

            return {
                ...rel,
                id: c?.candidate?._id,
                atsId: c?._id,
                firstName: c?.candidate?.firstName,
                lastName: c?.candidate?.lastName,
                fullName: `${c?.candidate?.firstName} ${c?.candidate?.lastName}, ${c?.candidate?.email}, ${c?.candidate?.phoneNumber}`,
                email: c?.candidate?.email,
                phoneNumber: c?.candidate?.phoneNumber,
                skills: c?.candidate?.skills?.map(ele => Object.keys(ele)?.join(", "))?.join(", "),
                aiCallStatus: c.aiCallStatus,
                aiCallHangUpCause: c.aiCallHangUpCause,
                aiCallHangUpSource: c.aiCallHangUpSource,
                callAudioDuration: c.callAudioDuration,
                existingScheduleTime: c?.schedule?.scheduleTime || "N/A",
                scheduleTime: frmtdDte,
                interested: c.interested ? "Yes" : "No",
                relevancy,
                stageResults,
            }
        });

        // console.log('[JobDetail] candidateRows (with relevancy):', res);

        return res;

    }, [candidateATSs, filteredCandId, relevantCandidates]);

    const filValue = (candidateRows || [])?.find?.(ele => ele?.id === filteredCandId);
    const filOpts = (candidateRows || [])?.map?.(ele => ({ label: ele?.fullName, value: ele?.id }));

    // IDs of candidates who have applied for this job
    const appliedCandidateIds = useMemo(() => {
        const ids = (candidateATSs || [])
            .map(c => c?.candidate?._id)
            .filter(Boolean)
            .map(String);

        return new Set(ids);
    }, [candidateATSs]);

    const relevantColumns = [
        {
            field: '__serial',
            headerName: 'No.',
            maxWidth: 80,
            headerAlign: 'center',
            align: 'center',
            sortable: false,
            filterable: false,
            renderCell: (params) => {
                const idx = params.api.getAllRowIds().indexOf(params.id);
                return idx + 1;
            },
        },
        {
            field: 'firstName',
            headerName: 'Name',
            minWidth: 200,
            headerAlign: 'left',
            align: 'left',
            renderCell: (params) => {
                const fullName = [params.row?.firstName, params.row?.lastName]
                    .filter(Boolean)
                    .join(' ')
                    .trim() || '-';
                return (
                    <Typography
                        variant="subtitle2"
                        onClick={e => openCandidateDetails(e, params.row?.id)}
                        noWrap
                        title={fullName}
                        sx={{
                            fontWeight: 600,
                            color: 'text.primary',
                            cursor: 'pointer',
                            textDecoration: 'none',
                            width: 'fit-content',
                            maxWidth: '100%',
                            '&:hover': {
                                color: 'text.primary',
                                textDecoration: 'none',
                            },
                        }}
                    >
                        {fullName}
                    </Typography>
                );
            },
        },
        // { field: 'lastName', headerName: 'Last Name', minWidth: 200, headerAlign: 'center' },
        {
            field: 'email',
            headerName: 'Contact',
            minWidth: 300,
            headerAlign: 'left',
            align: 'left',
            renderCell: (params) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {params.row?.email || '-'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {params.row?.phoneNumber || ''}
                    </Typography>
                </Box>
            ),
        },
        // { field: 'phoneNumber', headerName: 'Phone Number', minWidth: 200, headerAlign: 'center' },
        {
            field: 'relevancy',
            headerName: 'Relevancy',
            minWidth: 220,
            align: 'left',
            headerAlign: 'left',
            renderCell: renderRelevancyCell,
        },
        // {
        //     field: 'reason',
        //     headerName: 'Reason',
        //     maxWidth: 420,
        //     align: 'left',
        //     headerAlign: 'left'
        // }
    ];

    // Relevant rows: keep only NOT-applied candidates; once assigned they should disappear from this tab.
    const relevantRows = useMemo(() => {

        if (!Array.isArray(relevantCandidates) || !relevantCandidates.length) {
            return [];
        }

        let filtered = relevantCandidates.filter(r => {
            const cid = String(r.id || r.candidateId || r.candidate?._id || '');
            const isApplied = appliedCandidateIds.has(cid);
            return !isApplied;
        });

        const rows = filtered.map(r => {
            const pctNum = Number(r.candidateRelevancyToJob ?? r.relevancy);
            const pct = Number.isFinite(pctNum) ? pctNum : 0;
            const row = {
                ...r,
                id: r.id,
                firstName: r.firstName,
                lastName: r.lastName,
                fullName: `${r.firstName || ''} ${r.lastName || ''}, ${r.email || ''}, ${r.phoneNumber || ''}`,
                email: r.email,
                phoneNumber: r.phoneNumber,
                relevancy: pct,
                candidateRelevancyToJob: pct,
                experienceRelevancy: r.experienceRelevancy ?? 0,
                skillsRelevancy: r.skillsRelevancy ?? 0,
                responsibilitiesRelevancy: r.responsibilitiesRelevancy ?? 0,
                designationRelevancy: r.designationRelevancy ?? 0,
                salaryRelevancy: r.salaryRelevancy ?? 0,
                noticePeriodRelevancy: r.noticePeriodRelevancy ?? 0,
                interestRelevancy: r.interestRelevancy ?? 0,
                communicationRelevancy: r.communicationRelevancy ?? 0,
                reason: r.reason || '—'
            };
            return row;
        });

        const filteredRows = filteredRelevantCandId
            ? rows.filter(row => row?.id === filteredRelevantCandId)
            : rows;

        // console.log('[JobDetail] relevantRows (non-applied or fallback):', rows);

        return filteredRows;
    }, [relevantCandidates, appliedCandidateIds, filteredRelevantCandId]);

    const relevantFilValue = (relevantRows || [])?.find?.(ele => ele?.id === filteredRelevantCandId);
    const relevantFilOpts = (relevantRows || [])?.map?.(ele => ({ label: ele?.fullName, value: ele?.id }));

    // ★ Applied candidates with relevancy (intersection of relevantCandidates & appliedCandidateIds)
    const appliedRelevantRows = useMemo(() => {
        if (!Array.isArray(relevantCandidates) || !relevantCandidates.length) {
            return [];
        }

        const filtered = relevantCandidates.filter(r => {
            const cid = String(r.id || r.candidateId || r.candidate?._id || '');
            return appliedCandidateIds.has(cid);
        });

        const rows = filtered.map(r => {
            const pctNum = Number(r.candidateRelevancyToJob ?? r.relevancy);
            const pct = Number.isFinite(pctNum) ? pctNum : 0;
            return {
                ...r,
                id: r.id,
                firstName: r.firstName,
                lastName: r.lastName,
                email: r.email,
                phoneNumber: r.phoneNumber,
                relevancy: pct,
                candidateRelevancyToJob: pct,
                experienceRelevancy: r.experienceRelevancy ?? 0,
                skillsRelevancy: r.skillsRelevancy ?? 0,
                responsibilitiesRelevancy: r.responsibilitiesRelevancy ?? 0,
                designationRelevancy: r.designationRelevancy ?? 0,
                salaryRelevancy: r.salaryRelevancy ?? 0,
                noticePeriodRelevancy: r.noticePeriodRelevancy ?? 0,
                interestRelevancy: r.interestRelevancy ?? 0,
                communicationRelevancy: r.communicationRelevancy ?? 0,
                reason: r.reason || '—'
            };
        });

        // console.log('[JobDetail] appliedRelevantRows (for pipeline cards):', rows);

        return rows;
    }, [relevantCandidates, appliedCandidateIds]);

    // Top 5 relevant candidates for card view, sorted by relevancy
    const topRelevantCandidates = useMemo(() => {
        if (!relevantRows.length) return [];
        const sorted = [...relevantRows].sort(
            (a, b) => (b.relevancy || 0) - (a.relevancy || 0)
        );
        const top = sorted.slice(0, 5);
        return top;
    }, [relevantRows]);

    // ★ Top 5 applied candidates (who applied for this role) by relevancy
    const topAppliedRelevantCandidates = useMemo(() => {
        if (!appliedRelevantRows.length) return [];
        const sorted = [...appliedRelevantRows].sort(
            (a, b) => (b.relevancy || 0) - (a.relevancy || 0)
        );
        const top = sorted.slice(0, 5);
        return top;
    }, [appliedRelevantRows]);

    const canEditJob =
        authState.user?.role === 'recruiter'
            ? authState.user?.accessRestrictions?.job !== false
            : true;

    const renderRelevancyCard = (item, idx) => {
        const name =
            `${item.firstName || ''} ${item.lastName || ''}`.trim() ||
            item.email ||
            `Candidate ${idx + 1}`;

        const isAnalyzing =
            item.relevancy == null || Number.isNaN(item.relevancy);

        const pctNum = Number(item.relevancy);
        const pct = Number.isFinite(pctNum) ? pctNum : 0;
        const pctClamped = Math.min(100, Math.max(0, pct));
        const displayPct = isAnalyzing ? 'N/A' : `${Math.round(pctClamped)}%`;
        const scoreBand = isAnalyzing
            ? {
                color: theme.palette.text.secondary,
                bg: alpha(theme.palette.text.secondary, 0.1),
                border: alpha(theme.palette.text.secondary, 0.28),
            }
            : getRelevancyBand(pct);

        const handleRelevancyClick = (e) => {
            if (e && typeof e.stopPropagation === 'function') {
                e.stopPropagation();
            }
            setSelectedRelevancy(buildRelevancyPayload(item, name));
            setRelevancyModalOpen(true);
            fetchLatestRelevancy(item.id, name);
        };

        // const scoreColor = pct >= 67 ? 'success.main' : pct >= 34 ? 'warning.main' : 'error.main';

        return (
            <Box key={item.id} sx={{ display: 'flex', minWidth: 0 }}>
                <Card
                    variant="outlined"
                    onClick={handleRelevancyClick}
                    sx={{
                        height: 170,
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: 0,
                        borderRadius: 2.5,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            borderColor: 'primary.main',
                            transform: 'translateY(-2px)',
                        },
                        boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
                    }}
                >
                    <CardContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                px: 1.5,
                                py: 1.25,
                                minWidth: 0,
                                borderBottom: 1,
                                borderColor: 'divider',
                                borderTopLeftRadius: 10,
                                borderTopRightRadius: 10,
                            }}
                        >
                            <Typography
                                variant="subtitle1"
                                noWrap
                                title={name}
                                sx={{
                                    fontWeight: 700,
                                    lineHeight: 1.2,
                                    color: 'text.primary',
                                    width: '100%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {name}
                            </Typography>
                            <Box sx={{ mt: 1, width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LinearProgress
                                    variant="determinate"
                                    value={isAnalyzing ? 0 : pctClamped}
                                    sx={{
                                        flex: 1,
                                        height: 8,
                                        borderRadius: 999,
                                        backgroundColor: scoreBand.bg,
                                        '& .MuiLinearProgress-bar': {
                                            backgroundColor: scoreBand.color,
                                            borderRadius: 999,
                                        },
                                    }}
                                />
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 700,
                                        color: scoreBand.color,
                                        minWidth: 44,
                                        textAlign: 'right',
                                    }}
                                >
                                    {displayPct}
                                </Typography>
                            </Box>
                        </Box>


                        <Box sx={{ p: 1.5, mt: 'auto', minWidth: 0 }}>
                            <Typography
                                variant="body2"
                                noWrap
                                title={item.email || ''}
                                sx={{
                                    fontWeight: 600,
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    mb: 1.1,
                                }}
                            >
                                {item.email || '—'}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {item.phoneNumber || '—'}
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        );
    };

    return (
        job ?
            <Box sx={{ width: '100%', px: { xs: 2, sm: 4, md: 6 }, py: 4, p: { xs: 2, sm: 4 }, bgcolor: "background.paper" }}
            >
                <Box sx={{ width: '100%' }}>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            justifyContent: 'space-between',
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            mb: 3,
                            gap: 2
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton onClick={() => navigate(-1)}>
                                <ArrowBackIos fontSize="small" />
                            </IconButton>
                            <Typography variant="h6">
                                {job.title}
                                {job.internalTitle && <Box component="span"> ({job.internalTitle})</Box>}
                            </Typography>
                            <Tooltip title="Refresh">
                                <IconButton size="small" onClick={() => loadData()}>
                                    <RefreshRounded fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <MUIButton onClick={() => {
                                setJobDetailsModalTab(0);
                                setJobDetailsModalOpen(true);
                            }}>
                                Job Detail
                            </MUIButton>

                            {canEditJob && (
                                <>
                                    <MUIButton
                                        startIcon={<CloudUploadIcon />}
                                        onClick={() =>
                                            navigate('/candidates/new/', {
                                                state: { preselectJobId: job._id }
                                            })
                                        }
                                    >

                                        Add Candidate
                                    </MUIButton>

                                    <MUIButton startIcon={<Edit />} onClick={handleEdit}>Edit</MUIButton>
                                    <MUIButton startIcon={<Archive />} onClick={() => setDeleteOpen(true)}>Archive</MUIButton>
                                    <MUIButton startIcon={<ShareOutlinedIcon />} onClick={() => setShareModalOpen(true)}>
                                        Share
                                    </MUIButton>
                                </>
                            )}
                        </Box>
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    <Box sx={{ display: "flex", justifyContent: "center" }}>
                        <Tabs
                            value={tabIndex}
                            onChange={(e, v) => setTabIndex(v)}
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{ borderBottom: 1, borderColor: 'divider', px: 5, pb: 1, textTransform: "none" }}
                        >
                            <Tab label="Relevant Candidates" value={3} sx={{ textTransform: "none" }} />
                            <Tab label="Candidates pipeline" value={2} sx={{ textTransform: "none" }} />
                        </Tabs>
                    </Box>

                    <Box
                        // component={Paper}
                        // elevation={1}
                        sx={{ py: 2, mt: 3 }}
                    >
                        <TabPanel value={tabIndex} index={0}>

                            <Box sx={{ display: 'grid', gap: 2 }}>
                                <Card variant="outlined" sx={{ boxShadow: "none" }}>
                                    <CardContent sx={{ p: { xs: 2, sm: 2.5 }, boxShadow: "none" }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                                            Overview
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: 'grid',
                                                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                                gap: 2,
                                            }}
                                        >
                                            {[
                                                ['Company', companyName || '—'],
                                                ['Type', displayVal(job.jobType)],
                                                ['Mode', displayVal(job.workMode)],
                                                ['Walk-in', job.isWalkIn ? 'Yes' : 'No'],
                                                ['Locations', displayArray(job.locations)],
                                                ['Primary Skills', displayArray(job.primarySkills)],
                                            ].map(([lbl, val]) => (
                                                <Box key={lbl}>
                                                    <Typography color="text.secondary" variant="caption">{lbl}</Typography>
                                                    <Typography sx={{ mt: 0.4, whiteSpace: 'pre-line' }}>{val}
                                                        {lbl === 'Primary Skills' &&
                                                            <Tooltip title="Copy content to clipboard">
                                                                <IconButton
                                                                    onClick={() =>
                                                                        navigator.clipboard.writeText(val || '')
                                                                    }
                                                                >
                                                                    <ContentCopyIcon />
                                                                </IconButton>
                                                            </Tooltip>}</Typography>
                                                </Box>
                                            ))}
                                        </Box>
                                    </CardContent>
                                </Card>
                                {job.isWalkIn && (
                                    <Card variant="outlined" sx={{ boxShadow: "none" }}>
                                        <CardContent sx={{ p: { xs: 2, sm: 2.5 }, boxShadow: "none" }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                                                Walk-in Drive Details
                                            </Typography>
                                            <Box
                                                sx={{
                                                    display: 'grid',
                                                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                                    gap: 2,
                                                }}
                                            >
                                                <Box>
                                                    <Typography color="text.secondary" variant="caption">Date From</Typography>
                                                    <Typography sx={{ mt: 0.4 }}>
                                                        {job.walkInDetails?.dateRange?.from
                                                            ? new Date(job.walkInDetails.dateRange.from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                            : '—'}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography color="text.secondary" variant="caption">Date To</Typography>
                                                    <Typography sx={{ mt: 0.4 }}>
                                                        {job.walkInDetails?.dateRange?.to
                                                            ? new Date(job.walkInDetails.dateRange.to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                            : '—'}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography color="text.secondary" variant="caption">Time Start</Typography>
                                                    <Typography sx={{ mt: 0.4 }}>
                                                        {displayVal(job.walkInDetails?.timeRange?.start)}
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography color="text.secondary" variant="caption">Time End</Typography>
                                                    <Typography sx={{ mt: 0.4 }}>
                                                        {displayVal(job.walkInDetails?.timeRange?.end)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                )}
                                <Card variant="outlined" sx={{ boxShadow: "none" }}>
                                    <CardContent sx={{ p: { xs: 2, sm: 2.5 }, boxShadow: "none" }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                                            Compensation & Experience
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: 'grid',
                                                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                                gap: 2,
                                            }}
                                        >
                                            <Box>
                                                <Typography color="text.secondary" variant="caption">Experience</Typography>
                                                <Typography sx={{ mt: 0.4 }}>
                                                    {`${job.experience?.min || 0}-${job.experience?.max || 0} yrs`}
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography color="text.secondary" variant="caption">Salary</Typography>
                                                <Typography sx={{ mt: 0.4 }}>
                                                    {`${job.salary?.min || 0}-${job.salary?.max || 0} ${job.salary?.currency || ''}`}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>

                                <Card variant="outlined" sx={{ boxShadow: "none" }}>
                                    <CardContent sx={{ p: { xs: 2, sm: 2.5 }, boxShadow: "none" }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                            Notes
                                        </Typography>
                                        <Typography sx={{ whiteSpace: 'pre-line', color: 'text.secondary', mb: 2 }}>
                                            {displayVal(job.recruiterNotes)}
                                        </Typography>
                                        <Divider sx={{ my: 1.5 }} />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                            Description
                                            <Tooltip title="Copy content to clipboard">
                                                <IconButton
                                                    onClick={() =>
                                                        navigator.clipboard.writeText(job.description || '')
                                                    }
                                                >
                                                    <ContentCopyIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </Typography>
                                        <Typography sx={{
                                            whiteSpace: 'pre-line',
                                            p: 2,
                                            borderRadius: 2,
                                            bgcolor: 'grey.50',
                                            maxHeight: 420,
                                            overflow: 'auto',
                                        }}>
                                            {displayVal(job.description)}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Box>
                        </TabPanel>

                        <TabPanel value={tabIndex} index={1}>

                            {!script ? (
                                <Card variant="outlined" sx={{ boxShadow: "none" }}>
                                    <CardContent
                                        sx={{
                                            py: 4,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: 1.5,
                                            boxShadow: "none"
                                        }}
                                    >
                                        <Typography color="text.secondary">
                                            No script generated for this job yet.
                                        </Typography>
                                        <MUIButton
                                            variant="outlined"
                                            disabled={generating}
                                            onClick={fetchGeneratedScript}
                                            startIcon={generating ? <CircularProgress size={18} /> : null}
                                        >
                                            {generating ? 'Generating...' : 'Generate AI Script'}
                                        </MUIButton>
                                    </CardContent>
                                </Card>
                            ) : (
                                <>

                                    <Box sx={{ display: 'grid', gap: 2 }}>
                                        <Card variant="outlined" sx={{ boxShadow: "none" }}>
                                            <CardContent sx={{ p: { xs: 2, sm: 2.5 }, boxShadow: "none" }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                                                    Script Configuration
                                                </Typography>
                                                <Box
                                                    sx={{
                                                        display: 'grid',
                                                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                                        gap: 2,
                                                    }}
                                                >
                                                    {[
                                                        ['Script Name', displayVal(script.scriptName)],
                                                        ['Script Type', displayVal(script.scriptType)],
                                                        ['Language', displayVal(script.language)],
                                                        ['Voice Model', displayVal(script.voiceModel)],
                                                        ['Extra Question', displayVal(script.extraQuestion)],
                                                    ].map(([lbl, val]) => (
                                                        <Box key={lbl}>
                                                            <Typography color="text.secondary" variant="caption">{lbl}</Typography>
                                                            <Typography sx={{ mt: 0.4, whiteSpace: 'pre-line' }}>{val}</Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </CardContent>
                                        </Card>

                                        <Card variant="outlined" sx={{ boxShadow: "none" }}>
                                            <CardContent sx={{ p: { xs: 2, sm: 2.5 }, boxShadow: "none" }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                                                    Script Content
                                                    <Tooltip title="Copy content to clipboard">
                                                        <IconButton
                                                            onClick={() =>
                                                                navigator.clipboard.writeText(script.content || '')
                                                            }
                                                        >
                                                            <ContentCopyIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Typography>
                                                <Box
                                                    variant="outlined"
                                                    sx={{
                                                        p: 2,
                                                        borderRadius: 2,
                                                        bgcolor: 'grey.50',
                                                        maxHeight: 420,
                                                        overflow: 'auto',
                                                    }}
                                                >
                                                    <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                                        {displayVal(script.content)}
                                                    </Typography>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Box>
                                </>
                            )}
                        </TabPanel>

                        <TabPanel value={tabIndex} index={2}>
                            {/* ★ Top 5 applied candidates as cards, using relevancy, just like relevant candidates tab */}
                            {topAppliedRelevantCandidates.length > 0 && (
                                <Box sx={{ mb: 3 }}>
                                    <Typography
                                        variant="subtitle1"
                                        sx={{
                                            mb: 2,
                                            fontWeight: 600,
                                            textAlign: 'left',
                                        }}
                                    >
                                        Top 5 Applied Candidates by Relevancy
                                    </Typography>

                                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                        <Box
                                            sx={{
                                                display: 'grid',
                                                gap: 2,
                                                gridTemplateColumns: {
                                                    xs: '1fr',
                                                    sm: 'repeat(2, minmax(0, 1fr))',
                                                    md: 'repeat(3, minmax(0, 1fr))',
                                                    lg: 'repeat(5, minmax(0, 1fr))',
                                                    xl: 'repeat(5, minmax(0, 1fr))',
                                                },
                                                maxWidth: 1600,
                                                mx: 'auto',
                                                width: '100%',
                                            }}
                                        >
                                            {topAppliedRelevantCandidates.map((item, idx) =>
                                                renderRelevancyCard(item, idx)
                                            )}
                                        </Box>
                                    </Box>
                                </Box>
                            )}

                            <CandidateFlowSection
                                job={job}
                                rows={candidateRows}
                                columns={candidateColumns}
                                loadData={loadData}
                                enableInterviewScheduling
                                toolbarPrefix={
                                    <>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: { xs: 'stretch', md: 'center' },
                                                justifyContent: "space-between",
                                                flexDirection: { xs: 'column', md: 'row' },
                                                px: 2,
                                                gap: 2,
                                                mt: 1,
                                                py: 1,
                                            }}
                                        >
                                            <Typography variant="h6" sx={{ textAlign: 'left' }}>Applied Candidates</Typography>
                                            <MUIInput
                                                AutocompleteProps={{
                                                    type: "select",
                                                    options: filOpts,
                                                    value: filteredCandId && { label: filValue?.fullName, value: filValue?.id },
                                                    onChange: (ev, newVal) => { (async () => setFilteredCandId(newVal?.value))() },
                                                    sx: { minWidth: { xs: '100%', sm: 320, md: 360 }, border: "none", borderBottom: 1 },
                                                }}
                                                AutocompleteInputProps={{
                                                    type: "select",
                                                    label: "Search Candidate",
                                                }}
                                                sx={{ minWidth: { xs: '100%', sm: 320, md: 360 }, border: "none", borderBottom: 1 }}
                                            />
                                        </Box>
                                    </>
                                }
                                extraToolbarButtons={
                                    <MUIButton
                                        variant="outlined"
                                        startIcon={<DownloadIcon />}
                                        onClick={downloadTracker}
                                        sx={{ border: "none", borderBottom: 1 }}
                                    >
                                        Download tracker
                                    </MUIButton>
                                }
                                rowActionsBuilder={({ params, openScheduleModal, askConfirmation, triggerSingle, triggerWhatsappSingle, job: rowJob }) => (
                                    <PipelineActionsMenu
                                        row={params.row}
                                        onChangeSchedule={() => openScheduleModal({
                                            id: params.row.id,
                                            scheduleTime: params.row.scheduleTime,
                                            existingScheduleTime: params.row.existingScheduleTime
                                        })}
                                        onCall={() => {
                                            const { id, aiCallStatus } = params.row;
                                            askConfirmation(
                                                `Trigger AI call${aiCallStatus === 'pending' ? '' : ' again'} for this candidate?`,
                                                () => triggerSingle(
                                                    id,
                                                    aiCallStatus !== 'pending'
                                                )
                                            );
                                        }}
                                        onWhatsApp={() => {
                                            askConfirmation(
                                                'Initiate WhatsApp conversation for this candidate?',
                                                () => triggerWhatsappSingle(params.row.id)
                                            );
                                        }}
                                        onTrack={() => {
                                            navigate(`/ats/?cid=${params.row.id}&jid=${rowJob._id}`);
                                        }}
                                    />
                                )}
                                actionColumnsProps={{ minWidth: 100 }}
                            />

                        </TabPanel>

                        <TabPanel value={tabIndex} index={3}>
                            <Typography variant="h6" align="left" gutterBottom>
                                Other Relevant Candidates
                            </Typography>

                            {topRelevantCandidates.length > 0 && (
                                <Box sx={{ my: 3, pb: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                        <Box
                                            sx={{
                                                display: 'grid',
                                                gap: 2,
                                                gridTemplateColumns: {
                                                    xs: '1fr',
                                                    sm: 'repeat(2, minmax(0, 1fr))',
                                                    md: 'repeat(3, minmax(0, 1fr))',
                                                    lg: 'repeat(5, minmax(0, 1fr))',
                                                    xl: 'repeat(5, minmax(0, 1fr))',
                                                },
                                                maxWidth: 1600,
                                                mx: 'auto',
                                                width: '100%',
                                            }}
                                        >
                                            {topRelevantCandidates.map((item, idx) =>
                                                renderRelevancyCard(item, idx)
                                            )}
                                        </Box>
                                    </Box>
                                </Box>
                            )}

                            <CandidateFlowSection
                                job={job}
                                rows={relevantRows}
                                columns={relevantColumns}
                                loadData={loadData}
                                toolbarPrefix={
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: "space-between", gap: 2, px: 2 }}>
                                        <Typography variant="h6" sx={{ textAlign: 'left' }}>Relevant Candidates</Typography>
                                        <MUIInput
                                            AutocompleteProps={{
                                                type: "select",
                                                options: relevantFilOpts,
                                                value: filteredRelevantCandId && { label: relevantFilValue?.fullName, value: relevantFilValue?.id },
                                                onChange: (ev, newVal) => { (async () => setFilteredRelevantCandId(newVal?.value))() },
                                                sx: { minWidth: { xs: '100%', sm: 320, md: 360 }, border: "none", borderBottom: 1 },
                                            }}
                                            AutocompleteInputProps={{
                                                type: "select",
                                                label: "Search Candidate",
                                            }}
                                            sx={{ minWidth: { xs: '100%', sm: 320, md: 360 }, border: "none", borderBottom: 1 }}
                                        />
                                    </Box>
                                }
                                requiresAssignment
                                assignmentNotice="Selected candidates will be assigned to this job automatically before AI calling actions."
                                showClearScheduleControl={false}
                                rowActionsBuilder={({ params, askConfirmation, triggerSingle, triggerWhatsappSingle }) => (
                                    <>
                                        <MUIButton
                                            startIcon={<Call />}
                                            sx={{ mx: 1 }}
                                            onClick={e => {
                                                e.stopPropagation();
                                                askConfirmation(
                                                    'Assign this candidate to the job and trigger an AI call?',
                                                    () => triggerSingle(params.row.id, false)
                                                );
                                            }}
                                        >
                                            AI Call
                                        </MUIButton>
                                        <MUIButton
                                            startIcon={<WhatsApp />}
                                            sx={{ mx: 1 }}
                                            onClick={e => {
                                                e.stopPropagation();
                                                askConfirmation(
                                                    'Assign this candidate to the job and initiate WhatsApp conversation?',
                                                    () => triggerWhatsappSingle(params.row.id)
                                                );
                                            }}
                                        >
                                            AI WhatsApp
                                        </MUIButton>
                                    </>
                                )}
                                actionColumnsProps={{ minWidth: 100 }}
                                dataGridProps={{ autoHeight: true }}
                            />
                        </TabPanel>
                    </Box>

                    <MUIModal
                        open={jobDetailsModalOpen}
                        onClose={() => setJobDetailsModalOpen(false)}
                        contentSx={{ width: { xs: '94vw', sm: '88vw', md: '72vw' }, maxWidth: '1100px' }}
                    >
                        <Box sx={{ display: 'grid', gap: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Job Detail
                                </Typography>
                                <IconButton
                                    onClick={() => setJobDetailsModalOpen(false)}
                                    aria-label="close job detail modal"
                                    sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                    }}
                                >
                                    <CloseRoundedIcon />
                                </IconButton>
                            </Box>

                            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                <Tabs
                                    value={jobDetailsModalTab}
                                    onChange={(e, v) => setJobDetailsModalTab(v)}
                                    variant="scrollable"
                                    scrollButtons="auto"
                                    sx={{ minHeight: 44 }}
                                >
                                    <Tab label="Job Detail" value={0} sx={{ textTransform: 'none' }} />
                                    <Tab label="Script" value={1} sx={{ textTransform: 'none' }} />
                                </Tabs>
                            </Box>

                            <TabPanel value={jobDetailsModalTab} index={0}>
                                {renderJobDetailsContent()}
                            </TabPanel>

                            <TabPanel value={jobDetailsModalTab} index={1}>
                                {renderScriptDetailsContent()}
                            </TabPanel>
                        </Box>
                    </MUIModal>

                    <MUIArchiveCnfModal
                        open={deleteOpen}
                        onClose={() => setDeleteOpen(false)}
                        onConfirm={handleArchive}
                        itemName={job.title}
                    />
                </Box>

                {/* Relevancy breakdown modal when clicking on progress bar */}
                <MUIModal
                    open={relevancyModalOpen}
                    onClose={() => setRelevancyModalOpen(false)}
                >
                    <Box
                        sx={theme => ({
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            p: 3,
                            borderRadius: 3,
                            backgroundColor: theme.palette.mode === 'dark'
                                ? 'rgba(15,23,42,0.98)'
                                : '#ffffff',
                            boxShadow: theme.palette.mode === 'dark'
                                ? '0 18px 45px rgba(0,0,0,0.85)'
                                : '0 12px 30px rgba(15,23,42,0.25)',
                            minWidth: { xs: '85vw', sm: '520px' },
                            maxWidth: '720px',
                            mx: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2.5,
                        })}
                    >

                        <Typography
                            variant="h6"
                            align="center"
                            sx={{ fontWeight: 700, letterSpacing: 0.4 }}
                        >
                            Candidate Relevancy Breakdown
                        </Typography>

                        {relevancyLoading && (
                            <LinearProgress sx={{ borderRadius: 999 }} />
                        )}

                        {selectedRelevancy ? (
                            <>
                                <Typography
                                    variant="subtitle1"
                                    align="center"
                                    sx={{
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: 1.2,
                                        color: 'text.primary',
                                    }}
                                >
                                    {selectedRelevancy.name}
                                </Typography>

                                <Box
                                    sx={{
                                        mt: 1,
                                        p: 2.5,
                                        borderRadius: 2,
                                        background: 'linear-gradient(135deg,#eff6ff 0%,#e0f2fe 100%)',
                                        border: '1px solid #dbeafe',
                                    }}
                                >
                                    <Typography
                                        variant="subtitle2"
                                        sx={{
                                            fontWeight: 600,
                                            mb: 1,
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.8,
                                            color: '#1d4ed8',
                                        }}
                                    >
                                        Overview
                                    </Typography>
                                    <Typography
                                        variant="h6"
                                        sx={{ fontWeight: 700, color: '#111827' }}
                                    >
                                        Total Relevancy: {selectedRelevancy.candidateRelevancyToJob}%
                                    </Typography>
                                </Box>

                                <Box
                                    sx={{
                                        mt: 2,
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                        rowGap: 1.5,
                                        columnGap: 4,
                                    }}
                                >
                                    <Box>
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.secondary', fontWeight: 500 }}
                                        >
                                            Experience Relevancy
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {selectedRelevancy.experienceRelevancy}
                                        </Typography>
                                    </Box>

                                    <Box>
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.secondary', fontWeight: 500 }}
                                        >
                                            Skills Relevancy
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {selectedRelevancy.skillsRelevancy}
                                        </Typography>
                                    </Box>

                                    <Box>
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.secondary', fontWeight: 500 }}
                                        >
                                            Responsibilities Relevancy
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {selectedRelevancy.responsibilitiesRelevancy}
                                        </Typography>
                                    </Box>

                                    <Box>
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.secondary', fontWeight: 500 }}
                                        >
                                            Designation Relevancy
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {selectedRelevancy.designationRelevancy}
                                        </Typography>
                                    </Box>

                                    {/* ★ Extra fields in the modal */}
                                    <Box>
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.secondary', fontWeight: 500 }}
                                        >
                                            Salary Relevancy
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {selectedRelevancy.salaryRelevancy}
                                        </Typography>
                                    </Box>

                                    <Box>
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.secondary', fontWeight: 500 }}
                                        >
                                            Notice Period Relevancy
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {selectedRelevancy.noticePeriodRelevancy}
                                        </Typography>
                                    </Box>

                                    <Box>
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.secondary', fontWeight: 500 }}
                                        >
                                            Interest Relevancy
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {selectedRelevancy.interestRelevancy}
                                        </Typography>
                                    </Box>

                                    <Box>
                                        <Typography
                                            variant="body2"
                                            sx={{ color: 'text.secondary', fontWeight: 500 }}
                                        >
                                            Communication Relevancy
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {selectedRelevancy.communicationRelevancy}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ mt: 2.5 }}>
                                    <Typography
                                        variant="subtitle2"
                                        sx={{ mb: 0.8, fontWeight: 600 }}
                                    >
                                        Reason
                                    </Typography>
                                    <Box
                                        sx={theme => ({
                                            p: 1.5,
                                            borderRadius: 2,
                                            backgroundColor:
                                                theme.palette.mode === 'dark'
                                                    ? 'rgba(15,23,42,0.9)'
                                                    : '#f1f5f9',
                                        })}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{ whiteSpace: 'pre-wrap' }}
                                        >
                                            {selectedRelevancy.reason}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                                    <MUIButton onClick={() => setRelevancyModalOpen(false)}>
                                        Close
                                    </MUIButton>
                                </Box>
                            </>
                        ) : (
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="body2">No data to display.</Typography>
                            </Box>
                        )}
                    </Box>
                </MUIModal>

                <JobShareLinkModal
                    open={shareModalOpen}
                    onClose={() => setShareModalOpen(false)}
                    job={job}
                    user={authState.user}
                />

            </Box>
            : null
    );
}
