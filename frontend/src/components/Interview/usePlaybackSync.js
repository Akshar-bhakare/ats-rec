/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */

/**
 * usePlaybackSync
 *
 * Multi-track WebM playback hook utilizing native standard HTML5 MediaSource Extensions (MSE).
 *
 * ── DIAGNOSTIC BUILD ─────────────────────────────────────────────────────────
 * All logging is controlled by the LOG_LEVEL constant below.
 *   0 = silent (production)
 *   1 = critical events only (freeze diagnosis)
 *   2 = verbose (full pipeline trace)
 *
 * To diagnose the 0:58 freeze: set LOG_LEVEL = 1, open DevTools console,
 * play the video and watch for these log groups:
 *   [PSY:CHUNK]  — every fetch in/out, shows done flag and cursor
 *   [PSY:MSE]    — every appendBuffer and endOfStream call
 *   [PSY:STALL]  — every waiting/canplay event and isStalled flip
 *   [PSY:CLOCK]  — clock freeze/resume transitions
 *   [PSY:ERROR]  — any video element or MSE error
 *
 * ── FIX SUMMARY (3 bugs from previous audit) ─────────────────────────────────
 *   Fix 1 — isStalled flag (event-driven) replaces readyState polling.
 *            'waiting' fires synchronously when decoder starves. 'canplay'
 *            clears it the instant enough data exists to resume. This pair
 *            is the W3C-specified stall detection mechanism — zero latency,
 *            no sampling window to miss.
 *
 *   Fix 2 — Buffering check no longer has a trackGlobalEnd duration gate.
 *            The old guard silently excluded any track whose totalEstimatedDur
 *            was underestimated (common when chunks > 2s). Now every
 *            non-ended track is checked unconditionally.
 *
 *   Fix 3 — prefetchScheduled moved from closure let-variable onto perTrack
 *            state. A closure variable has no stable address — if extendTrack
 *            throws mid-flight the flag gets stuck true forever, killing all
 *            future prefetches for that track. On perTrack state it is always
 *            reachable from any code path including finally/error handlers.
 */

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { fetchData } from '../../AppUtils/dataAPI';

// ── Diagnostic log level ──────────────────────────────────────────────────────
// Set to 0 before shipping to production.
const LOG_LEVEL = 1;

const log = {
    chunk: (...a) => LOG_LEVEL >= 1 && console.log('%c[PSY:CHUNK]', 'color:#7F77DD;font-weight:600', ...a),
    mse: (...a) => LOG_LEVEL >= 1 && console.log('%c[PSY:MSE]', 'color:#1D9E75;font-weight:600', ...a),
    stall: (...a) => LOG_LEVEL >= 1 && console.warn('%c[PSY:STALL]', 'color:#BA7517;font-weight:600', ...a),
    clock: (...a) => LOG_LEVEL >= 1 && console.log('%c[PSY:CLOCK]', 'color:#378ADD;font-weight:600', ...a),
    error: (...a) => LOG_LEVEL >= 0 && console.error('%c[PSY:ERROR]', 'color:#E24B4A;font-weight:600', ...a),
    trace: (...a) => LOG_LEVEL >= 2 && console.log('%c[PSY:TRACE]', 'color:#888780', ...a),
};

// ── Constants ─────────────────────────────────────────────────────────────────
const PREFETCH_BEFORE_END = 30;  // Fetch next batch when < 30s of buffer remains ahead
const GC_REMOVE_THRESHOLD = 180; // Run GC when video is 3m in
const GC_KEEP_BEHIND = 120; // Keep 2m of video behind playhead
const CHUNK_DURATION_ESTIMATE = 4;   // Assume ~2s per chunk initially

