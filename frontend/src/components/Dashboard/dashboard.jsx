import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    CardContent,
    CircularProgress,
    Checkbox,
    FormControlLabel,
    IconButton,
    Menu,
    MenuItem,
    TablePagination,
    TextField,
    Tooltip,
    Typography,
    LinearProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import VideoCameraFrontOutlinedIcon from '@mui/icons-material/VideoCameraFrontOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';


import { fetchData, performDeploySafeFetch } from '../../AppUtils/dataAPI';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useDashboardContextState } from '../../contexts/DashboardContext';
import { useResetAllContexts } from '../../contexts/ResetContext';
import { useUiContextState } from '../../contexts/UiContext';
import MUIRetrieveDataGrid from '../MUI/CommonCRUD/MUIRetrieveDataGrid';
import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import MUIModal from '../MUI/commonUI/MUIModal';
import MUIButton from '../MUI/commonUI/MUIButton';
import LogoutConfirmDialog from '../MUI/commonUI/LogoutConfirmDialog';

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

const toErrorMessage = (value) => {
    if (value == null) return 'Unknown error';
    if (typeof value === 'string') return value;
    if (typeof value?.message === 'string') return value.message;
    try {
        return JSON.stringify(value);
    } catch {
        try {
            return String(value);
        } catch {
            return 'Unserializable error';
        }
    }
};

const normalizeLabel = value =>
    String(value ?? '')
        .trim()
        .toLowerCase();

const pickFirstText = (...values) =>
    values
        .map(value => (typeof value === 'string' ? value.trim() : value))
        .find(value => typeof value === 'string' && value);

const getCompanyName = item =>
    pickFirstText(
        item?.company,
        item?.companyName,
        item?.companyTitle,
        item?.company?.name,
    ) || '';

const getJobTitle = item =>
    pickFirstText(
        item?.title,
        item?.jobTitle,
        item?.job,
        item?.jobName,
        item?.job?.title,
    ) || '';

