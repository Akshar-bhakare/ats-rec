import { Dialog, DialogContent, Box, Typography, IconButton, Grid, LinearProgress, Chip, Avatar, Divider, Paper } from '@mui/material';
import { X, CheckCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EvaluationModal = ({ open, onClose }) => {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            PaperProps={{
                component: motion.div,
                initial: { opacity: 0, y: 50 },
                animate: { opacity: 1, y: 0 },
                exit: { opacity: 0, y: 50 },
                sx: { borderRadius: 2, overflow: 'hidden', height: '90vh' }
            }}
        >
            {/* Header Block - Matches Image */}
            <Box sx={{ bgcolor: '#EBF4FF', p: 3, position: 'relative' }}>
                <Typography variant="h5" fontWeight="900" sx={{ color: '#1E293B' }}>Interview Report Summary</Typography>
                <Typography variant="body2" sx={{ color: '#64748B' }}>HIREX REC Hiring Solution</Typography>
                <IconButton
                    onClick={onClose}
                    sx={{ position: 'absolute', right: 16, top: 16, color: '#64748B' }}
                >
                    <X />
                </IconButton>
            </Box>

            <DialogContent sx={{ p: 4, bgcolor: '#FFFFFF' }}>
                {/* Profile Header */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" fontWeight="800" sx={{ color: '#0F172A', mb: 0.5 }}>M**** K****</Typography>
                    <Typography variant="subtitle1" sx={{ color: '#475569', mb: 2 }}>Senior Software Engineer (Candidate ID: #REC-8824)</Typography>

                    <Grid container spacing={1}>
                        {[
                            { label: 'Interviewed On', value: '18 Feb 2026' },
                            { label: 'Interview Mode', value: 'AI Voice Portal' },
                            { label: 'Interview Type', value: 'Technical - Frontend Architecture' },
                            { label: 'Assessment Status', value: 'Completed' }
                        ].map((item, i) => (
                            <Grid item xs={12} sm={6} key={i}>
                                <Typography variant="body2" sx={{ display: 'flex', gap: 1 }}>
                                    <span style={{ color: '#64748B', minWidth: 120 }}>{item.label}:</span>
                                    <span style={{ fontWeight: 600, color: '#1E293B' }}>{item.value}</span>
                                </Typography>
                            </Grid>
                        ))}
                    </Grid>
                </Box>

                {/* Total Score Card */}
                <Paper elevation={0} sx={{ p: 3, bgcolor: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: 4, mb: 4 }}>
                    <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#16A34A', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Neural Evaluation Score</Typography>
                    <Typography variant="h3" fontWeight="900" sx={{ color: '#1E293B', mb: 2 }}>82/100</Typography>
                    <Box sx={{ height: 12, bgcolor: '#DCFCE7', borderRadius: 6, overflow: 'hidden' }}>
                        <Box sx={{ width: '82%', height: '100%', bgcolor: '#16A34A' }} />
                    </Box>
                </Paper>

                {/* Overall Summary Section */}
                <Typography variant="h6" fontWeight="800" sx={{ mb: 2, color: '#1E293B' }}>Executive Summary</Typography>
                <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 4, mb: 5 }}>
                    <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.7 }}>
                        The candidate demonstrated exceptional depth in Frontend Architecture, specifically regarding Scalable State Management and Performance Optimization. They clearly articulated the trade-offs between different rendering strategies (SSR vs SSG) and exhibited a strong grasp of design patterns for large-scale React applications. Their technical communication is precise, though they could further detail their experience with micro-frontends.
                    </Typography>
                </Paper>

                {/* Video Recording & Session Link */}
                <Box sx={{ mb: 5, display: 'flex', gap: 4 }}>
                    <Box sx={{ mb: 0 }}>
                        <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#64748B', textTransform: 'uppercase', fontSize: '0.65rem' }}>EVIDENCE LOG</Typography>
                        <Typography variant="body2" component="a" href="#" sx={{ color: '#2563EB', textDecoration: 'none', fontWeight: 700, '&:hover': { textDecoration: 'underline' } }}>Full Session Recording →</Typography>
                    </Box>
                    <Box sx={{ mb: 0 }}>
                        <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#64748B', textTransform: 'uppercase', fontSize: '0.65rem' }}>DATA INTEGRITY</Typography>
                        <Typography variant="body2" component="a" href="#" sx={{ color: '#2563EB', textDecoration: 'none', fontWeight: 700, '&:hover': { textDecoration: 'underline' } }}>Verify Blockchain ID →</Typography>
                    </Box>
                </Box>

                {/* Parameter-wise Evaluation */}
                <Typography variant="h6" fontWeight="800" sx={{ mb: 3, color: '#1E293B' }}>Technical Competency Matrix</Typography>
                <Grid container spacing={2}>
                    {[
                        { title: 'System Architecture Design', score: 88, group: 'Technical Depth', color: '#DCFCE7', textColor: '#166534', text: 'Candidate showed advanced understanding of component lifecycle, hook optimization, and cross-cutting concerns in React ecosystems.' },
                        { title: 'Problem Solving Accuracy', score: 76, group: 'Cognitive Ability', color: '#FEF9C3', textColor: '#854D0E', text: 'Strong logical progression. Solved the data transformation challenge efficiently, accurately identifying edge cases for asynchronous streams.' },
                        { title: 'Code Maintainability', score: 82, group: 'Best Practices', color: '#DCFCE7', textColor: '#166534', text: 'Highly focused on SOLID principles and DRY patterns. Provided clear reasoning for choosing Composition over Inheritance in modern UI builders.' },
                        { title: 'Technical Communication', score: 91, group: 'Soft Skills', color: '#DCFCE7', textColor: '#166534', text: 'Exceptional clarity. Able to translate complex architectural decisions into business value narratives without losing technical nuance.' }
                    ].map((param, i) => (
                        <Grid item xs={12} key={i}>
                            <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 4, '&:hover': { borderColor: '#2563EB44' } }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                    <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#1E293B' }}>{param.title}</Typography>
                                    <Chip
                                        label={`${param.score}%`}
                                        sx={{
                                            bgcolor: param.color,
                                            color: param.textColor,
                                            fontWeight: 800,
                                            borderRadius: '8px',
                                            px: 1,
                                            height: 28
                                        }}
                                    />
                                </Box>
                                <Typography variant="body2" sx={{ color: '#475569', mb: 2, lineHeight: 1.6 }}>{param.text}</Typography>
                                <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>DOMAIN: {param.group}</Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>

                <Box sx={{ mt: 6, mb: 4 }}>
                    <Typography variant="h6" fontWeight="800" sx={{ mb: 1.5, color: '#1E293B' }}>Anti-Cheat & Proctoring Report</Typography>
                    <Typography variant="body2" sx={{ color: '#64748B', mb: 3 }}>Integrated HIREX Anti-Cheat monitoring was active. No significant integrity violations were discovered.</Typography>
                    <Grid container spacing={2}>
                        {[
                            { label: 'Tab Switch Frequency', val: 'Low (0)', pass: true },
                            { label: 'Face Recovery Sync', val: '99.8% Success', pass: true },
                            { label: 'External Resource Usage', val: 'None Detected', pass: true },
                            { label: 'Neural Voice Signature', val: 'Matched (Primary)', pass: true }
                        ].map((stat, i) => (
                            <Grid item xs={12} sm={6} key={i}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CheckCircle size={16} color="#16A34A" />
                                    <Typography variant="body2" sx={{ color: '#334155', fontWeight: 500 }}>
                                        <span style={{ color: '#64748B' }}>{stat.label}:</span> {stat.val}
                                    </Typography>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                </Box>

                <Divider sx={{ my: 4 }} />

                {/* Transcript Section */}
                <Box>
                    <Box sx={{ bgcolor: '#F0F9FF', p: 2, borderRadius: 2, mb: 4, borderLeft: '4px solid #0EA5E9' }}>
                        <Typography variant="h6" fontWeight="900" sx={{ color: '#0369A1' }}>Intelligent Transcript Analysis</Typography>
                        <Typography variant="caption" sx={{ color: '#0EA5E9', fontWeight: 700 }}>VERIFIED BY HIREX CORE ENGINE</Typography>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, px: 1 }}>
                        {[
                            { role: 'AI Interviewer', text: 'Can you explain your approach to managing state in a large-scale React application with frequent real-time updates?' },
                            { role: 'Candidate', text: 'For real-time data, I usually opt for a hybrid approach. I use React Query for server-state caching to handle loading and error states automatically, while using a lightweight atomic state manager like Jotai or Zustand for global UI state. This prevents unnecessary re-renders that you might get with a monolithic Context provider.' },
                            { role: 'AI Interviewer', text: 'That’s a solid strategy. How do you ensure that these real-time updates don’t lead to performance bottlenecks, especially with hundreds of updates per minute?' },
                            { role: 'Candidate', text: 'Normalization is key there. By flattening the state, we can update individual records without touching the entire tree. Combined with windowing for the UI layer, we ensure the DOM only handles what’s visible, maintaining 60fps even during high burst periods.' }
                        ].map((msg, i) => (
                            <Box key={i}>
                                <Typography variant="subtitle2" fontWeight="900" sx={{ color: msg.role.includes('AI') ? '#0EA5E9' : '#475569', mb: 0.5 }}>{msg.role}</Typography>
                                <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.6, bgcolor: msg.role.includes('AI') ? 'transparent' : '#F8FAFC', p: msg.role.includes('AI') ? 0 : 2, borderRadius: 2 }}>
                                    {msg.text}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default EvaluationModal;
