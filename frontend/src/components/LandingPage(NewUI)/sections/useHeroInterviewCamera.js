import { useEffect, useRef, useState } from 'react';

const useHeroInterviewCamera = ({ active }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [hasCameraFeed, setHasCameraFeed] = useState(false);
    const [cameraStatus, setCameraStatus] = useState('Camera off');
    const [cameraError, setCameraError] = useState('');

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setHasCameraFeed(false);
    };

    useEffect(() => {
        if (!videoRef.current || !streamRef.current) {
            return;
        }

        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {
            // Ignore autoplay errors in the hero demo.
        });
    }, [hasCameraFeed]);

    useEffect(() => {
        let cancelled = false;

        const startCamera = async () => {
            if (!active) {
                stopCamera();
                setCameraStatus('Camera off');
                setCameraError('');
                return;
            }

            if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
                stopCamera();
                setCameraStatus('Camera unavailable');
                setCameraError('Camera preview works in supported browsers.');
                return;
            }

            setCameraStatus('Starting camera');
            setCameraError('');

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                });

                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                streamRef.current = stream;
                setHasCameraFeed(true);
                setCameraStatus('Camera live');
            } catch (error) {
                stopCamera();
                setCameraStatus('Camera blocked');
                setCameraError('Allow camera access to preview the interview frame.');
            }
        };

        startCamera();

        return () => {
            cancelled = true;
            stopCamera();
        };
    }, [active]);

    return {
        videoRef,
        hasCameraFeed,
        cameraStatus,
        cameraError,
        stopCamera
    };
};

export default useHeroInterviewCamera;
