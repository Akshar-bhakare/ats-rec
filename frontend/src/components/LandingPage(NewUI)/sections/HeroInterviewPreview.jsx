import { MicRounded, PauseRounded, ReplayRounded, SlowMotionVideoRounded } from '@mui/icons-material';
import { Box, Typography, alpha } from '@mui/material';
import '../../../components/WebRTC.css';
import laylaAvatar from '../../../assets/layla-avatar.gif';
import defaultAvatar from '../../../assets/default_avatar.jpg';

const HeroInterviewPreview = ({ isDark, theme, showcaseTitle }) => {
    const primary = theme.palette.primary.main;
    const primaryDark = theme.palette.primary.dark;
    const textPrimary = theme.palette.text.primary;
    const textMuted = theme.palette.text.secondary;
    const surface = theme.palette.background.paper;
    const surfaceMuted = theme.palette.background.default;
    const border = theme.palette.divider;
    const info = theme.palette.info.main;
    const success = theme.palette.success.main;
    const warning = theme.palette.warning.main;
    const error = theme.palette.error.main;
    const onPrimary = theme.palette.getContrastText(primary);
    const onSuccess = theme.palette.getContrastText(success);
    const shadowSoft = theme.shadows[2] || 'none';
    const shadowStrong = theme.shadows[4] || shadowSoft;

    const rootVars = {
        '--webrtc-font': "'Sora','Space Grotesk','Outfit','Segoe UI',sans-serif",
        '--webrtc-surface': surface,
        '--webrtc-surface-muted': surfaceMuted,
        '--webrtc-panel': surface,
        '--webrtc-panel-border': border,
        '--webrtc-border': border,
        '--webrtc-accent': primary,
        '--webrtc-accent-strong': primaryDark,
        '--webrtc-accent-soft': alpha(primary, isDark ? 0.2 : 0.12),
        '--webrtc-accent-soft-strong': alpha(primary, isDark ? 0.35 : 0.2),
        '--webrtc-success': success,
        '--webrtc-success-soft': alpha(success, isDark ? 0.2 : 0.12),
        '--webrtc-warning': warning,
        '--webrtc-warning-soft': alpha(warning, isDark ? 0.2 : 0.12),
        '--webrtc-error': error,
        '--webrtc-error-soft': alpha(error, isDark ? 0.2 : 0.12),
        '--webrtc-info': info,
        '--webrtc-info-soft': alpha(info, isDark ? 0.2 : 0.12),
        '--webrtc-on-accent': onPrimary,
        '--webrtc-overlay': alpha(theme.palette.common.black, 0.6),
        '--webrtc-overlay-soft': alpha(theme.palette.common.black, 0.45),
        '--webrtc-overlay-light': alpha(theme.palette.common.black, 0.18),
        '--webrtc-disabled-bg': alpha(textMuted, isDark ? 0.3 : 0.2),
        '--webrtc-disabled-text': textMuted,
        '--webrtc-shadow-soft': shadowSoft,
        '--webrtc-shadow-strong': shadowStrong,
        '--webrtc-page-bg': 'transparent',
        '--webrtc-text-primary': textPrimary,
        '--webrtc-text-muted': textMuted,
        '--webrtc-topbar-bg': surface,
        '--webrtc-topbar-text': primary,
        '--webrtc-topbar-subtext': textMuted,
        '--webrtc-topbar-chip-bg': surface,
        '--webrtc-topbar-chip-text': primary,
        '--webrtc-topbar-chip-border': alpha(primary, 0.45),
        '--webrtc-topbar-timer-bg': surface,
        '--webrtc-topbar-border': alpha(primary, 0.35),
        '--webrtc-controls-bg': alpha(primary, isDark ? 0.12 : 0.06),
        '--webrtc-controls-border': alpha(primary, isDark ? 0.3 : 0.2),
        '--webrtc-controls-label': textPrimary,
        '--webrtc-recording-pill-bg': success,
        '--webrtc-recording-pill-text': onSuccess,
        '--webrtc-panel-padding': '16px',
        '--webrtc-panel-padding-tight': '12px',
        '--webrtc-panel-height': '360px',
        '--webrtc-panel-min-height': '360px',
        '--webrtc-avatar-size': '220px',
        '--webrtc-shell-width': '100%',
        '--webrtc-shell-max-width': '100%',
        '--webrtc-question-bg': surface,
        '--webrtc-question-border': border,
        '--webrtc-question-shadow': shadowSoft,
        '--webrtc-question-progress-bg': alpha(primary, isDark ? 0.2 : 0.12),
        '--webrtc-question-progress-fill': primary,
        '--webrtc-question-muted': textMuted,
        '--webrtc-avatar-status-bg': alpha(surface, isDark ? 0.8 : 0.9),
        '--webrtc-proctoring-bg': alpha(surface, isDark ? 0.88 : 0.95),
        '--webrtc-proctoring-border': border,
        '--webrtc-frame-border': `1px solid ${border}`,
        '--webrtc-remote-border': `1px solid ${border}`,
        '--webrtc-transcript-bg': surfaceMuted,
        '--webrtc-transcript-padding': '12px 14px',
        '--webrtc-transcript-max-height': '360px',
        '--webrtc-transcript-border': border,
        '--webrtc-transcript-empty': textMuted,
        '--webrtc-transcript-ai': textPrimary,
        '--webrtc-human-grid-padding': '12px',
        '--webrtc-waiting-color': textMuted,
        '--webrtc-human-note-bg': surfaceMuted,
        '--webrtc-human-note-border': border,
        '--webrtc-instructions-bg': alpha(surface, isDark ? 0.9 : 0.96),
        '--webrtc-instructions-padding': '14px 16px',
        '--webrtc-bottom-bar-bg': alpha(surface, isDark ? 0.92 : 0.98),
        '--webrtc-bottom-transcript-bg': surface,
        '--webrtc-avatar-bg': surface
    };

    return (
        <Box
            className={`webrtc-root ${isDark ? 'webrtc-dark' : 'webrtc-light'} webrtc-ai webrtc-size-lg`}
            style={rootVars}
            sx={{
                minHeight: 'auto',
                p: 0,
                bgcolor: 'transparent',
                '& .webrtc-shell': {
                    width: '100%',
                    maxWidth: '100%',
                    m: 0,
                    borderRadius: '20px',
                    '@media (max-width: 899px)': {
                        minHeight: '80vh',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                    }
                },
                '& .webrtc-ai-grid': {
                    gridTemplateColumns: '1.08fr 1.4fr 0.88fr',
                    gridTemplateAreas: '"video question avatar"',
                    '@media (max-width: 899px)': {
                        gridTemplateColumns: '1fr 1fr',
                        gridTemplateAreas: '"video avatar" "question question"'
                    }
                },
                '& .webrtc-question-text': {
                    fontSize: '1.02rem',
                    lineHeight: 1.5,
                    '@media (max-width: 899px)': {
                        fontSize: '1rem'
                    }
                },
                '& .webrtc-bottom-bar': {
                    display: 'none'
                },
                '& .webrtc-smart-proctoring': {
                    marginBottom: 0,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '12px',
                    '@media (max-width: 899px)': {
                        display: 'none'
                    }
                },
                '& .webrtc-smart-proctoring-right': {
                    width: 'auto',
                    display: 'block',
                    justifyContent: 'initial',
                    '@media (max-width: 899px)': {
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'flex-end'
                    }
                },
                '& .webrtc-preview-camera': {
                    position: 'relative',
                    display: 'grid',
                    placeItems: 'center',
                    background: isDark
                        ? 'linear-gradient(180deg, rgba(30,41,59,0.96) 0%, rgba(15,23,42,0.98) 100%)'
                        : 'linear-gradient(180deg, #eef5ff 0%, #dbe7f5 100%)'
                },
                '& .webrtc-preview-camera::after': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background: isDark
                        ? 'radial-gradient(circle at 76% 16%, rgba(249,115,22,0.18), transparent 22%)'
                        : 'radial-gradient(circle at 76% 16%, rgba(249,115,22,0.12), transparent 22%)'
                },
                '& .webrtc-preview-camera-avatar': {
                    position: 'relative',
                    zIndex: 1,
                    width: '68%',
                    height: 'auto',
                    maxWidth: 240,
                    objectFit: 'contain',
                    opacity: 0.96,
                    filter: 'drop-shadow(0 16px 28px rgba(15, 23, 42, 0.12))',
                    '@media (max-width: 899px)': {
                        width: 'auto',
                        height: '130px'
                    }
                },
                '& .webrtc-video-label': {
                    zIndex: 2
                },
                '& .webrtc-panel--video, & .webrtc-panel--avatar': {
                    minHeight: 'var(--webrtc-panel-min-height)',
                    height: 'var(--webrtc-panel-height)',
                    '@media (max-width: 899px)': {
                        minHeight: '200px',
                        height: '200px'
                    }
                },
                '& .webrtc-panel--avatar': {
                    backgroundImage: 'none'
                },
                '& .webrtc-preview-layla': {
                    width: '100%',
                    height: 'auto',
                    maxWidth: 215,
                    objectFit: 'contain',
                    '@media (max-width: 899px)': {
                        width: 'auto',
                        height: '130px'
                    }
                }
            }}
        >
            {showcaseTitle && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 1.4, md: 1.7 } }}>
                    <Box
                        sx={{
                            px: 2.4,
                            py: 0.85,
                            borderRadius: 999,
                            border: `1px solid ${alpha(primary, 0.16)}`,
                            bgcolor: alpha(primary, 0.08)
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: { xs: '0.95rem', md: '1rem' },
                                fontWeight: 900,
                                letterSpacing: '-0.01em',
                                color: 'text.primary'
                            }}
                        >
                            {showcaseTitle}
                        </Typography>
                    </Box>
                </Box>
            )}

            <div className="webrtc-shell">
                <div className="webrtc-ai-grid">
                    <div className="webrtc-panel webrtc-panel--video">
                        <div className="webrtc-video-frame webrtc-video-frame--full webrtc-preview-camera">
                            <Box
                                component="img"
                                src={defaultAvatar}
                                alt="Candidate camera preview"
                                className="webrtc-preview-camera-avatar"
                            />
                            <div className="webrtc-video-label">You</div>
                        </div>
                    </div>

                    <div className="webrtc-panel webrtc-panel--question">
                        <div className="webrtc-question-head">
                            <div className="webrtc-question-meta">
                                <span className="webrtc-question-label">
                                    Question 1
                                </span>
                                <span className="webrtc-question-badge">
                                    Ready when you are
                                </span>
                            </div>
                            <div className="webrtc-question-scroll">
                                <p className="webrtc-question-text">
                                    When you&apos;re ready, click Start Answering.
                                </p>
                            </div>
                        </div>

                        <div className="webrtc-question-progress">
                            <span className="webrtc-question-progress-bar" />
                        </div>

                        <div className="webrtc-question-actions">
                            <div className="webrtc-question-quick-actions">
                                <button type="button" className="webrtc-transcript-btn webrtc-quick-btn">
                                    <ReplayRounded className="webrtc-quick-btn-icon" />
                                    <span>Repeat Question</span>
                                </button>
                                <button type="button" className="webrtc-transcript-btn webrtc-quick-btn">
                                    <PauseRounded className="webrtc-quick-btn-icon" />
                                    <span>Pause</span>
                                </button>
                                <button type="button" className="webrtc-transcript-btn webrtc-quick-btn">
                                    <SlowMotionVideoRounded className="webrtc-quick-btn-icon" />
                                    <span>Slow Down</span>
                                </button>
                            </div>

                            <button type="button" className="webrtc-start-btn webrtc-start-btn--question">
                                <MicRounded className="webrtc-start-icon" />
                                <span>Start Answering</span>
                            </button>
                        </div>

                        <div className="webrtc-question-utility">
                            <button type="button" className="webrtc-transcript-btn">
                                View Transcript
                            </button>
                            <button type="button" className="webrtc-end-interview-btn">
                                End Interview
                            </button>
                        </div>
                    </div>

                    <div className="webrtc-panel webrtc-panel--avatar">
                        <Box
                            component="img"
                            src={laylaAvatar}
                            alt="AI interviewer"
                            className="webrtc-preview-layla"
                        />
                        <div className="webrtc-avatar-status">
                            <span className="webrtc-avatar-dot is-speaking" />
                            Speaking...
                        </div>
                    </div>
                </div>

                <div className="webrtc-smart-proctoring">
                    <div className="webrtc-smart-proctoring-left">
                        <div className="webrtc-smart-proctoring-title">
                            Smart Proctoring enabled
                        </div>
                        <div className="webrtc-smart-proctoring-text">
                            Your camera, mic, and environment are monitored to ensure test integrity.
                        </div>
                        <div className="webrtc-smart-proctoring-warning">
                            <strong>Anti-cheat active:</strong> Camera is mandatory and this tab must stay in focus. Tab switches, camera interruptions, multiple faces and abnormal audio are monitored.
                            {/* <div className="webrtc-smart-proctoring-alert">
                                <span>
                                    <strong>Warning:</strong>{' '}
                                    we detected a screenshot attempt. Screenshots are not allowed during this interview. Violations so far: 4.
                                </span>
                                <button type="button" className="webrtc-smart-proctoring-dismiss">
                                    Got it
                                </button>
                            </div> */}
                        </div>
                    </div>
                    <div className="webrtc-smart-proctoring-right">
                        <button type="button" className="webrtc-smart-proctoring-link">
                            What is monitored?
                        </button>
                    </div>
                </div>
            </div>
        </Box>
    );
};

export default HeroInterviewPreview;
