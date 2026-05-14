import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchData } from '../../AppUtils/dataAPI';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import {
    Box,
    Typography,
    Divider,
    CircularProgress,
    IconButton,
} from '@mui/material';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import MUIButton from '../MUI/commonUI/MUIButton';
import { useRecruiterContextState } from '../../contexts/RecruiterContext';
import { useUiContextState } from '../../contexts/UiContext';
import { useAuthContextState } from '../../contexts/AuthContext';
import { Archive, Edit } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    LabelList,
} from 'recharts';
import { setDocumentTitle } from '../../AppUtils/documentTitle';

export default function ManagerDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [authState] = useAuthContextState();
    const [recruiter, setRecruiter] = useState(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [, setRecruiterState] = useRecruiterContextState();
    const [, setUiState] = useUiContextState();
    const theme = useTheme();
    const [dashboardLoading, setDashboardLoading] = useState(false);
    const [dashboardCards, setDashboardCards] = useState([]);
    const canManageManager = authState?.user?.role === 'client_admin';

    const loadRecruiter = () => {
        if (!id) return;

        setUiState({ loadingMsg: 'Loading manager details...' });

        fetchData(`/api/users/${id}`)
            .then(setRecruiter)
            .catch(console.error)
            .finally(() => {
                setUiState({ loadingMsg: null });
            });
    };

    useEffect(() => {
        loadRecruiter();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const recruiterName = [recruiter?.firstName, recruiter?.lastName].filter(Boolean).join(' ').trim();

    useEffect(() => {
        setDocumentTitle(recruiterName || 'Manager Detail');
    }, [recruiterName]);

    const handleEdit = () => {
        // ✅ Ensure global state is populated before navigating to edit form
        setRecruiterState({
            recruiterInitialValuesDict: recruiter,
        });
        navigate('/managers/new');
    };

    const handleArchive = () => {
        fetchData(`/api/users/${id}`, { method: 'DELETE' })
            .then(() => navigate('/managers'))
            .catch(console.error);
    };

    const fullPhone = recruiter?.phoneNumber
        ? `${recruiter?.countryCode ? recruiter.countryCode + ' ' : ''}${recruiter.phoneNumber}`
        : '—';

    const recruiterId = recruiter?._id || recruiter?.id || id;

    const loadRecruiterDashboard = async () => {
        if (!recruiterId) return;
        setDashboardLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('subjectUserId', recruiterId);
            const overview = await fetchData(`/api/dashboard/overview?${params.toString()}`, { method: 'GET' });

            const adminRecruiterStats = Array.isArray(overview?.adminRecruiterStats)
                ? overview.adminRecruiterStats
                : [];

            const matchedStats = adminRecruiterStats.find(
                row => String(row?.recruiterId || row?._id || '') === String(recruiterId)
            ) || {};

            const recruiterTotals = overview?.recruiterTotals || {};
            const totals = {
                companies: Number(recruiterTotals.companies ?? matchedStats.companies ?? 0) || 0,
                jobs: Number(recruiterTotals.jobs ?? matchedStats.jobs ?? 0) || 0,
                candidates: Number(recruiterTotals.candidates ?? matchedStats.candidates ?? 0) || 0,
            };

            const cards = [
                { key: 'companies', label: 'Companies', value: totals.companies },
                { key: 'jobs', label: 'Jobs', value: totals.jobs },
                { key: 'candidates', label: 'Candidates', value: totals.candidates },
            ];

            setDashboardCards(cards);
        } catch (err) {
            console.error('[RecruiterDetail] Failed to load recruiter dashboard', err);
            setDashboardCards([]);
        } finally {
            setDashboardLoading(false);
        }
    };

    useEffect(() => {
        loadRecruiterDashboard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recruiterId]);

    const chartData = useMemo(() => {
        if (!dashboardCards.length) return [];
        return dashboardCards.map(card => ({
            name: card.label,
            value: Number(card.value || 0),
        }));
    }, [dashboardCards]);

    if (!recruiter) {
        return (
            <Box sx={{ p: 6, textAlign: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ px: { xs: 2, sm: 4, md: 6 }, py: 4 }}>
            <Box sx={{ width: '100%' }}>
                <Box sx={{ p: { xs: 2, sm: 4 } }}>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            justifyContent: 'space-between',
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            mb: 3,
                            gap: 2,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton onClick={() => navigate(-1)}>
                                <ArrowBackIosIcon />
                            </IconButton>
                            <Typography variant="h5">
                                {recruiter.firstName} {recruiter.lastName}
                            </Typography>
                            <IconButton size="small" onClick={loadRecruiter}>
                                <RefreshRoundedIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        {canManageManager && (
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <MUIButton startIcon={<Edit />} onClick={handleEdit}>Edit</MUIButton>
                                <MUIButton startIcon={<Archive />} onClick={() => setDeleteOpen(true)}>Archive</MUIButton>
                            </Box>
                        )}
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    <Box
                        sx={{
                            my: 3,
                            border: 0.5,
                            borderColor: "divider",
                            borderRadius: 2,
                            background: 'background.paper',
                        }}
                    >
                        <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                            <Typography variant="h6" sx={{ mb: 2, borderBottom: 0.5 }}>
                                Manager Information
                            </Typography>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                    gap: { xs: 2.5, md: 4 },
                                }}
                            >
                                <Box>
                                    <Typography color="text.secondary" variant="subtitle2" sx={{ mb: 1 }}>
                                        Personal
                                    </Typography>
                                    <Box sx={{ display: 'grid', gap: 1.5 }}>
                                        <Box>
                                            <Typography color="text.secondary" variant="caption">First Name</Typography>
                                            <Typography sx={{ fontWeight: 600 }}>{recruiter.firstName || '—'}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography color="text.secondary" variant="caption">Last Name</Typography>
                                            <Typography sx={{ fontWeight: 600 }}>{recruiter.lastName || '—'}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography color="text.secondary" variant="caption">Role</Typography>
                                            <Typography sx={{ textTransform: 'capitalize' }}>
                                                {recruiter.role || '—'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                                <Box>
                                    <Typography color="text.secondary" variant="subtitle2" sx={{ mb: 1 }}>
                                        Contact
                                    </Typography>
                                    <Box sx={{ display: 'grid', gap: 1.5 }}>
                                        <Box>
                                            <Typography color="text.secondary" variant="caption">Email</Typography>
                                            <Typography sx={{ wordBreak: 'break-word' }}>
                                                <Link to={recruiter.email ? ("mailto:" + recruiter.email) : undefined}>{recruiter.email || '—'}</Link>
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography color="text.secondary" variant="caption">Phone</Typography>
                                            <Typography><Link to={fullPhone ? ("tel:" + fullPhone) : undefined}>{fullPhone}</Link></Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            my: 3,
                            border: 0.5,
                            borderColor: "divider",
                            borderRadius: 2,
                            background: 'background.paper',
                        }}
                    >
                        <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                            <Typography variant="h6" sx={{ mb: 2, borderBottom: 0.5 }}>
                                Manager Activity
                            </Typography>

                            {/* <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                    gap: 1.5,
                                    mb: 3,
                                }}
                            >
                                {dashboardCards.map(card => (
                                    <Box
                                        key={card.key}
                                        sx={{
                                            borderRadius: 2,
                                            background: 'linear-gradient(160deg,#6f6ae6 0%,#7f7af0 45%,#8d88f7 100%)',
                                            color: '#fff',
                                            textAlign: 'center',
                                            py: 1.4,
                                            px: 1.4,
                                            minHeight: 84,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            boxShadow: '0 10px 22px rgba(92,88,200,0.25)'
                                        }}
                                    >
                                        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                                            {card.value ?? 0}
                                        </Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.95, fontWeight: 600, fontSize: '0.78rem' }}>
                                            {card.label}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box> */}

                            <Box sx={{ height: 260 }}>
                                {dashboardLoading ? (
                                    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CircularProgress size={28} />
                                    </Box>
                                ) : chartData.length ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                                            <CartesianGrid strokeDasharray="4 6" stroke={theme.palette.divider} />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                allowDecimals={false}
                                                tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(84,120,200,0.1)' }}
                                                formatter={(value) => [value, 'Total']}
                                            />
                                            <Bar
                                                dataKey="value"
                                                fill={theme.palette.primary.main}
                                                radius={[6, 6, 0, 0]}
                                                barSize={36}
                                            >
                                                <LabelList dataKey="value" position="top" />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Typography color="text.secondary">No manager metrics available.</Typography>
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    </Box>

                    {canManageManager && (
                        <MUIArchiveCnfModal
                            open={deleteOpen}
                            onClose={() => setDeleteOpen(false)}
                            onConfirm={handleArchive}
                            itemName={`${recruiter.firstName} ${recruiter.lastName}`}
                        >
                            Archive
                        </MUIArchiveCnfModal>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