const getUniqueById = (items = [], fallbackKeyBuilder) => {
    const seen = new Set();

    return items.filter(item => {
        const fallbackKey = typeof fallbackKeyBuilder === 'function'
            ? fallbackKeyBuilder(item)
            : JSON.stringify(item);
        const key = String(item?.id || item?._id || fallbackKey || '');

        if (!key || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
};

const getItemId = (...values) =>
    values.find(value => value !== undefined && value !== null && String(value).trim());

export default function Dashboard() {
    const [authState] = useAuthContextState();
    const [dashboardState, setDashboardState] = useDashboardContextState();
    const [, setUiState] = useUiContextState();
    const resetAllContexts = useResetAllContexts();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const me = authState?.user ?? {};
    const role = me.role;
    const clientId = me.client ?? me._id;
    const normalizedRole = role === 'manager' ? 'client_admin' : role;

    const { id: recruiterIdParam } = useParams();
    const viewingAsRecruiter =
        ['client_admin', 'manager'].includes(role) && !!recruiterIdParam;
    const effectiveRole = viewingAsRecruiter ? 'recruiter' : normalizedRole;
    const subjectUserId = viewingAsRecruiter ? recruiterIdParam : me._id;

    const [loading, setLoading] = useState(true);
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

    const [reportDlg, setReportDlg] = useState(false);
    const [fromDate, setFromDate] = useState(null);
    const [toDate, setToDate] = useState(null);
    const [reportType, setReportType] = useState('recruiter');

    const [fltFrom, setFltFrom] = useState(null);
    const [fltTo, setFltTo] = useState(null);

    // summary sheet field selection (checkboxes in modal)
    const [summaryFieldConfig, setSummaryFieldConfig] = useState({});

    const nav = useNavigate();
    const handleKeyboardNavigation = (event, targetPath) => {
        if (!targetPath) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            nav(targetPath);
        }
    };
    const getJobNavigationTarget = item => {
        const jobId = getItemId(item?.jobId, item?.job?._id, item?._id, item?.id);
        return jobId ? `/jobs/${jobId}` : '/jobs';
    };
    const getCandidateNavigationTarget = item => {
        const candidateId = getItemId(
            item?.candidateId,
            item?.candidate?._id,
            item?._id,
            item?.id,
        );
        return candidateId ? `/candidates/${candidateId}` : '/candidates';
    };
    const getInterviewNavigationTarget = item => {
        const interviewId = getItemId(
            item?.interviewId,
            item?.scheduleId,
            item?._id,
            item?.id,
        );
        return interviewId ? `/interviews/${interviewId}` : '/interviews';
    };
    const [adminRecruiterStats, setAdminRecruiterStats] = useState([]);

    // overall totals for recruiter (their own)
    const [recruiterTotals, setRecruiterTotals] = useState({
        candidates: 0,
        jobs: 0,
    });
    const [recruiterTotalInterviews, setRecruiterTotalInterviews] = useState(0);

    // total AI call minutes for this client (used on recruiter + client-admin dashboards)
    const [totalAiCallMinutes, setTotalAiCallMinutes] = useState(0);

    const [clientAdminOverview, setClientAdminOverview] = useState({
        activeJobs: [],
        activeJobsTotal: 0,
        stuckCandidates: [],
        pendingInterviews: [],
        pendingInterviewsTotal: 0,
        totalInterviews: 0,
        interviewCountsByRecruiter: [],
    });

    const [rangeAnchorEl, setRangeAnchorEl] = useState(null);
    const [rangePreset, setRangePreset] = useState('all');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [companyAnchorEl, setCompanyAnchorEl] = useState(null);
    const [jobAnchorEl, setJobAnchorEl] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState('All Companies');
    const [selectedJob, setSelectedJob] = useState('All Jobs');
    const recruiterActivityRowsPerPage = 10;
    const [recruiterActivityPage, setRecruiterActivityPage] = useState(0);

    // Intercept browser back on Dashboard to confirm logout
    useEffect(() => {
        if (recruiterIdParam) return;

        const pushGuardState = () => {
            try {
                window.history.pushState(
                    { dashboardGuard: true },
                    '',
                    window.location.href,
                );
            } catch {
                /* no-op */
            }
        };

        pushGuardState();

        const onPopState = () => {
            pushGuardState();
            setLogoutConfirmOpen(true);
        };

        window.addEventListener('popstate', onPopState);
        return () => {
            window.removeEventListener('popstate', onPopState);
        };
    }, [recruiterIdParam]);

    const handleConfirmLogout = () => {
        setLogoutConfirmOpen(false);
        resetAllContexts();
        try {
            localStorage.removeItem('token');
        } catch {
            /* empty */
        }
        // nav('/auth/login');
    };

    const loadData = async () => {
        setLoading(true);
        setUiState({ loadingMsg: 'Loading, Please wait...' });

        try {
            if (effectiveRole === 'recruiter') {
                // keep "recent" lists for tables (MY section stuff)
                const [coRaw, caRaw, joRaw] = await Promise.all([
                    performDeploySafeFetch("Load Companies", () => fetchData(
                        `/api/companies/?viewMode=${viewingAsRecruiter ? 'byUser' : 'me'
                        }&userId=${subjectUserId}&limit=3`,
                    )),
                    performDeploySafeFetch("Load Candidates", () => fetchData(
                        `/api/candidates/?viewMode=${viewingAsRecruiter ? 'byUser' : 'me'
                        }&userId=${subjectUserId}&limit=3`,
                    )),
                    performDeploySafeFetch("Load Jobs", () => fetchData(
                        `/api/jobs/?viewMode=${viewingAsRecruiter ? 'byUser' : 'me'
                        }&userId=${subjectUserId}&resolveCompanies=true&limit=3`,
                    )),
                ]);

                const myCompanies = coRaw ?? [];
                const myCandidates = caRaw ?? [];
                const myJobs = joRaw ?? [];

                setDashboardState({
                    dashboardCompanies: myCompanies,
                    dashboardCandidates: myCandidates,
                    dashboardJobs: myJobs,
                });

                // consolidated totals + stats + AI minutes from backend
                const qs = new URLSearchParams();
                if (subjectUserId) {
                    qs.set('subjectUserId', subjectUserId);
                }

                let overview = await performDeploySafeFetch("Load Overview", () => fetchData(
                    `/api/dashboard/overview${qs.toString() ? `?${qs.toString()}` : ''}`,
                    { method: 'GET' },
                ));

                // When querying with subjectUserId, totalInterviews isn't returned.
                // Fetch a client-wide snapshot to hydrate aggregate interview counts.
                if (!overview?.totalInterviews) {
                    const clientWide = await performDeploySafeFetch("Load Overview (client)", () => fetchData(
                        '/api/dashboard/overview',
                        { method: 'GET' },
                    ));
                    if (clientWide) {
                        overview = { ...clientWide, ...overview };
                    }
                }

                const recruiterTotalsFromApi = overview?.recruiterTotals || {};
                setRecruiterTotals({
                    candidates: Number(recruiterTotalsFromApi.candidates || 0),
                    jobs: Number(recruiterTotalsFromApi.jobs || 0),
                });
                setRecruiterTotalInterviews(
                    Number(overview?.totalInterviews || 0),
                );

                const statsForTotals = overview?.adminRecruiterStats || [];
                setAdminRecruiterStats(statsForTotals);

                setTotalAiCallMinutes(
                    Number(overview?.totalAiCallMinutes || 0),
                );
            } else if (effectiveRole === 'client_admin') {
                const hasFilter = Boolean(fltFrom && fltTo);
                const params = new URLSearchParams();

                if (hasFilter) {
                    const fromStr = fltFrom.format('YYYY-MM-DD');
                    const toStr = fltTo.format('YYYY-MM-DD');
                    params.set('from', fromStr);
                    params.set('to', toStr);
                }

                const overview = await performDeploySafeFetch("Load Overview", () => fetchData(
                    `/api/dashboard/overview${params.toString() ? `?${params.toString()}` : ''}`,
                    { method: 'GET' },
                ));

                const stats = overview?.adminRecruiterStats || [];
                setAdminRecruiterStats(stats);
                setDashboardState({ dashboardRecruiters: stats });

                setTotalAiCallMinutes(
                    Number(overview?.totalAiCallMinutes || 0),
                );

                setClientAdminOverview({
                    activeJobs: Array.isArray(overview?.activeJobs)
                        ? overview.activeJobs
                        : [],
                    activeJobsTotal: Number(overview?.activeJobsTotal || 0),
                    stuckCandidates: Array.isArray(overview?.stuckCandidates)
                        ? overview.stuckCandidates
                        : [],
                    pendingInterviews: Array.isArray(overview?.pendingInterviews)
                        ? overview.pendingInterviews
                        : [],
                    pendingInterviewsTotal: Number(
                        overview?.pendingInterviewsTotal || 0,
                    ),
                    totalInterviews: Number(overview?.totalInterviews || 0),
                    interviewCountsByRecruiter: Array.isArray(
                        overview?.interviewCountsByRecruiter,
                    )
                        ? overview.interviewCountsByRecruiter
                        : [],
                });
            } else if (effectiveRole === 'ultra_admin') {
                const admins = await performDeploySafeFetch("Load Admins", () => fetchData('/api/admins/?limit=5'));
                setDashboardState({
                    dashboardUaAdmins: Array.isArray(admins) ? admins : [],
                });
            }
        } catch (err) {
            console.error(`[Dashboard] fetch error: ${toErrorMessage(err)}`);
        } finally {
            setLoading(false);
            setUiState({ loadingMsg: null });
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveRole, subjectUserId, clientId]);

    useEffect(() => {
        const fltFrom_$y = fltFrom?.$y || 0;
        const fltTo_$y = fltTo?.$y || 0;

        if (
            !fltFrom
                ?.format?.('YYYY-MM-DD')
                ?.toLowerCase?.()
                ?.includes('invalid') &&
            fltFrom_$y >= 2000 &&
            !fltTo
                ?.format?.('YYYY-MM-DD')
                ?.toLowerCase?.()
                ?.includes('invalid') &&
            fltTo_$y >= 2000
        ) {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fltFrom, fltTo]);

    // initialise summaryFieldConfig for client_admin from recruiter stats
    useEffect(() => {
        if (effectiveRole !== 'client_admin') return;
        if (!adminRecruiterStats.length) return;

        setSummaryFieldConfig(prev => {
            if (Object.keys(prev || {}).length) {
                return prev;
            }

            const disallowed = ['recruiterId', '_id'];
            const initial = {};

            adminRecruiterStats.forEach(r => {
                if (!r || typeof r !== 'object') return;
                Object.keys(r).forEach(k => {
                    if (disallowed.includes(k)) return;
                    initial[k] = true; // default: all selected
                });
            });

            return initial;
        });
    }, [effectiveRole, adminRecruiterStats]);

    const downloadReport = async () => {
        if (!fromDate || !toDate) {
            alert('Please pick both dates');
            return;
        }
        const fromStr = fromDate.format('DD/MM/YYYY');
        const toStr = toDate.format('DD/MM/YYYY');
        const normalizedReportType = reportType === 'manager' ? 'manager' : 'recruiter';

        let selectedSummaryKeys = [];

        if (effectiveRole === 'client_admin' && summaryFieldConfig && typeof summaryFieldConfig === 'object') {
            selectedSummaryKeys = Object.entries(summaryFieldConfig)
                .filter(([, checked]) => checked)
                .map(([key]) => key);

            if (!selectedSummaryKeys.length) {
                alert('Please select at least one summary field');
                return;
            }
        }

        setUiState({ loadingMsg: 'Downloading, Please wait...' });
        try {
            let url = `/api/dashboard/recruiter-report?from=${encodeURIComponent(
                fromStr || "",
            )}&to=${encodeURIComponent(toStr || "")}&role=${encodeURIComponent(normalizedReportType)}`;

            if (selectedSummaryKeys.length) {
                url += `&summaryFields=${encodeURIComponent(selectedSummaryKeys.join(',') || "")}`;
            }

            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });

            if (!res.ok) {
                const { error } = await res.json();
                const serverError = toErrorMessage(error);
                console.error(`[DownloadReport] Server returned error: ${serverError}`);
                throw new Error(serverError || 'Download failed');
            }
            const blob = await res.blob();
            const objectUrl = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = `${normalizedReportType}_report_${fromStr.replace(
                /\//g,
                '-',
            )}_to_${toStr.replace(/\//g, '-')}.xlsx`;

            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(objectUrl);
            setReportDlg(false);
        } catch (err) {
            const message = toErrorMessage(err);
            console.error(`[DownloadReport] Error during download: ${message}`);
            alert(message);
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const getSummaryFieldLabel = key => {
        switch (key) {
            case 'firstName':
                return 'First Name';
            case 'lastName':
                return 'Last Name';
            case 'email':
                return 'Email';
            case 'role':
                return 'Role';
            case 'companies':
                return 'Company(s) Created';
            case 'jobs':
                return 'Job(s) Created';
            case 'candidates':
                return 'Candidate(s) Uploaded';
            default:
                return key;
        }
    };
    const adminRows = useMemo(() => {
        if (effectiveRole !== 'client_admin' || loading) return [];
        return adminRecruiterStats.map((r, index) => ({
            ...r,
            id: r.recruiterId + '___' + String(index),
            fullName: [r.firstName, r.lastName].filter(Boolean).join(' '),
        }));
    }, [effectiveRole, loading, adminRecruiterStats]);

    const ultraRows = useMemo(() => {
        if (effectiveRole !== 'ultra_admin' || loading) return [];
        return dashboardState?.dashboardUaAdmins.map((ClientAdmin, idx) => ({
            id: ClientAdmin._id,
            sn: idx + 1,
            firstName: ClientAdmin.user?.firstName || '',
            lastName: ClientAdmin.user?.lastName || '',
            email: ClientAdmin.user?.email || '',
            clientCompany: ClientAdmin.clientCompany || '�',
            totalCredit: ClientAdmin.totalCredit ?? '�',
            videoInterviewCredit: ClientAdmin.videoInterviewCredit ?? '�',
            creditRatePerCall: ClientAdmin.creditRatePerCall ?? '�',
        }));
    }, [effectiveRole, loading, dashboardState?.dashboardUaAdmins]);

    // RECRUITER "MY" SUMMARY (their own totals)
    const recruiterSummary = useMemo(() => {
        if (effectiveRole !== 'recruiter') return null;
        const jobs = Number(recruiterTotals.jobs || 0);
        const candidates = Number(recruiterTotals.candidates || 0);
        const max = Math.max(jobs, candidates, 1);
        return { jobs, candidates, max };
    }, [effectiveRole, recruiterTotals.jobs, recruiterTotals.candidates]);

    // RECRUITER "TOTAL" SUMMARY (whole client totals like client-admin cards)
    const recruiterTotalSummary = useMemo(() => {
        if (effectiveRole !== 'recruiter' || !adminRecruiterStats.length)
            return null;

        const totals = adminRecruiterStats.reduce(
            (acc, r) => {
                let recruiterInitialAiCalls = 0;
                try {
                    const keys = Object.keys(r || {});
                    const aiKeys = keys.filter(k => {
                        const lk = k.toLowerCase();
                        return (
                            lk.includes('initial') &&
                            lk.includes('ai') &&
                            lk.includes('call') &&
                            (lk.includes('candidate') || lk.includes('cand'))
                        );
                    });
                    if (aiKeys.length) {
                        recruiterInitialAiCalls = aiKeys.reduce(
                            (sum, k) => sum + (Number(r[k] ?? 0) || 0),
                            0,
                        );
                    }
                } catch {
                    recruiterInitialAiCalls = 0;
                }

                return {
                    companies: acc.companies + (r.companies || 0),
                    jobs: acc.jobs + (r.jobs || 0),
                    candidates: acc.candidates + (r.candidates || 0),
                    aiCalls: acc.aiCalls + recruiterInitialAiCalls,
                };
            },
            { companies: 0, jobs: 0, candidates: 0, aiCalls: 0 },
        );

        return { totals };
    }, [effectiveRole, adminRecruiterStats]);

    // CLIENT-ADMIN SUMMARY + TOP 5 (analytics)
    const clientAdminSummary = useMemo(() => {
        if (effectiveRole !== 'client_admin' || !adminRecruiterStats.length)
            return null;

        const totals = adminRecruiterStats.reduce(
            (acc, r) => {
                let recruiterInitialAiCalls = 0;
                try {
                    const keys = Object.keys(r || {});
                    const aiKeys = keys.filter(k => {
                        const lk = k.toLowerCase();
                        return (
                            lk.includes('initial') &&
                            lk.includes('ai') &&
                            lk.includes('call') &&
                            (lk.includes('candidate') || lk.includes('cand'))
                        );
                    });
                    if (aiKeys.length) {
                        recruiterInitialAiCalls = aiKeys.reduce(
                            (sum, k) => sum + (Number(r[k] ?? 0) || 0),
                            0,
                        );
                    }
                } catch {
                    recruiterInitialAiCalls = 0;
                }

                return {
                    companies: acc.companies + (r.companies || 0),
                    jobs: acc.jobs + (r.jobs || 0),
                    candidates: acc.candidates + (r.candidates || 0),
                    aiCalls: acc.aiCalls + recruiterInitialAiCalls,
                };
            },
            { companies: 0, jobs: 0, candidates: 0, aiCalls: 0 },
        );

        const topByCandidates = [...adminRecruiterStats]
            .sort((a, b) => (b.candidates || 0) - (a.candidates || 0))
            .slice(0, 5)
            .map((r, idx) => {
                const name =
                    [r.firstName, r.lastName].filter(Boolean).join(' ') ||
                    r.email ||
                    `Recruiter ${idx + 1}`;
                const companies = r.companies || 0;
                const jobs = r.jobs || 0;
                const candidates = r.candidates || 0;
                const activity = companies + jobs + candidates;
                return {
                    id: r.recruiterId || idx,
                    name,
                    companies,
                    jobs,
                    candidates,
                    activity,
                };
            });

        const maxCandidates = Math.max(
            ...topByCandidates.map(t => t.candidates),
            1,
        );

        return { totals, topByCandidates, maxCandidates };
    }, [effectiveRole, adminRecruiterStats]);

    const recruiterActivityRows = useMemo(() => {
        if (!adminRecruiterStats.length) return [];

        const interviewMap = new Map();
        (clientAdminOverview?.interviewCountsByRecruiter || []).forEach(
            item => {
                const key =
                    item?.recruiterId?.toString?.() ||
                    String(item?.recruiterId || '');
                if (!key) return;
                interviewMap.set(key, Number(item?.interviews || 0));
            },
        );

        return adminRecruiterStats
            .map((r, index) => {
                const recruiterId = r.recruiterId
                    ? String(r.recruiterId)
                    : r._id
                        ? String(r._id)
                        : String(index);
                const rowRole = String(r.role || '').toLowerCase();
                const roleSuffix = rowRole === 'manager'
                    ? ' (Manager)'
                    : rowRole === 'client_admin'
                        ? ' (Client Admin)'
                        : '';
                const name =
                    [r.firstName, r.lastName].filter(Boolean).join(' ') ||
                    r.email ||
                    `Recruiter ${index + 1}`;

                return {
                    id: recruiterId,
                    name: `${name}${roleSuffix}`,
                    email: r.email,
                    role: rowRole,
                    jobsAssigned: Number(r.jobs || 0),
                    candidatesManaged: Number(r.candidates || 0),
                    interviews: interviewMap.get(String(recruiterId)) || 0,
                };
            })
            .sort(
                (a, b) =>
                    b.candidatesManaged - a.candidatesManaged ||
                    b.jobsAssigned - a.jobsAssigned,
            );
    }, [
        adminRecruiterStats,
        clientAdminOverview?.interviewCountsByRecruiter,
    ]);

    const recruiterActivityPageRows = useMemo(() => {
        const start = recruiterActivityPage * recruiterActivityRowsPerPage;
        return recruiterActivityRows.slice(
            start,
            start + recruiterActivityRowsPerPage,
        );
    }, [
        recruiterActivityRows,
        recruiterActivityPage,
        recruiterActivityRowsPerPage,
    ]);

    useEffect(() => {
        const maxPage = Math.max(
            Math.ceil(
                recruiterActivityRows.length / recruiterActivityRowsPerPage,
            ) - 1,
            0,
        );
        setRecruiterActivityPage(prev =>
            prev > maxPage ? maxPage : prev,
        );
    }, [recruiterActivityRows.length, recruiterActivityRowsPerPage]);

    const companyOptions = useMemo(() => {
        const names = new Set();
        [
            ...(clientAdminOverview?.activeJobs || []),
            ...(clientAdminOverview?.stuckCandidates || []),
            ...(clientAdminOverview?.pendingInterviews || []),
        ].forEach(item => {
            const companyName = getCompanyName(item);
            if (companyName) names.add(companyName);
        });
        return ['All Companies', ...Array.from(names).sort()];
    }, [
        clientAdminOverview?.activeJobs,
        clientAdminOverview?.stuckCandidates,
        clientAdminOverview?.pendingInterviews,
    ]);

    const jobOptions = useMemo(() => {
        const titles = new Set();
        [
            ...(clientAdminOverview?.activeJobs || []),
            ...(clientAdminOverview?.stuckCandidates || []),
            ...(clientAdminOverview?.pendingInterviews || []),
        ]
            .filter(item => {
                if (selectedCompany === 'All Companies') {
                    return true;
                }
                return (
                    normalizeLabel(getCompanyName(item)) ===
                    normalizeLabel(selectedCompany)
                );
            })
            .forEach(item => {
                const title = getJobTitle(item);
                if (title) titles.add(title);
            });
        return ['All Jobs', ...Array.from(titles).sort()];
    }, [
        clientAdminOverview?.activeJobs,
        clientAdminOverview?.stuckCandidates,
        clientAdminOverview?.pendingInterviews,
        selectedCompany,
    ]);

    useEffect(() => {
        if (!companyOptions.includes(selectedCompany)) {
            setSelectedCompany('All Companies');
        }
    }, [companyOptions, selectedCompany]);

    useEffect(() => {
        if (!jobOptions.includes(selectedJob)) {
            setSelectedJob('All Jobs');
        }
    }, [jobOptions, selectedJob]);

    if (effectiveRole === 'ultra_admin') {
        const uaCols = [
            {
                field: 'sn',
                headerName: '#',
                maxWidth: 60,
                headerAlign: 'center',
                align: 'center',
            },
            {
                field: 'firstName',
                headerName: 'First Name',
                flex: 1,
                minWidth: 100,
            },
            {
                field: 'lastName',
                headerName: 'Last Name',
                flex: 1,
                minWidth: 100,
            },
            { field: 'email', headerName: 'Email', flex: 1, minWidth: 200 },
            {
                field: 'clientCompany',
                headerName: 'Client Company',
                flex: 1,
                minWidth: 180,
            },
            {
                field: 'totalCredit',
                headerName: 'AI Call Credit',
                flex: 1,
                minWidth: 130,
                headerAlign: 'center',
                align: 'center',
            },
            {
                field: 'videoInterviewCredit',
                headerName: 'Video Interview Credit',
                flex: 1,
                minWidth: 170,
                headerAlign: 'center',
                align: 'center',
            },
            {
                field: 'creditRatePerCall',
                headerName: 'Credit Rate Per Call',
                flex: 1,
                minWidth: 160,
                headerAlign: 'center',
                align: 'center',
            },
        ];

        return (
            <Box
                sx={{
                    px: { xs: 2, sm: 3, md: 5 },
                    pt: { xs: 1, sm: 1.5, md: 2 },
                    pb: { xs: 2, sm: 3, md: 5 },
                    mx: { xs: 0, sm: "1vw" },
                    my: { xs: 0, sm: 0.5 },
                    minHeight: "80vh"
                }}
            >
                <Typography
                    variant="h5"
                    align="center"
                    sx={{ mb: 3, fontWeight: 600 }}
                >
                    Ultra-Admin Dashboard
                    <Tooltip title="Refresh Dashboard">
                        <IconButton onClick={() => loadData()}>
                            <RefreshRoundedIcon />
                        </IconButton>
                    </Tooltip>
                </Typography>
                {/* <Divider sx={{ mb: 3 }} /> */}

                {loading ? (
                    <Box sx={{ mt: 6, textAlign: 'center' }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={{ width: '100%', overflowX: 'auto', mt: 4 }}>
                        <MUIRetrieveDataGrid
                            title="Client-Admins Overview"
                            rows={ultraRows}
                            columns={uaCols}
                            hideToolbar={!ultraRows.length}
                            onRowClick={row => nav(`/admins/${row.id}`)}
                            createButton={<span></span>}
                        />
                    </Box>
                )}
                <LogoutConfirmDialog
                    open={logoutConfirmOpen}
                    onClose={() => setLogoutConfirmOpen(false)}
                    onConfirm={handleConfirmLogout}
                    title="Do you want to log out?"
                    description=""
                    confirmLabel="Yes"
                    cancelLabel="No"
                />
            </Box>
        );
    }

    if (effectiveRole === 'recruiter') {
        if (loading) {
            return (
                <Box sx={{ mt: 8, textAlign: 'center' }}>
                    <CircularProgress />
                </Box>
            );
        }

        const make = (arr, map) =>
            Array.isArray(arr) ? arr.map(map) : [];

        const totals = recruiterTotalSummary?.totals || {
            companies: 0,
            jobs: 0,
            candidates: 0,
            aiCalls: 0
        };

        const myStats =
            adminRecruiterStats.find(
                r =>
                    String(r.recruiterId || r._id || '') ===
                    String(subjectUserId || ''),
            ) || {};
        const myCompanies = Number(myStats?.companies || 0);

        const statCards = [
            {
                key: 'myCompanies',
                label: 'My Companies',
                value: myCompanies,
                subLabel: 'Accounts I manage',
                icon: <BusinessRoundedIcon fontSize="small" />,
                to: '/companies/',
            },
            {
                key: 'myJobs',
                label: 'My Jobs',
                value: recruiterSummary?.jobs ?? 0,
                subLabel: 'Open roles I own',
                icon: <WorkOutlineRoundedIcon fontSize="small" />,
                to: '/jobs/',
            },
            {
                key: 'myCandidates',
                label: 'My Candidates',
                value: recruiterSummary?.candidates ?? 0,
                subLabel: 'Active in my pipeline',
                icon: <PeopleAltOutlinedIcon fontSize="small" />,
                to: '/candidates/',
            },
            {
                key: 'totalAiCalls',
                label: 'Total Calls',
                value: totals.aiCalls ?? 0,
                subLabel: `${totalAiCallMinutes || 0} mins (client)`,
                icon: <SmartToyOutlinedIcon fontSize="small" />,
                to: '/ai-call-logs',
            },
            {
                key: 'totalInterviews',
                label: 'Total Interviews',
                value: recruiterTotalInterviews,
                subLabel: 'Client-wide',
                icon: <VideoCameraFrontOutlinedIcon fontSize="small" />,
                to: '/interviews',
            },
        ];

        const recentCompanies = make(dashboardState?.dashboardCompanies, c => ({
            id: c._id,
            name: c.name || '�',
            industry: c.industry || '�',
            website: c.website || '�',
        }));
        const recentJobs = make(dashboardState?.dashboardJobs, j => ({
            id: j._id,
            title: j.title || '�',
            type: j.jobType || '�',
            company: j.company?.name || '�',
        }));
        const recentCandidates = make(dashboardState?.dashboardCandidates, c => ({
            id: c._id,
            name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || '�',
            email: c.email || '�',
            phone: c.phoneNumber || '�',
        }));

        const panelSx = {
            bgcolor: 'background.paper',
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            // boxShadow: theme.shadows[1],
            p: 2,
        };

        return (
            <Box
                sx={{
                    px: { xs: 2, sm: 3, md: 5 },
                    pt: { xs: 1, sm: 1.5, md: 2 },
                    pb: { xs: 2, sm: 3, md: 5 },
                    mx: { xs: 0, sm: "1vw" },
                    my: { xs: 0, sm: 0.5 },
                    minHeight: "80vh",
                }}
            >
                <Box sx={{ maxWidth: 1250, mx: 'auto' }}>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 1.5,
                            mb: 2,
                        }}
                    >
                        <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            Recruiter Dashboard
                        </Typography>
                        <Tooltip title="Refresh dashboard">
                            <IconButton
                                onClick={loadData}
                                sx={{
                                    backgroundColor: 'background.paper',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    color: 'text.primary',
                                    '&:hover': { bgcolor: 'action.hover' }
                                }}
                            >
                                <RefreshRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <Box
                        sx={{
                            p: { xs: 1.2, sm: 1.5 },
                            mb: 3,
                            borderRadius: 3,
                            backgroundColor: 'background.paper',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Box
                            sx={{
                                maxWidth: 1100,
                                mx: 'auto',
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: 'repeat(2, minmax(140px, 1fr))',
                                    sm: 'repeat(3, minmax(150px, 1fr))',
                                    md: 'repeat(5, minmax(160px, 1fr))',
                                },
                                justifyContent: 'center',
                                gap: 1.3,
                            }}
                        >
                            {statCards.map(card => (
                                <Box
                                    key={card.key}
                                sx={{
                                    position: 'relative',
                                    borderRadius: 3,
                                    minHeight: 118,
                                        overflow: 'hidden',
                                        backgroundColor: 'background.paper',
                                        color: 'text.primary',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        cursor: card.to ? 'pointer' : 'default',
                                        transition: 'transform 120ms ease, box-shadow 120ms ease',
                                        '&:hover': card.to
                                            ? {
                                                transform: 'translateY(-2px)',
                                                boxShadow: theme.shadows[3],
                                            }
                                            : undefined,
                                    }}
                                    role={card.to ? 'button' : undefined}
                                    tabIndex={card.to ? 0 : -1}
                                    onClick={() => card.to && nav(card.to)}
                                    onKeyDown={event =>
                                        handleKeyboardNavigation(event, card.to)
                                    }
                                >
                                    <CardContent sx={{ p: 2.1 }}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1.2,
                                                mb: 0.4,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: 2,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: alpha(
                                                        theme.palette.primary.main,
                                                        isDark ? 0.26 : 0.14,
                                                    ),
                                                    color: 'primary.main',
                                                    border: '1px solid',
                                                    borderColor: alpha(
                                                        theme.palette.primary.main,
                                                        isDark ? 0.5 : 0.32,
                                                    ),
                                                }}
                                            >
                                                {card.icon}
                                            </Box>
                                            <Typography
                                                variant="h5"
                                                sx={{
                                                    fontWeight: 700,
                                                    letterSpacing: 0.2,
                                                    fontSize: '1.6rem',
                                                    lineHeight: 1.1,
                                                }}
                                            >
                                                {card.value}
                                            </Typography>
                                        </Box>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontWeight: 600,
                                                fontSize: '0.86rem',
                                                color: 'text.secondary',
                                            }}
                                        >
                                            {card.label}
                                        </Typography>
                                        {card.subLabel && (
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    display: 'inline-block',
                                                    mt: 0.4,
                                                    color: 'primary.main',
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {card.subLabel}
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Box>
                            ))}
                        </Box>
                    </Box>

                    <Box sx={{ ...panelSx, mb: 3 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
                            Recent Companies
                        </Typography>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 1.2fr',
                                gap: 2,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: 'text.secondary',
                                textTransform: 'uppercase',
                                pb: 1,
                                borderBottom: '1px solid',
                                borderColor: 'divider'
                            }}
                        >
                            <span>Name</span>
                            <span>Industry</span>
                            <span>Website</span>
                        </Box>
                        {recentCompanies.map(row => (
                            <Box
                                key={row.id}
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1fr 1.2fr',
                                    gap: 2,
                                    py: 1,
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    alignItems: 'center',
                                    fontSize: '0.86rem',
                                    color: 'text.primary'
                                }}
                            >
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {row.name}
                                </Typography>
                                <Typography variant="body2">{row.industry}</Typography>
                                <Typography variant="body2" sx={{ color: 'primary.main' }}>
                                    {row.website}
                                </Typography>
                            </Box>
                        ))}
                        <Box sx={{ mt: 1 }}>
                            <MUIButton
                                sx={{ textTransform: 'none', px: 2, py: 0.6 }}
                                onClick={() => nav('/companies/')}
                                label="View All"
                            />
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                            gap: 2
                        }}
                    >
                        <Box sx={panelSx}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
                                Recent Jobs
                            </Typography>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1fr 1.4fr',
                                    gap: 2,
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: 'text.secondary',
                                    textTransform: 'uppercase',
                                    pb: 1,
                                    borderBottom: '1px solid',
                                    borderColor: 'divider'
                                }}
                            >
                                <span>Title</span>
                                <span>Type</span>
                                <span>Company</span>
                            </Box>
                            {recentJobs.map(row => (
                                <Box
                                    key={row.id}
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: '2fr 1fr 1.4fr',
                                        gap: 2,
                                        py: 1,
                                        borderBottom: '1px solid',
                                        borderColor: 'divider',
                                        alignItems: 'center',
                                        fontSize: '0.86rem',
                                        color: 'text.primary'
                                    }}
                                >
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {row.title}
                                    </Typography>
                                    <Typography variant="body2">{row.type}</Typography>
                                    <Typography variant="body2">{row.company}</Typography>
                                </Box>
                            ))}
                            <Box sx={{ mt: 1 }}>
                                <MUIButton
                                    sx={{ textTransform: 'none', px: 2, py: 0.6 }}
                                    onClick={() => nav('/jobs/')}
                                    label="View All"
                                />
                            </Box>
                        </Box>

                        <Box sx={panelSx}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
                                Recent Candidates
                            </Typography>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: '1.2fr 1.6fr 1fr',
                                    gap: 2,
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: 'text.secondary',
                                    textTransform: 'uppercase',
                                    pb: 1,
                                    borderBottom: '1px solid',
                                    borderColor: 'divider'
                                }}
                            >
                                <span>Name</span>
                                <span>Email</span>
                                <span>Phone</span>
                            </Box>
                            {recentCandidates.map(row => (
                                <Box
                                    key={row.id}
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: '1.2fr 1.6fr 1fr',
                                        gap: 2,
                                        py: 1,
                                        borderBottom: '1px solid',
                                        borderColor: 'divider',
                                        alignItems: 'center',
                                        fontSize: '0.86rem',
                                        color: 'text.primary'
                                    }}
                                >
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {row.name}
                                    </Typography>
                                    <Typography variant="body2">{row.email}</Typography>
                                    <Typography variant="body2">{row.phone}</Typography>
                                </Box>
                            ))}
                            <Box sx={{ mt: 1 }}>
                                <MUIButton
                                    sx={{ textTransform: 'none', px: 2, py: 0.6 }}
                                    onClick={() => nav('/candidates/')}
                                    label="View All"
                                />
                            </Box>
                        </Box>
                    </Box>

                </Box>

                <LogoutConfirmDialog
                    open={logoutConfirmOpen}
                    onClose={() => setLogoutConfirmOpen(false)}
                    onConfirm={handleConfirmLogout}
                    title="Do you want to log out?"
                    description=""
                    confirmLabel="Yes"
                    cancelLabel="No"
                />
            </Box>
        );
    }
    if (effectiveRole === 'client_admin') {
        const cols = [
            {
                field: 'fullName',
                headerName: 'Name',
                flex: 1,
                headerAlign: 'center',
            },
            {
                field: 'email',
                headerName: 'Email',
                flex: 1,
                headerAlign: 'center',
            },
            {
                field: 'companies',
                headerName: 'Companies',
                flex: 1,
                headerAlign: 'center',
                align: 'center',
            },
            {
                field: 'jobs',
                headerName: 'Jobs',
                flex: 1,
                headerAlign: 'center',
                align: 'center',
            },
            {
                field: 'candidates',
                headerName: 'Candidates',
                flex: 1,
                headerAlign: 'center',
                align: 'center',
            },
        ];

        let allKeys = [];

        adminRows?.forEach?.(ele => {
            Object.keys(ele).forEach(ele1 => {
                allKeys.push(ele1);
            });
        });

        allKeys = [...new Set(allKeys)];

        allKeys?.forEach?.(adminRowsKey => {
            if (
                ![
                    'id',
                    'recruiterId',
                    'firstName',
                    'lastName',
                    'fullName',
                    'email',
                    'companies',
                    'candidates',
                    'jobs',
                ].includes(adminRowsKey)
            ) {
                cols.push({
                    field: adminRowsKey,
                    headerName: adminRowsKey,
                    flex: 1,
                    headerAlign: 'center',
                    align: 'center',
                });
            }
        });

        const today = dayjs();
        const rangeOptions = [
            {
                key: 'all',
                label: 'All',
                getRange: () => ({
                    from: null,
                    to: null,
                }),
            },
            {
                key: 'last7',
                label: 'Last 7 days',
                getRange: () => ({
                    from: today.subtract(6, 'day'),
                    to: today,
                }),
            },
            {
                key: 'last30',
                label: 'Last 30 days',
                getRange: () => ({
                    from: today.subtract(29, 'day'),
                    to: today,
                }),
            },
            {
                key: 'thisMonth',
                label: 'This month',
                getRange: () => ({
                    from: today.startOf('month'),
                    to: today,
                }),
            },
            {
                key: 'last90',
                label: 'Last 90 days',
                getRange: () => ({
                    from: today.subtract(89, 'day'),
                    to: today,
                }),
            },
        ];

        const rangeLabel =
            rangeOptions.find(option => option.key === rangePreset)?.label ||
            (fltFrom?.format?.('DD MMM') && fltTo?.format?.('DD MMM')
                ? `${fltFrom.format('DD MMM')} - ${fltTo.format('DD MMM')}`
                : 'All');

        const totals = clientAdminSummary?.totals || {
            candidates: 0,
            jobs: 0,
            companies: 0,
            aiCalls: 0,
        };

        const activeJobs = getUniqueById(
            Array.isArray(clientAdminOverview?.activeJobs)
                ? clientAdminOverview.activeJobs
                : [],
            job => `${getJobTitle(job)}-${getCompanyName(job)}`,
        );

        const pendingTodayCount =
            Number(clientAdminOverview?.pendingInterviewsTotal || 0) ||
            (Array.isArray(clientAdminOverview?.pendingInterviews)
                ? clientAdminOverview.pendingInterviews.length
                : 0);
        const totalInterviews = Number(
            clientAdminOverview?.totalInterviews || 0,
        );

        const filteredActiveJobs = activeJobs.filter(job => {
            if (
                selectedCompany !== 'All Companies' &&
                normalizeLabel(getCompanyName(job)) !==
                normalizeLabel(selectedCompany)
            ) {
                return false;
            }
            if (
                selectedJob !== 'All Jobs' &&
                normalizeLabel(getJobTitle(job)) !== normalizeLabel(selectedJob)
            ) {
                return false;
            }
            return true;
        });

        const maxActiveCandidates = Math.max(
            ...filteredActiveJobs.map(job => Number(job.candidates || 0)),
            1,
        );

        const filteredStuckCandidates = (
            clientAdminOverview?.stuckCandidates || []
        ).filter(candidate => {
            if (
                selectedCompany !== 'All Companies' &&
                normalizeLabel(getCompanyName(candidate)) !==
                normalizeLabel(selectedCompany)
            ) {
                return false;
            }
            if (
                selectedJob !== 'All Jobs' &&
                normalizeLabel(getJobTitle(candidate)) !==
                normalizeLabel(selectedJob)
            ) {
                return false;
            }
            return true;
        });

        const filteredPendingInterviews = (
            clientAdminOverview?.pendingInterviews || []
        ).filter(interview => {
            if (
                selectedCompany !== 'All Companies' &&
                normalizeLabel(getCompanyName(interview)) !==
                normalizeLabel(selectedCompany)
            ) {
                return false;
            }
            if (
                selectedJob !== 'All Jobs' &&
                normalizeLabel(getJobTitle(interview)) !==
                normalizeLabel(selectedJob)
            ) {
                return false;
            }
            return true;
        });

        const displayedActiveJobs = filteredActiveJobs.slice(0, 4);
        const displayedStuckCandidates = filteredStuckCandidates.slice(0, 4);
        const displayedPendingInterviews = filteredPendingInterviews.slice(
            0,
            4,
        );

        const statCards = [
            {
                key: 'companies',
                label: 'Total Companies',
                value: totals.companies,
                subLabel: `Active: ${Math.max(companyOptions.length - 1, 0)}`,
                icon: <BusinessRoundedIcon fontSize="small" />,
                to: '/companies/?viewMode=all',
            },
            {
                key: 'jobs',
                label: 'Total Jobs',
                value: totals.jobs,
                subLabel: `Active: ${Math.min(filteredActiveJobs.length, Number(totals.jobs || 0))}`,
                icon: <WorkOutlineRoundedIcon fontSize="small" />,
                to: '/jobs/?viewMode=all',
            },
            {
                key: 'candidates',
                label: 'Total Candidates',
                value: totals.candidates,
                subLabel: rangeLabel ? `In ${rangeLabel}` : null,
                icon: <PeopleAltOutlinedIcon fontSize="small" />,
                to: '/candidates/?viewMode=all',
            },
            {
                key: 'aiCalls',
                label: 'AI Calls',
                value: totals.aiCalls,
                subLabel: `${totalAiCallMinutes || 0} mins`,
                icon: <SmartToyOutlinedIcon fontSize="small" />,
                to: '/ai-call-logs',
            },

            {
                key: 'interviews',
                label: 'Interviews',
                value: totalInterviews,
                subLabel: `Active: ${pendingTodayCount}`,
                icon: <VideoCameraFrontOutlinedIcon fontSize="small" />,
                to: '/interviews',
            },
        ];

        const handleRangeSelect = optionKey => {
            const option = rangeOptions.find(o => o.key === optionKey);
            if (!option) return;
            const nextRange = option.getRange();
            setRangePreset(optionKey);
            setFltFrom(nextRange.from);
            setFltTo(nextRange.to);
            setFromDate(nextRange.from);
            setToDate(nextRange.to);
            setRangeAnchorEl(null);
        };

        const pillButtonSx = {
            px: 2,
            py: 1,
            borderRadius: 2,
            textTransform: 'none',
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            color: 'text.primary',
            fontWeight: 600,
            // boxShadow: theme.shadows[1],
            '&:hover': { backgroundColor: 'action.hover' },
        };

        const sectionCardSx = {
            p: 2.5,
            borderRadius: 3,
            backgroundColor: 'background.paper',
            // boxShadow: theme.shadows[1],
            border: '1px solid',
            borderColor: 'divider',
        };

        return (
            <Box
                // component={Paper}
                sx={{
                    px: { xs: 2, sm: 3, md: 5 },
                    pt: { xs: 1, sm: 1.5, md: 2 },
                    pb: { xs: 2, sm: 3, md: 5 },
                    mx: { xs: 0, sm: "1vw" },
                    my: { xs: 0, sm: 0.5 },
                    minHeight: "80vh",
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 2,
                        mb: 3,
                    }}
                >
                    <Typography
                        variant="h4"
                        sx={{ fontWeight: 700, color: 'text.primary' }}
                    >
                        {role === 'manager'
                            ? 'Manager Dashboard'
                            : 'Admin Dashboard'}
                    </Typography>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            flexWrap: 'wrap',
                        }}
                    >
                        <MUIButton
                            endIcon={
                                <KeyboardArrowDownRoundedIcon fontSize="small" />
                            }
                            onClick={event =>
                                setRangeAnchorEl(event.currentTarget)
                            }
                            sx={pillButtonSx}
                        >
                            {rangeLabel}
                        </MUIButton>
                        <MUIButton
                            endIcon={
                                <KeyboardArrowDownRoundedIcon fontSize="small" />
                            }
                            onClick={event =>
                                setCompanyAnchorEl(event.currentTarget)
                            }
                            sx={{
                                ...pillButtonSx,
                                maxWidth: 160,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {selectedCompany}
                        </MUIButton>
                        <MUIButton
                            endIcon={
                                <KeyboardArrowDownRoundedIcon fontSize="small" />
                            }
                            onClick={event =>
                                setJobAnchorEl(event.currentTarget)
                            }
                            sx={{
                                ...pillButtonSx,
                                maxWidth: 160,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {selectedJob}
                        </MUIButton>
                        <MUIButton
                            startIcon={
                                <DownloadOutlinedIcon fontSize="small" />
                            }
                            onClick={() => setFiltersOpen(prev => !prev)}
                            sx={{
                                ...pillButtonSx,
                                backgroundColor: filtersOpen
                                    ? 'action.selected'
                                    : pillButtonSx.backgroundColor,
                            }}
                        >
                            Download Report
                        </MUIButton>
                        <Tooltip title="Refresh">
                            <IconButton
                                onClick={loadData}
                                sx={{
                                    ml: 0.5,
                                    backgroundColor: 'background.paper',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    color: 'text.primary',
                                    '&:hover': {
                                        backgroundColor: 'action.hover',
                                    },
                                }}
                            >
                                <RefreshRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                <Menu
                    anchorEl={rangeAnchorEl}
                    open={Boolean(rangeAnchorEl)}
                    onClose={() => setRangeAnchorEl(null)}
                    PaperProps={{
                        sx: {
                            mt: 1,
                            borderRadius: 2,
                            minWidth: 180,
                        },
                    }}
                >
                    {rangeOptions.map(option => (
                        <MenuItem
                            key={option.key}
                            selected={rangePreset === option.key}
                            onClick={() => handleRangeSelect(option.key)}
                        >
                            {option.label}
                        </MenuItem>
                    ))}
                </Menu>

                <Menu
                    anchorEl={companyAnchorEl}
                    open={Boolean(companyAnchorEl)}
                    onClose={() => setCompanyAnchorEl(null)}
                    PaperProps={{
                        sx: {
                            mt: 1,
                            borderRadius: 2,
                            maxHeight: 320,
                            minWidth: 200,
                        },
                    }}
                >
                    {companyOptions.map(option => (
                        <MenuItem
                            key={option}
                            selected={selectedCompany === option}
                            onClick={() => {
                                setSelectedCompany(option);
                                setCompanyAnchorEl(null);
                            }}
                        >
                            {option}
                        </MenuItem>
                    ))}
                </Menu>

                <Menu
                    anchorEl={jobAnchorEl}
                    open={Boolean(jobAnchorEl)}
                    onClose={() => setJobAnchorEl(null)}
                    PaperProps={{
                        sx: {
                            mt: 1,
                            borderRadius: 2,
                            maxHeight: 320,
                            minWidth: 200,
                        },
                    }}
                >
                    {jobOptions.map(option => (
                        <MenuItem
                            key={option}
                            selected={selectedJob === option}
                            onClick={() => {
                                setSelectedJob(option);
                                setJobAnchorEl(null);
                            }}
                        >
                            {option}
                        </MenuItem>
                    ))}
                </Menu>

                {filtersOpen && (
                    <Box
                        sx={{
                            mb: 3,
                            p: 2,
                            borderRadius: 3,
                            backgroundColor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 2,
                            alignItems: 'center',
                        }}
                    >
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                label="From"
                                value={fltFrom}
                                maxDate={
                                    fltTo
                                        ? fltTo.isBefore(today)
                                            ? fltTo
                                            : today
                                        : today
                                }
                                onChange={value => {
                                    setRangePreset('custom');
                                    setFltFrom(value);
                                }}
                                format="DD/MM/YYYY"
                                slotProps={{
                                    textField: {
                                        size: 'small',
                                        sx: {
                                            width: '180px',
                                            '& .MuiInputBase-root': {
                                                height: '32px',
                                                fontSize: '0.8rem',
                                            },
                                        },
                                    },
                                }}
                            />
                            <DatePicker
                                label="To"
                                value={fltTo}
                                minDate={fltFrom || undefined}
                                maxDate={today}
                                onChange={value => {
                                    setRangePreset('custom');
                                    setFltTo(value);
                                }}
                                format="DD/MM/YYYY"
                                slotProps={{
                                    textField: {
                                        size: 'small',
                                        sx: {
                                            width: '180px',
                                            '& .MuiInputBase-root': {
                                                height: '32px',
                                                fontSize: '0.8rem',
                                            },
                                        },
                                    },
                                }}
                            />
                        </LocalizationProvider>

                        <MUIButton
                            onClick={() => {
                                setFromDate(fltFrom);
                                setToDate(fltTo);
                                setReportDlg(true);
                            }}
                        >
                            Download Team Report
                        </MUIButton>
                    </Box>
                )}

                <Box
                    sx={{
                        p: { xs: 1.2, sm: 1.5 },
                        mb: 3,
                        borderRadius: 3,
                        backgroundColor: 'background.paper',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr',
                                sm: 'repeat(2, 1fr)',
                                md: 'repeat(5, 1fr)',
                            },
                            gap: 1.5,
                        }}
                    >
                        {statCards.map(card => (
                            <Box
                                key={card.key}
                                sx={{
                                    position: 'relative',
                                    borderRadius: 3,
                                    minHeight: 120,
                                    overflow: 'hidden',
                                    backgroundColor: 'background.paper',
                                    color: 'text.primary',
                                    // boxShadow: theme.shadows[1],
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    cursor: card.to ? 'pointer' : 'default',
                                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                                    '&:hover': card.to
                                        ? {
                                            transform: 'translateY(-2px)',
                                            boxShadow: theme.shadows[3],
                                        }
                                            : undefined,
                                    }}
                                    role={card.to ? 'button' : undefined}
                                    tabIndex={card.to ? 0 : -1}
                                onClick={() => card.to && nav(card.to)}
                                onKeyDown={event =>
                                    handleKeyboardNavigation(event, card.to)
                                }
                            >
                                <CardContent sx={{ p: 2.2 }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1.2,
                                            mb: 0.6,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 2,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: alpha(
                                                    theme.palette.primary.main,
                                                    isDark ? 0.26 : 0.14,
                                                ),
                                                color: 'primary.main',
                                                border: '1px solid',
                                                borderColor: alpha(
                                                    theme.palette.primary.main,
                                                    isDark ? 0.5 : 0.24,
                                                ),
                                                // boxShadow: theme.shadows[2],
                                            }}
                                        >
                                            {card.icon}
                                        </Box>
                                        <Typography
                                            variant="h5"
                                            sx={{
                                                fontWeight: 700,
                                                letterSpacing: 0.2,
                                                fontSize: '1.7rem',
                                                lineHeight: 1.1,
                                            }}
                                        >
                                            {card.value}
                                        </Typography>
                                    </Box>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            color: 'text.secondary',
                                        }}
                                    >
                                        {card.label}
                                    </Typography>
                                    {card.subLabel && (
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.6,
                                                mt: 0.4,
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                                color:
                                                    card.key === 'candidates'
                                                        ? 'success.main'
                                                        : 'text.secondary',
                                            }}
                                        >
                                            {card.key === 'candidates' && (
                                                <TrendingUpRoundedIcon
                                                    sx={{
                                                        fontSize: 16,
                                                        color: 'success.main',
                                                    }}
                                                />
                                            )}
                                            <span>{card.subLabel}</span>
                                        </Box>
                                    )}
                                </CardContent>
                            </Box>
                        ))}
                    </Box>
                </Box>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
                        gap: 2,
                        mb: 3,
                    }}
                >
                    <Box sx={sectionCardSx}>
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 700,
                                mb: 2,
                                color: 'text.primary',
                            }}
                        >
                            Needs Attention
                        </Typography>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    md: '1fr 1fr',
                                },
                                gap: 2,
                            }}
                        >
                            <Box
                                sx={{
                                    p: 2,
                                    borderRadius: 2.5,
                                    backgroundColor: 'background.paper',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    // boxShadow: theme.shadows[1],
                                }}
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        mb: 1,
                                    }}
                                >
                                    <Typography
                                        variant="subtitle2"
                                        sx={{
                                            fontWeight: 700,
                                            color: 'text.primary',
                                        }}
                                    >
                                        Jobs with Active Hiring
                                    </Typography>
                                    <ChevronRightRoundedIcon
                                        fontSize="small"
                                        sx={{ color: 'text.disabled' }}
                                    />
                                </Box>
                                {displayedActiveJobs.map(job => {
                                    const jobTarget = getJobNavigationTarget(job);
                                    const progressValue = Math.min(
                                        100,
                                        Math.round(
                                            (Number(job.candidates || 0) /
                                                maxActiveCandidates) *
                                            100,
                                        ),
                                    );
                                    return (
                                        <Box
                                            key={
                                                job.id ||
                                                job._id ||
                                                `${job.title}-${job.company}`
                                            }
                                            sx={{
                                                mb: 2,
                                                pb: 1.5,
                                                borderBottom: '1px solid',
                                                borderColor: 'divider',
                                                cursor: 'pointer',
                                                borderRadius: 2,
                                                transition:
                                                    'background-color 120ms ease, transform 120ms ease',
                                                '&:hover': {
                                                    backgroundColor: 'action.hover',
                                                    transform: 'translateY(-1px)',
                                                },
                                                '&:focus-visible': {
                                                    outline: `2px solid ${theme.palette.primary.main}`,
                                                    outlineOffset: 2,
                                                },
                                                '&:last-of-type': {
                                                    mb: 0,
                                                    pb: 0,
                                                    borderBottom: 'none',
                                                },
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => nav(jobTarget)}
                                            onKeyDown={event =>
                                                handleKeyboardNavigation(event, jobTarget)
                                            }
                                        >
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    justifyContent:
                                                        'space-between',
                                                    alignItems: 'flex-start',
                                                }}
                                            >
                                                <Box>
                                                    <Typography
                                                        variant="subtitle2"
                                                        sx={{ fontWeight: 600 }}
                                                    >
                                                        {job.title}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: 'text.secondary',
                                                        }}
                                                    >
                                                        {job.company}
                                                    </Typography>
                                                </Box>
                                                <Typography
                                                    variant="subtitle2"
                                                    sx={{ color: 'text.primary' }}
                                                >
                                                    {Number(
                                                        job.candidates || 0,
                                                    )}
                                                </Typography>
                                            </Box>
                                            <LinearProgress
                                                variant="determinate"
                                                value={progressValue}
                                                sx={{
                                                    mt: 1,
                                                    height: 7,
                                                    borderRadius: 999,
                                                    backgroundColor: alpha(
                                                        theme.palette.grey[500],
                                                        isDark ? 0.28 : 0.22,
                                                    ),
                                                    '& .MuiLinearProgress-bar': {
                                                        backgroundColor:
                                                            alpha(
                                                                theme.palette.primary.main,
                                                                isDark ? 0.78 : 0.68,
                                                            ),
                                                    },
                                                }}
                                            />
                                        </Box>
                                    );
                                })}
                                {!displayedActiveJobs.length && (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        No active jobs for the current filters.
                                    </Typography>
                                )}
                            </Box>

                            <Box
                                sx={{
                                    p: 2,
                                    borderRadius: 2.5,
                                    backgroundColor: 'background.paper',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    // boxShadow: theme.shadows[1],
                                }}
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        mb: 1,
                                    }}
                                >
                                    <Typography
                                        variant="subtitle2"
                                        sx={{
                                            fontWeight: 700,
                                            color: 'text.primary',
                                        }}
                                    >
                                        Candidates Stuck in Stage
                                    </Typography>
                                    <ChevronRightRoundedIcon
                                        fontSize="small"
                                        sx={{ color: 'text.disabled' }}
                                    />
                                </Box>
                                {displayedStuckCandidates.map(candidate => {
                                    const candidateTarget =
                                        getCandidateNavigationTarget(candidate);
                                    const days = Number(
                                        candidate.daysInPipeline || 0,
                                    );
                                    const badgeColor =
                                        days >= 14
                                            ? alpha(
                                                theme.palette.error.main,
                                                isDark ? 0.2 : 0.15,
                                            )
                                            : alpha(
                                                theme.palette.warning.main,
                                                isDark ? 0.2 : 0.15,
                                            );
                                    const textColor =
                                        days >= 14
                                            ? theme.palette.error.main
                                            : theme.palette.warning.main;
                                    const dotColor =
                                        days >= 14
                                            ? alpha(theme.palette.error.main, 0.6)
                                            : alpha(theme.palette.warning.main, 0.6);
                                    return (
                                        <Box
                                            key={
                                                candidate.id ||
                                                candidate.candidateId ||
                                                `${candidate.name}-${candidate.jobTitle}`
                                            }
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                mb: 1.5,
                                                pb: 1.2,
                                                borderBottom: '1px solid',
                                                borderColor: 'divider',
                                                cursor: 'pointer',
                                                borderRadius: 2,
                                                transition:
                                                    'background-color 120ms ease, transform 120ms ease',
                                                '&:hover': {
                                                    backgroundColor: 'action.hover',
                                                    transform: 'translateY(-1px)',
                                                },
                                                '&:focus-visible': {
                                                    outline: `2px solid ${theme.palette.primary.main}`,
                                                    outlineOffset: 2,
                                                },
                                                '&:last-of-type': {
                                                    mb: 0,
                                                    pb: 0,
                                                    borderBottom: 'none',
                                                },
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => nav(candidateTarget)}
                                            onKeyDown={event =>
                                                handleKeyboardNavigation(
                                                    event,
                                                    candidateTarget,
                                                )
                                            }
                                        >
                                            <Box>
                                                <Typography
                                                    variant="subtitle2"
                                                    sx={{ fontWeight: 600 }}
                                                >
                                                    {candidate.name}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: 'text.secondary',
                                                        display: 'block',
                                                    }}
                                                >
                                                    {candidate.jobTitle}
                                                </Typography>
                                                {candidate.company && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: 'text.secondary',
                                                        }}
                                                    >
                                                        {candidate.company}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.6,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                        px: 1,
                                                        py: 0.5,
                                                        borderRadius: 999,
                                                        backgroundColor: badgeColor,
                                                        color: textColor,
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                    }}
                                                >
                                                    <AccessTimeRoundedIcon fontSize="inherit" />
                                                    <Typography
                                                        variant="caption"
                                                        sx={{ fontWeight: 600 }}
                                                    >
                                                        {days} Days
                                                    </Typography>
                                                </Box>
                                                <Box
                                                    sx={{
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: '50%',
                                                        backgroundColor:
                                                            dotColor,
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    );
                                })}
                                {!displayedStuckCandidates.length && (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        No candidates are stuck right now.
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    </Box>

                    <Box sx={sectionCardSx}>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 1,
                                mb: 2,
                            }}
                        >
                            <Typography
                                variant="h6"
                                sx={{ fontWeight: 700, color: 'text.primary' }}
                            >
                                Interviews
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Pending Today
                            </Typography>
                        </Box>
                        {displayedPendingInterviews.map((interview, idx) => {
                            const interviewTarget =
                                getInterviewNavigationTarget(interview);
                            return (
                            <Box
                                key={
                                    interview.id ||
                                    interview._id ||
                                    `${interview.candidateName}-${interview.startAt}`
                                }
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    py: 1.2,
                                    cursor: 'pointer',
                                    borderRadius: 2,
                                    transition:
                                        'background-color 120ms ease, transform 120ms ease',
                                    '&:hover': {
                                        backgroundColor: 'action.hover',
                                        transform: 'translateY(-1px)',
                                    },
                                    '&:focus-visible': {
                                        outline: `2px solid ${theme.palette.primary.main}`,
                                        outlineOffset: 2,
                                    },
                                    borderBottom:
                                        idx === displayedPendingInterviews.length - 1
                                            ? 'none'
                                            : '1px solid',
                                    borderColor: 'divider',
                                }}
                                role="button"
                                tabIndex={0}
                                onClick={() => nav(interviewTarget)}
                                onKeyDown={event =>
                                    handleKeyboardNavigation(event, interviewTarget)
                                }
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: '50%',
                                            backgroundColor: alpha(
                                                theme.palette.grey[500],
                                                isDark ? 0.26 : 0.16,
                                            ),
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <PeopleAltOutlinedIcon
                                            sx={{
                                                fontSize: 18,
                                                color: alpha(
                                                    theme.palette.primary.main,
                                                    isDark ? 0.94 : 0.86,
                                                ),
                                            }}
                                        />
                                    </Box>
                                    <Box>
                                        <Typography
                                            variant="subtitle2"
                                            sx={{ fontWeight: 600 }}
                                        >
                                            {interview.candidateName}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            {interview.jobTitle}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.6,
                                        color: 'text.primary',
                                    }}
                                >
                                    <Typography
                                        variant="subtitle2"
                                        sx={{ color: 'inherit' }}
                                    >
                                        {interview.timeLabel ||
                                            (interview.startAt
                                                ? dayjs(interview.startAt).format(
                                                    'hh:mm A',
                                                )
                                                : 'TBD')}
                                    </Typography>
                                    <ChevronRightRoundedIcon
                                        sx={{ fontSize: 18, color: 'text.disabled' }}
                                    />
                                </Box>
                            </Box>
                            );
                        })}
                        {!displayedPendingInterviews.length && (
                            <Typography variant="body2" color="text.secondary">
                                No interviews scheduled for today.
                            </Typography>
                        )}
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                mt: 1,
                            }}
                        >
                            <Typography
                                variant="caption"
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    color: 'text.secondary',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    '&:hover': {
                                        color: 'primary.main',
                                    },
                                }}
                                onClick={() => nav('/interviews')}
                            >
                                View
                                <ChevronRightRoundedIcon fontSize="small" />
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                <Box sx={{ ...sectionCardSx, mb: 3 }}>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 1.5,
                            mb: 2,
                        }}
                    >
                        <Box>
                            <Typography
                                variant="h6"
                                sx={{ fontWeight: 700, color: 'text.primary' }}
                            >
                                Recruiter & Manager Activity
                            </Typography>
                        </Box>
                    </Box>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1.6fr 0.7fr 0.7fr 0.7fr 32px',
                                md: '2fr 1fr 1fr 1fr 32px',
                            },
                            gap: 1,
                            px: 1.5,
                            py: 1,
                            borderRadius: 2,
                            backgroundColor: 'action.hover',
                            border: '1px solid',
                            borderColor: 'divider',
                            color: 'text.secondary',
                            alignItems: 'center',
                        }}
                    >
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            Top Recruiters & Managers over {rangeLabel}
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                fontWeight: 700,
                                textAlign: 'center',
                                borderLeft: '1px solid',
                                borderColor: 'divider',
                                pl: 1,
                            }}
                        >
                            Jobs Assigned
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                fontWeight: 700,
                                textAlign: 'center',
                                borderLeft: '1px solid',
                                borderColor: 'divider',
                                pl: 1,
                            }}
                        >
                            Candidates Managed
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                fontWeight: 700,
                                textAlign: 'center',
                                borderLeft: '1px solid',
                                borderColor: 'divider',
                                pl: 1,
                            }}
                        >
                            Interviews
                        </Typography>
                        <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', height: 18 }} />
                    </Box>
                    {recruiterActivityPageRows.map((row, idx) => {
                        const initials = String(row.name || 'R')
                            .split(' ')
                            .filter(Boolean)
                            .slice(0, 2)
                            .map(part => part[0])
                            .join('')
                            .toUpperCase();

                        return (
                            <Box
                                key={row.id}
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: {
                                        xs: '1.6fr 0.7fr 0.7fr 0.7fr 32px',
                                        md: '2fr 1fr 1fr 1fr 32px',
                                    },
                                    gap: 1,
                                    py: 1.4,
                                    px: 1.5,
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    alignItems: 'center',
                                    backgroundColor: idx % 2 ? 'action.hover' : 'background.paper',
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                                    <Box
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: '50%',
                                            backgroundColor: alpha(
                                                theme.palette.grey[400],
                                                isDark ? 0.26 : 0.16,
                                            ),
                                            color: 'text.primary',
                                            fontWeight: 700,
                                            fontSize: '0.8rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {initials || 'R'}
                                    </Box>
                                    <Box>
                                        <Typography
                                            variant="subtitle2"
                                            sx={{ fontWeight: 600 }}
                                        >
                                            {row.name}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: 'text.secondary',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                '&:hover': {
                                                    color: 'primary.main',
                                                },
                                            }}
                                            onClick={() =>
                                                nav(`/dashboard/recruiter/${row.id}/`)
                                            }
                                        >
                                            View
                                        </Typography>
                                    </Box>
                                </Box>
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        textAlign: 'center',
                                        borderLeft: '1px solid',
                                        borderColor: 'divider',
                                        pl: 1,
                                    }}
                                >
                                    {row.jobsAssigned}
                                </Typography>
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        textAlign: 'center',
                                        borderLeft: '1px solid',
                                        borderColor: 'divider',
                                        pl: 1,
                                    }}
                                >
                                    {row.candidatesManaged}
                                </Typography>
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        textAlign: 'center',
                                        borderLeft: '1px solid',
                                        borderColor: 'divider',
                                        pl: 1,
                                    }}
                                >
                                    {row.interviews}
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={() =>
                                        nav(`/dashboard/recruiter/${row.id}/`)
                                    }
                                    sx={{ color: 'text.disabled' }}
                                >
                                    <ChevronRightRoundedIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        );
                    })}
                    {!recruiterActivityRows.length && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 2 }}
                        >
                            No recruiter or manager activity available for this period.
                        </Typography>
                    )}
                    {recruiterActivityRows.length >
                        recruiterActivityRowsPerPage && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    mt: 1,
                                }}
                            >
                                <TablePagination
                                    component="div"
                                    count={recruiterActivityRows.length}
                                    page={recruiterActivityPage}
                                    onPageChange={(_, nextPage) =>
                                        setRecruiterActivityPage(nextPage)
                                    }
                                    rowsPerPage={recruiterActivityRowsPerPage}
                                    rowsPerPageOptions={[
                                        recruiterActivityRowsPerPage,
                                    ]}
                                />
                            </Box>
                        )}
                </Box>
                <MUIModal
                    open={reportDlg}
                    onClose={() => setReportDlg(false)}
                >
                    <Box
                        sx={{
                            bgcolor: 'background.paper',
                            p: { xs: 3, sm: 4 },
                            borderRadius: 2,
                            minWidth: { xs: '90vw', sm: 420 },
                            maxWidth: 480,
                        }}
                    >
                        <Typography variant="h6" gutterBottom>
                            Team Report
                        </Typography>

                        {effectiveRole === 'client_admin' && (
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Report Type"
                                value={reportType}
                                onChange={event => setReportType(event.target.value)}
                                sx={{ mb: 2 }}
                            >
                                <MenuItem value="recruiter">Recruiter</MenuItem>
                                <MenuItem value="manager">Manager</MenuItem>
                            </TextField>
                        )}

                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                                label="From (dd/mm/yyyy)"
                                value={fromDate}
                                onChange={setFromDate}
                                format="DD/MM/YYYY"
                                sx={{ mb: 2, width: '100%' }}
                                maxDate={today}
                            />
                            <DatePicker
                                label="To (dd/mm/yyyy)"
                                value={toDate}
                                onChange={setToDate}
                                format="DD/MM/YYYY"
                                sx={{ mb: 2, width: '100%' }}
                                minDate={fromDate || undefined}
                                maxDate={today}
                            />
                        </LocalizationProvider>

                        {Object.keys(summaryFieldConfig || {}).length > 0 && (
                            <>
                                <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>
                                    Summary sheet columns
                                </Typography>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 1,
                                        mb: 2,
                                        maxHeight: 200,
                                        overflowY: 'auto',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        p: 1,
                                    }}
                                >
                                    {Object.entries(summaryFieldConfig).map(([key, checked]) => (
                                        <FormControlLabel
                                            key={key}
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={checked}
                                                    onChange={e => {
                                                        const checkedVal = e.target.checked;
                                                        setSummaryFieldConfig(prev => ({
                                                            ...prev,
                                                            [key]: checkedVal,
                                                        }));
                                                    }}
                                                />
                                            }
                                            label={getSummaryFieldLabel(key)}
                                        />
                                    ))}
                                </Box>
                            </>
                        )}

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <MUIButton fullWidth onClick={downloadReport}>
                                Download
                            </MUIButton>
                            <MUIButton
                                fullWidth
                                color="dark"
                                variant="outlined"
                                onClick={() => setReportDlg(false)}
                            >
                                Cancel
                            </MUIButton>
                        </Box>
                    </Box>
                </MUIModal>

                <LogoutConfirmDialog
                    open={logoutConfirmOpen}
                    onClose={() => setLogoutConfirmOpen(false)}
                    onConfirm={handleConfirmLogout}
                    title="Do you want to log out?"
                    description=""
                    confirmLabel="Yes"
                    cancelLabel="No"
                />
            </Box>
        );
    }

    return (
        <>
            <MUICenterLayout>
                <Typography>
                    No dashboard available for your role ({role}).
                </Typography>
            </MUICenterLayout>
            <LogoutConfirmDialog
                open={logoutConfirmOpen}
                onClose={() => setLogoutConfirmOpen(false)}
                onConfirm={handleConfirmLogout}
                title="Do you want to log out?"
                description=""
                confirmLabel="Yes"
                cancelLabel="No"
            />
        </>
    );
}
