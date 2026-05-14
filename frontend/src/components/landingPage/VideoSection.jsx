import React, { useEffect, useRef, useState } from "react";
import { Box, Paper, IconButton, useTheme } from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import introVideo from "/static/Introducing_AI_SELEKT_HD.mp4"; // rename file to remove spaces

const VideoSection = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const ref = useRef(null);
    const videoRef = useRef(null);

    const [visible, setVisible] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => setVisible(entry.isIntersecting),
            { threshold: 0.35 }
        );

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    const handlePlay = () => {
        setIsPlaying(true);
        videoRef.current.play();
    };

    return (
        <Box
            ref={ref}
            sx={{
                py: { xs: 6, md: 10 },
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <Paper
                className={`video-card ${visible ? "visible" : ""}`}
                sx={{
                    width: "100%",
                    maxWidth: 900,
                    p: 3,
                    borderRadius: 4,
                    overflow: "hidden",
                    backdropFilter: "blur(18px)",
                    background: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(255,255,255,0.7)",
                    border: isDark
                        ? "1px solid rgba(255,255,255,0.15)"
                        : "1px solid rgba(255,255,255,0.4)",
                    boxShadow: isDark
                        ? "0 20px 60px rgba(0,0,0,0.55)"
                        : "0 18px 55px rgba(62,126,255,0.25)",
                    transform: "translateY(50px) scale(0.97)",
                    opacity: 0,
                    transition: "all .9s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
            >
                <Box
                    sx={{
                        width: "100%",
                        aspectRatio: "16/9",
                        borderRadius: 3,
                        overflow: "hidden",
                        position: "relative",
                    }}
                >
                    <video
                        ref={videoRef}
                        src={introVideo}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                        controls={isPlaying}
                    />

                    {!isPlaying && (
                        <>
                            {/* dark overlay */}
                            <Box
                                sx={{
                                    position: "absolute",
                                    inset: 0,
                                    background:
                                        "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.35))",
                                }}
                            />

                            {/* play button */}
                            <IconButton
                                onClick={handlePlay}
                                sx={{
                                    position: "absolute",
                                    top: "50%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    width: 90,
                                    height: 90,
                                    borderRadius: "50%",
                                    backdropFilter: "blur(6px)",
                                    background: "rgba(255,255,255,0.25)",
                                    color: "#fff",
                                    boxShadow: "0 8px 25px rgba(0,0,0,0.35)",
                                    transition: "0.3s ease",
                                    "&:hover": {
                                        background: "rgba(255,255,255,0.4)",
                                        transform: "translate(-50%, -50%) scale(1.08)",
                                    },
                                }}
                            >
                                <PlayArrowRoundedIcon sx={{ fontSize: 45 }} />
                            </IconButton>
                        </>
                    )}
                </Box>
            </Paper>

            <style>{`
                .video-card.visible {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
            `}</style>
        </Box>
    );
};

export default VideoSection;
