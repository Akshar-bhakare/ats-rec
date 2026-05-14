/**
 * InterviewPlayback
 *
 * Multi-track WebM playback overlay. Sync model mirrors the MP4 pipeline:
 *  - AI interview: single full-width candidate video
 *  - Human / Human+AI:
 *      Left  37.5% — interviewers stacked top→bottom
 *      Right 62.5% — candidate
 *
 * Each track has an independent loading/buffering overlay.
 * A track that hasn't "joined" yet (globalTime < its offsetSec) shows a
 * black screen with a "Waiting for participant..." message — same as the
 * black space that ffmpeg pads in the downloaded MP4.
 */
import React, { useState, useCallback, useEffect } from 'react';
import usePlaybackSync from './usePlaybackSync';

// ── Inline styles ──────────────────────────────────────────────────────────────

const s = {
    overlay: {
        position: 'fixed', inset: 0, zIndex: 1400,
        background: '#0a0a0a',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#fff',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 18px',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
        gap: 12,
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
    title: { fontSize: 13, fontWeight: 600, opacity: 0.85 },
    badge: {
        fontSize: 11, padding: '2px 8px', borderRadius: 10,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        opacity: 0.7,
    },
    closeBtn: {
        background: 'none', border: 'none', color: '#fff',
        fontSize: 20, cursor: 'pointer', padding: '2px 8px',
        borderRadius: 4, lineHeight: 1, opacity: 0.7,
    },
    body: { flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 },
    leftCol: {
        width: '37.5%', display: 'flex', flexDirection: 'column',
        background: '#000', borderRight: '1px solid rgba(255,255,255,0.06)',
    },
    rightCol: {
        flex: 1, background: '#000', position: 'relative',
    },
    singleCol: { flex: 1, background: '#000', position: 'relative' },
    // Track wrapper — relative so overlays can be absolute inside
    trackWrap: {
        flex: 1, position: 'relative', overflow: 'hidden',
        background: '#000',
    },
    video: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
    // Overlay (black waiting / buffering spinner)
    trackOverlay: {
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#000',
        gap: 10,
    },
    overlayLabel: { fontSize: 12, opacity: 0.45, letterSpacing: 0.3 },
    // Buffering spinner (CSS-only ring)
    spinner: {
        width: 28, height: 28,
        border: '2px solid rgba(255,255,255,0.12)',
        borderTop: '2px solid rgba(255,255,255,0.6)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
    trackLabel: {
        position: 'absolute', top: 8, left: 10, zIndex: 2,
        background: 'rgba(0,0,0,0.55)', color: '#fff',
        fontSize: 10, letterSpacing: 0.4, padding: '2px 7px',
        borderRadius: 4, pointerEvents: 'none', textTransform: 'uppercase',
    },
    // Controls bar
    controls: {
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 18px',
        background: 'rgba(255,255,255,0.04)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
    },
    ctrlBtn: {
        background: 'none', border: '1px solid rgba(255,255,255,0.2)',
        color: '#fff', padding: '5px 16px', borderRadius: 6,
        cursor: 'pointer', fontSize: 13, fontWeight: 500,
        minWidth: 80,
    },
    seekBar: { flex: 1, accentColor: '#5b8def', cursor: 'pointer', height: 4 },
    timeLabel: {
        color: 'rgba(255,255,255,0.55)', fontSize: 12,
        minWidth: 90, textAlign: 'right', whiteSpace: 'nowrap',
    },
    bufBadge: {
        fontSize: 11, padding: '2px 8px', borderRadius: 10,
        background: 'rgba(255,200,50,0.12)', color: '#ffd84d',
        border: '1px solid rgba(255,200,50,0.25)',
    },
};

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('__playback_spin__')) {
    const el = document.createElement('style');
    el.id = '__playback_spin__';
    el.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(el);
}

const fmtTime = (sec) => {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const ss = Math.floor(sec % 60);
    return `${m}:${String(ss).padStart(2, '0')}`;
};

// ── PlaybackTrack ──────────────────────────────────────────────────────────────

/**
 * Renders one video + its overlays:
 *  - "Waiting…" black screen when the participant hasn't joined yet (beforeJoin)
 *  - "Participant has left" black screen when track ended but interview still playing (afterLeave)
 *  - Buffering spinner when loading chunks
 *
 * @param {{ videoRef, label, status, beforeJoin, afterLeave, wrapStyle }} props
 *   status:     'loading' | 'ready' | 'buffering'
 *   beforeJoin: boolean — true when globalTime < this track's offsetSec
 *   afterLeave: boolean — true when globalTime > this track's known global end time
 */
function PlaybackTrack({ videoRef, label, status, beforeJoin, afterLeave, wrapStyle }) {
    const showBlackScreen = beforeJoin || afterLeave || status === 'loading';
    const showSpinner = status === 'loading' || status === 'buffering';
    const overlayLabel = beforeJoin
        ? 'Waiting for participant…'
        : afterLeave
            ? 'Participant has left'
            : 'Loading…';

    return (
        <div style={{ ...s.trackWrap, ...(wrapStyle || {}) }}>
            {label && <div style={s.trackLabel}>{label}</div>}

            <video
                ref={videoRef}
                style={s.video}
                playsInline
            />

            {/* Black overlay — before-join, after-leave, or loading */}
            {showBlackScreen && (
                <div style={s.trackOverlay}>
                    {showSpinner && <div style={s.spinner} />}
                    <span style={s.overlayLabel}>{overlayLabel}</span>
                </div>
            )}

            {/* Buffering spinner layered on top of a playing video */}
            {!showBlackScreen && status === 'buffering' && (
                <div style={{ ...s.trackOverlay, background: 'rgba(0,0,0,0.55)' }}>
                    <div style={s.spinner} />
                    <span style={s.overlayLabel}>Buffering…</span>
                </div>
            )}
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function InterviewPlayback({ manifest, interviewScheduleId, onClose }) {
    const [isPlaying, setIsPlaying] = useState(false);

    // UI state for the seek bar
    const [isDragging, setIsDragging] = useState(false);
    const [pendingTime, setPendingTime] = useState(0);

    const {
        getVideoRef,
        trackStatus,
        trackOffsets,
        trackGlobalEnds,
        isBuffering,
        play,
        pause,
        seek,
        currentTime,
        duration,
    } = usePlaybackSync({ manifest, interviewScheduleId });

    const interviewerType = manifest?.interviewerType || 'AI';
    const tracks = manifest?.tracks || [];
    const candidateTrack = tracks.find(t => t.type === 'candidate');
    const interviewerTracks = tracks.filter(t => t.type === 'interviewer');
    const isAI = interviewerType === 'AI' || interviewerTracks.length === 0;

    // Stage 2 badge: check how many tracks have a finalised URL
    const stage2ReadyCount = tracks.filter(t => t.stage2Ready).length;
    const allStage2 = tracks.length > 0 && stage2ReadyCount === tracks.length;
    const partialStage2 = stage2ReadyCount > 0 && !allStage2;

    // Whether a given track is in its pre-join black space
    const isBeforeJoin = (trackName) => {
        const offset = trackOffsets[trackName] || 0;
        return offset > 0 && currentTime < offset;
    };

    // Whether a given track has finished playing (participant left) but global time still running
    const isAfterLeave = (trackName) => {
        const end = trackGlobalEnds[trackName];
        // Only show overlay if we have a confirmed end time and global time has clearly passed it
        // Use a small 0.5s grace period to avoid a flash at the very last frame
        return Number.isFinite(end) && end > 0 && currentTime > end + 0.5;
    };

    const handlePlayPause = useCallback(() => {
        if (isPlaying) { pause(); setIsPlaying(false); }
        else { play(); setIsPlaying(true); }
    }, [isPlaying, play, pause]);

    // ── Seek handlers ────────────────────────────────────────────────────────────
    const handleSeekStart = useCallback(() => {
        setIsDragging(true);
        setPendingTime(currentTime);
    }, [currentTime]);

    const handleSeekChange = useCallback((e) => {
        setPendingTime(parseFloat(e.target.value));
    }, []);

    const handleSeekEnd = useCallback((e) => {
        setIsDragging(false);
        const finalTime = parseFloat(e.target.value);
        seek(finalTime);
    }, [seek]);

    // Space bar shortcut
    useEffect(() => {
        const handler = (e) => {
            if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                handlePlayPause();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handlePlayPause]);

    const participantCount = 1 + interviewerTracks.length;

    return (
        <div style={s.overlay}>
            {/* ── Header ── */}
            <div style={s.header}>
                <div style={s.headerLeft}>
                    <span style={s.title}>Interview Playback</span>
                    <span style={s.badge}>
                        {isAI ? 'AI Interview' : `${participantCount} Participants`}
                    </span>
                    {allStage2 && (
                        <span style={{ ...s.badge, background: 'rgba(60,210,120,0.15)', color: '#4cda82', borderColor: 'rgba(60,210,120,0.3)' }}>
                            ● HD Playback
                        </span>
                    )}
                    {partialStage2 && (
                        <span style={{ ...s.badge, background: 'rgba(255,200,50,0.12)', color: '#ffd84d', borderColor: 'rgba(255,200,50,0.25)' }}>
                            ● Upgrading…
                        </span>
                    )}
                    {isBuffering && <span style={s.bufBadge}>Buffering…</span>}
                </div>
                <button style={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
            </div>

            {/* ── Video area ── */}
            <div style={s.body}>
                {isAI ? (
                    /* AI — single full-screen candidate */
                    <div style={s.singleCol}>
                        {candidateTrack
                            ? <PlaybackTrack
                                videoRef={getVideoRef(candidateTrack.name)}
                                status={trackStatus[candidateTrack.name] || 'loading'}
                                beforeJoin={false}
                                wrapStyle={{ width: '100%', height: '100%' }}
                            />
                            : <div style={{ margin: 'auto', opacity: 0.3 }}>No candidate track</div>
                        }
                    </div>
                ) : (
                    <>
                        {/* Left — interviewers stacked vertically */}
                        <div style={s.leftCol}>
                            {interviewerTracks.length > 0
                                ? interviewerTracks.map((t, idx) => (
                                    <PlaybackTrack
                                        key={t.name}
                                        videoRef={getVideoRef(t.name)}
                                        label={interviewerTracks.length > 1 ? `Interviewer ${idx + 1}` : 'Interviewer'}
                                        status={trackStatus[t.name] || 'loading'}
                                        beforeJoin={isBeforeJoin(t.name)}
                                        afterLeave={isAfterLeave(t.name)}
                                        wrapStyle={{
                                            borderBottom: idx < interviewerTracks.length - 1
                                                ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                        }}
                                    />
                                ))
                                : <div style={{ margin: 'auto', opacity: 0.25, fontSize: 13 }}>No interviewer track</div>
                            }
                        </div>

                        {/* Right — candidate */}
                        <div style={s.rightCol}>
                            {candidateTrack
                                ? <PlaybackTrack
                                    videoRef={getVideoRef(candidateTrack.name)}
                                    label="Candidate"
                                    status={trackStatus[candidateTrack.name] || 'loading'}
                                    beforeJoin={isBeforeJoin(candidateTrack.name)}
                                    afterLeave={isAfterLeave(candidateTrack.name)}
                                    wrapStyle={{ width: '100%', height: '100%' }}
                                />
                                : <div style={{ margin: 'auto', opacity: 0.25, fontSize: 13 }}>No candidate track</div>
                            }
                        </div>
                    </>
                )}
            </div>

            {/* ── Controls ── */}
            <div style={s.controls}>
                <button style={s.ctrlBtn} onClick={handlePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>

                <input
                    type="range"
                    min={0}
                    max={duration > 0 ? duration : 100}
                    step={0.5}
                    value={isDragging ? pendingTime : currentTime}
                    onPointerDown={handleSeekStart}
                    onChange={handleSeekChange}
                    onPointerUp={handleSeekEnd}
                    style={s.seekBar}
                    aria-label="Seek"
                />

                <span style={s.timeLabel}>
                    {fmtTime(isDragging ? pendingTime : currentTime)} / {fmtTime(duration)}
                </span>
            </div>
        </div>
    );
}
