import React, { useEffect, useState } from 'react';
import MUIModal from '../commonUI/MUIModal';
import MUIButton from '../commonUI/MUIButton';
import { Box, Typography, Checkbox, FormControlLabel, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';

export const MUIArchiveCnfModal = ({
    open,
    onClose,
    onConfirm,
    itemName = 'record',
    actionName = 'Archive',
    variant = 'default',
    showKeepInPool = false,
    keepInPoolLabel = 'Keep this candidate in the Talent Pool',
    defaultKeepInPool = true,
}) => {
    const [keepInPool, setKeepInPool] = useState(defaultKeepInPool);

    useEffect(() => {
        if (open) setKeepInPool(defaultKeepInPool);
    }, [open, defaultKeepInPool]);

    const actionLower = String(actionName || 'Archive').toLowerCase();
    const nameText =
        itemName && itemName !== 'record'
            ? itemName
            : (variant === 'candidate' ? 'this candidate' : 'this record');

    const titleText =
        variant === 'candidate'
            ? `${actionName} Candidate?`
            : `${actionName} ${itemName && itemName !== 'record' ? itemName : 'Record'}?`;

    const descriptionText =
        variant === 'candidate'
            ? `Are you sure you want to ${actionLower} ${nameText}'s profile?`
            : `Are you sure you want to ${actionLower} ${nameText}?`;

    const actionColor =
        actionLower.includes('unarchive') || actionLower.includes('restore')
            ? 'primary'
            : 'error';

    return (
        <MUIModal
            open={open}
            onClose={onClose}
            contentSx={{
                p: 0,
                maxWidth: 'min(520px, 92vw)',
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    width: '100%',
                    p: 3,
                    borderRadius: 3,
                    position: 'relative',
                    textAlign: 'center',
                    bgcolor: '#f7f5ff',
                    border: '1px solid #e4ddff',
                }}
            >
                <IconButton
                    onClick={onClose}
                    sx={{ position: 'absolute', top: 8, right: 8, color: '#8b8aa3' }}
                    size="small"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>

                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <Box
                        sx={{
                            borderRadius: 3,
                            bgcolor: '#fff4e5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <ArchiveRoundedIcon sx={{ fontSize: 48, color: '#f59e0b' }} />
                    </Box>
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                    {titleText}
                </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280', mb: 2 }}>
                    {descriptionText}
                </Typography>

                {showKeepInPool ? (
                    <Box
                        sx={{
                            border: '1px solid #e4ddff',
                            borderRadius: 2,
                            px: 2,
                            py: 1.2,
                            bgcolor: '#f4f2ff',
                            display: 'flex',
                            justifyContent: 'flex-start',
                            mb: 2,
                        }}
                    >
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={keepInPool}
                                    onChange={(e) => setKeepInPool(e.target.checked)}
                                />
                            }
                            label={keepInPoolLabel}
                        />
                    </Box>
                ) : null}

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                    <MUIButton variant="outlined" onClick={onClose}>
                        Cancel
                    </MUIButton>
                    <MUIButton
                        variant="contained"
                        color={actionColor}
                        onClick={() => onConfirm?.(keepInPool)}
                    >
                        {actionName}
                    </MUIButton>
                </Box>
            </Box>
        </MUIModal>
    );
};

export default MUIArchiveCnfModal;
