import React from 'react';
import {
  Box,
  Container,
  Grid,
  Stack,
  Typography,
  Chip,
  Card,
  CardContent,
  Avatar,
  Button,
  Divider,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/system';
import { motion } from 'framer-motion';

import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import HeadphonesRoundedIcon from '@mui/icons-material/HeadphonesRounded';
import Diversity3RoundedIcon from '@mui/icons-material/Diversity3Rounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import PhoneEnabledRoundedIcon from '@mui/icons-material/PhoneEnabledRounded';
import LanRoundedIcon from '@mui/icons-material/LanRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';

const fadeIn = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const Stat = ({ label, value, icon, delay = 0 }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card
      component={motion.div}
      variants={fadeIn}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay }}
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        background: isDark
          ? `linear-gradient(180deg, ${alpha('#FFFFFF', 0.06)}, ${alpha('#FFFFFF', 0.03)})`
          : 'linear-gradient(180deg,#ffffff,#fbfdff)',
        boxShadow: isDark ? '0 10px 26px rgba(0,0,0,0.35)' : '0 10px 24px rgba(2,7,26,0.06)',
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ color: 'primary.main' }}>{icon}</Box>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 24, lineHeight: 1, color: 'text.primary' }}>
              {value}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

const TimelineItem = ({ year, title, desc, last = false }) => {
  const theme = useTheme();
  return (
    <Stack direction="row" spacing={2} sx={{ position: 'relative', pl: 1 }}>
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          mt: 0.75,
          boxShadow: `0 0 0 4px ${alpha(theme.palette.grey[400], 0.35)}`,
          flexShrink: 0,
        }}
      />
      {!last && (
        <Box
          sx={{
            position: 'absolute',
            left: 5.5,
            top: 20,
            bottom: -18,
            width: 1.5,
            bgcolor: alpha(theme.palette.primary.main, 0.18),
          }}
        />
      )}
      <Box>
        <Typography variant="overline" sx={{ opacity: 0.75, color: 'text.secondary' }}>
          {year}
        </Typography>
        <Typography sx={{ fontWeight: 800, color: 'text.primary' }}>{title}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {desc}
        </Typography>
      </Box>
    </Stack>
  );
};

const Leader = ({ name, role, initials }) => (
  <Stack alignItems="center" spacing={1.2}>
    <Avatar sx={{ width: 64, height: 64, bgcolor: 'grey.300', color: 'text.primary', fontWeight: 800 }}>
      {initials}
    </Avatar>
    <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>{name}</Typography>
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {role}
    </Typography>
  </Stack>
);

