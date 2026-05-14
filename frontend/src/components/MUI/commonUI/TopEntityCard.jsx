// src/components/MUI/commonUI/TopEntityCard.jsx
import React from 'react';
import {
    Card,
    CardContent,
    Box,
    Typography,
    LinearProgress,
    CircularProgress,
    Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

export default function TopEntityCard({
    onClick,
    avatarContent,            // text or node inside the circle ("85%", "AS", icon, etc.)
    title,                    // main title
    subtitle,                 // optional subtitle (node or string)
    loading = false,          // show "Analyzing..." style
    progressValue,            // number 0–100, if passed we show linear progress
    progressOnClick,          // click handler for the progress bar (for your relevancy modal)
    progressTooltip,          // tooltip on progress (e.g. "85%")
    stats = [],               // [{ label, value, showAnalyzingWhenEmpty, long }]
}) {
    const theme = useTheme();
    // Decide progress bar color based on value (same logic you used earlier)
    const pct = Number.isFinite(Number(progressValue))
        ? Number(progressValue)
        : 0;

    const lowThreshold = 100 / 3;
    const midThreshold = (100 / 3) * 2;

    let barColor = theme.palette.success.main;
    if (pct < lowThreshold) {
        barColor = theme.palette.error.main;
    } else if (pct < midThreshold) {
        barColor = theme.palette.warning.main;
    }

    const showProgress = progressValue !== undefined && progressValue !== null;

    return (
        <Card
            sx={{
                borderRadius: 4,
                boxShadow: `0 12px 28px ${alpha(theme.palette.common.black, 0.1)}`,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                height: '100%',
                cursor: onClick ? 'pointer' : 'default',
                backdropFilter: 'blur(8px)',
            }}
            onClick={onClick}
        >
            {/* HEADER */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 2,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    gap: 1.5,
                    background: `linear-gradient(135deg, ${alpha(
                        theme.palette.primary.main,
                        0.12,
                    )} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
                }}
            >
                {/* AVATAR CIRCLE */}
                <Box
                    sx={{
                        width: 54,
                        height: 54,
                        borderRadius: '50%',
                        background: `linear-gradient(145deg, ${theme.palette.primary.light}, ${theme.palette.primary.main})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: theme.palette.primary.contrastText,
                        fontWeight: 700,
                        fontSize: 18,
                        boxShadow: `0 10px 22px ${alpha(theme.palette.common.black, 0.16)}`,
                    }}
                >
                    {avatarContent}
                </Box>

                {/* TITLE + SUBTITLE + OPTIONAL PROGRESS */}
                <Box sx={{ flexGrow: 1 }}>
                    {/* NOTE: component="div" avoids <h6> inside <h6> */}
                    <Typography component="div" variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                        {title}
                    </Typography>

                    {/* Subtitle (can be text or node, optional) */}
                    {subtitle}

                    {/* Progress (for relevancy use-case) */}
                    {showProgress && (
                        <Box sx={{ mt: 1 }}>
                            <Tooltip title={progressTooltip || `${Math.round(pct)}%`}>
                                <Box
                                    sx={{ cursor: progressOnClick ? 'pointer' : 'default' }}
                                    onClick={e => {
                                        if (!progressOnClick) return;
                                        e.stopPropagation();
                                        progressOnClick(e);
                                    }}
                                >
                                    <Box sx={{ position: 'relative' }}>
                                        <LinearProgress
                                            variant="determinate"
                                            value={pct}
                                            sx={{
                                                height: 10,
                                                borderRadius: 999,
                                                backgroundColor: alpha(theme.palette.primary.main, 0.12),
                                                '& .MuiLinearProgress-bar': {
                                                    borderRadius: 999,
                                                    backgroundColor: barColor,
                                                },
                                            }}
                                        />
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                inset: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Typography variant="caption" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                                                {progressTooltip || `${Math.round(pct)}%`}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            </Tooltip>
                        </Box>
                    )}

                    {/* Optional "Analyzing…" line (for relevancy, when loading) */}
                    {loading && !showProgress && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <CircularProgress size={14} />
                            <Typography variant="body2" sx={{ color: theme.palette.primary.main, fontWeight: 600 }}>
                                Analyzing…
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>

            {/* BODY: STATS LIST */}
            <CardContent sx={{ pt: 2, pb: 2 }}>
                {stats.map(stat => {
                    const {
                        label,
                        value,
                        showAnalyzingWhenEmpty = false,
                        long = false, // allow longer pill width (for "Reason")
                    } = stat;

                    const isEmpty = value === undefined || value === null || value === '—';
                    const showAnalyzing = loading && showAnalyzingWhenEmpty && isEmpty;

                    return (
                        <Box
                            key={label}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                mb: 1.1,
                            }}
                        >
                            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 500 }}>
                                {label}
                            </Typography>

                            <Box
                                sx={{
                                    px: 1.4,
                                    py: 0.35,
                                    borderRadius: 999,
                                    backgroundColor: alpha(theme.palette.primary.main, 0.12),
                                    color: theme.palette.primary.dark,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    minWidth: 52,
                                    textAlign: 'center',
                                    maxWidth: long ? '100%' : '60%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {showAnalyzing ? (
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 0.75,
                                        }}
                                    >
                                        <CircularProgress size={10} />
                                        <Typography
                                            variant="caption"
                                            sx={{ color: theme.palette.primary.dark, fontWeight: 600 }}
                                        >
                                            Analyzing…
                                        </Typography>
                                    </Box>
                                ) : (
                                    value ?? '—'
                                )}
                            </Box>
                        </Box>
                    );
                })}
            </CardContent>
        </Card>
    );
}
