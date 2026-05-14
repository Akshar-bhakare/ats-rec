import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MUICenterLayout from '../../MUI/commonUI/MUICenterLayout';
import MUIArchiveCnfModal from '../../MUI/CommonCRUD/MUIArchiveCnfModal';
import {
    Box,
    Typography,
    Divider,
    IconButton,
} from '@mui/material';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { fetchData } from '../../../AppUtils/dataAPI';
import MUIButton from '../../MUI/commonUI/MUIButton';
import { useStageContextState } from '../../../contexts/StageContext';
import { useUiContextState } from '../../../contexts/UiContext';
import { Archive, Edit } from '@mui/icons-material';
import { setDocumentTitle } from '../../../AppUtils/documentTitle';



export default function StageDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [, setStageState] = useStageContextState();
    const [, setUiState] = useUiContextState();

    const [stage, setStage] = useState(null);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const loadStage = () => {
        if (!id) return;

        // setUiState({
        //     loadingMsg: "Loading, Please wait..."
        // });

        fetchData(`/api/stages/${id}`)
            .then(s => setStage(s))
            .catch(console.error)
            .finally(() => {
                setUiState({
                    loadingMsg: null,
                });
            });
    };

    useEffect(() => {
        loadStage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        setDocumentTitle(stage?.title || 'Stage Detail');
    }, [stage?.title]);

    if (!stage) {
        return (
            <MUICenterLayout>
                <Typography>Loading…</Typography>
            </MUICenterLayout>
        );
    }

    // const handleEdit = () => {
    //     setStageState({
    //         stageInitialValuesDict: {
    //             id: stage._id,
    //             stages: [{
    //                 title: stage.title,
    //                 description: stage.description || '',
    //                 status: stage.status || `${stage.title} Select`,
    //             }],
    //         }
    //     });
    //     navigate('/stages/new/');
    // };

    const handleArchive = () => {
        // setUiState({
        //     loadingMsg: "Loading, Please wait..."
        // });

        fetchData(`/api/stages/${stage._id}`, { method: 'DELETE' })
            .then(() => {
                setStageState({ stageListDirty: true });
                navigate('/stages');
            })
            .catch(console.error)
            .finally(() => {

                setUiState({
                    loadingMsg: null,
                });

            });
    }

    const display = (v) => (v ? v : '—');

    return (
        <Box sx={{ px: { xs: 2, sm: 4, md: 6 }, py: 4 }}>
            <Box sx={{ width: '100%', p: { xs: 1, sm: 2 } }}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 3,
                        flexDirection: { xs: 'column', sm: 'row' },
                        gap: 2,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton onClick={() => navigate(-1)}>
                            <ArrowBackIosIcon />
                        </IconButton>
                        <Typography variant="h5">{stage.title}</Typography>
                        <IconButton size="small" onClick={loadStage}>
                            <RefreshRoundedIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        {/* <MUIButton startIcon={<Edit />} onClick={handleEdit}>
                            Edit
                        </MUIButton> */}
                        <MUIButton startIcon={<Archive />} onClick={() => setDeleteOpen(true)}>
                            Archive
                        </MUIButton>
                    </Box>
                </Box>

                <Divider sx={{ mb: 3 }} />

                <Box
                    sx={{
                        mb: 3,
                        p: 2,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 2,
                    }}
                >
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                        {stage.title}
                    </Typography>
                    <Typography
                        color="text.secondary"
                        variant="subtitle2"
                        sx={{ mb: 0.5 }}
                    >
                        Discription
                    </Typography>
                    <Typography>{display(stage.description)}</Typography>
                </Box>

                {deleteOpen && <MUIArchiveCnfModal
                    open={deleteOpen}
                    onClose={() => setDeleteOpen(false)}
                    onConfirm={() => handleArchive()}
                    itemName={stage.title}
                >
                    Archive
                </MUIArchiveCnfModal>}
            </Box>
        </Box>
    );
}
