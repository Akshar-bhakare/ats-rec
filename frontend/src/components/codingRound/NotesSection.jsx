import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Paper, TextField } from '@mui/material';
import { NoteAlt, Save, CheckCircle } from '@mui/icons-material';

export default function NotesSection({ interviewId }) {
    const [notes, setNotes] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const savedNotes = localStorage.getItem(`notes_${interviewId}`);
        if (savedNotes) {
            setNotes(savedNotes);
        }
    }, [interviewId]);

    const handleNotesChange = (event) => {
        const newNotes = event.target.value;
        setNotes(newNotes);
        setSaved(false);
        // Auto-save to local storage
        localStorage.setItem(`notes_${interviewId}`, newNotes);
    };

    // Effect to show "saved" after user stops typing
    useEffect(() => {
        if (!saved) {
            const timer = setTimeout(() => {
                setSaved(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [notes, saved]);

    return (
        <Paper
            elevation={0}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.paper',
                backdropFilter: 'blur(8px)',
                color: 'text.primary',
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider'
            }}
        >
            <Box sx={{
                p: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: 'text.primary' }}>
                    Platform Notes / Pseudocode
                </Typography>
                {saved && (
                    <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                        Saved ✓
                    </Typography>
                )}
            </Box>
            <Box
                sx={{
                    flex: 1,
                    p: 2,
                    overflowY: 'auto',
                    '& .MuiInputBase-root': { height: '100%' }
                }}
            >
                <TextField
                    multiline
                    fullWidth
                    value={notes}
                    onChange={handleNotesChange}
                    placeholder="Start typing your notes here..."
                    variant="standard"
                    InputProps={{
                        disableUnderline: true,
                        sx: {
                            color: 'text.primary',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '0.9rem',
                            height: '100%',
                            p: 0,
                            alignItems: 'flex-start'
                        }
                    }}
                    sx={{
                        height: '100%',
                        '& .MuiInputBase-root': {
                            height: '100%'
                        },
                        '& .MuiInputBase-input': {
                            height: '100% !important',
                            overflow: 'auto !important'
                        }
                    }}
                />
            </Box>
        </Paper>
    );
}
