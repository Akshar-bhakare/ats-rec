import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import MemoryIcon from '@mui/icons-material/Memory';
import { fetchData } from '../../AppUtils/dataAPI';

// Simple read-only code block
const CodeBlock = ({ code }) => (
    <Box
        sx={(theme) => ({
            bgcolor: theme.palette.background.default,
            color: theme.palette.text.primary,
            p: 2,
            borderRadius: 2,
            overflow: 'auto',
            fontFamily: '"Fira Code", "Consolas", monospace',
            fontSize: '14px',
            lineHeight: 1.5,
            border: '1px solid',
            borderColor: theme.palette.divider,
            maxHeight: { xs: 320, sm: 420, md: 520 }
        })}
    >
        <Box
            component="pre"
            sx={{
                m: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere'
            }}
        >
            {code}
        </Box>
    </Box>
);

export default function FinalCodeReview({ interviewId, candidateId, showDetails = true }) {
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!interviewId) return;

        const loadFinalSubmission = async () => {
            setLoading(true);
            try {
                // Pass candidateId if we are viewing as admin/recruiter (handled by context usually, but explicit is safe)
                // The route handles ?userId query param
                console.log(`[FinalCodeReview] Fetching for interviewId: ${interviewId}, candidateId: ${candidateId}`);
                const url = `/api/codejudge/interviews/${interviewId}/final-submission${candidateId ? `?userId=${candidateId}` : ''}`;
                const data = await fetchData(url);
                setSubmission(data);
            } catch (err) {
                console.error("[FinalCodeReview] Error loading submission:", err);
                // Handle 404 (Not Found) specifically - treat as no submission
                // fetchData might throw the response body (err.message) or the response object (err.status)
                const isNotFound = err.status === 404 || (err.message && err.message.toLowerCase().includes('no final submission found'));

                if (isNotFound && candidateId) {
                    try {
                        console.warn('[FinalCodeReview] Submission not found for userId; retrying without userId');
                        const fallbackUrl = `/api/codejudge/interviews/${interviewId}/final-submission`;
                        const fallback = await fetchData(fallbackUrl);
                        setSubmission(fallback);
                        return;
                    } catch (fallbackErr) {
                        console.error('[FinalCodeReview] Fallback submission fetch failed:', fallbackErr);
                    }
                }

                if (!isNotFound) {
                    setError(err.message || 'Failed to load submission');
                }
            } finally {
                setLoading(false);
            }
        };

        loadFinalSubmission();
    }, [interviewId, candidateId]);

    if (loading) return <CircularProgress size={20} />;
    if (error) return <Alert severity="error">{error}</Alert>;
    if (!submission) return <Alert severity="info">No final submission recorded for this interview.</Alert>;

    const {
        sourceCode,
        language,
        passedTestCases,
        totalTestCases,
        executionTime,
        memoryUsed,
        status,
        results = []
    } = submission;

    // Calculate pass percentage
    const passPercent = totalTestCases > 0 ? Math.round((passedTestCases / totalTestCases) * 100) : 0;

    // Status Badge Color
    const getStatusColor = (s) => {
        if (s === 'accepted') return 'success';
        if (s === 'wrong_answer') return 'error';
        if (s === 'time_limit_exceeded') return 'warning';
        if (s === 'runtime_error') return 'error';
        return 'default';
    };

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CodeIcon color="primary" />
                Candidate's Final Submission
            </Typography>

            <Paper variant="outlined" sx={{ p: 0, overflow: 'hidden', borderRadius: 2 }}>
                {/* Header Stats */}
                <Box sx={{
                    p: 2,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 3,
                    bgcolor: 'action.hover',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    alignItems: 'center'
                }}>
                    <Chip
                        label={status ? status.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
                        color={getStatusColor(status)}
                        sx={{ fontWeight: 'bold' }}
                    />

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckCircleOutlineIcon fontSize="small" color={passPercent === 100 ? 'success' : 'action'} />
                        <Typography variant="body2" fontWeight={600}>
                            {passedTestCases} / {totalTestCases} Test Cases Passed
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <AccessTimeIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                            {executionTime ? `${(executionTime * 1000).toFixed(0)} ms` : '-'}
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <MemoryIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                            {memoryUsed ? `${(memoryUsed / 1024).toFixed(2)} MB` : '-'}
                        </Typography>
                    </Box>

                    <Chip label={language?.name || 'Unknown Language'} size="small" variant="outlined" />
                </Box>

                {/* Source Code */}
                <Box sx={{ p: 0 }}>
                    <CodeBlock code={sourceCode} />
                </Box>

                {/* Detailed Results Table */}
                {showDetails && results.length > 0 && (
                    <Box sx={{ p: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Test Case Details</Typography>
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                        <TableCell>Test Case</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Time</TableCell>
                                        <TableCell>Memory</TableCell>
                                        <TableCell>Message</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {results.map((res, idx) => (
                                        <TableRow key={idx} hover>
                                            <TableCell>#{res.testCaseId?.order ?? (idx + 1)}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={res.status?.label || res.status?.description || 'Unknown'}
                                                    size="small"
                                                    color={res.status?.id === 3 ? 'success' : 'error'}
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>{res.time ? `${(res.time * 1000).toFixed(0)} ms` : '-'}</TableCell>
                                            <TableCell>{res.memory ? `${(res.memory / 1024).toFixed(2)} MB` : '-'}</TableCell>
                                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                                {res.message ? (
                                                    <span title={res.message}>
                                                        {res.message.length > 50 ? res.message.substring(0, 50) + '...' : res.message}
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}
