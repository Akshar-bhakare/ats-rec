import { useEffect, useRef, useState } from 'react';
import MUIAlert from './MUIAlert';
import aiselektIconDarkTransparent from '../../../assets/HomePage/aiselekt_icon_dark_transparent.svg';

const SLOW_LATENCY_MS = 1200;
const HIGH_RTT_MS = 350;
const LOW_DOWNLINK_MBPS = 1.2;
const PROBE_INTERVAL_MS = 30000;
const ALERT_COOLDOWN_MS = 45000;
const PROBE_ASSET_URL = aiselektIconDarkTransparent || '/favicon.ico';

const getBrowserConnection = () =>
    (navigator && (navigator.connection || navigator.mozConnection || navigator.webkitConnection)) || null;

const classifyWithNetworkInfo = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return { status: 'offline', reason: 'offline' };
    }

    const connection = getBrowserConnection();
    if (!connection) {
        return { status: 'good', reason: 'unknown' };
    }

    const effectiveType = String(connection.effectiveType || '').toLowerCase();
    const downlink = Number(connection.downlink || 0);
    const rtt = Number(connection.rtt || 0);
    const saveData = Boolean(connection.saveData);

    const slowType = effectiveType === 'slow-2g' || effectiveType === '2g';
    const poor =
        saveData ||
        slowType ||
        (Number.isFinite(downlink) && downlink > 0 && downlink < LOW_DOWNLINK_MBPS) ||
        (Number.isFinite(rtt) && rtt > 0 && rtt >= HIGH_RTT_MS);

    return poor
        ? { status: 'poor', reason: 'connection' }
        : { status: 'good', reason: 'connection' };
};

const runLatencyProbe = async () => {
    const startedAt = performance.now();
    try {
        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), 8000);
        const queryJoiner = PROBE_ASSET_URL.includes('?') ? '&' : '?';
        const probeUrl = `${PROBE_ASSET_URL}${queryJoiner}networkProbe=${Date.now()}`;

        await fetch(probeUrl, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
        });
        clearTimeout(timerId);
        const latency = performance.now() - startedAt;
        return { ok: true, latency };
    } catch {
        return { ok: false, latency: null };
    }
};

export default function NetworkQualityNotice() {
    const [alertState, setAlertState] = useState({
        open: false,
        message: '',
        severity: 'info',
    });

    const latestStatusRef = useRef('good');
    const lastAlertAtRef = useRef(0);

    const pushAlert = (nextStatus) => {
        const now = Date.now();
        const hasStatusChanged = latestStatusRef.current !== nextStatus;
        const isOutsideCooldown = now - lastAlertAtRef.current > ALERT_COOLDOWN_MS;

        if (!hasStatusChanged && !isOutsideCooldown) return;

        latestStatusRef.current = nextStatus;
        lastAlertAtRef.current = now;

        if (nextStatus === 'offline') {
            setAlertState({
                open: true,
                message: 'You are offline. Please check your internet connection.',
                severity: 'error',
            });
            return;
        }

        if (nextStatus === 'poor') {
            setAlertState({
                open: true,
                message: 'Slow internet detected. Some actions may take longer than usual.',
                severity: 'warning',
            });
            return;
        }

        if (hasStatusChanged) {
            setAlertState({
                open: true,
                message: 'Internet connection is back to normal.',
                severity: 'success',
            });
        }
    };

    useEffect(() => {
        let alive = true;
        let intervalId;

        const evaluate = async () => {
            const baseStatus = classifyWithNetworkInfo();
            if (baseStatus.status === 'offline') {
                if (alive) pushAlert('offline');
                return;
            }

            const probe = await runLatencyProbe();
            if (!alive) return;

            const nextStatus =
                !probe.ok || (typeof probe.latency === 'number' && probe.latency >= SLOW_LATENCY_MS)
                    ? 'poor'
                    : (baseStatus.status === 'poor' ? 'poor' : 'good');

            pushAlert(nextStatus);
        };

        const handleOnline = () => {
            evaluate();
        };

        const handleOffline = () => {
            pushAlert('offline');
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                evaluate();
            }
        };

        const connection = getBrowserConnection();
        const handleConnectionChange = () => evaluate();

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        document.addEventListener('visibilitychange', handleVisibility);
        connection?.addEventListener?.('change', handleConnectionChange);

        evaluate();
        intervalId = setInterval(evaluate, PROBE_INTERVAL_MS);

        return () => {
            alive = false;
            clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            document.removeEventListener('visibilitychange', handleVisibility);
            connection?.removeEventListener?.('change', handleConnectionChange);
        };
    }, []);

    return (
        <MUIAlert
            open={alertState.open}
            message={alertState.message}
            severity={alertState.severity}
            autoHideDuration={null}
            onClose={(_, reason) => {
                if (reason === 'clickaway') return;
                setAlertState((prev) => ({ ...prev, open: false }));
            }}
        />
    );
}