// ── Helpers ───────────────────────────────────────────────────────────────────
async function fetchBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Chunk fetch failed: ${res.status} ${url}`);
    return res.arrayBuffer();
}

async function fetchAllBuffers(urls) {
    return Promise.all(urls.map(fetchBuffer));
}

function isTimeBuffered(videoEl, videoTime) {
    if (!videoEl || !videoEl.buffered || videoEl.buffered.length === 0) return false;
    for (let i = 0; i < videoEl.buffered.length; i++) {
        if (videoTime >= videoEl.buffered.start(i) - 0.5 &&
            videoTime <= videoEl.buffered.end(i) + 0.5) return true;
    }
    return false;
}

/** Returns a human-readable buffered ranges string for logging. */
function bufferedRanges(videoEl) {
    if (!videoEl || !videoEl.buffered) return '[]';
    const ranges = [];
    for (let i = 0; i < videoEl.buffered.length; i++) {
        ranges.push(`${videoEl.buffered.start(i).toFixed(2)}–${videoEl.buffered.end(i).toFixed(2)}`);
    }
    return `[${ranges.join(', ')}]`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export default function usePlaybackSync({ manifest, interviewScheduleId }) {
    const videoRefsMap = useRef({});
    const perTrack = useRef({});
    const offsetsRef = useRef({});
    const trackGlobalEndsRef = useRef({});

    // Global clock state
    const globalTimeRef = useRef(0);
    const lastTickRef = useRef(null);
    const isPlayingRef = useRef(false);
    const isBufferingRef = useRef(false);
    const pendingSeekRef = useRef(false);
    const wasBufferingRef = useRef(false); // for clock transition logging

    const tickRaf = useRef(null);
    const uiRaf = useRef(null);

    // Instance counter guards async operations against stale state
    const effectInstanceId = useRef(0);

    const [trackStatus, setTrackStatus] = useState({});
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const isBuffering = useMemo(
        () => Object.values(trackStatus).some(s => s !== 'ready'),
        [trackStatus]
    );

    const tracks = useMemo(() => manifest?.tracks || [], [manifest]);

    const getVideoRef = (trackName) => {
        if (!videoRefsMap.current[trackName]) {
            videoRefsMap.current[trackName] = { current: null };
        }
        return videoRefsMap.current[trackName];
    };

    const computeOffsets = useCallback(() => {
        const starts = tracks.map(t => t.startMs).filter(ms => ms > 0);
        const globalStart = starts.length ? Math.min(...starts) : 0;
        const offsets = {};
        tracks.forEach(t => {
            offsets[t.name] = (globalStart > 0 && t.startMs > 0)
                ? Math.max(0, (t.startMs - globalStart) / 1000)
                : 0;
        });
        return offsets;
    }, [tracks]);

    const pauseAll = useCallback(() => {
        Object.values(videoRefsMap.current).forEach(ref => {
            if (ref.current && !ref.current.paused) {
                try { ref.current.pause(); } catch (e) { }
            }
        });
    }, []);

    const safePlay = (videoEl) => {
        if (!videoEl || videoEl.readyState < 2) return;
        if (!videoEl.paused || videoEl._playPromisePending) return;
        try {
            const p = videoEl.play();
            if (p !== undefined) {
                videoEl._playPromisePending = true;
                p.then(() => { videoEl._playPromisePending = false; })
                    .catch(() => { videoEl._playPromisePending = false; });
            }
        } catch (e) { }
    };

    useEffect(() => {
        isBufferingRef.current = isBuffering;
        if (isBuffering && isPlayingRef.current) pauseAll();
    }, [isBuffering, pauseAll]);

    // ── Global Clock Tick Loop ────────────────────────────────────────────────
    const stopTickLoop = useCallback(() => {
        if (tickRaf.current) { cancelAnimationFrame(tickRaf.current); tickRaf.current = null; }
        if (uiRaf.current) { cancelAnimationFrame(uiRaf.current); uiRaf.current = null; }
    }, []);

    const startTickLoop = useCallback(() => {
        if (tickRaf.current) return;
        lastTickRef.current = performance.now();
        wasBufferingRef.current = false;

        const loop = (now) => {
            const dt = (now - lastTickRef.current) / 1000;
            lastTickRef.current = now;

            let anyBuffering = false;
            let currentHighestDuration = 0;

            Object.entries(videoRefsMap.current).forEach(([name, ref]) => {
                const el = ref.current;
                if (!el) return;

                const state = perTrack.current[name];
                const offsetSec = offsetsRef.current[name] || 0;

                let trackDur = state?.totalEstimatedDur || 0;
                if (Number.isFinite(el.duration) && el.duration > trackDur) trackDur = el.duration;

                const trackEnd = trackDur > 0 ? (offsetSec + trackDur) : Infinity;
                if (trackDur > 0) trackGlobalEndsRef.current[name] = trackEnd;
                if (trackEnd > currentHighestDuration && trackDur > 0) currentHighestDuration = trackEnd;

                // ── FIX 1 & 2: Use state.isStalled, check every non-ended track
                //    unconditionally (no duration gate). ────────────────────────
                if (!el.ended) {
                    const isDoingSomething =
                        state?.isStalled ||
                        el.seeking ||
                        state?.seekInProgress;

                    if (isDoingSomething) {
                        anyBuffering = true;

                        // Native MSE WebM gap fix
                        if (!state?.seekInProgress && el.buffered.length > 0) {
                            for (let i = 0; i < el.buffered.length; i++) {
                                const bStart = el.buffered.start(i);
                                if (el.currentTime < bStart && (bStart - el.currentTime) < 5) {
                                    log.trace(`[${name}] Gap fix: nudging currentTime ${el.currentTime.toFixed(2)} → ${(bStart + 0.1).toFixed(2)}`);
                                    try { el.currentTime = bStart + 0.1; } catch (e) { }
                                    break;
                                }
                            }
                        }
                    }
                }
            });

            // ── Clock freeze/resume transition logging ────────────────────────
            if (anyBuffering !== wasBufferingRef.current) {
                if (anyBuffering) {
                    log.clock(`CLOCK FROZEN at globalTime=${globalTimeRef.current.toFixed(2)}s`);
                    Object.entries(videoRefsMap.current).forEach(([name, ref]) => {
                        const el = ref.current;
                        const state = perTrack.current[name];
                        if (!el) return;
                        log.clock(`  track="${name}" isStalled=${state?.isStalled} seekInProgress=${state?.seekInProgress} readyState=${el.readyState} ended=${el.ended} buffered=${bufferedRanges(el)} currentTime=${el.currentTime?.toFixed(2)}`);
                    });
                } else {
                    log.clock(`CLOCK RESUMED at globalTime=${globalTimeRef.current.toFixed(2)}s`);
                }
                wasBufferingRef.current = anyBuffering;
            }

            isBufferingRef.current = anyBuffering;

            setDuration(d => currentHighestDuration > d ? currentHighestDuration : d);

            if (isPlayingRef.current && !isBufferingRef.current) {
                globalTimeRef.current += dt;
                setDuration(d => {
                    if (d > 0 && globalTimeRef.current >= d) {
                        globalTimeRef.current = d;
                        isPlayingRef.current = false;
                    }
                    return d;
                });
            }

            // Per-track playback rate correction
            Object.entries(videoRefsMap.current).forEach(([name, ref]) => {
                const el = ref.current;
                if (!el) return;

                const state = perTrack.current[name];
                const offsetSec = offsetsRef.current[name] || 0;
                const expectedTime = Math.max(0, globalTimeRef.current - offsetSec);

                if (globalTimeRef.current < offsetSec) {
                    if (!el.paused) try { el.pause(); } catch (e) { }
                    if (el.currentTime !== 0) try { el.currentTime = 0; } catch (e) { }
                    return;
                }

                const trackDur = state?.totalEstimatedDur || el.duration;
                if (Number.isFinite(trackDur) && expectedTime >= trackDur) {
                    if (!el.paused) try { el.pause(); } catch (e) { }
                    return;
                }

                if (isPlayingRef.current) {
                    if (isBufferingRef.current) {
                        if (!el.paused && el.readyState >= 2) try { el.pause(); } catch (e) { }
                        el.playbackRate = 1.0;
                    } else {
                        safePlay(el);
                        const drift = expectedTime - el.currentTime;
                        const absDrift = Math.abs(drift);

                        if (state?.isRebuilding || state?.isFetching) {
                            el.playbackRate = 1.0;
                        } else if (absDrift > 0.4) {
                            log.trace(`[${name}] Hard resync: drift=${drift.toFixed(3)}s, currentTime=${el.currentTime.toFixed(2)} → ${expectedTime.toFixed(2)}`);
                            try { el.currentTime = expectedTime; } catch (e) { }
                            el.playbackRate = 1.0;
                        } else if (drift > 0.15) {
                            el.playbackRate = 1.15;
                        } else if (drift < -0.15) {
                            el.playbackRate = 0.85;
                        } else {
                            el.playbackRate = 1.0;
                        }
                    }
                } else {
                    el.playbackRate = 1.0;
                    if (!el.paused && el.readyState >= 2) try { el.pause(); } catch (e) { }
                }
            });

            tickRaf.current = requestAnimationFrame(loop);
        };

        const uiLoop = () => {
            setCurrentTime(globalTimeRef.current);
            uiRaf.current = requestAnimationFrame(uiLoop);
        };

        tickRaf.current = requestAnimationFrame(loop);
        uiRaf.current = requestAnimationFrame(uiLoop);
    }, []);

    // ── Native SourceBuffer Queue Processing ─────────────────────────────────
    const processQueue = useCallback((trackName) => {
        const state = perTrack.current[trackName];
        if (!state || !state.sourceBuffer) return;
        if (state.sourceBuffer.updating || state.queue.length === 0) return;

        const videoEl = videoRefsMap.current[trackName]?.current;
        if (videoEl && videoEl.error) {
            log.error(`[${trackName}] videoEl.error detected, code=${videoEl.error.code} — reinitializing track`);
            const currentTrackConfig = {
                name: trackName,
                totalChunks: Math.ceil((state.totalEstimatedDur || 60) / CHUNK_DURATION_ESTIMATE),
                nextCursor: state.nextCursor,
                done: state.done,
                firstChunks: [],
                mimeType: state.mimeType,
            };
            if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
            perTrack.current[trackName] = null;
            initTrack(currentTrackConfig);
            return;
        }

        const buffer = state.queue.shift();

        if (!state.initSegment) {
            state.initSegment = buffer.slice(0);
            log.mse(`[${trackName}] initSegment cached (${buffer.byteLength} bytes)`);
        }

        try {
            log.trace(`[${trackName}] appendBuffer ${buffer.byteLength} bytes — queue remaining: ${state.queue.length}`);
            state.sourceBuffer.appendBuffer(buffer);
        } catch (err) {
            log.error(`[${trackName}] MSE appendBuffer error: ${err.name} — ${err.message}`);

            if (err.name === 'QuotaExceededError' || err.code === 22) {
                state.queue.unshift(buffer);
                if (videoEl && !state.sourceBuffer.updating) {
                    try {
                        const ct = videoEl.currentTime;
                        if (ct > 30) {
                            log.mse(`[${trackName}] QuotaExceeded GC: removing 0–${(ct - 15).toFixed(2)}`);
                            state.sourceBuffer.remove(0, ct - 15);
                        }
                    } catch (e) {
                        log.error(`[${trackName}] GC recovery error`, e);
                    }
                }
            }
        }
    }, []);

    // ── Extension Pipeline ────────────────────────────────────────────────────
    const extendTrack = useCallback(async (trackName, currentInstanceId) => {
        const state = perTrack.current[trackName];
        if (!state || state.done || state.isFetching || effectInstanceId.current !== currentInstanceId) return;

        const videoEl = videoRefsMap.current[trackName]?.current;
        if (videoEl && state.sourceBuffer && !state.sourceBuffer.updating) {
            const ct = videoEl.currentTime;
            if (ct > GC_REMOVE_THRESHOLD) {
                try {
                    log.mse(`[${trackName}] Routine GC: removing 0–${(ct - GC_KEEP_BEHIND).toFixed(2)}`);
                    state.sourceBuffer.remove(0, ct - GC_KEEP_BEHIND);
                } catch (e) { }
            }
        }

        state.isFetching = true;
        log.chunk(`[${trackName}] extendTrack fetch → cursor=${state.nextCursor} globalTime=${globalTimeRef.current.toFixed(2)}s buffered=${bufferedRanges(videoEl)}`);

        try {
            const res = await fetchData('/api/ai/recording-auth/playback-manifest/next', {
                method: 'POST',
                body: { interviewScheduleId, trackName, cursor: state.nextCursor }
            });

            if (effectInstanceId.current !== currentInstanceId) return;

            // ── CRITICAL DIAGNOSTIC: This is the most important log entry ────
            // If you see "done=true" here before the video has finished playing,
            // the backend is signalling EOF too early and calling endOfStream()
            // will permanently seal the SourceBuffer — causing the freeze.
            log.chunk(`[${trackName}] extendTrack response ← ok=${res?.ok} done=${res?.done} chunks=${res?.chunks?.length ?? 0} nextCursor=${res?.nextCursor} | currentTime=${videoEl?.currentTime?.toFixed(2)}s totalEstimatedDur=${state.totalEstimatedDur?.toFixed(2)}s`);

            if (res?.ok && res.chunks?.length > 0) {
                const newBufs = await fetchAllBuffers(res.chunks);
                if (effectInstanceId.current !== currentInstanceId) return;

                state.queue.push(...newBufs);
                state.nextCursor = res.nextCursor;
                state.done = res.done;

                if (res.done) {
                    log.chunk(`[${trackName}] ⚠ done=true received — will call endOfStream() after drain. Buffered after append: check next MSE log.`);
                }

                processQueue(trackName);

            } else if (res?.done) {
                state.done = true;
                log.mse(`[${trackName}] endOfStream() called — done=true, no chunks. currentTime=${videoEl?.currentTime?.toFixed(2)} buffered=${bufferedRanges(videoEl)}`);

                // ── FREEZE ROOT CAUSE GUARD ───────────────────────────────────
                // If the video element's currentTime is significantly less than
                // the furthest buffered end, endOfStream() is safe. But if the
                // buffer is nearly empty at this point, the browser has nothing
                // left to decode and the video will freeze. Log this clearly.
                if (videoEl) {
                    let maxBufEnd = 0;
                    for (let i = 0; i < videoEl.buffered.length; i++) {
                        if (videoEl.buffered.end(i) > maxBufEnd) maxBufEnd = videoEl.buffered.end(i);
                    }
                    const remaining = maxBufEnd - videoEl.currentTime;
                    if (remaining < 5) {
                        log.error(`[${trackName}] ⚠ FREEZE RISK: endOfStream() called with only ${remaining.toFixed(2)}s of buffer remaining. Backend may have signalled done too early!`);
                    }
                }

                if (state.mediaSource?.readyState === 'open') {
                    try { state.mediaSource.endOfStream(); } catch (e) { }
                }
            }
        } catch (err) {
            log.error(`[${trackName}] extendTrack fetch exception`, err);
        } finally {
            if (effectInstanceId.current === currentInstanceId) {
                state.isFetching = false;
            }
        }
    }, [interviewScheduleId, processQueue]);

    // ── Out-of-Buffer Fast Seeking ────────────────────────────────────────────
    const seekFetch = useCallback(async (trackName, targetGlobalMs, currentInstanceId) => {
        const state = perTrack.current[trackName];
        if (!state || !state.sourceBuffer || effectInstanceId.current !== currentInstanceId) return;

        state.isFetching = true;
        state.seekInProgress = true;
        setTrackStatus(prev => ({ ...prev, [trackName]: 'loading' }));

        log.chunk(`[${trackName}] seekFetch → targetSec=${(targetGlobalMs / 1000).toFixed(2)}`);

        const videoEl = videoRefsMap.current[trackName]?.current;
        const onCanPlay = () => {
            const s = perTrack.current[trackName];
            if (s) {
                s.seekInProgress = false;
                s.isStalled = false;
            }
            log.stall(`[${trackName}] canplay after seek — clock unlocked`);
            setTrackStatus(prev => ({ ...prev, [trackName]: 'ready' }));
        };
        if (videoEl) {
            videoEl.removeEventListener('canplay', onCanPlay);
            videoEl.addEventListener('canplay', onCanPlay, { once: true });
        }

        try {
            const res = await fetchData('/api/ai/recording-auth/playback-manifest/seek', {
                method: 'POST',
                body: { interviewScheduleId, trackName, seekToSec: targetGlobalMs / 1000 }
            });

            if (effectInstanceId.current !== currentInstanceId) return;

            log.chunk(`[${trackName}] seekFetch response ← ok=${res?.ok} done=${res?.done} chunks=${res?.chunks?.length ?? 0}`);

            if (res?.ok && res.chunks?.length > 0) {
                const newBufs = await fetchAllBuffers(res.chunks);
                if (effectInstanceId.current !== currentInstanceId) return;

                if (state.sourceBuffer?.updating) {
                    try { state.sourceBuffer.abort(); } catch (e) { }
                }

                let sbAlive = false;
                try { void state.sourceBuffer.buffered; sbAlive = true; } catch (e) { }
                if (!sbAlive) {
                    log.error(`[${trackName}] SourceBuffer detached during seekFetch — aborting`);
                    state.seekInProgress = false;
                    state.isStalled = false;
                    if (videoEl) videoEl.removeEventListener('canplay', onCanPlay);
                    return;
                }

                state.queue = [];
                state.nextCursor = res.nextCursor;
                state.done = res.done;

                if (state.initSegment) {
                    log.mse(`[${trackName}] Prepending initSegment before seek chunks`);
                    state.queue.push(state.initSegment.slice(0));
                }
                state.queue.push(...newBufs);
                processQueue(trackName);

            } else if (res?.done) {
                state.done = true;
                state.seekInProgress = false;
                state.isStalled = false;
                if (videoEl) videoEl.removeEventListener('canplay', onCanPlay);
            }
        } catch (err) {
            log.error(`[${trackName}] seekFetch exception`, err);
            state.seekInProgress = false;
            state.isStalled = false;
            if (videoEl) videoEl.removeEventListener('canplay', onCanPlay);
        } finally {
            if (effectInstanceId.current === currentInstanceId) {
                state.isFetching = false;
            }
        }
    }, [interviewScheduleId, processQueue]);

    // ── Symmetrical Cleanup ───────────────────────────────────────────────────
    const cleanupAllTracks = useCallback(() => {
        stopTickLoop();
        Object.entries(perTrack.current).forEach(([trackName, s]) => {
            const videoEl = videoRefsMap.current[trackName]?.current;
            if (videoEl) {
                try {
                    videoEl.pause();
                    videoEl.src = '';
                    videoEl.removeAttribute('src');
                    videoEl.load();
                } catch (e) { }
            }
            if (s?.blobUrl) URL.revokeObjectURL(s.blobUrl);
            if (s?.mediaSource && s.mediaSource.readyState === 'open') {
                try { s.mediaSource.endOfStream(); } catch (e) { }
            }
        });
        perTrack.current = {};
        globalTimeRef.current = 0;
        isPlayingRef.current = false;
        isBufferingRef.current = false;
        setTrackStatus({});
        setCurrentTime(0);
        setDuration(0);
    }, [stopTickLoop]);

    // ── Track Initialisation ──────────────────────────────────────────────────
    const initTrack = useCallback(async (track) => {
        const currentInstanceId = effectInstanceId.current;
        const videoRefObj = getVideoRef(track.name);

        // ── Stage 2 fast path ─────────────────────────────────────────────────
        if (track.stage2Url) {
            const videoEl = videoRefObj.current;
            if (!videoEl) {
                setTrackStatus(prev => ({ ...prev, [track.name]: 'ready' }));
                return;
            }
            setTrackStatus(prev => ({ ...prev, [track.name]: 'loading' }));

            perTrack.current[track.name] = {
                blobUrl: null, queue: [], isStage2: true, done: true,
                nextCursor: 0, isFetching: false, totalEstimatedDur: 0,
                isStalled: false,           // FIX 1
                prefetchScheduled: false,   // FIX 3
            };

            videoEl.src = track.stage2Url;

            videoEl.addEventListener('loadedmetadata', () => {
                if (effectInstanceId.current !== currentInstanceId) return;
                const trackOffset = offsetsRef.current[track.name] || 0;
                const globalEnd = trackOffset + (videoEl.duration || 0);
                perTrack.current[track.name].totalEstimatedDur = videoEl.duration;
                setDuration(prev => Math.max(prev, globalEnd));
                trackGlobalEndsRef.current[track.name] = globalEnd;
                log.mse(`[${track.name}] Stage2 loadedmetadata — duration=${videoEl.duration?.toFixed(2)}s`);
                setTrackStatus(prev => ({ ...prev, [track.name]: 'ready' }));
            }, { once: true });

            videoEl.addEventListener('waiting', () => {
                if (effectInstanceId.current !== currentInstanceId) return;
                const state = perTrack.current[track.name];
                if (!state || (state.done && videoEl.ended)) return;
                state.isStalled = true; // FIX 1
                log.stall(`[${track.name}] waiting — isStalled=true currentTime=${videoEl.currentTime?.toFixed(2)} buffered=${bufferedRanges(videoEl)}`);
                setTrackStatus(prev => ({ ...prev, [track.name]: 'buffering' }));
            });

            videoEl.addEventListener('canplay', () => {
                if (effectInstanceId.current !== currentInstanceId) return;
                const state = perTrack.current[track.name];
                if (state) state.isStalled = false; // FIX 1
                log.stall(`[${track.name}] canplay — isStalled=false`);
                setTrackStatus(prev =>
                    prev[track.name] === 'buffering'
                        ? { ...prev, [track.name]: 'ready' }
                        : prev
                );
            });

            videoEl.addEventListener('ended', () => {
                if (effectInstanceId.current !== currentInstanceId) return;
                const state = perTrack.current[track.name];
                if (state) state.isStalled = false;
                setTrackStatus(prev => ({ ...prev, [track.name]: 'ready' }));
            });

            videoEl.addEventListener('error', () => {
                log.error(`[${track.name}] Stage2 video error code=${videoEl.error?.code} msg=${videoEl.error?.message}`);
            });

            return;
        }

        // ── Native MSE Path (Stage 1) ─────────────────────────────────────────
        setTrackStatus(prev => ({ ...prev, [track.name]: 'loading' }));

        const videoEl = videoRefObj.current;
        if (!videoEl) {
            setTrackStatus(prev => ({ ...prev, [track.name]: 'ready' }));
            return;
        }

        const ms = new MediaSource();
        const blobUrl = URL.createObjectURL(ms);
        const totalChunks = track.totalChunks || 1;

        // If backend provided exact duration (converted to seconds), prefer it over guessing
        const totalEstimatedDur = track.exactDurationMs
            ? (track.exactDurationMs / 1000)
            : (totalChunks * CHUNK_DURATION_ESTIMATE);

        log.mse(`[${track.name}] MSE init — totalChunks=${totalChunks} exactMs=${track.exactDurationMs} estimatedDur=${totalEstimatedDur}s mime=${track.mimeType}`);

        perTrack.current[track.name] = {
            mediaSource: ms,
            sourceBuffer: null,
            queue: [],
            blobUrl,
            nextCursor: track.nextCursor,
            done: track.done || false,
            isFetching: false,
            isStage2: false,
            seekInProgress: false,
            mimeType: track.mimeType || 'video/webm; codecs="vp8,opus"',
            totalEstimatedDur,
            initSegment: null,
            isStalled: false,           // FIX 1
            prefetchScheduled: false,           // FIX 3
        };

        videoEl.src = blobUrl;

        // ── Video element error listener ──────────────────────────────────────
        // code 3 = MEDIA_ERR_DECODE (bad cluster, missing init segment)
        // code 4 = MEDIA_ERR_SRC_NOT_SUPPORTED (mime type rejected)
        videoEl.addEventListener('error', () => {
            log.error(`[${track.name}] video element error — code=${videoEl.error?.code} msg=${videoEl.error?.message} currentTime=${videoEl.currentTime?.toFixed(2)} buffered=${bufferedRanges(videoEl)}`);
        });

        ms.addEventListener('sourceopen', async () => {
            if (effectInstanceId.current !== currentInstanceId) return;
            const state = perTrack.current[track.name];
            if (!state || state.sourceBuffer) return;

            log.mse(`[${track.name}] sourceopen`);

            try {
                ms.duration = state.totalEstimatedDur;
                const trackOffset = offsetsRef.current[track.name] || 0;
                const globalEnd = trackOffset + state.totalEstimatedDur;
                setDuration(prev => Math.max(prev, globalEnd));
                trackGlobalEndsRef.current[track.name] = globalEnd;
            } catch (e) { }

            let mime = state.mimeType;
            if (!MediaSource.isTypeSupported(mime)) {
                log.error(`[${track.name}] Mime not supported: ${mime} — falling back to video/webm`);
                mime = 'video/webm';
            }

            try {
                const sb = ms.addSourceBuffer(mime);
                sb.mode = 'segments';
                state.sourceBuffer = sb;

                log.mse(`[${track.name}] SourceBuffer created — mode=segments mime=${mime}`);

                sb.addEventListener('updateend', () => {
                    if (effectInstanceId.current !== currentInstanceId) return;
                    const s = perTrack.current[track.name];
                    // After every append, log the resulting buffered ranges
                    log.trace(`[${track.name}] updateend — buffered=${bufferedRanges(videoEl)} queue=${s?.queue?.length ?? 0}`);
                    processQueue(track.name);
                });

                if (track.firstChunks?.length > 0) {
                    log.chunk(`[${track.name}] Fetching ${track.firstChunks.length} startup chunks`);
                    try {
                        const buffers = await fetchAllBuffers(track.firstChunks);
                        if (effectInstanceId.current !== currentInstanceId) return;
                        state.queue.push(...buffers);
                        processQueue(track.name);
                    } catch (err) {
                        log.error(`[${track.name}] Failed to fetch startup chunks`, err);
                    }
                }

                if ((offsetsRef.current[track.name] || 0) > 0) {
                    try { videoEl.currentTime = 0; } catch (e) { }
                    if (!videoEl.paused) try { videoEl.pause(); } catch (e) { }
                }

                setTrackStatus(prev => ({ ...prev, [track.name]: 'ready' }));
            } catch (e) {
                log.error(`[${track.name}] MSE SourceBuffer creation failed`, e);
            }
        });

        ms.addEventListener('sourceended', () => {
            log.mse(`[${track.name}] MediaSource sourceended — no more data can be appended`);
        });

        ms.addEventListener('sourceclose', () => {
            log.mse(`[${track.name}] MediaSource sourceclose`);
        });

        // ── FIX 1: 'waiting' and 'canplay' are the single source of truth ────
        // These fire synchronously with the decoder stall — zero polling delay.
        videoEl.addEventListener('waiting', () => {
            if (effectInstanceId.current !== currentInstanceId) return;
            const state = perTrack.current[track.name];
            if (!state || (state.done && videoEl.ended)) return;
            state.isStalled = true;
            log.stall(`[${track.name}] waiting — isStalled=true currentTime=${videoEl.currentTime?.toFixed(2)} buffered=${bufferedRanges(videoEl)} done=${state.done} msState=${ms.readyState}`);
            setTrackStatus(prev => ({ ...prev, [track.name]: 'buffering' }));
        });

        videoEl.addEventListener('canplay', () => {
            if (effectInstanceId.current !== currentInstanceId) return;
            const state = perTrack.current[track.name];
            if (state) state.isStalled = false;
            log.stall(`[${track.name}] canplay — isStalled=false currentTime=${videoEl.currentTime?.toFixed(2)} buffered=${bufferedRanges(videoEl)}`);
            setTrackStatus(prev =>
                prev[track.name] === 'buffering'
                    ? { ...prev, [track.name]: 'ready' }
                    : prev
            );
        });

        videoEl.addEventListener('ended', () => {
            if (effectInstanceId.current !== currentInstanceId) return;
            const state = perTrack.current[track.name];
            if (state) state.isStalled = false;
            log.mse(`[${track.name}] ended — currentTime=${videoEl.currentTime?.toFixed(2)}`);
            setTrackStatus(prev => ({ ...prev, [track.name]: 'ready' }));
        });

        // ── FIX 3: prefetchScheduled lives on state, never a dangling closure ─
        videoEl.addEventListener('timeupdate', () => {
            if (effectInstanceId.current !== currentInstanceId) return;
            const state = perTrack.current[track.name];
            if (!state || state.done || state.prefetchScheduled) return;

            if (videoEl.buffered.length > 0) {
                let maxBufEnd = 0;
                for (let i = 0; i < videoEl.buffered.length; i++) {
                    if (videoEl.buffered.end(i) > maxBufEnd) maxBufEnd = videoEl.buffered.end(i);
                }
                const ahead = maxBufEnd - videoEl.currentTime;
                if (ahead < PREFETCH_BEFORE_END) {
                    log.chunk(`[${track.name}] Prefetch triggered — bufferAhead=${ahead.toFixed(2)}s < ${PREFETCH_BEFORE_END}s threshold. currentTime=${videoEl.currentTime.toFixed(2)} maxBufEnd=${maxBufEnd.toFixed(2)}`);
                    state.prefetchScheduled = true;
                    extendTrack(track.name, currentInstanceId).finally(() => {
                        // FIX 3: reset on state — always reachable, never stale
                        const s = perTrack.current[track.name];
                        if (s) s.prefetchScheduled = false;
                    });
                }
            }
        });

    }, [extendTrack, processQueue]);

    useEffect(() => {
        if (!manifest || tracks.length === 0) return;
        effectInstanceId.current += 1;
        log.mse(`Manifest changed — new instanceId=${effectInstanceId.current} tracks=${tracks.map(t => t.name).join(',')}`);
        cleanupAllTracks();
        offsetsRef.current = computeOffsets();
        Promise.all(tracks.map(t => initTrack(t))).then(() => {
            startTickLoop();
        });
        return () => { cleanupAllTracks(); };
    }, [manifest, initTrack, startTickLoop, cleanupAllTracks, tracks]);



    // ── Exposed Controls ──────────────────────────────────────────────────────
    const play = useCallback(() => {
        log.clock(`play() called — globalTime=${globalTimeRef.current.toFixed(2)}s`);
        isPlayingRef.current = true;
    }, []);

    const pause = useCallback(() => {
        log.clock(`pause() called — globalTime=${globalTimeRef.current.toFixed(2)}s`);
        isPlayingRef.current = false;
        pauseAll();
    }, [pauseAll]);

    const seek = useCallback((globalTime) => {
        log.clock(`seek(${globalTime.toFixed(2)}) called`);
        globalTimeRef.current = globalTime;
        setCurrentTime(globalTime);
        let needsBuffer = false;

        Object.entries(videoRefsMap.current).forEach(([name, ref]) => {
            if (!ref.current) return;
            const videoEl = ref.current;
            const offsetSec = offsetsRef.current[name] || 0;
            const videoTime = Math.max(0, globalTime - offsetSec);

            if (globalTime < offsetSec) {
                try { videoEl.currentTime = 0; } catch (e) { }
                return;
            }

            if (isTimeBuffered(videoEl, videoTime)) {
                log.chunk(`[${name}] seek in-buffer → videoTime=${videoTime.toFixed(2)}`);
                try { videoEl.currentTime = videoTime; } catch (e) { }
            } else {
                log.chunk(`[${name}] seek out-of-buffer → fetching around videoTime=${videoTime.toFixed(2)}`);
                needsBuffer = true;
                try { videoEl.currentTime = videoTime; } catch (e) { }
                seekFetch(name, globalTime * 1000, effectInstanceId.current);
            }
        });

        pendingSeekRef.current = needsBuffer;
    }, [seekFetch]);

    return {
        getVideoRef,
        trackStatus,
        trackOffsets: offsetsRef.current,
        trackGlobalEnds: trackGlobalEndsRef.current,
        isBuffering,
        play,
        pause,
        seek,
        currentTime,
        duration,
    };
}