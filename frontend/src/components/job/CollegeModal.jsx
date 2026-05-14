import React, { useState } from 'react';
import {
    Box,
    Typography,
    Modal,
    Grid,
    FormControlLabel,
    Checkbox,
    TextField,
    MenuItem
} from '@mui/material';
import Button from '../MUI/commonUI/MUIButton';



export default function CollegeModal({
    open,
    onClose,
    colleges,
    picks,
    toggleCollege,
    confirmCollege,
    newName,
    setNewName,
    newCity,
    setNewCity,
    newState,
    setNewState,
    newTier,
    setNewTier,
    addNewCollege
}) {
    const [searchTerm, setSearchTerm] = useState('');

    // Filter colleges by search term (case-insensitive)
    const filteredColleges = {};
    Object.entries(colleges).forEach(([tier, list]) => {
        filteredColleges[tier] = list.filter(c =>
            c.toLowerCase().includes(searchTerm.toLowerCase())
        );
    });

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '95vw',
                    maxWidth: 1200,
                    maxHeight: 700,
                    bgcolor: 'background.paper',
                    boxShadow: 24,
                    p: 4,
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    overflowY: 'auto'
                }}
            >
                <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', justifyContent: 'space-between', }}>
                    <Typography variant="h6" sx={{ flexShrink: 0 }}>Select a College</Typography>

                    <TextField
                        size='small'
                        label="Search Colleges"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        sx={{ mb: 2, width: '50vh' }}
                    />
                </Box>
                <Box sx={{ display: 'flex', gap: 4, overflowX: 'auto', pr: 2 }}>
                    {Object.entries(filteredColleges).map(([tier, list]) => {
                        if (list.length === 0) return null;

                        const tierLabel = tier.replace('tier', 'Tier ');
                        const columns = [];
                        for (let i = 0; i < list.length; i += 15) {
                            columns.push(list.slice(i, i + 15));
                        }

                        return (
                            <Box key={tier} sx={{ minWidth: 280 }}>
                                <Typography
                                    variant="subtitle2"
                                    sx={{ mb: 1, textTransform: 'uppercase', color: 'text.secondary' }}
                                >
                                    {tierLabel}
                                </Typography>

                                <Grid container spacing={2}>
                                    {columns.map((col, colIdx) => (
                                        <Grid item xs="auto" key={colIdx}>
                                            {col.map((college) => (
                                                <FormControlLabel
                                                    key={college + "_" + colIdx}
                                                    control={
                                                        <Checkbox
                                                            size="small"
                                                            checked={picks[college] || false}
                                                            onChange={() => toggleCollege(college)}
                                                        />
                                                    }
                                                    label={
                                                        <Typography variant="body2" sx={{ whiteSpace: 'normal' }}>
                                                            {college}
                                                        </Typography>
                                                    }
                                                />
                                            ))}
                                        </Grid>
                                    ))}
                                </Grid>
                            </Box>
                        );
                    })}
                </Box>

                {/* New College Form */}
                <Box sx={{ borderTop: '1px solid #ddd', pt: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>Add a New College</Typography>

                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                size='small'
                                fullWidth
                                label="Institute Name"
                                value={newName || ''}
                                onChange={e => setNewName(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                size='small'
                                fullWidth
                                label="City"
                                value={newCity || ''}
                                onChange={e => setNewCity(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                size='small'
                                fullWidth
                                label="State"
                                value={newState || ''}
                                onChange={e => setNewState(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                size='small'
                                select
                                fullWidth
                                label="Tier"
                                value={newTier}
                                onChange={e => setNewTier(e.target.value)}
                            >
                                {['tier1', 'tier2', 'tier3', 'other'].map(t => (
                                    <MenuItem key={t} value={t}>
                                        {t.replace('tier', 'Tier ').toUpperCase()}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Grid>

                        <Grid item xs={12}>
                            <Button
                                variant="outlined"
                                onClick={addNewCollege}
                                disabled={!newName || !newCity || !newState}
                            >
                                Add to List
                            </Button>
                        </Grid>
                    </Grid>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, justifyContent: "space-around", py: 2, mt: 4 }}>
                    <Button variant="contained" sx={{ width: "20%" }} onClick={confirmCollege}>
                        Confirm
                    </Button>
                    <Button sx={{ width: "20%" }} onClick={onClose}>
                        Cancel
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}
