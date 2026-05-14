import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Avatar, Typography, Skeleton } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';

import { useAuthContextState } from '../../../contexts/AuthContext';
import { useArchiveContextState } from '../../../contexts/ArchiveContext';
import { useStageContextState } from '../../../contexts/StageContext';
import { useUiContextState } from '../../../contexts/UiContext';
import { fetchData } from '../../../AppUtils/dataAPI';
import MUIRetrieveDataGrid from '../../MUI/CommonCRUD/MUIRetrieveDataGrid';
import TableFilterBar from '../../MUI/CommonCRUD/TableFilterBar';
import MUIArchiveCnfModal from '../../MUI/CommonCRUD/MUIArchiveCnfModal';
import MUIButton from '../../MUI/commonUI/MUIButton';
import MUIAlert from '../../MUI/commonUI/MUIAlert';



const StagesList = () => {
    const [stageState, setStageState] = useStageContextState();
    const [, setArchiveState] = useArchiveContextState();
    const [, setUiState] = useUiContextState();
    const [authState] = useAuthContextState();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [current, setCurrent] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Column filter state
    const [appliedField, setAppliedField] = useState('all');
    const [appliedValue, setAppliedValue] = useState({ label: 'All', value: 'all' });
    const [appliedDateFrom, setAppliedDateFrom] = useState('');
    const [appliedDateTo, setAppliedDateTo] = useState('');

    const [alertConfig, setAlertConfig] = useState({
        open: false,
        message: '',
        severity: 'success',
    });
    const handleAlertClose = (_e, reason) => {
        if (reason === 'clickaway') return;
        setAlertConfig(a => ({ ...a, open: false }));
    };

    // Filter field config for TableFilterBar
    const filterFields = [
        { field: 'title', label: 'Stage Title' },
        { field: 'createdAt', label: 'Created Date', type: 'date' },
    ];

    const getFieldValue = (row, field) => {
        if (field === 'createdAt') return row.createdAt ? String(row.createdAt).substring(0, 10) : '';
        return row?.[field] ?? '';
    };

    // Combined search + column filter
    const filteredRows = useMemo(() => {
        let out = rows;

        // Full-text search
        const q = searchTerm.trim().toLowerCase();
        if (q) {
            out = out.filter(row => {
                const title = `${row?.title ?? ''}`.toLowerCase();
                const description = `${row?.description ?? ''}`.toLowerCase();
                return title.includes(q) || description.includes(q);
            });
        }

        // Column filter
        if (appliedField !== 'all') {
            if (appliedField === 'createdAt') {
                out = out.filter(r => {
                    const d = r.createdAt ? String(r.createdAt).substring(0, 10) : '';
                    if (appliedDateFrom && d < appliedDateFrom) return false;
                    if (appliedDateTo && d > appliedDateTo) return false;
                    return true;
                });
            } else if (appliedValue?.value !== 'all') {
                out = out.filter(r =>
                    String(getFieldValue(r, appliedField)).toLowerCase() ===
                    String(appliedValue.value).toLowerCase()
                );
            }
        }

        return out;

    }, [rows, searchTerm, appliedField, appliedValue, appliedDateFrom, appliedDateTo]);

    const handleFilterApply = (field, value, dateFrom, dateTo) => {
        setAppliedField(field);
        setAppliedValue(value);
        setAppliedDateFrom(dateFrom);
        setAppliedDateTo(dateTo);
    };

    const handleFilterClear = () => {
        setAppliedField('all');
        setAppliedValue({ label: 'All', value: 'all' });
        setAppliedDateFrom('');
        setAppliedDateTo('');
    };

    const columns = [
        {
            field: '__serial',
            headerName: 'No.',
            maxWidth: 80,
            headerAlign: 'left',
            align: 'left',
            sortable: false,
            filterable: false,
            renderCell: (params) => {
                const idx = params.api.getAllRowIds().indexOf(params.id);
                return idx + 1;
            },
        },
        {
            field: 'title',
            headerName: 'Stage Title',
            headerAlign: 'left',
            align: 'left',
            minWidth: 220,
            flex: 1,
            flexGrow: 1,
            renderCell: ({ row }) => {
                const title = row?.title || '-';
                const description = row?.description || null;
                const initials = title
                    .split(' ')
                    .filter(Boolean)
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, height: '100%' }}>
                        <Avatar
                            sx={{
                                width: 34,
                                height: 34,
                                bgcolor: (theme) =>
                                    alpha(theme.palette.grey[400], theme.palette.mode === 'dark' ? 0.28 : 0.18),
                                color: 'text.primary',
                                fontWeight: 700,
                                fontSize: 12,
                                border: 1,
                                borderColor: (theme) =>
                                    alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.5 : 0.3),
                            }}
                        >
                            {initials || 'ST'}
                        </Avatar>
                        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100%' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.25 }}>
                                {title}
                            </Typography>
                            {description ? (
                                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.2, mt: 0.2 }}>
                                    {description}
                                </Typography>
                            ) : null}
                        </Box>
                    </Box>
                );
            }
        },
    ];

    const navigate = useNavigate();

    const deleteRow = () => {
        setRows([]);
        const archivedStage = {
            ...(current || {}),
            id: current?.id || current?._id,
            __type: 'stage',
        };

        fetchData('/api/stages/' + (current?.id || current?._id), { method: 'DELETE' })
            .finally(() => {
                setUiState({ loadingMsg: null });
            });
        setRows(p => p.filter(r => r.id !== current.id));
        setStageState((prev) => {
            const existingStageRows = Array.isArray(prev?.stageRowsList)
                ? prev.stageRowsList.filter((stage) => {
                    const stageId = stage?.id || stage?._id;
                    return stageId !== archivedStage.id;
                })
                : prev?.stageRowsList;

            return {
                stageRowsList: existingStageRows,
                stageListDirty: true,
            };
        });
        setArchiveState((prev) => {
            const existingArchivedStages = Array.isArray(prev?.archivedStages)
                ? prev.archivedStages.filter((stage) => {
                    const stageId = stage?.id || stage?._id;
                    return stageId !== archivedStage.id;
                })
                : [];

            return {
                archivedStages: [archivedStage, ...existingArchivedStages],
            };
        });
        setDeleteOpen(false);
        setAlertConfig({
            open: true,
            message: 'Stage archived.',
            severity: 'success',
        });
    };

    const loadStages = () => {
        setLoading(true);
        fetchData('/api/stages/')
            .then(dataList => {
                const safe = Array.isArray(dataList) ? dataList.slice() : [];
                safe.sort((a, b) => {
                    const ta = a?.createdAt ? Date.parse(a.createdAt) : NaN;
                    const tb = b?.createdAt ? Date.parse(b.createdAt) : NaN;
                    if (!isNaN(ta) && !isNaN(tb)) return ta - tb;
                    if (!isNaN(ta)) return -1;
                    if (!isNaN(tb)) return 1;
                    return 0;
                });
                const withIds = safe.map(c => ({ ...c, id: c._id }));
                setRows(withIds);
                setStageState({ stageRowsList: withIds, stageListDirty: false });
            })
            .finally(() => {
                setLoading(false);
                setUiState({ loadingMsg: null });
            });
    };

    useEffect(() => {
        setStageState({ stageInitialValuesDict: null });
        if (stageState?.stageListDirty || !Array.isArray(stageState?.stageRowsList)) {
            loadStages();
        } else {
            setRows(stageState.stageRowsList);
        }

        return () => {
            setRows([]);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stageState?.stageListDirty, stageState?.stageRowsList]);

    return (
        <>
            <MUIAlert
                open={alertConfig.open}
                message={alertConfig.message}
                severity={alertConfig.severity}
                onClose={handleAlertClose}
            />

            <Box sx={{ m: { xs: 0, sm: 2, md: 3 }, p: { xs: 1.5, sm: 2 }, pb: { xs: 3, sm: 5 }, mt: 0, pt: 0, overflow: 'show' }}>
                <Box sx={{ p: 2 }}>
                    {loading && rows.length === 0 ? (
                        <Box>
                            <Skeleton variant="text" width={140} height={28} sx={{ mb: 2 }} />
                            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                <Skeleton variant="rounded" width={220} height={36} />
                                <Skeleton variant="rounded" width={44} height={36} />
                                <Skeleton variant="rounded" width={160} height={36} />
                            </Box>
                            <Box sx={{ display: 'grid', gap: 1.5 }}>
                                {Array.from({ length: 5 }).map((_, idx) => (
                                    <Skeleton key={idx} variant="rounded" height={54} />
                                ))}
                            </Box>
                        </Box>
                    ) : (
                        <MUIRetrieveDataGrid
                            title="Hiring Stages"
                            onRefresh={() => loadStages()}
                            rows={filteredRows}
                            columns={columns}
                            onRowClick={row => {
                                navigate(`/stages/${row.id}`);
                            }}
                            onDelete={row => { setCurrent(row); setDeleteOpen(true); }}
                            createButton={
                                <TableFilterBar
                                    searchLabel="Search Stages"
                                    searchValue={searchTerm}
                                    onSearchChange={setSearchTerm}
                                    filterTitle="Filter Stages"
                                    filterFields={filterFields}
                                    rows={rows}
                                    getFieldValue={getFieldValue}
                                    appliedField={appliedField}
                                    appliedValue={appliedValue}
                                    appliedDateFrom={appliedDateFrom}
                                    appliedDateTo={appliedDateTo}
                                    onApply={handleFilterApply}
                                    onClear={handleFilterClear}
                                    extraControls={
                                        authState.user?.role !== 'ultra_admin' && (
                                            <MUIButton
                                                onClick={() => {
                                                    setStageState({ stageInitialValuesDict: null });
                                                    navigate('/stages/new/');
                                                }}
                                            >
                                                <AddBusinessRoundedIcon sx={{ mx: 1 }} />
                                                New Stage(s)
                                            </MUIButton>
                                        )
                                    }
                                />
                            }
                        />
                    )}

                    <MUIArchiveCnfModal
                        open={deleteOpen}
                        onClose={() => setDeleteOpen(false)}
                        onConfirm={deleteRow}
                        itemName={current?.name}
                    >
                        Archive
                    </MUIArchiveCnfModal>

                </Box>
            </Box>
        </>
    );
};

export default StagesList;
