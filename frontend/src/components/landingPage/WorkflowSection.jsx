// File: ProcessSection.jsx
import React, { useRef, useEffect, useState } from "react";
import { Box, Container, Typography, Stack, useTheme, alpha } from "@mui/material";
import {
  Search,
  ScanSearch,
  CalendarClock,
  Brain,
  Users,
  BadgeCheck
} from "lucide-react";

const SpotlightCard = ({ children, spotlightColor, style, className }) => {
  const ref = useRef(null);

  const handleMouseMove = e => {
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    ref.current.style.setProperty("--my", `${e.clientY - rect.top}px`);
    ref.current.style.setProperty("--sc", spotlightColor);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`card-spotlight ${className}`}
      style={style}
    >
      {children}
    </div>
  );
};

const steps = [
  { icon: <Search />, title: "Sourcing", desc: "Find the right talent faster with intelligent search and recommendations." },
  { icon: <ScanSearch />, title: "AI-Assisted Screening", desc: "Let AI pre-qualify candidates with voice, chat, or video evaluations." },
  { icon: <CalendarClock />, title: "Automated Scheduling", desc: "Interviews arranged instantly—no back-and-forth needed." },
  { icon: <Brain />, title: "AI-Driven Evaluation", desc: "Get unbiased candidate insights and scoring powered by machine intelligence." },
  { icon: <Users />, title: "Centralized Candidate Management", desc: "Track every applicant from sourcing to selection with ease." },
  { icon: <BadgeCheck />, title: "Faster, Smarter Hiring", desc: "Complete your recruitment cycle effortlessly—from search to hire." }
];

export default function WorkflowSection() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true);
    }, { threshold: 0.25 });

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={sectionRef}
      sx={{
        py: { xs: 8, md: 20 },
        background: isDark
          ? "linear-gradient(180deg, #06101E 0%, #0E1C30 40%, #0A121A 100%)"
          : `
            radial-gradient(circle at 20% 20%, rgba(78,162,255,0.18), transparent 55%),
            radial-gradient(circle at 80% 70%, rgba(123,170,255,0.15), transparent 60%),
            linear-gradient(180deg, #F9FBFF 0%, #EDF4FF 50%, #FFFFFF 100%)
          `,
        transition: "background .4s ease"
      }}
    >
      <Container maxWidth="xl">

        <Box sx={{
          textAlign: "center",
          mb: 6,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(30px)",
          transition: "all .9s ease"
        }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: theme.palette.text.secondary, mb: 1 }}>
            STEP BY STEP PROCESS
          </Typography>

          <Typography sx={{ fontSize: { xs: 30, md: 44 }, fontWeight: 800 }}>
            We Complete Every{" "}
            <span style={{ color: theme.palette.primary.main }}>Step Carefully</span>
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gap: "28px",
            px: { xs: 2, md: 8, lg: 14 },
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
            justifyItems: "center"
          }}
        >
          {steps.map((step, i) => (
            <SpotlightCard
              key={i}
              className={`fade-card ${visible ? "show" : ""}`}
              style={{
                transitionDelay: `${i * 0.15}s`,
                "--card-border": isDark
                  ? "rgba(255,255,255,0.14)"   // Dark mode border
                  : "rgba(0,0,0,0.18)",        // ✅ Updated lighter visible border
                "--card-bg": isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(255,255,255,0.78)"
              }}
              spotlightColor={
                isDark
                  ? alpha(theme.palette.primary.main, 0.28)
                  : alpha(theme.palette.primary.main, 0.35)
              }
            >
              <Stack spacing={1.8} sx={{ minHeight: 220, justifyContent: "center", alignItems: "center", textAlign: "center", px: 3 }}>
                <Box
                  sx={{
                    width: 58,
                    height: 58,
                    borderRadius: "12px",
                    background: isDark
                      ? alpha(theme.palette.primary.light, 0.12)
                      : alpha(theme.palette.primary.light, 0.25),
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    color: theme.palette.primary.main,
                    backdropFilter: "blur(6px)",
                    "& svg": { width: 28, height: 28, strokeWidth: 2.2 }
                  }}
                >
                  {step.icon}
                </Box>

                <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
                  {step.title}
                </Typography>

                <Typography sx={{ opacity: 0.75, fontSize: 14, lineHeight: 1.5, maxWidth: 260 }}>
                  {step.desc}
                </Typography>
              </Stack>
            </SpotlightCard>
          ))}
        </Box>
      </Container>

      <style>{`
        .fade-card {
          opacity: 0;
          transform: translateY(40px);
        }
        .fade-card.show {
          opacity: 1;
          transform: translateY(0);
          transition: opacity .8s ease, transform .8s ease;
        }
        .card-spotlight {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid var(--card-border);
          background: var(--card-bg);
          backdrop-filter: blur(10px);
          transition: transform .25s ease, border-color .3s ease, background .3s ease;
          position: relative;
          overflow: hidden;
          padding: 1.2rem;
        }
        .card-spotlight:hover {
          transform: translateY(-6px);
          border-color: var(--sc);
        }
        .card-spotlight::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at var(--mx) var(--my), var(--sc), transparent 70%);
          opacity: 0;
          transition: opacity .3s ease;
        }
        .card-spotlight:hover::before {
          opacity: 0.9;
        }
      `}</style>
    </Box>
  );
}
