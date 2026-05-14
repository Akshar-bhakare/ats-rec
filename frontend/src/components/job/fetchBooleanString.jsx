/* eslint-disable react-refresh/only-export-components */
// src/utils/jobServices/fetchBooleanString.jsx
import React from 'react';
import { fetchData, performDeploySafeFetch } from '../../AppUtils/dataAPI';
import { Box, Typography, TextField, Button } from '@mui/material';
import MUIModal from '../MUI/commonUI/MUIModal';
import MUIButton from '../MUI/commonUI/MUIButton';

/**
 * Call the generate‐boolean API and return the string (or empty on failure).
 * @param {string[]} skills
 * @returns {Promise<string>}
 */
export async function fetchBooleanString(skills, userEmail = undefined, demoOf = undefined, setUiState = null) {
    if (!Array.isArray(skills) || skills.length < 1) {
        console.warn('Need at least 1 skill');
        return '';
    }
    try {
        const json = await performDeploySafeFetch(
            "Generate Boolean String",
            () => fetchData('/api/jobs/generate-boolean' + (userEmail ? "/demo/" : ""), {
                method: 'POST',
                body: JSON.stringify({ skills, userEmail, demoOf }),
            }),
            setUiState,
            "Generating Boolean String"
        );
        return json.success && json.booleanString
            ? json.booleanString
            : '';
    } catch (err) {
        console.error('Boolean API call failed:', err);
        throw err;
    }
}

/**
 * A MUI Modal that displays a read-only boolean string and lets you copy it.
 *
 * Props:
 *   open          — boolean
 *   booleanString  — string
 *   onClose        — () ⇒ void
 */
export function BooleanModal({ open, booleanString, onClose, onChange }) {
    const handleChange = (e) => {
        onChange?.(e.target.value);
    };

    return (
        <MUIModal open={open} onClose={onClose}>
            <Box sx={{ bgcolor: 'background.paper', p: 3, borderRadius: 1, minWidth: 400 }}>
                <Typography variant="h6" gutterBottom>
                    Generated Boolean String
                </Typography>

                <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={booleanString}
                    onChange={handleChange}   // Now editable
                    sx={{ mb: 2 }}
                />

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <MUIButton
                        variant="outlined"
                        onClick={() => navigator.clipboard.writeText(booleanString)}
                    >
                        Copy
                    </MUIButton>
                    <MUIButton variant="outlined" onClick={onClose}>
                        Close
                    </MUIButton>
                </Box>
            </Box>
        </MUIModal>
    );
}
