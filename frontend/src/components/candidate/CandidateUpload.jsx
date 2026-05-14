import React, { useState } from 'react';
import {
  Typography,
  Autocomplete,
  TextField,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  Grid,
  Paper,
  Box,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import BWButton from '../commonUI/BWButton';
import BWModal from '../commonUI/BWModal';
import usePersistentRows from '../../hooks/usePersistentRows';
import MUIFileInput from '../MUI/commonUI/MUIFileInput';

const StyledConnector = styled(StepConnector)(({ theme }) => ({
  top: 12,
  left: 'calc(-50% + 16px)',
  right: 'calc(50% + 16px)',
  '& .MuiStepConnector-line': {
    borderColor: theme.palette.divider,
    borderTopWidth: 2,
  },
}));

const StepIconRoot = styled('div')(({ theme, ownerState }) => ({
  backgroundColor: ownerState.active
    ? theme.palette.primary.main
    : theme.palette.grey[400],
  color: '#fff',
  width: 28,
  height: 28,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: 14,
}));

function StepCircleIcon(props) {
  const { active, icon } = props;
  return <StepIconRoot ownerState={{ active }}>{icon}</StepIconRoot>;
}

const steps = ['Upload', 'Confirm', 'AI Call'];

const cardStyle = (active, theme) => ({
  p: 3,
  borderRadius: 2,
  textAlign: 'center',
  cursor: 'pointer',
  border: `2px solid ${active ? theme.palette.primary.main : theme.palette.divider
    }`,
  backgroundColor: active ? theme.palette.action.hover : 'transparent',
});

const CandidateUpload = ({ open, onClose }) => {
  const [jobs] = usePersistentRows('jobs');
  const [selectedJob, setSelectedJob] = useState(null);
  const [uploadMode, setUploadMode] = useState('single');
  const [files, setFiles] = useState([]);
  const [activeStep, setActiveStep] = useState(0);

  const reset = () => {
    setSelectedJob(null);
    setUploadMode('single');
    setFiles([]);
    setActiveStep(0);
  };

  const handleClose = () => {
    reset();
    onClose();
  };
  const handleNext = () => setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  const handleBack = () => setActiveStep((s) => Math.max(s - 1, 0));

  const ACCEPTED = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  return (
    <BWModal open={open} onClose={handleClose} PaperProps={{ sx: { maxWidth: 600 } }}>
      <Typography variant="h6" align="center" gutterBottom>
        Upload Candidate Resume
      </Typography>

      <Typography align="center" sx={{ mb: 2 }}>
        Select a job and then upload one or more resumes.
      </Typography>

      <Typography align="center" sx={{ fontWeight: 600 }}>
        Select Job
      </Typography>

      <Autocomplete
        options={jobs}
        getOptionLabel={(o) =>
          `${o.title || ''}${o.company ? ' — ' + o.company : ''}`.trim()
        }
        noOptionsText="No matching job"
        renderInput={(params) => (
          <TextField {...params} placeholder="Search by title, company, or unit…" size="small" />
        )}
        value={selectedJob}
        onChange={(_, v) => setSelectedJob(v)}
        sx={{ mt: 1, mb: 2 }}
      />

      {!selectedJob ? (
        <Typography align="center" color="text.secondary" sx={{ mt: 4 }}>
          Please select a job to enable resume upload.
        </Typography>
      ) : (
        <>
          <Stepper
            activeStep={activeStep}
            alternativeLabel
            connector={<StyledConnector />}
            sx={{ my: 3 }}
          >
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel StepIconComponent={StepCircleIcon}>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 && (
            <>
              <Grid container spacing={2} justifyContent="center" sx={{ mb: 3 }}>
                {[
                  { id: 'single', label: 'Single Resume', icon: '📄' },
                  { id: 'bulk', label: 'Bulk Upload', icon: '📁' },
                  { id: 'csv', label: 'CSV Upload', icon: '📝' },
                ].map((m) => (
                  <Grid item xs={12} sm={4} key={m.id}>
                    <Paper
                      elevation={0}
                      sx={(theme) => cardStyle(uploadMode === m.id, theme)}
                      onClick={() => setUploadMode(m.id)}
                    >
                      <Typography sx={{ fontSize: 40 }}>{m.icon}</Typography>
                      <Typography sx={{ mt: 1, fontWeight: 600 }}>{m.label}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              <MUIFileInput
                label="Drag & drop resume(s)"
                maxFiles={uploadMode === 'single' ? 1 : 50}
                acceptedTypes={ACCEPTED}
                onChange={setFiles}
              />

              <BWButton
                fullWidth
                disabled={files.length === 0}
                onClick={handleNext}
                sx={{ mb: 2, backgroundColor: '#1976d2' }}
              >
                Upload Resume
              </BWButton>
            </>
          )}

          {activeStep === 1 && (
            <>
              <Typography sx={{ mb: 2 }}>
                <strong>{files.length}</strong> file
                {files.length > 1 ? 's are' : ' is'} ready to be processed for{' '}
                <strong>{selectedJob.title}</strong>.
              </Typography>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <BWButton onClick={handleBack}>Back</BWButton>
                <BWButton onClick={handleNext} sx={{ backgroundColor: '#1976d2' }}>
                  Confirm &amp; Continue
                </BWButton>
              </Box>
            </>
          )}

          {activeStep === 2 && (
            <>
              <Typography sx={{ mb: 3 }}>
                Résumé{files.length > 1 && 's'} uploaded! An AI‑recruiter call will be
                scheduled automatically.
              </Typography>
              <BWButton onClick={handleClose}>Done</BWButton>
            </>
          )}
        </>
      )}
    </BWModal>
  );
};

export default CandidateUpload;
