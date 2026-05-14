

import React, { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";

import avatarClosed from "../assets/avatar_closed.png";
import avatarAlmostClosed from "../assets/avatar_almostclosed.png";
import avatarMid from "../assets/avatar_mid.png";
import avatarOpen from "../assets/avatar_open.png";

const LipSyncAvatar = ({ isAiSpeaking, audioRef, width = 200, height = 200 }) => {
  const [currentFrame, setCurrentFrame] = useState("closed");

  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const fallbackIntervalRef = useRef(null);

  const isAiSpeakingRef = useRef(isAiSpeaking);
  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
  }, [isAiSpeaking]);

  const currentFrameRef = useRef("closed");
  useEffect(() => {
    currentFrameRef.current = currentFrame;
  }, [currentFrame]);

  const smoothedLevelRef = useRef(0);
  const lastFrameChangeTimeRef = useRef(0);

  useEffect(() => {
    console.log("[LipSync] Component mounted");
    return () => console.log("[LipSync] Component unmounting");
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (isAiSpeaking && audioRef?.current) {
      setupAudioAnalysis();
    } else {
      stopAnimation();
    }
  }, [isAiSpeaking, audioRef]);

  const stopAnimation = () => {
    setCurrentFrame("closed");
    currentFrameRef.current = "closed";

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }

    smoothedLevelRef.current = 0;
  };

  const setupAudioAnalysis = () => {
    try {
      const audioElement = audioRef.current;
      if (!audioElement) return;

      if (typeof audioElement.captureStream === "function") {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;

        const stream = audioElement.captureStream();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        analyserRef.current = analyser;

        animateFrame();
      } else {
        startFallbackAnimation();
      }
    } catch (err) {
        console.warn(err);
      startFallbackAnimation();
    }
  };

  const animateFrame = () => {
    if (!analyserRef.current || !isAiSpeakingRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    const rawAvg = dataArray.reduce((s, v) => s + v, 0) / dataArray.length;

    // smooth audio
    const ALPHA = 0.22;
    smoothedLevelRef.current =
      smoothedLevelRef.current * (1 - ALPHA) + rawAvg * ALPHA;

    const level = smoothedLevelRef.current;

    const prev = currentFrameRef.current;
    let next = prev;

    // NEW 4-stage mapping (closed → almost_closed → mid → open)
    if (prev === "closed") {
      if (level > 30) next = "almost_closed";
    } else if (prev === "almost_closed") {
      if (level > 55) next = "mid";
      else if (level < 18) next = "closed";
    } else if (prev === "mid") {
      if (level > 85) next = "open";
      else if (level < 45) next = "almost_closed";
    } else if (prev === "open") {
      if (level < 70) next = "mid";
    }

    const now = performance.now();
    const MIN_FRAME_MS = 85;
    if (next !== prev && now - lastFrameChangeTimeRef.current < MIN_FRAME_MS) {
      next = prev;
    }

    if (next !== prev) {
      lastFrameChangeTimeRef.current = now;
      currentFrameRef.current = next;
      setCurrentFrame(next);
    }

    animationFrameRef.current = requestAnimationFrame(animateFrame);
  };

  const startFallbackAnimation = () => {
    if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);

    const frames = ["closed", "almost_closed", "mid", "open", "mid", "almost_closed"];
    let idx = 0;

    fallbackIntervalRef.current = setInterval(() => {
      if (!isAiSpeakingRef.current) {
        stopAnimation();
        return;
      }
      const f = frames[idx];
      idx = (idx + 1) % frames.length;
      currentFrameRef.current = f;
      setCurrentFrame(f);
    }, 140);
  };

  const frameImages = {
    closed: avatarClosed,
    almost_closed: avatarAlmostClosed,
    mid: avatarMid,
    open: avatarOpen
  };
return (
  <div
    style={{
      width,
      height,
      position: "relative",
      overflow: "hidden",
      borderRadius: "12px"
    }}
  >
    {Object.entries(frameImages).map(([name, src]) => (
      <img
        key={name}
        src={src}
        alt={`avatar-${name}`}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",

          // CRITICAL FIX — do NOT animate opacity, use visibility instead
          visibility: currentFrame === name ? "visible" : "hidden",

          opacity: 1, // always fully opaque

          pointerEvents: "none",
          willChange: "transform"
        }}
      />
    ))}
  </div>
);

};

LipSyncAvatar.propTypes = {
  isAiSpeaking: PropTypes.bool.isRequired,
  audioRef: PropTypes.object,
  width: PropTypes.number,
  height: PropTypes.number
};

export default LipSyncAvatar;