const AboutUs = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const bgTop = isDark ? alpha(theme.palette.primary.light, 0.06) : '#ffffff';
  const bgBottom = isDark ? alpha(theme.palette.primary.main, 0.10) : '#f5f9ff';

  return (
    <Box
      id="about"
      sx={{
        py: { xs: 8, md: 12 },
        background: `linear-gradient(180deg, ${bgTop} 0%, ${bgBottom} 100%)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: `radial-gradient(900px 420px at 12% 0%, ${alpha(
            theme.palette.primary.main,
            isDark ? 0.12 : 0.10
          )}, transparent 60%), radial-gradient(700px 380px at 90% 40%, ${alpha(
            theme.palette.primary.light,
            isDark ? 0.12 : 0.10
          )}, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        {/* Heading */}
        <Stack alignItems="center" spacing={1} sx={{ mb: 4 }}>
          <Typography
            component={motion.h2}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5 }}
            sx={{
              textAlign: 'center',
              fontSize: { xs: 28, sm: 36, md: 44 },
              fontWeight: 900,
              letterSpacing: -0.4,
              backgroundImage: isDark
                ? 'linear-gradient(90deg,#90caf9,#42a5f5 40%,#1e88e5)'
                : 'linear-gradient(90deg,#0d47a1,#1976d2 40%,#42a5f5)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Building the AI-First Recruiter
          </Typography>
          <Typography
            variant="h6"
            sx={{ textAlign: 'center', color: 'text.secondary', maxWidth: 960 }}
          >
            Hirex REC turns hiring conversations into outcomes—at scale. We blend human-like voice
            agents, assessment tech, SLA nudges, and ATS integrations to remove friction from
            recruiting for every role on the team.
          </Typography>
        </Stack>

        {/* Values + Stats */}
        <Grid container spacing={4} alignItems="stretch" sx={{ mb: 3 }}>
          <Grid item xs={12} md={7}>
            <Card
              component={motion.div}
              variants={fadeIn}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.25 }}
              elevation={0}
              sx={{
                height: '100%',
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                background: isDark
                  ? `linear-gradient(180deg, ${alpha('#FFFFFF', 0.06)}, ${alpha('#FFFFFF', 0.03)})`
                  : 'linear-gradient(180deg,#ffffff,#fbfdff)',
                boxShadow: isDark ? '0 12px 28px rgba(0,0,0,0.4)' : '0 12px 28px rgba(2,7,26,0.06)',
              }}
            >
              <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
                <Typography sx={{ fontWeight: 800, mb: 1.5, color: 'text.primary' }}>
                  Our Principles
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip icon={<PsychologyRoundedIcon />} label="Human-like by design" />
                  <Chip icon={<BoltRoundedIcon />} label="Automation where it matters" />
                  <Chip icon={<ShieldRoundedIcon />} label="Security & compliance" />
                  <Chip icon={<Diversity3RoundedIcon />} label="Candidate-first" />
                  <Chip icon={<PublicRoundedIcon />} label="Multi-language" />
                  <Chip icon={<HeadphonesRoundedIcon />} label="SLA & support mindset" />
                </Stack>

                <Divider sx={{ my: 2.5 }} />

                <Typography sx={{ fontWeight: 800, mb: 1, color: 'text.primary' }}>
                  What we’re building
                </Typography>
                <Stack spacing={1} sx={{ color: 'text.secondary' }}>
                  <Stack direction="row" spacing={1}>
                    <PhoneEnabledRoundedIcon fontSize="small" color="primary" />
                    <Typography variant="body2">
                      AI voice agents for outbound + inbound, with typeahead-driven workflows.
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <InsightsRoundedIcon fontSize="small" color="primary" />
                    <Typography variant="body2">
                      Coding/video assessments, feedback SLAs, and conversation intelligence.
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <LanRoundedIcon fontSize="small" color="primary" />
                    <Typography variant="body2">
                      Native ATS connectors (Greenhouse, Workday, Zoho Recruit & more).
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={5}>
            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={6} md={12}>
                <Stat value="120+" label="Teams trust Hirex REC" icon={<RocketLaunchRoundedIcon />} />
              </Grid>
              <Grid item xs={6} sm={6} md={6}>
                <Stat value="100s" label="Concurrent calls" icon={<PhoneEnabledRoundedIcon />} delay={0.05} />
              </Grid>
              <Grid item xs={6} sm={6} md={6}>
                <Stat value="99.9%" label="Uptime target" icon={<ShieldRoundedIcon />} delay={0.1} />
              </Grid>
            </Grid>
          </Grid>
        </Grid>

        {/* Timeline */}
        <Grid container spacing={4} alignItems="center" sx={{ mt: 1 }}>
          <Grid item xs={12} md={6}>
            <Typography sx={{ fontWeight: 800, mb: 1.5, color: 'text.primary' }}>
              Our Journey
            </Typography>
            <Stack spacing={3}>
              <TimelineItem
                year="2023"
                title="Idea to prototype"
                desc="Built the first AI calling agent and typeahead UX replacing heavy dropdowns."
              />
              <TimelineItem
                year="2024"
                title="Pilot with hiring teams"
                desc="Added assessments, SLA nudges for panelists, and ATS syncing."
              />
              <TimelineItem
                year="2025"
                title="Scale & integrations"
                desc="Multi-provider telephony, queueing & failover; expanded to enterprise security."
                last
              />
            </Stack>
          </Grid>

          {/* Leadership + CTA */}
          <Grid item xs={12} md={6}>
            <Card
              component={motion.div}
              variants={fadeIn}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.25 }}
              elevation={0}
              sx={{
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                background: isDark
                  ? `linear-gradient(180deg, ${alpha('#FFFFFF', 0.06)}, ${alpha('#FFFFFF', 0.03)})`
                  : 'linear-gradient(180deg,#ffffff,#fbfdff)',
                boxShadow: isDark ? '0 12px 28px rgba(0,0,0,0.4)' : '0 12px 28px rgba(2,7,26,0.06)',
              }}
            >
              <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
                <Typography sx={{ fontWeight: 800, mb: 2, color: 'text.primary' }}>
                  Leadership
                </Typography>
                <Stack direction="row" spacing={4} flexWrap="wrap">
                  <Leader name="Nikhil Batra" role="Founder & CEO" initials="NK" />
                  <Leader name="Vidhi" role="Head of Product" initials="VD" />
                  <Leader name="Rahul" role="Engineering Lead" initials="RH" />
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' }, fontWeight: 700, borderRadius: 2 }}
                  >
                    Join our mission
                  </Button>
                  <Button variant="outlined" sx={{ borderRadius: 2 }}>
                    Learn more about us
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default AboutUs;
