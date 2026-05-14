import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MUICreateForm from '../../MUI/CommonCRUD/MUICreateForm';
import { useStageContextState } from '../../../contexts/StageContext';
import { useArchiveContextState } from '../../../contexts/ArchiveContext';
import { useUiContextState } from '../../../contexts/UiContext';
import { Box, IconButton, Typography, useTheme } from "@mui/material";
import { alpha } from '@mui/material/styles';
import { ArrowBackIosNewOutlined } from '@mui/icons-material';
import MUIButton from '../../MUI/commonUI/MUIButton';
import MUIAlert from '../../MUI/commonUI/MUIAlert';
import MUIInput from '../../MUI/commonUI/MUIInput';
import MUIModal from '../../MUI/commonUI/MUIModal';
import { fetchData } from '../../../AppUtils/dataAPI';


const stageTitleOptions = [
    'Submitted to client', 'Shortlisted', 'Test 1', 'Test 2', 'L1', 'L2', 'L3', 'L4',
    'Client Round', 'HR', 'Offered', 'Hired',
    'On-Hold', 'Backout', 'F2F',
];

export default function NewStage() {
    const [stageState, setStageState] = useStageContextState();
    const [archiveState, setArchiveState] = useArchiveContextState();
    const [, setUiState] = useUiContextState();
    const navigate = useNavigate();
    const [archivedStagePromptOpen, setArchivedStagePromptOpen] = useState(false);
    const [matchedArchivedStage, setMatchedArchivedStage] = useState(null);
    const [alertConfig, setAlertConfig] = useState({
        open: false,
        message: '',
        severity: 'info',
    });

    const editing = Boolean(stageState?.stageInitialValuesDict?.id || stageState?.stageInitialValuesDict?._id);
    const theme = useTheme();

    // normalize initial values as STRINGS so submission body is strings too
    const normInit = useMemo(() => {
        const raw = stageState?.stageInitialValuesDict || {};
        const fromArray = Array.isArray(raw.stages) && raw.stages.length ? raw.stages[0] : null;

        const rawTitle = raw.title ?? fromArray?.title ?? '';
        const description = raw.description ?? fromArray?.description ?? '';

        const out = { title: rawTitle, description };
        // console.log('[NewStage] normInit (strings only):', out, 'from raw:', raw);
        return out;
    }, [stageState?.stageInitialValuesDict]);

    const stageId = stageState?.stageInitialValuesDict?.id || stageState?.stageInitialValuesDict?._id;
    const submitUrl = '/api/stages' + (editing ? '/' + stageId : '');
    const submitMethod = editing ? 'PUT' : 'POST';

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

    const formTitle = editing ? 'Edit Stage' : 'New Stage';
    const formSubtitle = 'Define a stage in your hiring workflow';
    const archivedStages = Array.isArray(archiveState?.archivedStages)
        ? archiveState.archivedStages
        : [];

    const closeAlert = (_event, reason) => {
        if (reason === 'clickaway') return;
        setAlertConfig((prev) => ({ ...prev, open: false }));
    };

    const normalizeStageTitle = (value) =>
        String(value || '')
            .toLocaleLowerCase()
            .replace(/\s+/g, ' ')
            .trim();

    const activeStages = useMemo(
        () => (Array.isArray(stageState?.stageRowsList) ? stageState.stageRowsList : []),
        [stageState?.stageRowsList]
    );

    const activeStageTitles = useMemo(() => {
        const currentEditStageId = stageId || null;

        return new Set(
            activeStages
                .filter((stage) => {
                    const activeStageId = stage?.id || stage?._id || null;
                    return !currentEditStageId || activeStageId !== currentEditStageId;
                })
                .map((stage) => normalizeStageTitle(stage?.title))
                .filter(Boolean)
        );
    }, [activeStages, stageId]);

    const titleOptions = useMemo(
        () => stageTitleOptions.filter((title) => !activeStageTitles.has(normalizeStageTitle(title))),
        [activeStageTitles]
    );

    const getCurrentStageTitleValue = (formData, formEl) => {
        const titleInput = formEl?.querySelector?.('input[name="title"]');
        if (titleInput && typeof titleInput.value === 'string') {
            return titleInput.value;
        }
        return formData?.title ?? '';
    };

    const mapArchivedStages = (list) =>
        (Array.isArray(list) ? list : []).map((stage) => ({
            ...stage,
            id: stage?._id || stage?.id,
            __type: 'stage',
        }));

    const mapActiveStages = (list) =>
        (Array.isArray(list) ? list : []).map((stage) => ({
            ...stage,
            id: stage?._id || stage?.id,
        }));

    const loadArchivedStages = async ({ forceRefresh = false } = {}) => {
        if (!forceRefresh && Array.isArray(archiveState?.archivedStages)) {
            return archivedStages;
        }

        const data = await fetchData('/api/stages/archived');
        const mapped = mapArchivedStages(data);
        setArchiveState({ archivedStages: mapped });
        return mapped;
    };

    const loadActiveStages = async ({ forceRefresh = false } = {}) => {
        if (
            !forceRefresh &&
            !stageState?.stageListDirty &&
            Array.isArray(stageState?.stageRowsList)
        ) {
            return activeStages;
        }

        const data = await fetchData('/api/stages/');
        const mapped = mapActiveStages(data);
        setStageState({ stageRowsList: mapped, stageListDirty: false });
        return mapped;
    };

    const findArchivedStageByTitle = (value, list = archivedStages) => {
        const normalizedValue = normalizeStageTitle(value);
        if (!normalizedValue) return null;

        return list.find(
            (stage) => normalizeStageTitle(stage?.title) === normalizedValue
        ) || null;
    };

    const maybePromptArchivedStage = async (value) => {
        if (editing) return false;

        let match = findArchivedStageByTitle(value, archivedStages);
        if (match) {
            const matchId = match?.id || match?._id;
            const currentPromptId = matchedArchivedStage?.id || matchedArchivedStage?._id;
            if (archivedStagePromptOpen && currentPromptId === matchId) {
                return true;
            }

            setMatchedArchivedStage(match);
            setArchivedStagePromptOpen(true);
            return true;
        }

        try {
            const latestArchivedStages = await loadArchivedStages({ forceRefresh: true });
            match = findArchivedStageByTitle(value, latestArchivedStages);
        } catch (error) {
            console.error('[NewStage] Failed to check archived stages:', error);
            setAlertConfig({
                open: true,
                message: error?.message || 'Failed to check archived stages.',
                severity: 'error',
            });
            return false;
        }

        if (!match) return false;

        const matchId = match?.id || match?._id;
        const currentPromptId = matchedArchivedStage?.id || matchedArchivedStage?._id;
        if (archivedStagePromptOpen && currentPromptId === matchId) {
            return true;
        }

        setMatchedArchivedStage(match);
        setArchivedStagePromptOpen(true);
        return true;
    };

    const closeArchivedStagePrompt = () => {
        setArchivedStagePromptOpen(false);
        setMatchedArchivedStage(null);
    };

    const setStageTitleValue = (onFieldChange, value = '') => {
        onFieldChange?.({
            target: {
                name: 'title',
                value,
                type: 'text',
            },
        });
    };

    const handleUnarchiveArchivedStage = async () => {
        const stageToRestore = matchedArchivedStage;
        const restoreId = stageToRestore?.id || stageToRestore?._id;

        if (!restoreId) {
            closeArchivedStagePrompt();
            return;
        }

        setUiState({ loadingMsg: 'Restoring, Please wait...' });

        try {
            await fetchData(`/api/stages/${restoreId}/unarchive`, { method: 'PUT' });

            setArchiveState({
                archivedStages: archivedStages.filter((stage) => {
                    const stageId = stage?.id || stage?._id;
                    return stageId !== restoreId;
                }),
            });
            setStageState({ stageListDirty: true, stageInitialValuesDict: null });
            closeArchivedStagePrompt();
            navigate(`/stages/${restoreId}`);
        } catch (error) {
            console.error('[NewStage] Failed to unarchive stage:', error);
            setAlertConfig({
                open: true,
                message: error?.message || 'Failed to unarchive stage.',
                severity: 'error',
            });
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    useEffect(() => {
        if (editing) return;

        loadArchivedStages({ forceRefresh: true }).catch((error) => {
            console.error('[NewStage] Failed to load archived stages:', error);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing]);

    useEffect(() => {
        if (!stageState?.stageListDirty && Array.isArray(stageState?.stageRowsList)) return;

        loadActiveStages({ forceRefresh: true }).catch((error) => {
            console.error('[NewStage] Failed to load active stages:', error);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stageState?.stageListDirty, stageState?.stageRowsList]);

    const fields = [
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
                        onClick={() => navigate('/stages/')}
                        aria-label="Go back"
                        sx={{ color: theme.palette.text.primary }}
                    >
                        <ArrowBackIosNewOutlined fontSize="small" />
                    </IconButton>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {formTitle}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {formSubtitle}
                        </Typography>
                    </Box>
                </Box>
            ),
            fieldBoxOptions: { sx: { mb: 0 } },
        },
        {
            getField: (formData, onFieldChange) => (
                <MUIInput
                    formData={formData}
                    AutocompleteProps={{
                        freeSolo: true,
                        options: titleOptions,
                        value: formData?.title ?? '',
                        inputValue: formData?.title ?? '',
                        isOptionEqualToValue: (opt, val) =>
                            typeof val === 'string' ? opt === val : opt === (val?.value ?? ''),
                        getOptionLabel: opt => (typeof opt === 'string' ? opt : opt?.label || ''),
                        onChange: (_event, newValue) => {
                            if (typeof newValue === 'string') {
                                setStageTitleValue(onFieldChange, newValue);
                                void maybePromptArchivedStage(newValue);
                                return;
                            }

                            if (!newValue) {
                                setStageTitleValue(onFieldChange, '');
                                return;
                            }

                            const nextValue = newValue?.value ?? newValue;
                            setStageTitleValue(onFieldChange, nextValue);
                            void maybePromptArchivedStage(nextValue);
                        },
                        onInputChange: (_event, newValue, reason) => {
                            if (reason === 'reset') return;
                            setStageTitleValue(onFieldChange, newValue ?? '');
                        },
                    }}
                    AutocompleteInputProps={{
                        name: 'title',
                        label: 'Stage Title',
                        required: true,
                        helperText: 'Select a stage or type your own custom title.',
                        sx: inputSx,
                    }}
                />
            ),
            fieldBoxOptions: { sx: firstFieldPadding },
        },
        {
            AutocompleteInputProps: {
                name: 'description',
                label: 'Description',
                type: 'text',
                multiline: true,
                rows: 3,
                sx: inputSx,
            },
            fieldBoxOptions: { sx: fieldPadding },
        },
    ];

    const onSubmitExtended = () => {
        setStageState({ stageInitialValuesDict: null, stageListDirty: true });
        navigate('/stages/');
    };

    return (
        <>
            <MUIAlert
                open={alertConfig.open}
                message={alertConfig.message}
                severity={alertConfig.severity}
                onClose={closeAlert}
            />

            <MUIModal
                open={archivedStagePromptOpen}
                onClose={closeArchivedStagePrompt}
                contentSx={{
                    p: 0,
                    maxWidth: 'min(520px, 92vw)',
                    overflow: 'hidden',
                }}
            >
                <Box
                    sx={{
                        p: 3,
                        borderRadius: 3,
                        border: `1px solid ${alpha(theme.palette.warning.main, 0.18)}`,
                        background: alpha(theme.palette.warning.light, 0.1),
                    }}
                >
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.25 }}>
                        Archived Stage Found
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                        Stage "{matchedArchivedStage?.title || 'this stage'}" is currently archived.
                        Do you want to unarchive this stage?
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                        <MUIButton variant="outlined" onClick={closeArchivedStagePrompt}>
                            Cancel
                        </MUIButton>
                        <MUIButton variant="contained" onClick={handleUnarchiveArchivedStage}>
                            Unarchive Stage
                        </MUIButton>
                    </Box>
                </Box>
            </MUIModal>

            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    pt: 2,
                    p: { xs: 2, sm: 4 },
                    background: alpha(theme.palette.primary.main, 0.02),
                }}
            >
                <MUICreateForm
                    key={`stage-form-${editing ? stageId : 'new'}`}
                    initialValuesDict={normInit}
                    fields={fields}
                    formCardOptions={{
                        sx: {
                            width: { xs: '100%', sm: '85%', md: '60%', lg: '50%', xl: '40%' },
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
                    submitUrl={submitUrl}
                    submitMethod={submitMethod}
                    onBeforeSubmit={async ({ formData, formEl }) => {
                        const currentTitle = getCurrentStageTitleValue(formData, formEl);
                        const hasArchivedMatch = await maybePromptArchivedStage(currentTitle);
                        return !hasArchivedMatch;
                    }}
                    onSubmitExtended={onSubmitExtended}
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
                        <MUIButton onClick={() => navigate('/stages/')} sx={{ px: 2 }}>
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
                            {editing ? 'Update Stage' : 'Create Stage'}
                        </MUIButton>
                    </Box>
                </MUICreateForm>
            </Box>
        </>
    );
}
